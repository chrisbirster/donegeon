import Button from "../Button";
import { css } from "@linaria/core";
import { createSignal } from "solid-js";

import { workspacePlanLabel } from "../../../../../shared/pricing/catalog";
import { useApi } from "../../context/ApiContext";

type WaitlistCardProps = {
  openBetaStartsLabel: string;
  requestedPlan?: string;
  source?: string;
  title?: string;
  description?: string;
};

export default function WaitlistCard(props: WaitlistCardProps) {
  const api = useApi();
  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal("");
  const [deliveryWarning, setDeliveryWarning] = createSignal("");

  const requestedPlan = props.requestedPlan?.trim() ? workspacePlanLabel(props.requestedPlan) : "";

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setDeliveryWarning("");
    setSaving(true);

    try {
      const response = await api.public.joinWaitlist({
        name: name().trim(),
        email: email().trim(),
        source: (props.source || "app-waitlist").trim(),
        requestedPlan: props.requestedPlan?.trim() || undefined,
      });

      setSuccess(
        response.alreadyJoined
          ? `You're already on the Donegeon waitlist. We'll email you when beta opens on ${response.openBetaStartsLabel}.`
          : `You're on the Donegeon waitlist. We'll email you when beta opens on ${response.openBetaStartsLabel}.`,
      );
      setDeliveryWarning((response.deliveryWarning || "").trim());
      if (!response.alreadyJoined) {
        setName("");
        setEmail("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join the waitlist");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main class={style1}>
      <div class={style2}>
        <p class={style3}>Donegeon</p>
        <p class={style4}>
          Open beta starts {props.openBetaStartsLabel}
        </p>

        <h1 class={style5}>
          {props.title || "Join the waitlist"}
        </h1>
        <p class={style6}>
          {props.description ||
            "Donegeon is currently in closed beta. Leave your name and email and we'll notify you as soon as access opens."}
        </p>
        {requestedPlan ? (
          <p class={style7}>Requested plan: {requestedPlan}</p>
        ) : null}

        <form class={style8} onSubmit={(event) => void submit(event)}>
          <label class={style9}>Name</label>
          <input
            type="text"
            required
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            class={style10}
            placeholder="Your name"
          />

          <label class={style11}>Email</label>
          <input
            type="email"
            required
            value={email()}
            onInput={(event) => setEmail(event.currentTarget.value)}
            class={style10}
            placeholder="you@company.com"
          />
          <p class={style12}>Confirmation emails are sent from no-reply@donegeon.com.</p>

          <Button
            type="submit"
            disabled={saving() || !name().trim() || !email().trim()}
            class={style13}
          >
            {saving() ? "Joining..." : "Join the waitlist"}
          </Button>
        </form>

        {success() ? <p class={style14}>{success()}</p> : null}
        {deliveryWarning() ? <p class={style15}>{deliveryWarning()}</p> : null}
        {error() ? <p class={style16}>{error()}</p> : null}
      </div>
    </main>
  );
}


const style1 = css`
display: flex;
height: 100vh;
align-items: center;
justify-content: center;
padding-inline: calc(var(--spacing) * 4);
color: var(--text-main);
`;

const style2 = css`
width: 100%;
max-width: var(--container-md);
border-radius: var(--radius-2xl);
padding: calc(var(--spacing) * 6);
background: var(--panel); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

const style3 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style4 = css`
margin-top: calc(var(--spacing) * 3);
display: inline-flex;
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,139,80,0.24);
background-color: var(--accent-wash);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--accent-text);
text-transform: uppercase;
`;

const style5 = css`
margin-top: calc(var(--spacing) * 4);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: -0.03em;
  letter-spacing: -0.03em;
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style6 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: calc(var(--spacing) * 7);
  line-height: calc(var(--spacing) * 7);
color: var(--text-soft);
`;

const style7 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style8 = css`
margin-top: calc(var(--spacing) * 6);
`;

const style9 = css`
display: block;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style10 = css`
margin-top: calc(var(--spacing) * 2);
width: 100%;
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); &:focus { border-color: var(--accent); outline: none; }
`;

const style11 = css`
margin-top: calc(var(--spacing) * 5);
display: block;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style12 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-muted);
`;

const style13 = css`
margin-top: calc(var(--spacing) * 5);
width: 100%;
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
&:disabled {
    opacity: 60%;
  }
background: var(--accent); color: #1d1108; transition: background-color 160ms ease; &:hover { background: var(--accent-soft); }
`;

const style14 = css`
margin-top: calc(var(--spacing) * 4);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--success);
`;

const style15 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--warning);
`;

const style16 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--danger);
`;
