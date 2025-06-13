import {
  createMemo,
  createResource,
  createSignal,
  Show,
} from 'solid-js';
import { css } from '@linaria/core';
import dayjs from 'dayjs';
import {
  listTasks,
  createTask,
} from '../server/api';
import {
  Bell,
  Flag,
  MoreHorizontal,
  X,
  Calendar,
} from 'lucide-solid';
import { Sidebar } from './sidebar';
import { Navbar } from './navbar';
import type { Task } from '@donegeon/db';
import { useAction } from "@solidjs/router";
import { OverDue } from './overdue-tasks';
import { TodayTasks } from './today-tasks';
import { TodayHeader } from './today-header';

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

export default function DonegeonApp() {
  const [tasks, { refetch }] = createResource<Task[]>(listTasks);
  const [showModal, setShowModal] = createSignal(false);
  const [newTitle, setNewTitle] = createSignal('');
  const [newDesc, setNewDesc] = createSignal('');
  const [newStatus, setNewStatus] = createSignal('pending');
  const [newPriority, setNewPriority] = createSignal(3);
  const createTaskAction = useAction(createTask);

  const overdue = () =>
    tasks()?.filter(t => t.status === 'pending' &&
      t.dueAt != null &&
      dayjs(t.dueAt).isBefore(dayjs())
    ) || [];

  const today = () =>
    tasks()?.filter(t =>
      t.status === 'pending' &&
      (!t.dueAt || dayjs(t.dueAt).isSame(dayjs(), 'day'))
    ) || [];

  const todayTasksCount = createMemo(() => (today().length + overdue().length));

  const handleCreate = async () => {
    await createTaskAction({
      title: newTitle(),
      description: newDesc(),
      dueAt: Date.now(),
      priority: 3,
    } as Task);
    setNewTitle('');
    setNewDesc('');
    await refetch();
  };

  return (
    <div class={layout}>
      <Sidebar setShowModal={setShowModal} />
      <main class={main}>
        <Navbar />
        <section class={content}>
          <TodayHeader tasksTodayCount={todayTasksCount} />
          <OverDue tasks={overdue} />
          <TodayTasks tasks={today} />
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

              <button class={outlineButton}>
                <Flag size={16} /> Priority
              </button>
              <button class={outlineButton}>
                <Bell size={16} /> Reminders
              </button>
              <button class={outlineButton}>
                <MoreHorizontal size={16} />
              </button>
            </div>

            <div class={formFooter}>
              <select class={outlineButton}>
                <option>Inbox</option>
                <option>Personal</option>
                <option>Blog Posts</option>
              </select>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button class={outlineButton} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button class={primaryButton} onClick={handleCreate}>
                  Add task
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
