import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, Upload } from 'lucide-react';

interface DevicePhotoPickerProps {
  label?: string;
  helperText?: string;
  value: string;
  onChange: (nextPhotoData: string) => void;
  compact?: boolean;
}

async function compressDeviceImage(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file from device.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Selected file is not a valid image.'));
    el.src = rawDataUrl;
  });

  const encode = (maxSide: number, quality: number): string => {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', quality);
  };

  let out = encode(720, 0.82);
  if (out.length > 350_000) {
    out = encode(560, 0.72);
  }
  if (out.length > 420_000) {
    out = encode(420, 0.62);
  }
  return out;
}

export function DevicePhotoPicker({
  label = 'Profile Picture (Direct from Device)',
  helperText = 'Pick any photo from your phone gallery or computer. No URL needed.',
  value,
  onChange,
  compact = false,
}: DevicePhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');

    if (!file.type.startsWith('image/')) {
      setErr('Please choose an image file (JPG, PNG, or WebP).');
      e.target.value = '';
      return;
    }

    setBusy(true);
    try {
      const compressed = await compressDeviceImage(file);
      onChange(compressed);
    } catch (error: any) {
      setErr(error?.message || 'Could not process selected photo.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const sizeKb = value && value.startsWith('data:image/')
    ? Math.round((value.length * 3) / 4 / 1024)
    : null;

  return (
    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-blue-700" />
          {label}
        </label>
        {sizeKb !== null && (
          <span className="text-[11px] font-mono text-emerald-700 font-semibold">
            Ready ({sizeKb} KB)
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div
          className={`${
            compact ? 'w-14 h-14' : 'w-20 h-24'
          } rounded-xl bg-slate-200 border border-slate-300 overflow-hidden shrink-0 flex items-center justify-center`}
        >
          {value ? (
            <img
              src={value}
              alt="Selected preview"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <ImagePlus className="w-6 h-6 text-slate-400" />
          )}
        </div>

        <div className="flex-1 space-y-2">
          <p className="text-[11px] text-slate-600 leading-snug">{helperText}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" />
              {busy ? 'Processing...' : value ? 'Change Photo from Device' : 'Select Photo from Device'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="px-2.5 py-1.5 bg-white border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </div>
          {err && <p className="text-[11px] text-red-700 font-medium">{err}</p>}
        </div>
      </div>
    </div>
  );
}
