import { Route, Router } from "@solidjs/router";
import { Layout } from "./components/root-layout";
import DonegeonLanding from "./LandingPage";
import TaskManager from "./components/task";

export default function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={DonegeonLanding} />
      <Route path="/game" component={TaskManager} />
    </Router>
  )
}

