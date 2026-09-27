---
title: Calendar connections and recurring schedules
description: Donegeon combines human-friendly scheduling with read-only Google Calendar connections and flexible recurring work.
category: Operations
order: 40
tags: calendar, recurrence, operations
---

# Scheduling depth without calendar overload

Donegeon brings together fast task capture, reliable recurring work, and a read-only view into upcoming Google Calendar activity.

## Google Calendar connection

Users can connect Google Calendar from the profile area and manage the connection lifecycle:

- Connect a Google account through OAuth
- Inspect current connections
- Fetch upcoming Google Calendar events
- See the last successful fetch time
- Disconnect when needed

The current integration is intentionally **read-only**. Donegeon fetches upcoming Google Calendar events and reports how many were returned; it does not create, edit, or delete Google Calendar events when a Donegeon task changes, and it does not claim bidirectional task/calendar synchronization.

## Advanced schedule rules

Donegeon also supports advanced recurrence rules, so it can handle more than casual repeating reminders.

Supported rule parts include:

- `FREQ`
- `INTERVAL`
- `COUNT`
- `UNTIL`
- `BYDAY`
- `BYMONTHDAY`
- `BYMONTH`
- `BYSETPOS`
- Additional IANA-style extension fields

## Why this matters

Recurring task schedules stay authoritative inside Donegeon, while the Google Calendar connection gives users read-only visibility into upcoming provider events without pretending that two-way calendar editing exists.
