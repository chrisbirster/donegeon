import { css } from "@linaria/core";

export const style1 = css`
position: fixed;
inset: calc(var(--spacing) * 0);
z-index: 50;
display: flex;
align-items: flex-start;
justify-content: center;
overflow-y: auto;
background-color: color-mix(in srgb, #000 60%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    background-color: color-mix(in oklab, var(--color-black) 60%, transparent);
  }
padding: calc(var(--spacing) * 3);
--tw-backdrop-blur: blur(var(--blur-sm));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
@media (width >= 48rem) {
    padding: calc(var(--spacing) * 4);
  }
`;

export const style2 = css`
margin-block: calc(var(--spacing) * 2);
display: flex;
max-height: calc(100vh - 1rem);
width: 100%;
max-width: 52rem;
flex-direction: column;
overflow: hidden;
border-radius: var(--radius-2xl);
--tw-shadow: 0 30px 100px var(--tw-shadow-color, rgba(0,0,0,0.55));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
@media (width >= 48rem) {
    margin-block: calc(var(--spacing) * 4);
  }
@media (width >= 48rem) {
    max-height: calc(100vh - 2rem);
  }
background: var(--panel); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

export const style3 = css`
display: flex;
align-items: center;
justify-content: space-between;
border-bottom-style: var(--tw-border-style);
  border-bottom-width: 1px;
border-color: var(--border-strong);
padding-inline: calc(var(--spacing) * 6);
padding-block: calc(var(--spacing) * 4);
`;

export const style4 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-tracking: var(--tracking-wider);
  letter-spacing: var(--tracking-wider);
color: var(--text-dim);
text-transform: uppercase;
`;

export const style5 = css`
border-radius: var(--radius-md);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

export const style6 = css`
display: grid;
min-height: calc(var(--spacing) * 0);
flex: 1;
gap: calc(var(--spacing) * 0);
overflow: hidden;
@media (width >= 48rem) {
    grid-template-columns: 1.15fr 0.85fr;
  }
`;

export const style7 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)));
  }
overflow-y: auto;
padding: calc(var(--spacing) * 6);
`;

export const style8 = css`
display: block;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: var(--tracking-wider);
  letter-spacing: var(--tracking-wider);
color: var(--text-dim);
text-transform: uppercase;
`;

export const style9 = css`
width: 100%;
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.03);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
color: var(--text-main);
--tw-outline-style: none;
  outline-style: none;
&:focus {
    border-color: var(--accent);
  }
`;

export const style10 = css`
height: calc(var(--spacing) * 40);
width: 100%;
resize: none;
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.03);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
--tw-outline-style: none;
  outline-style: none;
&:focus {
    border-color: var(--accent);
  }
`;

export const style11 = css`
overflow-y: auto;
border-top-style: var(--tw-border-style);
  border-top-width: 1px;
border-color: var(--border-strong);
padding: calc(var(--spacing) * 6);
@media (width >= 48rem) {
    border-top-style: var(--tw-border-style);
    border-top-width: 0px;
  }
@media (width >= 48rem) {
    border-left-style: var(--tw-border-style);
    border-left-width: 1px;
  }
`;

export const style12 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style13 = css`
display: flex;
align-items: center;
gap: calc(var(--spacing) * 2);
`;

export const style14 = css`
flex-shrink: 0;
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

export const style15 = css`
display: inline-flex;
`;

export const style16 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-dim);
`;

export const style17 = css`
color-scheme: dark;
`;

export const style18 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-muted);
`;

export const style19 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

export const style20 = css`
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

export const style21 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.03);
padding: calc(var(--spacing) * 3);
`;

export const style22 = css`
display: flex;
align-items: center;
justify-content: space-between;
`;

export const style23 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: var(--tracking-wider);
  letter-spacing: var(--tracking-wider);
color: var(--text-dim);
text-transform: uppercase;
`;

export const style24 = css`
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.03);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 2);
`;

export const style25 = css`
font-size: 11px;
--tw-tracking: var(--tracking-wider);
  letter-spacing: var(--tracking-wider);
color: var(--text-dim);
text-transform: uppercase;
`;

export const style26 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
`;

export const style27 = css`
margin-left: calc(var(--spacing) * 2);
color: var(--danger);
`;

export const style28 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style29 = css`
display: flex;
align-items: center;
justify-content: space-between;
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.03);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-main);
`;

export const style30 = css`
width: 100%;
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
&:disabled {
    cursor: not-allowed;
  }
&:disabled {
    opacity: 60%;
  }
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

export const style31 = css`
display: flex;
align-items: center;
justify-content: space-between;
border-top-style: var(--tw-border-style);
  border-top-width: 1px;
border-color: var(--border-strong);
padding-inline: calc(var(--spacing) * 6);
padding-block: calc(var(--spacing) * 4);
`;

export const style32 = css`
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

export const style33 = css`
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2);
--tw-font-weight: var(--font-weight-medium);
  font-weight: var(--font-weight-medium);
background: var(--accent); color: #1d1108; transition: background-color 160ms ease; &:hover { background: var(--accent-soft); }
`;
