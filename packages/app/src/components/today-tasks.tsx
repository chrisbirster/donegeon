import {
  For,
  type Accessor
} from 'solid-js';
import { css } from '@linaria/core';
import dayjs from 'dayjs';
import {
  updateTask,
  deleteTask
} from '../server/api';
import {
  Circle,
} from 'lucide-solid';
import type { Task } from '@donegeon/db';

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

type TodayTaskProps = {
  tasks: Accessor<Task[]>
}

export const TodayTasks = (props: TodayTaskProps) => {
  return (
    <div class={css`margin-bottom:2rem;`}>
      <h2 class={css`font-weight:500; color:#9ca3af; margin-bottom:0.5rem;`}>
        {dayjs().format('MMM D')} • Today • {dayjs().format('dddd')}
      </h2>

      <For each={props.tasks()}>
        {(task) => (
          <div class={taskRow}>
            <Circle size={20} color="#6b7280"
              onClick={() => updateTask(task.id)}
            />
            <div class={taskContent}>
              <div class={taskTitle}>{task.title}</div>
            </div>
            <button class={outlineButton} onClick={() => deleteTask(task.id)}>
              Inbox 📥
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
