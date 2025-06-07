/* @refresh reload */
import { For } from "solid-js";
import { css, cx } from "@linaria/core";
import { Button as KBButton } from "@kobalte/core/button";
import {
  ChevronDown,
  Swords as QuestIcon,
  Castle as RealmIcon,
  Sparkles as XPIcon,
} from "lucide-solid";
import {
  NavigationMenu,
  type Orientation,
} from "@kobalte/core/navigation-menu";

const buttonBase = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border-radius: 6px;
  transition: background 0.15s, border 0.15s;
`;
const sizes = {
  sm: css`padding: 0.375rem 0.875rem; font-size: 0.875rem;`,
  md: css`padding: 0.5rem 1.25rem; font-size: 1rem;`,
  lg: css`padding: 0.75rem 2rem; font-size: 1.125rem;`,
};
const variants = {
  primary: css`
    background: var(--primary);
    color: #fff;
    border: 1px solid transparent;
    &:hover { background: var(--primaryDark); }
  `,
  outline: css`
    background: transparent;
    border: 1px solid var(--primary);
    color: var(--primary);
    &:hover { background: var(--gray800); }
  `,
};
type BtnSize = keyof typeof sizes;
type BtnVariant = keyof typeof variants;

interface ButtonProps
  extends Omit<Parameters<typeof KBButton>[0], "class"> {
  size?: BtnSize;
  variant?: BtnVariant;
  class?: string;
}
function Button(props: ButtonProps) {
  const { size = "md", variant = "primary", class: cls, ...rest } = props;
  return (
    <KBButton
      {...rest}
      class={cx(buttonBase, sizes[size], variants[variant], cls)}
    />
  );
}

const navRoot = css`
  display: none;
  list-style: none;
  @media (min-width: 768px) {
    display: flex;
    gap: 1.5rem;
  }
