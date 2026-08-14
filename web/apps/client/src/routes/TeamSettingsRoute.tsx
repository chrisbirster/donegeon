import Button from "../components/Button";
import { For, Show, createMemo, createSignal, createTrackedEffect, onSettled } from "solid-js";
import { hasEntitlement, workspacePlanLabel, workspacePlanProfile } from "../../../../shared/pricing/catalog";
import AppShell from "../components/AppShell";
import { useApi } from "../context/ApiContext";
import { useToast } from "../context/ToastContext";
import { formatDate, formatRoleLabel, parseInviteEmails, roleBadgeClass } from "../features/team/team-settings-model";
import { type TeamInvitation, type TeamMember, type TeamSettings } from "../server/api";
import { style1, style2, style3, style4, style5, style6, style7, style8, style9, style10, style11, style12, style13, style14, style15, style16, style17, style18, style19, style20, style21, style22, style23, style24, style25, style26, style27, style28, style29, style30, style31, style32, style33, style34, style35, style36, style37, style38, style39, style40, style41, style42, style43, style44, style45, style46, style47, style48, style49, style50, style51, style52, style53, style54, style55, style56, style57, style58, style59, style60, style61, style62, style63 } from "./styles/TeamSettingsRoute.styles";
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

  const mobileSidebarSectionClass = style1;
  const heroClass = style2;
  const sectionClass = style3;
  const subCardClass = style4;
  const highlightCardClass =
    style5;
  const badgeClass =
    style6;
  const chipClass =
    style7;
  const inputClass = style8;
  const primaryButtonClass =
    style9;
  const secondaryButtonClass =
    style10;
  const secondaryButtonSmallClass =
    style11;
  const dangerButtonClass =
    style12;
  const infoBannerClass =
    style13;
  const warningBannerClass =
    style14;
  const errorBannerClass =
    style15;
  const successBannerClass =
    style16;
  const sectionHeadingClass = style17;

  return (
    <AppShell
      activeView="team"
      mobileSidebar={
        <div class={style18}>
          <section class={mobileSidebarSectionClass}>
            <p class={style19}>Team</p>
            <p class={style20}>{settings()?.team.name || "Team settings"}</p>
            <Show when={settings()}>
              {(current) => (
                <p class={style21}>Role: {formatRoleLabel(current().currentUserRole)}</p>
              )}
            </Show>
          </section>

          <section class={mobileSidebarSectionClass}>
            <p class={style19}>Members</p>
            <p class={style20}>{settings()?.members.length || 0}</p>
          </section>
          <section class={mobileSidebarSectionClass}>
            <p class={style19}>Pending Invites</p>
            <p class={style20}>{settings()?.invitations.length || 0}</p>
          </section>
        </div>
      }
    >
      <section class={style22}>
        <div class={style23}>
          <header class={heroClass}>
            <p class={style19}>Donegeon Command Settings</p>
            <h1 class={style24}>
              {settings()?.team.name || "Team"} Command Ledger
            </h1>
            <p class={style25}>
              Every account starts on Free. Team powers unlock by board membership and role.
            </p>
            <div class={style26}>
              <a href="#plan" class={secondaryButtonSmallClass}>Plan & Billing</a>
              <a href="#team-profile" class={secondaryButtonSmallClass}>Team Profile</a>
              <a href="#team-members" class={secondaryButtonSmallClass}>Members & Invites</a>
            </div>
          </header>
          <Show when={!loading() && settings()}>
            <section class={sectionClass}>
              <div class={style27}>
                <h2 class={sectionHeadingClass}>Access & Entitlements</h2>
                <span class={badgeClass}>
                  {currentPlanBadge()} / {formatRoleLabel(currentRole())}
                </span>
              </div>
              <div class={style28}>
                <article class={subCardClass}>
                  <p class={style29}>Personal Board</p>
                  <p class={style30}>Free by default</p>
                  <p class={style31}>
                    Every user starts on Free for their personal Donegeon board after login.
                  </p>
                </article>
                <article class={highlightCardClass}>
                  <p class={style32}>Active Team Workspace</p>
                  <p class={style30}>{settings()!.team.name}</p>
                  <p class={style31}>{roleSummary()}</p>
                </article>
                <article class={subCardClass}>
                  <p class={style29}>Plan Scope</p>
                  <p class={style30}>{currentPlan()}</p>
                  <p class={style31}>{planSummary()}</p>
                </article>
              </div>
              <div class={` ${style33} ${infoBannerClass}`}>
                Team board access is role-based per workspace. Billing and team-admin actions are limited to owner/admin accounts.
              </div>
              <Show when={teamAdminFrozen()}>
                <p class={` ${style33} ${warningBannerClass}`}>
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
                <div class={style27}>
                  <h2 class={sectionHeadingClass}>Billing</h2>
                  <span class={badgeClass}>
                    {currentPlanBadge()}
                  </span>
                </div>
                <p class={style34}>
                  {billingSummary()}
                </p>
                <Show when={currentBillingState() === "trial" && settings()!.team.trialEndsAt}>
                  {(trialEndsAt) => (
                    <p class={style34}>
                      Trial ends on {formatDate(trialEndsAt())}
                    </p>
                  )}
                </Show>
                <div class={style35}>
                  <article class={subCardClass}>
                    <p class={style36}>Free</p>
                    <p class={style37}>$0</p>
                    <p class={style34}>Core task workflow, personal board gameplay, and calendar sync.</p>
                    <Button
                      type="button"
                      class={` ${style38} ${secondaryButtonClass} ${style39} `}
                      disabled
                    >
                      {freeCardLabel()}
                    </Button>
                  </article>
                  <article class={highlightCardClass}>
                    <p class={style40}>Pro</p>
                    <p class={style37}>$12/user/mo</p>
                    <p class={style34}>Shared boards, invitations, role controls, and board member management.</p>
                    <Show
                      when={currentPlanFamily() === "pro" && currentBillingState() === "trial"}
                      fallback={
                        <Show
                          when={currentPlanFamily() === "pro" && currentBillingState() === "paid"}
                          fallback={
                            <Show
                              when={currentPlanFamily() === "enterprise"}
                              fallback={
                                <div class={style41}>
                                  <Button
                                    type="button"
                                    class={` ${style42} ${primaryButtonClass}`}
                                    disabled={billingLoading() || !canManage()}
                                    onClick={() => void startBilling("pro_trial")}
                                  >
                                    Start 14-day trial
                                  </Button>
                                  <Button
                                    type="button"
                                    class={` ${style42} ${secondaryButtonClass}`}
                                    disabled={billingLoading() || !canManage()}
                                    onClick={() => void startBilling("pro")}
                                  >
                                    Upgrade
                                  </Button>
                                </div>
                              }
                            >
                              <Button
                                type="button"
                                class={` ${style38} ${secondaryButtonClass} ${style39} `}
                                disabled
                              >
                                Included in Enterprise
                              </Button>
                            </Show>
                          }
                        >
                          <div class={style41}>
                            <Button
                              type="button"
                              class={` ${style42} ${secondaryButtonClass}`}
                              disabled={billingLoading() || !canManage() || !hasPaidSubscription()}
                              onClick={() => void openBillingPortal()}
                            >
                              Manage billing
                            </Button>
                            <Button
                              type="button"
                              class={` ${style42} ${secondaryButtonClass} ${style39} `}
                              disabled
                            >
                              Current plan
                            </Button>
                          </div>
                        </Show>
                      }
                    >
                      <div class={style41}>
                        <Button
                          type="button"
                          class={` ${style42} ${secondaryButtonClass}`}
                          disabled={billingLoading() || !canManage()}
                          onClick={() => void endTrial()}
                        >
                          End trial
                        </Button>
                        <Button
                          type="button"
                          class={` ${style42} ${primaryButtonClass}`}
                          disabled={billingLoading() || !canManage()}
                          onClick={() => void startBilling("pro")}
                        >
                          Start paid plan
                        </Button>
                      </div>
                    </Show>
                  </article>
                  <article class={subCardClass}>
                    <p class={style36}>Enterprise</p>
                    <p class={style37}>Custom</p>
                    <p class={style34}>Pro product access with sales-led rollout, security review, and procurement support.</p>
                    <Button
                      type="button"
                      class={` ${style38} ${secondaryButtonClass}`}
                      disabled={currentPlanFamily() === "enterprise" || billingLoading() || !canManage()}
                      onClick={() => void startBilling("enterprise")}
                    >
                      {currentPlanFamily() === "enterprise" ? "Current plan" : "Talk to Sales"}
                    </Button>
                  </article>
                </div>
                <Show when={currentPlanFamily() !== "free"}>
                  <p class={style43}>
                    Free remains the fallback after cancellation. Existing boards and members stay in place, but new invites and other team-admin actions freeze until the workspace returns to Pro.
                  </p>
                </Show>
                <Show when={currentPlanFamily() === "pro" && currentBillingState() === "paid"}>
                  <p class={style34}>
                    Manage billing opens Stripe so owners/admins can cancel at period end, update payment details, or review invoices.
                  </p>
                </Show>
                <Show when={!canManage()}>
                  <p class={style43}>
                    You can use team features on boards you were invited to. Only owners/admins can change team billing.
                  </p>
                </Show>
              </section>
              <section id="team-profile" class={sectionClass}>
                <div class={style27}>
                  <h2 class={sectionHeadingClass}>Team Profile</h2>
                  <span class={chipClass}>
                    {formatRoleLabel(settings()!.currentUserRole)}
                  </span>
                </div>
                <form class={style44} onSubmit={(event) => void saveTeamName(event)}>
                  <label class={style45}>
                    Team name
                    <input
                      value={teamNameInput()}
                      onInput={(event) => setTeamNameInput(event.currentTarget.value)}
                      class={inputClass}
                      disabled={!canManageTeamProfile() || saveTeamLoading()}
                    />
                  </label>
                  <Button
                    type="submit"
                    class={primaryButtonClass}
                    disabled={!canManageTeamProfile() || saveTeamLoading()}
                  >
                    {saveTeamLoading() ? "Saving..." : "Save team"}
                  </Button>
                </form>
                <Show when={canManage() && !canManageTeamProfile()}>
                  <p class={` ${style33} ${warningBannerClass}`}>
                    Team profile changes are frozen on Free. Upgrade to Pro to rename or manage this shared workspace.
                  </p>
                </Show>
              </section>
              <section id="team-members" class={sectionClass}>
                <div class={style46}>
                  <h2 class={sectionHeadingClass}>Team Members</h2>
                  <span class={style47}>{settings()!.members.length} member(s)</span>
                </div>
                <div class={style48}>
                  <For each={settings()!.members}>
                    {(member) => {
                      const isCurrentUser = () => settings()!.currentUserId === member.userId;
                      const canEditMemberRole = () =>
                        canManageRoles() && !isCurrentUser() && member.role !== "owner";
                      const canRemove = () =>
                        canManageRoles() && !isCurrentUser() && member.role !== "owner";
                      return (
                        <article class={subCardClass}>
                          <div class={style49}>
                            <div class={style50}>
                              <p class={style51}>{member.name || member.email}</p>
                              <p class={style52}>{member.email}</p>
                              <p class={style53}>Joined {formatDate(member.createdAt)}</p>
                            </div>
                            <div class={style54}>
                              <span class={` ${style55} ${roleBadgeClass(member.role)}`}>
                                {formatRoleLabel(member.role)}
                              </span>
                              <Show when={canEditMemberRole()}>
                                <select
                                  value={member.role}
                                  class={style56}
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
                                <Button
                                  type="button"
                                  class={dangerButtonClass}
                                  disabled={removingUserID() === member.userId}
                                  onClick={() => void removeMember(member)}
                                >
                                  {removingUserID() === member.userId ? "Removing..." : "Remove"}
                                </Button>
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
                  <p class={` ${style33} ${warningBannerClass}`}>
                    Role changes and member removal are frozen on Free. Upgrade to Pro to manage team membership again.
                  </p>
                </Show>
              </section>
              <section class={sectionClass}>
                <div class={style27}>
                  <h2 class={sectionHeadingClass}>Invitations</h2>
                  <span class={style47}>{settings()!.invitations.length} pending</span>
                </div>
                <form class={style33} onSubmit={(event) => void inviteMembers(event)}>
                  <label class={style57}>
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
                  <label class={style58}>
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
                  <p class={style59}>Use commas or new lines for multiple invite emails.</p>
                  <Button
                    type="submit"
                    class={` ${style33} ${primaryButtonClass}`}
                    disabled={!canManageInvites() || inviteLoading()}
                  >
                    {inviteLoading() ? "Sending..." : "Send invite"}
                  </Button>
                </form>
                <Show when={canManage() && !canManageInvites()}>
                  <p class={` ${style33} ${warningBannerClass}`}>
                    Invitations are frozen on Free. Existing members keep access, but new invites require Pro.
                  </p>
                </Show>
                <div class={style60}>
                  <Show
                    when={settings()!.invitations.length > 0}
                    fallback={<p class={infoBannerClass}>No pending invitations.</p>}
                  >
                    <For each={settings()!.invitations}>
                      {(invitation) => (
                        <article class={`${subCardClass} ${style61} `}>
                          <div class={style50}>
                            <p class={style62}>{invitation.email}</p>
                            <p class={style63}>Invited {formatDate(invitation.createdAt)}</p>
                          </div>
                          <div class={style54}>
                            <span class={` ${style55} ${roleBadgeClass(invitation.role)}`}>
                              {formatRoleLabel(invitation.role)}
                            </span>
                            <span class={chipClass}>
                              {invitation.status}
                            </span>
                            <Show when={canManageInvites()}>
                              <Button
                                type="button"
                                class={dangerButtonClass}
                                disabled={cancelingInviteCode() === invitation.invitationCode}
                                onClick={() => void cancelInvitation(invitation)}
                              >
                                {cancelingInviteCode() === invitation.invitationCode ? "Canceling..." : "Cancel"}
                              </Button>
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
