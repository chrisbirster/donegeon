import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseQuickAddLocally } from "../../src/lib/localQuickAddParser.ts";

describe("parseQuickAddLocally", () => {
  test("parses project, labels, assignee, priority, deadline, and description", () => {
    assert.deepStrictEqual(parseQuickAddLocally("Ship release #work @urgent +alex p2 {in 3 days} // verify rollout"), {
      content: "Ship release",
      project: "work",
      labels: ["urgent"],
      assignee: "alex",
      priority: 2,
      deadline: "in 3 days",
      dueText: undefined,
      recurrenceRule: undefined,
      description: "verify rollout",
    });
  });

  test("parses the combined composer preview without server resolution", () => {
    assert.deepStrictEqual(parseQuickAddLocally("another task every Thursday at 7pm due Thursday { in 2 days } p2 @chore #home"), {
      content: "another task",
      project: "home",
      labels: ["chore"],
      assignee: undefined,
      priority: 2,
      deadline: "in 2 days",
      dueText: "Thursday",
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH;BYHOUR=19;BYMINUTE=0",
      description: "",
    });
  });

  test("parses common recurrence forms", () => {
    assert.equal(parseQuickAddLocally("Review every 2 weeks").recurrenceRule, "FREQ=WEEKLY;INTERVAL=2");
    assert.equal(
      parseQuickAddLocally("Standup daily at 9am").recurrenceRule,
      "FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0",
    );
    assert.equal(
      parseQuickAddLocally("Payroll twice a month").recurrenceRule,
      "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1,15",
    );
  });
});
