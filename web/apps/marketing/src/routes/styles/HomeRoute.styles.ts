import { css } from "@linaria/core";

export const heroArtwork = css`
  position: relative;
  isolation: isolate;
  min-height: min(720px, calc(100vh - 9rem));
  margin-inline: calc(50% - 50vw);
  margin-top: calc(var(--spacing) * -14);
  padding: clamp(3rem, 7vw, 7rem) max(1.5rem, calc((100vw - 76rem) / 2));
  background:
    linear-gradient(90deg, rgba(4, 3, 12, .98) 0%, rgba(4, 3, 12, .82) 35%, rgba(4, 3, 12, .12) 70%),
    linear-gradient(0deg, var(--bg-base), transparent 24%),
    url('/images/donegeon-hero-city.png') 62% center / cover no-repeat;
  border-bottom: 1px solid rgba(255, 32, 114, .32);
  box-shadow: inset 0 -40px 80px rgba(0,0,0,.72);

  @media (width < 64rem) {
    min-height: auto;
    background-position: 72% center;
  }
`;

export const missionBoard = css`
  align-self: center;
  transform: rotate(-1.5deg);
  border: 2px solid rgba(242,241,237,.72);
  border-radius: 12px;
  background: rgba(5,7,14,.9);
  box-shadow: 12px 16px 0 rgba(0,0,0,.4), 0 0 32px rgba(196,69,255,.24);
`;

export const missionTitle = css`
  margin: 0 0 .9rem;
  color: #f2f1ed;
  font: 1.45rem "Permanent Marker", cursive;
  transform: rotate(-1deg);
`;

export const missionColumns = css`
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: .45rem;

  & > div { display: flex; min-height: 160px; flex-direction: column; gap: .45rem; border-left: 1px solid rgba(255,255,255,.14); padding: .5rem; }
  & b { color: #c445ff; font: .8rem "Bebas Neue", sans-serif; letter-spacing: .08em; text-transform: uppercase; }
  & span { border: 1px solid rgba(255,255,255,.14); border-radius: 4px; background: #10131d; padding: .55rem .4rem; color: #dad5d7; font-size: .7rem; }
`;

export const completeStamp = css`
  margin-top: 1.5rem;
  border-color: #22c55e !important;
  background: rgba(34,197,94,.08) !important;
  color: #68e58e !important;
  font: 1rem "Permanent Marker", cursive !important;
  text-align: center;
  text-transform: uppercase;
  transform: rotate(-8deg);
`;

export const style1 = css`
display: grid;
gap: calc(var(--spacing) * 10);
@media (width >= 64rem) {
    grid-template-columns: minmax(0,1.05fr) 420px;
  }
@media (width >= 64rem) {
    align-items: flex-start;
  }
`;

export const style2 = css`
color: #9fe8b4; font-size: .75rem; font-weight: 700; letter-spacing: .18em; margin: 0 0 .6rem; text-transform: uppercase;
`;

export const style3 = css`
max-width: var(--container-4xl);
font-size: var(--text-5xl);
  line-height: var(--tw-leading, var(--text-5xl--line-height));
--tw-leading: 1.02;
  line-height: 1.02;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
@media (width >= 48rem) {
    font-size: var(--text-7xl);
    line-height: var(--tw-leading, var(--text-7xl--line-height));
  }
font-family: "Bebas Neue", "Space Grotesk", sans-serif;
letter-spacing: .01em;
text-transform: uppercase;
text-shadow: 5px 6px 0 #05040c, 0 0 24px rgba(255,32,114,.16);
`;

export const style4 = css`
margin-top: calc(var(--spacing) * 6);
max-width: var(--container-2xl);
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
--tw-leading: calc(var(--spacing) * 8);
  line-height: calc(var(--spacing) * 8);
color: var(--text-soft);
@media (width >= 48rem) {
    font-size: var(--text-xl);
    line-height: var(--tw-leading, var(--text-xl--line-height));
  }
`;

export const style5 = css`
margin-top: calc(var(--spacing) * 8);
display: flex;
flex-wrap: wrap;
gap: calc(var(--spacing) * 3);
`;

export const style6 = css`
display: inline-flex;
border-radius: calc(infinity * 1px);
background-color: var(--accent);
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #1d1108;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      background-color: #ff9f6d;
    }
  }
`;

export const style7 = css`
display: inline-flex;
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.04);
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: #4a6c8b;
    }
  }
&:hover {
    @media (hover: hover) {
      background-color: rgba(255,255,255,0.08);
    }
  }
`;

export const style8 = css`
margin-top: calc(var(--spacing) * 10);
display: grid;
gap: calc(var(--spacing) * 4);
@media (width >= 40rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export const style9 = css`
border-radius: 1.6rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(9,17,26,0.78);
padding: calc(var(--spacing) * 5);
--tw-shadow: 0 18px 34px var(--tw-shadow-color, rgba(0,0,0,0.24));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

export const style10 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.18em;
  letter-spacing: 0.18em;
color: var(--text-muted);
text-transform: uppercase;
`;

export const style11 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-4xl);
  line-height: var(--tw-leading, var(--text-4xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

export const style12 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

export const style13 = css`
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-image: linear-gradient(180deg,rgba(18,34,51,0.95),rgba(10,18,28,0.95));
padding: calc(var(--spacing) * 7);
--tw-shadow: 0 24px 50px var(--tw-shadow-color, rgba(0,0,0,0.3));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

