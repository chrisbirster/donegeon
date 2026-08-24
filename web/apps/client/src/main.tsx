import { render } from "@solidjs/web";

import "./index.css";
import { AppRouter } from "./app";
import AppProviders from "./context/AppProviders";
import { initializeTheme } from "./lib/theme";
import { registerAppServiceWorker } from "./lib/pwa";

initializeTheme();

render(
  () => (
    <AppRouter>
      {(props) => <AppProviders>{props.children}</AppProviders>}
    </AppRouter>
  ),
  document.getElementById("root") as HTMLElement,
);

registerAppServiceWorker();
