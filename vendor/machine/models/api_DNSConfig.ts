/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { api_dnsOption } from "./api_dnsOption.ts"
export type api_DNSConfig = {
  nameservers?: Array<string>;
  options?: Array<api_dnsOption>;
  searches?: Array<string>;
  skip_registration?: boolean;
};
