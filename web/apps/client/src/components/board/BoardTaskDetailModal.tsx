import { css } from "@linaria/core";
import { For, Show, createMemo } from "solid-js";

import { dataString, formatScheduleDateTime } from "../../features/board/board-model";
import { prettifyDefID } from "../../features/board/board-rules";
import { useBoard } from "../../page/BoardContext";
import Button from "../Button";
import QuickAddTokenInput, { quickAddTokenClass } from "../task/QuickAddTokenInput";
import Dialog, { dialogEyebrow, dialogHeader, dialogTitle } from "../ui/Dialog";

export default function BoardTaskDetailModal() {
  const {
    selectedStackID,
    isDetailOpen,
    detailTitle,
    detailDescription,
    setDetailDescription,
    detailPriority,
    setDetailPriority,
    detailParsing,
    activeBoardProjectID,
    selectedTaskCard,
    selectedModifierCards,
    recurringModifierEnabled,
    deadlineModifierEnabled,
    detailParsedChips,
    detailModifierHints,
    detailScheduleInput,
    detailStoredDue,
    detailStoredDeadline,
    detailTokens,
    detailDueInputToken,
    detailDeadlineInputToken,
    detailVisibleLabels,
    detailScheduleWarning,
    onDetailTitleInput,
    closeDetail,
    openInTaskPage,
    saveDetail,
    completeStack,
  } = useBoard();

  return (
    <Show when={isDetailOpen() && !!selectedTaskCard()}>
      <Dialog ariaLabel="Task Details" onClose={closeDetail} testId="board-detail-modal" class={modal}>
        <header class={dialogHeader}>
          <div>
            <p class={dialogEyebrow}>Board task</p>
            <h2 class={dialogTitle}>Task Details</h2>
          </div>
          <Button type="button" variant="ghost" iconOnly aria-label="Close task details" onClick={closeDetail}>
            <span aria-hidden="true">✕</span>
          </Button>
        </header>

        <div class={body}>
          <section class={panel} aria-labelledby="board-task-heading">
            <h3 id="board-task-heading" class={sectionTitle}>Task</h3>
            <QuickAddTokenInput
              value={detailTitle()}
              tokens={detailTokens()}
              onInput={onDetailTitleInput}
              ariaLabel="Task title"
              testId="board-detail-title"
              autofocus
            />

            <Show when={detailTokens().length > 0}>
              <div class={tokenPreview} aria-label="Parsed title tokens">
                <For each={detailTokens()}>{(token) => <span class={quickAddTokenClass(token.kind)}>{token.value}</span>}</For>
              </div>
            </Show>

            <Show when={detailParsing()}><p class={muted} role="status">Parsing schedule…</p></Show>

            <Show when={detailParsedChips().length > 0}>
              <div class={chipRow} aria-label="Parsed task metadata">
                <For each={detailParsedChips()}>{(chip) => <span class={chip}>{chip}</span>}</For>
              </div>
            </Show>

            <Show when={detailModifierHints().length > 0}>
              <div class={messageStack}>
                <For each={detailModifierHints()}>{(hint) => <p class={warning}>{hint}</p>}</For>
              </div>
            </Show>

            <Show when={detailScheduleInput() || detailStoredDue() || detailStoredDeadline()}>
              <div class={scheduleCard} aria-label="Task schedule">
                <Show when={detailStoredDue()}>
                  <p><strong>Due:</strong> {formatScheduleDateTime(detailStoredDue()) ?? detailStoredDue()}</p>
                </Show>
                <Show when={detailStoredDeadline()}>
                  <p><strong>Deadline:</strong> {formatScheduleDateTime(detailStoredDeadline()) ?? detailStoredDeadline()}</p>
                </Show>
                <Show when={detailScheduleInput()}>
                  <details>
                    <summary>Original schedule input</summary>
                    <p class={originalInput}>{detailScheduleInput()}</p>
                    <Show when={detailDueInputToken()}><p>Parsed due phrase: {detailDueInputToken()}</p></Show>
                    <Show when={detailDeadlineInputToken()}><p>Parsed deadline phrase: {detailDeadlineInputToken()}</p></Show>
                  </details>
                </Show>
              </div>
            </Show>

            <Show when={detailScheduleWarning()}><p class={warning} role="alert">{detailScheduleWarning()}</p></Show>

            <label class={fieldLabel} for="board-detail-description">Description</label>
            <textarea
              id="board-detail-description"
              rows={5}
              value={detailDescription()}
              onInput={(event) => setDetailDescription(event.currentTarget.value)}
              class={textarea}
              data-testid="board-detail-description"
            />

            <Button type="button" variant="ghost" onClick={openInTaskPage}>View in Tasks Page</Button>
          </section>

          <section class={panel} aria-labelledby="board-priority-heading">
            <h3 id="board-priority-heading" class={sectionTitle}>Priority</h3>
            <div class={buttonRow}>
              <For each={[0, 1, 2, 3, 4]}>
                {(value) => {
                  const selected = () => detailPriority() === value || (value === 0 && detailPriority() <= 0);
                  return (
                    <Button
                      type="button"
                      size="sm"
                      variant={selected() ? "primary" : "secondary"}
                      aria-pressed={selected()}
                      onClick={() => setDetailPriority(value === 0 ? 4 : value)}
                    >
                      {value === 0 ? "None" : `P${value}`}
                    </Button>
                  );
                }}
              </For>
            </div>
          </section>

          <section class={panel} aria-labelledby="board-tags-heading">
            <h3 id="board-tags-heading" class={sectionTitle}>Tags</h3>
            <div class={chipRow}>
              <span class={projectChip}>#{activeBoardProjectID()}</span>
              <For each={detailVisibleLabels()}>{(tag) => <span class={labelChip}>@{tag}</span>}</For>
            </div>
          </section>

          <section class={panel} aria-labelledby="board-modifier-heading">
            <h3 id="board-modifier-heading" class={sectionTitle}>Modifier Slots</h3>
            <div class={modifierGrid}>
              <For each={[0, 1, 2, 3]}>
                {(slotIndex) => {
                  const card = createMemo(() => selectedModifierCards()[slotIndex] ?? null);
                  return (
                    <div class={slot}>
                      <strong>Slot {slotIndex + 1}</strong>
                      <span>{card() ? prettifyDefID(card()!.defId) : "Empty"}</span>
                    </div>
                  );
                }}
              </For>
            </div>
            <p class={muted}>
              {recurringModifierEnabled() || deadlineModifierEnabled()
                ? `Schedule parsing enabled for ${recurringModifierEnabled() ? "recurrence" : ""}${recurringModifierEnabled() && deadlineModifierEnabled() ? " and " : ""}${deadlineModifierEnabled() ? "due/deadline" : ""} phrases.`
                : 'Stack "Recurring" and/or "Deadline Pin" modifier cards on this task to enable schedule parsing.'}
            </p>
          </section>

          <section class={panel} aria-labelledby="board-villager-heading">
            <h3 id="board-villager-heading" class={sectionTitle}>Assigned Villager</h3>
            <p class={valueText}>{dataString(selectedTaskCard()?.data?.assignedVillagerId) || "Unassigned"}</p>
          </section>
        </div>

        <footer class={footer}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const id = selectedStackID();
              if (id) void completeStack(id);
            }}
            data-testid="board-detail-mark-done"
          >
            Mark done
          </Button>
          <Button type="button" variant="primary" onClick={() => void saveDetail()} data-testid="board-detail-save">
            Save changes
          </Button>
        </footer>
      </Dialog>
    </Show>
  );
}

