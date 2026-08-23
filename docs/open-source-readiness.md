# Open-source readiness checklist

This checklist distinguishes checks enforced by the repository from the final account-level review that only the repository owner can perform before changing visibility.

## Completed and enforced in the repository

- [x] License Donegeon-authored source, documentation, scripts, configuration, and project-specific artwork as `AGPL-3.0-only`.
- [x] Include the full GNU Affero General Public License v3.0 text in `LICENSE`.
- [x] Document project artwork and branch-resident WIP artwork in `ASSETS.md`.
- [x] Expose a public `/open-source` application route with copyright, AGPL, source-code, and no-warranty notices.
- [x] Link the open-source notice, source repository, and AGPL license from the signed-in application menu.
- [x] Standardize supported JavaScript/TypeScript tooling on Node.js 22+ and npm 10+.
- [x] Remove Bun lockfiles and Bun-based maintained dev/test/deploy commands.
- [x] Generate and commit a fresh `web/package-lock.json` on a clean Node/npm CI runner.
- [x] Use deterministic `npm ci` installs in CI and deployment workflows.
- [x] Pin the compatible Vite/Solid prerelease dependency resolution needed by the current SolidJS 2 stack.
- [x] Reconcile the `dev` product fixes into the open-source readiness branch through PR #5.
- [x] Run `go vet`, Go tests, and `govulncheck` in CI.
- [x] Run web typechecking, Node unit tests, web builds, and infrastructure typechecking in CI.
- [x] Require production-only npm audits to fail CI on high/critical runtime dependency advisories.
- [x] Scan all fetched Git branches/tags and complete Git history with Gitleaks on every CI run.
- [x] Verify the two historical Gitleaks findings were intentional development placeholders (`TOKEN_VALID` and the documented example cookie key) and suppress only their exact fingerprints in `.gitleaksignore`.
- [x] Keep GitHub Actions read-only by default and use current Node-24-based action majors.
- [x] Gate automatic `main` deployments on a successful CI workflow.
- [x] Configure Dependabot updates for Go modules, both npm workspaces, and GitHub Actions.
- [x] Align the Docker build with Go 1.26.
- [x] Reject known development/placeholder credentials when `DONEGEON_ENV=production`.
- [x] Add production-configuration regression tests.
- [x] Rewrite the README for the current Go + SolidJS 2 + Vite architecture and npm workflow.
- [x] Remove stale absolute developer-machine paths from maintained documentation.
- [x] Add `CONTRIBUTING.md` and `SECURITY.md`.
- [x] Remove committed test-run artifacts and ignore generated test/report output.

## Final owner review before changing visibility to public

These checks involve account settings or external secret stores whose secret values are intentionally not exposed to repository code or this automation.

- [ ] **Review deployment/repository secrets and variables.** In GitHub Actions, Fly.io, SST/AWS, Cloudflare, Turso, Stripe, and Google OAuth, confirm every currently configured production credential is intentional, still active, and stored as a secret rather than committed source or a public variable. The repository history scan is clean apart from the two documented placeholder fingerprints.
- [ ] **Review remaining branches.** `dev` and `DGN-0002-project-navigation-test-fix` are superseded by the readiness line. `DGN-0001-quick-add-local-preview` no longer contains a materially different E2E file from the readiness branch. `DGN-0003-marketing-homepage-refresh` still contains an unmerged marketing redesign/WIP asset; decide whether you want that WIP branch visible publicly or delete/archive it first.
- [ ] **Configure public-repository security settings.** When available for the repository/plan, enable secret scanning and push protection, private vulnerability reporting, and code scanning. Dependabot configuration is already committed.
- [ ] **Protect `main`.** Require the `CI` checks and the pull-request/review policy you want for future production changes.
- [ ] **Final human diff/readme/branding review.** Confirm the public description, screenshots/artwork, product wording, and contact addresses are what you want associated with the project.

## Publication rule

Donegeon does not need to be feature-complete to be public. It is appropriate to publish it as alpha software once the final owner review above is complete. The repository-level publication gates are about licensing, secrets, contributor safety, reproducibility, deterministic builds, and an accurate description of project maturity.
