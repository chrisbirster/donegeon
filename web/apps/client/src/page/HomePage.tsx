import { HomeProvider } from "./HomeContext";
import { createHomeController } from "./HomeController";
import HomeView from "./HomeView";

export default function HomeRoute() {
  const controller = createHomeController();
  return (
    <HomeProvider value={controller}>
      <HomeView />
    </HomeProvider>
  );
}
