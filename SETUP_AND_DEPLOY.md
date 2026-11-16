# LOGEASI.COM — Setup, Security & Deployment Guide

## 1. Architecture Overview
- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **Backend**: Express (`server.ts`) running on port `3000` with Vite middleware in development and static `dist/` serving in production
- **Database & Auth**: Firebase Authentication (Google Sign-In) + Cloud Firestore (`firebase-blueprint.json` & hardened `firestore.rules`) + Server-side session/TOTP/OTP/RBAC verification via `firebase-admin`

## 2. Environment Variables
Configure the following variables in your environment / Secrets panel (see `.env.example`):
- `PRIMARY_ADMIN_USERNAME` / `PRIMARY_ADMIN_PASSWORD`: Optional Root Super Admin bootstrap credentials injected via deployment Secrets (never hardcoded in source control). If unset on a fresh database, a random password is generated once at runtime and printed to server stdout; once set in the database, change it anytime via Admin Portal -> Security & Audit.
- `ROOT_ADMIN_EMAIL`: Verified Google email address to automatically claim the permanent Root Super Admin on initial sign-in.
- `ROOT_ADMIN_SETUP_KEY`: Server-side secret required on `/admin/login` to initialize the permanent Root Super Admin when `ROOT_ADMIN_EMAIL` is not pre-set. (If unset, an ephemeral single-use token is printed once to server stdout until root is claimed.)
- `SESSION_SECRET`: Cryptographic secret for HMAC-SHA256 signed `HttpOnly` session cookies. Defaults to a random 256-bit secret persisted in gitignored `.data/runtime-secrets.json` (rotatable anytime from Security Dashboard).
- `DATA_ENCRYPTION_KEY`: Optional AES-256-GCM field encryption key for sensitive server-side secrets (2FA TOTP seeds).
- `PAYMENT_WEBHOOK_SECRET`: HMAC-SHA256 secret used by payment gateways (bKash, Nagad, Rocket, SSLCommerz) to sign server-to-server callbacks to `POST /api/payments/webhook`.
- `PAYMENT_MODE`: Defaults to `"sandbox"`. Switch to `"live"` only after merchant approval and security sign-off in Finance Dashboard.
- `SMS_WEBHOOK_URL` / `EMAIL_WEBHOOK_URL`: Optional external provider endpoints for SMS OTP and email notification delivery.

## 3. Root Super Admin Security, API Key Hygiene & RBAC
- Public registration strictly restricts users to `customer` or `companion` roles and enforces 18+ DOB validation.
- The permanent Root Super Admin (`isRootOwner: true`) is locked in `platform_settings/root_lock`.
- Backend RBAC middleware (`assertRootProtection`) blocks any non-root administrator from deleting, suspending, deactivating, demoting, or changing credentials of the Root Super Admin, logging violations to `audit_logs`.
- **Firebase Web Config (`firebase-applet-config.json`)**: Client Firebase SDK identifiers are inherently public in browser builds, which causes public GitHub repos to trigger Secret Scanning alerts on the `AIzaSy...` Web API key. Keep your GitHub repository **Private** and configure **HTTP referrer restrictions** on the Browser API Key in Google Cloud Console (`APIs & Services -> Credentials`). Keep `GEMINI_API_KEY` and `SESSION_SECRET` strictly server-side in Secrets Manager — never in client code or Git commits.

## 4. Build & Production Deployment
```bash
npm install
npm run lint
npm run build
npm start
```
