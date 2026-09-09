# M8 — Release gate human verification

Goal: verify that regressions in application entry and every **manually certified** task-manager milestone actually block merge, while milestones still under active human review remain visible rather than being falsely certified.

## Session

- Commit: `________________`
- Date: `________________`
- Reviewer: `________________`
- GitHub Actions run: `________________`
- Final verdict: `NOT_REVIEWED`

## Required evidence chain

| Gate | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Full-history secret scan | Must pass | `NOT_REVIEWED` | |
| Go checks | Vet + tests + govulncheck must pass | `NOT_REVIEWED` | |
| Infra typecheck | SST/typecheck/audit must pass | `NOT_REVIEWED` | |
| Application entry acceptance | Real-auth Chromium login/waitlist/onboarding entry must pass | `NOT_REVIEWED` | no frontend auth bypass |
| Human-audit certified browser set | Audit contract + every milestone in `certifiedBrowserMilestones` must pass in real Chromium | `NOT_REVIEWED` | task-focused auth bypass is allowed here only |
| Web typecheck, test, and build | Must not start/succeed before both browser gates succeed | `NOT_REVIEWED` | protected context depends on entry + browser |

## Structural verification

- [ ] `.github/workflows/ci.yml` keeps `Application entry acceptance` as a distinct visible job.
- [ ] The application-entry job runs with `PW_REAL_AUTH=true`, causing backend auth to remain required and `VITE_E2E_BYPASS_AUTH=false`.
- [ ] `.github/workflows/ci.yml` keeps `Human-audit certified browser set` as a distinct visible job.
- [ ] The certified-browser job runs `test:audit:contract` before Chromium acceptance.
- [ ] The certified-browser job obtains its milestone list from `audit-contract.json` rather than a hand-picked spec in workflow YAML.
- [ ] A milestone enters `certifiedBrowserMilestones` only after its matching Playwright spec and manual human audit both pass.
- [ ] A milestone that is still being audited remains encoded in the contract/specs and is not hidden with skip/fixme/expected-failure solely to keep protected CI green.
- [ ] `Web typecheck, test, and build` declares `needs: [entry, browser]`.
- [ ] GitHub visibly waits for both browser jobs before starting the protected web job.
- [ ] A failure in either protected browser job therefore prevents the protected web context from succeeding.
- [ ] Branch protection still requires the established protected contexts on `main`.

## Application-entry verification

- [ ] A fresh protected-route visit redirects to login rather than bypassing auth.
- [ ] Entering an email changes Continue from disabled to enabled.
- [ ] The real development OTP flow reaches onboarding.
- [ ] Onboarding reaches Inbox and the authenticated state survives reload.
- [ ] The local Open Beta selected state has readable text contrast.
- [ ] Waitlist submission changes from disabled to enabled after required fields are entered and persists through the real API.

## Audit-contract verification

- [ ] Every `M#-*.md` human-verification document is classified in `tests/e2e/audit/audit-contract.json`.
- [ ] Adding a future M9/M10 document without classifying it makes the audit-contract test fail.
- [ ] Every checklist table row classified as Playwright has an exact `[M#] <row>` Playwright title.
- [ ] Required browser rows cannot be silently hidden with `test.skip`, `test.fixme`, or `test.fail`.
- [ ] Human-only, semantic/API, CI-structural, and live-provider evidence is explicitly classified rather than falsely attributed to Playwright.

## Determinism verification

- [ ] Required tests do not assert fixed values while enabled RNG may legally vary them.
- [ ] A flaky required check is treated as a defect, not normalized by repeated reruns.
- [ ] Any intentionally random behavior is made deterministic inside tests that assert exact values.

## Change-policy verification

- [ ] Backend state changes require durable semantic Go evidence.
- [ ] HTTP changes require authorization/response/persistence evidence.
- [ ] User-visible behavior changes update the matching human checklist and exact-title audit spec where browser-observable.
- [ ] Login/waitlist/onboarding/protected-route changes extend authoritative application-entry acceptance.
- [ ] Collaboration changes use canonical account/team models, not legacy compatibility SQL.
- [ ] Retired compatibility behavior is not re-enabled merely to satisfy historical fixtures.

## M8 exit decision

- [ ] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. `________________`
2. `________________`
3. `________________`
