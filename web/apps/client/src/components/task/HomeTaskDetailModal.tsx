import { css } from "@linaria/core";
import { For, Show, createEffect, createSignal } from "solid-js";

import {
  formatLabelsInput,
  formatModifierRequirementName,
  fromDatetimeLocalValue,
  isTeamBoardProject,
  parseLabelsInput,
  toDatetimeLocalValue,
} from "../../features/tasks/home-model";
import { organizationApi } from "../../lib/organizationApi";
import { useHome } from "../../page/HomeContext";
import Button from "../Button";
import Dialog from "../ui/Dialog";
import Picker from "../ui/Picker";
import LabelPicker from "./LabelPicker";
import ProjectPicker from "./ProjectPicker";
import SectionPicker from "./SectionPicker";

export default function HomeTaskDetailModal() {
  const {
    toast,
    setTasks,
    setError,
    detailTaskId,
    isDetailOpen,
    detailContent,
    setDetailContent,
    detailDescription,
    setDetailDescription,
    detailPriority,
    setDetailPriority,
    detailDueText,
    setDetailDueText,
    detailDeadline,
    setDetailDeadline,
    detailProjectId,
    setDetailProjectId,
    detailTags,
    setDetailTags,
    detailScheduleOriginal,
    detailRecurrence,
    setDetailRecurrence,
    detailRecurrenceCanonical,
    detailRecurrenceError,
    detailActivationPreview,
    detailActivationLoading,
    detailActivationError,
    detailActivating,
    projectMap,
    detailTask,
    detailTaskIsBoardProject,
    detailDueInputToken,
    detailDeadlineInputToken,
    detailScheduleWarning,
    completeTask,
    reopenTask,
    makeDetailTaskLive,
    closeDetailModal,
    projectByRef,
    saveDetailModal,
    parseDetailRecurrence,
  } = useHome();

  const [detailSectionId, setDetailSectionId] = createSignal("");
  const [sectionError, setSectionError] = createSignal("");
  let loadedTaskId = "";

  const selectedProjectId = () =>
    projectByRef(detailProjectId())?.id ?? detailTask()?.projectId ?? "";

  createEffect(
    () => ({ open: isDetailOpen(), task: detailTask() }),
    ({ open, task }) => {
      if (!open || !task) {
        loadedTaskId = "";
        return;
      }
      if (task.id === loadedTaskId) return;
      loadedTaskId = task.id;
      setDetailSectionId(task.sectionId ?? "");
      setSectionError("");
    },
  );

  async function selectProject(projectId: string) {
    setDetailProjectId(projectId);
    setDetailSectionId("");
  }

  async function saveWithSection() {
    const taskId = detailTaskId();
    if (!taskId) return;

    try {
      const targetProject = projectByRef(detailProjectId());
      const placement = await organizationApi.tasks.updatePlacement(
        taskId,
        targetProject?.id ?? "",
        targetProject ? detailSectionId() : "",
      );
      setTasks((current) => current.map((task) => task.id === taskId ? placement : task));
      await saveDetailModal();
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      setSectionError(message);
      toast.error(message);
    }
  }

  return (
    <Show when={isDetailOpen() && detailTask()}>
      <Dialog ariaLabel="Task detail" onClose={closeDetailModal} class={dialog} testId="task-detail-modal">
        <header class={header}>
          <div>
            <p class={eyebrow}>Task</p>
            <h2 class={heading}>Task detail</h2>
          </div>
          <Button type="button" onClick={closeDetailModal}>Close</Button>
        </header>

        <div class={body}>
          <div class={mainColumn}>
            <label class={fieldLabel} for="task-detail-title">Task</label>
            <input
              id="task-detail-title"
              value={detailContent()}
              onInput={(event) => setDetailContent(event.currentTarget.value)}
              class={textInput}
              data-testid="task-detail-title"
            />

            <label class={fieldLabel} for="task-detail-description">Description</label>
            <textarea
              id="task-detail-description"
              value={detailDescription()}
              onInput={(event) => setDetailDescription(event.currentTarget.value)}
              class={textarea}
              data-testid="task-detail-description"
            />
          </div>

          <div class={metadataColumn}>
            <ProjectPicker
              id="task-detail-project"
              value={selectedProjectId()}
              onChange={selectProject}
              testId="task-detail-project"
            />
            <Show when={isTeamBoardProject(detailTask()?.projectId, projectMap())}>
              <p class={teamBadge}>Team board project</p>
            </Show>

            <SectionPicker
              id="task-detail-section"
              projectId={selectedProjectId()}
              value={detailSectionId()}
              onChange={setDetailSectionId}
              testId="task-detail-section"
            />
            <Show when={sectionError()}><p class={errorBanner} role="alert">{sectionError()}</p></Show>

            <LabelPicker
              id="task-detail-labels"
              value={parseLabelsInput(detailTags())}
              onChange={(labels) => setDetailTags(formatLabelsInput(labels))}
              label="Labels"
              testId="task-detail-tags"
            />

            <Picker
              id="task-detail-priority"
              label="Priority"
              value={String(detailPriority())}
              options={[
                { value: "1", label: "P1" },
                { value: "2", label: "P2" },
                { value: "3", label: "P3" },
                { value: "4", label: "P4" },
              ]}
              onChange={(value) => setDetailPriority(Number(value))}
              testId="task-detail-priority"
            />

            <label class={fieldLabel} for="task-detail-due">Due · Scheduled for</label>
            <div class={inputActionRow}>
              <input
                id="task-detail-due"
                type="datetime-local"
                value={toDatetimeLocalValue(detailDueText())}
                onInput={(event) => setDetailDueText(fromDatetimeLocalValue(event.currentTarget.value))}
                class={textInput}
                data-testid="task-detail-due"
              />
              <Show when={detailDueText()}>
                <Button type="button" iconOnly aria-label="Clear due date" onClick={() => setDetailDueText("")}>✕</Button>
              </Show>
            </div>
            <Show when={detailDueInputToken()}>
              <p class={originalText}>Originally entered as: <code>{detailDueInputToken()}</code></p>
            </Show>

            <label class={fieldLabel} for="task-detail-deadline">Deadline · Must be finished by</label>
            <div class={inputActionRow}>
              <input
                id="task-detail-deadline"
                type="datetime-local"
                value={toDatetimeLocalValue(detailDeadline())}
                onInput={(event) => setDetailDeadline(fromDatetimeLocalValue(event.currentTarget.value))}
                class={textInput}
                data-testid="task-detail-deadline"
              />
              <Show when={detailDeadline()}>
                <Button type="button" iconOnly aria-label="Clear deadline" onClick={() => setDetailDeadline("")}>✕</Button>
              </Show>
            </div>
            <Show when={detailDeadlineInputToken()}>
              <p class={originalText}>Originally entered as: <code>{detailDeadlineInputToken()}</code></p>
            </Show>
            <Show when={detailScheduleWarning()}><p class={warningBanner}>{detailScheduleWarning()}</p></Show>

            <label class={fieldLabel} for="task-detail-schedule-original">Original scheduling text</label>
            <input
              id="task-detail-schedule-original"
              value={detailScheduleOriginal()}
              readonly
              placeholder="Not captured for this task."
              class={textInput}
              data-testid="task-detail-schedule-original"
            />
            <p class={helper}>Kept for audit/history. The date fields above are the current effective values.</p>

            <label class={fieldLabel} for="task-detail-recurrence">Recurrence rule (RRULE)</label>
            <input
              id="task-detail-recurrence"
              value={detailRecurrence()}
              onInput={(event) => setDetailRecurrence(event.currentTarget.value)}
              placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"
              class={textInput}
              data-testid="task-detail-recurrence"
            />
            <Button type="button" onClick={() => void parseDetailRecurrence()} data-testid="task-detail-parse-rrule">Validate RRULE</Button>
            <Show when={detailRecurrenceError()}><p class={errorBanner} role="alert">{detailRecurrenceError()}</p></Show>
            <Show when={detailRecurrenceCanonical()}>
              <p class={successBanner} role="status">
                {detailRecurrenceCanonical().trim().toUpperCase() === detailRecurrence().trim().toUpperCase()
                  ? "RRULE is valid."
                  : detailRecurrenceCanonical()}
              </p>
            </Show>

            <Show when={detailTaskIsBoardProject()}>
              <section class={boardActivation} aria-label="Board activation" data-testid="task-detail-board-activation">
                <div class={boardActivationHeader}>
                  <h3>Board activation</h3>
                  <Show when={detailActivationPreview()?.alreadyLive}><span class={successBadge}>Live</span></Show>
                </div>
                <Show when={detailActivationLoading()}><p class={helper}>Checking board requirements…</p></Show>
                <Show when={detailActivationError()}><p class={errorBanner} role="alert">{detailActivationError()}</p></Show>
                <Show when={detailActivationPreview()}>
                  {(preview) => (
                    <>
                      <Show when={preview().requirements.coin}>
                        {(coinRequirement) => (
                          <p class={requirementLine}>
                            <strong>Coin</strong>
                            <span>{coinRequirement().currency}: {coinRequirement().available}/{coinRequirement().required}</span>
                          </p>
                        )}
                      </Show>
                      <Show when={preview().requirements.modifiers.length > 0} fallback={<p class={helper}>No modifier cards required.</p>}>
                        <div class={requirements}>
                          <For each={preview().requirements.modifiers}>
                            {(requirement) => (
                              <p class={requirementLine}>
                                <span>{formatModifierRequirementName(requirement.defId)}</span>
                                <span>{requirement.available}/{requirement.required}</span>
                              </p>
                            )}
                          </For>
                        </div>
                      </Show>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => void makeDetailTaskLive()}
                        disabled={detailActivating() || detailActivationLoading() || preview().alreadyLive || !preview().canActivate}
                        data-testid="task-detail-make-live"
                      >
                        {preview().alreadyLive ? "Live on board" : detailActivating() ? "Activating…" : preview().canActivate ? "Make Live on Board" : "Missing requirements"}
                      </Button>
                    </>
                  )}
                </Show>
              </section>
            </Show>
          </div>
        </div>

        <footer class={footer}>
          <Button
            type="button"
            onClick={() => {
              const task = detailTask();
              if (task) task.checked ? void reopenTask(task) : void completeTask(task);
            }}
            data-testid="task-detail-mark-done"
          >
            {detailTask()?.checked ? "Reopen" : "Mark done"}
          </Button>
          <Button type="button" variant="primary" onClick={() => void saveWithSection()} data-testid="task-detail-save">Save changes</Button>
        </footer>
      </Dialog>
    </Show>
  );
}

