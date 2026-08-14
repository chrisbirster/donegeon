import { For } from "solid-js";

import MarketingLayout from "../components/MarketingLayout";
import { usePublicConfig } from "../context/PublicConfigContext";
import { docs, formatPublishDate, posts } from "../lib/content";
import { FEATURES, PLAN_SUMMARIES, TRUST_POINTS, planHref, waitlistHref } from "../lib/site";
import { completeStamp, heroArtwork, missionBoard, missionColumns, missionTitle, style1, style2, style3, style4, style5, style6, style7, style8, style9, style10, style11, style12, style13, style14, style15, style16, style17, style18, style19, style20, style21, style22, style23, style24, style25, style26, style27, style28, style29, style30, style31, style32, style33, style34, style35, style36, style37, style38, style39, style40, style41, style42, style43, style44, style45, style46, style47, style48, style49 } from "./styles/HomeRoute.styles";

const featuredDocs = docs.filter((entry) => entry.featured).slice(0, 3);
const docHighlights = featuredDocs.length > 0 ? featuredDocs : docs.slice(0, 3);
const postHighlights = posts.slice(0, 3);
const homeFeatureHighlights = [
  {
    category: "Capture",
    title: "Capture work without slowing down",
    description: "Add tasks, priorities, dates, and repeat schedules in one quick step so work gets recorded before it gets forgotten.",
    bullets: [
      "Create tasks in seconds",
      "Add due dates, deadlines, and repeat schedules",
      "Keep structure without wrestling a long form",
    ],
  },
  {
    category: "Scheduling",
    title: "Stay ahead of recurring work",
    description: "Keep weekly routines, recurring responsibilities, and follow-ups visible so nothing slips through the cracks.",
    bullets: [
      "Flexible daily, weekly, and monthly repeats",
      "A clearer view of what is coming next",
      "Less manual re-entry for repeat work",
    ],
  },
  {
    category: "Execution",
    title: "Move from list to action",
    description: "Capture everything in one place, then shift active work onto a board your team can use to make faster decisions.",
    bullets: [
      "Task lists and board play in one workflow",
      "Shared visibility into active work",
      "A better way to decide what moves next",
    ],
  },
  {
    category: "Board",
    title: "Make progress visible",
    description: "Donegeon turns active work into a living board so priorities stay clear and progress is easy to spot at a glance.",
    bullets: [
      "Drag work across a shared map",
      "Keep backlog pressure visible",
      "Give the team a board worth checking",
    ],
  },
];

