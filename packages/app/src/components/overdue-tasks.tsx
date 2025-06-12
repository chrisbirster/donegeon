import {
  For,
  Show,
  type Accessor,
} from 'solid-js';
import { css } from '@linaria/core';
import dayjs from 'dayjs';
import {
  updateTask,
  deleteTask
} from '../server/api';
import {
  Circle,
  ChevronDown,
} from 'lucide-solid';
import type { Task } from '../types';


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

type OverDueProps = {
  tasks: Accessor<Task[]>;
}

export const OverDue = (props: OverDueProps) => {
  console.log(props.tasks());
  return (
    <Show when={props.tasks().length > 0}>
      <div class={css`margin-bottom:1.5rem;`}>
        <div class={sectionHeader}>
          <div class={sectionHeaderLeft}>
            <ChevronDown size={16} color="#9ca3af" />
            <span>Overdue</span>
          </div>
          <div class={sectionHeaderRight}>Reschedule</div>
        </div>

        <For each={props.tasks()}>
          {(task) => (
            <div class={taskRow}>
              <Circle size={20} color="#6b7280"
                onClick={() => updateTask(task.id)}
              />

              <div class={taskContent}>
                <div class={taskTitle}>{task.title}</div>
                <div class={taskMeta}>
                  <span class={taskMetaItem}>📅 {dayjs(task.dueAt).format('MMM D')}</span>
                  {task.tags && (
                    <span class={taskMetaItem}>🏷️ {JSON.parse(task.tags).join(', ')}</span>
                  )}
                </div>
              </div>

              <button class={outlineButton} onClick={() => deleteTask(task.id)}>
                Inbox 📥
              </button>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
