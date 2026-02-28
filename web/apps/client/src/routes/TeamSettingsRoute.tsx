import { For, Show, createMemo, createSignal, onMount } from "solid-js";

import AppShell from "../components/AppShell";
import { teamApi, type TeamInvitation, type TeamMember, type TeamSettings } from "../server/api";

function parseInviteEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

function formatRoleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case "owner":
      return "border-[#4a6bc7] bg-[#1e2b57] text-[#d8e1ff]";
    case "admin":
      return "border-[#4f7287] bg-[#173245] text-[#c9ecff]";
    default:
      return "border-[#3b4f73] bg-[#152238] text-[#cfe0ff]";
  }
}

export default function TeamSettingsRoute() {
  const [settings, setSettings] = createSignal<TeamSettings | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");

  const [teamNameInput, setTeamNameInput] = createSignal("");
  const [saveTeamLoading, setSaveTeamLoading] = createSignal(false);

  const [inviteInput, setInviteInput] = createSignal("");
  const [inviteLoading, setInviteLoading] = createSignal(false);

  const [roleSavingByUserID, setRoleSavingByUserID] = createSignal<Record<string, boolean>>({});
  const [removingUserID, setRemovingUserID] = createSignal<string | null>(null);
  const [cancelingInviteCode, setCancelingInviteCode] = createSignal<string | null>(null);

  const [actionError, setActionError] = createSignal("");
  const [actionNotice, setActionNotice] = createSignal("");

  const canManage = createMemo(() => settings()?.canManage ?? false);
  const canManageRoles = createMemo(() => settings()?.currentUserRole === "owner");

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const response = await teamApi.getSettings();
      setSettings(response.settings);
      setTeamNameInput(response.settings.team.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team settings");
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    void loadSettings();
  });

  async function saveTeamName(event: SubmitEvent) {
    event.preventDefault();
    if (!canManage()) {
      setActionError("Only owners or admins can update team settings.");
      return;
    }

    const nextName = teamNameInput().trim();
    if (!nextName) {
      setActionError("Team name is required.");
      return;
    }

    setSaveTeamLoading(true);
    setActionError("");
    setActionNotice("");
    try {
      const response = await teamApi.updateSettings(nextName);
      setSettings((current) => {
        if (!current) return current;
        return {
          ...current,
          team: response.team,
        };
      });
      setTeamNameInput(response.team.name);
      setActionNotice("Team settings updated.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update team settings");
    } finally {
      setSaveTeamLoading(false);
    }
  }

  async function inviteMembers(event: SubmitEvent) {
    event.preventDefault();
    if (!canManage()) {
      setActionError("Only owners or admins can invite members.");
      return;
    }

    const emails = parseInviteEmails(inviteInput());
    if (emails.length === 0) {
      setActionError("Enter at least one invite email.");
      return;
    }

    setInviteLoading(true);
    setActionError("");
    setActionNotice("");
    try {
      for (const email of emails) {
        // Keep sequential so API validation messages are deterministic per address.
        await teamApi.invite(email);
      }
      setInviteInput("");
      setActionNotice(emails.length === 1 ? "Invitation sent." : `${emails.length} invitations sent.`);
      await loadSettings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  }

  async function changeRole(member: TeamMember, role: "admin" | "member") {
    if (!canManageRoles()) return;

    setRoleSavingByUserID((current) => ({
      ...current,
      [member.userId]: true,
    }));
    setActionError("");
    setActionNotice("");

    try {
      const response = await teamApi.updateMemberRole(member.userId, role);
      setSettings((current) => {
        if (!current) return current;
        return {
          ...current,
          members: current.members.map((item) =>
            item.userId === response.member.userId ? response.member : item,
          ),
        };
      });
      setActionNotice(`${member.name || member.email} is now ${formatRoleLabel(role)}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setRoleSavingByUserID((current) => {
        const next = { ...current };
        delete next[member.userId];
        return next;
      });
    }
  }

  async function removeMember(member: TeamMember) {
    if (!canManageRoles()) return;

    setRemovingUserID(member.userId);
    setActionError("");
    setActionNotice("");
    try {
      await teamApi.removeMember(member.userId);
      setSettings((current) => {
        if (!current) return current;
        return {
          ...current,
          members: current.members.filter((item) => item.userId !== member.userId),
        };
      });
      setActionNotice(`${member.name || member.email} removed from team.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setRemovingUserID(null);
    }
  }

  async function cancelInvitation(invitation: TeamInvitation) {
    if (!canManage()) return;

    setCancelingInviteCode(invitation.invitationCode);
    setActionError("");
    setActionNotice("");
    try {
      await teamApi.cancelInvitation(invitation.invitationCode);
      setSettings((current) => {
        if (!current) return current;
        return {
          ...current,
          invitations: current.invitations.filter((item) => item.invitationCode !== invitation.invitationCode),
        };
      });
      setActionNotice(`Canceled invite for ${invitation.email}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel invitation");
    } finally {
      setCancelingInviteCode(null);
    }
  }

  return (
    <AppShell
      activeView="team"
      mobileSidebar={
        <div class="space-y-3 text-sm text-[#c5d2ea]">
          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Team</p>
            <p class="mt-2 text-sm text-[#e3edff]">{settings()?.team.name || "Team settings"}</p>
            <Show when={settings()}>
              {(current) => (
                <p class="mt-1 text-xs text-[#97a8c8]">Role: {formatRoleLabel(current().currentUserRole)}</p>
              )}
            </Show>
          </section>

          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Members</p>
            <p class="mt-2 text-sm text-[#e3edff]">{settings()?.members.length || 0}</p>
          </section>

          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Pending Invites</p>
            <p class="mt-2 text-sm text-[#e3edff]">{settings()?.invitations.length || 0}</p>
          </section>
        </div>
      }
    >
      <section class="h-full overflow-y-auto px-4 py-4 md:px-6 md:py-6">
        <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <header class="rounded-2xl border border-[#2a3750] bg-[#0f1728] px-5 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Team Settings</p>
            <h1 class="mt-2 text-2xl font-semibold tracking-tight text-[#edf3ff]">
              {settings()?.team.name || "Team"}
            </h1>
            <p class="mt-1 text-sm text-[#9fb0cc]">
              Manage team name, member roles, and invitations for your board workspace.
            </p>
          </header>

          <Show when={loading()}>
            <p class="rounded-xl border border-[#2d3c57] bg-[#0f1728] px-4 py-3 text-sm text-[#b8c8e4]">Loading team settings...</p>
          </Show>

          <Show when={error()}>
            <p class="rounded-xl border border-[#643434] bg-[#2b1618] px-4 py-3 text-sm text-[#ffc0bd]">{error()}</p>
          </Show>

          <Show when={actionError()}>
            <p class="rounded-xl border border-[#643434] bg-[#2b1618] px-4 py-3 text-sm text-[#ffc0bd]">{actionError()}</p>
          </Show>

          <Show when={actionNotice()}>
            <p class="rounded-xl border border-[#355940] bg-[#14241b] px-4 py-3 text-sm text-[#baf2cc]">{actionNotice()}</p>
          </Show>

          <Show when={!loading() && settings()}>
            <>
              <section class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Team Profile</h2>
                  <span class="rounded-md border border-[#3b4f73] bg-[#152238] px-2 py-0.5 text-[11px] text-[#cfe0ff]">
                    {formatRoleLabel(settings()!.currentUserRole)}
                  </span>
                </div>
                <form class="mt-3 flex flex-col gap-3 md:flex-row md:items-end" onSubmit={(event) => void saveTeamName(event)}>
                  <label class="flex-1 text-xs uppercase tracking-[0.12em] text-[#93a3bf]">
                    Team name
                    <input
                      value={teamNameInput()}
                      onInput={(event) => setTeamNameInput(event.currentTarget.value)}
                      class="mt-2 w-full rounded-lg border border-[#3a4d6f] bg-[#0c1524] px-3 py-2 text-sm text-[#e7f0ff] outline-none focus:border-[var(--accent)]"
                      disabled={!canManage() || saveTeamLoading()}
                    />
                  </label>
                  <button
                    type="submit"
                    class="rounded-lg border border-[#3e5680] bg-[#172845] px-4 py-2 text-sm font-semibold text-[#d7e6ff] transition hover:border-[var(--accent)] disabled:opacity-60"
                    disabled={!canManage() || saveTeamLoading()}
                  >
                    {saveTeamLoading() ? "Saving..." : "Save team"}
                  </button>
                </form>
              </section>

              <section class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5">
                <div class="flex items-center justify-between">
                  <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Team Members</h2>
                  <span class="text-xs text-[#9cb0d1]">{settings()!.members.length} member(s)</span>
                </div>

                <div class="mt-3 space-y-2">
                  <For each={settings()!.members}>
                    {(member) => {
                      const isCurrentUser = () => settings()!.currentUserId === member.userId;
                      const canEditMemberRole = () =>
                        canManageRoles() && !isCurrentUser() && member.role !== "owner";
                      const canRemove = () =>
                        canManageRoles() && !isCurrentUser() && member.role !== "owner";

                      return (
                        <article class="rounded-xl border border-[#2c3f61] bg-[#111c30] px-3 py-3">
                          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div class="min-w-0">
                              <p class="truncate text-sm font-medium text-[#e8f0ff]">{member.name || member.email}</p>
                              <p class="truncate text-xs text-[#9fb0cc]">{member.email}</p>
                              <p class="mt-1 text-[11px] text-[#8ca2c6]">Joined {formatDate(member.createdAt)}</p>
                            </div>

                            <div class="flex flex-wrap items-center gap-2">
                              <span class={`rounded-md border px-2 py-0.5 text-[11px] ${roleBadgeClass(member.role)}`}>
                                {formatRoleLabel(member.role)}
                              </span>

                              <Show when={canEditMemberRole()}>
                                <select
                                  value={member.role}
                                  class="rounded-md border border-[#395072] bg-[#0d182b] px-2 py-1 text-xs text-[#e0ebff] outline-none focus:border-[var(--accent)] disabled:opacity-60"
                                  disabled={!!roleSavingByUserID()[member.userId]}
                                  onChange={(event) => {
                                    const role = event.currentTarget.value === "admin" ? "admin" : "member";
                                    void changeRole(member, role);
                                  }}
                                >
                                  <option value="admin">Admin</option>
                                  <option value="member">Member</option>
                                </select>
                              </Show>

                              <Show when={canRemove()}>
                                <button
                                  type="button"
                                  class="rounded-md border border-[#6a3a3a] bg-[#2b1618] px-2 py-1 text-xs text-[#ffb8b5] transition hover:border-[#925151] disabled:opacity-60"
                                  disabled={removingUserID() === member.userId}
                                  onClick={() => void removeMember(member)}
                                >
                                  {removingUserID() === member.userId ? "Removing..." : "Remove"}
                                </button>
                              </Show>

                              <Show when={isCurrentUser()}>
                                <span class="rounded-md border border-[#3a4f74] bg-[#16243b] px-2 py-0.5 text-[11px] text-[#cfe0ff]">
                                  You
                                </span>
                              </Show>
                            </div>
                          </div>
                        </article>
                      );
                    }}
                  </For>
                </div>
              </section>

              <section class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Invitations</h2>
                  <span class="text-xs text-[#9cb0d1]">{settings()!.invitations.length} pending</span>
                </div>

                <form class="mt-3" onSubmit={(event) => void inviteMembers(event)}>
                  <label class="text-xs uppercase tracking-[0.12em] text-[#93a3bf]">
                    Invite by email
                    <textarea
                      rows={3}
                      value={inviteInput()}
                      onInput={(event) => setInviteInput(event.currentTarget.value)}
                      class="mt-2 w-full rounded-lg border border-[#3a4d6f] bg-[#0c1524] px-3 py-2 text-sm text-[#e7f0ff] outline-none focus:border-[var(--accent)]"
                      placeholder="teammate@company.com"
                      disabled={!canManage() || inviteLoading()}
                    />
                  </label>
                  <p class="mt-1 text-xs text-[#8ea3c7]">Use commas or new lines for multiple invite emails.</p>
                  <button
                    type="submit"
                    class="mt-3 rounded-lg border border-[#3e5680] bg-[#172845] px-4 py-2 text-sm font-semibold text-[#d7e6ff] transition hover:border-[var(--accent)] disabled:opacity-60"
                    disabled={!canManage() || inviteLoading()}
                  >
                    {inviteLoading() ? "Sending..." : "Send invite"}
                  </button>
                </form>

                <div class="mt-4 space-y-2">
                  <Show
                    when={settings()!.invitations.length > 0}
                    fallback={<p class="rounded-lg border border-[#2c3f61] bg-[#111c30] px-3 py-2 text-sm text-[#9fb0cc]">No pending invitations.</p>}
                  >
                    <For each={settings()!.invitations}>
                      {(invitation) => (
                        <article class="flex flex-col gap-2 rounded-lg border border-[#2c3f61] bg-[#111c30] px-3 py-2 md:flex-row md:items-center md:justify-between">
                          <div class="min-w-0">
                            <p class="truncate text-sm text-[#e8f0ff]">{invitation.email}</p>
                            <p class="text-[11px] text-[#8ca2c6]">Invited {formatDate(invitation.createdAt)}</p>
                          </div>

                          <div class="flex flex-wrap items-center gap-2">
                            <span class="rounded-md border border-[#3a4f74] bg-[#16243b] px-2 py-0.5 text-[11px] text-[#cfe0ff]">
                              {invitation.status}
                            </span>
                            <Show when={canManage()}>
                              <button
                                type="button"
                                class="rounded-md border border-[#6a3a3a] bg-[#2b1618] px-2 py-1 text-xs text-[#ffb8b5] transition hover:border-[#925151] disabled:opacity-60"
                                disabled={cancelingInviteCode() === invitation.invitationCode}
                                onClick={() => void cancelInvitation(invitation)}
                              >
                                {cancelingInviteCode() === invitation.invitationCode ? "Canceling..." : "Cancel"}
                              </button>
                            </Show>
                          </div>
                        </article>
                      )}
                    </For>
                  </Show>
                </div>
              </section>
            </>
          </Show>
        </div>
      </section>
    </AppShell>
  );
}
