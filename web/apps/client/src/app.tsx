import { Navigate, Route } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import { Match, Switch, type Component } from "solid-js";

import BoardRoute from "./routes/BoardRoute";
import BoardStoreRoute from "./routes/BoardStoreRoute";
import HomeRoute from "./routes/HomeRoute";
import LoginRoute from "./routes/LoginRoute";
import OnboardingRoute from "./routes/OnboardingRoute";
import ProfileRoute from "./routes/ProfileRoute";
import TeamSettingsRoute from "./routes/TeamSettingsRoute";
import WaitlistRoute from "./routes/WaitlistRoute";
import { useApi } from "./context/ApiContext";

type ProtectedRouteProps = {
  component: Component;
};

function ProtectedRoute(props: ProtectedRouteProps) {
  const api = useApi();
  const session = createQuery(() => ({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const response = await api.auth.me();
      return response.session;
    },
  }));

  return (
    <Switch>
      <Match when={session.isPending}>
        <main class="flex h-screen items-center justify-center bg-[#0a0d12] text-[#c8d5eb]">Loading...</main>
      </Match>
      <Match when={session.isError}>
        <Navigate href="/login" />
      </Match>
      <Match when={session.data && session.data.user.showOnboarding}>
        <Navigate href="/onboarding" />
      </Match>
      <Match when={session.data}>
        {(() => {
          const ComponentRef = props.component;
          return <ComponentRef />;
        })()}
      </Match>
    </Switch>
  );
}

export default function App() {
  return (
    <>
      <Route path="/" component={() => <Navigate href="/task/inbox" />} />
      <Route path="/login" component={LoginRoute} />
      <Route path="/waitlist" component={WaitlistRoute} />
      <Route path="/onboarding" component={OnboardingRoute} />
      <Route path="/task" component={() => <Navigate href="/task/inbox" />} />
      <Route path="/task/*" component={() => <ProtectedRoute component={HomeRoute} />} />
      <Route path="/board/store" component={() => <ProtectedRoute component={BoardStoreRoute} />} />
      <Route path="/board" component={() => <ProtectedRoute component={BoardRoute} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfileRoute} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={TeamSettingsRoute} />} />
      <Route path="/team/settings" component={() => <ProtectedRoute component={TeamSettingsRoute} />} />
    </>
  );
}
