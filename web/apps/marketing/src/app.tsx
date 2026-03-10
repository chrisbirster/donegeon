import { Route } from "@solidjs/router";

import BlogPostRoute from "./routes/BlogPostRoute";
import BlogRoute from "./routes/BlogRoute";
import DocRoute from "./routes/DocRoute";
import DocsRoute from "./routes/DocsRoute";
import FeaturesRoute from "./routes/FeaturesRoute";
import HomeRoute from "./routes/HomeRoute";
import NotFoundRoute from "./routes/NotFoundRoute";
import PricingRoute from "./routes/PricingRoute";

export default function App() {
  return (
    <>
      <Route path="/" component={HomeRoute} />
      <Route path="/features" component={FeaturesRoute} />
      <Route path="/docs" component={DocsRoute} />
      <Route path="/docs/:slug" component={DocRoute} />
      <Route path="/blog" component={BlogRoute} />
      <Route path="/blog/:slug" component={BlogPostRoute} />
      <Route path="/pricing" component={PricingRoute} />
      <Route path="/*all" component={NotFoundRoute} />
    </>
  );
}
