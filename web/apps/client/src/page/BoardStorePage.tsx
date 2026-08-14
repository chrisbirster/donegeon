import Button from "../components/Button";
import { useLocation, useNavigate } from "@solidjs/router";
import { For, Show, createMemo, createSignal, createTrackedEffect } from "solid-js";

import AppShell from "../components/AppShell";
import { useApi } from "../context/ApiContext";
import { useToast } from "../context/ToastContext";
import { writeStoredBoardSelection } from "../lib/boardSelection";
import { type BoardStateResponse, type Project, type StoreCatalogItem } from "../server/api";
import { style1, style2, style3, style4, style5, style6, style7, style8, style9, style10, style11, style12, style13, style14, style15, style16, style17, style18, style19, style20, style21, style22, style23, style24, style25, style26, style27, style28, style29, style30, style31, style32, style33, style34, style35, style36, style37, style38, style39, style40, style41, style42, style43, style44, style45, style46, style47, style48, style49, style50, style51 } from "./styles/BoardStorePage.styles";

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

  createTrackedEffect(() => {
    writeStoredBoardSelection(activeBoardID());
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
    const normalized = writeStoredBoardSelection(nextBoardID);
    navigate(boardStoreHref(normalized));
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

  createTrackedEffect(() => {
    const boardID = activeBoardID();
    void loadStorePage(boardID);
  });

  createTrackedEffect(() => {
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
        <div class={style1}>
          <section class={style2}>
            <p class={style3}>Buy For Board</p>
            <select
              value={activeBoardID()}
              onInput={(event) => switchBoard(event.currentTarget.value)}
              class={style4}
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
            <Button
              type="button"
              class={style5}
              onClick={() => navigate(boardHref(activeBoardID()))}
            >
              Return to board
            </Button>
          </section>

          <section class={style2}>
            <p class={style3}>Current Inventory</p>
            <div class={style6}>
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
          <div class={style7}>
            <Button
              type="button"
              class={style8}
              onClick={() => navigate(boardHref(activeBoardID()))}
            >
              Return to board
            </Button>
          </div>
        </>
      }
    >
      <div
        class={style9}
        style={{
          background:
            "radial-gradient(circle at top left, rgba(212,169,95,0.18), transparent 26%), radial-gradient(circle at top right, rgba(96,132,196,0.16), transparent 24%), linear-gradient(180deg, #09101b 0%, #070c15 100%)",
        }}
        data-testid="board-store-page"
      >
        <div class={style10}>
          <section class={style11}>
            <article class={style12}>
              <div class={style13}>
                <div>
                  <p class={style14}>Board Store</p>
                  <h1 class={style15}>Power up {activeBoardName()}</h1>
                  <p class={style16}>
                    Buy packs, coins, modifier bundles, and fresh crew through Stripe. Rewards are delivered straight to the
                    selected board.
                  </p>
                </div>
                <Show when={activeBoardChoice()?.isTeamBoard}>
                  <span class={style17}>
                    Team board
                  </span>
                </Show>
              </div>

              <div class={style18}>
                <div class={style19}>
                  <p class={style20}>Coin</p>
                  <p class={style21}>{inventoryValue(boardState(), "coin")}</p>
                </div>
                <div class={style19}>
                  <p class={style20}>Materials</p>
                  <p class={style22}>
                    {inventoryValue(boardState(), "paper")} paper · {inventoryValue(boardState(), "ink")} ink
                  </p>
                  <p class={style23}>
                    {inventoryValue(boardState(), "gear")} gear · {inventoryValue(boardState(), "parts")} parts
                  </p>
                </div>
                <div class={style19}>
                  <p class={style20}>Delivery</p>
                  <p class={style24}>Stripe checkout only. Rewards land on the board you have selected.</p>
                </div>
              </div>
            </article>

            <article class={style25}>
              <p class={style26}>Checkout Status</p>
              <Show
                when={notice()}
                fallback={
                  <p class={style27}>
                    Purchases return here after Stripe. If checkout succeeds, delivery is fulfilled automatically for{" "}
                    <span class={style28}>{activeBoardName()}</span>.
                  </p>
                }
              >
                {(value) => (
                  <div
                    class={` ${style29} ${
                      value().tone === "success"
                        ? style30
                        : style31
                    }`}
                    data-testid="board-store-notice"
                  >
                    {value().message}
                  </div>
                )}
              </Show>
              <Show when={!checkoutEnabled()}>
                <div class={style32}>
                  {configurationHint() || "Stripe checkout is not configured yet."}
                </div>
              </Show>
            </article>
          </section>

          <Show when={error()}>
            <div class={style33}>{error()}</div>
          </Show>

          <Show when={loading() && items().length === 0}>
            <div class={style34}>Loading store...</div>
          </Show>

          <For each={groupedItems()}>
            {([category, group]) => (
              <section>
                <div class={style35}>
                  <div>
                    <p class={style36}>{category}</p>
                    <h2 class={style37}>{category === "Crew" ? "Board Expansion" : category}</h2>
                  </div>
                  <p class={style38}>{group.length} item{group.length === 1 ? "" : "s"}</p>
                </div>

                <div class={style39}>
                  <For each={group}>
                    {(item) => (
                      <article
                        class={style40}
                        data-testid={`store-item-${item.id}`}
                      >
                        <div class={style41}>
                          <div>
                            <p class={style42}>{item.category}</p>
                            <h3 class={style43}>{item.name}</h3>
                          </div>
                          <Show when={item.badge}>
                            <span class={style44}>
                              {item.badge}
                            </span>
                          </Show>
                        </div>

                        <p class={style45}>{item.description}</p>

                        <div class={style46}>
                          <p class={style47}>{formatPrice(item)}</p>
                          <p class={style48}>One-time Stripe checkout</p>
                        </div>

                        <Show when={(item.contents ?? []).length > 0}>
                          <div class={style49}>
                            <For each={item.contents ?? []}>
                              {(content) => <p class={style50}>• {content}</p>}
                            </For>
                          </div>
                        </Show>

                        <Button
                          type="button"
                          class={style51}
                          disabled={!checkoutEnabled() || checkoutBusyItemID() === item.id}
                          onClick={() => void startCheckout(item)}
                          data-testid={`store-buy-${item.id}`}
                        >
                          {checkoutBusyItemID() === item.id ? "Redirecting..." : "Checkout with Stripe"}
                        </Button>
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
