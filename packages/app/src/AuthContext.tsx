import {
  createContext,
  useContext,
  createSignal,
  onMount,
  type Accessor,
  type ParentComponent,
} from 'solid-js';
import { createClient } from '@openauthjs/openauth/client';

const client = createClient({
  clientID: 'game',
  issuer: 'https://auth.donegeon.com',
});

/* ───────── types ───────── */
interface AuthContextType {
  userId: Accessor<string | undefined>;
  loaded: Accessor<boolean>;
  loggedIn: Accessor<boolean>;
  /** current (possibly refreshed) access token */
  token: Accessor<string | undefined>;
  login: () => Promise<void>;
  logout: () => void;
  /** ensure a *fresh* access token, refreshing if needed */
  getToken: () => Promise<string | undefined>;
}

/* ───────── context ───────── */
const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent = (props) => {
  /* ── reactive state ── */
  const [loaded, setLoaded] = createSignal(false);
  const [loggedIn, setLoggedIn] = createSignal(false);
  const [userId, setUserId] = createSignal<string>();
  const [token, setToken] = createSignal<string>();

  /* non‑reactive */
  let initialized = false;

  /* ── run once on mount ── */
  onMount(() => {
    if (initialized) return;
    initialized = true;

    const qs = new URLSearchParams(window.location.search);
    const code = qs.get('code');
    const state = qs.get('state');

    if (code && state) {
      void handleCallback(code, state);
    } else {
      void bootstrap();
    }
  });

  /* ───────────────── helpers ───────────────── */

  /** first load: try to refresh, then get user */
  async function bootstrap() {
    try {
      const t = await refreshTokens();
      if (t) await fetchUser(t);
    } catch (err) {
      console.error("auth bootstrap failed", err);
      // optionally wipe the bad refresh token
      localStorage.removeItem("refresh");
    } finally {
      setLoaded(true);
    }
  }

  /** refresh via refresh‑token (if present) */
  async function refreshTokens(): Promise<string | undefined> {
    const refresh = localStorage.getItem('refresh');
    if (!refresh) return;

    const next = await client.refresh(refresh, { access: token() });
    if (next.err || !next.tokens) return token();

    localStorage.setItem('refresh', next.tokens.refresh);
    setToken(next.tokens.access);
    return next.tokens.access;
  }

  /** public helper so components can insist on a fresh token */
  async function getToken() {
    const t = await refreshTokens();
    if (t) return t;

    // no valid refresh → start login redirect
    await login();
    return undefined; // never reached
  }

  async function login() {
    const { challenge, url } = await client.authorize(
      window.location.origin,
      'code',
      { pkce: true });
    sessionStorage.setItem('challenge', JSON.stringify(challenge));
    window.location.href = url;
  }

  async function handleCallback(code: string, state: string) {
    const challenge = JSON.parse(sessionStorage.getItem('challenge') || '{}');

    if (state !== challenge.state || !challenge.verifier) {
      window.location.replace('/');   // tampered / replay
      return;
    }

    const res = await client.exchange(
      code,
      window.location.origin,
      challenge.verifier,
    );

    if (!res.err && res.tokens) {
      localStorage.setItem('refresh', res.tokens.refresh);
      setToken(res.tokens.access);
      await fetchUser(res.tokens.access);
    }

    window.location.replace('/');
  }

  async function fetchUser(access: string) {
    const r = await fetch(`https://auth.donegeon.com`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!r.ok) return;

    const u = await r.json();
    setUserId(u.userId);
    setLoggedIn(true);
  }

  function logout() {
    localStorage.removeItem('refresh');
    setToken(undefined);
    window.location.replace('/');
  }

  return (
    <AuthContext.Provider
      value={{
        userId,
        loaded,
        loggedIn,
        token,
        login,
        logout,
        getToken,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx)
    throw new Error('useAuth() must be called inside <AuthProvider> …');
  return ctx;
}
