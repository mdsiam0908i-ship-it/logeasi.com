import React, { useState } from 'react';
import type { PaymentGateway } from '../types/logeasi.ts';

export type PaymentLogoKey = PaymentGateway | 'bank_eft' | string;

export const BENSON_CIGARETTE_LOGO_URL =
  '/assets/aistudio/IMG_b8633162-cc0f-4073-b49e-64da828c9ae9_49c40c06.jpg';

interface PaymentGatewayLogoProps {
  gateway: PaymentLogoKey;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PaymentGatewayLogoProps['size']>, string> = {
  xs: 'w-6 h-6 rounded-md',
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-11 h-11 rounded-xl',
  lg: 'w-14 h-14 rounded-xl',
};

export function PaymentGatewayLogo({
  gateway,
  size = 'md',
  className = '',
}: PaymentGatewayLogoProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const key = (gateway || '').toLowerCase();
  const box = SIZE_CLASSES[size];

  if (key === 'benson') {
    if (!imgFailed) {
      return (
        <span
          className={`inline-flex items-center justify-center shrink-0 overflow-hidden bg-white border border-amber-300 shadow-xs ${box} ${className}`}
          title="বেনসন সিগারেট পেমেন্ট"
        >
          <img
            src={BENSON_CIGARETTE_LOGO_URL}
            alt="Benson & Hedges সিগারেট লোগো"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-contain p-0.5"
          />
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 bg-amber-50 border border-amber-300 text-amber-900 font-bold ${box} ${className}`}
        title="বেনসন সিগারেট পেমেন্ট"
      >
        <svg viewBox="0 0 40 40" className="w-4/5 h-4/5" aria-hidden="true">
          <rect x="9" y="10" width="22" height="24" rx="2" fill="#D4B475" stroke="#8A6623" strokeWidth="1.5" />
          <rect x="13" y="4" width="3.5" height="9" rx="1" fill="#C48636" />
          <rect x="18" y="5" width="3.5" height="8" rx="1" fill="#C48636" />
          <rect x="23" y="6" width="3.5" height="7" rx="1" fill="#C48636" />
          <rect x="12" y="23" width="16" height="4" rx="1" fill="#B91C1C" />
        </svg>
      </span>
    );
  }

  if (key === 'bkash') {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 bg-[#E2136E] text-white shadow-xs ${box} ${className}`}
        title="bKash (বিকাশ)"
      >
        <svg viewBox="0 0 40 40" className="w-4/5 h-4/5" aria-hidden="true">
          {/* Geometric bKash origami bird emblem */}
          <polygon points="18,6 28,16 18,22" fill="#FFFFFF" />
          <polygon points="18,22 28,16 32,26 21,28" fill="#FCE7F3" />
          <polygon points="9,12 18,16 18,24 12,21" fill="#FBCFE8" />
          <polygon points="18,24 23,28 16,35" fill="#FFFFFF" />
          <polygon points="28,16 35,14 31,20" fill="#FFFFFF" />
        </svg>
      </span>
    );
  }

  if (key === 'nagad') {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 bg-gradient-to-br from-[#F7941D] to-[#ED1C24] text-white shadow-xs ${box} ${className}`}
        title="Nagad (নগদ)"
      >
        <svg viewBox="0 0 40 40" className="w-4/5 h-4/5" aria-hidden="true">
          {/* Nagad flame & crescent coin mark */}
          <circle cx="20" cy="20" r="14" fill="none" stroke="#FFFFFF" strokeWidth="2.2" opacity="0.35" />
          <path
            d="M21 7c4 4 6 8.5 5 13-1 4.5-4.5 7.8-9 9.2 1.8-3 1.8-6.2 0-9.2-2 2.2-3 4.8-2.5 7.8-3.8-2.2-6-6.2-5.3-10.7.7-4.7 4.4-8.4 11.8-10.1z"
            fill="#FFFFFF"
          />
          <circle cx="22.5" cy="18.5" r="2.2" fill="#ED1C24" />
        </svg>
      </span>
    );
  }

  if (key === 'rocket') {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 bg-[#8C3494] text-white shadow-xs ${box} ${className}`}
        title="Rocket (রকেট)"
      >
        <svg viewBox="0 0 40 40" className="w-4/5 h-4/5" aria-hidden="true">
          <path
            d="M26 7c-5.5 1-10.2 4.5-13 9.5l-4.5 1.8 3.2 3.2 6.8 6.8 3.2 3.2 1.8-4.5c5-2.8 8.5-7.5 9.5-13L26 7z"
            fill="#FFFFFF"
          />
          <circle cx="23.5" cy="16.5" r="2.6" fill="#8C3494" />
          <path d="M10 27l-3 6 6-3-3-3z" fill="#FDE047" />
        </svg>
      </span>
    );
  }

  if (key === 'sslcommerz') {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 bg-[#0F3D7A] text-white shadow-xs ${box} ${className}`}
        title="SSLCommerz (কার্ড ও ব্যাংক)"
      >
        <svg viewBox="0 0 40 40" className="w-4/5 h-4/5" aria-hidden="true">
          <path
            d="M20 5l12 4.8v9.4c0 7.4-5.1 13.7-12 15.8-6.9-2.1-12-8.4-12-15.8V9.8L20 5z"
            fill="#1D4ED8"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
          <rect x="13.5" y="18.5" width="13" height="8.5" rx="1.5" fill="#FFFFFF" />
          <path d="M16 18.5v-2.6a4 4 0 0 1 8 0v2.6" fill="none" stroke="#FFFFFF" strokeWidth="2.2" />
          <circle cx="20" cy="22.8" r="1.4" fill="#0F3D7A" />
        </svg>
      </span>
    );
  }

  if (key === 'cash') {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 bg-emerald-700 text-white shadow-xs ${box} ${className}`}
        title="ক্যাশ পেমেন্ট (BDT)"
      >
        <svg viewBox="0 0 40 40" className="w-4/5 h-4/5" aria-hidden="true">
          <rect x="5" y="11" width="30" height="18" rx="2.5" fill="none" stroke="#FFFFFF" strokeWidth="2.2" />
          <circle cx="20" cy="20" r="4.5" fill="#FFFFFF" />
          <text
            x="20"
            y="22.2"
            textAnchor="middle"
            fontSize="7"
            fontWeight="bold"
            fill="#047857"
            fontFamily="sans-serif"
          >
            ৳
          </text>
          <circle cx="9.5" cy="15.5" r="1.2" fill="#A7F3D0" />
          <circle cx="30.5" cy="24.5" r="1.2" fill="#A7F3D0" />
        </svg>
      </span>
    );
  }

  if (key === 'bank_eft') {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 bg-slate-800 text-white shadow-xs ${box} ${className}`}
        title="ব্যাংক EFT"
      >
        <svg viewBox="0 0 40 40" className="w-4/5 h-4/5" aria-hidden="true">
          <polygon points="20,6 34,14 6,14" fill="#FFFFFF" />
          <rect x="9" y="16" width="3.2" height="12" fill="#E2E8F0" />
          <rect x="18.4" y="16" width="3.2" height="12" fill="#E2E8F0" />
          <rect x="27.8" y="16" width="3.2" height="12" fill="#E2E8F0" />
          <rect x="6" y="30" width="28" height="3.2" rx="1" fill="#FFFFFF" />
        </svg>
      </span>
    );
  }

  // 'custom' (অ্যাডমিন কাস্টম / পার্সোনাল) or fallback
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 bg-blue-700 text-white shadow-xs ${box} ${className}`}
      title="অ্যাডমিন কাস্টম / পার্সোনাল পেমেন্ট"
    >
      <svg viewBox="0 0 40 40" className="w-4/5 h-4/5" aria-hidden="true">
        <rect x="6" y="10" width="28" height="20" rx="3" fill="none" stroke="#FFFFFF" strokeWidth="2.2" />
        <rect x="6" y="15" width="28" height="4" fill="#93C5FD" />
        <circle cx="28" cy="24" r="2.2" fill="#FFFFFF" />
        <rect x="10" y="23" width="9" height="2.4" rx="1" fill="#FFFFFF" />
      </svg>
    </span>
  );
}
