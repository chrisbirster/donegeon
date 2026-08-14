import { css } from "@linaria/core";

export const purple = css`--tone:#d34cff; --tone-rgb:211,76,255;`;
export const cyan = css`--tone:#39bdf8; --tone-rgb:57,189,248;`;
export const orange = css`--tone:#ff8a28; --tone-rgb:255,138,40;`;
export const green = css`--tone:#77d98d; --tone-rgb:119,217,141;`;

export const hero = css`
  position:relative; margin:calc(var(--spacing) * -14) calc(50% - 50vw) 0; padding:70px max(24px,calc((100vw - 1180px)/2)) 22px; overflow:hidden;
  background:linear-gradient(90deg,rgba(4,8,18,.99) 0%,rgba(4,8,18,.92) 32%,rgba(4,8,18,.24) 73%),linear-gradient(0deg,#07101d 0%,transparent 38%),url('/images/donegeon-hero-city.png') 56% 44%/cover no-repeat;
  border-bottom:1px solid rgba(201,56,255,.2);
  &:after{content:"";position:absolute;inset:auto 0 0;height:30%;background:linear-gradient(transparent,#07101d);pointer-events:none}
`;
export const heroGrid = css`position:relative;z-index:1;display:grid;grid-template-columns:minmax(320px,.7fr) minmax(0,1.35fr);align-items:center;gap:24px;min-height:430px;@media(width<900px){grid-template-columns:1fr;min-height:auto}`;
export const heroCopy = css`position:relative;z-index:2;padding:30px 0;h1{margin:4px 0 0;max-width:420px;color:#f4f0e8;font:900 clamp(3.75rem,5.2vw,5.25rem)/.84 "Bebas Neue",sans-serif;letter-spacing:-.025em;text-transform:uppercase;text-shadow:4px 5px #070812}@media(width<600px){h1{font-size:clamp(3.4rem,17vw,5.5rem)}}`;
export const scriptLabel = css`margin:0;color:#ed47e8;font:1rem/1.08 "Permanent Marker",cursive;text-transform:uppercase;transform:rotate(-2deg);text-shadow:0 0 14px rgba(237,71,232,.48);`;
export const heroText = css`max-width:430px;margin:26px 0 0;color:#c4c8d0;font-size:1rem;line-height:1.65;`;
export const heroActions = css`display:flex;flex-wrap:wrap;gap:12px;margin-top:24px;`;
export const primaryButton = css`display:inline-flex;min-width:168px;align-items:center;justify-content:center;gap:12px;border:1px solid #d95cff;border-radius:5px;background:linear-gradient(135deg,#a51be8,#7211c2);padding:12px 20px;color:white;font-weight:700;box-shadow:0 0 22px rgba(191,38,255,.25);transition:.18s ease;&:hover{transform:translateY(-1px);filter:brightness(1.12)}`;
export const secondaryButton = css`display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.26);border-radius:5px;background:rgba(6,11,21,.72);padding:12px 20px;color:#e4e7eb;transition:.18s ease;&:hover{transform:translateY(-1px);border-color:#b94ce8}`;
export const showcase = css`position:relative;border:1px solid rgba(247,54,211,.92);border-radius:13px;background:#050914;padding:7px;box-shadow:0 0 0 2px rgba(171,64,255,.18),0 0 32px rgba(235,35,206,.22),0 28px 70px rgba(0,0,0,.56);overflow:hidden;transform:perspective(1200px) rotateY(-1.2deg);img{display:block;width:100%;aspect-ratio:1.72;object-fit:cover;object-position:center;border-radius:8px}@media(width<900px){transform:none}`;
export const trustStrip = css`position:relative;z-index:2;display:grid;grid-template-columns:repeat(4,1fr);max-width:850px;margin:4px auto 0;border:1px solid rgba(159,91,213,.34);border-radius:8px;background:rgba(8,15,28,.91);box-shadow:0 10px 32px rgba(0,0,0,.3);span{padding:12px 18px;color:#b9bfca;font-size:.78rem;text-align:center}span+span{border-left:1px solid rgba(255,255,255,.1)}@media(width<680px){grid-template-columns:1fr 1fr;span:nth-child(3){border-left:0}span:nth-child(n+3){border-top:1px solid rgba(255,255,255,.1)}}`;

export const metricGrid = css`display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px;@media(width<900px){grid-template-columns:1fr 1fr}@media(width<520px){grid-template-columns:1fr}`;
export const metricCard = css`display:flex;align-items:center;gap:14px;min-height:112px;border:1px solid rgba(var(--tone-rgb),.28);border-radius:10px;background:linear-gradient(145deg,rgba(var(--tone-rgb),.07),rgba(10,18,30,.88));padding:16px;transition:.18s ease;&:hover{transform:translateY(-2px);border-color:rgba(var(--tone-rgb),.52)}`;
export const iconBubble = css`display:grid;flex:0 0 48px;width:48px;height:48px;place-items:center;border:1px solid var(--tone);border-radius:50%;background:rgba(var(--tone-rgb),.1);color:var(--tone);font-size:1.65rem;box-shadow:0 0 18px rgba(var(--tone-rgb),.13);`;
export const eyebrow = css`margin:0;color:var(--tone,#d34cff);font-size:.67rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;`;
export const metricLine = css`margin:7px 0 0;color:#b8c0cc;font-size:.77rem;line-height:1.45;strong{margin-right:5px;color:#f4f4f2;font-size:1.85rem;line-height:1}`;

