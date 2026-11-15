# How Claude and Grok coordinate

Everything is visible to Robert. Nothing is hidden in game code.

- **Channel:** `CHANNEL.md` on the `main` branch. Newest message at the bottom, each starting `### <date> FROM → TO`. (Claude's GitHub access here cannot open issues or pull requests, so a file is used instead. If Grok can open issues, an issue is fine too; Claude will read it.)
- **Comment format:**
  ```
  FROM: Claude | Grok        TO: Grok | Claude
  STATUS: what changed (commit / PR link)
  CHECK: what the other should verify, as concrete commands or files
  FINDINGS: Observed / Inferred / Unrun, each with evidence
  NEXT: who acts next
  ```
  End with `@Robert DECISION: <question>` only for intended experience, scope or theory choices, or for a disagreement neither side can settle with evidence.
- **Changes:** made on a branch (compare with `main` on GitHub). A branch merges into `main` only after the other reviewer posts `AGREE` in `CHANNEL.md`. `CHANNEL.md` itself is the only file edited directly on `main`.
- **Never:** add deferred features (trust, instruction-following, testimony, reproduction, social learning), change Eden (it stays paused before anyone eats), give assistance or hardship a built-in outcome, merge survivors' averages so deaths disappear, or change hosting or access.
- **Game safety:** the game is only `dist/`. Coordination lives in issues, PRs and `docs/`. Every PR must keep `npm test` green.
- **Rhythm:** Claude checks `CHANNEL.md` (and any issues) every few minutes while its session is open, and says in each comment when it will next look. Grok checks when Robert prompts it or when it is told Claude has posted.
- **Stopping:** when both have posted `AGREE` on the current state and no `@Robert DECISION` is open, the round is done and Robert is pinged once with a summary.

## Merge rule (Robert, 15 November 2026)
There are now three builders: Claude, Edge (Grok), and cloud agents that Edge starts.
1. **Everything arrives as a pull request onto `claude/review-0.1.2`.** No direct pushes of code.
2. **Claude checks each one** against `npm test`, `npm run drift` and `docs/WORLD-LAWS.md`, and reports to Robert.
3. **Edge criticises it.**
4. **Nothing merges without Robert's say.**
5. **Exploratory builds are labelled as such** and are not read as tests of a theory. A build counts as a test only when it runs on the foundation world and reports results across a range of settings, including where they fail.
6. **Direction to check against (D23):** a world faithful to real laws first, theories as layers on top. Harm is a general kind of event with several sources; no single hazard (such as a falling tree) is the centre.
