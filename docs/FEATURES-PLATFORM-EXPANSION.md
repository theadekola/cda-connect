# CDA Connect Platform Expansion

This build adds these production-oriented modules on top of the existing CDA Connect mobile + API + MSSQL foundation:

- Community discovery by name, town, postcode and category, with opt-in coarse-location "Near You" preferences.
- Community verification requests, platform-review boundary and public verified badge.
- Emergency Command Centre with notified/safe/need-help/no-response counts, incident updates, resolution, emergency contacts, trusted contacts and community SOS.
- Community issue reporting with category, photo URL support, approximate location, assignment/status lifecycle and resolution history.
- Community service directory with profiles, ratings/reviews and admin verification.
- Community marketplace with sale/free/wanted/services/rentals/jobs types, direct seller messaging, reporting and admin removal.
- Jobs and opportunities with jobs, volunteering, training, scholarships, internships and community opportunities, plus saved items.
- Community events with RSVP, capacity, waitlist, event chat, photos, device-calendar integration, local reminders and QR check-in.
- Digital membership cards with secure server-issued QR tokens and admin scanning.

## Existing database

Apply:

```bash
sqlcmd -S YOUR_SQL_SERVER -U YOUR_USER -P YOUR_PASSWORD -d CDAConnect -i backend/sql/schema.sql
```

## Verification reviewer

Set a comma-separated list of trusted CDA Connect platform reviewer emails:

```env
PLATFORM_ADMIN_EMAILS=reviewer1@example.com,reviewer2@example.com
```

Community owners/admins can submit evidence. Only configured platform reviewers can approve the verification request and activate the public verified badge.

## Privacy

Nearby discovery stores only user-opted-in town/postcode information. The discovery API does not publish precise member coordinates. Issue and SOS screens ask for approximate areas rather than precise private locations.

## Mobile native modules

The QR scanner uses Expo Camera. Device calendar integration uses Expo Calendar. Event reminders use Expo Notifications. These native integrations should be tested using a development build for the final Android/iOS release workflow.
