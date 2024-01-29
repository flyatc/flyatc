/**
 * Eta Helpers
 */

import { createId } from "cuid";
import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from "unique-names-generator";

// env
export const requiredEnv = (envVar: string) => {
  if (!Deno.env.has(envVar)) {
    throw new Error(`Missing env ${envVar}.`);
  }
  return Deno.env.get(envVar);
};
export const requiredEnvKv = (envVar: string) =>
  `${env}: ${requiredEnv(envVar)}`;

export const env = (envVar: string, fallback?: string) =>
  Deno.env.get(envVar) ?? fallback;
export const envKv = (envVar: string, fallback?: string) =>
  `${envVar}: ${env(envVar, fallback)}`;

// string
export const cuid = () => createId();
export const uuid = () => crypto.randomUUID();
export const randomStr = (length = 8) => {
  if (length % 2 == 1) {
    throw new Deno.errors.InvalidData(
      "Only even sizes are supported for randomStr"
    );
  }
  const buf = new Uint8Array(length / 2);
  crypto.getRandomValues(buf);
  let ret = "";
  for (let i = 0; i < buf.length; ++i) {
    ret += ("0" + buf[i].toString(16)).slice(-2);
  }
  return ret;
};
export const randomSlug = (separator = "-") =>
  uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator,
    length: 2,
  });
export const nowUnix = () => Date.now();
export const nowIso = () => new Date().toISOString();

// obj
export const match = (value: string, obj: Record<string, any>) => obj[value];

// logic
export const iif = (bool: boolean, truthy: any, falsy: any) =>
  bool ? truthy : falsy;
