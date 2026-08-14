import { css } from "@linaria/core";

export const style1 = css`
position: fixed;
inset: calc(var(--spacing) * 0);
z-index: 80;
display: flex;
align-items: center;
justify-content: center;
padding: calc(var(--spacing) * 3);
--tw-backdrop-blur: blur(var(--blur-sm));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
@media (width >= 48rem) {
    padding: calc(var(--spacing) * 4);
  }
`;

export const style2 = css`
display: flex;
align-items: flex-start;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

export const style3 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style4 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

export const style5 = css`
margin-top: calc(var(--spacing) * 4);
display: grid;
gap: calc(var(--spacing) * 4);
@media (width >= 48rem) {
    grid-template-columns: 260px minmax(0,1fr);
  }
`;

export const style6 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style7 = css`
border-radius: var(--radius-2xl);
padding: calc(var(--spacing) * 4);
background: var(--panel-soft); border: 1px solid var(--border-soft); backdrop-filter: blur(12px);
`;

export const style8 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.1em;
  letter-spacing: 0.1em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style9 = css`
margin-top: calc(var(--spacing) * 3);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style10 = css`
display: block;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.1em;
  letter-spacing: 0.1em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style11 = css`
margin-top: calc(var(--spacing) * 1);
width: 100%;
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); &:focus { border-color: var(--accent); outline: none; }
`;

export const style12 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-soft);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

export const style13 = css`
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

export const style14 = css`
width: 100%;
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,139,80,0.28);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
&:disabled {
    opacity: 60%;
  }
background: var(--accent); color: #1d1108; transition: background-color 160ms ease; &:hover { background: var(--accent-soft); }
`;

export const style15 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

export const style16 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

export const style17 = css`
margin-top: calc(var(--spacing) * 3);
max-height: 360px;
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
overflow-y: auto;
padding-right: calc(var(--spacing) * 1);
`;

export const style18 = css`
width: 100%;
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
text-align: left;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
`;

export const style19 = css`
border-color: rgba(255,139,80,0.24);
background-color: var(--accent-wash);
`;

export const style20 = css`
border-color: var(--border-strong);
background-color: var(--panel);
&:hover {
    @media (hover: hover) {
      border-color: var(--border-hover);
    }
  }
`;

export const style21 = css`
min-width: calc(var(--spacing) * 0);
`;

export const style22 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

export const style23 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

export const style24 = css`
display: flex;
flex-shrink: 0;
flex-direction: column;
align-items: flex-end;
gap: calc(var(--spacing) * 1);
`;

export const style25 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

export const style26 = css`
display: flex;
flex-direction: column;
gap: calc(var(--spacing) * 3);
@media (width >= 48rem) {
    flex-direction: row;
  }
@media (width >= 48rem) {
    align-items: flex-start;
  }
@media (width >= 48rem) {
    justify-content: space-between;
  }
`;

export const style27 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

export const style28 = css`
display: flex;
flex-wrap: wrap;
gap: calc(var(--spacing) * 2);
`;

export const style29 = css`
margin-top: calc(var(--spacing) * 4);
display: flex;
flex-direction: column;
gap: calc(var(--spacing) * 3);
@media (width >= 48rem) {
    flex-direction: row;
  }
@media (width >= 48rem) {
    align-items: flex-end;
  }
`;

export const style30 = css`
flex: 1;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.1em;
  letter-spacing: 0.1em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style31 = css`
margin-top: calc(var(--spacing) * 3);
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-soft);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

export const style32 = css`
margin-top: calc(var(--spacing) * 3);
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-soft);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

export const style33 = css`
margin-top: calc(var(--spacing) * 3);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style34 = css`
display: flex;
align-items: flex-start;
gap: calc(var(--spacing) * 3);
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
`;

export const style35 = css`
margin-top: calc(var(--spacing) * 1);
height: calc(var(--spacing) * 4);
width: calc(var(--spacing) * 4);
accent-color: var(--accent);
`;

export const style36 = css`
min-width: calc(var(--spacing) * 0);
flex: 1;
`;

export const style37 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

export const style38 = css`
margin-top: calc(var(--spacing) * 4);
border-top-style: var(--tw-border-style);
  border-top-width: 1px;
border-color: var(--border-strong);
padding-top: calc(var(--spacing) * 4);
`;

export const style39 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

export const style40 = css`
margin-top: calc(var(--spacing) * 2);
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(223,173,87,0.24);
background-color: var(--warning-bg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--warning);
`;

export const style41 = css`
margin-top: calc(var(--spacing) * 3);
`;
