import {
  createSignal,
  For,
  Show,
} from 'solid-js';
import { css } from '@linaria/core';
import dayjs from 'dayjs';
import { useTasks } from "./context-task-manager";
import {
  Circle,
  Bell,
  MoreHorizontal,
  X,
  Calendar,
  ChevronDown,
} from 'lucide-solid';
import { Sidebar } from './sidebar';
import { Navbar } from './navbar';
import { TaskPriority } from './task-priority';
import { TaskProject } from './task-project';
import { TaskHeader } from './task-header';

const layout = css`
  display: flex;
  height: 100vh;
  font-family: system-ui, sans-serif;
  background: #111827;
  color: #f9fafb;
`;

const main = css`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const content = css`
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
`;

const sectionHeader = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
`;

const sectionHeaderLeft = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
`;

const sectionHeaderRight = css`
  font-size: 0.875rem;
  color: #f87171;
  cursor: pointer;
`;

const taskRow = css`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  transition: background 0.15s;
  &:hover {
    background: #1f2937;
  }
`;

const taskContent = css`
  flex: 1;
`;

const taskTitle = css`
  color: #e5e7eb;
  font-size: 1rem;
`;

const taskMeta = css`
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #9ca3af;
  margin-top: 0.25rem;
`;

const taskMetaItem = css`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const modalOverlay = css`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
`;

const modal = css`
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  padding: 1.5rem;
  width: 100%;
  max-width: 40rem;
`;

const formGroup = css`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const input = css`
  padding: 0.5rem;
  border: 1px solid #4b5563;
  border-radius: 0.25rem;
  background: #111827;
  color: #f9fafb;
  font-size: 0.95rem;
  &::placeholder {
    color: #6b7280;
  }
  &:focus {
    outline: none;
    border-color: #2563eb;
  }
`;

const textarea = css`
  ${input};
  min-height: 4rem;
  resize: vertical;
`;

const formFooter = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const primaryButton = css`
  background: #dc2626;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-weight: 600;
  &:hover {
    background: #b91c1c;
  }
`;

const outlineButton = css`
  background: transparent;
  border: 1px solid #4b5563;
  color: #d1d5db;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  &:hover {
    background: #374151;
  }
`;



export const Task = () => {
  const tasks = useTasks();
  const [showModal, setShowModal] = createSignal(false);
  const [newTitle, setNewTitle] = createSignal('');
  const [newDesc, setNewDesc] = createSignal('');

  // — grouping
  const overdue = () =>
    tasks.tasks?.filter(t => t.status === 'pending' &&
      t.dueAt != null &&
      dayjs(t.dueAt).isBefore(dayjs())
    ) || [];

  const today = () =>
    tasks.tasks?.filter(t =>
      t.status === 'pending' &&
      (!t.dueAt || dayjs(t.dueAt).isSame(dayjs(), 'day'))
    ) || [];

  const headerCount = () => today().length + overdue().length

  const handleAddTask = async () => {
    await tasks.add({
      title: newTitle(),
      description: newDesc(),
    });
    setShowModal(false)
    setNewTitle('')
    setNewDesc('')
  };

  return (
    <div class={layout}>
      <Sidebar setShowModal={setShowModal} />
      {/* ——— MAIN AREA ————————————————————————————————————————————————————— */}
      <main class={main}>
        <Navbar />
        <section class={content}>
          <TaskHeader count={headerCount()} />

          {/* — Overdue — */}
          <Show when={overdue().length > 0}>
            <div class={css`margin-bottom:1.5rem;`}>
              <div class={sectionHeader}>
                <div class={sectionHeaderLeft}>
                  <ChevronDown size={16} color="#9ca3af" />
                  <span>Overdue</span>
                </div>
                <div class={sectionHeaderRight}>Reschedule</div>
              </div>

              <For each={overdue()}>
                {(task) => (
                  <div class={taskRow}>
                    <Circle size={20} color="#6b7280" />

                    <div class={taskContent}>
                      <div class={taskTitle}>{task.title}</div>
                      <div class={taskMeta}>
                        <span class={taskMetaItem}>📅 {dayjs(task.dueAt).format('MMM D')}</span>
                        {task.tags && (
                          <span class={taskMetaItem}>🏷️ {JSON.parse(task.tags).join(', ')}</span>
                        )}
                      </div>
                    </div>

                    <button class={outlineButton}>
                      Inbox 📥
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* — Today’s tasks — */}
          <div class={css`margin-bottom:2rem;`}>
            <h2 class={css`font-weight:500; color:#9ca3af; margin-bottom:0.5rem;`}>
              {dayjs().format('MMM D')} • Today • {dayjs().format('dddd')}
            </h2>

            <For each={today()}>
              {(task) => (
                <div class={taskRow}>
                  <Circle size={20} color="#6b7280" />
                  <div class={taskContent}>
                    <div class={taskTitle}>{task.title}</div>
                  </div>
                  <button class={outlineButton}>
                    Inbox 📥
                  </button>
                </div>
              )}
            </For>
          </div>
        </section>
      </main>

      {/* ——— NEW TASK MODAL ————————————————————————————————————————————————— */}
      <Show when={showModal()}>
        <div class={modalOverlay}>
          <div class={modal}>
            <div class={formGroup}>
              <input
                class={input}
                placeholder="Task name"
                value={newTitle()}
                onInput={e => setNewTitle(e.currentTarget.value)}
              />
            </div>

            <div class={formGroup}>
              <textarea
                class={textarea}
                placeholder="Description"
                value={newDesc()}
                onInput={e => setNewDesc(e.currentTarget.value)}
              />
            </div>

            <div class={css`display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem;`}>
              <span class={css`background:#059669; color:white; padding:0.25rem 0.5rem; border-radius:0.25rem; display:flex; align-items:center; gap:0.25rem;`}>
                <Calendar size={14} /> Today
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => {/* clear dueAt */ }} />
              </span>
              <TaskPriority />
              <button class={outlineButton}>
                <Bell size={16} /> Reminders
              </button>
              <button class={outlineButton}>
                <MoreHorizontal size={16} />
              </button>
            </div>

            <div class={formFooter}>
              <TaskProject />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button class={outlineButton} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button class={primaryButton} onClick={handleAddTask}>
                  Add task
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};
