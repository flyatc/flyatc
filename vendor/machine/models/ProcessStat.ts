/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ListenSocket } from "./ListenSocket.ts"
export type ProcessStat = {
  command?: string;
  cpu?: number;
  directory?: string;
  listen_sockets?: Array<ListenSocket>;
  pid?: number;
  rss?: number;
  rtime?: number;
  stime?: number;
};
