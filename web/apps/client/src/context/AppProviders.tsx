import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { ParentProps } from "solid-js";

import { ApiProvider } from "./ApiContext";
import { ThemeProvider } from "./ThemeContext";
import { ToastProvider } from "./ToastContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
});

export default function AppProviders(props: ParentProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ApiProvider>
          <ToastProvider>{props.children}</ToastProvider>
        </ApiProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
