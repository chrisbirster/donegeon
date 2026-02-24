import { Navigate, Route } from "@solidjs/router";

import BoardRoute from "./routes/BoardRoute";
import HomeRoute from "./routes/HomeRoute";

export default function App() {
  return (
    <>
      <Route path="/" component={() => <Navigate href="/task" />} />
      <Route path="/task" component={() => <Navigate href="/task/inbox" />} />
      <Route path="/task/*" component={HomeRoute} />
      <Route path="/board" component={BoardRoute} />
    </>
  );
}
