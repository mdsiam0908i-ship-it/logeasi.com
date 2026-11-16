import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';

interface PersistedRuntimeSecrets {
  sessionSecret: string;
  webhookSecret: string;
  dataEncryptionKey: string;
  sessionEpoch: number;
  rotatedAt: string;
}

function resolveSecretsPath(): string {
  const candidates = [
    path.resolve(process.cwd(), '.data'),
    path.join(os.tmpdir(), 'logeasi-data'),
  ];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const testFile = path.join(dir, '.write-probe');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      return path.join(dir, 'runtime-secrets.json');
    } catch {
      // Try next writable directory
    }
  }
  return '';
}

let cachedSecrets: PersistedRuntimeSecrets | null = null;
const SECRETS_FILE_PATH = resolveSecretsPath();

function writeSecretsFile(secrets: PersistedRuntimeSecrets): void {
  if (!SECRETS_FILE_PATH) return;
  try {
    fs.writeFileSync(SECRETS_FILE_PATH, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  } catch (err) {
    console.warn('[LOGEASI SECURITY] Unable to persist runtime-secrets.json:', err);
  }
}

function getPersistedSecrets(): PersistedRuntimeSecrets {
  if (cachedSecrets) return cachedSecrets;

  if (SECRETS_FILE_PATH && fs.existsSync(SECRETS_FILE_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(SECRETS_FILE_PATH, 'utf8')) as Partial<PersistedRuntimeSecrets>;
      if (parsed.sessionSecret && parsed.webhookSecret && parsed.dataEncryptionKey) {
        cachedSecrets = {
          sessionSecret: parsed.sessionSecret,
          webhookSecret: parsed.webhookSecret,
          dataEncryptionKey: parsed.dataEncryptionKey,
          sessionEpoch: Number.isFinite(Number(parsed.sessionEpoch)) ? Number(parsed.sessionEpoch) : 1,
          rotatedAt: parsed.rotatedAt || new Date().toISOString(),
        };
        return cachedSecrets;
      }
    } catch {
      // Regenerate below if corrupted
    }
  }

  cachedSecrets = {
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    webhookSecret: crypto.randomBytes(32).toString('hex'),
    dataEncryptionKey: crypto.randomBytes(32).toString('hex'),
    sessionEpoch: 1,
    rotatedAt: new Date().toISOString(),
  };
  writeSecretsFile(cachedSecrets);
  return cachedSecrets;
}

export function getSessionSecret(): string {
  const persisted = getPersistedSecrets();
  const base = process.env.SESSION_SECRET || persisted.sessionSecret;
  return `${base}:epoch_${persisted.sessionEpoch}`;
}

export function getSessionEpoch(): number {
  return getPersistedSecrets().sessionEpoch;
}

export function getWebhookSecret(): string {
  return process.env.PAYMENT_WEBHOOK_SECRET || getPersistedSecrets().webhookSecret;
}

function getEncryptionKey(): Buffer {
  const source = process.env.DATA_ENCRYPTION_KEY || getPersistedSecrets().dataEncryptionKey;
  return crypto.createHash('sha256').update(source).digest();
}

export function rotateRuntimeSecrets(): { rotatedAt: string; sessionEpoch: number } {
  const current = getPersistedSecrets();
  const nextEpoch = (current.sessionEpoch || 1) + 1;
  const next: PersistedRuntimeSecrets = {
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    webhookSecret: crypto.randomBytes(32).toString('hex'),
    dataEncryptionKey: current.dataEncryptionKey,
    sessionEpoch: nextEpoch,
    rotatedAt: new Date().toISOString(),
  };
  cachedSecrets = next;
  writeSecretsFile(next);
  return { rotatedAt: next.rotatedAt, sessionEpoch: nextEpoch };
}

// One-time runtime setup token when ROOT_ADMIN_SETUP_KEY is not configured in env
export const RUNTIME_ROOT_SETUP_TOKEN =
  process.env.ROOT_ADMIN_SETUP_KEY || crypto.randomBytes(18).toString('hex');

