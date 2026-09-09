import assert from "node:assert/strict";
import { test } from "node:test";

import { parseQuickAddLocally } from "../../src/lib/localQuickAddParser.ts";

test("timed tomorrow stays one due expression in the local preview", () => {
  assert.deepStrictEqual(
    parseQuickAddLocally("adding a task here @home @chore #task due tomorrow at 8pm"),
    {
      content: "adding a task here",
      project: "task",
      labels: ["home", "chore"],
      assignee: undefined,
      priority: undefined,
      deadline: undefined,
      dueText: "tomorrow at 8pm",
      recurrenceRule: undefined,
      description: "",
    },
  );
});
