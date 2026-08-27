# M8 — Release gate human verification

Goal: verify that a regression in the audited task-manager journey actually blocks merge and that the required CI chain remains deterministic.

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
| Browser acceptance | Real Chromium task-manager journey must pass | `NOT_REVIEWED` | |
| Web typecheck, test, and build | Must not start/succeed before browser acceptance succeeds | `NOT_REVIEWED` | protected context depends on browser |

## Structural verification

- [ ] `.github/workflows/ci.yml` keeps `Browser acceptance` as a distinct visible job.
- [ ] `Web typecheck, test, and build` declares `needs: browser`.
- [ ] GitHub visibly waits for browser acceptance before starting the protected web job.
- [ ] A browser failure therefore prevents the protected web context from succeeding.
- [ ] Branch protection still requires the established protected contexts on `main`.

## Determinism verification

- [ ] Required tests do not assert fixed values while enabled RNG may legally vary them.
- [ ] A flaky required check is treated as a defect, not normalized by repeated reruns.
- [ ] Any intentionally random behavior is made deterministic inside tests that assert exact values.

## Change-policy verification

- [ ] Backend state changes require durable semantic Go evidence.
- [ ] HTTP changes require authorization/response/persistence evidence.
- [ ] User-visible lifecycle/scheduling changes extend authoritative browser acceptance.
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