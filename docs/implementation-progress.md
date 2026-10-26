# Implementation ledger — plan: docs/superpowers/plans/2026-10-26-per-user-google-storage.md

User authorized implementation, reference design and a deployed access link on 2026-10-26.

- Workspace: new project, no existing Git repository or application. Work in place; worktrees and Git-based helper scripts do not apply.
- Scope extended by user: deliver the full calendar, tasks, files, reminders and assistant UI alongside storage settings.
- Design: original Dayzi identity; warm white, lavender, pale lime, rounded cards and playful illustrated assistant based on the supplied reference.
- Ruling: browser-local guest mode is explicitly labelled and separate from authenticated Google mode. It is not an authentication system or a substitute for per-user cloud isolation.
- Ruling: functional model and server security use node:test instead of Vitest; React UI uses Vite. This reduces tooling while retaining meaningful behavior tests.
- Pre-flight interfaces: storage parsing produces spreadsheetId/folderId; server actor identity comes from verified Google session; calendar/file operations resolve their connection server-side. No owner ID is trusted from browser payloads.
- External configuration: Google OAuth, Apps Script registry coordinator, LINE and VAPID secrets are not present. Implement integration paths and honest setup states; do not fabricate successful connections or notification delivery.
- Ruling: schema version 2 adds readable wall-time/calendar fields and update timestamps. Existing incompatible headers are rejected, never silently migrated or overwritten. Native Google sharing remains outside app isolation.
- Review: independent reviewer identified missing URL parser import, early cloud activation, missing prior-day reminder delivery, lost signed-in local drafts, and stale cloud rows after reconnection. Each issue received a reproducing test before its fix. No reported minor findings remain.
- Fix evidence: UI URL validation now exercises its real parser; cloud loading/error modes reject writes and hide guest records; signed-in local drafts use per-user browser keys; reminder eligibility scans adjacent occurrence dates, including prior-day quiet-hour catch-up; the coordinator reads actual prior row extents under its lock before writing.
- Verification: production Vite build succeeds. Unit and simulated-DOM tests cover model/security, coordinator row cleanup, media stream bounds and five UI flows. Real Google/LINE/Web Push end-to-end verification is pending external credentials.
- Verification limit: in-app browser could not reach loopback; native Computer Use was stopped by its browser-URL policy. No alternative browser-control technique was used. Happy DOM validates interactions but is not a screenshot/layout check.
- Deployment: Netlify login authorized by user; site dayzi-personal-2026 (055bed81-903f-4f88-aac3-68a8b5269126) created in their team. Initial visitor configuration requires Netlify team login. Preserve it unless user explicitly chooses public access.
- User explicitly chose Public access after reviewing the deployed private URL. Native Netlify connector confirmed both team-login and password protection disabled for this site only. Google resources were not shared or changed.
- Final verification: 28 tests passed; Netlify production deploy 6adf6b4fae2eace8d208a8a7 is ready with three functions and published static assets. Public HTTP checks verified HTML, JS/CSS, manifest, API setup status and cross-origin write rejection. URL: https://dayzi-personal-2026.netlify.app
- Remaining external setup: no Google OAuth project credentials, registry deployment, LINE secrets or Web Push VAPID pair were provided. Runtime correctly reports Google not configured; UI defaults to local-device storage. End-to-end cloud/notification delivery is not claimed complete.

## Local-only follow-up — 2026-10-26

- User changed workflow: work and test locally first; do not redeploy without a new request. Local server runs at http://localhost:5173/.
- Gemini replaces OpenAI; local Vite middleware supports server-side Gemini without requiring a cloud Google identity. OpenAI dependency removed. General conversation/history now supported instead of limiting chat to work.
- User changed onboarding: LINE identity is primary. Verified follow events provision per-LINE-user Sheets and Drive owned by the system account through Apps Script; web access uses verified LINE Login with state/nonce/PKCE. No per-user Google login required in normal UI. Original URL configuration remains advanced/legacy only.
- Runtime safety: no owner Google token is returned to LINE clients; native LINE IDs cannot be rebound through legacy linking; draft links retain their draft across verified LINE authentication before cloud saving.
- Local webhook ingress bypasses browser Origin only for the signature-verified webhook path. A tunnel hostname must be explicitly configured; no tunnel or new public deployment was created.
- Readability: increased Thai font sizes, darker primary/secondary text, larger form controls; verified local overview and chat screenshots in the real in-app browser.
- During work, credentials were found in the editable example file. Values were moved into ignored .env.local without printing them, and secret fields in .env.example cleared. No redeployment or external publication of those credentials was performed.
- External gap: registry/Apps Script endpoint is not configured yet, so actual Sheets save/LINE provisioning remains unverified. Gemini key is present; initial real call returned provider deadline exceeded, being diagnosed separately from mocked tests.

