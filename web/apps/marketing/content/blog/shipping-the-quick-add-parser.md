---
title: Shipping a quick add parser that understands more than dates
description: Quick add is one of the clearest examples of Donegeon favoring speed without sacrificing structure.
category: Engineering
publishedAt: 2026-02-28
author: Donegeon team
tags: engineering, quick-add, parser
---

# Fast capture is only valuable if the parser is trustworthy

Task entry is where most workflow tools either become too rigid or too ambiguous.

Rigid tools force users through forms and toggles before they can even finish writing the task.

Ambiguous tools accept the text quickly but fail to preserve the right structure around labels, deadlines, and recurrence.

Donegeon’s parser tries to take the better path.

## What the parser extracts

- Project references
- Labels
- Assignees
- Priority levels
- Due dates
- Deadlines
- Recurrence patterns

## Why preview is part of the feature

Preview is not a nice-to-have. It is what makes a more expressive parser safe to use at speed.

When the system shows how it interpreted the command before the task is saved, users can correct a token immediately instead of cleaning up malformed tasks later.

That interaction is important enough that the marketing site now calls it out as a distinct part of the product story.
