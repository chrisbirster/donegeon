import type { Accessor } from 'solid-js';
import { css } from '@linaria/core';
import {
  CircleCheckBig,
} from 'lucide-solid';

const container = css`
  margin-bottom:1.5rem;
`;

const header = css`
  font-size:1.75rem; 
  font-weight:700; 
  margin-bottom:0.25rem;
`;

const smallText = css`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.875rem;
  color: #9ca3af;
`;

type TodayHeaderProps = {
  tasksTodayCount: Accessor<number>
}

export const TodayHeader = (props: TodayHeaderProps) => {
  return (
    <div class={container}>
      <h1 class={header}>Today</h1>
      <div class={smallText}>
        <CircleCheckBig size={16} /> {props.tasksTodayCount()} tasks
      </div>
    </div>
  );
}
