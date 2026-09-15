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

The maintained Google Calendar boundary is read-only. Donegeon can connect an account and fetch upcoming provider events; it does not write Donegeon tasks to Google Calendar or create/update Google Calendar events.

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Connect calendar account | A real Google OAuth connection completes and the resulting connection state is understandable | `NOT_REVIEWED` | live provider check |
| OAuth callback/failure | Success/failure feedback is clear and returns the user to the profile calendar surface | `NOT_REVIEWED` | deterministic provider-stub browser evidence |
| Provider event fetch | Upcoming Google events are fetched read-only without implying task/calendar writes | `NOT_REVIEWED` | semantic provider contract |
| Fetch status persistence | Successful fetch reports the event count and persists the last-fetch timestamp | `NOT_REVIEWED` | semantic persistence contract |
| Tenant isolation | Another workspace cannot access calendar connection/state | `NOT_REVIEWED` | semantic authorization contract |

## Explicit product boundary

These must not be treated as maintained collaboration features through the legacy compatibility endpoint:

- legacy TaskManager comments;
- legacy workspace membership/invitations;
- legacy project personal/workspace moves;
- legacy collaborator/shared-label shims.

Calendar support is also intentionally narrower than bidirectional synchronization: Donegeon reads upcoming Google Calendar events but does not currently create, edit, or delete Google Calendar events from task changes.

- [ ] Current UI does not depend on retired compatibility behavior.
- [ ] Current docs do not advertise retired compatibility behavior.
- [ ] Canonical account/team/calendar flows are understandable enough to support publicly.
- [ ] Calendar UI/docs make the read-only provider-fetch direction clear.

## M5 exit decision

- [ ] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. `________________`
2. `________________`
3. `________________`