`;
const navTrigger = css`
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray500);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
  &:hover { color: #fff; }
`;

function HeaderNav() {
  return (
    <NavigationMenu class={navRoot} orientation={"horizontal" satisfies Orientation}>
      {/* -------------- Dropdown 1 -------------- */}
      <NavigationMenu.Menu>
        <NavigationMenu.Trigger class={navTrigger}>
          What For
          <NavigationMenu.Icon>
            <ChevronDown size={14} />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>

        <NavigationMenu.Portal>
          <NavigationMenu.Content
            class={css`
              /* pop‑up panel */
              background: #fff;
              padding: 1rem;
              border-radius: 6px;
            `}
          >
            <NavigationMenu.Item as="a" href="#teams" class={css`display:block; padding:.5rem 0;`}>
              For teams
            </NavigationMenu.Item>
            <NavigationMenu.Item as="a" href="#individuals" class={css`display:block; padding:.5rem 0;`}>
              For individuals
            </NavigationMenu.Item>
          </NavigationMenu.Content>
        </NavigationMenu.Portal>
      </NavigationMenu.Menu>

      {/* -------------- Dropdown 2 -------------- */}
      <NavigationMenu.Menu>
        <NavigationMenu.Trigger class={navTrigger}>
          Resources
          <NavigationMenu.Icon>
            <ChevronDown size={14} />
          </NavigationMenu.Icon>
        </NavigationMenu.Trigger>
        <NavigationMenu.Portal>
          <NavigationMenu.Content
            class={css`
              background: #fff;
              padding: 1rem;
              border-radius: 6px;
            `}
          >
            <NavigationMenu.Item as="a" href="#blog" class={css`display:block; padding:.5rem 0;`}>
              Blog
            </NavigationMenu.Item>
            <NavigationMenu.Item as="a" href="#docs" class={css`display:block; padding:.5rem 0;`}>
              Docs
            </NavigationMenu.Item>
          </NavigationMenu.Content>
        </NavigationMenu.Portal>
      </NavigationMenu.Menu>

      {/* simple link (no dropdown) */}
      <NavigationMenu.Trigger as="a" href="#pricing" class={navTrigger}>
        Pricing
      </NavigationMenu.Trigger>

      {/* Viewport/arrow handles portal positioning */}
      <NavigationMenu.Viewport
        class={css`
          position: absolute;
          z-index: 1000;
        `}
      >
        <NavigationMenu.Arrow />
      </NavigationMenu.Viewport>
    </NavigationMenu>
  );
}

/* Simple card */
const Card = (p: { class?: string; children: any }) => (
  <div
    class={cx(
      css`
        background: var(--gray800);
        border-radius: 8px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      `,
      p.class,
    )}
  >
    {p.children}
  </div>
);

/* Layout helper */
const container = css`
  max-width: 80rem;
  margin-inline: auto;
  padding-inline: 1rem;
`;

/* ------------------------------------------------------------------ */
/* 3. Landing page                                                     */
/* ------------------------------------------------------------------ */
const DonegeonLanding = () => {
  const bullets = [
    {
      icon: QuestIcon,
      title: "Quest‑based workflow",
      desc: "Drag task cards, chain combos, and score XP.",
    },
    {
      icon: RealmIcon,
      title: "Project realms",
      desc: "Group tasks into themed realms with resource caps.",
    },
    {
      icon: XPIcon,
      title: "XP & leveling",
      desc: "Daily streaks unlock rare skins and boosts.",
    },
  ];

  return (
    <div>
      {/* Header */}
      <header
        class={css`
          border-bottom: 1px solid var(--gray800);
          padding: 1rem 0;
        `}
      >
        <div
          class={cx(
            container,
            css`
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 2rem;
            `,
          )}
        >
          <span
            class={css`
              font-weight: 700;
              font-size: 1.25rem;
              color: var(--primary);
            `}
          >
            Donegeon
          </span>
          <HeaderNav />
          <Button size="sm">Join Waitlist</Button>
        </div>
      </header>

      {/* Hero */}
      <section
        class={css`
          padding: 6rem 0;
          background: linear-gradient(135deg, #1b1b1f 0%, #131315 100%);
        `}
      >
        <div class={container}>
          <div
            class={css`
              display: grid;
              gap: 4rem;
              align-items: center;
              @media (min-width: 1024px) {
                grid-template-columns: 1fr 1fr;
              }
            `}
          >
            {/* Text */}
            <div
              class={css`
                display: flex;
                flex-direction: column;
                gap: 2rem;
              `}
            >
              <div
                class={css`
                  display: flex;
                  flex-direction: column;
                  gap: 1.5rem;
                `}
              >
                <h1
                  class={css`
                    font-size: clamp(2.5rem, 5vw, 3.5rem);
                    font-weight: 800;
                    line-height: 1.1;
                    color: #fff;
                  `}
                >
                  Turn every todo into a quest.
                </h1>
                <p
                  class={css`
                    font-size: 1.25rem;
                    color: var(--gray500);
                    max-width: 38ch;
                  `}
                >
                  Build, combine, and <strong>complete tasks like resource
                    cards</strong> in a living desktop dungeon.
                </p>
              </div>

              <Button size="lg">Join the Waitlist</Button>
              <p
                class={css`
                  font-size: 0.875rem;
                  color: var(--gray500);
                `}
              >
                Early heroes get exclusive skins&nbsp;& lifetime discount.
              </p>
            </div>

            {/* Screenshot */}
            <div
              class={css`
                position: relative;
              `}
            >
              <img
                src="https://placehold.co/640x400?text=Board+Screenshot"
                alt="Donegeon board"
                class={css`
                  border-radius: 10px;
                  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
                `}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Value bullets */}
      <section
        class={css`
          padding: 5rem 0;
        `}
      >
        <div class={container}>
          <div
            class={css`
              display: grid;
              gap: 2.5rem;
              @media (min-width: 768px) {
                grid-template-columns: repeat(3, 1fr);
              }
            `}
          >
            <For each={bullets}>
              {(b) => (
                <Card
                  class={css`
                    padding: 2rem;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                  `}
                >
                  <div
                    class={css`
                      width: 3rem;
                      height: 3rem;
                      margin-inline: auto;
                      background: var(--primary)22;
                      border-radius: 9999px;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                    `}
                  >
                    <b.icon size={24} color="var(--primary)" />
                  </div>
                  <h3
                    class={css`
                      font-weight: 700;
                      font-size: 1.125rem;
                      color: #fff;
                    `}
                  >
                    {b.title}
                  </h3>
                  <p
                    class={css`
                      font-size: 0.95rem;
                      color: var(--gray500);
                    `}
                  >
                    {b.desc}
                  </p>
                </Card>
              )}
            </For>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section
        class={css`
          padding: 5rem 0;
          background: var(--gray800);
        `}
      >
        <div class={container}>
          <div
            class={css`
              display: flex;
              flex-direction: column;
              gap: 2rem;
              align-items: center;
              text-align: center;
            `}
          >
            <p
              class={css`
                font-size: 1.125rem;
                font-style: italic;
                color: var(--gray500);
                max-width: 45ch;
              `}
            >
              “My productivity actually feels fun again.”
            </p>
            <span
              class={css`
                font-size: 0.875rem;
                color: var(--gray600);
              `}
            >
              — Beta Tester #47
            </span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        class={css`
          padding: 6rem 0;
          background: var(--primaryDark);
          text-align: center;
        `}
      >
        <div class={container}>
          <h2
            class={css`
              font-size: clamp(2rem, 4vw, 3rem);
              font-weight: 800;
              line-height: 1.1;
              margin-bottom: 2rem;
            `}
          >
            Ready to turn routine into adventure?
          </h2>
          <Button size="lg" variant="outline">
            Join the Waitlist
          </Button>
          <p
            class={css`
              font-size: 0.875rem;
              color: var(--gray600);
              margin-top: 1rem;
            `}
          >
            We’ll email you before launch—no spam, promise.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer
        class={css`
          padding: 3rem 0;
          background: #0f0f11;
          border-top: 1px solid var(--gray800);
        `}
      >
        <div
          class={cx(
            container,
            css`
              display: flex;
              flex-direction: column;
              gap: 2rem;
              align-items: center;
              text-align: center;
            `,
          )}
        >
          <span
            class={css`
              font-weight: 700;
              font-size: 1.25rem;
              color: var(--primary);
            `}
          >
            Donegeon
          </span>
          <div
            class={css`
              font-size: 0.875rem;
              color: var(--gray600);
            `}
          >
            © 2025 Donegeon Inc. | Made for makers who love games.
          </div>
          <div
            class={css`
              display: flex;
              gap: 1.5rem;
              font-size: 0.875rem;
            `}
          >
            <a
              href="#"
              class={css`
                color: var(--gray600);
                text-decoration: none;
                &:hover {
                  color: #fff;
                }
              `}
            >
              Privacy
            </a>
            <a
              href="#"
              class={css`
                color: var(--gray600);
                text-decoration: none;
                &:hover {
                  color: #fff;
                }
              `}
            >
              Terms
            </a>
            <a
              href="#"
              class={css`
                color: var(--gray600);
                text-decoration: none;
                &:hover {
                  color: #fff;
                }
              `}
            >
              Security
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DonegeonLanding;
