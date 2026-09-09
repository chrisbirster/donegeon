# Human-verification browser audit

This directory is the browser half of the manual task-manager audit under
`docs/audits/human-verification/`.

The rule is deliberately one-way:

> **The human checklist defines the product contract. Playwright mirrors the automatable parts of that checklist. A passing unrelated test is never evidence for a checklist row.**

## Structure

```text
audit-contract.json
m1-core-lifecycle.spec.ts
m2-organization.spec.ts
m3-scheduling.spec.ts
m4-quickadd-search.spec.ts
m5-collaboration.spec.ts
m6-browser-acceptance.spec.ts
run-certified.mjs
```

`audit-contract.json` classifies each milestone by the evidence layer that is allowed to prove it.

- **M0** is intentionally human inventory review. Its own document says it is not a browser exercise.
- **M1–M4** are user-visible task-manager workflows and therefore map directly to Playwright cases.
- **M5** is mixed: deterministic UI surfaces use Playwright, tenant/authorization/provider semantics use Go/API integration tests, and live Google OAuth remains external/manual evidence.
- **M6** is the end-to-end desktop/mobile Chromium walkthrough.
- **M7** is a truth-in-support review; Playwright cannot decide whether product claims are honest.
- **M8** is CI/release-structure verification; it is proved by workflow/branch-protection evidence plus the application-entry and certified browser jobs.

The contract unit test auto-discovers milestone documents. If M9 or M10 is added later, CI fails until that milestone is explicitly classified. There is no way to add a new human milestone and silently leave the automation model behind.

## Exact-title contract

Every human-verification table row classified as `playwright` must have an exact Playwright title:

```text
[M2] Create project
[M2] Rename project
[M3] Set due date/time
```

`tests/unit/audit-contract.test.ts` enforces this mechanically. It also rejects hiding required cases behind `test.skip`, `test.fixme`, or `test.fail`.

This means a coverage document cannot claim that "projects are covered" merely because a backend or legacy interaction test exists. The corresponding human flow must have its own browser case.

## Certified versus not-yet-certified milestones

`certifiedBrowserMilestones` in `audit-contract.json` is the only list used by the protected browser job.

A milestone is added to that list **only after**:

1. its dedicated Playwright spec passes against the real Go server + temporary SQLite DB + Vite client + Chromium;
2. the manual human audit for that milestone passes;
3. any human findings have been repaired and regression-tested.

Right now M1 is certified. M2 is intentionally encoded but not certified because the restarted manual audit has already exposed missing project/section/favorite UI. Running M2 should fail until those product gaps are fixed; that failure is useful evidence, not a flaky test to suppress.

## Commands

From `web/apps/client`:

```bash
# Static contract: every milestone/checklist row is classified and every
# browser-observable row has an exact non-skipped Playwright case.
npm run test:audit:contract

# Protected browser set: only milestones already passed manually.
npm run test:audit:certified

# Full truth-telling browser audit. This may be red when a future milestone
# is still under active manual review.
npm run test:audit

# One milestone at a time while doing the manual review.
npm run test:audit:m1
npm run test:audit:m2
npm run test:audit:m3
npm run test:audit:m4
npm run test:audit:m5
npm run test:audit:m6
```

For a human walkthrough, append Playwright's UI/headed flags, for example:

```bash
npm run test:audit:m2 -- --ui
```

## Test-environment rules

1. Browser specs use the real Go server, a fresh temporary SQLite DB, Vite, and Chromium from `playwright.config.ts`.
2. Durable flows assert state again after reload.
3. Browser tests prove what a user can actually perform from the maintained UI; API-only setup must not be substituted for the action being audited.
4. Low-level DST arithmetic, transaction rollback, tenant authorization, recurrence race protection, and provider protocol details stay in deterministic Go/API tests.
5. Real-auth login/waitlist/onboarding remains a distinct protected application-entry job using `PW_REAL_AUTH=true`.
6. A test that encodes the wrong desired behavior is a test defect. Example: `Add Task` must not be considered correct merely because an old test expected it to focus Quick Add.
7. Old `home*.spec.ts` files are supporting/legacy regression coverage only. They do not confer human-audit certification.
