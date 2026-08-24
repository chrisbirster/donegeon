# Open-source readiness checklist

This checklist distinguishes checks enforced by the repository from the small set of repository-owner steps that remain before or immediately after publication.

## Completed and enforced in the repository

- [x] License Donegeon-authored source, documentation, scripts, configuration, and project-specific artwork as `AGPL-3.0-only`.
- [x] Include the full GNU Affero General Public License v3.0 text in `LICENSE`.
- [x] Document project artwork and branch-resident WIP artwork in `ASSETS.md`.
- [x] Retain `DGN-0003-marketing-homepage-refresh` as an intentional WIP branch; its Donegeon-authored artwork is covered by the repository AGPL declaration.
- [x] Expose a public `/open-source` application route with copyright, AGPL, source-code, and no-warranty notices.
- [x] Link the open-source notice, source repository, and AGPL license from the signed-in application menu.
- [x] Keep the README and maintained public documentation focused on Donegeon's own product behavior and terminology.
- [x] Standardize supported JavaScript/TypeScript tooling on Node.js 22+ and npm 10+.
- [x] Remove Bun lockfiles and Bun-based maintained dev/test/deploy commands.
- [x] Generate and commit a fresh `web/package-lock.json` on a clean Node/npm CI runner.
- [x] Use deterministic `npm ci` installs in CI and deployment workflows.
- [x] Pin the compatible Vite/Solid prerelease dependency resolution needed by the current SolidJS 2 stack.
- [x] Reconcile the `dev` product fixes into the open-source readiness branch through PR #5.
- [x] Require Go 1.26.7 or newer on the 1.26 line and pin the production build image to `golang:1.26.7-bookworm`.
- [x] Run `go vet`, Go tests, and `govulncheck` in CI.
- [x] Run web typechecking, Node unit tests, web builds, and infrastructure typechecking in CI.
- [x] Require production-only npm audits to fail CI on high/critical runtime dependency advisories.
- [x] Scan all fetched Git branches/tags and complete Git history with Gitleaks on every CI run.
- [x] Verify the two historical Gitleaks findings were intentional development placeholders (`TOKEN_VALID` and the documented example cookie key) and suppress only their exact fingerprints in `.gitleaksignore`.
- [x] Keep GitHub Actions read-only by default and use current Node-24-based action majors.
- [x] Gate automatic `main` deployments on a successful CI workflow.
- [x] Configure Dependabot updates for Go modules, both npm workspaces, and GitHub Actions.
- [x] Reject known development/placeholder credentials when `DONEGEON_ENV=production`.
- [x] Add production-configuration regression tests.
- [x] Rewrite the README for the current Go + SolidJS 2 + Vite architecture and npm workflow.
- [x] Remove stale absolute developer-machine paths from maintained documentation.
- [x] Add `CONTRIBUTING.md` and `SECURITY.md`.
- [x] Remove committed test-run artifacts and ignore generated test/report output.

## Secrets status

Local `.env` files, database files, and generated credentials are ignored and are not intended to be committed. More importantly, CI performs a history-aware Gitleaks scan over fetched branches, tags, and complete Git history. That scan is green apart from the two exact development-placeholder fingerprints documented above.

Secrets stored in GitHub Actions, Fly.io, AWS/SST, Cloudflare, Turso, Stripe, or Google are account-level values and are not exposed to repository source or to the history scanner. They are not a publication blocker unless the owner knows that a real credential was previously committed, copied into public source, or otherwise exposed. No such exposure is currently known from the repository audit.

## Final owner steps

- [x] **Branch decision.** Keep `DGN-0003-marketing-homepage-refresh` as a WIP branch in the public project.
- [x] **Licensing decision.** Donegeon-authored code, documentation, configuration, scripts, and project artwork are AGPL-3.0-only unless a file explicitly identifies third-party material under another license.
- [x] **History decision.** Publish the existing Git history. The owner reviewed and accepts the historical external-comparison README sentence and existing commit author metadata.
- [x] **Final human read-through.** Public wording, artwork licensing, retained WIP branch, and history exposure have been reviewed for publication.
- [ ] **Make the repository public.** Change `chrisbirster/donegeon` visibility from private to public.
- [ ] **Enable free public-repository security features.** Enable secret scanning/push protection, private vulnerability reporting, and code scanning. Dependabot configuration is already committed.
- [ ] **Protect `main`.** Require the `CI` checks and the pull-request/review policy for future production changes using the branch-protection features available to public repositories.

## Publication rule

Donegeon does not need to be feature-complete to be public. The repository-level licensing, secret scanning, reproducibility, dependency auditing, CI, and publication-review gates are complete. After visibility is changed to public, enable the public-repository security settings and `main` protection so they apply to subsequent contributions.
