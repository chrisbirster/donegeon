import type {
  UiActionBusWorkerInbound,
  UiActionBusWorkerOutbound,
  WorkerApiRequestMessage,
} from "../lib/uiEventBusTypes";

function safeErrorMessage(body: unknown, status: number): string {
  const payload = body as any;
  const apiMessage =
    payload?.error?.message ||
    payload?.error?.code ||
    (typeof payload?.error === "string" ? payload.error : undefined) ||
    (typeof payload?.message === "string" ? payload.message : undefined);
  if (typeof apiMessage === "string" && apiMessage.trim()) {
    return apiMessage.trim();
  }
  return `HTTP ${status}`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const raw = await response.text();
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function handleApiRequest(message: WorkerApiRequestMessage): Promise<UiActionBusWorkerOutbound> {
  try {
    const response = await fetch(message.path, {
      method: message.method,
      credentials: "same-origin",
      headers: message.headers,
      body: message.body,
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
      return {
        type: "api.response",
        requestId: message.requestId,
        ok: false,
        status: response.status,
        body,
        errorMessage: safeErrorMessage(body, response.status),
      };
    }

    return {
      type: "api.response",
      requestId: message.requestId,
      ok: true,
      status: response.status,
      body,
    };
  } catch (err) {
    return {
      type: "api.response",
      requestId: message.requestId,
      ok: false,
      status: 0,
      errorMessage: err instanceof Error ? err.message : "Worker request failed",
    };
  }
}

globalThis.onmessage = (event: MessageEvent<UiActionBusWorkerInbound>) => {
  const message = event.data;
  if (message.type !== "api.request") {
    return;
  }

  void handleApiRequest(message).then((outbound) => {
    globalThis.postMessage(outbound);
  });
};
