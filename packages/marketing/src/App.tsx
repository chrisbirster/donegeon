import { Route, Router } from "@solidjs/router";
import { Layout } from "./components/root-layout";
import DonegeonLanding from "./LandingPage";
import Waitlist from "./Waitlist";

export default function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={DonegeonLanding} />
      <Route path="/join-waitlist" component={Waitlist} />
    </Router>
  )
}

