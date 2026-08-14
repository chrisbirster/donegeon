import { describe, expect, test } from "bun:test";

import { parseQuickAddLocally } from "../../src/lib/localQuickAddParser";

describe("parseQuickAddLocally", () => {
  test("parses project, labels, assignee, priority, deadline, and description", () => {
    expect(parseQuickAddLocally("Ship release #work @urgent +alex p2 {in 3 days} // verify rollout")).toEqual({
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
    expect(parseQuickAddLocally("another task every Thursday at 7pm due Thursday { in 2 days } p2 @chore #home")).toEqual({
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
    expect(parseQuickAddLocally("Review every 2 weeks").recurrenceRule).toBe("FREQ=WEEKLY;INTERVAL=2");
    expect(parseQuickAddLocally("Standup daily at 9am").recurrenceRule).toBe(
      "FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0",
    );
    expect(parseQuickAddLocally("Payroll twice a month").recurrenceRule).toBe(
      "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1,15",
    );
  });
});
