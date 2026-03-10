import { useLocation, useNavigate } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";

import AppShell from "../components/AppShell";
import { useApi } from "../context/ApiContext";
import { useToast } from "../context/ToastContext";
import { type BoardStateResponse, type Project, type StoreCatalogItem } from "../server/api";

const DEFAULT_BOARD = "default";
const BOARD_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

type BoardChoice = {
  boardID: string;
  projectID: string;
  name: string;
  isTeamBoard: boolean;
};

function normalizeBoardID(raw: string | null | undefined): string {
  const normalized = (raw ?? "").trim();
  if (!normalized) return DEFAULT_BOARD;
  if (!BOARD_ID_PATTERN.test(normalized)) return DEFAULT_BOARD;
  return normalized;
}

function boardProjectIDForBoard(boardID: string): string {
  const normalized = normalizeBoardID(boardID);
  if (normalized === DEFAULT_BOARD) return "board";
  return normalized;
}

function boardIDFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return normalizeBoardID(params.get("board"));
}

function boardHref(boardID: string): string {
  const normalized = normalizeBoardID(boardID);
  if (normalized === DEFAULT_BOARD) return "/board";
  return `/board?board=${encodeURIComponent(normalized)}`;
}

function boardStoreHref(boardID: string): string {
  const normalized = normalizeBoardID(boardID);
  if (normalized === DEFAULT_BOARD) return "/board/store";
  return `/board/store?board=${encodeURIComponent(normalized)}`;
}

function projectSlug(projectID: string | undefined): string {
  return (projectID ?? "").trim().toLowerCase();
}

function isBoardProject(projectID: string | undefined): boolean {
  const slug = projectSlug(projectID);
  return slug === "board" || slug.startsWith("board-");
}

function boardIDForProject(projectID: string | undefined): string | undefined {
  const slug = projectSlug(projectID);
  if (!isBoardProject(slug)) return undefined;
  if (slug === "board") return DEFAULT_BOARD;
  return slug;
}

function boardChoicesFromProjects(projects: Project[], activeBoardID: string): BoardChoice[] {
  const byBoardID = new Map<string, BoardChoice>();
  byBoardID.set(DEFAULT_BOARD, {
    boardID: DEFAULT_BOARD,
    projectID: "board",
    name: "Board",
    isTeamBoard: false,
  });

  for (const project of projects) {
    const boardID = boardIDForProject(project.id);
    if (!boardID) continue;
    const normalizedBoardID = normalizeBoardID(boardID);
    const existing = byBoardID.get(normalizedBoardID);
    if (existing) {
      if (existing.name === "Board" && project.name.trim()) {
        existing.name = project.name.trim();
      }
      existing.projectID = boardProjectIDForBoard(normalizedBoardID);
      existing.isTeamBoard = existing.isTeamBoard || project.isTeamBoard === true;
      continue;
    }
    byBoardID.set(normalizedBoardID, {
      boardID: normalizedBoardID,
      projectID: boardProjectIDForBoard(normalizedBoardID),
      name: project.name.trim() || boardProjectIDForBoard(normalizedBoardID),
      isTeamBoard: project.isTeamBoard === true,
    });
  }

  const normalizedActive = normalizeBoardID(activeBoardID);
  if (!byBoardID.has(normalizedActive)) {
    byBoardID.set(normalizedActive, {
      boardID: normalizedActive,
      projectID: boardProjectIDForBoard(normalizedActive),
      name: boardProjectIDForBoard(normalizedActive),
      isTeamBoard: false,
    });
  }

  const choices = [...byBoardID.values()];
  choices.sort((a, b) => {
    if (a.boardID === DEFAULT_BOARD && b.boardID !== DEFAULT_BOARD) return -1;
    if (b.boardID === DEFAULT_BOARD && a.boardID !== DEFAULT_BOARD) return 1;
    return a.name.localeCompare(b.name);
  });
  return choices;
}

function formatPrice(item: StoreCatalogItem): string {
  const currency = item.currency.trim().toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(item.priceCents / 100);
  } catch {
    return `$${(item.priceCents / 100).toFixed(2)}`;
  }
}

function inventoryValue(snapshot: BoardStateResponse | null, key: string): number {
  return Math.max(0, Math.floor(snapshot?.meta?.inventory?.[key] ?? 0));
}

