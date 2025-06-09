import { Route, Router } from "@solidjs/router";
import { Layout } from "./components/root-layout";
import DonegeonLanding from "./LandingPage";

export default function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={DonegeonLanding} />
    </Router>
  )
}

