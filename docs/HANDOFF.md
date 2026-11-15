# Review handoff — November 14, 2026

Current implementation: simulation core, browser interface, experiment worker and tests. Eleven automated tests passed on this restored implementation. Browser rendering and autonomous progression were observed. Full interaction QA, real iPhone performance, offline behavior, publication, and independent review are incomplete. Batch experiments were launched; do not infer results from their launch. This archive excludes generated results and hosting credentials/identity.

Run: npm test. Experiments: npm run experiment. Serve dist with a local static HTTP server for browser review.

No Claude or Grok review has occurred. Eden is a separate paused scenario script in the interface. It must not assign an action, equate a claim with knowledge, or imply that trust/instruction-following is implemented. These mechanisms remain deferred. The current user directs review and completion of the original island before extension.

Review contracts: no architecture replacement, new features, dependencies, hosting changes, or theory-confirming bonuses. Patches must identify the exact files and assumptions changed. Findings must distinguish observed behavior, inferred risks, unrun checks, and deferred features.
