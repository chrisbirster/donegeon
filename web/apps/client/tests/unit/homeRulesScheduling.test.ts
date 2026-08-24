import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { Task } from "../../src/domain/contracts.ts";
import {
  startOfLocalDay,
  taskDueDate,
  taskScheduledDate,
} from "../../src/features/tasks/home-rules.ts";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    content: "Scheduled task",
    description: "",
    sortOrder: 1,
    labels: [],
    priority: 4,
    checked: false,
    isDeleted: false,
    ...overrides,
  };
}

function localYMD(value: Date | null): string | null {
  if (!value) return null;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("task scheduling view rules", () => {
  const now = new Date(2026, 7, 23, 12, 0, 0);
  const today = startOfLocalDay(now);

  test("uses due text before deadline when both are present", () => {
    const scheduled = taskScheduledDate(task({
      dueText: "2026-08-25",
      dueDeadline: "2026-08-24",
    }));
    assert.equal(localYMD(scheduled), "2026-08-25");
  });

  test("falls back to deadline when a task has no due text", () => {
    const scheduled = taskScheduledDate(task({ dueDeadline: "2026-08-24" }));
    assert.equal(localYMD(scheduled), "2026-08-24");
  });

  test("buckets overdue work into Today instead of hiding it", () => {
    const due = taskDueDate(task({ dueText: "2026-08-20" }), now);
    assert.equal(due?.getTime(), today.getTime());
  });

  test("keeps today's work in Today", () => {
    const due = taskDueDate(task({ dueText: "2026-08-23" }), now);
    assert.equal(due?.getTime(), today.getTime());
  });

  test("keeps future work strictly after Today for Upcoming", () => {
    const due = taskDueDate(task({ dueText: "2026-08-24" }), now);
    assert.ok(due);
    assert.ok(due.getTime() > today.getTime());
  });

  test("unscheduled work does not enter Today or Upcoming", () => {
    assert.equal(taskDueDate(task(), now), null);
  });
});
