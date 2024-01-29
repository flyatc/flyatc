/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { api_MachineConfig } from "./api_MachineConfig.ts"
import type { CheckStatus } from "./CheckStatus.ts"
import type { ImageRef } from "./ImageRef.ts"
import type { MachineEvent } from "./MachineEvent.ts"
export type Machine = {
  checks?: Array<CheckStatus>;
  config?: api_MachineConfig;
  created_at?: string;
  events?: Array<MachineEvent>;
  id?: string;
  image_ref?: ImageRef;
  /**
   * InstanceID is unique for each version of the machine
   */
  instance_id?: string;
  name?: string;
  /**
   * Nonce is only every returned on machine creation if a lease_duration was provided.
   */
  nonce?: string;
  /**
   * PrivateIP is the internal 6PN address of the machine.
   */
  private_ip?: string;
  region?: string;
  state?: string;
  updated_at?: string;
};
