# Google connection and profile implementation plan

**Goal:** Let the existing LINE account connect its own Google storage on first use, reconnect after authorization expires, and display its verified profile photo.

**Architecture:** Extend the existing server OAuth flow, preserving LINE identity and existing OAuth storage on reconnect. Store refresh tokens encrypted on the server. Request only identity, profile and drive.file scopes. Render verified HTTPS Google/LINE profile photos with an initial fallback.

**User requirements:** Implement immediately, then commit and push. Reuse existing React, Vercel and Google OAuth libraries. Preserve other pending workspace changes.

- [x] Add failing API/UI tests for reconnect, storage reuse, profile and recovery.
- [x] Implement Google-first storage setup and reconnect entry points, callback session profile and avatar fallback.
- [x] Configure Google OAuth on Vercel after the account owner completes Google Cloud MFA.
- [x] Run focused tests, full tests and production build; review the diff, commit and push.
- [x] Verify Vercel deployment and request the owner's Google consent for the real first connection.

**Production setup:** The owner selected the Google account and completed consent. Existing OAuth credentials were added as Production Secrets in Vercel. Google OAuth is currently in Testing with the selected account listed as a test user.

**Verification:** Full test suite: 148 passed. Production build and independent code review passed. Changes stay in the current checkout to preserve the user's concurrent LINE sign-in work (committed separately as 8b10a5a); unrelated Netlify files are excluded.

**Live incident resolved:** Google created the folders and all workbook schema tabs, but the registry URL still served Apps Script version 5 from 02:03, predating the current source. Updated that same deployment to version 6 without changing its URL or access settings. The callback then returned `googleLinked=1`, the app loaded cloud data without an error banner, and Settings showed the user's new OAuth Sheet and Drive folder as ready. Gemini replied successfully in cloud mode. After reloading the app, its test conversation was read back from the user Sheet and the UI confirmed chat history sync. The compact profile photo was measured at 23 by 23 pixels inside its 29 by 29 button after removing inherited button padding (previously 11 by 21).
