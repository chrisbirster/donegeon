import { css } from "@linaria/core";

export function parseInviteEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

export function formatRoleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "editor" || role === "member") return "Editor";
  if (role === "reader") return "Reader";
  return "Unknown";
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

const ownerBadge = css`border-color:var(--palette-rgba-80-110-196-28-1bdc03); background:var(--palette-rgba-80-110-196-12-6bf5e7); color:var(--text-soft);`;
const adminBadge = css`border-color:var(--palette-rgba-72-133-166-28-17ade9); background:var(--palette-rgba-72-133-166-12-7ede9b); color:var(--text-soft);`;
const editorBadge = css`border-color:var(--palette-rgba-71-138-91-28-16a471); background:var(--palette-rgba-71-138-91-12-b89e1c); color:var(--text-soft);`;
const readerBadge = css`border-color:var(--palette-rgba-123-112-168-28-2a8c7a); background:var(--palette-rgba-123-112-168-12-2ecb8a); color:var(--text-soft);`;
const defaultBadge = css`border-color:var(--border-strong); background:var(--panel-soft); color:var(--text-soft);`;

export function roleBadgeClass(role: string): string {
  switch (role) {
    case "owner":
      return ownerBadge;
    case "admin":
      return adminBadge;
    case "editor":
    case "member":
      return editorBadge;
    case "reader":
      return readerBadge;
    default:
      return defaultBadge;
  }
}
