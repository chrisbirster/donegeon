import { type ParentProps, createContext, useContext } from "solid-js";

import { type MarketingPublicConfig, defaultPublicConfig } from "../lib/site";

const PublicConfigContext = createContext<MarketingPublicConfig>(defaultPublicConfig());

type PublicConfigProviderProps = ParentProps<{
  config: MarketingPublicConfig;
}>;

export function PublicConfigProvider(props: PublicConfigProviderProps) {
  return <PublicConfigContext value={props.config}>{props.children}</PublicConfigContext>;
}

export function usePublicConfig() {
  return useContext(PublicConfigContext) || defaultPublicConfig();
}
