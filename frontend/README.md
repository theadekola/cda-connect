# CDA Connect mobile and web interface

React 19, TypeScript and Vite provide the web/PWA interface; Capacitor packages the same interface for Android and iOS. Express and SQL Server remain the application backend. Normal application requests use `/api/v1` on the website; FastAPI is used only behind the authenticated AI feature.

## Current functionality

The implementation includes authentication and two-factor challenges, account recovery, profile/privacy/security settings, communities and membership administration, paginated feeds and media, messaging and calls, meetings and attendance, polls and governance, marketplace/services, documents, finance and administration. Native integrations cover contacts, storage, sharing, permissions, app links and push registration. Availability also depends on backend permissions, provider configuration and device support.

These are implemented features, not proof that every provider or device configuration has passed production acceptance. The repository release workflow checks browser scenarios, backend SQL/Redis integration, native debug builds and repository security. Debug compilation does not produce a signed store release.

## Development and production builds

Use Node 22.13 or newer. From the repository root:

```bash
npm ci --prefix frontend
npm test --prefix frontend
VITE_API_URL=/api/v1 npm run build --prefix frontend
```

For native packages use the HTTPS website API origin when compiling. Never place signing passwords, AI keys, SQL credentials or private member information in VITE variables. Frontend variables are public.

```bash
cd frontend
VITE_API_URL=https://cdaconnect.org/api/v1 npm run cap:sync:android
# Run on macOS for iOS:
VITE_API_URL=https://cdaconnect.org/api/v1 npm run cap:sync:ios
```

Android release builds require the existing CDA_ANDROID_KEYSTORE, CDA_ANDROID_KEY_ALIAS, CDA_ANDROID_STORE_PASSWORD and CDA_ANDROID_KEY_PASSWORD variables. Configure iOS signing and provisioning in Xcode using the operator's Apple account. Use increasing build numbers appropriate to the versions already uploaded to the stores. Keep certificates and provider configuration outside Git.

## Reliable deployment identification

Each build emits `dist/release.json` and an HTML source fingerprint. About shows that same reference. The fingerprint covers frontend source, public assets, dependencies and build configuration. It normalizes text checkout line endings and does not change merely because the same source was rebuilt later. It identifies source, not a signing certificate, server configuration, device acceptance or store approval.

After deployment, from the deployed checkout:

```bash
node deploy/verify-public.mjs https://cdaconnect.org --native
```

This checks the live HTML/metadata against the local source release. Older deployments without release metadata must be updated before the new identity check passes. Different compile-time origins may still produce different JavaScript filenames from the same source; filenames alone are not release identifiers.

## Interface language completion

Changing app language immediately changes bundled navigation and controls. Missing specialist wording currently falls back to English. Measure coverage before claiming a fully translated interface:

```bash
npm --prefix frontend run language:check
# Check one language:
npm --prefix frontend run language:check -- fr
```

The command exits unsuccessfully if required static strings are missing. Generate missing strings using a trusted provider configured through CDA_INTERFACE_TRANSLATION_URL and, if needed, CDA_INTERFACE_TRANSLATION_KEY in the deployment shell. The endpoint must implement the contract documented in scripts/prepare-interface-packs.mjs. Only developer-authored static interface strings are sent. Existing core and specialist translations are reused; interrupted generation resumes from atomic checkpoints.

```bash
npm --prefix frontend run language:prepare -- fr
npm --prefix frontend run language:check -- fr
```

Repeat for the advertised languages and obtain fluent review before committing the packs. Content translation for member posts and messages is a separate authenticated server/provider feature. Do not interpret dictionary coverage as a linguistic quality assessment.

## Required production acceptance

Supply real app-signing identifiers on the application VM. You can configure either platform independently; other backend settings and the other platform's identifiers are preserved:

```bash
sudo python3 deploy/setup-app-links.py --platform android
sudo python3 deploy/setup-app-links.py --platform ios
sudo systemctl restart cda-api
node deploy/verify-public.mjs https://cdaconnect.org --native
```

Use the Apple App ID prefix for org.cdaconnect.app and Google Play's SHA-256 app-signing certificate fingerprint, rather than guessing identifiers or substituting a debug certificate. Configure real Firebase/APNs delivery separately.

Before a general rollout, test a signed app on an Android phone and iPhone, plus the installed PWA on both platforms:

