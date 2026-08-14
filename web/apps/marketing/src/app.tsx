import { createRouter } from "@solidjs/router";

import BlogPostRoute from "./routes/BlogPostRoute";
import BlogRoute from "./routes/BlogRoute";
import DocRoute from "./routes/DocRoute";
import DocsRoute from "./routes/DocsRoute";
import FeaturesRoute from "./routes/FeaturesRoute";
import HomeRoute from "./routes/HomeRoute";
import NotFoundRoute from "./routes/NotFoundRoute";
import PricingRoute from "./routes/PricingRoute";

export const AppRouter = createRouter({
  routes: [
    { path: "/", component: HomeRoute },
    { path: "/features", component: FeaturesRoute },
    { path: "/docs", component: DocsRoute },
    { path: "/docs/:slug", component: DocRoute },
    { path: "/blog", component: BlogRoute },
    { path: "/blog/:slug", component: BlogPostRoute },
    { path: "/pricing", component: PricingRoute },
    { path: "*all", component: NotFoundRoute },
  ],
});
