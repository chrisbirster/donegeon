import { render } from "@solidjs/web";

import "./index.css";
import { AppRouter } from "./app";

render(
  () => (
    <AppRouter />
  ),
  document.getElementById("root") as HTMLElement,
);
