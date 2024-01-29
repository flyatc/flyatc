/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { api_HTTPOptions } from "./api_HTTPOptions.ts"
import type { api_ProxyProtoOptions } from "./api_ProxyProtoOptions.ts"
import type { api_TLSOptions } from "./api_TLSOptions.ts"
export type api_MachinePort = {
  end_port?: number;
  force_https?: boolean;
  handlers?: Array<string>;
  http_options?: api_HTTPOptions;
  port?: number;
  proxy_proto_options?: api_ProxyProtoOptions;
  start_port?: number;
  tls_options?: api_TLSOptions;
};
