import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  PowerOff,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { computeHaversineKm, resolveBangladeshCityCoords } from '../data/bangladeshCoords.ts';
import type { BookingLocationPoint, BookingRecord } from '../types/logeasi.ts';

interface PathaoLiveMapProps {
  city?: string;
  division?: string;
  venueName?: string;
  customerLiveLocation?: BookingLocationPoint | null;
  meetupLocation?: BookingLocationPoint | null;
  adminDispatchedLocation?: BookingLocationPoint | null;
  draftPin?: { lat: number; lng: number } | null;
  pickMode?: 'customer_pickup' | 'admin_meetup' | 'view';
  onPickLocation?: (coords: { lat: number; lng: number }) => void;
  onShareLiveLocation?: (coords: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
  }) => Promise<void> | void;
  onRevokeLiveLocation?: () => Promise<void> | void;
  showLiveControls?: boolean;
  heightPx?: number;
  adminInstruction?: string;
  locationStatus?: BookingRecord['adminLocationStatus'];
  title?: string;
}

function MarkerPinWithInfo({
  position,
  title,
  subtitle,
  bgColor,
  borderColor,
  glyphText,
}: {
  position: { lat: number; lng: number };
  title: string;
  subtitle?: string;
  bgColor: string;
  borderColor: string;
  glyphText: string;
}) {
  const [open, setOpen] = useState(false);
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        <Pin
          background={bgColor}
          borderColor={borderColor}
          glyphColor="#ffffff"
          glyphText={glyphText}
          scale={1.15}
        />
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} maxWidth={240} onCloseClick={() => setOpen(false)}>
          <div className="text-xs text-slate-900 space-y-1 p-0.5">
            <p className="font-bold">{title}</p>
            {subtitle && <p className="text-slate-600">{subtitle}</p>}
            <p className="font-mono text-[10px] text-slate-500">
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function RoutePathLayer({
  origin,
  destination,
  onStats,
}: {
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
  onStats: (stats: { distanceLabel: string; durationLabel: string; source: 'routes_api' | 'estimate' } | null) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const mapsLib = useMapsLibrary('maps');
  const coreLib = useMapsLibrary('core');
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    const clearExisting = () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };

    if (!origin || !destination) {
      clearExisting();
      onStats(null);
      return;
    }

    const sameSpot =
      Math.abs(origin.lat - destination.lat) < 0.0001 &&
      Math.abs(origin.lng - destination.lng) < 0.0001;
    if (sameSpot) {
      clearExisting();
      onStats({ distanceLabel: '০.১ কিমি', durationLabel: '১-২ মিনিট', source: 'estimate' });
      return;
    }

    let cancelled = false;
    const haversineKm = computeHaversineKm(origin, destination);
    const estMinutes = Math.max(3, Math.round((haversineKm / 18) * 60));

    const drawFallbackLine = () => {
      const gMaps = (window as any).google?.maps;
      const PolylineCtor = (mapsLib as any)?.Polyline || gMaps?.Polyline;
      const BoundsCtor = (coreLib as any)?.LatLngBounds || gMaps?.LatLngBounds;
      if (!PolylineCtor) return;
      clearExisting();
      polylineRef.current = new PolylineCtor({
        path: [origin, destination],
        geodesic: true,
        strokeColor: '#E11D48',
        strokeOpacity: 0,
        icons: [
          {
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.85, scale: 3 },
            offset: '0',
            repeat: '14px',
          },
        ],
        strokeWeight: 3,
        map,
      });
      if (BoundsCtor) {
        const bounds = new BoundsCtor();
        bounds.extend(origin);
        bounds.extend(destination);
        map.fitBounds(bounds, 48);
      }
    };

    const routesAny = routesLib as any;
    const RouteCtor = routesAny?.Route;
    const gMaps = (window as any).google?.maps;
    const PolylineCtor = (mapsLib as any)?.Polyline || gMaps?.Polyline;
    const BoundsCtor = (coreLib as any)?.LatLngBounds || gMaps?.LatLngBounds;

    if (!RouteCtor) {
      drawFallbackLine();
      onStats({
        distanceLabel: `${haversineKm.toFixed(1)} কিমি`,
        durationLabel: `~${estMinutes} মিনিট`,
        source: 'estimate',
      });
      return () => clearExisting();
    }

    const routeService = new RouteCtor();
    const travelMode = routesAny?.TravelMode?.DRIVING || 'DRIVING';

    routeService
      .computeRoutes({
        origin,
        destination,
        travelMode,
      })
      .then((response: any) => {
        if (cancelled) return;
        const route = response?.routes?.[0];
        if (route?.polyline?.encodedPolyline && PolylineCtor && typeof RouteCtor.decode === 'function') {
          clearExisting();
          const decodedPath = RouteCtor.decode(route.polyline.encodedPolyline);
          polylineRef.current = new PolylineCtor({
            path: decodedPath,
            geodesic: true,
            strokeColor: '#E11D48',
            strokeOpacity: 0.92,
            strokeWeight: 5,
            map,
          });
          if (route.viewport && BoundsCtor) {
            const bounds = new BoundsCtor(route.viewport.southwest, route.viewport.northeast);
            map.fitBounds(bounds, 48);
          } else if (BoundsCtor) {
            const bounds = new BoundsCtor();
            bounds.extend(origin);
            bounds.extend(destination);
            map.fitBounds(bounds, 48);
          }

          const distKm = route.distanceMeters
            ? (Number(route.distanceMeters) / 1000).toFixed(1)
            : haversineKm.toFixed(1);
          const durSec = route.durationMillis
            ? Math.round(Number(route.durationMillis) / 1000)
            : parseInt(String(route.duration || '0'), 10);
          const durMin = durSec > 0 ? Math.max(1, Math.round(durSec / 60)) : estMinutes;
          onStats({
            distanceLabel: `${distKm} কিমি`,
            durationLabel: `${durMin} মিনিট`,
            source: 'routes_api',
          });
        } else {
          drawFallbackLine();
          onStats({
            distanceLabel: `${haversineKm.toFixed(1)} কিমি`,
            durationLabel: `~${estMinutes} মিনিট`,
            source: 'estimate',
          });
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        const msg = String(err?.message || err || '');
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('429') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('Quota')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        drawFallbackLine();
        onStats({
          distanceLabel: `${haversineKm.toFixed(1)} কিমি`,
          durationLabel: `~${estMinutes} মিনিট`,
          source: 'estimate',
        });
      });

    return () => {
      cancelled = true;
      clearExisting();
    };
  }, [map, routesLib, mapsLib, coreLib, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  return null;
}

