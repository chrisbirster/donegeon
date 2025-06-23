import { css } from '@linaria/core';

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

export const TaskProject = () => {
  return (
    <select class={outlineButton}>
      <option>Inbox</option>
      <option>Personal</option>
      <option>Blog Posts</option>
    </select>
  )
}
