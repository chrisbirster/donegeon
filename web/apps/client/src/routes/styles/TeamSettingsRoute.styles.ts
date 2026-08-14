import { css } from "@linaria/core";

export const style1 = css`
border-radius: var(--radius-2xl);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
background: var(--panel); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

export const style2 = css`
border-radius: 30px;
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 5);
text-align: center;
@media (width >= 48rem) {
    padding-inline: calc(var(--spacing) * 8);
  }
@media (width >= 48rem) {
    padding-block: calc(var(--spacing) * 6);
  }
background: linear-gradient(180deg, var(--panel-strong-start), var(--panel-strong-end)); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

export const style3 = css`
border-radius: 28px;
padding: calc(var(--spacing) * 5);
background: var(--panel); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

export const style4 = css`
border-radius: var(--radius-2xl);
padding: calc(var(--spacing) * 4);
background: var(--panel-soft); border: 1px solid var(--border-soft); backdrop-filter: blur(12px);
`;

export const style5 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,139,80,0.24);
background-color: var(--accent-wash);
padding: calc(var(--spacing) * 4);
--tw-shadow: var(--shadow-elevated);
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

export const style6 = css`
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,139,80,0.24);
background-color: var(--accent-wash);
padding-inline: calc(var(--spacing) * 2.5);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--accent-text);
`;

export const style7 = css`
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-soft);
padding-inline: calc(var(--spacing) * 2.5);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
--tw-font-weight: var(--font-weight-medium);
  font-weight: var(--font-weight-medium);
color: var(--text-soft);
`;

export const style8 = css`
margin-top: calc(var(--spacing) * 2);
width: 100%;
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); &:focus { border-color: var(--accent); outline: none; }
`;

export const style9 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,139,80,0.3);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:disabled {
    opacity: 60%;
  }
background: var(--accent); color: #1d1108; transition: background-color 160ms ease; &:hover { background: var(--accent-soft); }
`;

export const style10 = css`
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:disabled {
    opacity: 60%;
  }
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

export const style11 = css`
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:disabled {
    opacity: 60%;
  }
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

export const style12 = css`
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(196,98,91,0.28);
background-color: var(--danger-bg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--danger);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: rgba(196,98,91,0.42);
    }
  }
&:disabled {
    opacity: 60%;
  }
`;

export const style13 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-soft);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

export const style14 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(223,173,87,0.24);
background-color: var(--warning-bg);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--warning);
`;

export const style15 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(196,98,91,0.3);
background-color: var(--danger-bg);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--danger);
`;

export const style16 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(49,122,86,0.26);
background-color: var(--success-bg);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--success);
`;

export const style17 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style18 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

export const style19 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style20 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

export const style21 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

export const style22 = css`
height: 100%;
overflow-y: auto;
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 4);
@media (width >= 48rem) {
    padding-inline: calc(var(--spacing) * 6);
  }
@media (width >= 48rem) {
    padding-block: calc(var(--spacing) * 6);
  }
`;

export const style23 = css`
margin-inline: auto;
display: flex;
width: 100%;
max-width: var(--container-5xl);
flex-direction: column;
gap: calc(var(--spacing) * 4);
`;

export const style24 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: var(--tracking-tight);
  letter-spacing: var(--tracking-tight);
color: var(--text-main);
@media (width >= 48rem) {
    font-size: var(--text-4xl);
    line-height: var(--tw-leading, var(--text-4xl--line-height));
  }
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

export const style25 = css`
margin-inline: auto;
margin-top: calc(var(--spacing) * 2);
max-width: var(--container-2xl);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

export const style26 = css`
margin-top: calc(var(--spacing) * 3);
display: flex;
flex-wrap: wrap;
align-items: center;
justify-content: center;
gap: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
`;

export const style27 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

export const style28 = css`
margin-top: calc(var(--spacing) * 3);
display: grid;
gap: calc(var(--spacing) * 3);
@media (width >= 48rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export const style29 = css`
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style30 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-medium);
  font-weight: var(--font-weight-medium);
color: var(--text-main);
`;

export const style31 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

export const style32 = css`
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: var(--accent-text);
text-transform: uppercase;
`;

export const style33 = css`
margin-top: calc(var(--spacing) * 3);
`;

export const style34 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

export const style35 = css`
margin-top: calc(var(--spacing) * 4);
display: grid;
gap: calc(var(--spacing) * 3);
@media (width >= 48rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export const style36 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style37 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-xl);
  line-height: var(--tw-leading, var(--text-xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

export const style38 = css`
margin-top: calc(var(--spacing) * 3);
width: 100%;
`;

export const style39 = css`
opacity: 80%;
`;

export const style40 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: var(--accent-text);
text-transform: uppercase;
`;

export const style41 = css`
margin-top: calc(var(--spacing) * 3);
display: flex;
gap: calc(var(--spacing) * 2);
`;

export const style42 = css`
flex: 1;
`;

export const style43 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

export const style44 = css`
margin-top: calc(var(--spacing) * 3);
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

export const style45 = css`
flex: 1;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style46 = css`
display: flex;
align-items: center;
justify-content: space-between;
`;

export const style47 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

export const style48 = css`
margin-top: calc(var(--spacing) * 3);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style49 = css`
display: flex;
flex-direction: column;
gap: calc(var(--spacing) * 3);
@media (width >= 48rem) {
    flex-direction: row;
  }
@media (width >= 48rem) {
    align-items: center;
  }
@media (width >= 48rem) {
    justify-content: space-between;
  }
`;

export const style50 = css`
min-width: calc(var(--spacing) * 0);
`;

export const style51 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-medium);
  font-weight: var(--font-weight-medium);
color: var(--text-main);
`;

export const style52 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

export const style53 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 11px;
color: var(--text-dim);
`;

export const style54 = css`
display: flex;
flex-wrap: wrap;
align-items: center;
gap: calc(var(--spacing) * 2);
`;

export const style55 = css`
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
font-size: 11px;
`;

export const style56 = css`
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
&:disabled {
    opacity: 60%;
  }
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); &:focus { border-color: var(--accent); outline: none; }
`;

export const style57 = css`
display: block;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style58 = css`
margin-top: calc(var(--spacing) * 3);
display: block;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-dim);
text-transform: uppercase;
`;

export const style59 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-dim);
`;

export const style60 = css`
margin-top: calc(var(--spacing) * 4);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style61 = css`
display: flex;
flex-direction: column;
gap: calc(var(--spacing) * 2);
@media (width >= 48rem) {
    flex-direction: row;
  }
@media (width >= 48rem) {
    align-items: center;
  }
@media (width >= 48rem) {
    justify-content: space-between;
  }
`;

export const style62 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
`;

export const style63 = css`
font-size: 11px;
color: var(--text-dim);
`;