function MapStatusObserver({ onErrorState }: { onErrorState: (err: boolean) => void }) {
  const status = useApiLoadingStatus();
  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
      onErrorState(true);
      if (status === APILoadingStatus.AUTH_FAILURE) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    } else if (status === APILoadingStatus.LOADED) {
      onErrorState(false);
    }
  }, [status, onErrorState]);
  return null;
}

function MapPanController({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo(target);
  }, [map, target?.lat, target?.lng]);
  return null;
}

export function PathaoLiveMap({
  city,
  division,
  venueName,
  customerLiveLocation,
  meetupLocation,
  adminDispatchedLocation,
  draftPin,
  pickMode = 'view',
  onPickLocation,
  onShareLiveLocation,
  onRevokeLiveLocation,
  showLiveControls = false,
  heightPx = 300,
  adminInstruction,
  locationStatus,
  title,
}: PathaoLiveMapProps) {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';
  const fallbackGeo = useMemo(
    () => resolveBangladeshCityCoords(city, division, venueName),
    [city, division, venueName]
  );

  const [mapLoadError, setMapLoadError] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [watchingLive, setWatchingLive] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const [routeStats, setRouteStats] = useState<{
    distanceLabel: string;
    durationLabel: string;
    source: 'routes_api' | 'estimate';
  } | null>(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const primaryCenter = useMemo(() => {
    if (draftPin) return draftPin;
    if (adminDispatchedLocation) return { lat: adminDispatchedLocation.lat, lng: adminDispatchedLocation.lng };
    if (customerLiveLocation) return { lat: customerLiveLocation.lat, lng: customerLiveLocation.lng };
    if (meetupLocation) return { lat: meetupLocation.lat, lng: meetupLocation.lng };
    return { lat: fallbackGeo.lat, lng: fallbackGeo.lng };
  }, [draftPin, adminDispatchedLocation, customerLiveLocation, meetupLocation, fallbackGeo]);

  const routeOrigin = customerLiveLocation
    ? { lat: customerLiveLocation.lat, lng: customerLiveLocation.lng }
    : null;
  const routeDestination = adminDispatchedLocation
    ? { lat: adminDispatchedLocation.lat, lng: adminDispatchedLocation.lng }
    : meetupLocation
      ? { lat: meetupLocation.lat, lng: meetupLocation.lng }
      : draftPin || null;

  const triggerSingleGpsShare = () => {
    if (!onShareLiveLocation) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('আপনার ব্রাউজারে GPS লাইভ লোকেশন সাপোর্ট পাওয়া যায়নি। ম্যাপে ট্যাপ করে পিন বসান।');
      return;
    }
    setGpsError('');
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await onShareLiveLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
          });
        } catch (err: any) {
          setGpsError(err?.message || 'লাইভ লোকেশন পাঠানো যায়নি।');
        } finally {
          setGpsBusy(false);
        }
      },
      (geoErr) => {
        setGpsBusy(false);
        setGpsError(
          geoErr.code === 1
            ? 'ব্রাউজারে লোকেশন পারমিশন Allow করুন অথবা ম্যাপে ট্যাপ করে আপনার অবস্থান দিন।'
            : 'GPS সিগন্যাল পাওয়া যায়নি। ম্যাপে ট্যাপ করে পিন বসাতে পারেন।'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
    );
  };

  const toggleLiveWatch = () => {
    if (!onShareLiveLocation || typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (watchingLive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setWatchingLive(false);
      return;
    }
    setGpsError('');
    setWatchingLive(true);
    let lastSent = 0;
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastSent < 8000) return;
        lastSent = now;
        try {
          await onShareLiveLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: pos.coords.accuracy,
          });
        } catch {
          // ignore transient sync errors
        }
      },
      () => {
        setWatchingLive(false);
        setGpsError('লাইভ ট্র্যাকিং চালু করা যায়নি। ম্যানুয়ালি একবার লোকেশন দিন।');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
    watchIdRef.current = id;
  };

  const handleStopAndRevoke = async () => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatchingLive(false);
    if (onRevokeLiveLocation) {
      await onRevokeLiveLocation();
    }
  };

  const targetLinkCoords =
    adminDispatchedLocation || customerLiveLocation || meetupLocation || draftPin || fallbackGeo;
  const externalGoogleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${targetLinkCoords.lat},${targetLinkCoords.lng}`;

  const statusLabel = (() => {
    if (locationStatus === 'customer_shared' || customerLiveLocation) {
      return 'কাস্টমার সঙ্গীর সাথে লাইভ লোকেশন শেয়ার করেছেন';
    }
    if (locationStatus === 'admin_dispatched') return 'মিটআপ ম্যাপ লোকেশন নির্ধারিত আছে';
    return 'কাস্টমার ↔ সঙ্গী লাইভ লোকেশন ও ম্যাপ প্রস্তুত';
  })();

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Top Map Header */}
      <div className="bg-slate-950 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center shrink-0">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">
              {title || 'কাস্টমার ↔ সঙ্গী লাইভ Google Maps ও লোকেশন সমন্বয়'}
            </p>
            <p className="text-[11px] text-slate-300 truncate">{statusLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {routeStats && (
            <span className="text-[11px] font-mono bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-md text-emerald-300 tabular-nums">
              {routeStats.distanceLabel} · {routeStats.durationLabel}
            </span>
          )}
          <a
            href={externalGoogleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-md inline-flex items-center gap-1 text-white"
          >
            <ExternalLink className="w-3 h-3" /> Google Maps-এ দেখুন
          </a>
        </div>
      </div>

      {/* Interactive Map Canvas */}
      <div className="relative w-full bg-slate-100" style={{ height: `${heightPx}px` }}>
        {!apiKey || mapLoadError ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2 bg-slate-100 text-slate-700">
            <Compass className="w-8 h-8 text-rose-600" />
            <p className="text-xs font-bold text-slate-900">
              {fallbackGeo.label} ({targetLinkCoords.lat.toFixed(4)}, {targetLinkCoords.lng.toFixed(4)})
            </p>
            <p className="text-[11px] text-slate-600 max-w-md">
              লাইভ ম্যাপ ভিউ আপাতত লোড হচ্ছে না বা কোটা পূর্ণ হয়েছে — তবে নিচে GPS শেয়ার ও Google Maps লিংক সম্পূর্ণ সচল রয়েছে।
            </p>
            <a
              href={externalGoogleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Google Maps অ্যাপে খুলুন
            </a>
          </div>
        ) : (
          <APIProvider apiKey={apiKey} libraries={['routes', 'marker']} language="bn" region="BD">
            <MapStatusObserver onErrorState={setMapLoadError} />
            <GoogleMap
              mapId="DEMO_MAP_ID"
              defaultCenter={primaryCenter}
              defaultZoom={14}
              gestureHandling="greedy"
              streetViewControl={false}
              mapTypeControl={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              onClick={(ev) => {
                if (pickMode === 'view' || !onPickLocation) return;
                const latLng = ev.detail?.latLng;
                if (latLng && typeof latLng.lat === 'number' && typeof latLng.lng === 'number') {
                  onPickLocation({ lat: Number(latLng.lat.toFixed(6)), lng: Number(latLng.lng.toFixed(6)) });
                }
              }}
              style={{ width: '100%', height: '100%' }}
            >
              <MapPanController target={draftPin || adminDispatchedLocation || customerLiveLocation || null} />

              {customerLiveLocation && (
                <MarkerPinWithInfo
                  position={{ lat: customerLiveLocation.lat, lng: customerLiveLocation.lng }}
                  title="কাস্টমার লাইভ লোকেশন"
                  subtitle={customerLiveLocation.addressLabel || 'কাস্টমারের বর্তমান GPS পিন'}
                  bgColor="#1D4ED8"
                  borderColor="#1E3A8A"
                  glyphText="ক"
                />
              )}

              {meetupLocation && (
                <MarkerPinWithInfo
                  position={{ lat: meetupLocation.lat, lng: meetupLocation.lng }}
                  title="প্রস্তাবিত মিটআপ স্থান"
                  subtitle={meetupLocation.addressLabel || venueName || city}
                  bgColor="#475569"
                  borderColor="#1E293B"
                  glyphText="ম"
                />
              )}

              {adminDispatchedLocation && (
                <MarkerPinWithInfo
                  position={{ lat: adminDispatchedLocation.lat, lng: adminDispatchedLocation.lng }}
                  title="অ্যাডমিন চূড়ান্ত মিটআপ লোকেশন"
                  subtitle={adminDispatchedLocation.addressLabel || 'অ্যাডমিন নির্ধারিত নিরাপদ স্থান'}
                  bgColor="#E11D48"
                  borderColor="#9F1239"
                  glyphText="অ"
                />
              )}

              {draftPin && (
                <MarkerPinWithInfo
                  position={draftPin}
                  title={pickMode === 'admin_meetup' ? 'নতুন অ্যাডমিন পিন (খসড়া)' : 'আপনার নির্বাচিত পিন'}
                  subtitle="ম্যাপে ক্লিক করে পিন সরাতে পারবেন"
                  bgColor="#059669"
                  borderColor="#065F46"
                  glyphText="★"
                />
              )}

              <RoutePathLayer
                origin={routeOrigin}
                destination={routeDestination}
                onStats={setRouteStats}
              />
            </GoogleMap>
          </APIProvider>
        )}

        {pickMode !== 'view' && (
          <div className="pointer-events-none absolute bottom-2.5 left-2.5 bg-slate-950/85 text-white text-[11px] px-2.5 py-1 rounded-md shadow">
            ম্যাপের যেকোনো জায়গায় ট্যাপ/ক্লিক করে পিন বসান
          </div>
        )}
      </div>

      {/* Controls, Pin Legend & Admin Coordination Explanation */}
      <div className="p-4 space-y-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-700 inline-block" /> কাস্টমার লাইভ GPS
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" /> অ্যাডমিন চূড়ান্ত মিটআপ পিন
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" /> প্রস্তাবিত ভেন্যু ({venueName || fallbackGeo.label})
          </span>
        </div>

        {showLiveControls && onShareLiveLocation && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={gpsBusy}
              onClick={triggerSingleGpsShare}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              {gpsBusy
                ? 'GPS নেওয়া হচ্ছে...'
                : customerLiveLocation
                  ? 'আমার লাইভ লোকেশন আপডেট করুন'
                  : 'আমার লাইভ লোকেশন দিন'}
            </button>

            <button
              type="button"
              onClick={toggleLiveWatch}
              className={`px-3 py-2 border font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer ${
                watchingLive
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {watchingLive ? 'লাইভ ট্র্যাকিং চালু আছে' : 'লাইভ ট্র্যাকিং চালু করুন'}
            </button>

            {(customerLiveLocation || watchingLive) && onRevokeLiveLocation && (
              <button
                type="button"
                onClick={handleStopAndRevoke}
                className="px-3 py-2 border border-red-200 text-red-700 hover:bg-red-50 font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PowerOff className="w-3.5 h-3.5" /> লোকেশন বন্ধ করুন
              </button>
            )}
          </div>
        )}

        {gpsError && <p className="text-xs text-red-700 font-medium">{gpsError}</p>}

        {customerLiveLocation && (
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-950 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span>
                <strong>কাস্টমার লাইভ অবস্থান:</strong>{' '}
                {customerLiveLocation.addressLabel || 'GPS অবস্থান'} (
                <span className="font-mono">
                  {customerLiveLocation.lat.toFixed(5)}, {customerLiveLocation.lng.toFixed(5)}
                </span>
                {customerLiveLocation.accuracyMeters ? ` · ±${customerLiveLocation.accuracyMeters}m` : ''})
              </span>
            </span>
          </div>
        )}

        {adminInstruction && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-emerald-950">
            <p className="font-bold flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              অ্যাডমিনের Google Maps লোকেশন ও সম্পূর্ণ নির্দেশনা
            </p>
            <p className="text-xs leading-relaxed whitespace-pre-line">{adminInstruction}</p>
            {adminDispatchedLocation && (
              <p className="text-[11px] font-mono text-emerald-800 pt-1">
                চূড়ান্ত পিন: {adminDispatchedLocation.addressLabel} ({adminDispatchedLocation.lat.toFixed(5)},{' '}
                {adminDispatchedLocation.lng.toFixed(5)})
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
