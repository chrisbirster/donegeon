# Security Policy

Donegeon is currently alpha software. Security reports are welcome, but the project does not yet promise stable release support windows.

## Supported version

Security fixes are developed against the current `main` branch. Older commits, development branches, and unreleased snapshots are not separately supported.

## Reporting a vulnerability

Please do **not** open a public issue containing vulnerability details, credentials, tokens, private user data, proof-of-concept exploit code, or reproduction steps that would make exploitation easier.

When GitHub private vulnerability reporting is enabled for this repository, use the repository's **Security → Report a vulnerability** flow.

If private vulnerability reporting is temporarily unavailable, contact the repository maintainer through their GitHub profile and request a private reporting channel. Do not include sensitive technical details in a public issue or discussion.

A useful report includes:

- the affected commit or version;
- the affected component or endpoint;
- impact and realistic attack conditions;
- minimal reproduction steps;
- suggested remediation, if known.

## Secrets

Never commit real Donegeon deployment credentials. `.env`, database files, SST state, Playwright output, and other local artifacts are ignored by the repository.

Production mode rejects known placeholder API tokens and cookie/authentication secrets. If a credential is accidentally committed, treat it as compromised: revoke or rotate it first, then remove it from repository history where appropriate.

Before changing a previously private repository to public visibility, scan the complete Git history with a history-aware secret scanner such as Gitleaks or TruffleHog. Searching only the current working tree is not sufficient.
