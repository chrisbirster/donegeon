import { render } from "@solidjs/web";

import "./index.css";
import { AppRouter } from "./app";
import AppProviders from "./context/AppProviders";
import { initializeTheme } from "./lib/theme";
import { registerAppServiceWorker } from "./lib/pwa";

initializeTheme();

render(
  () => (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  ),
  document.getElementById("root") as HTMLElement,
);

registerAppServiceWorker();
