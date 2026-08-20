# CDA Connect Cross-Platform Deployment

## One frontend, four experiences

CDA Connect uses Expo Router and React Native to share routes and UI logic across Android, iOS and web. Desktop web uses a navigation rail. Mobile web, Android and iPhone use bottom navigation.

## Development commands

```bash
cd frontend
npm install
npm run web       # browser
npm run android   # Android development
npm run ios       # iOS development
```

## Web production

```bash
npm run web:build
```

Deploy `frontend/dist/` to your HTTPS web host. Point `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL` at your public CDA Connect API. Add the web origin to backend `CORS_ORIGIN`.

Example:

```env
EXPO_PUBLIC_API_URL=https://api.example.com/api/v1
EXPO_PUBLIC_SOCKET_URL=https://api.example.com
```

Backend:

```env
CORS_ORIGIN=https://app.example.com
```

## Android

Testing APK:

```bash
npm run build:android:apk
```

Google Play AAB:

```bash
npm run build:android
```

## iOS

Production build:

```bash
npm run build:ios
```

Submit after Apple credentials are configured:

```bash
eas submit --platform ios --profile production
```

## Shared backend

All platforms use the same Node.js API, Socket.IO server and CDAConnect MSSQL database. No web-specific database is required.
