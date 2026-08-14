import { For, Show, createMemo, createSignal, createTrackedEffect, onSettled } from "solid-js";

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

  createTrackedEffect(() => {
    const message = actionError().trim();
    if (!message) return;
    toast.error(message);
  });

  createTrackedEffect(() => {
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
  const currentPlanFamily = createMemo(() => team()?.planFamily || teamPricing().planFamily);
  const currentBillingState = createMemo(() => team()?.billingState || teamPricing().billingState);
  const currentPlanBadge = createMemo(() => {
    if (currentPlanFamily() === "pro" && currentBillingState() === "trial") {
      return "Pro trial";
    }
    return currentPlan();
  });
  const canManageTeamProfile = createMemo(() => canManage() && hasEntitlement(teamEntitlements(), "team_admin"));
  const canManageInvites = createMemo(() => canManage() && hasEntitlement(teamEntitlements(), "workspace_invites"));
  const canManageRoles = createMemo(
    () => settings()?.currentUserRole === "owner" && hasEntitlement(teamEntitlements(), "team_roles"),
  );
  const teamAdminFrozen = createMemo(() => canManage() && !hasEntitlement(teamEntitlements(), "team_admin"));
  const billingSummary = createMemo(() => {
    if (currentPlanFamily() === "enterprise") {
      return "Enterprise keeps the Pro product set active and routes rollout, invoicing, and procurement through sales.";
    }
    if (currentPlanFamily() === "pro" && currentBillingState() === "trial") {
      return "This workspace is already on a Pro trial. Start a paid subscription to keep team powers active, or end the trial now to return to Free.";
    }
    if (currentPlanFamily() === "pro") {
      return "This workspace is already on paid Pro. Shared boards, invitations, roles, and board member management are active. Use Stripe billing to cancel or update payment details.";
    }
    return "Personal boards stay on Free by default. Upgrade this shared workspace when you need team administration controls.";
  });
  const freeCardLabel = createMemo(() => {
    if (currentPlanFamily() === "free") return "Current plan";
    return "Available after cancellation";
  });
  const hasPaidSubscription = createMemo(
    () => currentPlanFamily() === "pro" && currentBillingState() === "paid" && !!team()?.stripeSubscriptionId,
  );

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

  onSettled(() => {
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

  async function openBillingPortal() {
    setBillingLoading(true);
    setActionError("");
    setActionNotice("");
    try {
      const response = await api.billing.portal();
      if (!response.url) {
        throw new Error("Stripe billing portal did not return a URL.");
      }
      window.location.href = response.url;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to open billing portal");
    } finally {
      setBillingLoading(false);
    }
  }

  async function endTrial() {
    setBillingLoading(true);
    setActionError("");
    setActionNotice("");
    try {
      await api.billing.endTrial();
      await loadSettings();
      setActionNotice("Pro trial ended. The workspace is back on Free.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to end Pro trial");
    } finally {
      setBillingLoading(false);
    }
  }

  const mobileSidebarSectionClass = "app-panel rounded-2xl px-3 py-3";
  const heroClass = "app-panel-strong rounded-[30px] px-5 py-5 text-center md:px-8 md:py-6";
  const sectionClass = "app-panel rounded-[28px] p-5";
  const subCardClass = "app-panel-soft rounded-2xl p-4";
  const highlightCardClass =
    "rounded-2xl border border-[rgba(255,139,80,0.24)] bg-[var(--accent-wash)] p-4 shadow-[var(--shadow-elevated)]";
  const badgeClass =
    "rounded-full border border-[rgba(255,139,80,0.24)] bg-[var(--accent-wash)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-text)]";
  const chipClass =
    "rounded-full border border-[var(--border-strong)] bg-[var(--panel-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-soft)]";
  const inputClass = "app-input-surface mt-2 w-full rounded-xl px-3 py-2 text-sm";
  const primaryButtonClass =
    "app-button-primary rounded-xl border border-[rgba(255,139,80,0.3)] px-4 py-2 text-sm font-semibold transition disabled:opacity-60";
  const secondaryButtonClass =
    "app-button-secondary rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60";
  const secondaryButtonSmallClass =
    "app-button-secondary rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60";
  const dangerButtonClass =
    "rounded-lg border border-[rgba(196,98,91,0.28)] bg-[var(--danger-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] transition hover:border-[rgba(196,98,91,0.42)] disabled:opacity-60";
  const infoBannerClass =
    "rounded-xl border border-[var(--border-strong)] bg-[var(--panel-soft)] px-4 py-3 text-sm text-[var(--text-soft)]";
  const warningBannerClass =
    "rounded-xl border border-[rgba(223,173,87,0.24)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]";
  const errorBannerClass =
    "rounded-xl border border-[rgba(196,98,91,0.3)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]";
  const successBannerClass =
    "rounded-xl border border-[rgba(49,122,86,0.26)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]";
  const sectionHeadingClass = "text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]";

  return (
    <AppShell
      activeView="team"
      mobileSidebar={
        <div class="space-y-3 text-sm text-[var(--text-soft)]">
          <section class={mobileSidebarSectionClass}>
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Team</p>
            <p class="mt-2 text-sm font-semibold text-[var(--text-main)]">{settings()?.team.name || "Team settings"}</p>
            <Show when={settings()}>
              {(current) => (
                <p class="mt-1 text-xs text-[var(--text-soft)]">Role: {formatRoleLabel(current().currentUserRole)}</p>
              )}
            </Show>
          </section>

          <section class={mobileSidebarSectionClass}>
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Members</p>
            <p class="mt-2 text-sm font-semibold text-[var(--text-main)]">{settings()?.members.length || 0}</p>
          </section>

          <section class={mobileSidebarSectionClass}>
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Pending Invites</p>
            <p class="mt-2 text-sm font-semibold text-[var(--text-main)]">{settings()?.invitations.length || 0}</p>
          </section>
        </div>
      }
    >
      <section class="h-full overflow-y-auto px-4 py-4 md:px-6 md:py-6">
        <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <header class={heroClass}>
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Donegeon Command Settings</p>
            <h1 class="font-display mt-2 text-2xl font-semibold tracking-tight text-[var(--text-main)] md:text-4xl">
              {settings()?.team.name || "Team"} Command Ledger
            </h1>
            <p class="mx-auto mt-2 max-w-2xl text-sm text-[var(--text-soft)]">
              Every account starts on Free. Team powers unlock by board membership and role.
            </p>
            <div class="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
              <a href="#plan" class={secondaryButtonSmallClass}>Plan & Billing</a>
              <a href="#team-profile" class={secondaryButtonSmallClass}>Team Profile</a>
              <a href="#team-members" class={secondaryButtonSmallClass}>Members & Invites</a>
            </div>
          </header>

          <Show when={!loading() && settings()}>
            <section class={sectionClass}>
              <div class="flex items-center justify-between gap-3">
                <h2 class={sectionHeadingClass}>Access & Entitlements</h2>
                <span class={badgeClass}>
                  {currentPlanBadge()} / {formatRoleLabel(currentRole())}
                </span>
              </div>

              <div class="mt-3 grid gap-3 md:grid-cols-3">
                <article class={subCardClass}>
                  <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]">Personal Board</p>
                  <p class="mt-1 text-sm font-medium text-[var(--text-main)]">Free by default</p>
                  <p class="mt-2 text-xs text-[var(--text-soft)]">
                    Every user starts on Free for their personal Donegeon board after login.
                  </p>
                </article>

                <article class={highlightCardClass}>
                  <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-text)]">Active Team Workspace</p>
                  <p class="mt-1 text-sm font-medium text-[var(--text-main)]">{settings()!.team.name}</p>
                  <p class="mt-2 text-xs text-[var(--text-soft)]">{roleSummary()}</p>
                </article>

                <article class={subCardClass}>
                  <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]">Plan Scope</p>
                  <p class="mt-1 text-sm font-medium text-[var(--text-main)]">{currentPlan()}</p>
                  <p class="mt-2 text-xs text-[var(--text-soft)]">{planSummary()}</p>
                </article>
              </div>

              <div class={`mt-3 ${infoBannerClass}`}>
                Team board access is role-based per workspace. Billing and team-admin actions are limited to owner/admin accounts.
              </div>
              <Show when={teamAdminFrozen()}>
                <p class={`mt-3 ${warningBannerClass}`}>
                  This workspace is on Free. Existing members and boards stay accessible, but invitations, role changes, board-member management, and other team admin actions are frozen until you return to Pro.
                </p>
              </Show>
            </section>
          </Show>

          <Show when={loading()}>
            <p class={infoBannerClass}>Loading team settings...</p>
          </Show>

          <Show when={error()}>
            <p class={errorBannerClass}>{error()}</p>
          </Show>

          <Show when={actionError()}>
            <p class={errorBannerClass}>{actionError()}</p>
          </Show>

          <Show when={actionNotice()}>
            <p class={successBannerClass}>{actionNotice()}</p>
          </Show>

          <Show when={!loading() && settings()}>
            <>
              <section id="plan" class={sectionClass}>
                <div class="flex items-center justify-between gap-3">
                  <h2 class={sectionHeadingClass}>Billing</h2>
                  <span class={badgeClass}>
                    {currentPlanBadge()}
                  </span>
                </div>
                <p class="mt-2 text-sm text-[var(--text-soft)]">
                  {billingSummary()}
                </p>
                <Show when={currentBillingState() === "trial" && settings()!.team.trialEndsAt}>
                  {(trialEndsAt) => (
                    <p class="mt-2 text-sm text-[var(--text-soft)]">
                      Trial ends on {formatDate(trialEndsAt())}
                    </p>
                  )}
                </Show>
                <div class="mt-4 grid gap-3 md:grid-cols-3">
                  <article class={subCardClass}>
                    <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]">Free</p>
                    <p class="mt-1 text-xl font-semibold text-[var(--text-main)]">$0</p>
                    <p class="mt-2 text-sm text-[var(--text-soft)]">Core task workflow, personal board gameplay, and calendar sync.</p>
                    <button
                      type="button"
                      class={`mt-3 w-full ${secondaryButtonClass} opacity-80`}
                      disabled
                    >
                      {freeCardLabel()}
                    </button>
                  </article>

                  <article class={highlightCardClass}>
                    <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent-text)]">Pro</p>
                    <p class="mt-1 text-xl font-semibold text-[var(--text-main)]">$12/user/mo</p>
                    <p class="mt-2 text-sm text-[var(--text-soft)]">Shared boards, invitations, role controls, and board member management.</p>
                    <Show
                      when={currentPlanFamily() === "pro" && currentBillingState() === "trial"}
                      fallback={
                        <Show
                          when={currentPlanFamily() === "pro" && currentBillingState() === "paid"}
                          fallback={
                            <Show
                              when={currentPlanFamily() === "enterprise"}
                              fallback={
                                <div class="mt-3 flex gap-2">
                                  <button
                                    type="button"
                                    class={`flex-1 ${primaryButtonClass}`}
                                    disabled={billingLoading() || !canManage()}
                                    onClick={() => void startBilling("pro_trial")}
                                  >
                                    Start 14-day trial
                                  </button>
                                  <button
                                    type="button"
                                    class={`flex-1 ${secondaryButtonClass}`}
                                    disabled={billingLoading() || !canManage()}
                                    onClick={() => void startBilling("pro")}
                                  >
                                    Upgrade
                                  </button>
                                </div>
                              }
                            >
                              <button
                                type="button"
                                class={`mt-3 w-full ${secondaryButtonClass} opacity-80`}
                                disabled
                              >
                                Included in Enterprise
                              </button>
                            </Show>
                          }
                        >
                          <div class="mt-3 flex gap-2">
                            <button
                              type="button"
                              class={`flex-1 ${secondaryButtonClass}`}
                              disabled={billingLoading() || !canManage() || !hasPaidSubscription()}
                              onClick={() => void openBillingPortal()}
                            >
                              Manage billing
                            </button>
                            <button
                              type="button"
                              class={`flex-1 ${secondaryButtonClass} opacity-80`}
                              disabled
                            >
                              Current plan
                            </button>
                          </div>
                        </Show>
                      }
                    >
                      <div class="mt-3 flex gap-2">
                        <button
                          type="button"
                          class={`flex-1 ${secondaryButtonClass}`}
                          disabled={billingLoading() || !canManage()}
                          onClick={() => void endTrial()}
                        >
                          End trial
                        </button>
                        <button
                          type="button"
                          class={`flex-1 ${primaryButtonClass}`}
                          disabled={billingLoading() || !canManage()}
                          onClick={() => void startBilling("pro")}
                        >
                          Start paid plan
                        </button>
                      </div>
                    </Show>
                  </article>

                  <article class={subCardClass}>
                    <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]">Enterprise</p>
                    <p class="mt-1 text-xl font-semibold text-[var(--text-main)]">Custom</p>
                    <p class="mt-2 text-sm text-[var(--text-soft)]">Pro product access with sales-led rollout, security review, and procurement support.</p>
                    <button
                      type="button"
                      class={`mt-3 w-full ${secondaryButtonClass}`}
                      disabled={currentPlanFamily() === "enterprise" || billingLoading() || !canManage()}
                      onClick={() => void startBilling("enterprise")}
                    >
                      {currentPlanFamily() === "enterprise" ? "Current plan" : "Talk to Sales"}
                    </button>
                  </article>
                </div>
                <Show when={currentPlanFamily() !== "free"}>
                  <p class="mt-3 text-sm text-[var(--text-soft)]">
                    Free remains the fallback after cancellation. Existing boards and members stay in place, but new invites and other team-admin actions freeze until the workspace returns to Pro.
                  </p>
                </Show>
                <Show when={currentPlanFamily() === "pro" && currentBillingState() === "paid"}>
                  <p class="mt-2 text-sm text-[var(--text-soft)]">
                    Manage billing opens Stripe so owners/admins can cancel at period end, update payment details, or review invoices.
                  </p>
                </Show>
                <Show when={!canManage()}>
                  <p class="mt-3 text-sm text-[var(--text-soft)]">
                    You can use team features on boards you were invited to. Only owners/admins can change team billing.
                  </p>
                </Show>
              </section>

              <section id="team-profile" class={sectionClass}>
                <div class="flex items-center justify-between gap-3">
                  <h2 class={sectionHeadingClass}>Team Profile</h2>
                  <span class={chipClass}>
                    {formatRoleLabel(settings()!.currentUserRole)}
                  </span>
                </div>
                <form class="mt-3 flex flex-col gap-3 md:flex-row md:items-end" onSubmit={(event) => void saveTeamName(event)}>
                  <label class="flex-1 text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    Team name
                    <input
                      value={teamNameInput()}
                      onInput={(event) => setTeamNameInput(event.currentTarget.value)}
                      class={inputClass}
                      disabled={!canManageTeamProfile() || saveTeamLoading()}
                    />
                  </label>
                  <button
                    type="submit"
                    class={primaryButtonClass}
                    disabled={!canManageTeamProfile() || saveTeamLoading()}
                  >
                    {saveTeamLoading() ? "Saving..." : "Save team"}
                  </button>
                </form>
                <Show when={canManage() && !canManageTeamProfile()}>
                  <p class={`mt-3 ${warningBannerClass}`}>
                    Team profile changes are frozen on Free. Upgrade to Pro to rename or manage this shared workspace.
                  </p>
                </Show>
              </section>

              <section id="team-members" class={sectionClass}>
                <div class="flex items-center justify-between">
                  <h2 class={sectionHeadingClass}>Team Members</h2>
                  <span class="text-xs text-[var(--text-soft)]">{settings()!.members.length} member(s)</span>
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
                        <article class={subCardClass}>
                          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div class="min-w-0">
                              <p class="truncate text-sm font-medium text-[var(--text-main)]">{member.name || member.email}</p>
                              <p class="truncate text-xs text-[var(--text-soft)]">{member.email}</p>
                              <p class="mt-1 text-[11px] text-[var(--text-dim)]">Joined {formatDate(member.createdAt)}</p>
                            </div>

                            <div class="flex flex-wrap items-center gap-2">
                              <span class={`rounded-md border px-2 py-0.5 text-[11px] ${roleBadgeClass(member.role)}`}>
                                {formatRoleLabel(member.role)}
                              </span>

                              <Show when={canEditMemberRole()}>
                                <select
                                  value={member.role}
                                  class="app-input-surface rounded-lg px-2 py-1 text-xs disabled:opacity-60"
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
                                  class={dangerButtonClass}
                                  disabled={removingUserID() === member.userId}
                                  onClick={() => void removeMember(member)}
                                >
                                  {removingUserID() === member.userId ? "Removing..." : "Remove"}
                                </button>
                              </Show>

                              <Show when={isCurrentUser()}>
                                <span class={chipClass}>
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
                  <p class={`mt-3 ${warningBannerClass}`}>
                    Role changes and member removal are frozen on Free. Upgrade to Pro to manage team membership again.
                  </p>
                </Show>
              </section>

              <section class={sectionClass}>
                <div class="flex items-center justify-between gap-3">
                  <h2 class={sectionHeadingClass}>Invitations</h2>
                  <span class="text-xs text-[var(--text-soft)]">{settings()!.invitations.length} pending</span>
                </div>

                <form class="mt-3" onSubmit={(event) => void inviteMembers(event)}>
                  <label class="block text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    Invite role
                    <select
                      value={inviteRole()}
                      onChange={(event) => {
                        const nextRole = event.currentTarget.value;
                        setInviteRole(nextRole === "admin" || nextRole === "reader" ? nextRole : "editor");
                      }}
                      class={inputClass}
                      disabled={!canManageInvites() || inviteLoading()}
                    >
                      <option value="editor">Editor</option>
                      <option value="reader">Reader</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <label class="mt-3 block text-xs uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    Invite by email
                    <textarea
                      rows={3}
                      value={inviteInput()}
                      onInput={(event) => setInviteInput(event.currentTarget.value)}
                      class={inputClass}
                      placeholder="teammate@company.com"
                      disabled={!canManageInvites() || inviteLoading()}
                    />
                  </label>
                  <p class="mt-2 text-xs text-[var(--text-dim)]">Use commas or new lines for multiple invite emails.</p>
                  <button
                    type="submit"
                    class={`mt-3 ${primaryButtonClass}`}
                    disabled={!canManageInvites() || inviteLoading()}
                  >
                    {inviteLoading() ? "Sending..." : "Send invite"}
                  </button>
                </form>
                <Show when={canManage() && !canManageInvites()}>
                  <p class={`mt-3 ${warningBannerClass}`}>
                    Invitations are frozen on Free. Existing members keep access, but new invites require Pro.
                  </p>
                </Show>

                <div class="mt-4 space-y-2">
                  <Show
                    when={settings()!.invitations.length > 0}
                    fallback={<p class={infoBannerClass}>No pending invitations.</p>}
                  >
                    <For each={settings()!.invitations}>
                      {(invitation) => (
                        <article class={`${subCardClass} flex flex-col gap-2 md:flex-row md:items-center md:justify-between`}>
                          <div class="min-w-0">
                            <p class="truncate text-sm text-[var(--text-main)]">{invitation.email}</p>
                            <p class="text-[11px] text-[var(--text-dim)]">Invited {formatDate(invitation.createdAt)}</p>
                          </div>

                          <div class="flex flex-wrap items-center gap-2">
                            <span class={`rounded-md border px-2 py-0.5 text-[11px] ${roleBadgeClass(invitation.role)}`}>
                              {formatRoleLabel(invitation.role)}
                            </span>
                            <span class={chipClass}>
                              {invitation.status}
                            </span>
                            <Show when={canManageInvites()}>
                              <button
                                type="button"
                                class={dangerButtonClass}
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
