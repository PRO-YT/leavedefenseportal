# leavedefenseportal

Operational leave portal prototype built with:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Lucide React
- Radix UI primitives

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Current architecture

- `/` is the protected-entry landing and sign-in experience.
- `/dossier` is the public service-record dossier portal with support request submission.
- The admin console is only exposed through the private path set in `ADMIN_PORTAL_PATH` and still remains Firebase Auth gated.
- `/portal` contains the operational workspace.
- Server actions handle authentication and leave packet validation.
- `proxy.ts` performs optimistic route protection for portal pages and rewrites the private admin route.
- `lib/session.ts` signs and validates the session cookie.

## Important note

The running app is the project in this root folder: `C:\Users\HomePC\Desktop\Military`.
The nested `military-app` folder is leftover scaffold debris and is not the live app.

## Firebase setup

Firebase client integration is now wired through environment variables.

- Config file: `lib/firebase/config.ts`
- Client SDK exports: `lib/firebase/client.ts`
- Local env file: `.env.local` (ignored by git)
- Example template: `.env.example`

Current app-level exports available for backend/logic work:

- `firebaseApp`
- `firebaseAuth`
- `firebaseDb`
- `firebaseStorage`
- `initFirebaseAnalytics()`

Before production launch, tighten Firebase security rules in:

- Authentication providers/settings
- Firestore rules
- Storage rules
- App Check

Before running the member seed, create a Cloud Firestore database for project `military-e0207` if you have not already:

- https://console.cloud.google.com/datastore/setup?project=military-e0207

## Firestore collections in use

- `members`
  - Stores personnel dossiers: gallery state, service record, mission geography, medical ledger, payroll/benefits.
- `requests`
  - Stores support pipeline items with metadata (`member_uid`, `request_timestamp`, `status`, `urgency_level`).

## Seed member profile

Seed command:

```bash
npm run seed:member
```

Seed target:

- Collection: `members`
- Document ID comes from `document_id` inside the JSON file
- Searchable Member ID comes from `service_number` inside the JSON file

Seed data source:

- `scripts/seed-member-profile.mjs`
- `scripts/seed-data/member-profile.json`

To change the seeded member later, edit only:

- `scripts/seed-data/member-profile.json`

Then rerun:

```bash
npm run seed:member
```

If seeding fails with Firestore API disabled, enable:

- https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=military-e0207

## Admin access

Default admin access is configured through `.env.local` so it can be changed later without editing app code:

- `ADMIN_ACCESS_EMAIL`
- `ADMIN_ACCESS_PASSWORD`
- `ADMIN_ACCESS_DISPLAY_NAME`
- `ADMIN_PORTAL_PATH`

Bootstrap or verify the Firebase Auth admin account with:

```bash
npm run seed:admin
```

If the bootstrap reports that Firebase Authentication is not initialized, open Firebase Console, click `Authentication`, choose `Get started`, and enable the `Email/Password` provider before rerunning the script.

If you change the admin email, password, or hidden admin route later, update `.env.local` and redeploy if needed. Only the path set in `ADMIN_PORTAL_PATH` will open the admin console; the old `/admin` URL is no longer the public entry point.
