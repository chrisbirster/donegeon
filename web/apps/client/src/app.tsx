import { Navigate, Route } from "@solidjs/router";
import { Match, Switch, createResource, type Component } from "solid-js";

import BoardRoute from "./routes/BoardRoute";
import BuilderRoute from "./routes/BuilderRoute";
import HomeRoute from "./routes/HomeRoute";
import LoginRoute from "./routes/LoginRoute";
import OnboardingRoute from "./routes/OnboardingRoute";
import ProfileRoute from "./routes/ProfileRoute";
import TeamSettingsRoute from "./routes/TeamSettingsRoute";
import { authApi } from "./server/api";

type ProtectedRouteProps = {
  component: Component;
};

function ProtectedRoute(props: ProtectedRouteProps) {
  const [session] = createResource(async () => {
    const response = await authApi.me();
    return response.session;
  });

  return (
    <Switch>
      <Match when={session.loading}>
        <main class="flex h-screen items-center justify-center bg-[#0a0d12] text-[#c8d5eb]">Loading...</main>
      </Match>
      <Match when={session.error}>
        <Navigate href="/login" />
      </Match>
      <Match when={session() && session()!.user.showOnboarding}>
        <Navigate href="/onboarding" />
      </Match>
      <Match when={session()}>
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
      <Route path="/onboarding" component={OnboardingRoute} />
      <Route path="/task" component={() => <Navigate href="/task/inbox" />} />
      <Route path="/task/*" component={() => <ProtectedRoute component={HomeRoute} />} />
      <Route path="/board" component={() => <ProtectedRoute component={BoardRoute} />} />
      <Route path="/builder" component={() => <ProtectedRoute component={BuilderRoute} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfileRoute} />} />
      <Route path="/team/settings" component={() => <ProtectedRoute component={TeamSettingsRoute} />} />
    </>
  );
}