const dialog = css`width:min(58rem,100%); overflow:hidden;`;
const header = css`display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.3rem; border-bottom:1px solid var(--border-strong);`;
const eyebrow = css`margin:0; color:var(--text-dim); font-size:.68rem; letter-spacing:.13em; text-transform:uppercase;`;
const heading = css`margin:.15rem 0 0; font-size:1.2rem;`;
const body = css`display:grid; min-height:0; @media (width >= 48rem){grid-template-columns:1.05fr .95fr;}`;
const mainColumn = css`display:flex; flex-direction:column; gap:.55rem; padding:1.3rem;`;
const metadataColumn = css`
  display:flex; flex-direction:column; gap:.75rem; padding:1.3rem; overflow:auto; border-top:1px solid var(--border-strong);
  @media (width >= 48rem){border-top:0; border-left:1px solid var(--border-strong);}
`;
const fieldLabel = css`font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);`;
const textInput = css`
  width:100%; border:1px solid var(--border-strong); border-radius:.7rem; padding:.68rem .8rem; background:rgba(255,255,255,.035);
  color:var(--text-main); color-scheme:dark; outline:none;
  &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}
`;
const textarea = css`
  min-height:14rem; resize:vertical; border:1px solid var(--border-strong); border-radius:.7rem; padding:.8rem; background:rgba(255,255,255,.035);
  color:var(--text-main); outline:none; &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}
`;
const inputActionRow = css`display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.45rem; align-items:center;`;
const helper = css`margin:0; color:var(--text-dim); font-size:.75rem; line-height:1.4;`;
const originalText = css`margin:-.25rem 0 0; color:var(--text-muted); font-size:.75rem; code{color:var(--text-soft);}`;
const teamBadge = css`align-self:flex-start; margin:0; border:1px solid rgba(126,141,214,.45); border-radius:.4rem; padding:.2rem .45rem; background:rgba(84,95,168,.22); color:#d8e1ff; font-size:.7rem; text-transform:uppercase;`;
const errorBanner = css`margin:0; border:1px solid rgba(255,181,173,.35); border-radius:.55rem; padding:.5rem .65rem; background:var(--danger-bg); color:var(--danger); font-size:.78rem;`;
const warningBanner = css`margin:0; border:1px solid rgba(255,212,161,.3); border-radius:.55rem; padding:.5rem .65rem; background:var(--warning-bg); color:var(--warning); font-size:.78rem;`;
const successBanner = css`margin:0; border:1px solid rgba(49,122,86,.42); border-radius:.55rem; padding:.5rem .65rem; background:var(--success-bg); color:var(--success); font-size:.78rem;`;
const boardActivation = css`display:flex; flex-direction:column; gap:.55rem; border:1px solid var(--border-soft); border-radius:.7rem; padding:.75rem; background:rgba(255,255,255,.018);`;
const boardActivationHeader = css`display:flex; align-items:center; justify-content:space-between; gap:.75rem; h3{margin:0; font-size:.9rem;}`;
const successBadge = css`border-radius:.4rem; padding:.2rem .4rem; background:var(--success-bg); color:var(--success); font-size:.7rem;`;
const requirements = css`display:flex; flex-direction:column; gap:.35rem;`;
const requirementLine = css`display:flex; justify-content:space-between; gap:.75rem; margin:0; font-size:.76rem; color:var(--text-soft);`;
const footer = css`display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:1rem 1.3rem; border-top:1px solid var(--border-strong);`;
