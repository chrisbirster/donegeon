import { For } from "solid-js";

import MarketingLayout from "../components/MarketingLayout";
import { usePublicConfig } from "../context/PublicConfigContext";
import { docs, formatPublishDate, posts } from "../lib/content";
import { PLAN_LINKS, planHref, waitlistHref } from "../lib/site";
import * as s from "./styles/HomeRoute.styles";

const features = [
  { icon: "◎", accent: "purple", title: "Capture", description: "Add tasks, priorities, dates, and repeat schedules in one quick step so work gets recorded before it gets forgotten.", bullets: ["Create tasks in seconds", "Add due dates & priorities", "Repeat & recurring schedules", "Keep structure without wrestling a long form"] },
  { icon: "▦", accent: "cyan", title: "Scheduling", description: "Keep weekly routines, recurring responsibilities, and follow-ups visible so nothing slips through the cracks.", bullets: ["Flexible daily, weekly, & monthly repeats", "A clearer view of what's coming", "Less manual re-entry for repeat work"] },
  { icon: "⌁", accent: "orange", title: "Execution", description: "Capture everything in one place, then shift active work onto a board your team can use to make faster decisions.", bullets: ["Task lists tailored to your workflow", "Shared visibility into active work", "A better way to decide what moves next"] },
  { icon: "▤", accent: "green", title: "Board", description: "Donegeon turns active work into a living board so priorities stay clear and progress is easy to spot at a glance.", bullets: ["Drag work across a shared map", "Keep backlog pressure visible", "Give the team a board worth checking"] },
];

const metrics = [
  { icon: "◎", accent: "purple", label: "Built for planning", value: "9", text: "Core areas covering capture, scheduling, boards, collaboration, and more." },
  { icon: "♙", accent: "cyan", label: "Built for teamwork", value: "4", text: "Guides and walkthroughs to help your team get started faster." },
  { icon: "ϟ", accent: "orange", label: "Built for momentum", value: "3", text: "Product updates and ideas to keep teams learning as Donegeon grows." },
  { icon: "◇", accent: "green", label: "Trust & security", value: "", text: "Your data. Your rules. Bank-grade security and privacy by design." },
];

const plans = [
  { name: "Free", price: "$0", cadence: "forever", description: "For individuals who want faster task capture, recurring work, personal board overview, and calendar sync without team admin overhead.", bullets: ["Core features for getting started"], cta: "Get started", href: planHref("personal") },
  { name: "Pro", price: "$12", cadence: "per user / month", description: "For teams that need shared boards, invitations, role controls, board member management, and team operations on top of the Free workflow.", bullets: ["Everything in Free", "Unlimited boards", "Advanced controls", "Priority support"], cta: "Start Pro trial", href: planHref("pro_trial"), featured: true },
  { name: "Enterprise", price: "Custom", cadence: "annual", description: "For larger organizations that need sales-led rollout, security review, procurement help, and priority migration planning.", bullets: ["SSO & SCIM", "Audit logs & controls", "Dedicated support"], cta: "Contact sales", href: PLAN_LINKS.enterprise },
];

const benefits = [
  ["ϟ", "Fast setup for solo work or team onboarding"],
  ["♙", "Shared boards, invites, and roles when you need to collaborate"],
  ["⌾", "Clear pricing, support, and an enterprise path as you grow"],
  ["▤", "A workflow that feels more engaging than another flat task list"],
];

