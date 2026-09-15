# M5 — Collaboration and integrations human verification

Goal: verify the maintained collaboration/calendar boundaries and confirm retired legacy shims are not mistaken for supported features.

## Session

- Commit: `590da3f4d82f9304bcd7d2eaa6dd76c104be785b`
- Date: `2026-09-15`
- Reviewer: `Chris Birster`
- Automated evidence: M5 Remediation Audit #17 (`34967847032`) — 4/4 browser cases plus collaboration/calendar semantic contracts PASS; protected CI #283 (`34967846959`) — PASS
- Final verdict: `NEEDS_WORK`

## Maintained collaboration behavior

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Workspace owner/admin role behavior | Authorized writes succeed | `NOT_REVIEWED` | Deterministic browser coverage is green; human walkthrough still pending on the current product head. |
| Read-only role behavior | Mutations are blocked clearly | `PASS` | Semantic contract covers reader write denial. |
| Invitation creation | Canonical invitation is created exactly once | `NOT_REVIEWED` | Deterministic browser coverage is green; human walkthrough still pending on the current product head. |
| Invitation acceptance | Membership/role state is correct | `PASS` | Semantic collaboration contract. |
| Unauthorized invitation action | Rejected without state change | `PASS` | Semantic collaboration contract. |
| Cross-workspace access attempt | Foreign workspace state is not exposed/mutated | `PASS` | Semantic collaboration/calendar isolation contracts. |

## Calendar integration

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Connect calendar account | Connection state is understandable | `NOT_REVIEWED` | Requires a live Google OAuth round-trip using configured provider credentials. |
| OAuth callback/failure | Success/failure feedback is clear | `PASS` | Deterministic browser/provider-stub coverage is green. |
| Upcoming provider-event fetch | Connected Google account can fetch upcoming provider events without implying task→calendar writes | `PASS` | Semantic calendar contract verifies provider fetch, result count, and persisted last-fetch state. |
| Maintained fetch direction | UI/docs clearly describe the integration as read-only provider-event fetch | `NOT_REVIEWED` | Human truthfulness check still required. |
| Tenant isolation | Another workspace cannot access calendar connection/state | `PASS` | Semantic calendar isolation contract. |

## Explicit product boundary

These must not be treated as maintained collaboration features through the legacy compatibility endpoint:

- legacy TaskManager comments;
- legacy workspace membership/invitations;
- legacy project personal/workspace moves;
- legacy collaborator/shared-label shims.

- [ ] Current UI does not depend on retired compatibility behavior.
- [x] Current docs do not advertise retired compatibility behavior.
- [ ] Canonical account/team/calendar flows are understandable enough to support publicly.

## M5 exit decision

- [ ] `PASS`
- [x] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. Human review found that selecting Light mode changed the stored/resolved theme state but the app remained visually dark because the client defined only dark root design tokens. Board chrome also bypassed tokens with hard-coded dark values, and `/settings` incorrectly marked Profile active. Remediated on the branch with a true light token palette, theme-aware board shell chrome, theme-safe auth/onboarding/task text and contrast colors, native-control light color-scheme handling, and a Settings nav-state correction. Automated app-wide Light regression now covers Settings → Tasks → Board and the protected application-entry contrast gate remains green.
2. Re-run the human visual check on exact product head `590da3f4`: Settings must visibly become light, `/settings` must not highlight Profile, Tasks must remain readable in Light mode, Board shell chrome must respect Light mode, and Light/Dark/Browser Default must survive navigation/reload.
3. Complete Team Settings keyboard/VoiceOver walkthrough and one real Google OAuth connect/fetch/disconnect round-trip before M5 can be certified.
