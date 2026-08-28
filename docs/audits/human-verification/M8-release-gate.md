# M8 — Release gate human verification

Goal: verify that regressions in both application entry and the audited task-manager journey actually block merge and that the required CI chain remains deterministic.

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
| Browser acceptance | Real Chromium task-manager journey must pass | `NOT_REVIEWED` | task-focused auth bypass is allowed here only |
| Web typecheck, test, and build | Must not start/succeed before both browser gates succeed | `NOT_REVIEWED` | protected context depends on entry + browser |

## Structural verification

- [ ] `.github/workflows/ci.yml` keeps `Application entry acceptance` as a distinct visible job.
- [ ] The application-entry job runs with `PW_REAL_AUTH=true`, causing backend auth to remain required and `VITE_E2E_BYPASS_AUTH=false`.
- [ ] `.github/workflows/ci.yml` keeps task-manager `Browser acceptance` as a distinct visible job.
- [ ] `Web typecheck, test, and build` declares `needs: [entry, browser]`.
- [ ] GitHub visibly waits for both browser jobs before starting the protected web job.
- [ ] A failure in either browser job therefore prevents the protected web context from succeeding.
- [ ] Branch protection still requires the established protected contexts on `main`.

## Application-entry verification

- [ ] A fresh protected-route visit redirects to login rather than bypassing auth.
- [ ] Entering an email changes Continue from disabled to enabled.
- [ ] The real development OTP flow reaches onboarding.
- [ ] Onboarding reaches Inbox and the authenticated state survives reload.
- [ ] The local Open Beta selected state has readable text contrast.
- [ ] Waitlist submission changes from disabled to enabled after required fields are entered and persists through the real API.

## Determinism verification

- [ ] Required tests do not assert fixed values while enabled RNG may legally vary them.
- [ ] A flaky required check is treated as a defect, not normalized by repeated reruns.
- [ ] Any intentionally random behavior is made deterministic inside tests that assert exact values.

## Change-policy verification

- [ ] Backend state changes require durable semantic Go evidence.
- [ ] HTTP changes require authorization/response/persistence evidence.
- [ ] User-visible lifecycle/scheduling changes extend authoritative task-manager browser acceptance.
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
