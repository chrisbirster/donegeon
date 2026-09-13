import { css } from "@linaria/core";
import { For, Show } from "solid-js";

import { formatNotificationTime, notificationToneLabel } from "../../features/board/board-model";
import { useBoard } from "../../page/BoardContext";
import Button from "../Button";
import Dialog, { dialogEyebrow, dialogHeader, dialogTitle } from "../ui/Dialog";

const successTone = css`
  border-color: rgba(70,140,98,.34);
  background: var(--success-bg);
  color: var(--success);
`;
const errorTone = css`
  border-color: rgba(196,98,91,.28);
  background: var(--danger-bg);
  color: var(--danger);
`;
const infoTone = css`
  border-color: var(--border-strong);
  background: var(--panel-soft);
  color: var(--text-main);
`;

function notificationToneStyle(tone: string | undefined): string {
  switch ((tone ?? "").trim().toLowerCase()) {
    case "success":
      return successTone;
    case "error":
      return errorTone;
    default:
      return infoTone;
  }
}

export default function BoardNotificationHistory() {
  const {
    toast,
    notificationHistoryOpen,
    setNotificationHistoryOpen,
  } = useBoard();

  const close = () => setNotificationHistoryOpen(false);

  return (
    <Show when={notificationHistoryOpen()}>
      <Dialog
        ariaLabel="Recent notifications"
        onClose={close}
        testId="board-notification-history"
        class={modal}
      >
        <header class={dialogHeader}>
          <div>
            <p class={dialogEyebrow}>Board activity</p>
            <h2 class={dialogTitle}>Recent Notifications</h2>
            <p class={helper}>Recent board alerts and status messages for this session.</p>
          </div>
          <Button type="button" variant="ghost" onClick={close}>Close</Button>
        </header>

        <div class={historyList} data-testid="board-notification-history-list">
          <Show
            when={toast.history().length > 0}
            fallback={<p class={emptyState}>No notifications yet.</p>}
          >
            <For each={toast.history()}>
              {(entry) => (
                <article class={`${notificationCard} ${notificationToneStyle(entry.tone)}`}>
                  <div class={notificationBody}>
                    <div class={messageColumn}>
                      <p class={toneLabel}>{notificationToneLabel(entry.tone)}</p>
                      <p class={message}>{entry.message}</p>
                    </div>
                    <time class={timestamp} dateTime={entry.createdAt}>
                      {formatNotificationTime(entry.createdAt)}
                    </time>
                  </div>
                </article>
              )}
            </For>
          </Show>
        </div>

        <footer class={footer}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => toast.clearHistory()}
            disabled={toast.history().length === 0}
          >
            Clear history
          </Button>
        </footer>
      </Dialog>
    </Show>
  );
}

const modal = css`width:min(42rem,100%);`;
const helper = css`margin:.28rem 0 0; color:var(--text-dim); font-size:.78rem; line-height:1.4;`;
const historyList = css`display:grid; gap:.55rem; padding:1rem 1.25rem;`;
const notificationCard = css`
  border:1px solid var(--border-strong);
  border-radius:.75rem;
  padding:.75rem .85rem;
  box-shadow:0 12px 28px rgba(0,0,0,.25);
`;
const notificationBody = css`display:flex; align-items:flex-start; justify-content:space-between; gap:.8rem;`;
const messageColumn = css`min-width:0;`;
const toneLabel = css`margin:0; font-size:.66rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; opacity:.82;`;
const message = css`margin:.25rem 0 0; font-size:.84rem; line-height:1.4; overflow-wrap:anywhere;`;
const timestamp = css`flex:0 0 auto; font-size:.68rem; opacity:.76;`;
const emptyState = css`
  margin:0;
  border:1px dashed var(--border-soft);
  border-radius:.7rem;
  padding:1.2rem;
  color:var(--text-dim);
  text-align:center;
`;
const footer = css`display:flex; justify-content:flex-end; padding:0 1.25rem 1.25rem;`;
