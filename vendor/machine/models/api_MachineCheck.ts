/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { api_MachineHTTPHeader } from "./api_MachineHTTPHeader.ts"
/**
 * An optional object that defines one or more named checks. The key for each check is the check name.
 */
export type api_MachineCheck = {
  /**
   * The time to wait after a VM starts before checking its health
   */
  grace_period?: string;
  headers?: Array<api_MachineHTTPHeader>;
  /**
   * The time between connectivity checks
   */
  interval?: string;
  /**
   * For http checks, the HTTP method to use to when making the request
   */
  method?: string;
  /**
   * For http checks, the path to send the request to
   */
  path?: string;
  /**
   * The port to connect to, often the same as internal_port
   */
  port?: number;
  /**
   * For http checks, whether to use http or https
   */
  protocol?: string;
  /**
   * The maximum time a connection can take before being reported as failing its health check
   */
  timeout?: string;
  /**
   * If the protocol is https, the hostname to use for TLS certificate validation
   */
  tls_server_name?: string;
  /**
   * For http checks with https protocol, whether or not to verify the TLS certificate
   */
  tls_skip_verify?: boolean;
  /**
   * tcp or http
   */
  type?: string;
};
