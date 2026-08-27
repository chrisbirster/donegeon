# M5 — Collaboration and integrations human verification

Goal: verify the maintained collaboration/calendar boundaries and confirm retired legacy shims are not mistaken for supported features.

## Session

- Commit: `________________`
- Date: `________________`
- Reviewer: `________________`
- Automated evidence: `________________`
- Final verdict: `NOT_REVIEWED`

## Maintained collaboration behavior

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Workspace owner/admin role behavior | Authorized writes succeed | `NOT_REVIEWED` | |
| Read-only role behavior | Mutations are blocked clearly | `NOT_REVIEWED` | |
| Invitation creation | Canonical invitation is created exactly once | `NOT_REVIEWED` | |
| Invitation acceptance | Membership/role state is correct | `NOT_REVIEWED` | |
| Unauthorized invitation action | Rejected without state change | `NOT_REVIEWED` | |
| Cross-workspace access attempt | Foreign workspace state is not exposed/mutated | `NOT_REVIEWED` | |

## Calendar integration

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Connect calendar account | Connection state is understandable | `NOT_REVIEWED` | |
| OAuth callback/failure | Success/failure feedback is clear | `NOT_REVIEWED` | |
| Task/calendar mapping | Synced task maps to expected calendar data | `NOT_REVIEWED` | |
| Update synchronization | Maintained sync direction behaves as documented | `NOT_REVIEWED` | |
| Tenant isolation | Another workspace cannot access calendar connection/state | `NOT_REVIEWED` | |

## Explicit product boundary

These must not be treated as maintained collaboration features through the legacy compatibility endpoint:

- legacy TaskManager comments;
- legacy workspace membership/invitations;
- legacy project personal/workspace moves;
- legacy collaborator/shared-label shims.

- [ ] Current UI does not depend on retired compatibility behavior.
- [ ] Current docs do not advertise retired compatibility behavior.
- [ ] Canonical account/team/calendar flows are understandable enough to support publicly.

## M5 exit decision

- [ ] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. `________________`
2. `________________`
3. `________________`