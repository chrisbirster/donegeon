# M5 — collaboration / integration gate

Status: COMPLETE for the canonical task-manager collaboration boundary

## Collaboration

The supported collaboration boundary is `internal/account`, not the legacy task-manager compatibility workspace/invitation helpers.

Semantic evidence now proves:

- Pro workspace invitations are normalized and repeat invitations for the same email/role are idempotent.
- Invitation acceptance creates the intended workspace membership.
- Owners and editors have workspace write permission; readers and non-members do not.
- Readers cannot invite members and non-owners cannot change roles.
- Owner role changes immediately change effective workspace write permission.
- Pending invitations can be cancelled and cannot subsequently be accepted.
- Member removal revokes effective workspace write permission.
- Existing account integration tests prove accepted members see the team board and inbox without gaining access to the owner's personal board.

## Calendar

`internal/calendar/service_integration_test.go` uses a deterministic in-process HTTP transport rather than external Google calls. It proves:

- Google OAuth connect URL generation uses a principal-bound random state and PKCE S256.
- OAuth state cannot be consumed by another user/workspace and can only be consumed once.
- Token exchange and profile retrieval populate a tenant-owned calendar connection.
- Calendar connections cannot be listed, fetched, or deleted by another tenant.
- Calendar sync calls the provider boundary with the persisted access token, counts returned upcoming events, and persists `last_sync_at`.
- The owner can disconnect the connection.

This is connection/upcoming-event sync evidence. Donegeon does not claim bidirectional task-to-calendar synchronization from this contract.

## Explicit first-milestone scope decisions

The following are not part of the first task-manager-complete contract because no canonical durable product model exists for them:

- subtasks / parent-child tasks
- durable task assignees (`+name` remains parser metadata)
- reminders
- task attachments/uploads
- activity log
- bidirectional task/calendar synchronization

These must remain visibly `OUT_OF_SCOPE`, not `VERIFIED` or silently implied.

## Legacy compatibility collaboration actions

The compatibility layer still contains historical comment/workspace-invitation implementations that bypass the canonical account/calendar ownership model. They are not counted as supported collaboration functionality. M7 must retire those actions and remove their low-value parity specs from the authoritative test catalog before the task-manager audit can close.

## Validation

M5 is complete only after the final PR head passes the protected Go, web, infra, and full-history secret-scan checks.
