import { Route } from "@solidjs/router";

import HomeRoute from "./routes/HomeRoute";

export default function App() {
  return <Route path="/" component={HomeRoute} />;
}
