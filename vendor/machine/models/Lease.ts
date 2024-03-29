/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Lease = {
  /**
   * Description or reason for the Lease.
   */
  description?: string;
  /**
   * ExpiresAt is the unix timestamp in UTC to denote when the Lease will no longer be valid.
   */
  expires_at?: number;
  /**
   * Nonce is the unique ID autogenerated and associated with the Lease.
   */
  nonce?: string;
  /**
   * Owner is the user identifier which acquired the Lease.
   */
  owner?: string;
  /**
   * Machine version
   */
  version?: string;
};
