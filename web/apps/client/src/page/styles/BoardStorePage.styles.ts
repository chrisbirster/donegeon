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
border-color: var(--palette-hex-304567-6cb396);
background-color: var(--palette-hex-0d1626-5de8b9);
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
color: var(--palette-hex-93a9cd-9b3c0e);
text-transform: uppercase;
`;

export const style4 = css`
margin-top: calc(var(--spacing) * 2);
width: 100%;
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-405777-d97512);
background-color: var(--palette-hex-101d31-d77dab);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-e5eeff-4c89cf);
--tw-outline-style: none;
  outline-style: none;
&:focus {
    border-color: var(--palette-hex-d4a95f-4d604b);
  }
`;

export const style5 = css`
margin-top: calc(var(--spacing) * 3);
width: 100%;
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-5b6f90-1b1ade);
background-color: var(--palette-hex-17253c-6ee6ea);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--palette-hex-d9e7ff-e531e4);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: var(--palette-hex-d4a95f-4d604b);
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
color: var(--palette-hex-d8e4f9-ad5fce);
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
border-color: var(--palette-hex-6b7c97-2bf757);
background-color: var(--palette-hex-162337-7f345d);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--palette-hex-dfe8fa-2a9abf);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: var(--palette-hex-d4a95f-4d604b);
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
border-color: var(--palette-hex-384b68-667e1d);
background-color: color-mix(in oklab, var(--palette-hex-0f1a2b-1aa23f) 95%, transparent);
padding: calc(var(--spacing) * 5);
--tw-shadow: 0 24px 70px var(--tw-shadow-color, var(--palette-rgba-0-0-0-0-42-5428af));
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
color: var(--palette-hex-91a8cb-837d34);
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
color: var(--palette-hex-f3f6fd-9e1c38);
`;

export const style16 = css`
margin-top: calc(var(--spacing) * 3);
max-width: var(--container-2xl);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
color: var(--palette-hex-b9c9e4-199469);
`;

export const style17 = css`
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-5970a3-bc53b5);
background-color: var(--palette-hex-1e2a51-63ca79);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--palette-hex-dce4ff-e3c773);
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
border-color: var(--palette-hex-314867-ab86dc);
background-color: var(--palette-hex-101f34-47d4e9);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
`;

export const style20 = css`
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--palette-hex-8ca5cb-a5fa91);
text-transform: uppercase;
`;

export const style21 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--palette-hex-f2d28d-2b9c78);
`;

export const style22 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-dce8ff-ad0866);
`;

export const style23 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-dce8ff-ad0866);
`;

export const style24 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
color: var(--palette-hex-dce8ff-ad0866);
`;

export const style25 = css`
border-radius: 28px;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-4f472e-5f434b);
background-color: color-mix(in oklab, var(--palette-hex-18140d-519d1b) 95%, transparent);
padding: calc(var(--spacing) * 5);
--tw-shadow: 0 24px 70px var(--tw-shadow-color, var(--palette-rgba-0-0-0-0-36-6598dd));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

export const style26 = css`
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.16em;
  letter-spacing: 0.16em;
color: var(--palette-hex-cdb37a-a6a4f1);
text-transform: uppercase;
`;

export const style27 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
color: var(--palette-hex-e5d9b9-36d687);
`;

export const style28 = css`
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--palette-hex-fff0c5-a8e96e);
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
border-color: var(--palette-hex-4f7a57-33eca7);
background-color: var(--palette-hex-142419-2e941b);
color: var(--palette-hex-d2f5d7-b69010);
`;

export const style31 = css`
border-color: var(--palette-hex-5f5872-acc636);
background-color: var(--palette-hex-1a1828-5d4f71);
color: var(--palette-hex-e0dcff-d534ec);
`;

export const style32 = css`
margin-top: calc(var(--spacing) * 4);
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-6d4a4a-9a214a);
background-color: var(--palette-hex-291718-c6a1e9);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
color: var(--palette-hex-ffc3bd-2bb53e);
`;

export const style33 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-784242-aee30d);
background-color: var(--palette-hex-251517-56ed9d);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-ffc3bd-2bb53e);
`;

export const style34 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-324562-047ee1);
background-color: var(--palette-hex-0f1a2b-1aa23f);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--palette-hex-c8d5eb-ea9b5e);
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
color: var(--palette-hex-8ea6ca-c28dc8);
text-transform: uppercase;
`;

export const style37 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-xl);
  line-height: var(--tw-leading, var(--text-xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--palette-hex-f1f5ff-393278);
`;

export const style38 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--palette-hex-8fa3c6-87cb26);
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
border-color: var(--palette-hex-354863-3d97d0);
background-color: color-mix(in oklab, var(--palette-hex-0d1626-5de8b9) 95%, transparent);
padding: calc(var(--spacing) * 5);
--tw-shadow: 0 18px 45px var(--tw-shadow-color, var(--palette-rgba-0-0-0-0-32-a213c9));
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
color: var(--palette-hex-8ea6ca-c28dc8);
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
color: var(--palette-hex-f5f8ff-469978);
`;

export const style44 = css`
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-5c6e8d-b49456);
background-color: var(--palette-hex-152236-fd8c08);
padding-inline: calc(var(--spacing) * 2.5);
padding-block: calc(var(--spacing) * 1);
font-size: 10px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--palette-hex-dbe7ff-2ea2ff);
text-transform: uppercase;
`;

export const style45 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 6);
  line-height: calc(var(--spacing) * 6);
color: var(--palette-hex-b7c8e5-7c5903);
`;

export const style46 = css`
margin-top: calc(var(--spacing) * 4);
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-324662-d452dd);
background-color: var(--palette-hex-111d30-a210b1);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
`;

export const style47 = css`
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--palette-hex-f2d28d-2b9c78);
`;

export const style48 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 11px;
--tw-tracking: 0.14em;
  letter-spacing: 0.14em;
color: var(--palette-hex-94aad0-5ecf7b);
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
color: var(--palette-hex-d9e5fb-521db5);
`;

export const style51 = css`
margin-top: calc(var(--spacing) * 5);
width: 100%;
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-hex-c59a51-9bb8c6);
background-color: color-mix(in oklab, var(--palette-hex-c59a51-9bb8c6) 12%, transparent);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2.5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--palette-hex-ffe6b6-e72909);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      background-color: color-mix(in oklab, var(--palette-hex-c59a51-9bb8c6) 18%, transparent);
    }
  }
&:disabled {
    cursor: not-allowed;
  }
&:disabled {
    opacity: 55%;
  }
`;