if (!process.env.ROOT_ADMIN_SETUP_KEY && !process.env.ROOT_ADMIN_EMAIL) {
  console.info(
    `[LOGEASI SECURITY] Initial Root Super Admin setup token (valid until root is claimed): ${RUNTIME_ROOT_SETUP_TOKEN}`
  );
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(`${otp}:${getSessionSecret()}`).digest('hex');
}

export function generateRandomAdminUsername(prefix = 'adm'): string {
  const cleanPrefix = prefix.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'adm';
  const suffix = crypto.randomBytes(4).toString('hex');
  return `${cleanPrefix}_${suffix}`;
}

export function generateStrongRandomPassword(length = 16): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*_-+=';
  const all = upper + lower + digits + symbols;
  const targetLen = Math.max(12, Math.min(32, length));

  const chars = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    symbols[crypto.randomInt(0, symbols.length)],
  ];

  while (chars.length < targetLen) {
    chars.push(all[crypto.randomInt(0, all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export function encryptSensitive(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSensitive(cipherText: string): string {
  const [ivHex, tagHex, dataHex] = cipherText.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted payload');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export interface SignedSessionPayload {
  uid: string;
  email: string;
  role: string;
  epoch?: number;
  iat: number;
  exp: number;
}

export function signSessionToken(payload: Omit<SignedSessionPayload, 'iat' | 'exp' | 'epoch'>, ttlSeconds = 60 * 60 * 12): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SignedSessionPayload = {
    ...payload,
    epoch: getSessionEpoch(),
    iat: now,
    exp: now + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SignedSessionPayload | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedSessionPayload;
    if (!decoded.uid || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    if (decoded.epoch !== getSessionEpoch()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function signWebhookPayload(payload: object): string {
  const canonical = JSON.stringify(payload);
  return crypto.createHmac('sha256', getWebhookSecret()).update(canonical).digest('hex');
}

export function verifyWebhookSignature(payload: object, signatureHex: string): boolean {
  try {
    const expected = signWebhookPayload(payload);
    const a = Buffer.from(signatureHex, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// RFC 6238 TOTP (Base32 secret + 6-digit 30s window)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(length = 20): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += BASE32_ALPHABET[bytes[i] % 32];
  }
  return out;
}

function decodeBase32(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function hotp(secretBase32: string, counter: number): string {
  const key = decodeBase32(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

export function verifyTotpCode(secretBase32: string, token: string): boolean {
  const clean = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  for (let window = -1; window <= 1; window++) {
    if (hotp(secretBase32, currentStep + window) === clean) {
      return true;
    }
  }
  return false;
}

export function calculateAgeFromDob(dobIso: string): number {
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function maskDocumentNumber(docNum: string): string {
  const clean = docNum.trim();
  if (!clean) return '****';
  if (clean.length <= 2) return `*${clean.slice(-1)}`;
  if (clean.length <= 4) return `${'*'.repeat(clean.length - 2)}${clean.slice(-2)}`;
  return `${'*'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

// In-memory sliding-window rate limiter per IP + route bucket
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = rateBuckets.get(key);
  if (!existing || existing.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= maxRequests) {
    return false;
  }
  existing.count += 1;
  return true;
}

export function sanitizeId(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 128);
}

export function sanitizeString(val: unknown, maxLen = 500): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export function sanitizePhotoData(val: unknown): string | null {
  if (val === '') return '';
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (!trimmed) return '';

  // Allow compressed base64 data URLs uploaded directly from device (up to ~450KB chars, well under Firestore 1MB doc cap)
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed.length <= 450_000 ? trimmed : null;
  }

  // Allow standard http/https URLs or local asset paths
  if (
    (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/')) &&
    trimmed.length <= 1000
  ) {
    return trimmed;
  }

  return null;
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      result[k] = decodeURIComponent(v);
    }
  }
  return result;
}
