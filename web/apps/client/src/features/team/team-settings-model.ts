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

export function roleBadgeClass(role: string): string {
  switch (role) {
    case "owner":
      return "border-[rgba(80,110,196,0.28)] bg-[rgba(80,110,196,0.12)] text-[var(--text-soft)]";
    case "admin":
      return "border-[rgba(72,133,166,0.28)] bg-[rgba(72,133,166,0.12)] text-[var(--text-soft)]";
    case "editor":
    case "member":
      return "border-[rgba(71,138,91,0.28)] bg-[rgba(71,138,91,0.12)] text-[var(--text-soft)]";
    case "reader":
      return "border-[rgba(123,112,168,0.28)] bg-[rgba(123,112,168,0.12)] text-[var(--text-soft)]";
    default:
      return "border-[var(--border-strong)] bg-[var(--panel-soft)] text-[var(--text-soft)]";
  }
}
