import { Route, Router } from "@solidjs/router";
import { Layout } from "./components/root-layout";
import DonegeonLanding from "./LandingPage";
import { TaskDashboard } from "./components/task-dashboard";

export default function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={DonegeonLanding} />
      <Route path="/game" component={TaskDashboard} />
    </Router>
  )
}

