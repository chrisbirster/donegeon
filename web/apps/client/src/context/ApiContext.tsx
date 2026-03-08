import { ParentProps, createContext, useContext } from "solid-js";

import { apiClient, type ApiClient } from "../server/api";

const ApiContext = createContext<ApiClient>(apiClient);

type ApiProviderProps = ParentProps<{
  client?: ApiClient;
}>;

export function ApiProvider(props: ApiProviderProps) {
  return <ApiContext.Provider value={props.client ?? apiClient}>{props.children}</ApiContext.Provider>;
}

export function useApi() {
  const ctx = useContext(ApiContext);
  if (!ctx) {
    throw new Error("ApiContext is not available");
  }
  return ctx;
}