## Resumed local work — 2026-10-26
- Ruling: use the existing non-Git workspace and retain local-only workflow; no deploy or cloud data writes. Cloud storage cannot be claimed verified without the Apps Script registry.
- Compact calendar and chat verified in actual514x704 browser viewport: document height704, calendar bottom675. Dark theme readable; quick schedule answer uses local data and scrollTop167 + clientHeight350 = scrollHeight517.
- Gemini Interactions streaming real smoke test: HTTP200, first text21605ms, done21684ms. Ordinary conversation works; provider latency remains a limitation, no Gemini-app speed claim.
- Removed4MiB app file cap. Authenticated Drive resumable requests carry3MiB chunks and AES-GCM owner/version/expiry-bound tickets; original Google tokens/upload URLs never returned. LINE media streams incrementally, with a60sec idle read timeout excluding Drive waits. Provider/runtime/storage constraints still apply.
- Added regression coverage for30MiB session creation, cross-user/version/expired ticket denial, chunk acknowledgement/final registration,7MiB unknown-length LINE media, and5MiB UI file upload.
- Final fresh reviewer found two important issues: false upload success/lost earlier batch items, and15sec LINE body timeout. Both reproduced with failing tests, then fixed: successful batch entries persist even after a later file fails; success toast requires persist=true; LINE uses idle reads instead of a deadline across downstream waits.
- Final verification: npm test59/59 passed; npm run build passed. .qa/dayzi-resumed-chat.jpg records dark chat with local answer visible. No deploy performed.
- Credential hygiene: parsed .env.example and confirmed no active Gemini credential. Its raw nonempty line contains an empty/commented assignment; no credential was migrated or overwritten this turn.
- Remaining: configure admin Apps Script registry to verify real per-user Sheets/Drive and LINE media end-to-end; provider latency remains around21sec in measured greeting. Existing source ZIP predates these changes and should not be treated as current.

## Calendar polish and authorized deployment — 2026-10-27
- User explicitly requested deployment after calendar/date-picker improvements, superseding the local-only restriction.
- Added Thai/Buddhist-year date picker for task reference date, due dates, multi-day end date, appointment date and task editing. It uses a theme-aware portal (inside native dialog when applicable), measured viewport positioning, minimum dates, month/year selection, arrow keys and Escape handling. Native browser popup is no longer the visible date selector.
- Desktop1440x900 and mobile513x704 inspected: calendar document fits900px; selected day agenda includes6 appointments/tasks; picker bounds on mobile top12 bottom430 (no overflow). Saved screenshots under .qa.
- Preserved existing user edits to chat history, notes and cloud/account behavior. Removed a stray JSX closing brace in settings.
- Final fresh review: cancelled appointments were included in complete agenda but excluded in date cells. Regression failed then passed after excluding cancelled entries in agendaItems. Full suite68/68 passed.
- Rich Menu recommendation saved in docs/line-rich-menu-plan.md:6 slots, Today/Calendar/To-do/Files/Reminders/Chat. No LINE Rich Menu published.
- Production deploy6adfa5a6c79bbf8d2f5650c3 published at https://dayzi-personal-2026.netlify.app. Exact JS/CSS artifact hashes matched local build; public HTML/assets and /api/status returned200; cross-origin mutation rejected403. Real production UI date popup verified and saved .qa/dayzi-published-picker.jpg. Runtime still reports Google/LINE Login not configured; no claim of cloud integration readiness.

## Two-button Rich Menu — 2026-10-27
- User confirmed exactly2 buttons: Enter Dayzi app, My calendar. Added allowlisted ?page=calendar entry route, tested both menu URLs and invalid page fallback.
- Prepared assets/line/richmenu-two.jpg2500x843 and updated scripts/line-richmenu.mjs to two URI buttons, explicit --apply publication guard, no old-menu deletion. Image visually inspected.
- Full tests69/69 passed, build passed. Dedicated LINE /richmenu/validate request returned200.
- Auto approval rejected running the combined validation/publication script even without --apply because it contains default-menu mutations and requested explicit publication authorization. No LINE menu was created/uploaded/changed. Safer validation-only code was allowed and succeeded. Await direct user approval before --apply.

## Local finance and local command routing —2026-10-27
- User requested ordinary app actions without AI; AI reserved for thinking/prioritization. Added shared commands.mjs before web/LINE Gemini routing: tasks, done state, appointments with explicit start time, notes, ledger and summaries. Follow-up save it uses preceding human text; assistant-generated financial amounts are ignored; already-saved confirmation doesn't duplicate entries.
- Added FinancePage, integer-satang model, categories, monthly totals/budget, income/expense/own-transfer, edit/delete, CSV and explicit aggregate-only AI analysis. Local image OCR with self-hosted Tesseract7 and tha/eng models; no receipt image upload to AI. Live browser synthetic receipt parsed1250.50 and27/10/2026 into review form, type intentionally blank until user chooses. No actual financial records added by the agent.
- Preserved all ongoing user changes to chat history/notes and account integration. Additive transactions Sheets serialization/validation filters owner and invalid amount. Legacy read omits absent optional table; updated Apps Script creates it under lock during save. External coordinator not deployed/configured in this task.
- LINE now replies with Flex task done buttons and validates postback task ownership through signed-user account data. No messages were sent via tools, no live webhook claiming full end-to-end readiness. LINE receipt photos remain file uploads, not automatic OCR; web OCR works.
- Fresh reviewer found3 important bugs; reproduced failing tests then fixed all: excess precision12.345 could become345; explicit save was swallowed by summary regex; duplicate LINE webhook redelivery made duplicate ledger entries. Added strict amount boundaries, command precedence and stable owner/event-derived IDs with existing-row check.
- Verification:86 tests passed and production build passed. Live current endpoint127.0.0.1/localhost5173 returned200. Old in-app tab stuck in connection-error document; a fresh in-app tab successfully opened /?page=finance and screenshot .qa/dayzi-finance-ready.jpg. Rich Menu publication remains unchanged and the supplied six-button image remains the requested design.
- Ruling: OCR defaults to local client processing instead of an external paid image API, following user instruction to avoid unnecessary AI. Cost is initial model/runtime bandwidth and device time; image quality still requires human review. No financial advice or receipt-authenticity guarantee.
- Cost references/assumptions recorded in docs/dayzi-costs.md; no subscriptions/purchases made. No deployment this session.
