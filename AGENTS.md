# No personal information in the repo

Never commit personal information — email addresses, phone numbers, wallet addresses, or similar PII — anywhere: not in tracked files, commit messages, or PR titles/descriptions.

- When creating or updating `.env.example`, omit any value of a variable whose value is personal information (e.g. `NEXT_PUBLIC_SUPPORT_EMAIL`, `WEBHOOK_SECRET`) entirely — do not include it with a placeholder, and never copy real values from `.env`. Just leave the placeholder value empty in the .env.example.
- If personal information is needed for the app to run, it belongs only in local/untracked env files (`.env`, `.env.local`) or the deployment platform's environment variables.
- Before committing, scan the diff for anything matching an email, phone number, or wallet address and remove it first.

# Commit & PR guidelines

- **One feature per PR — no coupling.** Each feature reviews, merges, and reverts independently. A
  change spanning two features is two PRs.
- **Follow-ups live in the code as `TODO` comments.** If a PR description notes a follow-up that is
  required or recommended (but out of scope for this PR), also leave a `TODO:` comment at the relevant
  spot in the code describing it, so it isn't forgotten while the PR stays one feature.
- **Each PR is complete, not half-plumbing** — the code/API/UI *and* a working path.
- **Chain PRs as necessary** - if someone can't review right away, chain off each other instead of waiting otherwise try to make each PR off latest origin main
- **Fill the PR template's Deployment Notes** — environment variable needed? Set yet?
- **Keep PRs reviewable** — small enough to read in one sitting.
- **Plain commit messages — no AI-attribution trailers.** Subject + body only. Never append any AI/assistant attribution to a commit.
- **Graduate to review, don't merge** — open each PR for review (`gh pr ready`) and stack dependents on
  its branch