1. Register a test account, verify email, sign in, exercise two-factor authentication and recover a password using real provider delivery.
2. Open shared links cold and while signed in; test an expired session and a revoked account. Verify the sign-in return destination.
3. Background/resume the app, exercise biometric cancellation and successful unlock, wait through the idle timeout, and verify another account cannot see cached content.
4. Open chat, focus the keyboard, rotate the phone and send media; interrupt the network and check reconnect, retry and duplicate delivery.
5. Place voice/video calls across Wi-Fi and mobile data. Exercise denied permissions, Bluetooth/headset audio, background/incoming calls and TURN relay fallback.
6. Receive push while foregrounded, backgrounded and terminated; open its destination and verify logout removes this device's registration.
7. Exercise authorised and denied membership/admin actions, upload/download private documents, and validate finance proof/reconciliation with synthetic staging records.
8. Export and delete a disposable account; confirm server records and uploaded-file/backup handling against the operator's actual retention policy.
9. Exercise 320px screens, landscape, larger text, screen-reader/focus navigation, language changes, offline/reconnect and PWA upgrades.

Privacy and terms remain drafts until the operator confirms identity/address, processing purposes, provider/transfer arrangements, retention/backup/upload disposal and child-user rules. Do not remove the draft label or claim store readiness without supplying and reviewing those facts. No test in this repository substitutes for real provider delivery, signed-device acceptance, policy approval or store review.


## October audit correction deployment

The source update adds response-body deadlines, accessible chat menus, retained offline fallback, per-account rate buckets, paged member/service screens, bounded multi-part data exports, native temporary-export cleanup and upload scanning before object storage. Non-paged member/service API responses remain compatible for existing internal selectors; the main screens explicitly request pages.

Production now rejects `DB_TRUST_CERT=true`. Provision a SQL Server certificate whose hostname matches `DB_SERVER` and whose issuing CA is trusted by the Node process, then set `DB_TRUST_CERT=false`. Do not change this flag without first provisioning the certificate. Existing runtime secrets are preserved by the installer.

On the Ubuntu VM, run `sudo bash deploy/setup-upload-scanner.sh` to install a local ClamAV daemon and signature updater, with its Unix socket restricted to the scanner group. Set `CLAMAV_SOCKET=/run/clamav/clamd.ctl` in the existing private backend environment file. The API service user needs socket access. Keep signatures current. New production uploads fail closed when scanning is missing, unavailable, exceeds scanner limits or detects malware; they do not enter object storage first. Previously stored files have not been retrospectively scanned by this update. The installer checks the scanner before switching releases.

Deploy from the updated checkout with `bash deploy/start-ubuntu.sh`. Then run `node deploy/verify-public.mjs https://cdaconnect.org --native` to verify the deployed source ID, same-origin API, logo assets and native associations. Backend dependency versions and the pnpm lockfile are updated for security fixes. No database migrations are required by these audit corrections. If a preflight fails, configure the reported dependency and rerun; do not bypass verification to make the command pass.

Exports contain numbered JSON files with at most 100 records per section per file. Download every part until the last-file confirmation. Records can change while an export is in progress; these files are a personal data export, not a transactional database backup. Native share files are deleted after sharing and on startup/account changes, while copies explicitly saved by the user remain theirs.

Full translations still require the configured translation service and fluent review. Operator disclosures, actual app-signing identifiers, push credentials and physical Android/iOS acceptance must be completed using real production information. Merging source does not complete those external tasks or deploy the VM.

## Automatic post and message translation

The Node API supports Google Cloud Translation Basic v2 directly. Create a Google Cloud project, enable billing and Cloud Translation API, then create an API key restricted to Cloud Translation API. For a fixed server egress IP, also restrict the key to that public IP; browser referrer restrictions do not apply to server requests. Configure usage quotas and billing alerts before enabling member translation. Google charges depend on usage; billing alerts do not enforce a spending cap. Review Google's current pricing and data-processing terms.

Keep the key only in `/etc/cda-connect/backend.env`:

```ini
GOOGLE_TRANSLATE_API_KEY=your-private-key
```

Do not put the key in Git, frontend variables, URLs or support screenshots. Leave `LANGUAGE_SERVICE_URL` unset unless using a separate custom provider. Google is used for text translation when its key is present; a custom provider remains necessary for transcription and simple-language rewriting. FastAPI and ordinary application API routing are unchanged. Existing member permissions, per-user rate limits and translation opt-in continue to apply. When enabled, eligible post/message text is sent to the provider; original content is retained. This does not fill missing interface language packs.

After pulling and deploying the update, run a small public-sample request from the checkout (the request can count against Google's quota):

```bash
sudo node backend/scripts/check-translation.mjs /etc/cda-connect/backend.env
sudo systemctl restart cda-api
```

Only restart after the check prints PASS. Reload Language settings, choose a translation language and enable Translate Posts / Translate Messages. Configuration readiness enables the controls; provider billing, key restrictions or quota failures can still make a translation fail. Errors preserve the original text. No live provider call is part of CI.
