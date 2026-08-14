import { createRouter, useNavigate } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import { Match, Switch, onSettled, type Component } from "solid-js";

import BoardRoute from "./routes/BoardRoute";
import BoardStoreRoute from "./routes/BoardStoreRoute";
import HomeRoute from "./routes/HomeRoute";
import LoginRoute from "./routes/LoginRoute";
import OnboardingRoute from "./routes/OnboardingRoute";
import ProfileRoute from "./routes/ProfileRoute";
import SettingsRoute from "./routes/SettingsRoute";
import TeamSettingsRoute from "./routes/TeamSettingsRoute";
import WaitlistRoute from "./routes/WaitlistRoute";
import { useApi } from "./context/ApiContext";

function Redirect(props: { href: string }) {
  const navigate = useNavigate();
  onSettled(() => {
    const timer = window.setTimeout(() => navigate(props.href, { replace: true }), 0);
    return () => window.clearTimeout(timer);
  });
  return null;
}

function ProtectedRoute(props: { component: Component }) {
  const api = useApi();
  const session = createQuery(() => ({
    queryKey: ["auth", "me"],
    queryFn: async () => (await api.auth.me()).session,
  }));

  return (
    <Switch>
      <Match when={session.isPending}>
        <main class="flex h-screen items-center justify-center text-[var(--text-soft)]">Loading...</main>
      </Match>
      <Match when={session.isError}>
        <Redirect href="/login" />
      </Match>
      <Match when={session.data?.user.showOnboarding}>
        <Redirect href="/onboarding" />
      </Match>
      <Match when={session.data}>{props.component({})}</Match>
    </Switch>
  );
}

const protect = (component: Component): Component => () => <ProtectedRoute component={component} />;
const inboxRedirect: Component = () => <Redirect href="/task/inbox" />;

export const AppRouter = createRouter({
  routes: [
    { path: "/", component: inboxRedirect },
    { path: "/login", component: LoginRoute },
    { path: "/waitlist", component: WaitlistRoute },
    { path: "/onboarding", component: OnboardingRoute },
    { path: "/task", component: inboxRedirect },
    { path: "/task/*rest", component: protect(HomeRoute) },
    { path: "/board/store", component: protect(BoardStoreRoute) },
    { path: "/board", component: protect(BoardRoute) },
    { path: "/profile", component: protect(ProfileRoute) },
    { path: "/settings", component: protect(SettingsRoute) },
    { path: "/team/settings", component: protect(TeamSettingsRoute) },
  ],
});
