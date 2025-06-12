/// <reference types="sst" />
import * as cloudflare from "@cloudflare/workers-types";

declare module "sst" {
  export interface Resource {
    DonegeonDB: cloudflare.D1Database;
  }
}
