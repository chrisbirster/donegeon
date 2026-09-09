# Task manager human verification harness

This directory turns the M0–M8 semantic audit into a repeatable human review.

Automated tests answer whether the implementation satisfies executable contracts. These checklists answer the second question: **does the observed behavior match what a human reviewer expects Donegeon to do?**

## Verdicts

Use one verdict per checklist item:

- `PASS` — observed behavior matches the intended product contract.
- `NEEDS_WORK` — technically works, but semantics or UX should change.
- `FAIL` — behavior is incorrect or broken.
- `RETIRED` — intentionally unavailable; verify that it stays unavailable.
- `UNIMPLEMENTED` — intentionally not part of the current product contract.
- `NOT_REVIEWED` — not reviewed in the current session.

Do not convert `NEEDS_WORK` into `PASS` merely because an automated test is green. The point of this harness is to preserve the human product judgment alongside executable evidence.

## Review sequence

1. `M0-feature-inventory.md`
2. `M1-core-lifecycle.md`
3. `M2-organization.md`
4. `M3-scheduling.md`
5. `M4-quickadd-search.md`
6. `M5-collaboration.md`
7. `M6-browser-acceptance.md`
8. `M7-support-boundary.md`
9. `M8-release-gate.md`

The repository currently defines M0–M8. If M9, M10, or another milestone is added later, the automation contract intentionally fails until the new milestone is explicitly classified.

## Session record

At the top of each milestone file record:

- commit SHA under review;
- date;
- reviewer;
- automated commands/run IDs used;
- final milestone verdict;
- follow-up issue/PR links for anything that is not `PASS`.

## Automation strategy

The human checklist is the source of truth for browser acceptance. Browser-observable rows are mirrored by exact-title Playwright cases under:

```text
web/apps/client/tests/e2e/audit/
  audit-contract.json
  m1-core-lifecycle.spec.ts
  m2-organization.spec.ts
  m3-scheduling.spec.ts
  m4-quickadd-search.spec.ts
  m5-collaboration.spec.ts
  m6-browser-acceptance.spec.ts
```

`web/apps/client/tests/unit/audit-contract.test.ts` enforces that every human milestone is classified and every row classified as Playwright has an exact, non-skipped browser test.

This does **not** mean every checklist row belongs in Playwright:

- M0 is primarily a human inventory/truthfulness review.
- Low-level persistence, tenant authorization, recurrence arithmetic, rollback, and provider protocol details belong in Go/API integration tests.
- Live external-provider behavior may require manual evidence.
- M7 is a support-boundary/truth review.
- M8 is CI/release-structure verification.

Forcing those into browser tests would create false confidence rather than better coverage.

## Certified browser milestones

Protected CI runs only the milestone specs listed in `certifiedBrowserMilestones` inside `audit-contract.json`.

A milestone is added to that list only after:

1. its dedicated automated spec passes;
2. its matching manual audit passes;
3. every human finding has been repaired and regression-tested.

Therefore a green protected browser job means **the explicitly certified milestones are still green**. It does not imply that later milestones currently under manual review are complete.

Use these commands from `web/apps/client`:

```bash
npm run test:audit:contract
npm run test:audit:certified
npm run test:audit:m1
npm run test:audit:m2
npm run test:audit:m3
npm run test:audit:m4
npm run test:audit:m5
npm run test:audit:m6
```

The full not-yet-certified browser truth set can be run with:

```bash
npm run test:audit
```

It is allowed to be red while a future milestone is actively exposing product gaps. Required cases must not be hidden with `test.skip`, `test.fixme`, or expected-failure markers merely to make CI green.

## Source of truth

These human checklists complement, but do not replace:

- `docs/task-manager-audit-plan.md`
- `docs/audits/task-manager-feature-matrix.md`
- `docs/audits/task-manager-closeout.md`
- `docs/audits/task-manager-release-gate.md`

When they disagree, treat the discrepancy as an audit finding and resolve it explicitly.
