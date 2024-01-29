/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * For http checks, an array of objects with string field Name and array of strings field Values. The key/value pairs specify header and header values that will get passed with the check call.
 */
export type api_MachineHTTPHeader = {
  /**
   * The header name
   */
  name?: string;
  /**
   * The header value
   */
  values?: Array<string>;
};
