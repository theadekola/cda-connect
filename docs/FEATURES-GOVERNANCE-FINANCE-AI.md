# CDA Connect: Governance, Finance, Knowledge, AI and Insights

Database schema: `backend/sql/schema.sql`

## Governance
Structured proposals support discussion, amendments, status transitions, decisions, assigned actions and progress. Final decisions are written to a searchable Decision Register.

## Formal voting
Formal ballots are separate from informal polls. Voter eligibility is snapshotted when a ballot is created. A ballot receipt table enforces one member/one vote. Anonymous ballots separate the member receipt from the stored choice. Quorum and final result calculations are explicit and auditable.

For high-stakes statutory elections, commission an independent security/privacy review before relying on this implementation.

## Community finances
Includes dues plans and member ledgers, donations/income/expenses/event payments, receipts, fundraisers, budgets and admin summary endpoints. Payment-provider credentials are intentionally not bundled. Paystack, Stripe or another regulated payment provider can be connected server-side.

## Document knowledge centre
Documents have categories, visibility, a current version, immutable version history, file/body content, change notes and role-oriented access structures.

## CDA Assistant
The assistant assembles context only after the user's community membership is checked. An optional `AI_SERVICE_URL` provider adapter can turn that context into a natural-language answer. The model provider never receives database credentials and should only receive the permission-filtered context.

## AI moderation
Potentially abusive/spam/fraudulent content can be queued for human review. AI/provider detection never auto-deletes content. An authorised moderator explicitly approves or removes it.

## Smart summaries
A deterministic seven-day summary endpoint combines recent community posts, meetings, issue states and formal ballots. It can later be enhanced by the same permission-aware AI provider.

## Personalised home
One CDA Connect identity can belong to many communities with different roles. `/me/home` returns the user's communities, roles, important alerts, upcoming activities and assigned governance actions.

## Notification, offline and privacy controls
Notification preferences include emergency alerts, DMs, mentions, community posts, polls, events, marketplace, promotions and quiet hours. Emergency alerts stay enabled. App preferences include Data Saver, offline cache and auto-download choices. Privacy controls cover phone/email visibility, messaging/group permissions, presence/profile visibility and discovery, plus data-export and account-deletion requests.

## Analytics and health score
Admin analytics report actionable metrics. The v1 health score is transparent: engagement 25%, meeting activity 15%, issue resolution 25%, participation 20%, admin-response proxy 15%. The endpoint returns the formula explanation with the score.
