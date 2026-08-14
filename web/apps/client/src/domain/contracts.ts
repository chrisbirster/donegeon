// API/domain contracts shared by repositories, contexts, and features.

export type Task = {
  id: string;
  content: string;
  description: string;
  projectId?: string;
  sectionId?: string;
  sortOrder: number;
  recurrenceRule?: string;
  scheduleInput?: string;
  labels: string[];
  priority: number;
  checked: boolean;
  isDeleted: boolean;
  dueText?: string;
  dueDeadline?: string;
};

export type Project = {
  id: string;
  name: string;
  isInboxProject: boolean;
  isArchived: boolean;
  isFavorite: boolean;
  isTeamBoard?: boolean;
  openTaskCount: number;
};

export type BoardPoint = {
  x: number;
  y: number;
};

export type BoardStack = {
  id: string;
  pos: BoardPoint;
  z: number;
  cards: string[];
};

export type BoardCard = {
  id: string;
  defId: string;
  data?: Record<string, unknown>;
};

export type BoardQuestObjective = {
  op: string;
  count?: number;
  value?: number;
  ref?: string;
  timeWindow?: string;
  baseline?: number;
  current: number;
  target: number;
  complete: boolean;
};

export type BoardQuestReward = {
  kind: string;
  currency?: string;
  amount?: number;
  tableId?: string;
  cardType?: string;
  cardCount?: number;
  cardCharge?: number;
  xp?: number;
};

export type BoardQuestUnlock = {
  kind: string;
  id: string;
};

export type BoardQuestRuntime = {
  id: string;
  templateId?: string;
  title: string;
  type: string;
  scope: string;
  day?: number;
  week?: number;
  howToComplete?: string;
  definitionOfDone?: string;
  acceptanceCriteria?: string[];
  objectives?: BoardQuestObjective[];
  rewards?: BoardQuestReward[];
  unlocks?: BoardQuestUnlock[];
  completed: boolean;
  claimable: boolean;
  claimed: boolean;
  failed?: boolean;
  completedDay?: number;
  claimedDay?: number;
};

export type BoardQuestHistoryEntry = {
  id: string;
  templateId?: string;
  title: string;
  type: string;
  scope: string;
  day?: number;
  week?: number;
  howToComplete?: string;
  definitionOfDone?: string;
  acceptanceCriteria?: string[];
  completed: boolean;
  claimed: boolean;
  failed?: boolean;
  completedDay?: number;
  claimedDay?: number;
};

export type BoardQuestState = {
  currentDay?: number;
  currentWeek?: number;
  dailyStreak?: number;
  lastDailyRefreshDay?: number;
  lastDailyClaimDay?: number;
  recentDailyTemplateIds?: string[];
  active?: BoardQuestRuntime[];
  history?: BoardQuestHistoryEntry[];
  unlocked?: BoardQuestUnlock[];
};

export type BoardProgressionPerk = {
  id: string;
  label: string;
  summary?: string;
};

export type BoardProgressionLevel = {
  level: number;
  threshold: number;
  perks?: BoardProgressionPerk[];
};

export type BoardProgressionState = {
  maxLevel: number;
  thresholds?: Record<string, number>;
  perksByLevel?: Record<string, BoardProgressionPerk[]>;
  levels?: BoardProgressionLevel[];
};

export type BoardMeta = {
  inventory?: Record<string, number>;
  villagers?: Record<
    string,
    {
      stamina?: number;
      xp?: number;
      level?: number;
      perks?: string[];
      maxStamina?: number;
      nextLevel?: number;
      nextLevelXP?: number;
      xpToNextLevel?: number;
    }
  >;
  progression?: BoardProgressionState;
  metrics?: Record<string, number>;
  deckOpen?: Record<string, number>;
  dayTickCount?: number;
  quests?: BoardQuestState;
};

export type BoardStateResponse = {
  stacks: Record<string, BoardStack>;
  cards: Record<string, BoardCard>;
  meta?: BoardMeta;
  version: string;
};

export type TaskListResponse = {
  items: Task[];
  nextCursor?: number;
  total: number;
};

export type ProjectListResponse = {
  items: Project[];
};

export type QuickAddParsed = {
  content: string;
  project?: string;
  labels: string[];
  assignee?: string;
  priority?: number;
  deadline?: string;
  dueText?: string;
  recurrenceRule?: string;
  description: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  showOnboarding: boolean;
  currentWorkspaceId?: string;
};

