# LOGEASI.COM — Setup, Security & Deployment Guide

## 1. Architecture Overview
- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **Backend**: Express (`server.ts`) running on port `3000` with Vite middleware in development and static `dist/` serving in production
- **Database & Auth**: Firebase Authentication (Google Sign-In) + Cloud Firestore (`firebase-blueprint.json` & hardened `firestore.rules`) + Server-side session/TOTP/OTP/RBAC verification via `firebase-admin`

## 2. Environment Variables
Configure the following variables in your environment / Secrets panel (see `.env.example`):
- `ROOT_ADMIN_EMAIL`: Verified Google email address to automatically claim the permanent Root Super Admin on initial sign-in.
- `ROOT_ADMIN_SETUP_KEY`: Server-side secret required on `/admin/login` to initialize the permanent Root Super Admin when `ROOT_ADMIN_EMAIL` is not pre-set. (If unset, an ephemeral single-use token is printed once to server stdout until root is claimed.)
- `SESSION_SECRET`: Cryptographic secret for HMAC-SHA256 signed `HttpOnly` session cookies and AES-256-GCM field encryption.
- `PAYMENT_WEBHOOK_SECRET`: HMAC-SHA256 secret used by payment gateways (bKash, Nagad, Rocket, SSLCommerz) to sign server-to-server callbacks to `POST /api/payments/webhook`.
- `PAYMENT_MODE`: Defaults to `"sandbox"`. Switch to `"live"` only after merchant approval and security sign-off in Finance Dashboard.
- `SMS_WEBHOOK_URL` / `EMAIL_WEBHOOK_URL`: Optional external provider endpoints for SMS OTP and email notification delivery.

## 3. Root Super Admin Security & RBAC
- Public registration strictly restricts users to `customer` or `companion` roles and enforces 18+ DOB validation.
- The permanent Root Super Admin (`isRootOwner: true`) is locked in `platform_settings/root_lock`.
- Backend RBAC middleware (`assertRootProtection`) blocks any non-root administrator from deleting, suspending, deactivating, demoting, or changing credentials of the Root Super Admin, logging violations to `audit_logs`.

## 4. Build & Production Deployment
```bash
npm install
npm run lint
npm run build
npm start
```
