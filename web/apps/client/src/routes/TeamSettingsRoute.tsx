import { For, Show, createEffect, createMemo, createSignal, onMount } from "solid-js";

import { hasEntitlement, workspacePlanLabel, workspacePlanProfile } from "../../../../shared/pricing/catalog";
import AppShell from "../components/AppShell";
import { useApi } from "../context/ApiContext";
import { useToast } from "../context/ToastContext";
import { type TeamInvitation, type TeamMember, type TeamSettings } from "../server/api";

function parseInviteEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

function formatRoleLabel(role: string): string {
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
    case "editor":
    case "member":
      return "border-[#53724e] bg-[#1c3720] text-[#d7f2d2]";
    case "reader":
      return "border-[#5a5572] bg-[#272145] text-[#e2dcff]";
    default:
      return "border-[#3b4f73] bg-[#152238] text-[#cfe0ff]";
  }
}

export default function TeamSettingsRoute() {
  const api = useApi();
  const toast = useToast();
  const [settings, setSettings] = createSignal<TeamSettings | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");

  const [teamNameInput, setTeamNameInput] = createSignal("");
  const [saveTeamLoading, setSaveTeamLoading] = createSignal(false);

  const [inviteInput, setInviteInput] = createSignal("");
  const [inviteRole, setInviteRole] = createSignal<"admin" | "editor" | "reader">("editor");
  const [inviteLoading, setInviteLoading] = createSignal(false);

  const [roleSavingByUserID, setRoleSavingByUserID] = createSignal<Record<string, boolean>>({});
  const [removingUserID, setRemovingUserID] = createSignal<string | null>(null);
  const [cancelingInviteCode, setCancelingInviteCode] = createSignal<string | null>(null);
  const [billingLoading, setBillingLoading] = createSignal(false);

  const [actionError, setActionError] = createSignal("");
  const [actionNotice, setActionNotice] = createSignal("");

  createEffect(() => {
    const message = actionError().trim();
    if (!message) return;
    toast.error(message);
  });

  createEffect(() => {
    const message = actionNotice().trim();
    if (!message) return;
    toast.success(message);
  });

  const canManage = createMemo(() => settings()?.canManage ?? false);
  const currentRole = createMemo(() => settings()?.currentUserRole ?? "reader");
  const team = createMemo(() => settings()?.team ?? null);
  const teamPricing = createMemo(() => workspacePlanProfile(team()?.plan || "personal"));
  const teamEntitlements = createMemo(() => {
    const explicit = team()?.entitlements ?? [];
    return explicit.length > 0 ? explicit : teamPricing().entitlements;
  });
  const currentPlan = createMemo(() => workspacePlanLabel(team()?.plan || "personal"));
  const canManageTeamProfile = createMemo(() => canManage() && hasEntitlement(teamEntitlements(), "team_admin"));
  const canManageInvites = createMemo(() => canManage() && hasEntitlement(teamEntitlements(), "workspace_invites"));
  const canManageRoles = createMemo(
    () => settings()?.currentUserRole === "owner" && hasEntitlement(teamEntitlements(), "team_roles"),
  );
  const teamAdminFrozen = createMemo(() => canManage() && !hasEntitlement(teamEntitlements(), "team_admin"));

  const roleSummary = createMemo(() => {
    const role = currentRole();
    if (role === "owner") {
      return "Owner access: full control over billing plus workspace roles when the current plan allows team administration.";
    }
    if (role === "admin") {
      return "Admin access: manage team profile, billing, and invitations when team administration is enabled. Role changes stay owner-only.";
    }
    if (role === "editor") {
      return "Editor access: collaborate on invited team boards and modify board/task content.";
    }
    return "Reader access: view invited team boards with limited editing controls.";
  });

  const planSummary = createMemo(() => {
    const activeTeam = team();
    if (!activeTeam) return "";
    const family = activeTeam.planFamily || teamPricing().planFamily;
    if (family === "enterprise") {
      return "Enterprise workspace: Pro product access plus sales-led rollout, security review support, and procurement help.";
    }
    if (family === "pro") {
      return "Pro workspace: shared boards, invitations, roles, and board member management are enabled.";
    }
    return "Free workspace: core task and board workflow stay available, but team admin actions are frozen until the workspace returns to Pro.";
  });

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const response = await api.team.getSettings();
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
    if (!canManageTeamProfile()) {
      setActionError("Team profile changes are unavailable on Free. Upgrade this workspace to Pro to continue.");
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
      const response = await api.team.updateSettings(nextName);
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
    if (!canManageInvites()) {
      setActionError("Inviting members is unavailable on Free. Upgrade this workspace to Pro to continue.");
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
        await api.team.invite(email, inviteRole());
      }
      setInviteInput("");
      setActionNotice(
        emails.length === 1
          ? `Invitation sent as ${formatRoleLabel(inviteRole())}.`
          : `${emails.length} invitations sent as ${formatRoleLabel(inviteRole())}.`,
      );
      await loadSettings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  }

  async function changeRole(member: TeamMember, role: "admin" | "editor" | "reader") {
    if (!canManageRoles()) {
      setActionError("Role changes are unavailable on the current plan or role.");
      return;
    }

    setRoleSavingByUserID((current) => ({
      ...current,
      [member.userId]: true,
    }));
    setActionError("");
    setActionNotice("");

    try {
      const response = await api.team.updateMemberRole(member.userId, role);
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
    if (!canManageRoles()) {
      setActionError("Member removal is unavailable on the current plan or role.");
      return;
    }

    setRemovingUserID(member.userId);
    setActionError("");
    setActionNotice("");
    try {
      await api.team.removeMember(member.userId);
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
    if (!canManageInvites()) {
      setActionError("Invitation cancellation is unavailable on Free. Upgrade this workspace to Pro to continue.");
      return;
    }

    setCancelingInviteCode(invitation.invitationCode);
    setActionError("");
    setActionNotice("");
    try {
      await api.team.cancelInvitation(invitation.invitationCode);
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

  async function startBilling(plan: "pro_trial" | "pro" | "enterprise") {
    setBillingLoading(true);
    setActionError("");
    setActionNotice("");
    try {
      const response = await api.billing.checkout(plan);
      if (response.mode === "contact_sales" && response.contactUrl) {
        window.location.href = response.contactUrl;
        return;
      }
      if (response.mode === "stripe_checkout" && response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }
      if (response.mode === "trial_started" && response.team) {
        setSettings((current) => (current ? { ...current, team: response.team! } : current));
        setActionNotice("Pro trial activated. Your team now has pro access for 14 days.");
      } else {
        await loadSettings();
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start billing flow");
    } finally {
      setBillingLoading(false);
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
          <header class="rounded-2xl border border-[#2a3750] bg-[#0f1728] px-5 py-4 text-center">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Donegeon Command Settings</p>
            <h1 class="mt-2 text-2xl font-semibold tracking-tight text-[#edf3ff]">
              {settings()?.team.name || "Team"} Command Ledger
            </h1>
            <p class="mt-1 text-sm text-[#9fb0cc]">
              Every account starts on Free. Team powers unlock by board membership and role.
            </p>
            <div class="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
              <a href="#plan" class="rounded-md border border-[#3b4f73] bg-[#16263f] px-2 py-1 text-[#d6e5ff]">Plan & Billing</a>
              <a href="#team-profile" class="rounded-md border border-[#3b4f73] bg-[#16263f] px-2 py-1 text-[#d6e5ff]">Team Profile</a>
              <a href="#team-members" class="rounded-md border border-[#3b4f73] bg-[#16263f] px-2 py-1 text-[#d6e5ff]">Members & Invites</a>
            </div>
          </header>

          <Show when={!loading() && settings()}>
            <section class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Access & Entitlements</h2>
                <span class="rounded-md border border-[#3b4f73] bg-[#152238] px-2 py-0.5 text-[11px] text-[#cfe0ff]">
                  {currentPlan()} / {formatRoleLabel(currentRole())}
                </span>
              </div>

              <div class="mt-3 grid gap-3 md:grid-cols-3">
                <article class="rounded-xl border border-[#334b70] bg-[#132238] p-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#b9d6ff]">Personal Board</p>
                  <p class="mt-1 text-sm font-medium text-[#edf4ff]">Free by default</p>
                  <p class="mt-2 text-xs text-[#9fb0cc]">
                    Every user starts on Free for their personal Donegeon board after login.
                  </p>
                </article>

                <article class="rounded-xl border border-[#47658f] bg-[#152742] p-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#cddfff]">Active Team Workspace</p>
                  <p class="mt-1 text-sm font-medium text-[#edf4ff]">{settings()!.team.name}</p>
                  <p class="mt-2 text-xs text-[#aebfd8]">{roleSummary()}</p>
                </article>

                <article class="rounded-xl border border-[#49607f] bg-[#142133] p-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d3e1f8]">Plan Scope</p>
                  <p class="mt-1 text-sm font-medium text-[#edf4ff]">{currentPlan()}</p>
                  <p class="mt-2 text-xs text-[#aebfd8]">{planSummary()}</p>
                </article>
              </div>

              <div class="mt-3 rounded-lg border border-[#2f4568] bg-[#101c2e] px-3 py-2 text-xs text-[#bcd0ef]">
                Team board access is role-based per workspace. Billing and team-admin actions are limited to owner/admin accounts.
              </div>
              <Show when={teamAdminFrozen()}>
                <p class="mt-3 rounded-lg border border-[#7c6042] bg-[#2d2016] px-3 py-2 text-xs text-[#ffd5af]">
                  This workspace is on Free. Existing members and boards stay accessible, but invitations, role changes, board-member management, and other team admin actions are frozen until you return to Pro.
                </p>
              </Show>
            </section>
          </Show>

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
              <section id="plan" class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Billing</h2>
                  <span class="rounded-md border border-[#3b4f73] bg-[#152238] px-2 py-0.5 text-[11px] text-[#cfe0ff]">
                    {currentPlan()}
                  </span>
                </div>
                <p class="mt-2 text-xs text-[#9fb0cc]">
                  Personal boards default to Free. This page controls plan upgrades for the active team workspace.
                </p>
                <Show when={settings()!.team.trialEndsAt}>
                  {(trialEndsAt) => (
                    <p class="mt-2 text-xs text-[#9fb0cc]">
                      Trial ends on {formatDate(trialEndsAt())}
                    </p>
                  )}
                </Show>
                <div class="mt-4 grid gap-3 md:grid-cols-3">
                  <article class="rounded-xl border border-[#334b70] bg-[#132238] p-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#b9d6ff]">Free</p>
                    <p class="mt-1 text-xl font-semibold text-[#edf4ff]">$0</p>
                    <p class="mt-2 text-xs text-[#9fb0cc]">Core task workflow, personal board gameplay, and calendar sync.</p>
                    <button
                      type="button"
                      class="mt-3 w-full rounded-lg border border-[#3f5a83] bg-[#1a2b46] px-3 py-1.5 text-xs font-semibold text-[#d8e7ff] opacity-80"
                      disabled
                    >
                      Current baseline
                    </button>
                  </article>

                  <article class="rounded-xl border border-[#546fa1] bg-[#172947] p-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#d7e5ff]">Pro</p>
                    <p class="mt-1 text-xl font-semibold text-[#edf4ff]">$12/user/mo</p>
                    <p class="mt-2 text-xs text-[#b3c4df]">Shared boards, invitations, role controls, and board member management.</p>
                    <div class="mt-3 flex gap-2">
                      <button
                        type="button"
                        class="flex-1 rounded-lg border border-[#5f7eb5] bg-[#20385f] px-2 py-1.5 text-xs font-semibold text-[#e2eeff] transition hover:border-[var(--accent)] disabled:opacity-60"
                        disabled={billingLoading() || !canManage()}
                        onClick={() => void startBilling("pro_trial")}
                      >
                        14-day trial
                      </button>
                      <button
                        type="button"
                        class="flex-1 rounded-lg border border-[#5f7eb5] bg-[#20385f] px-2 py-1.5 text-xs font-semibold text-[#e2eeff] transition hover:border-[var(--accent)] disabled:opacity-60"
                        disabled={billingLoading() || !canManage()}
                        onClick={() => void startBilling("pro")}
                      >
                        Upgrade
                      </button>
                    </div>
                  </article>

                  <article class="rounded-xl border border-[#49607f] bg-[#142133] p-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#d3e1f8]">Enterprise</p>
                    <p class="mt-1 text-xl font-semibold text-[#edf4ff]">Custom</p>
                    <p class="mt-2 text-xs text-[#aebfd8]">Pro product access with sales-led rollout, security review, and procurement support.</p>
                    <button
                      type="button"
                      class="mt-3 w-full rounded-lg border border-[#566f93] bg-[#1b2d47] px-3 py-1.5 text-xs font-semibold text-[#d8e7ff] transition hover:border-[#6f88a8] disabled:opacity-60"
                      disabled={billingLoading() || !canManage()}
                      onClick={() => void startBilling("enterprise")}
                    >
                      Talk to Sales
                    </button>
                  </article>
                </div>
                <Show when={!canManage()}>
                  <p class="mt-3 text-xs text-[#9fb0cc]">
                    You can use team features on boards you were invited to. Only owners/admins can change team billing.
                  </p>
                </Show>
              </section>

              <section id="team-profile" class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5">
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
                      disabled={!canManageTeamProfile() || saveTeamLoading()}
                    />
                  </label>
                  <button
                    type="submit"
                    class="rounded-lg border border-[#3e5680] bg-[#172845] px-4 py-2 text-sm font-semibold text-[#d7e6ff] transition hover:border-[var(--accent)] disabled:opacity-60"
                    disabled={!canManageTeamProfile() || saveTeamLoading()}
                  >
                    {saveTeamLoading() ? "Saving..." : "Save team"}
                  </button>
                </form>
                <Show when={canManage() && !canManageTeamProfile()}>
                  <p class="mt-3 text-xs text-[#ffd5af]">
                    Team profile changes are frozen on Free. Upgrade to Pro to rename or manage this shared workspace.
                  </p>
                </Show>
              </section>

              <section id="team-members" class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5">
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
                                    const nextRole = event.currentTarget.value;
                                    const role =
                                      nextRole === "admin" || nextRole === "editor" || nextRole === "reader"
                                        ? nextRole
                                        : "editor";
                                    void changeRole(member, role);
                                  }}
                                >
                                  <option value="admin">Admin</option>
                                  <option value="editor">Editor</option>
                                  <option value="reader">Reader</option>
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
                <Show when={settings()!.currentUserRole === "owner" && !canManageRoles()}>
                  <p class="mt-3 text-xs text-[#ffd5af]">
                    Role changes and member removal are frozen on Free. Upgrade to Pro to manage team membership again.
                  </p>
                </Show>
              </section>

              <section class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Invitations</h2>
                  <span class="text-xs text-[#9cb0d1]">{settings()!.invitations.length} pending</span>
                </div>

                <form class="mt-3" onSubmit={(event) => void inviteMembers(event)}>
                  <label class="text-xs uppercase tracking-[0.12em] text-[#93a3bf]">
                    Invite role
                    <select
                      value={inviteRole()}
                      onChange={(event) => {
                        const nextRole = event.currentTarget.value;
                        setInviteRole(nextRole === "admin" || nextRole === "reader" ? nextRole : "editor");
                      }}
                      class="mt-2 w-full rounded-lg border border-[#3a4d6f] bg-[#0c1524] px-3 py-2 text-sm text-[#e7f0ff] outline-none focus:border-[var(--accent)]"
                      disabled={!canManageInvites() || inviteLoading()}
                    >
                      <option value="editor">Editor</option>
                      <option value="reader">Reader</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <label class="text-xs uppercase tracking-[0.12em] text-[#93a3bf]">
                    Invite by email
                    <textarea
                      rows={3}
                      value={inviteInput()}
                      onInput={(event) => setInviteInput(event.currentTarget.value)}
                      class="mt-2 w-full rounded-lg border border-[#3a4d6f] bg-[#0c1524] px-3 py-2 text-sm text-[#e7f0ff] outline-none focus:border-[var(--accent)]"
                      placeholder="teammate@company.com"
                      disabled={!canManageInvites() || inviteLoading()}
                    />
                  </label>
                  <p class="mt-1 text-xs text-[#8ea3c7]">Use commas or new lines for multiple invite emails.</p>
                  <button
                    type="submit"
                    class="mt-3 rounded-lg border border-[#3e5680] bg-[#172845] px-4 py-2 text-sm font-semibold text-[#d7e6ff] transition hover:border-[var(--accent)] disabled:opacity-60"
                    disabled={!canManageInvites() || inviteLoading()}
                  >
                    {inviteLoading() ? "Sending..." : "Send invite"}
                  </button>
                </form>
                <Show when={canManage() && !canManageInvites()}>
                  <p class="mt-3 text-xs text-[#ffd5af]">
                    Invitations are frozen on Free. Existing members keep access, but new invites require Pro.
                  </p>
                </Show>

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
                            <span class={`rounded-md border px-2 py-0.5 text-[11px] ${roleBadgeClass(invitation.role)}`}>
                              {formatRoleLabel(invitation.role)}
                            </span>
                            <span class="rounded-md border border-[#3a4f74] bg-[#16243b] px-2 py-0.5 text-[11px] text-[#cfe0ff]">
                              {invitation.status}
                            </span>
                            <Show when={canManageInvites()}>
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
