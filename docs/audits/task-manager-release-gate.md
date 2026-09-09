# Task manager release gate

Status: **human-audit certification in progress**

This is the operational gate for task-manager changes. The support contract remains `docs/audits/task-manager-closeout.md`; the human milestone sheets under `docs/audits/human-verification/` define the product walkthrough, and `web/apps/client/tests/e2e/audit/audit-contract.json` defines which evidence layer is allowed to prove each automatable row.

## Required merge evidence

Donegeon `main` requires the established protected CI contexts:

- `Full-history secret scan`
- `Go checks`
- `Infra typecheck`
- `Web typecheck, test, and build`
  - this job has `needs: [entry, browser]`
  - therefore it cannot succeed unless both `Application entry acceptance` and `Human-audit certified browser set` succeed first

The two browser jobs deliberately have different responsibilities:

- `Application entry acceptance` runs with real backend authentication enabled and `VITE_E2E_BYPASS_AUTH=false`. It proves a fresh browser can enter the application through login/waitlist/onboarding rather than bypassing account setup.
- `Human-audit certified browser set` keeps the narrow task-focused auth bypass, first validates the checklist/evidence contract, then runs every milestone listed in `certifiedBrowserMilestones` against a real Go server, temporary SQLite DB, Vite client, and Chromium.

The task-manager bypass is an isolation mechanism, not evidence that application entry works. A release must pass both jobs.

## Certification rule

A milestone becomes protected browser evidence only after all three are true:

1. the matching human-verification sheet has been walked manually;
2. every browser-observable table row has an exact, non-skipped `[M#] <row>` Playwright case;
3. both the automated milestone spec and manual milestone verdict are `PASS`.

Only then is the milestone added to `certifiedBrowserMilestones` in `audit-contract.json`.

A later milestone being red during active review is not hidden or normalized. It remains encoded as truthful not-yet-certified evidence until product defects are repaired and the human review is rerun.

## What each gate protects

| Gate | Contract |
| --- | --- |
| Full-history secret scan | No unapproved secrets enter reachable Git history |
| Go checks | Vet, durable domain/API semantics, compatibility retirement policy, tenant boundaries, recurrence/scheduling, board/game integration, vulnerability scan |
| Application entry acceptance | Real Go auth + temporary SQLite + Vite + Chromium: protected-route redirect, login reactivity, OTP, onboarding, Inbox entry/reload, beta/waitlist behavior |
| Human-audit certified browser set | Audit-contract integrity plus every manually certified task-manager milestone in real Go + SQLite + Vite + Chromium |
| Web typecheck, test, and build | SolidJS/TypeScript correctness, unit rules, production build, dependency audit; blocked until both browser jobs are green |
| Infra typecheck | SST type generation/configuration and production dependency audit |

## Evidence-layer rule

Playwright must not be used to manufacture proof for things it cannot meaningfully judge.

- Human product semantics and visual judgment remain human evidence.
- Durable state transitions, authorization, rollback, timezone arithmetic, and tenant isolation use Go/API integration evidence where that is the stronger layer.
- Live external-provider behavior may require manual/provider evidence.
- M7 support-boundary truthfulness and M8 CI structure are not reclassified as browser features merely to increase a test count.

Conversely, a user-visible flow may not be called browser-verified merely because a backend contract exists. If the human can perform it in the maintained UI, its human checklist row must map to an exact Playwright case before browser certification.

## Determinism rule

A required test must not assert a fixed value while intentionally enabled RNG can legally change that value.

If a required check fails intermittently, rerunning may help diagnose the failure but is not the fix. The nondeterministic assumption must be removed before that milestone can remain certified.

## Task-manager support boundary

Before extending the product, read `docs/audits/task-manager-closeout.md`.

In particular:

- `VERIFIED` means meaningful executable evidence exists at the appropriate layer.
- `RETIRED` legacy compatibility actions must not be re-enabled merely to satisfy old YAML parity cases.
- `UNIMPLEMENTED` features such as durable assignees, subtasks, reminders, and attachments must not be advertised until a canonical model and semantic tests exist.
- `docs/test-catalog.md` is a test inventory, not the support matrix.

## Change rule

For future task-manager work:

1. Backend state changes need durable Go semantic assertions.
2. HTTP behavior needs authorization/response/persistence assertions.
3. User-visible changes update the matching human-verification row and its exact-title milestone Playwright case when browser-observable.
4. A newly completed human milestone is added to `certifiedBrowserMilestones` only after manual and automated PASS.
5. Login, beta/waitlist, onboarding, protected-route, or other application-entry changes extend `web/apps/client/tests/e2e/application-entry.spec.ts`; task-manager auth bypass cannot substitute for this evidence.
6. New collaboration behavior uses the authoritative account/team/board-member model rather than legacy compatibility SQL.
7. A change is not release-ready until the protected CI chain is green.

This gate therefore reports exactly what has been certified. It does not infer product completeness from route availability, test count, a stale legacy spec, or a hand-picked browser file.
