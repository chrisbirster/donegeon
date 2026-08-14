import Button from "./Button";
import { css } from "@linaria/core";
import { Show, createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";

import { storedBoardHref } from "../lib/boardSelection";
import SidebarAccountCard from "./SidebarAccountCard";
import DonegeonLogo from "./brand/DonegeonLogo";

type ShellProps = {
  activeView: "task" | "board" | "profile" | "team";
  headerRight?: JSX.Element;
  mobileSidebar?: JSX.Element;
  accountPlacement?: "floating" | "sidebar";
  chromeTone?: "default" | "board";
  children: JSX.Element;
};

const navBoardActive = css`
  color: #ff9b38;
  font-family: "Permanent Marker", cursive;
  font-size: 1.08em;
  transform: rotate(-2deg);
  text-shadow: 0 0 10px rgba(255, 138, 0, .55);
  &::before { content: ""; position: absolute; inset: .12rem -.15rem; z-index: -1; border: 1px solid rgba(255, 92, 26, .62); background: rgba(92, 27, 7, .26); clip-path: polygon(5% 3%, 95% 0, 100% 83%, 89% 100%, 3% 91%, 0 18%); transform: rotate(1deg); }
  &::after { content: ""; position: absolute; left: .55rem; right: .35rem; bottom: .28rem; height: 3px; background: #ff6a1a; clip-path: polygon(0 25%, 90% 0, 100% 60%, 30% 100%); box-shadow: 0 0 8px rgba(255,106,26,.55); }
`;
const navBoardIdle = css`color: #b7c4d7; &:hover { background: rgba(255,255,255,.04); color: white; }`;
const navActive = css`background: var(--accent-wash); color: var(--accent-text);`;
const navIdle = css`color: var(--text-muted); &:hover { background: var(--panel-soft); color: var(--text-main); }`;
const mobileBoardActive = css`border-color: rgba(255,139,80,.28); background: rgba(255,139,80,.14); color: #ffd7b7;`;
const mobileBoardIdle = css`border-color: #31445f; background: #131b27; color: #c9d4e3; &:hover { border-color: #466684; }`;
const mobileActive = css`border-color: rgba(255,139,80,.28); background: var(--accent-wash); color: var(--accent-text);`;
const mobileIdle = css`background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-soft); &:hover { border-color: var(--border-hover); }`;

export default function AppShell(props: ShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const accountPlacement = () => props.accountPlacement || "floating";
  const chromeTone = () => props.chromeTone || "default";
  const boardTone = () => chromeTone() === "board";
  const boardHref = () => storedBoardHref();
  const navItemClass = (active: boolean) =>
    boardTone()
      ? active
        ? navBoardActive
        : navBoardIdle
      : active
        ? navActive
        : navIdle;
  const mobileActionClass = (active: boolean) =>
    boardTone()
      ? active
        ? mobileBoardActive
        : mobileBoardIdle
      : active
        ? mobileActive
        : mobileIdle;

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  const bottomNavItemClass = (active: boolean) =>
    boardTone()
      ? active
        ? navBoardActive
        : navBoardIdle
      : active
        ? navActive
        : navIdle;

  return (
    <main class={style1}>
      <header
        class={` ${style2} ${
          boardTone()
            ? style3
            : style4
        }`}
      >
        <div class={style5}>
          <Show when={props.mobileSidebar}>
            <Button
              type="button"
              class={` ${style6} ${boardTone() ? style7 : style8}`}
              aria-label="Open sidebar"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="appshell-mobile-menu"
            >
              ☰
            </Button>
          </Show>
          <a href="/task/inbox" class={brandLockup} aria-label="Donegeon home">
            <DonegeonLogo compact />
          </a>
          <nav class={style12}>
            <a
              href="/task/inbox"
              class={` ${style13} ${navItemClass(props.activeView === "task")}`}
            >
              Tasks
            </a>
            <a
              href={boardHref()}
              class={` ${style13} ${navItemClass(props.activeView === "board")}`}
            >
              Board
            </a>
            <a
              href="/profile"
              class={` ${style13} ${navItemClass(props.activeView === "profile")}`}
            >
              Profile
            </a>
            <a
              href="/team/settings"
              class={` ${style13} ${navItemClass(props.activeView === "team")}`}
            >
              Team
            </a>
          </nav>
        </div>

        <div class={style14}>
          <a
            href="/profile"
            class={` ${style15} ${mobileActionClass(props.activeView === "profile")}`}
          >
            Profile
          </a>
          <a
            href="/team/settings"
            class={` ${style15} ${mobileActionClass(props.activeView === "team")}`}
          >
            Team
          </a>
          {props.headerRight}
        </div>
      </header>

      <div class={style16}>
        {props.children}
      </div>

      <nav
        class={` ${style17} ${
          boardTone()
            ? style18
            : style19
        }`}
      >
        <div class={style20}>
          <a
            href="/task/inbox"
            class={` ${style21} ${bottomNavItemClass(props.activeView === "task")}`}
          >
            <span class={style22}>✓</span>
            <span>Tasks</span>
          </a>
          <a
            href={boardHref()}
            class={` ${style21} ${bottomNavItemClass(props.activeView === "board")}`}
          >
            <span class={style22}>▦</span>
            <span>Board</span>
          </a>
        </div>
      </nav>

      <Show when={mobileMenuOpen() && !!props.mobileSidebar}>
        <div class={style23}>
          <Button
            type="button"
            class={style24}
            aria-label="Close sidebar"
            onClick={closeMobileMenu}
          />
          <aside
            class={` ${style25} ${
              boardTone()
                ? style26
                : style27
            }`}
          >
            <div
              class={` ${style28} ${
                boardTone()
                  ? style29
                  : style4
              }`}
            >
              <p class={` ${style30} ${boardTone() ? style31 : style32}`}>Sidebar</p>
              <Button
                type="button"
                class={` ${style33} ${boardTone() ? style34 : style35}`}
                onClick={closeMobileMenu}
              >
                Close
              </Button>
            </div>
            <div class={style36}>
              {props.mobileSidebar}
              <Show when={accountPlacement() === "sidebar"}>
                <div class={style37}>
                  <SidebarAccountCard onNavigate={closeMobileMenu} />
                </div>
              </Show>
            </div>
          </aside>
        </div>
      </Show>

      <Show when={accountPlacement() === "floating"}>
        <div class={style38}>
          <div class={style39}>
            <SidebarAccountCard class={style40} />
          </div>
        </div>
      </Show>
    </main>
  );
}


const style1 = css`
height: 100vh;
overflow: hidden;
color: var(--text-main);
`;

const brandLockup = css`
  display: inline-flex;
  align-items: center;
  gap: .65rem;
  min-width: 11rem;
`;

const style2 = css`
display: flex;
height: 70px;
align-items: center;
justify-content: space-between;
gap: 1.25rem;
padding-inline: clamp(.75rem, 2vw, 1.75rem);
border-bottom: 1px solid rgba(255, 32, 114, .28);
box-shadow: 0 8px 30px rgba(0,0,0,.42), inset 0 -1px rgba(196,69,255,.12);
--tw-backdrop-blur: blur(var(--blur-xl));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
`;

const style3 = css`
border-color: #252c39;
background-color: color-mix(in oklab, #11161e 96%, transparent);
color: #edf4ff;
`;

const style4 = css`
border-color: var(--border-strong);
background-color: var(--panel-overlay);
`;

const style5 = css`
display: flex;
align-items: center;
gap: clamp(1.5rem, 3vw, 3.5rem);
min-width: 0;
flex: 1;
`;

const style6 = css`
border-radius: var(--radius-md);
padding: calc(var(--spacing) * 1.5);
@media (width >= 48rem) {
    display: none;
  }
`;

const style7 = css`
border-color: #31445f;
background-color: #131b27;
color: #edf4ff;
&:hover {
    @media (hover: hover) {
      border-color: #466684;
    }
  }
`;

const style8 = css`
color: var(--text-main);
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

const style9 = css`
font-size: 2rem;
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
letter-spacing: .02em;
font-family: "Permanent Marker", "Space Grotesk", sans-serif;
text-transform: uppercase;
transform: rotate(-2deg);
text-shadow: 0 0 18px rgba(255,32,114,.42);
`;

const style10 = css`
color: var(--color-white);
`;

const style11 = css`
color: var(--text-main);
`;

const style12 = css`
display: none;
align-items: center;
gap: .35rem;
font-family: "Bebas Neue", "IBM Plex Sans", sans-serif;
font-size: 1.1rem;
letter-spacing: .06em;
text-transform: uppercase;
  line-height: var(--tw-leading, var(--text-xs--line-height));
@media (width >= 48rem) {
    display: flex;
  }
`;

const style13 = css`
position: relative;
border-radius: 4px;
padding: .7rem 1rem;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
`;

const style14 = css`
display: flex;
align-items: center;
justify-content: flex-end;
gap: .55rem;
flex: 0 0 auto;
`;

const style15 = css`
border-radius: calc(infinity * 1px);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
@media (width >= 48rem) {
    display: none;
  }
`;

const style16 = css`
height: calc(100vh - 70px - 62px - env(safe-area-inset-bottom));
@media (width >= 48rem) {
    height: calc(100vh - 70px);
  }
`;

const style17 = css`
position: fixed;
inset-inline: calc(var(--spacing) * 0);
bottom: calc(var(--spacing) * 0);
z-index: 50;
padding-inline: calc(var(--spacing) * 2);
padding-top: calc(var(--spacing) * 1);
padding-bottom: max(env(safe-area-inset-bottom), 0px);
--tw-backdrop-blur: blur(var(--blur-xl));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
@media (width >= 48rem) {
    display: none;
  }
`;

const style18 = css`
border-color: #252c39;
background-color: color-mix(in oklab, #11161e 96%, transparent);
`;

const style19 = css`
border-color: var(--border-strong);
background-color: rgba(4,8,12,0.92);
`;

const style20 = css`
display: grid;
grid-template-columns: repeat(2, minmax(0, 1fr));
gap: calc(var(--spacing) * 1);
`;

const style21 = css`
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
`;

const style22 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
`;

const style23 = css`
position: fixed;
inset: calc(var(--spacing) * 0);
z-index: 60;
@media (width >= 48rem) {
    display: none;
  }
`;

const style24 = css`
position: absolute;
inset: calc(var(--spacing) * 0);
background-color: color-mix(in srgb, #000 55%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    background-color: color-mix(in oklab, var(--color-black) 55%, transparent);
  }
`;

const style25 = css`
position: absolute;
top: calc(var(--spacing) * 0);
left: calc(var(--spacing) * 0);
height: 100%;
width: min(84vw, 320px);
overflow-y: auto;
border-right-style: var(--tw-border-style);
  border-right-width: 1px;
--tw-shadow: 0 20px 50px var(--tw-shadow-color, rgba(0,0,0,0.55));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
--tw-backdrop-blur: blur(var(--blur-xl));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
`;

const style26 = css`
border-color: #252c39;
background-color: #151a23;
`;

const style27 = css`
border-color: var(--border-strong);
background-color: var(--panel-strong-start);
`;

const style28 = css`
position: sticky;
top: calc(var(--spacing) * 0);
z-index: 10;
display: flex;
align-items: center;
justify-content: space-between;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
--tw-backdrop-blur: blur(var(--blur-sm));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
`;

const style29 = css`
border-color: #252c39;
background-color: color-mix(in oklab, #151a23 96%, transparent);
`;

const style30 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
text-transform: uppercase;
`;

const style31 = css`
color: #b9c8e3;
`;

const style32 = css`
color: #9db8d3;
`;

const style33 = css`
border-radius: var(--radius-md);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
`;

const style34 = css`
border-color: #31445f;
background-color: #131b27;
color: #dce8ff;
&:hover {
    @media (hover: hover) {
      border-color: #466684;
    }
  }
`;

const style35 = css`
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

const style36 = css`
padding: calc(var(--spacing) * 3);
`;

const style37 = css`
margin-top: calc(var(--spacing) * 3);
border-top-style: var(--tw-border-style);
  border-top-width: 1px;
border-color: var(--border-strong);
padding-top: calc(var(--spacing) * 3);
`;

const style38 = css`
pointer-events: none;
position: fixed;
bottom: calc(var(--spacing) * 3);
left: calc(var(--spacing) * 3);
z-index: 55;
display: none;
@media (width >= 48rem) {
    display: block;
  }
`;

const style39 = css`
pointer-events: auto;
`;

const style40 = css`
width: 220px;
`;
