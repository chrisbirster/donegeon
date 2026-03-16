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
    <main class="flex h-screen items-center justify-center px-4 text-[var(--text-main)]">
      <div class="app-panel w-full max-w-md rounded-2xl p-6">
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Donegeon</p>
        <p class="mt-3 inline-flex rounded-full border border-[rgba(255,139,80,0.24)] bg-[var(--accent-wash)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-text)]">
          Open beta starts {props.openBetaStartsLabel}
        </p>

        <h1 class="font-display mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">
          {props.title || "Join the waitlist"}
        </h1>
        <p class="mt-2 text-sm leading-7 text-[var(--text-soft)]">
          {props.description ||
            "Donegeon is currently in closed beta. Leave your name and email and we'll notify you as soon as access opens."}
        </p>
        {requestedPlan ? (
          <p class="mt-2 text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Requested plan: {requestedPlan}</p>
        ) : null}

        <form class="mt-6" onSubmit={(event) => void submit(event)}>
          <label class="block text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Name</label>
          <input
            type="text"
            required
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            class="app-input-surface mt-2 w-full rounded-lg px-3 py-2"
            placeholder="Your name"
          />

          <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Email</label>
          <input
            type="email"
            required
            value={email()}
            onInput={(event) => setEmail(event.currentTarget.value)}
            class="app-input-surface mt-2 w-full rounded-lg px-3 py-2"
            placeholder="you@company.com"
          />
          <p class="mt-2 text-xs text-[var(--text-muted)]">Confirmation emails are sent from no-reply@donegeon.com.</p>

          <button
            type="submit"
            disabled={saving() || !name().trim() || !email().trim()}
            class="app-button-primary mt-5 w-full rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {saving() ? "Joining..." : "Join the waitlist"}
          </button>
        </form>

        {success() ? <p class="mt-4 text-sm text-[var(--success)]">{success()}</p> : null}
        {deliveryWarning() ? <p class="mt-2 text-xs text-[var(--warning)]">{deliveryWarning()}</p> : null}
        {error() ? <p class="mt-3 text-sm text-[var(--danger)]">{error()}</p> : null}
      </div>
    </main>
  );
}
