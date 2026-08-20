# CDA Connect

## Cross-platform frontend

The React Native frontend has been redesigned to follow the supplied CDA Connect preview. The project now includes a branded welcome/authentication flow, blue/purple dashboard styling, polished community cards, bottom tab navigation, community overview, chat bubbles, meeting cards, poll result bars, emergency alert screens, member directory, profile and Admin Panel.

Reference preview: `docs/cda-connect-interface-preview.png`.


Native Android and iOS community-management application built with React Native + Expo, Node.js + TypeScript, Socket.IO and Microsoft SQL Server.

## Structure

- `frontend/` React Native / Expo Router client
- `backend/` Express + TypeScript + MSSQL API and Socket.IO server

## Core features included

- Register/login with access and refresh tokens
- User profile and secure mobile token storage
- Create and join multiple communities
- Multiple administrators per community
- Role and permission checks
- Member listing, role assignment and removal
- Community announcements
- Community and group conversations
- Real-time Socket.IO messaging
- Meetings, agendas and RSVP
- Polls and voting
- Emergency alerts and SAFE / NEED_HELP acknowledgements
- Push notification token registration
- Audit logging

## Quick start

### 1. SQL Server
Create an empty database named `CDAConnect`, then run:

```bash
sqlcmd -S YOUR_SQL_SERVER -U YOUR_USER -P YOUR_PASSWORD -d CDAConnect -i backend/sql/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Default API: `http://localhost:4000`

### 3. Mobile

