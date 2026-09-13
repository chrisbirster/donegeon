import { css } from "@linaria/core";
import { For, Show } from "solid-js";

import {
  projectAliasFromProjectID,
  projectQuickAddAlias,
  scheduleBadgeLabel,
  visibleTaskLabels,
} from "../../features/tasks/home-model";
import { useHome } from "../../page/HomeContext";
import Button from "../Button";
import Dialog from "../ui/Dialog";

export default function HomeSearchModal() {
  const {
    isSearchOpen,
    searchText,
    setSearchText,
    setSearchInputRef,
    searchResults,
    projectMap,
    closeSearchModal,
    openDetailModal,
  } = useHome();

  const projectToken = (projectID?: string) => {
    if (!projectID) return null;
    const project = projectMap().get(projectID);
    return project ? projectQuickAddAlias(project) : projectAliasFromProjectID(projectID);
  };

  return (
    <Show when={isSearchOpen()}>
      <Dialog ariaLabel="Task search" onClose={closeSearchModal} class={palette} testId="task-search-dialog">
        <div class={searchHeader}>
          <span class={searchGlyph} aria-hidden="true">⌕</span>
          <input
            ref={setSearchInputRef}
            value={searchText()}
            onInput={(event) => setSearchText(event.currentTarget.value)}
            placeholder="Search the dungeon..."
            aria-label="Search tasks"
            data-testid="search-input"
            class={searchInput}
            autofocus
          />
          <kbd class={shortcut}>⌘K</kbd>
        </div>
        <div class={subheader}>
          <p class={searchHint}>Search task titles, descriptions, projects, and tags.</p>
          <Button type="button" variant="ghost" size="sm" onClick={closeSearchModal}>Close</Button>
        </div>

        <div class={results}>
          <Show
            when={searchText().trim().length > 0}
            fallback={
              <div class={emptyState}>
                <span class={emptyGlyph} aria-hidden="true">⌕</span>
                <p>Start typing to find an open task.</p>
              </div>
            }
          >
            <Show
              when={searchResults().length > 0}
              fallback={<p class={emptyState}>No matching open tasks.</p>}
            >
              <p class={resultHeading} aria-live="polite">{searchResults().length} result(s)</p>
              <div class={resultList} aria-label="Task search results">
                <For each={searchResults()}>
                  {(item) => {
                    const token = () => projectToken(item.projectId);
                    return (
                      <Button
                        type="button"
                        class={resultButton}
                        data-testid="search-result"
                        onClick={() => {
                          closeSearchModal();
                          openDetailModal(item);
                        }}
                      >
                        <span class={resultMain}>
                          <span class={resultTitle}>{item.content}</span>
                          <Show when={item.description?.trim()}>
                            <span class={resultDescription}>{item.description.trim()}</span>
                          </Show>
                          <span class={metadata}>
                            <Show when={token()}>{(value) => <span class={projectBadge}>#{value()}</span>}</Show>
                            <Show when={scheduleBadgeLabel(item, "due")}>
                              {(label) => <span class={metadataBadge}>{label()}</span>}
                            </Show>
                            <Show when={scheduleBadgeLabel(item, "deadline")}>
                              {(label) => <span class={metadataBadge}>{label()}</span>}
                            </Show>
                            <For each={visibleTaskLabels(item.labels)}>
                              {(label) => <span class={metadataBadge}>@{label}</span>}
                            </For>
                          </span>
                        </span>
                        <span class={openHint}>Details ↗</span>
                      </Button>
                    );
                  }}
                </For>
              </div>
            </Show>
          </Show>
        </div>
      </Dialog>
    </Show>
  );
}

const palette = css`
  width:min(760px,100%);
  overflow:hidden;
  border-color:rgba(196,69,255,.46);
  background:linear-gradient(180deg, rgba(11,14,25,.985), rgba(8,10,19,.985));
  box-shadow:0 28px 90px rgba(0,0,0,.7), 0 0 42px rgba(196,69,255,.12);
`;
const searchHeader = css`
  display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:.8rem;
  padding:1rem 1.1rem .65rem;
`;
const searchGlyph = css`font-size:1.35rem; color:#e59cff; text-shadow:0 0 14px rgba(196,69,255,.5);`;
const searchInput = css`
  width:100%; border:0; outline:0; background:transparent; color:var(--text-main);
  font:500 1.12rem/1.4 "Space Grotesk","IBM Plex Sans",sans-serif;
  &::placeholder { color:var(--text-dim); }
  &:focus-visible { outline:2px solid #00e0ff; outline-offset:4px; border-radius:.25rem; }
`;
const shortcut = css`
  border:1px solid var(--border-strong); border-bottom-color:rgba(196,69,255,.4); border-radius:.45rem;
  padding:.22rem .42rem; background:rgba(255,255,255,.035); color:var(--text-dim); font-size:.68rem;
`;
const subheader = css`display:flex; align-items:center; justify-content:space-between; gap:.8rem; padding:0 1.1rem .8rem; border-bottom:1px solid var(--border-strong);`;
const searchHint = css`margin:0; color:var(--text-dim); font-size:.78rem;`;
const results = css`max-height:min(62vh,540px); overflow-y:auto; padding:.75rem;`;
const emptyState = css`
  display:flex; align-items:center; justify-content:center; gap:.6rem; min-height:7rem; margin:0; padding:1rem;
  color:var(--text-dim); font-size:.9rem; text-align:center;
`;
const emptyGlyph = css`font-size:1.2rem; color:rgba(229,156,255,.72);`;
const resultHeading = css`margin:0; padding:.2rem .45rem .55rem; color:var(--text-dim); font-size:.68rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase;`;
const resultList = css`display:flex; flex-direction:column; gap:.4rem;`;
const resultButton = css`
  display:flex; align-items:center; justify-content:space-between; gap:1rem; width:100%;
  border:1px solid transparent; border-radius:.85rem; padding:.8rem .9rem;
  background:rgba(255,255,255,.018); color:var(--text-main); text-align:left;
  &:hover, &:focus-visible { border-color:rgba(196,69,255,.34); background:rgba(196,69,255,.075); outline:2px solid #00e0ff; outline-offset:2px; }
`;
const resultMain = css`display:flex; min-width:0; flex:1; flex-direction:column; gap:.2rem;`;
const resultTitle = css`overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.98rem; font-weight:650;`;
const resultDescription = css`overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-soft); font-size:.8rem;`;
const metadata = css`display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.18rem;`;
const metadataBadge = css`border-radius:.42rem; padding:.12rem .38rem; background:rgba(103,187,255,.08); color:var(--text-dim); font-size:.68rem;`;
const projectBadge = css`border-radius:.42rem; padding:.12rem .38rem; background:rgba(196,69,255,.11); color:#e9c7ff; font-size:.68rem;`;
const openHint = css`flex:0 0 auto; color:var(--text-dim); font-size:.72rem;`;
