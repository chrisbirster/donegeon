# Open-source readiness checklist

This checklist separates repository changes that can be verified in code review from publication steps that require repository-owner actions or a history-aware external scan.

## Completed in the open-source readiness change set

- [x] Declare `AGPL-3.0-only` for Donegeon-authored source, documentation, scripts, configuration, and project assets.
- [x] Standardize supported JavaScript/TypeScript tooling on Node.js + npm.
- [x] Remove Bun lockfiles and Bun-based dev/test/deploy commands.
- [x] Remove the stale web npm lockfile rather than ship a dependency graph that no longer matches the workspace manifests.
- [x] Rewrite the README for the current Go + SolidJS 2 + Vite architecture.
- [x] Remove stale absolute developer-machine paths from maintained documentation.
- [x] Align the Docker build with Go 1.26.
- [x] Reject known development/placeholder credentials when `DONEGEON_ENV=production`.
- [x] Add production-configuration regression tests.
- [x] Add pull-request/main CI for Go, web typechecking/builds, and infrastructure typechecking.
- [x] Gate automatic `main` deployments on a successful CI workflow.
- [x] Add `CONTRIBUTING.md` and `SECURITY.md`.
- [x] Remove a committed Playwright run artifact and ignore root test artifacts.

## Required before changing repository visibility to public

- [ ] **Run a complete Git-history secret scan.** Use a history-aware scanner such as Gitleaks or TruffleHog against all refs/history, not only the current working tree. If a real credential is found, rotate/revoke it before rewriting history.
- [ ] **Generate and commit a fresh `web/package-lock.json`.** From the finalized branch, run `npm install` in `web/`, review the generated lockfile, commit it, and then change web CI/deploy installs from `npm install` to `npm ci`.
- [ ] **Reconcile `dev` and `main`.** They currently contain divergent work. Decide which post-refactor fixes belong in the public canonical branch and merge them through a reviewed pull request rather than exposing two competing sources of truth.
- [ ] **Review committed assets for provenance.** The project intends to license Donegeon-authored assets under AGPL-3.0-only. Confirm that each committed image/font/media asset is original or otherwise legally relicensable. Any third-party material must keep its upstream license/notice instead of being silently relicensed.
- [ ] **Review repository secrets and environments.** Verify that production secrets live in GitHub/Fly/SST/AWS/Cloudflare secret stores and are not present in repository variables, workflow logs, artifacts, or documentation.
- [ ] **Enable GitHub security features appropriate for a public repository.** At minimum review Dependabot alerts/updates, secret scanning and push protection, code scanning, and private vulnerability reporting.
- [ ] **Protect `main`.** Require the `CI` checks and pull-request review policy you want before merging production changes.

## Recommended shortly after publication

- [ ] Add a visible **Source** / **License** entry in the hosted application and marketing site that links back to the public repository and license information.
- [ ] Add dependency-license reporting to CI and periodically review the Go/npm transitive dependency set.
- [ ] Promote a small trustworthy Playwright smoke suite to required CI once the current browser/context issues and `dev` fixes have been reconciled.
- [ ] Maintain a feature-audit ledger that marks behavior as `VERIFIED`, `PARTIAL`, `BROKEN`, `UNIMPLEMENTED`, or `UNKNOWN` based on semantic evidence rather than raw test count.

## Publication rule

Do not treat this checklist as a claim that the application is feature-complete. Donegeon can be published as alpha software while the task and game models continue to evolve. The publication gate is about licensing, secrets, contributor safety, reproducibility, and an honest description of project maturity.