```bash
cd frontend
cp .env.example .env
npm install
npx expo start
```

Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL` to an address the phone/emulator can reach. Do not use `localhost` on a physical phone.

## Production notes

- Put the API behind HTTPS.
- Do not expose SQL Server port 1433 publicly.
- Use a dedicated low-privilege SQL login for the API.
- Replace development secrets before deployment.
- Configure APNs/FCM/Expo credentials for production push notifications.
- Store uploaded media in object storage rather than SQL Server.
- Add automated tests and introduce versioned migrations later when production upgrades are required.

## Community News Feed

CDA Connect now includes a member news feed inside each community. Active members can create posts, like/unlike posts, and comment. Admins and moderators can remove posts through the moderation action. Deleted posts are soft-deleted so the moderation event can remain auditable.


## Accessibility & modern social feed upgrade

This build adds an Accessibility & Language centre and an expanded community news feed.

### Accessibility
- Dynamic text scaling and native font scaling
- VoiceOver/TalkBack labels on shared controls and key feed actions
- High-contrast palette
- System/light/dark appearance preference
- Larger touch targets
- Reduced-motion preference used by modal transitions and available to other animations
- Media captions and descriptive text fields
- Voice-note recording and transcript field
- Text-to-speech Listen action for announcements and alert posts
- Preferred languages: English, French, Spanish, Portuguese, Arabic, Yoruba, Igbo and Hausa
- Automatic content translation hook
- Simple-language rewriting hook for important/admin content

Preferences are persisted securely on-device with Expo SecureStore. Open Profile > Accessibility & Language.

### Social feed
Post types: text, photo, video, document, voice, poll, event, lost & found, recommendation, question, community alert and local news.

Engagement/moderation: Like, Celebrate, Support, comment, threaded reply, @mention labels, hashtags, native share, save, report, pin/unpin, admin announcements and admin/moderator soft-delete.

Media can be uploaded to the API's local `uploads/` folder for development. For production, replace this with object storage such as S3/R2/Azure Blob and malware/content scanning.

Run:

```bash
```

### Automatic translation / simple-language / transcription
These cloud-dependent capabilities use a provider-neutral adapter. Set:

```env
PUBLIC_BASE_URL=https://api.your-domain.example
LANGUAGE_SERVICE_URL=https://your-language-service.example/process
LANGUAGE_SERVICE_API_KEY=your-provider-key
```

The configured service should accept JSON `{ task: "translate" | "simple", text, targetLanguage }` and return `{ text }` for text transforms. For transcription it should accept multipart form data with `task=transcribe` and `file`, returning `{ transcript }` or `{ text }`.

If no provider is configured, normal posting, media, captions, manual transcripts, reactions, comments, saves, reports, sharing and accessibility preferences continue to work; only automatic translation/transcription returns a clear service-not-configured response.

## CDA Connect platform expansion (2026-08)

This build adds community discovery by category/town/postcode, opt-in coarse-area discovery, community verification requests and verified badges, emergency command centre, trusted/emergency contacts, SOS, civic issue reporting with status tracking, local service directory/reviews/provider verification, marketplace/direct seller chat/reporting/moderation, jobs and opportunities/saves, community events with RSVP/capacity/waitlists/chat/photos/reminders/calendar integration, and QR membership cards/check-in.


Near You discovery stores only an opt-in town/postcode preference. It does not publish member GPS coordinates.

## Governance, finance, AI and insights expansion

Optional AI integration is configured server-side with `AI_SERVICE_URL` and `AI_SERVICE_API_KEY`. The included assistant remains permission-aware and does not bypass community access controls.

## Database schema

For the current development stage, **all CDA Connect database tables, indexes, permissions and feature modules are defined directly in one file:**

`backend/sql/schema.sql`

Create an empty `CDAConnect` database, then run:

```bash
sqlcmd -S YOUR_SQL_SERVER -U YOUR_USER -P YOUR_PASSWORD -d CDAConnect -i backend/sql/schema.sql
```

No migration scripts are required for a fresh development database at this stage. Introduce versioned migrations later when preserving production data across schema changes becomes necessary.


## Cross-platform frontend: Web, Android and iOS

CDA Connect now uses one Expo/React Native frontend for four delivery targets:

- Responsive desktop web application
- Responsive mobile web application
- Android application (APK for direct/internal testing and AAB for Google Play)
- iOS/iPhone application (EAS/TestFlight/App Store)

The same Node.js/TypeScript API and the same CDAConnect MSSQL database are shared by all clients. Users sign in once and keep the same communities, roles, messages, governance records, finances, alerts and preferences on every supported platform.

### Run the responsive web app

From `frontend/`:

```bash
npm install
cp .env.example .env
npm run web
```

For a deployable web bundle:

```bash
npm run web:build
```

Expo writes the web export to `frontend/dist/`. Deploy that folder to a static web host or behind your reverse proxy. Configure the backend `CORS_ORIGIN` to include the final HTTPS web origin.

### Responsive behaviour

- Browser width below 980px: phone/tablet layout with bottom navigation.
- Browser width 980px and above: desktop layout with a left navigation rail and wider content workspace.
- Shared `Screen` components constrain readable content while still allowing dashboards to use desktop width.
- Authentication has desktop-specific sizing and the welcome page becomes a two-column layout on large screens.

### Android APK for testing

Install EAS CLI and sign in:

```bash
npm install -g eas-cli
eas login
```

Then from `frontend/`:

```bash
npm run build:android:apk
```

The `preview` profile in `eas.json` produces an installable APK for Android devices/internal distribution.

For Google Play production:

```bash
npm run build:android
```

The production Android profile produces an Android App Bundle (AAB).

### iPhone / iOS

From `frontend/`:

```bash
npm run build:ios
```

For store submission after configuring your Apple Developer/App Store Connect credentials:

```bash
eas submit --platform ios --profile production
```

### Build Android and iOS together

```bash
npm run build:all
```

### Web-safe platform behaviour

- Native SecureStore is used on Android/iOS. The web build uses browser storage through the shared storage adapter.
- Device calendar integration uses the native Expo calendar API on Android/iOS. Web users receive an `.ics` calendar file instead.
- Native scheduled notification reminders remain Android/iOS functionality; web remains connected to server/in-app notification data.
- Camera/QR features use the device camera where supported and remain protected by backend membership validation.

### Production identifiers

Before publishing to Google Play or the Apple App Store, replace the sample values in `frontend/app.json`:

```json
"android": { "package": "com.example.cdaconnect" },
"ios": { "bundleIdentifier": "com.example.cdaconnect" }
```

with identifiers that you own and will keep permanently.

## Scalable backend foundation

The backend now includes Redis, BullMQ workers, S3-compatible object storage, Redis-backed Socket.IO scaling, distributed rate limiting, emergency broadcast batching and a shard-ready community database boundary.

Run the full infrastructure layer with:

```bash
cp backend/.env.example backend/.env
# Update MSSQL, Redis and storage settings first.
docker compose -f docker-compose.infrastructure.yml up -d --build
```

For direct development without Docker, run the API and worker separately:

```bash
cd backend
npm install
npm run dev
```

and in another terminal:

```bash
cd backend
npm run worker
```

The complete MSSQL structure remains in one file: `backend/sql/schema.sql`. See `docs/SCALABLE-BACKEND-ARCHITECTURE.md` for the data-placement and scaling design.
