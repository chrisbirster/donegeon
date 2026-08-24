import type { Task } from "../../domain/contracts";

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

export function parseTaskDateValue(value: string | undefined, now: Date = new Date()): Date | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const today = startOfLocalDay(now);
  if (lower === "today") return today;
  if (lower === "tomorrow") return shiftDays(today, 1);

  const inDays = /^in\s+(\d+)\s+days?$/.exec(lower);
  if (inDays) {
    return shiftDays(today, Number(inDays[1]));
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return startOfLocalDay(parsed);
}

export function taskScheduledDate(task: Task, now: Date = new Date()): Date | null {
  return parseTaskDateValue(task.dueText, now) ?? parseTaskDateValue(task.dueDeadline, now);
}

// Home treats overdue work as part of Today. Returning today's local-day bucket
// for an overdue task lets the existing Today/Upcoming counters and filters use
// one consistent scheduling rule while taskScheduledDate preserves the actual
// stored scheduling date.
export function taskDueDate(task: Task, now: Date = new Date()): Date | null {
  const scheduled = taskScheduledDate(task, now);
  if (!scheduled) return null;
  const today = startOfLocalDay(now);
  if (scheduled.getTime() < today.getTime()) {
    return today;
  }
  return scheduled;
}
