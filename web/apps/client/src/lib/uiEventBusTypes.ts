export type WorkerApiRequestMessage = {
  type: "api.request";
  requestId: number;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

export type WorkerApiResponseMessage = {
  type: "api.response";
  requestId: number;
  ok: boolean;
  status: number;
  body?: unknown;
  errorMessage?: string;
};

export type WorkerLogMessage = {
  type: "bus.log";
  level: "debug" | "warn";
  message: string;
};

export type UiActionBusWorkerInbound = WorkerApiRequestMessage;

export type UiActionBusWorkerOutbound = WorkerApiResponseMessage | WorkerLogMessage;
