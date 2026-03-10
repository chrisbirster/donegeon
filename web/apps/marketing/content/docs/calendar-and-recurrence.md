---
title: Calendar sync and recurrence engine
description: Donegeon combines human-friendly scheduling with calendar connections and a deeper recurrence layer.
category: Operations
order: 40
tags: calendar, recurrence, operations
---

# Scheduling depth without calendar chaos

The product has two scheduling stories that need to be presented together: fast natural-language capture and deeper recurrence support for operational reliability.

## Calendar connections

Users can connect Google Calendar from the profile area and manage the connection lifecycle:

- Connect a provider
- Inspect current connections
- Trigger sync
- Disconnect when needed

This gives teams a path to line up task commitments with the rest of their operating calendar.

## RRULE support

Donegeon also includes an RFC 5545 recurrence parser. That means it can work with more than casual repeating reminders.

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

## Why this matters in marketing

If someone is evaluating Donegeon against mature task software, this is the kind of depth they expect to find documented. The updated site now gives that level of detail a place to live.
