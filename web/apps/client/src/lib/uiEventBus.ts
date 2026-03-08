import type {
  UiActionBusWorkerOutbound,
  WorkerApiRequestMessage,
  WorkerApiResponseMessage,
} from "./uiEventBusTypes";

export class UiActionBusUnavailableError extends Error {
  constructor(message = "UI action bus worker is unavailable") {
    super(message);
    this.name = "UiActionBusUnavailableError";
  }
}

type PendingRequest = {
  resolve: (response: WorkerApiResponseMessage) => void;
  reject: (error: Error) => void;
  timeout: number;
};

type ApiWorkerRequest = Omit<WorkerApiRequestMessage, "type" | "requestId">;

let workerInstance: Worker | null = null;
let requestCounter = 1;
const pending = new Map<number, PendingRequest>();

function isBusDisabledByFlag(): boolean {
  try {
    return localStorage.getItem("donegeon.disable_worker_bus") === "1";
  } catch {
    return false;
  }
}

function canUseWorkerBus(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && !isBusDisabledByFlag();
}

function rejectPending(error: Error) {
  for (const [requestId, entry] of pending.entries()) {
    window.clearTimeout(entry.timeout);
    entry.reject(error);
    pending.delete(requestId);
  }
}

function handleWorkerMessage(event: MessageEvent<UiActionBusWorkerOutbound>) {
  const message = event.data;
  if (!message) return;

  if (message.type === "bus.log") {
    if (message.level === "warn") {
      console.warn("[ui-action-bus]", message.message);
    }
    return;
  }

  if (message.type !== "api.response") return;

  const entry = pending.get(message.requestId);
  if (!entry) {
    return;
  }

  window.clearTimeout(entry.timeout);
  pending.delete(message.requestId);
  entry.resolve(message);
}

function ensureWorker(): Worker {
  if (!canUseWorkerBus()) {
    throw new UiActionBusUnavailableError();
  }

  if (workerInstance) {
    return workerInstance;
  }

  const worker = new Worker(new URL("../workers/uiActionBus.worker.ts", import.meta.url), {
    type: "module",
    name: "donegeon-ui-action-bus",
  });
  worker.onmessage = handleWorkerMessage;
  worker.onerror = (event) => {
    const message = event.message || "UI action bus worker crashed";
    rejectPending(new UiActionBusUnavailableError(message));
  };

  workerInstance = worker;
  return worker;
}

export function isUiActionBusEnabled(): boolean {
  return canUseWorkerBus();
}

export async function dispatchApiWorkerRequest(request: ApiWorkerRequest): Promise<WorkerApiResponseMessage> {
  const worker = ensureWorker();
  const requestId = requestCounter++;

  return new Promise<WorkerApiResponseMessage>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(requestId);
      reject(new UiActionBusUnavailableError("UI action bus request timed out"));
    }, 45_000);

    pending.set(requestId, { resolve, reject, timeout });

    const payload: WorkerApiRequestMessage = {
      type: "api.request",
      requestId,
      ...request,
    };
    worker.postMessage(payload);
  });
}
