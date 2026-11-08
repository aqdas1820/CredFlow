<div align="center">

# CredFlow

### Credit-card and transaction tracking dashboard from CredoNomics Investment Solutions

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=111827)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)

</div>

## Overview

**CredFlow** is a CredoNomics financial-tracking project built with Next.js and Supabase. The current application provides a single dashboard for personal credit-card records and a FuelRotator ledger used to track card limits, payment dates, swipe records, fees and settlement status.

This repository currently represents an early public project/prototype rather than a finished production product.

## Current capabilities

### Personal cards

- Store card name and total limit
- Track statement and due dates
- View card records from the dashboard

### FuelRotator ledger

- Maintain friend-card records with bank, limit and due-date information
- Record fuel swipe transactions
- Calculate gross amount, fee percentage and net amount
- Track pending versus settled transactions
- Monitor aggregate pending obligations, net cash and total fees/commissions

## Technology

- **Next.js 16**
- **React 19**
- **TypeScript 5**
- **Supabase**
- **Tailwind CSS 4**
- **Lucide React**

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Other commands

```bash
npm run build
npm run lint
npm run start
```

## Supabase configuration

The application expects the following public client-side environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Do not commit service-role keys, private credentials or production secrets.

When these variables are missing or malformed, CredFlow now shows a setup-required screen
instead of attempting to initialize Supabase and crashing. Use a valid `http://` or
`https://` Supabase URL and the browser-safe anon key. The presence of a URL and
key does **not** verify connectivity, authentication, or row-level security.

**Manual smoke check:** Start the app without the variables and confirm the
setup-required screen appears; then configure a development Supabase project
and confirm the normal dashboard loads. Never use production data for smoke tests.

The current UI reads/writes the following Supabase tables:

```text
personal_cards
fuel_cards
fuel_swipes
```

Database schema, access policies and production deployment settings should be reviewed before using this project beyond development/testing.

## Project status

CredFlow is currently a **public development project**. The repository does not claim production-readiness, financial-advice functionality or banking integration.

## Company & contact

**CredoNomics Investment Solutions**

- Website: [credonomics.in](https://credonomics.in)
- Company Instagram: [@credonomics.in](https://instagram.com/credonomics.in)
- Founder / business: [founder@credonomics.in](mailto:founder@credonomics.in)
- Product support: [support@credonomics.in](mailto:support@credonomics.in)
- Phone: `02562455327`

---

<div align="center">

Built by **CredoNomics Investment Solutions**.

</div>
