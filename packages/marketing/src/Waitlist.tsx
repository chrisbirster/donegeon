import { css } from "@linaria/core";
import { Button } from "./components/button";

const formBox = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(90vw, 26rem);
`;

const inputBase = css`
  width: 100%;
  padding: 0.625rem 0.875rem;
  font-size: 1rem;
  color: #fff;
  background: #2a2a2e;
  border: 1px solid var(--gray700);
  border-radius: 6px;
  transition: border-color 0.15s;
  &:focus {
    outline: none;
    border-color: var(--primary);
  }
`;

const checkboxRow = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--gray400);
`;

export default function Waitlist() {
  const SITE_KEY = import.meta.env.VITE_TURNSTILE_KEY;


  const submit = async (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const email = (form.email as HTMLInputElement).value;
    // @ts-ignore Turnstile global
    const token = window.turnstile?.getResponse(); // single widget on the page
    if (!token) return alert("Please complete the captcha");

    const res = await fetch("https://api.donegeon.com/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, turnstileToken: token }),
    });

    if (res.ok) alert("Welcome to the queue! Check your inbox 🎉");
    else alert("Something went wrong. Please try again.");
  };

  return (
    <form id="join-waitlist-form" class={formBox} onSubmit={submit}>
      <label for="email" class={css`display:none;`}>E‑mail</label>
      <input
        id="email"
        name="email"
        type="email"
        placeholder="cool‑person@awesome‑domain.com"
        required
        class={inputBase}
      />

      {/* Turnstile widget placeholder */}
      <div class="cf-turnstile" data-sitekey={SITE_KEY}></div>

      <label class={checkboxRow}>
        <input type="checkbox" name="newsletter" />
        Subscribe to the newsletter?
      </label>

      <Button size="md" type="submit" class={css`margin-top:0.25rem;`}>
        Join Waitlist
      </Button>
    </form>
  );
}

