import { css } from "@linaria/core";

export const style1 = css`
display: none;
align-items: center;
gap: calc(var(--spacing) * 2);
@media (width >= 48rem) {
    display: flex;
  }
`;

export const style2 = css`
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #394b66;
background-color: #131b2b;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #dbe7ff;
--tw-outline-style: none;
  outline-style: none;
&:focus {
    border-color: var(--accent);
  }
`;

export const style3 = css`
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #4b5ea8;
background-color: #1f2554;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
font-size: 11px;
color: #d5dcff;
`;

export const style4 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #c5d2ea;
`;

export const style5 = css`
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #2d3e5a;
background-color: #0f1728;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2.5);
`;

export const style6 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: #93a3bf;
text-transform: uppercase;
`;

export const style7 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #e3edff;
`;

export const style8 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #9bb0d3;
`;

export const style9 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #e3edff;
`;

export const style10 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #e3edff;
`;

export const style11 = css`
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

export const style12 = css`
margin-inline: auto;
display: flex;
width: 100%;
max-width: var(--container-5xl);
flex-direction: column;
gap: calc(var(--spacing) * 4);
`;

export const style13 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #2a3750;
background-color: #0f1728;
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 4);
`;

export const style14 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: var(--tracking-tight);
  letter-spacing: var(--tracking-tight);
color: #edf3ff;
`;

export const style15 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #9fb0cc;
`;

export const style16 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #2d3c57;
background-color: #0f1728;
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #b8c8e4;
`;

export const style17 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #643434;
background-color: #2b1618;
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #ffc0bd;
`;

export const style18 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #2a3750;
background-color: #0f1728;
padding: calc(var(--spacing) * 5);
@media (width >= 48rem) {
    display: none;
  }
`;

export const style19 = css`
margin-top: calc(var(--spacing) * 2);
width: 100%;
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #3a4d6f;
background-color: #0c1524;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #e7f0ff;
--tw-outline-style: none;
  outline-style: none;
&:focus {
    border-color: var(--accent);
  }
`;

export const style20 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #2a3750;
background-color: #0f1728;
padding: calc(var(--spacing) * 5);
`;

export const style21 = css`
display: flex;
flex-wrap: wrap;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

export const style22 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: #93a3bf;
text-transform: uppercase;
`;

export const style23 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #9eb4d8;
`;

export const style24 = css`
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #3b4f73;
background-color: #1a2b46;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #d8e7ff;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: var(--accent);
    }
  }
&:disabled {
    opacity: 60%;
  }
`;

export const style25 = css`
margin-top: calc(var(--spacing) * 3);
display: flex;
flex-wrap: wrap;
gap: calc(var(--spacing) * 2);
`;

export const style26 = css`
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #4a6286;
background-color: #1b2f4f;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #e0ebff;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: var(--accent);
    }
  }
&:disabled {
    opacity: 60%;
  }
`;

export const style27 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #9db3d7;
`;

export const style28 = css`
margin-top: calc(var(--spacing) * 3);
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #3b6547;
background-color: #162b1d;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #bcf0c9;
`;

export const style29 = css`
margin-top: calc(var(--spacing) * 3);
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #6f3f42;
background-color: #2b1718;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #ffb7b4;
`;

export const style30 = css`
margin-top: calc(var(--spacing) * 3);
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #304767;
background-color: #101f35;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #9cb2d6;
`;

export const style31 = css`
margin-top: calc(var(--spacing) * 3);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style32 = css`
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #304767;
background-color: #101f35;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
`;

export const style33 = css`
display: flex;
flex-wrap: wrap;
align-items: flex-start;
justify-content: space-between;
gap: calc(var(--spacing) * 2);
`;

export const style34 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #e0ebff;
`;

export const style35 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #a9bedf;
`;

export const style36 = css`
display: flex;
flex-wrap: wrap;
align-items: center;
gap: calc(var(--spacing) * 2);
`;

export const style37 = css`
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #3e5f8a;
background-color: #1a2c4a;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #d8e7ff;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: var(--accent);
    }
  }
&:disabled {
    opacity: 60%;
  }
`;

export const style38 = css`
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #75464a;
background-color: #2a1819;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #ffc7c4;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: #ff7d66;
    }
  }
&:disabled {
    opacity: 60%;
  }
`;

export const style39 = css`
margin-top: calc(var(--spacing) * 2);
display: flex;
flex-wrap: wrap;
gap: calc(var(--spacing) * 1.5);
font-size: 11px;
`;

export const style40 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #3f6a4d;
background-color: #17301f;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
color: #bff5cb;
`;

export const style41 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #405570;
background-color: #18253d;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
color: #c5d7f5;
`;

export const style42 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

export const style43 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #9ab0d4;
`;

export const style44 = css`
margin-top: calc(var(--spacing) * 3);
display: grid;
grid-template-columns: repeat(1, minmax(0, 1fr));
gap: calc(var(--spacing) * 3);
@media (width >= 40rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export const style45 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #304767;
background-color: #101f35;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
`;

export const style46 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.1em;
  letter-spacing: 0.1em;
color: #96add1;
text-transform: uppercase;
`;

export const style47 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #e6f0ff;
`;

export const style48 = css`
margin-top: calc(var(--spacing) * 1);
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #e6f0ff;
`;

export const style49 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #9cb3d8;
`;

export const style50 = css`
display: flex;
align-items: flex-start;
justify-content: space-between;
gap: calc(var(--spacing) * 2);
`;

export const style51 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
padding-inline: calc(var(--spacing) * 1.5);
padding-block: calc(var(--spacing) * 0.5);
font-size: 10px;
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
text-transform: uppercase;
`;

export const style52 = css`
margin-top: calc(var(--spacing) * 2);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style53 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
`;

export const style54 = css`
color: #8be39f;
`;

export const style55 = css`
color: #cdd9ef;
`;

export const style56 = css`
color: #7ddf98;
`;

export const style57 = css`
color: #8ca4cf;
`;

export const style58 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
`;

export const style59 = css`
border-color: #7f4247;
background-color: #2c1718;
color: #ffb7b2;
`;

export const style60 = css`
border-color: #3f6a4d;
background-color: #17301f;
color: #bff5cb;
`;

export const style61 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #49636e;
background-color: #17333a;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
color: #c4f1ff;
`;

export const style62 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #6f6241;
background-color: #2e2717;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
color: #f3e1a6;
`;
