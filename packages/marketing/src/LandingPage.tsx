import { css, cx } from "@linaria/core";
import {
  Swords as QuestIcon,
  Castle as RealmIcon,
  Sparkles as XPIcon,
} from "lucide-solid";
import { HeaderNav } from "./components/nav";
import { Button } from "./components/button";
import { For } from "solid-js";
import { Card } from "./components/card";

const container = css`
  max-width: 80rem;
  margin-inline: auto;
  padding-inline: 1rem;
`;

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
          <a href="/join-waitlist">
            <Button size="sm">Join Waitlist</Button>
          </a>
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

              <a href="/join-waitlist">
                <Button size="lg">Join the Waitlist</Button>
              </a>
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

          <a href="/join-waitlist">
            <Button size="lg" variant="outline">
              Join the Waitlist
            </Button>
          </a>
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
