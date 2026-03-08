import { render } from "solid-js/web";
import { Router } from "@solidjs/router";

import "./index.css";
import App from "./app";
import AppProviders from "./context/AppProviders";
import { registerAppServiceWorker } from "./lib/pwa";

render(
  () => (
    <AppProviders>
      <Router>
        <App />
      </Router>
    </AppProviders>
  ),
  document.getElementById("root") as HTMLElement,
);

registerAppServiceWorker();