export type AuthTeam = {
  id: string;
  name: string;
  plan: string;
  planFamily: "free" | "pro" | "enterprise";
  billingState: "none" | "trial" | "paid" | "sales";
  entitlements: string[];
  trialEndsAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  isArchived: boolean;
};

export type TeamMember = {
  workspaceId: string;
  userId: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "editor" | "reader";
  createdAt: string;
};

export type TeamInvitation = {
  invitationCode: string;
  workspaceId: string;
  email: string;
  role: "admin" | "editor" | "reader";
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type InvitationForLogin = {
  invitationCode: string;
  email: string;
  teamName: string;
  status: string;
};

export type CompleteOnboardingInput = {
  personalBoardName: string;
  teamBoardName?: string;
  name: string;
  emails: string[];
  plan?: string;
};

export type TeamSettings = {
  team: AuthTeam;
  members: TeamMember[];
  invitations: TeamInvitation[];
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "editor" | "reader";
  canManage: boolean;
};

export type CalendarProvider = "google";

export type CalendarConnection = {
  id: string;
  provider: CalendarProvider | string;
  externalAccountId?: string;
  email: string;
  scope?: string;
  calendarId: string;
  expiresAt?: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
  hasRefreshToken: boolean;
};

export type CalendarSyncResult = {
  connectionId: string;
  provider: string;
  pulled: number;
  error?: string;
};

export type CalendarSyncResponse = {
  results: CalendarSyncResult[];
};

export type BoardMember = TeamMember;

export type BillingCheckoutResponse = {
  mode: "trial_started" | "stripe_checkout" | "contact_sales";
  checkoutUrl?: string;
  contactUrl?: string;
  team?: AuthTeam;
};

export type BillingPortalResponse = {
  url: string;
};

export type BillingTrialEndResponse = {
  team: AuthTeam;
};

export type StoreCatalogItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  badge?: string;
  priceCents: number;
  currency: string;
  contents?: string[];
};

export type StoreCatalogResponse = {
  items: StoreCatalogItem[];
  checkoutEnabled: boolean;
  configurationHint?: string;
};

export type StoreCheckoutResponse = {
  mode: "stripe_checkout";
  checkoutUrl?: string;
};

export type AuthSession = {
  user: AuthUser;
  team?: AuthTeam;
};

export type LoginCodeRequestResponse = {
  challengeId: string;
  expiresAt: string;
  delivery: string;
  debugCode?: string;
  deliveryWarning?: string;
};

export type PublicConfig = {
  openBeta: boolean;
  openBetaStartsAt: string;
  openBetaStartsLabel: string;
};

export type WaitlistSignup = {
  id: string;
  name: string;
  email: string;
  source: string;
  requestedPlan: string;
  createdAt: string;
  updatedAt: string;
};

export type WaitlistSignupResponse = {
  signup: WaitlistSignup;
  alreadyJoined: boolean;
  deliveryWarning?: string;
  openBetaStartsAt: string;
  openBetaStartsLabel: string;
};

export type UpdateTaskPayload = {
  content?: string;
  description?: string;
  projectId?: string;
  sectionId?: string;
  sortOrder?: number;
  recurrenceRule?: string;
  scheduleInput?: string;
  labels?: string[];
  priority?: number;
  dueText?: string;
  dueDeadline?: string;
};

export type ParsedRRule = {
  raw: string;
  freq: string;
  until?: {
    value: string;
    isDate: boolean;
    utc: boolean;
  };
  count?: number;
  interval?: number;
  bySecond?: number[];
  byMinute?: number[];
  byHour?: number[];
  byDay?: Array<{
    ordinal?: number;
    weekday: string;
  }>;
  byMonthDay?: number[];
  byYearDay?: number[];
  byWeekNo?: number[];
  byMonth?: number[];
  bySetPos?: number[];
  weekStart?: string;
  extensionParts?: Record<string, string>;
};

export type BoardCommandPayload = {
  cmd: string;
  args?: Record<string, unknown>;
  clientVersion?: string;
};

export type BoardCommandResponse = {
  ok: boolean;
  newVersion: string;
  patch?: unknown;
  error?: string;
};

