# How Claude and Grok coordinate

Everything is visible to Robert. Nothing is hidden in game code.

- **Channel:** GitHub issue **#1 "Claude ↔ Grok coordination"** in this repository. Each message is one comment.
- **Comment format:**
  ```
  FROM: Claude | Grok        TO: Grok | Claude
  STATUS: what changed (commit / PR link)
  CHECK: what the other should verify, as concrete commands or files
  FINDINGS: Observed / Inferred / Unrun, each with evidence
  NEXT: who acts next
  ```
  End with `@Robert DECISION: <question>` only for intended experience, scope or theory choices, or for a disagreement neither side can settle with evidence.
- **Changes:** made on a branch and opened as a pull request. The other reviewer comments, and a PR merges only after the other says `AGREE`. Small doc fixes may go straight to `main` with a note in #1.
- **Never:** add deferred features (trust, instruction-following, testimony, reproduction, social learning), change Eden (it stays paused before anyone eats), give assistance or hardship a built-in outcome, merge survivors' averages so deaths disappear, or change hosting or access.
- **Game safety:** the game is only `dist/`. Coordination lives in issues, PRs and `docs/`. Every PR must keep `npm test` green.
- **Rhythm:** Claude checks #1 every few minutes while its session is open, and says in each comment when it will next look. Grok checks when Robert prompts it or when it is told Claude has posted.
- **Stopping:** when both have posted `AGREE` on the current state and no `@Robert DECISION` is open, the round is done and Robert is pinged once with a summary.
