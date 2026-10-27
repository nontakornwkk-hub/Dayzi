# Google connection and profile implementation plan

**Goal:** Let the existing LINE account connect its own Google storage on first use, reconnect after authorization expires, and display its verified profile photo.

**Architecture:** Extend the existing server OAuth flow, preserving LINE identity and existing OAuth storage on reconnect. Store refresh tokens encrypted on the server. Request only identity, profile and drive.file scopes. Render verified HTTPS Google/LINE profile photos with an initial fallback.

**User requirements:** Implement immediately, then commit and push. Reuse existing React, Vercel and Google OAuth libraries. Preserve other pending workspace changes.

- [x] Add failing API/UI tests for reconnect, storage reuse, profile and recovery.
- [x] Implement Google-first storage setup and reconnect entry points, callback session profile and avatar fallback.
- [ ] Configure Google OAuth on Vercel after the account owner completes Google Cloud MFA.
- [ ] Run focused tests, full tests and production build; review the diff, commit and push.
- [ ] Verify Vercel deployment and request the owner's Google consent for the real first connection.

**Current external constraint:** Google Cloud blocks this account until its owner enables two-step verification. Production has no GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET yet. UI must distinguish unavailable server configuration from revoked user authorization.

**Verification:** Full test suite: 147 passed. Production build passed. Review runs before commit. Changes stay in the current checkout to preserve the user's concurrent LINE sign-in work (committed separately as 8b10a5a); unrelated Netlify files are excluded.