export const section = css`margin-top:64px;scroll-margin-top:90px;`;
export const sectionHeading = css`display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:18px;h2{margin:5px 0 0;color:#f2f0eb;font:700 clamp(1.55rem,3vw,2.2rem)/1.1 "Space Grotesk",sans-serif}a{color:#c5cbd4;font-size:.78rem;white-space:nowrap}p:last-child{margin:0;color:#808a9a;font-size:.75rem}@media(width<650px){align-items:flex-start;flex-direction:column}`;
export const featureGrid = css`display:grid;grid-template-columns:repeat(4,1fr);gap:10px;@media(width<950px){grid-template-columns:1fr 1fr}@media(width<560px){grid-template-columns:1fr}`;
export const featureCard = css`display:flex;min-height:395px;flex-direction:column;border:1px solid rgba(var(--tone-rgb),.28);border-radius:11px;background:linear-gradient(180deg,rgba(15,25,39,.96),rgba(9,16,27,.97));padding:20px;transition:.18s ease;&:hover{transform:translateY(-2px);border-color:rgba(var(--tone-rgb),.52)}h3{margin:16px 0 0;color:var(--tone);font-size:1.05rem}p{margin:9px 0 0;color:#abb4c1;font-size:.77rem;line-height:1.55}ul{margin:18px 0 20px;padding-left:16px;color:#d1d5db;font-size:.72rem;line-height:1.55}li::marker{color:var(--tone)}a{margin-top:auto;color:var(--tone);font-size:.72rem}`;

export const resourceGrid = css`display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;scroll-margin-top:90px;@media(width<800px){grid-template-columns:1fr}`;
export const resourcePanel = css`border:1px solid rgba(159,91,213,.3);border-radius:11px;background:rgba(8,15,27,.94);padding:18px;`;
export const panelHeading = css`display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:13px;h2{margin:4px 0 0;color:#f0eef0;font-size:1.16rem;line-height:1.08}a{color:#b5bdc8;font-size:.68rem;white-space:nowrap}`;
export const articleList = css`display:grid;gap:6px;`;
export const articleRow = css`display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:10px;min-height:60px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#101927;padding:7px 11px;transition:.18s ease;&:hover{border-color:rgba(198,70,244,.5);transform:translateY(-1px)}small{display:block;color:#7f8998;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase}strong{display:block;margin-top:3px;color:#e8e9ec;font-size:.77rem;font-weight:600}b{color:#aeb5c0;font-weight:400}`;
export const articleIcon = css`display:grid;width:36px;height:36px;place-items:center;border:1px solid var(--tone);border-radius:50%;color:var(--tone);font-size:1.2rem;`;
export const thumbnail = css`display:block;width:42px;height:44px;border-radius:5px;background-image:linear-gradient(135deg,rgba(224,47,218,.25),rgba(7,13,25,.1)),url('/images/donegeon-hero-city.png');background-size:cover;`;
export const thumb1 = css`background-position:72% 35%;`;
export const thumb2 = css`background-position:58% 55%;`;
export const thumb3 = css`background-position:42% 70%;`;

export const pricingGrid = css`display:grid;grid-template-columns:1fr 1.08fr 1fr 1.55fr;gap:10px;@media(width<1000px){grid-template-columns:1fr 1fr}@media(width<570px){grid-template-columns:1fr}`;
export const priceCard = css`position:relative;display:flex;min-height:335px;flex-direction:column;border:1px solid rgba(255,255,255,.18);border-radius:11px;background:linear-gradient(180deg,#101927,#09111d);padding:17px;color:#aeb7c4;p{margin:10px 0 0;font-size:.72rem;line-height:1.45}ul{margin:14px 0;padding-left:16px;color:#d3d7dd;font-size:.7rem}a{margin-top:auto;border:1px solid rgba(255,255,255,.3);border-radius:5px;padding:8px;color:#eef0f3;font-size:.72rem;text-align:center}`;
export const featuredPlan = css`border-color:#38bdf8;box-shadow:0 0 24px rgba(56,189,248,.1);`;
export const popular = css`position:absolute;top:-8px;right:14px;border-radius:3px;background:#37a9d8;padding:2px 8px;color:#06111b;font-size:.55rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;`;
export const planName = css`color:#d3d8df!important;font-size:.62rem!important;font-weight:800;letter-spacing:.15em;text-transform:uppercase;`;
export const price = css`display:flex;align-items:baseline;gap:8px;margin-top:5px;strong{color:#fff;font-size:2rem}span{color:#9aa4b2;font-size:.66rem}`;
export const benefits = css`border:1px solid rgba(193,60,255,.34);border-radius:11px;background:linear-gradient(145deg,rgba(74,26,101,.24),rgba(10,16,29,.96));padding:19px;>div{display:grid;grid-template-columns:32px 1fr;align-items:center;gap:10px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.09)}>div:last-child{border-bottom:0}>div span{display:grid;width:28px;height:28px;place-items:center;border:1px solid var(--tone);border-radius:50%;color:var(--tone)}p{margin:0;color:#c7cbd2;font-size:.74rem;line-height:1.45}`;
