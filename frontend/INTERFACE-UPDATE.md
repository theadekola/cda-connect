# Interface update — 9 September 2026

Changes are saved in the repository root.

- Registration and recovery have a searchable country-code dialog with bundled coloured SVG flags. Nigeria is the default and can be changed. International numbers can be pasted; national numbers are parsed using the selected country. Only possible international numbers are submitted. This is format validation, not proof of number ownership; the existing SMS verification API remains responsible for ownership.
- Authentication uses the existing welcome-community.png photograph and the original blue/green palette. Desktop forms have a bounded width. Mobile uses a compact image header, readable inputs and safe-area spacing. Country selection becomes a bottom sheet.
- Welcome feature links lead to account creation. Mobile page actions and sign-out are reachable. Share uses the native Share plugin when available and handles errors.
- The finance member view now shows dues and receipts, with payment-evidence submission wired to the existing API. It does not charge a bank account. Evidence is a link; file upload, finance administration and reconciliation dashboards are not implemented by this change.
- Native HTTP API requests fall back to https://cdaconnect.org/api/v1 when the configured URL is relative or missing. Chat uses the API origin rather than the device webview origin.

## Validation

Production build and TypeScript checks passed. Existing five frontend tests passed. Headless Edge checks passed at widths 320, 390, 768 and 1440: registration, country search/selection, modal dismissal, phone normalization, OTP transition and no horizontal overflow. Further mocked API checks verified payment-evidence payload, decimal amount entry, mobile create action, sign-out and invalid number rejection. Production dependency audit reported zero vulnerabilities.

API responses in browser checks were mocked; no real SMS, payment evidence or account was submitted. The VM has not been updated. Native project generation failed in the local environment with uv_os_get_passwd ENOMEM, so no Android APK or iOS IPA was produced or device-tested. Existing frontend/README.md lists broader feature-parity gaps. This update does not establish full release readiness for every section.

## Deploy website

In Windows PowerShell:

    Set-Location '<path-to-your-cda-connect-clone>'
    .\Transfer-App.ps1 -SshTarget '<deployment-user>@<private-application-host>' -Upload

Use the exact extracted directory reported by the uploader on the application VM, then run:

    bash deploy/start-ubuntu.sh

Keep the existing production credentials. Do not rerun database initialization for these interface changes. The country selector has new dependencies, so upload package.json and package-lock.json as well as src.

## Android and iOS

From the frontend directory, on a machine with the platform toolchain:

    npm ci
    npm run build
    npx cap add android
    npx cap add ios
    npm run cap:sync

Run cap add only for platforms that do not already exist. Android needs Android Studio/SDK; iOS compilation and signing need macOS/Xcode. Use npm run android or npm run ios to open those projects.

For native builds, set these public build-time values before npm run build:

    VITE_API_URL=https://cdaconnect.org/api/v1
    VITE_SOCKET_URL=https://cdaconnect.org

On the application VM, the existing /etc/cda-connect/backend.env must allow the website and the actual Capacitor origins:

    CORS_ORIGIN=https://cdaconnect.org,https://localhost,capacitor://localhost

Restart cda-api after changing its environment. Keep authentication and authorization enabled. Verify real SMS delivery, sign-in, profile updates, chat reconnect, uploads, and authorized/unauthorized actions on staging and physical iOS/Android devices before release. App signing, store submission, push notifications, and secure persistent native sessions remain separate work.
