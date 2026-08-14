import { css } from "@linaria/core";

export const boardArtwork = css`
  background:
    linear-gradient(rgba(5, 7, 15, .38), rgba(5, 7, 15, .58)),
    url('/images/donegeon-board-city.png') center / cover no-repeat;
  box-shadow: inset 0 0 120px rgba(0, 0, 0, .7);
`;

export const style1 = css`
position: relative;
height: 100%;
min-height: calc(var(--spacing) * 0);
overflow: hidden;
`;

export const style2 = css`
pointer-events: none;
position: absolute;
top: calc(var(--spacing) * 3);
left: calc(1 / 2 * 100%);
z-index: 40;
width: min(240px, calc(100% - 1.5rem));
--tw-translate-x: calc(calc(1 / 2 * 100%) * -1);
  translate: var(--tw-translate-x) var(--tw-translate-y);
@media (width >= 48rem) {
    display: none;
  }
`;

export const style3 = css`
margin-bottom: calc(var(--spacing) * 2);
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
font-size: 10px;
--tw-tracking: 0.1em;
  letter-spacing: 0.1em;
text-transform: uppercase;
`;

export const style4 = css`
margin-inline: auto;
`;

export const style5 = css`
position: absolute;
height: 6px;
width: 6px;
transform: translate(-50%, -50%);
border-radius: 999px;
box-shadow: 0 0 0 1px rgba(0,0,0,.72), 0 0 7px currentColor;
`;

export const style6 = css`
outline: 2px solid #f7f0e7;
outline-offset: 1px;
`;

export const style7 = css`
pointer-events: none;
position: absolute;
top: calc(var(--spacing) * 3);
right: calc(var(--spacing) * 3);
z-index: 40;
display: none;
@media (width >= 48rem) {
    display: block;
  }
`;

export const style8 = css`
margin-bottom: calc(var(--spacing) * 2);
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 4);
font-size: 11px;
--tw-tracking: 0.11em;
  letter-spacing: 0.11em;
text-transform: uppercase;
`;

export const style9 = css`
margin-bottom: calc(var(--spacing) * 3);
display: flex;
align-items: center;
justify-content: space-between;
`;

export const style10 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.16em;
  letter-spacing: 0.16em;
text-transform: uppercase;
`;

export const style11 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
`;

export const style12 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style13 = css`
margin-bottom: calc(var(--spacing) * 1);
display: flex;
align-items: center;
justify-content: space-between;
`;

export const style14 = css`
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
text-transform: uppercase;
`;

export const style15 = css`
font-size: 11px;
`;

export const style16 = css`
display: flex;
align-items: center;
justify-content: space-between;
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
`;

export const style17 = css`
border-color: #8db4ff;
background-color: #243a63;
color: #eff5ff;
`;

export const style18 = css`
border-color: #466288;
background-color: #162946;
color: #d9e7ff;
`;

export const style19 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
padding-right: calc(var(--spacing) * 2);
`;

export const style20 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #55729b;
padding-inline: calc(var(--spacing) * 1.5);
padding-block: calc(var(--spacing) * 0.5);
font-size: 10px;
color: #d2e2ff;
&:hover {
    @media (hover: hover) {
      border-color: var(--accent);
    }
  }
`;

export const style21 = css`
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
--tw-border-style: dashed;
  border-style: dashed;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 2);
font-size: 11px;
`;

export const style22 = css`
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.8);
color: var(--text-soft);
`;

export const style23 = css`
border-color: #42628f;
background-color: #13223a;
color: #8ca5cd;
`;

export const style24 = css`
border-color: #415a80;
background-color: #141f34;
color: #cedcf6;
`;

export const style25 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #4f6c95;
padding-inline: calc(var(--spacing) * 1.5);
padding-block: calc(var(--spacing) * 0.5);
font-size: 10px;
color: #d2e2ff;
&:hover {
    @media (hover: hover) {
      border-color: var(--accent);
    }
  }
`;

export const style26 = css`
border-color: #375172;
background-color: #121f32;
color: #8ca5cd;
`;

export const style27 = css`
padding: calc(var(--spacing) * 4);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

