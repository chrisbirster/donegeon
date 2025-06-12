import { css } from '@linaria/core';

const header = css`
  padding: 1rem;
  border-bottom: 1px solid #374151;
  display: flex;
  justify-content: end;
  align-items: center;
  border: none;
`;

// const outlineButton = css`
//   background: transparent;
//   border: 1px solid #4b5563;
//   color: #d1d5db;
//   padding: 0.5rem 1rem;
//   border-radius: 0.25rem;
//   cursor: pointer;
//   display: flex;
//   align-items: center;
//   gap: 0.5rem;
//   &:hover {
//     background: #374151;
//   }
// `;

const container = css`
  background-color: red;
  display: flex;
  gap: 0.5rem;
`;

export const Navbar = () => {
  return (
    <header class={header}>
      <div class={container} />
    </header >
  );
}
