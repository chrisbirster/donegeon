---
title: Quick add and smart scheduling
description: Capture tasks with projects, labels, assignees, priority, due dates, deadlines, and recurrence in a single input.
category: Capture
order: 10
featured: true
tags: quick-add, scheduling, parser
---

# Capture the whole task in one line

Donegeon’s quick add parser is designed for the way people already type tasks. Instead of opening a form and tabbing through fields, you can describe the task once and let the parser extract the structure.

## What the parser understands

- `#project` tokens for routing work into the right project
- `@label` tokens for categorization
- `+assignee` tokens for assigning work
- `p1` through `p4` for priority
- Due dates such as `tomorrow`, `next monday`, or `march 18`
- Deadline syntax using braces like `{friday 5pm}`
- Recurrence such as `every weekday at 9am` or `every month on the 1st`

## Example commands

```text
Draft sprint summary #ops @writing p2 tomorrow {friday 5pm}
Review onboarding copy #marketing @content +alex every weekday at 9am
Close finance checklist #admin @monthly every month on the 1st
```

## Why the preview matters

The app can preview quick add parsing before you save. That gives users immediate confidence that the project, labels, due date, and recurrence are being interpreted correctly.

That preview is especially useful when the command mixes due dates and deadlines, because Donegeon also validates schedule conflicts such as a deadline landing before the due date.

## Where this fits in the product

Quick add is the fastest way into the Donegeon workflow:

1. Capture the task in inbox flow.
2. Confirm schedule and metadata in the parser preview.
3. Move it into board gameplay when the work becomes active.

This is one of the clearest examples of how Donegeon stays powerful without feeling slow.