export default function BoardStorePage() {
  const api = useApi();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [items, setItems] = createSignal<StoreCatalogItem[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [boardState, setBoardState] = createSignal<BoardStateResponse | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [checkoutEnabled, setCheckoutEnabled] = createSignal(false);
  const [configurationHint, setConfigurationHint] = createSignal("");
  const [checkoutBusyItemID, setCheckoutBusyItemID] = createSignal<string | null>(null);
  const [notice, setNotice] = createSignal<{ tone: "success" | "info"; message: string } | null>(null);

  const activeBoardID = createMemo(() => boardIDFromSearch(location.search));
  const boardChoices = createMemo(() => boardChoicesFromProjects(projects(), activeBoardID()));
  const activeBoardChoice = createMemo(
    () => boardChoices().find((choice) => choice.boardID === activeBoardID()) ?? null,
  );
  const activeBoardName = createMemo(() => activeBoardChoice()?.name || boardProjectIDForBoard(activeBoardID()));
  const itemsByID = createMemo(() => new Map(items().map((item) => [item.id, item] as const)));
  const groupedItems = createMemo(() => {
    const groups = new Map<string, StoreCatalogItem[]>();
    for (const item of items()) {
      const current = groups.get(item.category) ?? [];
      current.push(item);
      groups.set(item.category, current);
    }
    return [...groups.entries()];
  });

  async function loadStorePage(boardID = activeBoardID()) {
    setLoading(true);
    setError("");
    try {
      const [catalog, projectResponse, snapshot] = await Promise.all([
        api.billing.store(),
        api.projects.list().catch(() => ({ items: [] as Project[] })),
        api.board.getState(boardID).catch(() => null),
      ]);
      setItems(catalog.items);
      setCheckoutEnabled(catalog.checkoutEnabled);
      setConfigurationHint(catalog.configurationHint || "");
      setProjects(projectResponse.items);
      setBoardState(snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load store");
    } finally {
      setLoading(false);
    }
  }

  function switchBoard(nextBoardID: string) {
    navigate(boardStoreHref(nextBoardID));
  }

  async function startCheckout(item: StoreCatalogItem) {
    setCheckoutBusyItemID(item.id);
    try {
      const response = await api.billing.storeCheckout({
        itemId: item.id,
        board: activeBoardID(),
      });
      if (response.mode === "stripe_checkout" && response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }
      throw new Error("Stripe checkout did not return a checkout URL.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start store checkout");
    } finally {
      setCheckoutBusyItemID(null);
    }
  }

  createEffect(() => {
    const boardID = activeBoardID();
    void loadStorePage(boardID);
  });

  createEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get("store");
    if (!status) return;

    const itemID = (params.get("item") || "").trim();
    const itemName = itemsByID().get(itemID)?.name || "Purchase";
    const boardName = activeBoardName();
    const message =
      status === "success"
        ? `${itemName} checkout completed. Delivery is being applied to ${boardName}.`
        : `${itemName} checkout was canceled.`;
    const tone = status === "success" ? "success" : "info";

    setNotice({ tone, message });
    if (tone === "success") {
      toast.success(message);
    } else {
      toast.info(message);
    }

    params.delete("store");
    params.delete("item");
    params.delete("session_id");
    const nextSearch = params.toString();
    navigate(nextSearch ? `/board/store?${nextSearch}` : "/board/store", { replace: true });
  });

  return (
    <AppShell
      activeView="board"
      accountPlacement="sidebar"
      mobileSidebar={
        <div class="space-y-3">
          <section class="rounded-xl border border-[#304567] bg-[#0d1626] px-3 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a9cd]">Buy For Board</p>
            <select
              value={activeBoardID()}
              onInput={(event) => switchBoard(event.currentTarget.value)}
              class="mt-2 w-full rounded-md border border-[#405777] bg-[#101d31] px-2 py-1.5 text-sm text-[#e5eeff] outline-none focus:border-[#d4a95f]"
              data-testid="board-store-selector-mobile"
            >
              <For each={boardChoices()}>
                {(choice) => (
                  <option value={choice.boardID}>
                    {choice.name}
                    {choice.isTeamBoard ? " (Team)" : ""}
                  </option>
                )}
              </For>
            </select>
            <button
              type="button"
              class="mt-3 w-full rounded-md border border-[#5b6f90] bg-[#17253c] px-3 py-1.5 text-xs font-semibold text-[#d9e7ff] transition hover:border-[#d4a95f]"
              onClick={() => navigate(boardHref(activeBoardID()))}
            >
              Return to board
            </button>
          </section>

          <section class="rounded-xl border border-[#304567] bg-[#0d1626] px-3 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a9cd]">Current Inventory</p>
            <div class="mt-2 grid grid-cols-2 gap-2 text-sm text-[#d8e4f9]">
              <p>🪙 {inventoryValue(boardState(), "coin")}</p>
              <p>📄 {inventoryValue(boardState(), "paper")}</p>
              <p>🖋️ {inventoryValue(boardState(), "ink")}</p>
              <p>⚙️ {inventoryValue(boardState(), "gear")}</p>
              <p>🔩 {inventoryValue(boardState(), "parts")}</p>
            </div>
          </section>
        </div>
      }
      headerRight={
        <>
          <div class="hidden items-center gap-2 md:flex">
            <select
              value={activeBoardID()}
              onInput={(event) => switchBoard(event.currentTarget.value)}
              class="rounded-md border border-[#405777] bg-[#101d31] px-2 py-1 text-xs text-[#e5eeff] outline-none focus:border-[#d4a95f]"
              data-testid="board-store-selector"
            >
              <For each={boardChoices()}>
                {(choice) => (
                  <option value={choice.boardID}>
                    {choice.name}
                    {choice.isTeamBoard ? " (Team)" : ""}
                  </option>
                )}
              </For>
            </select>
            <button
              type="button"
              class="rounded-md border border-[#6b7c97] bg-[#162337] px-3 py-1 text-xs text-[#dfe8fa] transition hover:border-[#d4a95f]"
              onClick={() => navigate(boardHref(activeBoardID()))}
            >
              Return to board
            </button>
          </div>
        </>
      }
    >
      <div
        class="h-full overflow-y-auto"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(212,169,95,0.18), transparent 26%), radial-gradient(circle at top right, rgba(96,132,196,0.16), transparent 24%), linear-gradient(180deg, #09101b 0%, #070c15 100%)",
        }}
        data-testid="board-store-page"
      >
        <div class="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6">
          <section class="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,360px)]">
            <article class="rounded-[28px] border border-[#384b68] bg-[#0f1a2b]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#91a8cb]">Board Store</p>
                  <h1 class="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#f3f6fd]">Power up {activeBoardName()}</h1>
                  <p class="mt-3 max-w-2xl text-sm leading-6 text-[#b9c9e4]">
                    Buy packs, coins, modifier bundles, and fresh crew through Stripe. Rewards are delivered straight to the
                    selected board.
                  </p>
                </div>
                <Show when={activeBoardChoice()?.isTeamBoard}>
                  <span class="rounded-full border border-[#5970a3] bg-[#1e2a51] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#dce4ff]">
                    Team board
                  </span>
                </Show>
              </div>

              <div class="mt-5 grid gap-3 sm:grid-cols-3">
                <div class="rounded-2xl border border-[#314867] bg-[#101f34] px-4 py-3">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-[#8ca5cb]">Coin</p>
                  <p class="mt-2 text-2xl font-semibold text-[#f2d28d]">{inventoryValue(boardState(), "coin")}</p>
                </div>
                <div class="rounded-2xl border border-[#314867] bg-[#101f34] px-4 py-3">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-[#8ca5cb]">Materials</p>
                  <p class="mt-2 text-sm text-[#dce8ff]">
                    {inventoryValue(boardState(), "paper")} paper · {inventoryValue(boardState(), "ink")} ink
                  </p>
                  <p class="mt-1 text-sm text-[#dce8ff]">
                    {inventoryValue(boardState(), "gear")} gear · {inventoryValue(boardState(), "parts")} parts
                  </p>
                </div>
                <div class="rounded-2xl border border-[#314867] bg-[#101f34] px-4 py-3">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-[#8ca5cb]">Delivery</p>
                  <p class="mt-2 text-sm leading-6 text-[#dce8ff]">Stripe checkout only. Rewards land on the board you have selected.</p>
                </div>
              </div>
            </article>

            <article class="rounded-[28px] border border-[#4f472e] bg-[#18140d]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.36)]">
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#cdb37a]">Checkout Status</p>
              <Show
                when={notice()}
                fallback={
                  <p class="mt-3 text-sm leading-6 text-[#e5d9b9]">
                    Purchases return here after Stripe. If checkout succeeds, delivery is fulfilled automatically for{" "}
                    <span class="font-semibold text-[#fff0c5]">{activeBoardName()}</span>.
                  </p>
                }
              >
                {(value) => (
                  <div
                    class={`mt-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                      value().tone === "success"
                        ? "border-[#4f7a57] bg-[#142419] text-[#d2f5d7]"
                        : "border-[#5f5872] bg-[#1a1828] text-[#e0dcff]"
                    }`}
                    data-testid="board-store-notice"
                  >
                    {value().message}
                  </div>
                )}
              </Show>
              <Show when={!checkoutEnabled()}>
                <div class="mt-4 rounded-2xl border border-[#6d4a4a] bg-[#291718] px-4 py-3 text-sm leading-6 text-[#ffc3bd]">
                  {configurationHint() || "Stripe checkout is not configured yet."}
                </div>
              </Show>
            </article>
          </section>

          <Show when={error()}>
            <div class="rounded-2xl border border-[#784242] bg-[#251517] px-4 py-3 text-sm text-[#ffc3bd]">{error()}</div>
          </Show>

          <Show when={loading() && items().length === 0}>
            <div class="rounded-2xl border border-[#324562] bg-[#0f1a2b] px-4 py-5 text-sm text-[#c8d5eb]">Loading store...</div>
          </Show>

          <For each={groupedItems()}>
            {([category, group]) => (
              <section>
                <div class="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8ea6ca]">{category}</p>
                    <h2 class="mt-1 text-xl font-semibold text-[#f1f5ff]">{category === "Crew" ? "Board Expansion" : category}</h2>
                  </div>
                  <p class="text-xs text-[#8fa3c6]">{group.length} item{group.length === 1 ? "" : "s"}</p>
                </div>

                <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <For each={group}>
                    {(item) => (
                      <article
                        class="rounded-[24px] border border-[#354863] bg-[#0d1626]/95 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.32)]"
                        data-testid={`store-item-${item.id}`}
                      >
                        <div class="flex items-start justify-between gap-3">
                          <div>
                            <p class="text-[11px] uppercase tracking-[0.14em] text-[#8ea6ca]">{item.category}</p>
                            <h3 class="mt-2 text-xl font-semibold leading-tight text-[#f5f8ff]">{item.name}</h3>
                          </div>
                          <Show when={item.badge}>
                            <span class="rounded-full border border-[#5c6e8d] bg-[#152236] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#dbe7ff]">
                              {item.badge}
                            </span>
                          </Show>
                        </div>

                        <p class="mt-3 text-sm leading-6 text-[#b7c8e5]">{item.description}</p>

                        <div class="mt-4 rounded-2xl border border-[#324662] bg-[#111d30] px-3 py-3">
                          <p class="text-2xl font-semibold text-[#f2d28d]">{formatPrice(item)}</p>
                          <p class="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#94aad0]">One-time Stripe checkout</p>
                        </div>

                        <Show when={(item.contents ?? []).length > 0}>
                          <div class="mt-4 space-y-2">
                            <For each={item.contents ?? []}>
                              {(content) => <p class="text-sm leading-6 text-[#d9e5fb]">• {content}</p>}
                            </For>
                          </div>
                        </Show>

                        <button
                          type="button"
                          class="mt-5 w-full rounded-xl border border-[#c59a51] bg-[#c59a51]/12 px-4 py-2.5 text-sm font-semibold text-[#ffe6b6] transition hover:bg-[#c59a51]/18 disabled:cursor-not-allowed disabled:opacity-55"
                          disabled={!checkoutEnabled() || checkoutBusyItemID() === item.id}
                          onClick={() => void startCheckout(item)}
                          data-testid={`store-buy-${item.id}`}
                        >
                          {checkoutBusyItemID() === item.id ? "Redirecting..." : "Checkout with Stripe"}
                        </button>
                      </article>
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>
        </div>
      </div>
    </AppShell>
  );
}
