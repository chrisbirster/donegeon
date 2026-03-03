# Playwright Feature Coverage

Target: keep automated coverage at or above 90% of user-facing features.

## Suite status

- Total tests: 173
- Passing: 173
- Skipped/Fixme: 0
- Matrix/backlog: see [TEST_MATRIX.md](./TEST_MATRIX.md) (608 generated interaction-variant cases, 608 automated / 0 planned)

## Covered flows

- [x] Create task from Inbox composer
- [x] Inline edit task content
- [x] Inline edit save/cancel keyboard paths (Enter/Escape)
- [x] Open task detail modal and update fields
- [x] Parse RRULE in task detail modal
- [x] Show schedule validation warning (deadline before due)
- [x] Clear due/deadline values from task detail and persist cleared state
- [x] Create new project from task detail modal
- [x] Complete task from task list/detail flow
- [x] Delete task from list actions
- [x] Navigate Inbox/Today/Upcomming views
- [x] Navigate to project view
- [x] Favorite/unfavorite project
- [x] Search and open task detail from search modal
- [x] Create board task stack
- [x] Open board task detail and save updates
- [x] Show board detail modifier guidance when schedule mods are missing
- [x] Complete board stack
- [x] Seed default board
- [x] Open deck pack flow (deck.spawn_pack + deck.open_pack)
- [x] End day action
- [x] Refresh board action
- [x] Drag stack to merge
- [x] Remove stack from board action
- [x] Add and remove board members from board access panel
- [x] Multi-board isolation (stack exists on one board but not another)
- [x] Team settings entitlement surface (plan/role visibility)
- [x] Team settings update team name
- [x] Team settings invite + cancel invitation
- [x] Team settings role update + member removal
- [x] Team settings invitation controls matrix (remove member, invite submit/role/input, cancel invite)
- [x] AppShell mobile sidebar open + close (backdrop and close button)
- [x] AppShell account menu toggle, Settings route, and Quest Log route
- [x] AppShell sign-out trigger (logout API + route transition behavior)
- [x] Login request flow (desktop/mobile, validation, reload behavior)
- [x] Login verify flow (desktop/mobile, validation, reload behavior)
- [x] Invitation-locked login behavior and use-different-email interaction paths
- [x] Onboarding submit flow (success + API error handling)
- [x] Onboarding form field behavior: name + team name (validation, reload reset, mobile)
- [x] Onboarding plan selection behavior: personal/pro trial/enterprise (payload, reload reset, mobile)
- [x] Onboarding invite input parsing and reload reset behavior
- [x] Team billing actions: pro trial/pro/enterprise (desktop, validation, reload, mobile)
- [x] Team profile save + team-name input behavior (desktop/mobile, validation, reload)
- [x] Team member role updates (desktop/mobile, validation, reload persistence)
- [x] Mobile board map hub toggle
- [x] Board CRUD from sidebar controls (create/delete board)
- [x] Home mobile sidebar quick actions (Add/Search, view navigation, and mobile project navigation)
- [x] Home desktop sidebar quick actions (Add Task + Search with validation/reload behavior)
- [x] Home desktop sidebar view navigation (Inbox/Today/Upcoming) with idempotence and reload persistence
- [x] Home desktop project controls (Favorites/My Projects navigation + favorite toggle success/error/reload/responsive)
- [x] Home quick-add composer form and input matrix (submit success/empty/reload/mobile + parse success/error/reload/mobile)
- [x] Home row interaction matrix (open detail, complete without bubbling, DnD reorder persistence, inline save/cancel buttons, open/delete actions)
- [x] Home search overlay interaction matrix (backdrop close, panel stop-propagation, result opens detail)
- [x] Home detail project/create controls and detail field persistence matrix (tags/priority/due/deadline/rrule)
- [x] Board header board controls (selector + prompt create + delete)
- [x] Board mobile board controls (selector, create via Enter/button, delete, reload option persistence)
- [x] Board mobile board access controls (add/remove members with reload persistence)
- [x] Board desktop/mobile minimap pointer interactions
- [x] Board canvas pan interaction
- [x] Board deck hub panel interactions (backdrop/panel close, hide/show, drag events)
- [x] Board detail modal interaction matrix (close, priority, save, open-in-tasks, mark-done)
- [x] Board quest claim reward action (desktop/mobile)
- [x] Board mobile end-day/refresh command dispatch
- [x] Profile board selector interaction matrix (desktop/mobile switch + reload persistence)

## Not covered yet (recommended next)

- [ ] Board split-stack drag flow
- [ ] Board collect-deck loot flow
- [ ] Error-path UX assertions (validation and conflict retries)
