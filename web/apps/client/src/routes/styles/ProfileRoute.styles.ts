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
border-color: var(--palette-hex-394b66-ec3ef6);
background-color: var(--palette-hex-131b2b-8a9a65);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--palette-hex-dbe7ff-2ea2ff);
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
border-color: var(--palette-hex-4b5ea8-451108);
background-color: var(--palette-hex-1f2554-a1f071);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
font-size: 11px;
color: var(--palette-hex-d5dcff-1a781e);
`;

export const style4 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-c5d2ea-6ab4cd);
`;

export const style5 = css`
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-2d3e5a-da2cb3);
background-color: var(--palette-hex-0f1728-a7ad52);
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
color: var(--palette-hex-93a3bf-101935);
text-transform: uppercase;
`;

export const style7 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-e3edff-c6c934);
`;

export const style8 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--palette-hex-9bb0d3-b97a37);
`;

export const style9 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-e3edff-c6c934);
`;

export const style10 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-e3edff-c6c934);
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
border-color: var(--palette-hex-2a3750-e24019);
background-color: var(--palette-hex-0f1728-a7ad52);
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
color: var(--palette-hex-edf3ff-e83556);
`;

export const style15 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-9fb0cc-a9014d);
`;

export const style16 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-2d3c57-6713c1);
background-color: var(--palette-hex-0f1728-a7ad52);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-b8c8e4-8d2cec);
`;

export const style17 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-643434-aadd63);
background-color: var(--palette-hex-2b1618-6761b1);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-ffc0bd-ba503d);
`;

export const style18 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-2a3750-e24019);
background-color: var(--palette-hex-0f1728-a7ad52);
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
border-color: var(--palette-hex-3a4d6f-0cb597);
background-color: var(--palette-hex-0c1524-eb09f1);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-e7f0ff-a76aa4);
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
border-color: var(--palette-hex-2a3750-e24019);
background-color: var(--palette-hex-0f1728-a7ad52);
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
color: var(--palette-hex-93a3bf-101935);
text-transform: uppercase;
`;

export const style23 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--palette-hex-9eb4d8-b6cbaf);
`;

export const style24 = css`
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-3b4f73-579378);
background-color: var(--palette-hex-1a2b46-8c2408);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--palette-hex-d8e7ff-f006b9);
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
border-color: var(--palette-hex-4a6286-fdebd4);
background-color: var(--palette-hex-1b2f4f-440b71);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--palette-hex-e0ebff-4c8561);
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
color: var(--palette-hex-9db3d7-516bf5);
`;

export const style28 = css`
margin-top: calc(var(--spacing) * 3);
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-3b6547-46c900);
background-color: var(--palette-hex-162b1d-732e93);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--palette-hex-bcf0c9-48f4bc);
`;

export const style29 = css`
margin-top: calc(var(--spacing) * 3);
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-6f3f42-08b7a6);
background-color: var(--palette-hex-2b1718-1099bb);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--palette-hex-ffb7b4-09aa13);
`;

export const style30 = css`
margin-top: calc(var(--spacing) * 3);
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-304767-181957);
background-color: var(--palette-hex-101f35-069d89);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-9cb2d6-1d8139);
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
border-color: var(--palette-hex-304767-181957);
background-color: var(--palette-hex-101f35-069d89);
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
color: var(--palette-hex-e0ebff-4c8561);
`;

export const style35 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--palette-hex-a9bedf-a63221);
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
border-color: var(--palette-hex-3e5f8a-d291ff);
background-color: var(--palette-hex-1a2c4a-fca5b3);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--palette-hex-d8e7ff-f006b9);
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
border-color: var(--palette-hex-75464a-17a0e9);
background-color: var(--palette-hex-2a1819-ed909a);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--palette-hex-ffc7c4-8a7281);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: var(--palette-hex-ff7d66-e5b480);
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
border-color: var(--palette-hex-3f6a4d-20c95f);
background-color: var(--palette-hex-17301f-ea7f53);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
color: var(--palette-hex-bff5cb-7fbc84);
`;

export const style41 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-405570-c44089);
background-color: var(--palette-hex-18253d-1c1270);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
color: var(--palette-hex-c5d7f5-48eb4b);
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
color: var(--palette-hex-9ab0d4-f7441a);
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
border-color: var(--palette-hex-304767-181957);
background-color: var(--palette-hex-101f35-069d89);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
`;

export const style46 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.1em;
  letter-spacing: 0.1em;
color: var(--palette-hex-96add1-e512ec);
text-transform: uppercase;
`;

export const style47 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--palette-hex-e6f0ff-96911d);
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
color: var(--palette-hex-e6f0ff-96911d);
`;

export const style49 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--palette-hex-9cb3d8-655453);
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
color: var(--palette-hex-8be39f-791baf);
`;

export const style55 = css`
color: var(--palette-hex-cdd9ef-febb91);
`;

export const style56 = css`
color: var(--palette-hex-7ddf98-541a53);
`;

export const style57 = css`
color: var(--palette-hex-8ca4cf-59fe7d);
`;

export const style58 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
`;

export const style59 = css`
border-color: var(--palette-hex-7f4247-180971);
background-color: var(--palette-hex-2c1718-c4cebc);
color: var(--palette-hex-ffb7b2-008591);
`;

export const style60 = css`
border-color: var(--palette-hex-3f6a4d-20c95f);
background-color: var(--palette-hex-17301f-ea7f53);
color: var(--palette-hex-bff5cb-7fbc84);
`;

export const style61 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-49636e-b80849);
background-color: var(--palette-hex-17333a-3a55c8);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
color: var(--palette-hex-c4f1ff-ef162b);
`;

export const style62 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-6f6241-27de8f);
background-color: var(--palette-hex-2e2717-18f4b2);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
color: var(--palette-hex-f3e1a6-b099d1);
`;
