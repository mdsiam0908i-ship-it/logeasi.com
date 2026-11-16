export interface BangladeshGeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export const BANGLADESH_CITY_COORDS: Record<string, BangladeshGeoPoint> = {
  dhaka: { lat: 23.8103, lng: 90.4125, label: 'ঢাকা কেন্দ্র (Dhaka)' },
  gulshan: { lat: 23.7925, lng: 90.4078, label: 'গুলশান-২, ঢাকা' },
  banani: { lat: 23.7937, lng: 90.4066, label: 'বনানী, ঢাকা' },
  dhanmondi: { lat: 23.7461, lng: 90.3742, label: 'ধানমন্ডি, ঢাকা' },
  uttara: { lat: 23.8759, lng: 90.3795, label: 'উত্তরা, ঢাকা' },
  mirpur: { lat: 23.8223, lng: 90.3654, label: 'মিরপুর, ঢাকা' },
  motijheel: { lat: 23.733, lng: 90.4172, label: 'মতিঝিল, ঢাকা' },
  bashundhara: { lat: 23.8191, lng: 90.4526, label: 'বসুন্ধরা আবাসিক, ঢাকা' },
  savar: { lat: 23.8583, lng: 90.2667, label: 'সাভার, ঢাকা' },
  mohammadpur: { lat: 23.7662, lng: 90.3589, label: 'মোহাম্মদপুর, ঢাকা' },
  gazipur: { lat: 23.9999, lng: 90.4203, label: 'গাজীপুর' },
  narayanganj: { lat: 23.6238, lng: 90.5, label: 'নারায়ণগঞ্জ' },
  chattogram: { lat: 22.3569, lng: 91.7832, label: 'চট্টগ্রাম (Chattogram)' },
  chittagong: { lat: 22.3569, lng: 91.7832, label: 'চট্টগ্রাম' },
  "cox's bazar": { lat: 21.4272, lng: 92.0058, label: 'কক্সবাজার' },
  cumilla: { lat: 23.4607, lng: 91.1809, label: 'কুমিল্লা' },
  sylhet: { lat: 24.8949, lng: 91.8687, label: 'সিলেট (Sylhet)' },
  rajshahi: { lat: 24.3745, lng: 88.6042, label: 'রাজশাহী (Rajshahi)' },
  bogura: { lat: 24.8465, lng: 89.3773, label: 'বগুড়া' },
  khulna: { lat: 22.8456, lng: 89.5403, label: 'খুলনা (Khulna)' },
  jashore: { lat: 23.1634, lng: 89.2182, label: 'যশোর' },
  barishal: { lat: 22.701, lng: 90.3535, label: 'বরিশাল (Barishal)' },
  barisal: { lat: 22.701, lng: 90.3535, label: 'বরিশাল' },
  rangpur: { lat: 25.7439, lng: 89.2752, label: 'রংপুর (Rangpur)' },
  mymensingh: { lat: 24.7471, lng: 90.4203, label: 'ময়মনসিংহ (Mymensingh)' },
};

export function resolveBangladeshCityCoords(
  city?: string | null,
  division?: string | null,
  venueName?: string | null
): BangladeshGeoPoint {
  const candidates = [venueName, city, division]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean);

  for (const cand of candidates) {
    if (BANGLADESH_CITY_COORDS[cand]) {
      return BANGLADESH_CITY_COORDS[cand];
    }
    for (const key of Object.keys(BANGLADESH_CITY_COORDS)) {
      if (cand.includes(key)) {
        return BANGLADESH_CITY_COORDS[key];
      }
    }
  }
  return BANGLADESH_CITY_COORDS.dhaka;
}

export function computeHaversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}
