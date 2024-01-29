/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { api_MachineConfig } from "./api_MachineConfig.ts"
export type CreateMachineRequest = {
  /**
   * An object defining the Machine configuration
   */
  config?: api_MachineConfig;
  lease_ttl?: number;
  lsvd?: boolean;
  /**
   * Unique name for this Machine. If omitted, one is generated for you
   */
  name?: string;
  /**
   * The target region. Omitting this param launches in the same region as your WireGuard peer connection (somewhere near you).
   */
  region?: string;
  skip_launch?: boolean;
  skip_service_registration?: boolean;
};
