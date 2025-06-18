import { createClient } from "@openauthjs/openauth/client";
import { makePersisted } from "@solid-primitives/storage";
import { createStore, produce } from "solid-js/store";
import {
  createContext,
  createEffect,
  onMount,
  type ParentComponent,
  useContext,
} from "solid-js";


interface SubjectInfo {
  id: string;
  refresh: string;
}

interface StorageShape {
  subjects: Record<string, SubjectInfo>;
  current?: string;
}

export interface AuthorizeOptions {
  redirectPath?: string;
  provider?: string;
}

interface AuthContextType {
  /** map of every known account keyed by subject id */
  all: Record<string, SubjectInfo>;
  /** currently selected account (undefined if none logged in) */
  subject?: SubjectInfo;

  /* actions */
  switch: (id: string) => void;
  authorize: (opts?: AuthorizeOptions) => void;
  logout: (id?: string) => void;
  access: (id?: string) => Promise<string | undefined>;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent<{
  issuer: string;
  clientID: string;
}> = (props) => {

  const client = createClient({
    issuer: props.issuer,
    clientID: props.clientID,
  });

  const [store, setStore] = makePersisted(
    createStore<StorageShape>({ subjects: {} }),
    { name: 'donegeon.auth' },
  );

  /* Handle redirect callback once on first mount ------------------- */
  onMount(async () => {
    const qs = new URLSearchParams(window.location.search);
    const code = qs.get("code");
    const state = qs.get("state");
    if (!code || !state) return;

    const oldState = sessionStorage.getItem("openauth.state");
    const verifier = sessionStorage.getItem("openauth.verifier");
    const redirect = sessionStorage.getItem("openauth.redirect");

    if (state !== oldState || !verifier || !redirect) return;

    const res = await client.exchange(code, redirect, verifier);
    if (res.err || !res.tokens) return;

    const id = res.tokens.refresh.split(":").slice(0, -1).join(":");
    setStore(
      produce((s) => {
        s.subjects[id] = { id, refresh: res.tokens.refresh };
        s.current = id;
      }),
    );

    /* clean up the URL */
    window.history.replaceState({}, "", redirect);
  });

  /* If we have no 'current', pick the first one after load */
  createEffect(() => {
    if (!store.current) {
      const first = Object.keys(store.subjects)[0];
      if (first) setStore("current", first);
    }
  });

  /* Access-token helper with cache + in-flight guard ---------------- */
  const accessCache = new Map<string, string>();
  const inFlight = new Map<string, Promise<string | undefined>>();

  async function access(id = store.current): Promise<string | undefined> {
    if (!id) return;
    if (inFlight.has(id)) return inFlight.get(id)!;

    const promise = (async () => {
      const cached = accessCache.get(id);
      const subject = store.subjects[id];
      if (!subject) return;

      const res = await client.refresh(subject.refresh, { access: cached });
      if (res.err) {
        ctx.logout(id);
        return;
      }
      if (res.tokens) {
        setStore("subjects", id, "refresh", res.tokens.refresh);
        accessCache.set(id, res.tokens.access);
        return res.tokens.access;
      }
      // we still had a valid one
      return cached;
    })();

    inFlight.set(
      id,
      promise.finally(() => {
        inFlight.delete(id);
      }),
    );
    return promise;
  }

  /* Authorize (login) */
  async function authorize(opts?: AuthorizeOptions) {
    const redirect = new URL(
      window.location.origin + (opts?.redirectPath ?? "/"),
    ).toString();

    const { url, challenge } = await client.authorize(redirect, "code", {
      pkce: true,
      provider: opts?.provider,
    });


    sessionStorage.setItem("openauth.state", challenge.state);
    sessionStorage.setItem("openauth.redirect", redirect);
    if (challenge.verifier)
      sessionStorage.setItem("openauth.verifier", challenge.verifier);

    window.location.href = url;
  }

  /* Switch / logout helpers */
  function switchSubject(id: string) {
    if (store.subjects[id]) setStore("current", id);
  }

  function logout(id = store.current) {
    if (!id) return;
    setStore(
      produce((s) => {
        delete s.subjects[id];
        if (s.current === id) s.current = Object.keys(s.subjects)[0];
      }),
    );
    accessCache.delete(id);
  }

  /* Context object */
  const ctx: AuthContextType = {
    get all() {
      return store.subjects;
    },
    get subject() {
      return store.current ? store.subjects[store.current] : undefined;
    },
    switch: switchSubject,
    authorize,
    logout,
    access,
  };

  return (
    <AuthContext.Provider value={ctx} >
      {props.children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth() must be used inside <AuthProvider>");
  return c;
}
