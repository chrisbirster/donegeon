# Task-manager audit acceptance specs

This directory is reserved for the milestone-oriented browser verification suite.

Target structure:

```text
m1-core-lifecycle.spec.ts
m2-organization.spec.ts
m3-scheduling.spec.ts
m4-quickadd-search.spec.ts
m6-acceptance.spec.ts
```

The existing `../task-manager-audit.spec.ts` remains authoritative until the human M0–M8 review identifies useful boundaries for splitting it.

## Rules for the split

1. Do not copy tests just to create milestone files.
2. Move or rewrite a scenario only when it proves a distinct user-visible contract.
3. Preserve the real Go server + temporary SQLite + Vite + Chromium environment.
4. Keep persistence-after-reload assertions for durable behavior.
5. Prefer Go/API tests for low-level edge cases such as DST arithmetic, transaction rollback, tenant authorization, and recurrence race protection.
6. Browser specs should answer human-visible questions: can the user perform the flow, understand the result, and still see the correct durable state after reload?
7. After the split, the protected Browser acceptance CI job must execute the entire authoritative audit set.

The human verification documents under `docs/audits/human-verification/` determine which browser scenarios are worth keeping or adding.