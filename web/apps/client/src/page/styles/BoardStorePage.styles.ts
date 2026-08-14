import { css } from "@linaria/core";

export const style1 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style2 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #304567;
background-color: #0d1626;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
`;

export const style3 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: #93a9cd;
text-transform: uppercase;
`;

export const style4 = css`
margin-top: calc(var(--spacing) * 2);
width: 100%;
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #405777;
background-color: #101d31;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #e5eeff;
--tw-outline-style: none;
  outline-style: none;
&:focus {
    border-color: #d4a95f;
  }
`;

export const style5 = css`
margin-top: calc(var(--spacing) * 3);
width: 100%;
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #5b6f90;
background-color: #17253c;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #d9e7ff;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: #d4a95f;
    }
  }
`;

export const style6 = css`
margin-top: calc(var(--spacing) * 2);
display: grid;
grid-template-columns: repeat(2, minmax(0, 1fr));
gap: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #d8e4f9;
`;

export const style7 = css`
display: none;
align-items: center;
gap: calc(var(--spacing) * 2);
@media (width >= 48rem) {
    display: flex;
  }
`;

export const style8 = css`
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #6b7c97;
background-color: #162337;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #dfe8fa;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: #d4a95f;
    }
  }
`;

export const style9 = css`
height: 100%;
overflow-y: auto;
`;

export const style10 = css`
margin-inline: auto;
display: flex;
min-height: 100%;
width: 100%;
max-width: var(--container-6xl);
flex-direction: column;
gap: calc(var(--spacing) * 5);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 5);
@media (width >= 40rem) {
    padding-inline: calc(var(--spacing) * 6);
  }
`;

export const style11 = css`
display: grid;
gap: calc(var(--spacing) * 4);
@media (width >= 64rem) {
    grid-template-columns: minmax(0,1.2fr) minmax(280px,360px);
  }
`;

export const style12 = css`
border-radius: 28px;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #384b68;
background-color: color-mix(in oklab, #0f1a2b 95%, transparent);
padding: calc(var(--spacing) * 5);
--tw-shadow: 0 24px 70px var(--tw-shadow-color, rgba(0,0,0,0.42));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

export const style13 = css`
display: flex;
flex-wrap: wrap;
align-items: flex-start;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

export const style14 = css`
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.16em;
  letter-spacing: 0.16em;
color: #91a8cb;
text-transform: uppercase;
`;

export const style15 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-3xl);
  line-height: var(--tw-leading, var(--text-3xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: -0.03em;
  letter-spacing: -0.03em;
color: #f3f6fd;
`;

export const style16 = css`
margin-top: calc(var(--spacing) * 3);
max-width: var(--container-2xl);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
color: #b9c9e4;
`;

export const style17 = css`
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #5970a3;
background-color: #1e2a51;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: #dce4ff;
text-transform: uppercase;
`;

export const style18 = css`
margin-top: calc(var(--spacing) * 5);
display: grid;
gap: calc(var(--spacing) * 3);
@media (width >= 40rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export const style19 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #314867;
background-color: #101f34;
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
`;

export const style20 = css`
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: #8ca5cb;
text-transform: uppercase;
`;

export const style21 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #f2d28d;
`;

export const style22 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #dce8ff;
`;

export const style23 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #dce8ff;
`;

export const style24 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
color: #dce8ff;
`;

export const style25 = css`
border-radius: 28px;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #4f472e;
background-color: color-mix(in oklab, #18140d 95%, transparent);
padding: calc(var(--spacing) * 5);
--tw-shadow: 0 24px 70px var(--tw-shadow-color, rgba(0,0,0,0.36));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

export const style26 = css`
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.16em;
  letter-spacing: 0.16em;
color: #cdb37a;
text-transform: uppercase;
`;

export const style27 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
color: #e5d9b9;
`;

export const style28 = css`
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #fff0c5;
`;

export const style29 = css`
margin-top: calc(var(--spacing) * 3);
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
`;

export const style30 = css`
border-color: #4f7a57;
background-color: #142419;
color: #d2f5d7;
`;

export const style31 = css`
border-color: #5f5872;
background-color: #1a1828;
color: #e0dcff;
`;

export const style32 = css`
margin-top: calc(var(--spacing) * 4);
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #6d4a4a;
background-color: #291718;
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
color: #ffc3bd;
`;

export const style33 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #784242;
background-color: #251517;
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #ffc3bd;
`;

export const style34 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #324562;
background-color: #0f1a2b;
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #c8d5eb;
`;

export const style35 = css`
margin-bottom: calc(var(--spacing) * 3);
display: flex;
align-items: flex-end;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

export const style36 = css`
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.16em;
  letter-spacing: 0.16em;
color: #8ea6ca;
text-transform: uppercase;
`;

export const style37 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-xl);
  line-height: var(--tw-leading, var(--text-xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #f1f5ff;
`;

export const style38 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #8fa3c6;
`;

export const style39 = css`
display: grid;
gap: calc(var(--spacing) * 4);
@media (width >= 48rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
@media (width >= 80rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export const style40 = css`
border-radius: 24px;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #354863;
background-color: color-mix(in oklab, #0d1626 95%, transparent);
padding: calc(var(--spacing) * 5);
--tw-shadow: 0 18px 45px var(--tw-shadow-color, rgba(0,0,0,0.32));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

export const style41 = css`
display: flex;
align-items: flex-start;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

export const style42 = css`
--tw-tracking: 0.14em;
  letter-spacing: 0.14em;
color: #8ea6ca;
text-transform: uppercase;
`;

export const style43 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-xl);
  line-height: var(--tw-leading, var(--text-xl--line-height));
--tw-leading: var(--leading-tight);
  line-height: var(--leading-tight);
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #f5f8ff;
`;

export const style44 = css`
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #5c6e8d;
background-color: #152236;
padding-inline: calc(var(--spacing) * 2.5);
padding-block: calc(var(--spacing) * 1);
font-size: 10px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: #dbe7ff;
text-transform: uppercase;
`;

export const style45 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
color: #b7c8e5;
`;

export const style46 = css`
margin-top: calc(var(--spacing) * 4);
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #324662;
background-color: #111d30;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
`;

export const style47 = css`
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #f2d28d;
`;

export const style48 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 11px;
--tw-tracking: 0.14em;
  letter-spacing: 0.14em;
color: #94aad0;
text-transform: uppercase;
`;

export const style49 = css`
margin-top: calc(var(--spacing) * 4);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style50 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
color: #d9e5fb;
`;

export const style51 = css`
margin-top: calc(var(--spacing) * 5);
width: 100%;
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #c59a51;
background-color: color-mix(in oklab, #c59a51 12%, transparent);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2.5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #ffe6b6;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      background-color: color-mix(in oklab, #c59a51 18%, transparent);
    }
  }
&:disabled {
    cursor: not-allowed;
  }
&:disabled {
    opacity: 55%;
  }
`;
