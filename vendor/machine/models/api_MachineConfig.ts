/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { api_DNSConfig } from "./api_DNSConfig.ts"
import type { api_File } from "./api_File.ts"
import type { api_MachineCheck } from "./api_MachineCheck.ts"
import type { api_MachineGuest } from "./api_MachineGuest.ts"
import type { api_MachineInit } from "./api_MachineInit.ts"
import type { api_MachineMetrics } from "./api_MachineMetrics.ts"
import type { api_MachineMount } from "./api_MachineMount.ts"
import type { api_MachineProcess } from "./api_MachineProcess.ts"
import type { api_MachineRestart } from "./api_MachineRestart.ts"
import type { api_MachineService } from "./api_MachineService.ts"
import type { api_Static } from "./api_Static.ts"
import type { api_StopConfig } from "./api_StopConfig.ts"
export type api_MachineConfig = {
  /**
   * Optional boolean telling the Machine to destroy itself once it’s complete (default false)
   */
  auto_destroy?: boolean;
  checks?: Record<string, api_MachineCheck>;
  /**
   * Deprecated: use Service.Autostart instead
   */
  disable_machine_autostart?: boolean;
  dns?: api_DNSConfig;
  /**
   * An object filled with key/value pairs to be set as environment variables
   */
  env?: Record<string, string>;
  files?: Array<api_File>;
  guest?: api_MachineGuest;
  /**
   * The docker image to run
   */
  image?: string;
  init?: api_MachineInit;
  metadata?: Record<string, string>;
  metrics?: api_MachineMetrics;
  mounts?: Array<api_MachineMount>;
  processes?: Array<api_MachineProcess>;
  restart?: api_MachineRestart;
  schedule?: string;
  services?: Array<api_MachineService>;
  /**
   * Deprecated: use Guest instead
   */
  size?: string;
  /**
   * Standbys enable a machine to be a standby for another. In the event of a hardware failure,
   * the standby machine will be started.
   */
  standbys?: Array<string>;
  statics?: Array<api_Static>;
  stop_config?: api_StopConfig;
};
