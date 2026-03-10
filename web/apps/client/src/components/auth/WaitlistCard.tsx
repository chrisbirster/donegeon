import { createSignal } from "solid-js";

import { useApi } from "../../context/ApiContext";

type WaitlistCardProps = {
  openBetaStartsLabel: string;
  requestedPlan?: string;
  source?: string;
  title?: string;
  description?: string;
};

function planLabel(raw: string | undefined): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "pro_trial" || value === "pro") return "Pro";
  if (value === "enterprise") return "Enterprise";
  if (value === "personal") return "Personal";
  return "";
}

export default function WaitlistCard(props: WaitlistCardProps) {
  const api = useApi();
  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");
  const [success, setSuccess] = createSignal("");
  const [deliveryWarning, setDeliveryWarning] = createSignal("");

  const requestedPlan = planLabel(props.requestedPlan);

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
    <main class="flex h-screen items-center justify-center bg-[#0a0d12] px-4 text-[#eceff7]">
      <div class="w-full max-w-md rounded-2xl border border-[#2c3648] bg-[#111926] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.45)]">
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#8ea3c7]">Donegeon</p>
        <p class="mt-3 inline-flex rounded-full border border-[#415878] bg-[#132033] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#d3e5ff]">
          Open beta starts {props.openBetaStartsLabel}
        </p>

        <h1 class="mt-4 text-2xl font-semibold tracking-tight text-[#edf3ff]">
          {props.title || "Join the waitlist"}
        </h1>
        <p class="mt-2 text-sm leading-7 text-[#9fb0cc]">
          {props.description ||
            "Donegeon is currently in closed beta. Leave your name and email and we'll notify you as soon as access opens."}
        </p>
        {requestedPlan ? (
          <p class="mt-2 text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Requested plan: {requestedPlan}</p>
        ) : null}

        <form class="mt-6" onSubmit={(event) => void submit(event)}>
          <label class="block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Name</label>
          <input
            type="text"
            required
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
            placeholder="Your name"
          />

          <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Email</label>
          <input
            type="email"
            required
            value={email()}
            onInput={(event) => setEmail(event.currentTarget.value)}
            class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
            placeholder="you@company.com"
          />
          <p class="mt-2 text-xs text-[#8ea3c7]">Confirmation emails are sent from no-reply@donegeon.com.</p>

          <button
            type="submit"
            disabled={saving() || !name().trim() || !email().trim()}
            class="mt-5 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#161616] transition hover:bg-[var(--accent-soft)] disabled:opacity-60"
          >
            {saving() ? "Joining..." : "Join the waitlist"}
          </button>
        </form>

        {success() ? <p class="mt-4 text-sm text-[#a8f1c0]">{success()}</p> : null}
        {deliveryWarning() ? <p class="mt-2 text-xs text-[#ffd18c]">{deliveryWarning()}</p> : null}
        {error() ? <p class="mt-3 text-sm text-[#ff9b9b]">{error()}</p> : null}
      </div>
    </main>
  );
}
