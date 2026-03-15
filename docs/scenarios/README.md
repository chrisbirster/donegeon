# Scenario Library

This folder defines realistic user-behavior scenarios for the task view and board view together.

These files are descriptive today. They are intended to become the source of truth for future Playwright E2E journeys that model what a user typically does over:

- one workday
- one workweek
- one 30-day month

## What is covered

- task capture in both the task view and the board view
- realistic task titles, descriptions, and due dates
- due-date branches: complete on time, reschedule, miss and become a zombie
- villager recovery work: gather food, restore stamina, clear zombies
- workload rhythm differences between weekdays, Saturday maintenance, and Sunday planning

## Files

- `00-manifest.yaml`: entry point for the scenario set
- `01-typical-day.yaml`: one realistic mixed weekday
- `02-typical-week.yaml`: Sunday planning through Saturday maintenance
- `03-typical-month.yaml`: a 30-day operating rhythm built from weekly patterns

## Usage

Use these files when defining new E2E flows, discussing product balance, or deciding what "normal usage" should mean for board progression.
