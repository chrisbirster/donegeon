import { css } from "@linaria/core";

export const style1 = css`
display: flex;
height: 100%;
min-height: calc(var(--spacing) * 0);
flex-direction: column;
border-radius: var(--radius-3xl);
padding: calc(var(--spacing) * 6);
@media (width >= 48rem) {
    padding: calc(var(--spacing) * 8);
  }
background: linear-gradient(180deg, var(--panel-strong-start), var(--panel-strong-end)); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

export const style2 = css`
margin-bottom: calc(var(--spacing) * 4);
`;

export const style3 = css`
min-height: calc(var(--spacing) * 0);
flex: 1;
overflow-y: auto;
padding-right: calc(var(--spacing) * 1);
`;

export const style4 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style5 = css`
cursor: grab;
border-radius: 0.25rem;
padding-inline: calc(var(--spacing) * 1);
color: var(--text-muted);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
-webkit-user-select: none;
  user-select: none;
&:hover {
    @media (hover: hover) {
      background-color: rgba(255,255,255,0.06);
    }
  }
&:hover {
    @media (hover: hover) {
      color: var(--color-white);
    }
  }
`;

export const style6 = css`
opacity: 100%;
`;

export const style7 = css`
opacity: 0%;
&:is(:where(.group):hover *) {
    @media (hover: hover) {
      opacity: 100%;
    }
  }
&:focus-visible {
    opacity: 100%;
  }
`;

export const style8 = css`
height: calc(var(--spacing) * 5);
width: calc(var(--spacing) * 5);
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: transparent;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: var(--accent);
    }
  }
`;

export const style9 = css`
min-width: calc(var(--spacing) * 0);
flex: 1;
`;

export const style10 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
`;

export const style11 = css`
margin-top: calc(var(--spacing) * 1);
display: flex;
flex-wrap: wrap;
align-items: center;
gap: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-dim);
`;

export const style12 = css`
display: inline-flex;
align-items: center;
gap: calc(var(--spacing) * 1);
`;

export const style13 = css`
display: flex;
align-items: center;
gap: calc(var(--spacing) * 2);
`;

export const style14 = css`
width: 100%;
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.03);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
--tw-outline-style: none;
  outline-style: none;
&:focus {
    border-color: var(--accent);
  }
`;

export const style15 = css`
border-radius: var(--radius-md);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
background: var(--accent); color: #1d1108; transition: background-color 160ms ease; &:hover { background: var(--accent-soft); }
`;

export const style16 = css`
border-radius: var(--radius-md);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

export const style17 = css`
border-radius: var(--radius-md);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
`;

export const style18 = css`
background-color: rgba(255,139,80,0.18);
color: #ffd7b7;
`;

export const style19 = css`
background-color: rgba(103,187,255,0.12);
color: #cfe3ff;
`;

export const style20 = css`
margin-left: calc(var(--spacing) * 1);
display: flex;
align-items: center;
gap: calc(var(--spacing) * 1);
opacity: 0%;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:is(:where(.group):hover *) {
    @media (hover: hover) {
      opacity: 100%;
    }
  }
`;

export const style21 = css`
margin-top: calc(var(--spacing) * 6);
`;

export const style22 = css`
margin-top: calc(var(--spacing) * 4);
`;

export const style23 = css`
margin-bottom: calc(var(--spacing) * 3);
display: flex;
align-items: center;
justify-content: space-between;
`;

export const style24 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style25 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-dim);
`;

export const style26 = css`
display: flex;
height: calc(var(--spacing) * 5);
width: calc(var(--spacing) * 5);
align-items: center;
justify-content: center;
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(49,122,86,0.42);
background-color: var(--success-bg);
font-size: 11px;
color: var(--success);
`;

export const style27 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
text-decoration-line: line-through;
`;

export const taskRow = css`
display: flex;
align-items: center;
gap: calc(var(--spacing) * 3);
border: 1px solid rgba(119,155,187,0.18);
border-radius: var(--radius-xl);
background: var(--panel-soft);
padding: calc(var(--spacing) * 3);
transition: border-color 160ms ease, background-color 160ms ease;
&:hover { border-color: rgba(119,155,187,0.32); }
`;

export const taskRowDrop = css`
border-color: var(--accent);
background: rgba(255,139,80,0.08);
`;

export const taskRowNextAction = css`
border-color: rgba(255,139,80,0.28);
background: rgba(255,139,80,0.08);
&:hover { border-color: #ffb27f; }
`;

export const completedTaskRow = css`
display: flex;
align-items: center;
gap: calc(var(--spacing) * 3);
border: 1px solid rgba(119,155,187,0.16);
border-radius: var(--radius-xl);
background: var(--panel-soft);
padding: calc(var(--spacing) * 3);
color: var(--text-muted);
transition: border-color 160ms ease;
&:hover { border-color: rgba(119,155,187,0.28); }
`;