const modal = css`width:min(48rem,100%);`;
const body = css`display:grid; gap:1rem; padding:1rem 1.25rem;`;
const panel = css`display:grid; gap:.7rem; border:1px solid var(--border-soft); border-radius:.85rem; padding:1rem; background:var(--panel-soft);`;
const sectionTitle = css`margin:0; color:var(--text-main); font-size:.82rem; letter-spacing:.1em; text-transform:uppercase;`;
const tokenPreview = css`display:flex; flex-wrap:wrap; gap:.15rem; color:var(--text-main); line-height:1.55;`;
const chipRow = css`display:flex; flex-wrap:wrap; gap:.4rem;`;
const chip = css`border:1px solid var(--border-soft); border-radius:.45rem; padding:.2rem .45rem; background:rgba(255,255,255,.035); color:var(--text-soft); font-size:.72rem;`;
const projectChip = css`${chip} border-color:rgba(196,69,255,.28); color:#efc4ff;`;
const labelChip = css`${chip} border-color:rgba(84,95,168,.32); color:#e0d8ff;`;
const muted = css`margin:0; color:var(--text-dim); font-size:.78rem; line-height:1.45;`;
const warning = css`margin:0; border:1px solid rgba(255,177,59,.25); border-radius:.65rem; padding:.6rem .7rem; background:rgba(255,138,0,.08); color:#ffd4a1; font-size:.78rem;`;
const messageStack = css`display:grid; gap:.45rem;`;
const scheduleCard = css`display:grid; gap:.35rem; border-left:3px solid var(--accent); padding:.65rem .75rem; background:rgba(255,255,255,.025); color:var(--text-soft); font-size:.78rem; & p{margin:0;} & summary{cursor:pointer; color:var(--text-main);}`;
const originalInput = css`margin-top:.4rem !important; color:var(--text-dim);`;
const fieldLabel = css`font-size:.7rem; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--text-dim);`;
const textarea = css`width:100%; resize:vertical; border:1px solid var(--border-strong); border-radius:.65rem; padding:.7rem; background:rgba(255,255,255,.035); color:var(--text-main); outline:none; &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}`;
const buttonRow = css`display:flex; flex-wrap:wrap; gap:.45rem;`;
const modifierGrid = css`display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.5rem; @media(max-width:36rem){grid-template-columns:1fr;}`;
const slot = css`display:flex; justify-content:space-between; gap:.7rem; border:1px solid var(--border-soft); border-radius:.6rem; padding:.55rem .65rem; color:var(--text-soft); font-size:.76rem;`;
const valueText = css`margin:0; color:var(--text-soft);`;
const footer = css`display:flex; justify-content:flex-end; gap:.6rem; padding:1rem 1.25rem 1.25rem; border-top:1px solid var(--border-soft);`;
