import { css } from "@linaria/core";

export const contentPanel = css`
  display:flex; height:100%; min-height:0; flex-direction:column;
  border:1px solid var(--border-strong); border-radius:var(--radius-3xl);
  padding:1.5rem; background:linear-gradient(180deg,var(--panel-strong-start),var(--panel-strong-end));
  box-shadow:var(--shadow-elevated); backdrop-filter:blur(18px);
  @media (width >= 48rem) { padding:2rem; }
`;
export const errorSpacing = css`margin-bottom:1rem;`;
export const scrollArea = css`min-height:0; flex:1; overflow-y:auto; padding-right:.2rem; scroll-behavior:smooth;`;
export const taskList = css`
  list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.55rem; width:100%;
`;
export const sectionJump = css`
  position:sticky; top:0; z-index:5; display:flex; justify-content:flex-end; gap:.4rem;
  margin:0 0 .75rem; padding:.35rem 0 .55rem;
  background:linear-gradient(180deg,var(--panel-strong-start) 68%,transparent);
`;
export const jumpButton = css`
  border:1px solid var(--border-strong); border-radius:999px; padding:.34rem .62rem;
  background:var(--palette-rgba-255-255-255-025-40fa64); color:var(--text-soft); font-size:.72rem;
  &:hover { border-color:var(--palette-rgba-196-69-255-42-dc5806); color:var(--text-main); }
`;
export const sectionBlock = css`scroll-margin-top:3.25rem;`;
export const completedBlock = css`scroll-margin-top:3.25rem; margin-top:1.5rem;`;
export const sectionHeader = css`
  display:flex; align-items:center; justify-content:space-between; gap:1rem; margin:0 0 .7rem;
`;
export const sectionTitle = css`
  font-size:.76rem; line-height:1.2; font-weight:750; letter-spacing:.13em; color:var(--text-dim); text-transform:uppercase;
`;
export const sectionCount = css`font-size:.76rem; color:var(--text-dim); font-variant-numeric:tabular-nums;`;
export const emptyState = css`
  border:1px dashed var(--border-soft); border-radius:.9rem; padding:1.2rem; color:var(--text-dim); font-size:.9rem;
`;
export const taskRow = css`
  display:grid; grid-template-columns:1.6rem 1.45rem minmax(0,1fr) auto auto; align-items:center; gap:.7rem;
  width:100%; border:1px solid var(--palette-rgba-119-155-187-2-f94e1b); border-radius:.85rem;
  background:var(--panel-soft); padding:.78rem .9rem; transition:border-color 160ms ease,background-color 160ms ease;
  &:hover { border-color:var(--palette-rgba-119-155-187-38-88d5fc); }
`;
export const taskRowDrop = css`border-color:var(--accent); background:var(--palette-rgba-196-69-255-075-e4e941);`;
export const taskRowNextAction = css`border-color:var(--palette-rgba-255-139-80-3-a325f0); background:var(--palette-rgba-255-139-80-06-75a0b4);`;
export const completedTaskRow = css`
  display:grid; grid-template-columns:1.6rem 1.45rem minmax(0,1fr) auto auto; align-items:center; gap:.7rem;
  width:100%; border:1px solid var(--palette-rgba-119-155-187-16-97d8d0); border-radius:.85rem;
  background:var(--palette-rgba-255-255-255-018-d34853); padding:.78rem .9rem; color:var(--text-muted);
  transition:border-color 160ms ease,background-color 160ms ease;
  &:hover { border-color:var(--palette-rgba-119-155-187-32-a90e71); background:var(--palette-rgba-255-255-255-026-31b6bd); }
`;
export const dragHandle = css`
  display:flex; align-items:center; justify-content:center; width:1.6rem; height:1.8rem;
  border:0; border-radius:.35rem; background:transparent; color:var(--text-dim);
  cursor:grab; user-select:none; font-size:.9rem; letter-spacing:-.08em;
  &:hover, &:focus-visible { background:var(--palette-rgba-255-255-255-05-44501a); color:var(--text-main); outline:none; }
  &:active { cursor:grabbing; }
`;
export const dragHandleActive = css`color:var(--palette-hex-e59cff-70194a);`;
export const openStatus = css`
  width:1.25rem; height:1.25rem; border:1px solid var(--palette-rgba-196-69-255-58-d3ddfb); border-radius:999px;
  background:transparent; transition:background 140ms ease,border-color 140ms ease;
  &:hover { border-color:var(--palette-hex-d943ff-12f58f); background:var(--palette-rgba-196-69-255-16-058e42); }
`;
export const completedStatus = css`
  display:flex; align-items:center; justify-content:center; width:1.25rem; height:1.25rem;
  border:1px solid var(--palette-rgba-49-160-100-5-f485fd); border-radius:999px; background:var(--palette-rgba-49-122-86-22-df2ca1); color:var(--palette-hex-69e3a2-dc8215); font-size:.7rem;
`;
export const taskBody = css`min-width:0;`;
export const taskTitle = css`
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  color:var(--text-main); font-size:1rem; line-height:1.35; font-weight:550;
`;
export const completedTitle = css`
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  color:var(--text-soft); font-size:1rem; line-height:1.35; text-decoration:line-through;
`;
export const description = css`
  margin-top:.16rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  color:var(--text-soft); font-size:.8rem; line-height:1.35;
`;
export const completedDescription = css`
  margin-top:.16rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  color:var(--text-dim); font-size:.8rem; line-height:1.35;
`;
export const metadata = css`
  display:flex; flex-wrap:wrap; align-items:center; gap:.35rem; margin-top:.35rem;
  color:var(--text-dim); font-size:.72rem; line-height:1.25;
`;
export const metaBadge = css`border-radius:.42rem; padding:.14rem .4rem; background:var(--palette-rgba-103-187-255-08-6175aa); color:var(--text-dim);`;
export const projectBadge = css`border-radius:.42rem; padding:.14rem .4rem; background:var(--palette-rgba-196-69-255-11-5200d9); color:var(--palette-hex-e8c8ff-c72113);`;
export const teamBadge = css`margin-left:.25rem; color:var(--palette-hex-f0b8ff-981dd0); font-size:.64rem; font-weight:750; letter-spacing:.07em; text-transform:uppercase;`;
export const dueBadge = css`border-radius:.42rem; padding:.14rem .4rem; background:var(--palette-rgba-110-78-21-34-b00d78); color:var(--palette-hex-ffd4a1-b83647);`;
export const deadlineBadge = css`border-radius:.42rem; padding:.14rem .4rem; background:var(--palette-rgba-74-78-156-35-8ee061); color:var(--palette-hex-ddd9ff-e3a001);`;
export const warningBadge = css`border-radius:.42rem; padding:.14rem .4rem; background:var(--palette-rgba-129-61-28-35-540f97); color:var(--palette-hex-ffd4b5-fb24c9);`;
export const liveBadge = css`border-radius:.42rem; padding:.14rem .4rem; background:var(--palette-rgba-24-88-57-33-9ac90a); color:var(--palette-hex-c7f6d4-5832b1);`;
export const boardDraftBadge = css`border-radius:.42rem; padding:.14rem .4rem; background:var(--palette-rgba-97-76-132-26-b672c3); color:var(--palette-hex-d9c6ff-c45a1a);`;
export const priority = css`border-radius:.42rem; padding:.22rem .48rem; font-size:.72rem; font-weight:650;`;
export const priorityHigh = css`background:var(--palette-rgba-255-139-80-18-a09bf9); color:var(--palette-hex-ffd7b7-e9306f);`;
export const priorityNormal = css`background:var(--palette-rgba-103-187-255-1-a54c91); color:var(--palette-hex-cfe3ff-00cd26);`;
export const actions = css`
  display:flex; align-items:center; justify-content:flex-end; gap:.35rem; min-width:0;
  opacity:.55; transition:opacity 150ms ease;
  :is(li:hover) & { opacity:1; }
  @media (max-width: 70rem) { opacity:1; }
`;
export const actionButton = css`
  border:1px solid var(--border-strong); border-radius:.45rem; padding:.38rem .55rem;
  background:var(--palette-rgba-255-255-255-022-6850d0); color:var(--text-soft); font-size:.72rem; font-weight:650;
  &:hover { border-color:var(--border-hover); color:var(--text-main); }
`;
export const iconActionButton = css`
  border:1px solid var(--border-strong); border-radius:.45rem; width:2rem; height:1.9rem;
  background:var(--palette-rgba-255-255-255-022-6850d0); color:var(--text-soft); font-size:.8rem;
  &:hover { border-color:var(--border-hover); color:var(--text-main); }
`;
export const destructiveButton = css`
  border:1px solid var(--palette-rgba-255-181-173-28-4ef680); border-radius:.45rem; padding:.38rem .55rem;
  background:var(--danger-bg); color:var(--danger); font-size:.72rem; font-weight:650;
  &:hover { border-color:var(--palette-rgba-255-181-173-5-0a8960); }
`;
export const restoreButton = css`
  border:1px solid var(--palette-rgba-92-173-131-36-9a77ba); border-radius:.45rem; padding:.38rem .55rem;
  background:var(--success-bg); color:var(--success); font-size:.72rem; font-weight:650;
  &:hover { border-color:var(--palette-rgba-92-173-131-58-9921c5); }
`;
export const inlineEdit = css`display:flex; align-items:center; gap:.45rem;`;
export const inlineInput = css`
  width:100%; border:1px solid var(--border-strong); border-radius:.55rem; padding:.45rem .55rem;
  background:var(--palette-rgba-255-255-255-025-40fa64); color:var(--text-main); font-size:.92rem; outline:none;
  &:focus { border-color:var(--accent); }
`;
