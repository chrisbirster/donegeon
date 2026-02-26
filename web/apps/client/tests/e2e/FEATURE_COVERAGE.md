# Playwright Feature Coverage

Target: keep automated coverage at or above 90% of user-facing features.

## Covered flows

- [x] Create task from Inbox composer
- [x] Inline edit task content
- [x] Open task detail modal and update fields
- [x] Parse RRULE in task detail modal
- [x] Complete task from task list/detail flow
- [x] Delete task from list actions
- [x] Navigate Inbox/Today/Upcomming views
- [x] Navigate to project view
- [x] Favorite/unfavorite project
- [x] Search and open task detail from search modal
- [x] Create board task stack
- [x] Open board task detail and save updates
- [x] Complete board stack
- [x] Seed default board
- [x] Open deck pack flow (deck.spawn_pack + deck.open_pack)
- [x] End day action
- [x] Drag stack to merge
- [x] Remove stack from board action

## Not covered yet (recommended next)

- [ ] Reorder tasks via drag-and-drop in Home route
- [ ] Board split-stack drag flow
- [ ] Board collect-deck loot flow
- [ ] Error-path UX assertions (validation and conflict retries)
