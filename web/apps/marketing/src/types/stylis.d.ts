declare module "stylis" {
  export type Middleware = (
    element: unknown,
    index: number,
    children: unknown[],
    callback: Middleware,
  ) => string | void;
}
