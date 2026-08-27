# Task manager human verification harness

This directory turns the M0–M8 semantic audit into a repeatable human review.

Automated tests answer whether the implementation satisfies its executable contracts. These checklists answer the second question: **does the observed behavior match what a human reviewer expects Donegeon to do?**

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

## Session record

At the top of each milestone file record:

- commit SHA under review;
- date;
- reviewer;
- automated commands/run IDs used;
- final milestone verdict;
- follow-up issue/PR links for anything that is not `PASS`.

## Automation strategy

The intended long-term browser layout is:

```text
web/apps/client/tests/e2e/audit/
  m1-core-lifecycle.spec.ts
  m2-organization.spec.ts
  m3-scheduling.spec.ts
  m4-quickadd-search.spec.ts
  m6-acceptance.spec.ts
```

Do not move tests merely for organization. Split the existing authoritative acceptance spec only when each new file preserves real Go + SQLite + Vite + Chromium coverage and remains part of the protected CI chain.

## Source of truth

These human checklists complement, but do not replace:

- `docs/task-manager-audit-plan.md`
- `docs/audits/task-manager-feature-matrix.md`
- `docs/audits/task-manager-closeout.md`
- `docs/audits/task-manager-release-gate.md`

When they disagree, treat the discrepancy as an audit finding and resolve it explicitly.