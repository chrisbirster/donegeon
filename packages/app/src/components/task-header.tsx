import { css } from '@linaria/core';
import {
  Circle,
} from 'lucide-solid';

const smallText = css`
  display: flex; 
  gap: 0.5rem; 
  align-items: center;
  font-size: 0.875rem;
  color: #9ca3af;
`;

const container = css`
  margin-bottom:1.5rem;
`;

const header = css`
  font-size:1.75rem; 
  font-weight:700; 
  margin-bottom:0.25rem;
`;

type TaskHeaderProps = {
  count: number;
}
export const TaskHeader = (props: TaskHeaderProps) => {

  return (
    <div class={container}>
      <h1 class={header}>
        Today
      </h1>
      <div class={smallText}>
        <Circle size={16} /> {props.count} tasks
      </div>
    </div>
  );
};
