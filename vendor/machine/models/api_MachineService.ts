/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { api_MachineCheck } from "./api_MachineCheck.ts"
import type { api_MachinePort } from "./api_MachinePort.ts"
import type { api_MachineServiceConcurrency } from "./api_MachineServiceConcurrency.ts"
export type api_MachineService = {
  autostart?: boolean;
  autostop?: boolean;
  checks?: Array<api_MachineCheck>;
  concurrency?: api_MachineServiceConcurrency;
  force_instance_description?: string;
  force_instance_key?: string;
  internal_port?: number;
  min_machines_running?: number;
  ports?: Array<api_MachinePort>;
  protocol?: string;
};
