# Communications native setup

The Communications screen is shared by web, home-screen web apps and the Capacitor iOS/Android apps. The previous Account Settings and Privacy & Safety updates are prerequisites.

## Native app rebuild

From `frontend`, install the dependencies with `npm ci`, then run `npm run cap:sync` and rebuild the existing Android/iOS project. The sync command also runs `scripts/configure-communications-native.mjs`.

That script adds the contacts permission description to an existing iOS Info.plist and the plugin's required contacts permissions to an existing Android manifest. It preserves existing values and is safe to rerun. If a platform has not been generated, add it with the existing native build workflow and run the sync command again. The contacts plugin groups Android READ_CONTACTS and WRITE_CONTACTS permission together; CDA Connect only calls its permission and read APIs, never create/delete contact APIs.

Native contact access uses [Capacitor Community Contacts 8](https://github.com/capacitor-community/contacts). It requires operating-system permission. Only phone-number fields are requested. iOS limited permission is accepted. Denial leaves sync off. There is no background address-book upload: syncing runs when the member chooses it on the contact-sync page.

## Browser and home-screen apps

Supported browsers use their contact picker. Others, including browsers without address-book access, use a .vcf contacts-file picker. Choose the country for numbers without an international prefix. Files are parsed on the device; only normalised phone numbers are submitted for matching. The API retains eligible matched member IDs, not raw address-book numbers or names. Only verified numbers shared with community members are discoverable, and blocking/hidden-user rules remain enforced. Turning sync off deletes saved matches. Limits: 5 MB per file, 5,000 valid numbers per sync and ten sync requests per hour.

## Communication behaviour

- Email updates use the existing configured email provider and require a verified email. The email preference is shared with Account Settings.
- Routine SMS uses the configured SMS provider (Termii when selected) and requires a verified phone. It is opt-in, limited to one routine update per hour, and does not automatically retry an uncertain SMS response. Provider configuration and delivery are still required.
- Direct-message reception and sender audiences are enforced in existing/new direct conversations. Group/community conversations stay available. Voice-call controls are independent of the direct-message toggle; blocking applies to both.
- Read receipts record the last visible message only while the app is visible and receipt sharing is enabled. Senders see a read indication when an eligible recipient shares a receipt. Read status refreshes in the foreground every ten seconds.
- Typing starts are suppressed when the sender disables indicators; existing indicators expire after a few seconds.
- Message previews are off by default. Browser/native notification delivery checks the recipient's preference. Already delivered lock-screen notifications cannot be recalled by changing a setting.
- Do Not Disturb pauses routine push, community email/SMS and call invitations until the selected time. In-app content remains available. Account/security verification and emergency broadcasts remain available. Existing connected calls are not forcibly ended.
- Messages are stored on the server; this update does not add end-to-end encryption.

Native projects, operating-system contact permission prompts, real provider delivery and physical devices have not been tested in this workspace. Native permission setup was checked using disposable XML project fixtures.
