# CDA Connect — React 19 rebuild (development milestone)

This is newly written React DOM + TypeScript code, not the original Expo application or its React Native compatibility layer. It is a working buildable foundation, **not a completed feature-parity rebuild or release-ready application**. The backend and MSSQL database are not bundled or modified.

## Run

Use Node 22.12+ (validated here on Node 24). Run `npm ci`, copy `.env.example` to `.env`, configure the real API and Socket.IO origins, then run `npm run dev`. Never put MSSQL, Redis, storage secrets, or administrator credentials in VITE variables: these are public build-time values.

Run `npm test` and `npm run build`. Serve `dist` over HTTPS with SPA history fallback to index.html. Set environment variables before building. The API requires HTTPS in production.

## Native projects

Run `npm run build`, `npx cap add android`, `npx cap add ios`, and `npm run cap:sync`. Open with `npm run android` or `npm run ios`. These generate native projects; this archive does not include a signed APK, IPA or verified native build. iOS compilation needs macOS/Xcode. Configure API CORS for the actual Capacitor origins and website; never use wildcard authenticated CORS. Android/iOS push, deep links, camera and secure persistent sessions still require implementation.

## Implemented source

| Area | Included interactions |
| --- | --- |
| Welcome/authentication | Welcome, login, 2FA login, phone verification registration, password recovery |
| Account | Profile edit, password change, authenticator/SMS 2FA setup, session revoke, support tickets, data export request |
| Communities | Discover, join request, join by code, create, responsive community navigation |
| Feed | Text publishing, comments, likes, saved toggle |
| Meetings/polls | List, permission-gated creation, RSVP, poll voting |
| Events/marketplace/services/issues | Lists and basic creation forms; event registration and marketplace save |
| Announcements/emergency | List/create, safe/help response |
| Documents | List and server-authorized temporary download links |
| Chat | Existing conversations, Socket.IO text sending with stable retry ID |
| Other | Notifications/read actions, proposal creation/list, decisions list, executive list, attendance code check-in, basic finance readout, membership-card details/token rotation |
| Platform | Vite production output, public offline fallback, install manifest/icons, Capacitor configuration |

## Not yet migrated — release blockers

- Full Super Admin system, protected initial-account database setup, impersonation policy, platform audit log, moderation and operational dashboards. Main backend does not provide a verified complete contract for this system; no fake admin role or browser-created administrator is included.
- Feature-specific detail/edit/delete flows, rich media/feed attachments, uploads and document metadata/visibility/version management.
- Membership QR display/scan/share; camera and native permissions.
- Finance payment submission, proof uploads, reconciliation, dues/levy administration, receipts and full reporting.
- Member role administration, invitations/join-request review, community settings and moderation actions.
- Advanced governance: discussion/amendments, formal ballots and finalization.
- Conversation creation, attachments, read receipts, unread counters, calls and notification deep links.
- Full preferences/privacy, account deactivation/deletion, 2FA disable/recovery UI.
- Persistent secure native login, push subscriptions, native deep links, full PWA update UX and native hardware-back handling.
- Pagination/infinite loading and dedicated layouts across all resource types. Some resource collections use generic cards.
- Comprehensive accessibility, browser, native and staging integration testing. Automated checks in this archive are structural smoke checks, not proof of backend security or production correctness.

## Architecture and safety

`src/api.ts` is the API/session adapter. `auth.tsx` handles onboarding. `shell.tsx` owns responsive navigation. `pages.tsx`, `domain.tsx`, `security.tsx`, `card.tsx`, and `chat.tsx` contain page interactions; `ui.tsx` contains shared forms and error states.

Authentication uses sessionStorage: refreshing preserves the session, and closing the browser tab normally clears it. Tokens remain accessible to JavaScript, so preventing cross-site scripting is essential. Refresh calls are single-flight; mutations are not automatically retried. Backend authorization remains mandatory regardless of hidden UI buttons. API responses are not cached by the service worker. The PWA is online-first with an offline explanation, not an offline replica of private data. Font loading is optional and falls back to system fonts.

Redis, BullMQ and MSSQL stay behind Express. The frontend does not enqueue jobs or connect directly to them. Socket.IO connects to the configured backend. Object storage downloads are mediated through the existing API. This preserves infrastructure boundaries but does not verify that the existing workers, permissions or notification fan-out are correct.

Contracts were inspected from `theadekola/cda-connect` main at `e15e8f4cf320ac80b559b1d63c6aa4da9c88e70f`; no live authenticated backend test was performed.

## Staging acceptance checklist

1. Test expired/revoked tokens, concurrent refresh, logout, two accounts in one browser, invalid 2FA and SMS rate limits.
2. With member/admin/nonmember/suspended accounts, test every read and mutation, including cross-community IDs and hidden/private documents. Verify backend denial, not only UI hiding.
3. Validate response shapes and pagination for every resource against seeded staging data. Exercise empty, loading, 403, 404, 429 and server-error states.
4. Test reconnect and duplicate chat delivery, lost acknowledgements and retry; confirm server idempotency. Test expired socket auth and community removal mid-session.
5. Verify notification audience, membership changes during queue delay, deduplication keys, worker retries and Redis outages on the backend. Ensure one intended delivery per channel and no cross-community leakage.
6. Validate document signed-link expiry, revoked visibility, deleted files, storage failures and unsafe content types.
7. Test refresh on deep routes, install/uninstall PWA, offline navigation, cache isolation after logout and upgrades.
8. Test 320px mobile, tablet portrait/landscape, desktop, keyboard navigation, focus and screen readers; then real Android and iOS devices.
9. Complete the migration gaps above before replacing the production frontend. Keep the old frontend deployed until parity and rollback are verified.
