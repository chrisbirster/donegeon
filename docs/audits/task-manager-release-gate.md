# Task manager release gate

Status: **M8 complete when this branch is green and merged**

This is the operational gate for task-manager changes after the M0–M7 semantic audit. The support contract remains `docs/audits/task-manager-closeout.md`; this document defines what must be green before a change is safe to merge.

## Required merge evidence

Donegeon `main` already requires the established CI contexts. M8 makes the task-manager browser journey transitively mandatory without depending on an additional repository-settings change:

- `Full-history secret scan`
- `Go checks`
- `Infra typecheck`
- `Web typecheck, test, and build`
  - this job now has `needs: browser`
  - therefore it cannot succeed unless `Browser acceptance` succeeds first

`Browser acceptance` remains a distinct visible CI job, but failure now also prevents the already-protected web context from succeeding. This closes the gap where browser acceptance could be red while the four previously required contexts were green.

## What each gate protects

| Gate | Contract |
| --- | --- |
| Full-history secret scan | No unapproved secrets enter reachable Git history |
| Go checks | Vet, durable domain/API semantics, compatibility retirement policy, tenant boundaries, recurrence/scheduling, board/game integration, vulnerability scan |
| Browser acceptance | Real Go server + temporary SQLite + Vite + Chromium task-manager journey: create, persistence, reload hydration, search/detail, scheduling, completion, recurrence, mobile core flow |
| Web typecheck, test, and build | SolidJS/TypeScript correctness, unit rules, production build, production dependency audit; blocked until browser acceptance is green |
| Infra typecheck | SST type generation/configuration and production dependency audit |

## Determinism rule

A required test must not assert a fixed value while intentionally enabled RNG can legally change that value.

M8 fixes `TestTaskCompleteStackSpawnsCoinReward` accordingly: that test is specifically about the guaranteed one-coin completion reward, so it disables bonus reward rolls in its local test gameplay configuration. Production/default gameplay keeps its bonus RNG unchanged. Tests that exercise perk or reward variation configure those semantics explicitly.

If a required check fails intermittently, rerunning may help diagnose the failure but is not the fix. The nondeterministic assumption must be removed before the audit can be considered stable.

## Task-manager support boundary

Before extending the product, read `docs/audits/task-manager-closeout.md`.

In particular:

- `VERIFIED` means meaningful executable evidence exists.
- `RETIRED` legacy compatibility actions must not be re-enabled merely to satisfy old YAML parity cases.
- `UNIMPLEMENTED` features such as durable assignees, subtasks, reminders, and attachments must not be advertised until a canonical model and semantic tests exist.
- `docs/test-catalog.md` is a test inventory, not the support matrix.

## Change rule

For future task-manager work:

1. Backend-only state changes need durable Go semantic assertions.
2. HTTP behavior needs authorization/response/persistence assertions.
3. User-visible lifecycle or scheduling changes must extend `web/apps/client/tests/e2e/task-manager-audit.spec.ts` or add an equally authoritative browser contract.
4. New collaboration behavior must use the authoritative account/team/board-member model rather than bypassing it through legacy compatibility SQL.
5. A change is not release-ready until the protected CI chain is green.

M0–M8 therefore leave the task manager with both an explicit support matrix and an enforced end-to-end merge gate rather than relying on feature count or route availability as evidence of correctness.