function HomeContent() {
  const publicConfig = usePublicConfig();
  const heroPrimaryHref = () =>
    publicConfig.openBeta ? planHref("personal") : waitlistHref({ source: "marketing-home-hero", plan: "personal" });

  return (
    <>
      <section class={`${heroArtwork} ${style1}`}>
        <div>
          <p class={style2}>Turn chaos into coordination. Make your team legendary.</p>
          <h1 class={style3}>
            Welcome to the Donegeon.
          </h1>
          <p class={style4}>
            Donegeon turns disorganized work into clear missions, shared intel, and team momentum. Plan the job. Assign the crew. Execute. Get paid.
          </p>

          <div class={style5}>
            <a
              href={heroPrimaryHref()}
              class={style6}
            >
              {publicConfig.openBeta ? "Enter the Donegeon" : "Join waitlist"}
            </a>
            <a
              href="/features"
              class={style7}
            >
              See how it works
            </a>
          </div>

          <div class={style8}>
            <div class={style9}>
              <p class={style10}>Built for planning</p>
              <p class={style11}>{FEATURES.length}</p>
              <p class={style12}>
                Feature areas covering capture, scheduling, boards, collaboration, and more.
              </p>
            </div>

            <div class={style9}>
              <p class={style10}>Built for teamwork</p>
              <p class={style11}>{docs.length}</p>
              <p class={style12}>Guides and walkthroughs to help your team get started faster.</p>
            </div>

            <div class={style9}>
              <p class={style10}>Built for momentum</p>
              <p class={style11}>{posts.length}</p>
              <p class={style12}>
                Product updates and ideas to keep teams learning as Donegeon grows.
              </p>
            </div>
          </div>
        </div>

        <aside class={`${style13} ${missionBoard}`}>
          <p class={missionTitle}>Mission Board</p>
          <div class={missionColumns}>
            <div><b>Planning</b><span>Stakeout</span><span>Recon</span></div>
            <div><b>In Progress</b><span>Data heist</span><span>Clean getaway</span></div>
            <div><b>Review</b><span>Evidence docs</span><span>Money drop</span></div>
            <div><b>Done</b><span class={completeStamp}>Complete</span></div>
          </div>
        </aside>
      </section>

      <section class={style18}>
        <div class={style19}>
          <div>
            <p class={style2}>Everything your team needs</p>
            <h2 class={style20}>Everything your team needs to plan and execute.</h2>
          </div>
          <a href="/features" class={style21}>
            Explore features
          </a>
        </div>

        <div class={style22}>
          <For each={homeFeatureHighlights}>
            {(feature) => (
              <article class={style23}>
                <div class={style24}>
                  <p class={style25}>
                    {feature.category}
                  </p>
                </div>
                <h3 class={style26}>{feature.title}</h3>
                <p class={style27}>{feature.description}</p>
                <ul class={style28}>
                  <For each={feature.bullets}>{(bullet) => <li>• {bullet}</li>}</For>
                </ul>
              </article>
            )}
          </For>
        </div>
      </section>

      <section class={style29}>
        <div class={style30}>
          <div class={style19}>
            <div>
              <p class={style2}>Learn the essentials</p>
              <h2 class={style31}>Guides that help your team get started quickly.</h2>
            </div>
            <a href="/docs" class={style21}>
              Browse docs
            </a>
          </div>

          <div class={style32}>
            <For each={docHighlights}>
              {(entry) => (
                <a
                  href={`/docs/${entry.slug}`}
                  class={style33}
                >
                  <div class={style34}>
                    <span>{entry.category}</span>
                    <span>•</span>
                    <span>{entry.readingMinutes} min read</span>
                  </div>
                  <h3 class={style35}>{entry.title}</h3>
                  <p class={style17}>{entry.excerpt}</p>
                </a>
              )}
            </For>
          </div>
        </div>

        <div class={style30}>
          <div class={style19}>
            <div>
              <p class={style2}>Tips, updates, and product news</p>
              <h2 class={style31}>Stay in the loop as the product grows.</h2>
            </div>
            <a href="/blog" class={style21}>
              Visit blog
            </a>
          </div>

          <div class={style36}>
            <For each={postHighlights}>
              {(entry) => (
                <a
                  href={`/blog/${entry.slug}`}
                  class={style37}
                >
                  <div class={style34}>
                    <span>{formatPublishDate(entry.publishedAt)}</span>
                    <span>•</span>
                    <span>{entry.readingMinutes} min read</span>
                  </div>
                  <h3 class={style35}>{entry.title}</h3>
                  <p class={style17}>{entry.excerpt}</p>
                </a>
              )}
            </For>
          </div>
        </div>
      </section>

      <section class={style38}>
        <div class={style39}>
          <p class={style2}>Simple pricing as you grow</p>
          <h2 class={style31}>Start simple and add more when your team is ready.</h2>
          <p class={style40}>
            Start free, add collaboration when it matters, and talk to us when rollout needs more support.
          </p>

          <div class={style41}>
            <For each={PLAN_SUMMARIES}>
              {(plan) => (
                <article
                  class={` ${style42} ${
                    plan.featured
                      ? style43
                      : style44
                  }`}
                >
                  <p class={style45}>{plan.name}</p>
                  <h3 class={style46}>{plan.price}</h3>
                  <p class={style47}>{plan.cadence}</p>
                  <p class={style27}>{plan.description}</p>
                </article>
              )}
            </For>
          </div>
        </div>

        <div class={style30}>
          <p class={style2}>Why teams stick with it</p>
          <ul class={style48}>
            <For each={TRUST_POINTS}>
              {(item) => (
                <li class={style49}>
                  {item}
                </li>
              )}
            </For>
          </ul>
        </div>
      </section>
    </>
  );
}

export default function HomeRoute() {
  return (
    <MarketingLayout>
      <HomeContent />
    </MarketingLayout>
  );
}
