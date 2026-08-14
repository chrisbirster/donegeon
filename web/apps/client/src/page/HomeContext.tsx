import { createContext, useContext, type ParentProps } from "solid-js";
import type { HomeController } from "./HomeController";

const HomeContext = createContext<HomeController>();

export function HomeProvider(props: ParentProps<{ value: HomeController }>) {
  return <HomeContext value={props.value}>{props.children}</HomeContext>;
}

export function useHome() {
  return useContext(HomeContext);
}