function HomeContent() {
  const config = usePublicConfig();
  const primaryHref = () => config.openBeta ? planHref("personal") : waitlistHref({ source: "marketing-home-hero", plan: "personal" });
  const featuredGuides = docs.filter((entry) => entry.featured).slice(0, 3);
  const guides = featuredGuides.length === 3 ? featuredGuides : docs.slice(0, 3);
  const news = posts.slice(0, 3);

  return (
    <>
      <section id="overview" class={s.hero}>
        <div class={s.heroGrid}>
          <div class={s.heroCopy}>
            <p class={s.scriptLabel}>Turn chaos into coordination.<br />Make your team legendary.</p>
            <h1>Welcome to<br />the Donegeon.</h1>
            <p class={s.heroText}>Donegeon turns disorganized work into clear missions, shared intel, and team momentum. Plan the job. Assign the crew. Execute. Get paid.</p>
            <div class={s.heroActions}>
              <a class={s.primaryButton} href={primaryHref()}>{config.openBeta ? "Enter the Donegeon" : "Join waitlist"} <span>→</span></a>
              <a class={s.secondaryButton} href="#features"><span>▷</span> See how it works</a>
            </div>
          </div>
          <div class={s.showcase}>
            <img src="/images/marketing/board-action.png" alt="Donegeon board showing cards, tasks, resources, and a city map" />
          </div>
        </div>
        <div class={s.trustStrip} aria-label="Product trust highlights">
          <span>▣ Bank-grade security</span><span>◇ SOC 2 aligned</span><span>ϟ Built for speed</span><span>♙ Teams of any size</span>
        </div>
      </section>

      <section class={s.metricGrid} aria-label="Donegeon at a glance">
        <For each={metrics}>{(item) => (
          <article class={`${s.metricCard} ${s[item.accent as keyof typeof s]}`}>
            <div class={s.iconBubble}>{item.icon}</div>
            <div><p class={s.eyebrow}>{item.label}</p><p class={s.metricLine}>{item.value && <strong>{item.value}</strong>} {item.text}</p></div>
          </article>
        )}</For>
      </section>

      <section id="features" class={s.section}>
        <div class={s.sectionHeading}><div><p class={s.eyebrow}>Features</p><h2>Everything your team needs to plan and execute.</h2></div><a href="/features">Explore all features →</a></div>
        <div class={s.featureGrid}>
          <For each={features}>{(item) => (
            <article class={`${s.featureCard} ${s[item.accent as keyof typeof s]}`}>
              <div class={s.iconBubble}>{item.icon}</div><h3>{item.title}</h3><p>{item.description}</p>
              <ul><For each={item.bullets}>{(bullet) => <li>{bullet}</li>}</For></ul><a href="/features">Learn more →</a>
            </article>
          )}</For>
        </div>
      </section>

      <section class={s.resourceGrid}>
        <article id="docs" class={s.resourcePanel}>
          <div class={s.panelHeading}><div><p class={s.eyebrow}>Learn the essentials</p><h2>Guides that help your team<br />get started quickly.</h2></div><a href="/docs">Browse docs →</a></div>
          <div class={s.articleList}><For each={guides}>{(entry, index) => <a class={s.articleRow} href={`/docs/${entry.slug}`}><span class={`${s.articleIcon} ${index() === 1 ? s.cyan : index() === 2 ? s.green : s.purple}`}>{index() === 0 ? "◎" : index() === 1 ? "▤" : "♙"}</span><span><small>{entry.category} · {entry.readingMinutes} min read</small><strong>{entry.title}</strong></span><b>→</b></a>}</For></div>
        </article>
        <article id="blog" class={s.resourcePanel}>
          <div class={s.panelHeading}><div><p class={s.eyebrow}>Tips, updates, and product news</p><h2>Stay in the loop as the<br />product grows.</h2></div><a href="/blog">Visit blog →</a></div>
          <div class={s.articleList}><For each={news}>{(entry, index) => <a class={s.articleRow} href={`/blog/${entry.slug}`}><span class={`${s.thumbnail} ${s[`thumb${index() + 1}` as keyof typeof s]}`} /><span><small>{formatPublishDate(entry.publishedAt)} · {entry.readingMinutes} min read</small><strong>{entry.title}</strong></span><b>→</b></a>}</For></div>
        </article>
      </section>

      <section id="pricing" class={s.section}>
        <div class={s.sectionHeading}><div><p class={s.eyebrow}>Simple pricing, as you grow</p><h2>Start simple and add more when your team is ready.</h2></div><p>All plans include bank-grade security and core features.</p></div>
        <div class={s.pricingGrid}>
          <For each={plans}>{(plan) => <article class={`${s.priceCard} ${plan.featured ? s.featuredPlan : ""}`}>{plan.featured && <span class={s.popular}>Most popular</span>}<p class={s.planName}>{plan.name}</p><div class={s.price}><strong>{plan.price}</strong><span>{plan.cadence}</span></div><p>{plan.description}</p><ul><For each={plan.bullets}>{(bullet) => <li>{bullet}</li>}</For></ul><a href={config.openBeta ? plan.href : waitlistHref({ source: "marketing-pricing", plan: plan.name.toLowerCase() })}>{config.openBeta ? plan.cta : "Join waitlist"}</a></article>}</For>
          <aside class={s.benefits}><p class={s.eyebrow}>Why teams stick with it</p><For each={benefits}>{(item, index) => <div><span class={index() === 1 ? s.cyan : index() === 2 ? s.orange : index() === 3 ? s.green : s.purple}>{item[0]}</span><p>{item[1]}</p></div>}</For></aside>
        </div>
      </section>
    </>
  );
}

export default function HomeRoute() { return <MarketingLayout><HomeContent /></MarketingLayout>; }
