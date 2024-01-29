/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { api_MachineGuest } from "./api_MachineGuest.ts"
export type CreateVolumeRequest = {
  compute?: api_MachineGuest;
  encrypted?: boolean;
  fstype?: string;
  machines_only?: boolean;
  name?: string;
  region?: string;
  require_unique_zone?: boolean;
  size_gb?: number;
  /**
   * restore from snapshot
   */
  snapshot_id?: string;
  snapshot_retention?: number;
  /**
   * fork from remote volume
   */
  source_volume_id?: string;
};
