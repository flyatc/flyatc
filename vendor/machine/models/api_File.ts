/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A file that will be written to the Machine. One of RawValue or SecretName must be set.
 */
export type api_File = {
  /**
   * GuestPath is the path on the machine where the file will be written and must be an absolute path.
   * For example: /full/path/to/file.json
   */
  guest_path?: string;
  /**
   * The base64 encoded string of the file contents.
   */
  raw_value?: string;
  /**
   * The name of the secret that contains the base64 encoded file contents.
   */
  secret_name?: string;
};