export const style14 = css`
margin-top: calc(var(--spacing) * 5);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 5) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 5) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style15 = css`
border-radius: 1.3rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,255,255,0.08);
background-color: rgba(255,255,255,0.03);
padding: calc(var(--spacing) * 4);
`;

export const style16 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
`;

export const style17 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;

export const style18 = css`
margin-top: calc(var(--spacing) * 20);
`;

export const style19 = css`
display: flex;
align-items: flex-end;
justify-content: space-between;
gap: calc(var(--spacing) * 4);
`;

export const style20 = css`
font-size: var(--text-3xl);
  line-height: var(--tw-leading, var(--text-3xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
@media (width >= 48rem) {
    font-size: var(--text-4xl);
    line-height: var(--tw-leading, var(--text-4xl--line-height));
  }
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

export const style21 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #ffd3b2;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      color: var(--color-white);
    }
  }
`;

export const style22 = css`
margin-top: calc(var(--spacing) * 8);
display: grid;
gap: calc(var(--spacing) * 5);
@media (width >= 48rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const style23 = css`
border-radius: 1.8rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(11,19,29,0.84);
padding: calc(var(--spacing) * 6);
--tw-shadow: 0 20px 40px var(--tw-shadow-color, rgba(0,0,0,0.22));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

export const style24 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 4);
`;

export const style25 = css`
border-radius: calc(infinity * 1px);
background-color: rgba(138,228,163,0.12);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: #9fe8b4;
text-transform: uppercase;
`;

export const style26 = css`
margin-top: calc(var(--spacing) * 4);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

export const style27 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;

export const style28 = css`
margin-top: calc(var(--spacing) * 5);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
`;

export const style29 = css`
margin-top: calc(var(--spacing) * 20);
display: grid;
gap: calc(var(--spacing) * 6);
@media (width >= 64rem) {
    grid-template-columns: minmax(0,1.1fr) minmax(0,0.9fr);
  }
`;

export const style30 = css`
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(11,20,30,0.84);
padding: calc(var(--spacing) * 7);
--tw-shadow: 0 24px 50px var(--tw-shadow-color, rgba(0,0,0,0.24));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

export const style31 = css`
font-size: var(--text-3xl);
  line-height: var(--tw-leading, var(--text-3xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

export const style32 = css`
margin-top: calc(var(--spacing) * 6);
display: grid;
gap: calc(var(--spacing) * 4);
`;

export const style33 = css`
border-radius: 1.4rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,255,255,0.08);
background-color: rgba(255,255,255,0.03);
padding: calc(var(--spacing) * 5);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: #466684;
    }
  }
&:hover {
    @media (hover: hover) {
      background-color: rgba(255,255,255,0.05);
    }
  }
`;

export const style34 = css`
display: flex;
flex-wrap: wrap;
align-items: center;
gap: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

export const style35 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

export const style36 = css`
margin-top: calc(var(--spacing) * 6);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style37 = css`
display: block;
border-radius: 1.4rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,255,255,0.08);
background-color: rgba(255,255,255,0.03);
padding: calc(var(--spacing) * 5);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: #466684;
    }
  }
&:hover {
    @media (hover: hover) {
      background-color: rgba(255,255,255,0.05);
    }
  }
`;

export const style38 = css`
margin-top: calc(var(--spacing) * 20);
display: grid;
gap: calc(var(--spacing) * 6);
@media (width >= 64rem) {
    grid-template-columns: minmax(0,1.08fr) minmax(0,0.92fr);
  }
`;

export const style39 = css`
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-image: linear-gradient(135deg,rgba(255,139,80,0.1),rgba(82,142,196,0.08) 58%,rgba(138,228,163,0.08));
padding: calc(var(--spacing) * 7);
--tw-shadow: 0 24px 50px var(--tw-shadow-color, rgba(0,0,0,0.24));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

export const style40 = css`
margin-top: calc(var(--spacing) * 3);
max-width: var(--container-2xl);
font-size: var(--text-base);
  line-height: var(--tw-leading, var(--text-base--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;

export const style41 = css`
margin-top: calc(var(--spacing) * 7);
display: grid;
gap: calc(var(--spacing) * 4);
@media (width >= 48rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export const style42 = css`
border-radius: 1.5rem;
border-style: var(--tw-border-style);
  border-width: 1px;
padding: calc(var(--spacing) * 5);
`;

export const style43 = css`
border-color: #5478a2;
background-color: rgba(18,35,54,0.94);
`;

export const style44 = css`
border-color: rgba(255,255,255,0.08);
background-color: rgba(255,255,255,0.03);
`;

export const style45 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.14em;
  letter-spacing: 0.14em;
color: var(--text-muted);
text-transform: uppercase;
`;

export const style46 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-3xl);
  line-height: var(--tw-leading, var(--text-3xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

export const style47 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-muted);
`;

export const style48 = css`
margin-top: calc(var(--spacing) * 5);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

export const style49 = css`
border-radius: 1.2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,255,255,0.08);
background-color: rgba(255,255,255,0.03);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 4);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-main);
`;