export const style28 = css`
position: absolute;
inset: calc(var(--spacing) * 0);
`;

export const style29 = css`
position: absolute;
-webkit-user-select: none;
  user-select: none;
`;

export const style30 = css`
cursor: pointer;
`;

export const style31 = css`
cursor: grab;
&:active {
    cursor: grabbing;
  }
`;

export const style32 = css`
--tw-ring-color: #efb05f;
--tw-ring-offset-width: 2px;
  --tw-ring-offset-shadow: var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
--tw-ring-offset-color: var(--bg-base);
`;

export const style33 = css`
--tw-ring-shadow: var(--tw-ring-inset,) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
--tw-ring-color: #f87171;
--tw-ring-offset-width: 2px;
  --tw-ring-offset-shadow: var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
--tw-ring-offset-color: var(--bg-base);
`;

export const style34 = css`
--tw-ring-shadow: var(--tw-ring-inset,) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
--tw-ring-color: color-mix(in oklab, #facc15 90%, transparent);
--tw-ring-offset-width: 2px;
  --tw-ring-offset-shadow: var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
--tw-ring-offset-color: var(--bg-base);
`;

export const style35 = css`
pointer-events: none;
position: absolute;
top: calc(var(--spacing) * -3);
left: calc(var(--spacing) * 0);
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #7d3f3f;
background-color: color-mix(in oklab, #311617 96%, transparent);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
font-size: 10px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: #ffb3ad;
text-transform: uppercase;
--tw-shadow: 0 10px 20px var(--tw-shadow-color, rgba(0,0,0,0.35));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

export const style36 = css`
pointer-events: none;
position: absolute;
right: calc(var(--spacing) * 0);
bottom: calc(var(--spacing) * -3);
left: calc(var(--spacing) * 0);
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #335244;
background-color: color-mix(in oklab, #0c1b14 92%, transparent);
padding-inline: calc(var(--spacing) * 1);
padding-block: calc(var(--spacing) * 0.5);
`;

export const style37 = css`
height: calc(var(--spacing) * 1.5);
width: 100%;
overflow: hidden;
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #2f4a3f;
background-color: #13291f;
`;

export const style38 = css`
height: 100%;
--tw-gradient-position: to right in oklab;
  background-image: linear-gradient(var(--tw-gradient-stops));
--tw-gradient-from: #78cc57;
  --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
--tw-gradient-to: #b8ef90;
  --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
transition-property: width;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
--tw-duration: 100ms;
  transition-duration: 100ms;
`;

export const style39 = css`
position: absolute;
left: calc(var(--spacing) * 0);
height: 165px;
width: 110px;
overflow: hidden;
border-radius: 10px;
border-style: var(--tw-border-style);
  border-width: 2px;
border-color: color-mix(in srgb, #000 55%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    border-color: color-mix(in oklab, var(--color-black) 55%, transparent);
  }
box-shadow: 0 9px 20px rgba(0,0,0,.58), 0 0 12px rgba(196,69,255,.22);
`;

export const style40 = css`
position: absolute;
inset-inline: calc(var(--spacing) * 0);
top: 6px;
display: flex;
height: 21px;
align-items: center;
justify-content: space-between;
border-bottom-style: var(--tw-border-style);
  border-bottom-width: 2px;
border-color: color-mix(in srgb, #000 40%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    border-color: color-mix(in oklab, var(--color-black) 40%, transparent);
  }
padding-inline: calc(var(--spacing) * 1);
font-size: 10px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
text-transform: uppercase;
opacity: 0;
pointer-events: none;
`;

export const style41 = css`
height: calc(var(--spacing) * 4);
width: 100%;
--tw-border-style: none;
  border-style: none;
background-color: transparent;
padding-inline: calc(var(--spacing) * 0);
font-size: 10px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: #1a1f2a;
text-transform: uppercase;
--tw-outline-style: none;
  outline-style: none;
`;

export const style42 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const style43 = css`
position: absolute;
inset-inline: calc(var(--spacing) * 0);
top: 27px;
bottom: calc(var(--spacing) * 0);
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
gap: calc(var(--spacing) * 1);
padding-inline: calc(var(--spacing) * 1);
`;

export const style44 = css`
display: flex;
height: 46px;
width: 46px;
align-items: center;
justify-content: center;
border-radius: 8px;
border-style: var(--tw-border-style);
  border-width: 2px;
border-color: color-mix(in srgb, #000 30%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    border-color: color-mix(in oklab, var(--color-black) 30%, transparent);
  }
background-color: color-mix(in srgb, #fff 30%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    background-color: color-mix(in oklab, var(--color-white) 30%, transparent);
  }
font-size: 18px;
opacity: 0;
`;

export const style45 = css`
max-width: 100%;
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
font-size: 9px;
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: color-mix(in srgb, #000 75%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    color: color-mix(in oklab, var(--color-black) 75%, transparent);
  }
text-transform: uppercase;
opacity: 0;
`;

export const style46 = css`
position: absolute;
right: calc(var(--spacing) * 1);
bottom: calc(var(--spacing) * 1);
display: flex;
height: calc(var(--spacing) * 4);
min-width: calc(var(--spacing) * 4);
align-items: center;
justify-content: center;
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: color-mix(in srgb, #000 40%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    border-color: color-mix(in oklab, var(--color-black) 40%, transparent);
  }
background-color: color-mix(in srgb, #fff 80%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    background-color: color-mix(in oklab, var(--color-white) 80%, transparent);
  }
padding-inline: calc(var(--spacing) * 1);
font-size: 10px;
--tw-font-weight: var(--font-weight-bold);
  font-weight: var(--font-weight-bold);
color: #1a1e28;
`;

export const style47 = css`
pointer-events: none;
position: absolute;
-webkit-user-select: none;
  user-select: none;
`;

export const style48 = css`
position: absolute;
height: 124px;
width: 92px;
cursor: pointer;
border-radius: 3px;
border-style: var(--tw-border-style);
  border-width: 2px;
border-color: color-mix(in srgb, #000 55%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    border-color: color-mix(in oklab, var(--color-black) 55%, transparent);
  }
background-color: #a9b7cf;
color: #121722;
--tw-shadow: 2px 2px 0 var(--tw-shadow-color, rgba(0,0,0,0.35));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
-webkit-user-select: none;
  user-select: none;
`;

export const style49 = css`
position: absolute;
inset-inline: calc(var(--spacing) * 0);
top: calc(var(--spacing) * 0);
display: flex;
height: 18px;
align-items: center;
justify-content: center;
border-bottom-style: var(--tw-border-style);
  border-bottom-width: 2px;
border-color: color-mix(in srgb, #000 40%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    border-color: color-mix(in oklab, var(--color-black) 40%, transparent);
  }
background-color: #8494af;
padding-inline: calc(var(--spacing) * 1);
font-size: 10px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
text-transform: uppercase;
`;

export const style50 = css`
display: flex;
height: 46px;
width: 46px;
align-items: center;
justify-content: center;
border-radius: 8px;
border-style: var(--tw-border-style);
  border-width: 2px;
border-color: color-mix(in srgb, #000 30%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    border-color: color-mix(in oklab, var(--color-black) 30%, transparent);
  }
background-color: color-mix(in srgb, #fff 30%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    background-color: color-mix(in oklab, var(--color-white) 30%, transparent);
  }
font-size: 20px;
`;

export const style51 = css`
font-size: 9px;
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: color-mix(in srgb, #000 75%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    color: color-mix(in oklab, var(--color-black) 75%, transparent);
  }
text-transform: uppercase;
`;

export const style52 = css`
position: absolute;
bottom: calc(var(--spacing) * 4);
left: calc(var(--spacing) * 4);
z-index: 40;
max-width: var(--container-md);
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #8d3a3a;
background-color: #321417;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: #ffd2d2;
@media (width >= 48rem) {
    display: none;
  }
`;
