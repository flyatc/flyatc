/* eslint-disable */

import { AllTypesProps, Ops, ReturnTypes } from "./const.ts";
export const HOST = "https://api.fly.io/graphql";

export const HEADERS = {};
export const apiSubscription = (options: chainOptions) => (query: string) => {
  try {
    const queryString = options[0] + "?query=" + encodeURIComponent(query);
    const wsString = queryString.replace("http", "ws");
    const host = (options.length > 1 && options[1]?.websocket?.[0]) || wsString;
    const webSocketOptions = options[1]?.websocket || [host];
    const ws = new WebSocket(...webSocketOptions);
    return {
      ws,
      on: (e: (args: any) => void) => {
        ws.onmessage = (event: any) => {
          if (event.data) {
            const parsed = JSON.parse(event.data);
            const data = parsed.data;
            return e(data);
          }
        };
      },
      off: (e: (args: any) => void) => {
        ws.onclose = e;
      },
      error: (e: (args: any) => void) => {
        ws.onerror = e;
      },
      open: (e: () => void) => {
        ws.onopen = e;
      },
    };
  } catch {
    throw new Error("No websockets implemented");
  }
};
const handleFetchResponse = (response: Response): Promise<GraphQLResponse> => {
  if (!response.ok) {
    return new Promise((_, reject) => {
      response
        .text()
        .then((text) => {
          try {
            reject(JSON.parse(text));
          } catch (err) {
            reject(text);
          }
        })
        .catch(reject);
    });
  }
  return response.json() as Promise<GraphQLResponse>;
};

export const apiFetch =
  (options: fetchOptions) =>
  (query: string, variables: Record<string, unknown> = {}) => {
    const fetchOptions = options[1] || {};
    if (fetchOptions.method && fetchOptions.method === "GET") {
      return fetch(
        `${options[0]}?query=${encodeURIComponent(query)}`,
        fetchOptions,
      )
        .then(handleFetchResponse)
        .then((response: GraphQLResponse) => {
          if (response.errors) {
            throw new GraphQLError(response);
          }
          return response.data;
        });
    }
    return fetch(`${options[0]}`, {
      body: JSON.stringify({ query, variables }),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      ...fetchOptions,
    })
      .then(handleFetchResponse)
      .then((response: GraphQLResponse) => {
        if (response.errors) {
          throw new GraphQLError(response);
        }
        return response.data;
      });
  };

export const InternalsBuildQuery = ({
  ops,
  props,
  returns,
  options,
  scalars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  options?: OperationOptions;
  scalars?: ScalarDefinition;
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p = "",
    root = true,
    vars: Array<{ name: string; graphQLType: string }> = [],
  ): string => {
    const keyForPath = purifyGraphQLKey(k);
    const newPath = [p, keyForPath].join(SEPARATOR);
    if (!o) {
      return "";
    }
    if (typeof o === "boolean" || typeof o === "number") {
      return k;
    }
    if (typeof o === "string") {
      return `${k} ${o}`;
    }
    if (Array.isArray(o)) {
      const args = InternalArgsBuilt({
        props,
        returns,
        ops,
        scalars,
        vars,
      })(o[0], newPath);
      return `${ibb(args ? `${k}(${args})` : k, o[1], p, false, vars)}`;
    }
    if (k === "__alias") {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (
            typeof objectUnderAlias !== "object" ||
            Array.isArray(objectUnderAlias)
          ) {
            throw new Error(
              "Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}",
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(`${alias}:${operationName}`, operation, p, false, vars);
        })
        .join("\n");
    }
    const hasOperationName = root && options?.operationName
      ? " " + options.operationName
      : "";
    const keyForDirectives = o.__directives ?? "";
    const query = `{${
      Object.entries(o)
        .filter(([k]) => k !== "__directives")
        .map((e) =>
          ibb(...e, [p, `field<>${keyForPath}`].join(SEPARATOR), false, vars)
        )
        .join("\n")
    }}`;
    if (!root) {
      return `${k} ${keyForDirectives}${hasOperationName} ${query}`;
    }
    const varsString = vars.map((v) => `${v.name}: ${v.graphQLType}`).join(
      ", ",
    );
    return `${k} ${keyForDirectives}${hasOperationName}${
      varsString ? `(${varsString})` : ""
    } ${query}`;
  };
  return ibb;
};

export const Thunder = (fn: FetchFunction) =>
<
  O extends keyof typeof Ops,
  SCLR extends ScalarDefinition,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  graphqlOptions?: ThunderGraphQLOptions<SCLR>,
) =>
<Z extends ValueTypes[R]>(
  o: (Z & ValueTypes[R]) | ValueTypes[R],
  ops?: OperationOptions & { variables?: Record<string, unknown> },
) =>
  fn(
    Zeus(operation, o, {
      operationOptions: ops,
      scalars: graphqlOptions?.scalars,
    }),
    ops?.variables,
  ).then((data) => {
    if (graphqlOptions?.scalars) {
      return decodeScalarsInResponse({
        response: data,
        initialOp: operation,
        initialZeusQuery: o as VType,
        returns: ReturnTypes,
        scalars: graphqlOptions.scalars,
        ops: Ops,
      });
    }
    return data;
  }) as Promise<InputType<GraphQLTypes[R], Z, SCLR>>;

export const Chain = (...options: chainOptions) => Thunder(apiFetch(options));

export const SubscriptionThunder = (fn: SubscriptionFunction) =>
<
  O extends keyof typeof Ops,
  SCLR extends ScalarDefinition,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  graphqlOptions?: ThunderGraphQLOptions<SCLR>,
) =>
<Z extends ValueTypes[R]>(
  o: (Z & ValueTypes[R]) | ValueTypes[R],
  ops?: OperationOptions & { variables?: ExtractVariables<Z> },
) => {
  const returnedFunction = fn(
    Zeus(operation, o, {
      operationOptions: ops,
      scalars: graphqlOptions?.scalars,
    }),
  ) as SubscriptionToGraphQL<Z, GraphQLTypes[R], SCLR>;
  if (returnedFunction?.on && graphqlOptions?.scalars) {
    const wrapped = returnedFunction.on;
    returnedFunction.on = (
      fnToCall: (args: InputType<GraphQLTypes[R], Z, SCLR>) => void,
    ) =>
      wrapped((data: InputType<GraphQLTypes[R], Z, SCLR>) => {
        if (graphqlOptions?.scalars) {
          return fnToCall(
            decodeScalarsInResponse({
              response: data,
              initialOp: operation,
              initialZeusQuery: o as VType,
              returns: ReturnTypes,
              scalars: graphqlOptions.scalars,
              ops: Ops,
            }),
          );
        }
        return fnToCall(data);
      });
  }
  return returnedFunction;
};

export const Subscription = (...options: chainOptions) =>
  SubscriptionThunder(apiSubscription(options));
export const Zeus = <
  Z extends ValueTypes[R],
  O extends keyof typeof Ops,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  o: (Z & ValueTypes[R]) | ValueTypes[R],
  ops?: {
    operationOptions?: OperationOptions;
    scalars?: ScalarDefinition;
  },
) =>
  InternalsBuildQuery({
    props: AllTypesProps,
    returns: ReturnTypes,
    ops: Ops,
    options: ops?.operationOptions,
    scalars: ops?.scalars,
  })(operation, o as VType);

export const ZeusSelect = <T>() => ((t: unknown) => t) as SelectionFunction<T>;

export const Selector = <T extends keyof ValueTypes>(key: T) =>
  key && ZeusSelect<ValueTypes[T]>();

export const TypeFromSelector = <T extends keyof ValueTypes>(key: T) =>
  key && ZeusSelect<ValueTypes[T]>();
export const Gql = Chain(HOST, {
  headers: {
    "Content-Type": "application/json",
    ...HEADERS,
  },
});

export const ZeusScalars = ZeusSelect<ScalarCoders>();

export const decodeScalarsInResponse = <O extends Operations>({
  response,
  scalars,
  returns,
  ops,
  initialZeusQuery,
  initialOp,
}: {
  ops: O;
  response: any;
  returns: ReturnTypesType;
  scalars?: Record<string, ScalarResolver | undefined>;
  initialOp: keyof O;
  initialZeusQuery: InputValueType | VType;
}) => {
  if (!scalars) {
    return response;
  }
  const builder = PrepareScalarPaths({
    ops,
    returns,
  });

  const scalarPaths = builder(
    initialOp as string,
    ops[initialOp],
    initialZeusQuery,
  );
  if (scalarPaths) {
    const r = traverseResponse({ scalarPaths, resolvers: scalars })(
      initialOp as string,
      response,
      [ops[initialOp]],
    );
    return r;
  }
  return response;
};

export const traverseResponse = ({
  resolvers,
  scalarPaths,
}: {
  scalarPaths: { [x: string]: `scalar.${string}` };
  resolvers: {
    [x: string]: ScalarResolver | undefined;
  };
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p: string[] = [],
  ): unknown => {
    if (Array.isArray(o)) {
      return o.map((eachO) => ibb(k, eachO, p));
    }
    if (o == null) {
      return o;
    }
    const scalarPathString = p.join(SEPARATOR);
    const currentScalarString = scalarPaths[scalarPathString];
    if (currentScalarString) {
      const currentDecoder = resolvers[currentScalarString.split(".")[1]]
        ?.decode;
      if (currentDecoder) {
        return currentDecoder(o);
      }
    }
    if (
      typeof o === "boolean" || typeof o === "number" ||
      typeof o === "string" || !o
    ) {
      return o;
    }
    const entries = Object.entries(o).map(([k, v]) =>
      [k, ibb(k, v, [...p, purifyGraphQLKey(k)])] as const
    );
    const objectFromEntries = entries.reduce<Record<string, unknown>>(
      (a, [k, v]) => {
        a[k] = v;
        return a;
      },
      {},
    );
    return objectFromEntries;
  };
  return ibb;
};

export type AllTypesPropsType = {
  [x: string]:
    | undefined
    | `scalar.${string}`
    | "enum"
    | {
      [x: string]:
        | undefined
        | string
        | {
          [x: string]: string | undefined;
        };
    };
};

export type ReturnTypesType = {
  [x: string]:
    | {
      [x: string]: string | undefined;
    }
    | `scalar.${string}`
    | undefined;
};
export type InputValueType = {
  [x: string]: undefined | boolean | string | number | [
    any,
    undefined | boolean | InputValueType,
  ] | InputValueType;
};
export type VType =
  | undefined
  | boolean
  | string
  | number
  | [any, undefined | boolean | InputValueType]
  | InputValueType;

export type PlainType = boolean | number | string | null | undefined;
export type ZeusArgsType =
  | PlainType
  | {
    [x: string]: ZeusArgsType;
  }
  | Array<ZeusArgsType>;

export type Operations = Record<string, string>;

export type VariableDefinition = {
  [x: string]: unknown;
};

export const SEPARATOR = "|";

export type fetchOptions = Parameters<typeof fetch>;
type websocketOptions = typeof WebSocket extends
  new (...args: infer R) => WebSocket ? R : never;
export type chainOptions = [
  fetchOptions[0],
  fetchOptions[1] & { websocket?: websocketOptions },
] | [fetchOptions[0]];
export type FetchFunction = (
  query: string,
  variables?: Record<string, unknown>,
) => Promise<any>;
export type SubscriptionFunction = (query: string) => any;
type NotUndefined<T> = T extends undefined ? never : T;
export type ResolverType<F> = NotUndefined<
  F extends [infer ARGS, any] ? ARGS : undefined
>;

export type OperationOptions = {
  operationName?: string;
};

export type ScalarCoder = Record<string, (s: unknown) => string>;

export interface GraphQLResponse {
  data?: Record<string, any>;
  errors?: Array<{
    message: string;
  }>;
}
export class GraphQLError extends Error {
  constructor(public response: GraphQLResponse) {
    super("");
    console.error(response);
  }
  toString() {
    return "GraphQL Response Error";
  }
}
export type GenericOperation<O> = O extends keyof typeof Ops ? typeof Ops[O]
  : never;
export type ThunderGraphQLOptions<SCLR extends ScalarDefinition> = {
  scalars?: SCLR | ScalarCoders;
};

const ExtractScalar = (
  mappedParts: string[],
  returns: ReturnTypesType,
): `scalar.${string}` | undefined => {
  if (mappedParts.length === 0) {
    return;
  }
  const oKey = mappedParts[0];
  const returnP1 = returns[oKey];
  if (typeof returnP1 === "object") {
    const returnP2 = returnP1[mappedParts[1]];
    if (returnP2) {
      return ExtractScalar([returnP2, ...mappedParts.slice(2)], returns);
    }
    return undefined;
  }
  return returnP1 as `scalar.${string}` | undefined;
};

export const PrepareScalarPaths = (
  { ops, returns }: { returns: ReturnTypesType; ops: Operations },
) => {
  const ibb = (
    k: string,
    originalKey: string,
    o: InputValueType | VType,
    p: string[] = [],
    pOriginals: string[] = [],
    root = true,
  ): { [x: string]: `scalar.${string}` } | undefined => {
    if (!o) {
      return;
    }
    if (
      typeof o === "boolean" || typeof o === "number" || typeof o === "string"
    ) {
      const extractionArray = [...pOriginals, originalKey];
      const isScalar = ExtractScalar(extractionArray, returns);
      if (isScalar?.startsWith("scalar")) {
        const partOfTree = {
          [[...p, k].join(SEPARATOR)]: isScalar,
        };
        return partOfTree;
      }
      return {};
    }
    if (Array.isArray(o)) {
      return ibb(k, k, o[1], p, pOriginals, false);
    }
    if (k === "__alias") {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (
            typeof objectUnderAlias !== "object" ||
            Array.isArray(objectUnderAlias)
          ) {
            throw new Error(
              "Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}",
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(alias, operationName, operation, p, pOriginals, false);
        })
        .reduce((a, b) => ({
          ...a,
          ...b,
        }));
    }
    const keyName = root ? ops[k] : k;
    return Object.entries(o)
      .filter(([k]) => k !== "__directives")
      .map(([k, v]) => {
        // Inline fragments shouldn't be added to the path as they aren't a field
        const isInlineFragment = originalKey.match(/^...\s*on/) != null;
        return ibb(
          k,
          k,
          v,
          isInlineFragment ? p : [...p, purifyGraphQLKey(keyName || k)],
          isInlineFragment
            ? pOriginals
            : [...pOriginals, purifyGraphQLKey(originalKey)],
          false,
        );
      })
      .reduce((a, b) => ({
        ...a,
        ...b,
      }));
  };
  return ibb;
};

export const purifyGraphQLKey = (k: string) =>
  k.replace(/\([^)]*\)/g, "").replace(/^[^:]*\:/g, "");

const mapPart = (p: string) => {
  const [isArg, isField] = p.split("<>");
  if (isField) {
    return {
      v: isField,
      __type: "field",
    } as const;
  }
  return {
    v: isArg,
    __type: "arg",
  } as const;
};

type Part = ReturnType<typeof mapPart>;

export const ResolveFromPath = (
  props: AllTypesPropsType,
  returns: ReturnTypesType,
  ops: Operations,
) => {
  const ResolvePropsType = (mappedParts: Part[]) => {
    const oKey = ops[mappedParts[0].v];
    const propsP1 = oKey ? props[oKey] : props[mappedParts[0].v];
    if (propsP1 === "enum" && mappedParts.length === 1) {
      return "enum";
    }
    if (
      typeof propsP1 === "string" && propsP1.startsWith("scalar.") &&
      mappedParts.length === 1
    ) {
      return propsP1;
    }
    if (typeof propsP1 === "object") {
      if (mappedParts.length < 2) {
        return "not";
      }
      const propsP2 = propsP1[mappedParts[1].v];
      if (typeof propsP2 === "string") {
        return rpp(
          `${propsP2}${SEPARATOR}${
            mappedParts
              .slice(2)
              .map((mp) => mp.v)
              .join(SEPARATOR)
          }`,
        );
      }
      if (typeof propsP2 === "object") {
        if (mappedParts.length < 3) {
          return "not";
        }
        const propsP3 = propsP2[mappedParts[2].v];
        if (propsP3 && mappedParts[2].__type === "arg") {
          return rpp(
            `${propsP3}${SEPARATOR}${
              mappedParts
                .slice(3)
                .map((mp) => mp.v)
                .join(SEPARATOR)
            }`,
          );
        }
      }
    }
  };
  const ResolveReturnType = (mappedParts: Part[]) => {
    if (mappedParts.length === 0) {
      return "not";
    }
    const oKey = ops[mappedParts[0].v];
    const returnP1 = oKey ? returns[oKey] : returns[mappedParts[0].v];
    if (typeof returnP1 === "object") {
      if (mappedParts.length < 2) return "not";
      const returnP2 = returnP1[mappedParts[1].v];
      if (returnP2) {
        return rpp(
          `${returnP2}${SEPARATOR}${
            mappedParts
              .slice(2)
              .map((mp) => mp.v)
              .join(SEPARATOR)
          }`,
        );
      }
    }
  };
  const rpp = (path: string): "enum" | "not" | `scalar.${string}` => {
    const parts = path.split(SEPARATOR).filter((l) => l.length > 0);
    const mappedParts = parts.map(mapPart);
    const propsP1 = ResolvePropsType(mappedParts);
    if (propsP1) {
      return propsP1;
    }
    const returnP1 = ResolveReturnType(mappedParts);
    if (returnP1) {
      return returnP1;
    }
    return "not";
  };
  return rpp;
};

export const InternalArgsBuilt = ({
  props,
  ops,
  returns,
  scalars,
  vars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  scalars?: ScalarDefinition;
  vars: Array<{ name: string; graphQLType: string }>;
}) => {
  const arb = (a: ZeusArgsType, p = "", root = true): string => {
    if (typeof a === "string") {
      if (a.startsWith(START_VAR_NAME)) {
        const [varName, graphQLType] = a.replace(START_VAR_NAME, "$").split(
          GRAPHQL_TYPE_SEPARATOR,
        );
        const v = vars.find((v) => v.name === varName);
        if (!v) {
          vars.push({
            name: varName,
            graphQLType,
          });
        } else {
          if (v.graphQLType !== graphQLType) {
            throw new Error(
              `Invalid variable exists with two different GraphQL Types, "${v.graphQLType}" and ${graphQLType}`,
            );
          }
        }
        return varName;
      }
    }
    const checkType = ResolveFromPath(props, returns, ops)(p);
    if (checkType.startsWith("scalar.")) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, ...splittedScalar] = checkType.split(".");
      const scalarKey = splittedScalar.join(".");
      return (scalars?.[scalarKey]?.encode?.(a) as string) || JSON.stringify(a);
    }
    if (Array.isArray(a)) {
      return `[${a.map((arr) => arb(arr, p, false)).join(", ")}]`;
    }
    if (typeof a === "string") {
      if (checkType === "enum") {
        return a;
      }
      return `${JSON.stringify(a)}`;
    }
    if (typeof a === "object") {
      if (a === null) {
        return `null`;
      }
      const returnedObjectString = Object.entries(a)
        .filter(([, v]) => typeof v !== "undefined")
        .map(([k, v]) => `${k}: ${arb(v, [p, k].join(SEPARATOR), false)}`)
        .join(",\n");
      if (!root) {
        return `{${returnedObjectString}}`;
      }
      return returnedObjectString;
    }
    return `${a}`;
  };
  return arb;
};

export const resolverFor = <
  X,
  T extends keyof ResolverInputTypes,
  Z extends keyof ResolverInputTypes[T],
>(
  type: T,
  field: Z,
  fn: (
    args: Required<ResolverInputTypes[T]>[Z] extends [infer Input, any] ? Input
      : any,
    source: any,
  ) => Z extends keyof ModelTypes[T]
    ? ModelTypes[T][Z] | Promise<ModelTypes[T][Z]> | X
    : never,
) => fn as (args?: any, source?: any) => ReturnType<typeof fn>;

export type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
export type ZeusState<T extends (...args: any[]) => Promise<any>> = NonNullable<
  UnwrapPromise<ReturnType<T>>
>;
export type ZeusHook<
  T extends (
    ...args: any[]
  ) => Record<string, (...args: any[]) => Promise<any>>,
  N extends keyof ReturnType<T>,
> = ZeusState<ReturnType<T>[N]>;

export type WithTypeNameValue<T> = T & {
  __typename?: boolean;
  __directives?: string;
};
export type AliasType<T> = WithTypeNameValue<T> & {
  __alias?: Record<string, WithTypeNameValue<T>>;
};
type DeepAnify<T> = {
  [P in keyof T]?: any;
};
type IsPayLoad<T> = T extends [any, infer PayLoad] ? PayLoad : T;
export type ScalarDefinition = Record<string, ScalarResolver>;

type IsScalar<S, SCLR extends ScalarDefinition> = S extends
  "scalar" & { name: infer T }
  ? T extends keyof SCLR
    ? SCLR[T]["decode"] extends (s: unknown) => unknown
      ? ReturnType<SCLR[T]["decode"]>
    : unknown
  : unknown
  : S;
type IsArray<T, U, SCLR extends ScalarDefinition> = T extends Array<infer R>
  ? InputType<R, U, SCLR>[]
  : InputType<T, U, SCLR>;
type FlattenArray<T> = T extends Array<infer R> ? R : T;
type BaseZeusResolver = boolean | 1 | string | Variable<any, string>;

type IsInterfaced<
  SRC extends DeepAnify<DST>,
  DST,
  SCLR extends ScalarDefinition,
> = FlattenArray<SRC> extends
  | ZEUS_INTERFACES
  | ZEUS_UNIONS ?
    & {
      [P in keyof SRC]: SRC[P] extends "__union" & infer R
        ? P extends keyof DST ? IsArray<
            R,
            "__typename" extends keyof DST ? DST[P] & { __typename: true }
              : DST[P],
            SCLR
          >
        : IsArray<
          R,
          "__typename" extends keyof DST ? { __typename: true }
            : Record<string, never>,
          SCLR
        >
        : never;
    }[keyof SRC]
    & {
      [
        P in keyof Omit<
          Pick<
            SRC,
            {
              [P in keyof DST]: SRC[P] extends "__union" & infer R ? never : P;
            }[keyof DST]
          >,
          "__typename"
        >
      ]: IsPayLoad<DST[P]> extends BaseZeusResolver ? IsScalar<SRC[P], SCLR>
        : IsArray<SRC[P], DST[P], SCLR>;
    }
  : {
    [P in keyof Pick<SRC, keyof DST>]: IsPayLoad<DST[P]> extends
      BaseZeusResolver ? IsScalar<SRC[P], SCLR>
      : IsArray<SRC[P], DST[P], SCLR>;
  };

export type MapType<SRC, DST, SCLR extends ScalarDefinition> = SRC extends
  DeepAnify<DST> ? IsInterfaced<SRC, DST, SCLR>
  : never;
// eslint-disable-next-line @typescript-eslint/ban-types
export type InputType<SRC, DST, SCLR extends ScalarDefinition = {}> =
  IsPayLoad<DST> extends { __alias: infer R } ?
      & {
        [P in keyof R]: MapType<
          SRC,
          R[P],
          SCLR
        >[keyof MapType<SRC, R[P], SCLR>];
      }
      & MapType<SRC, Omit<IsPayLoad<DST>, "__alias">, SCLR>
    : MapType<SRC, IsPayLoad<DST>, SCLR>;
export type SubscriptionToGraphQL<Z, T, SCLR extends ScalarDefinition> = {
  ws: WebSocket;
  on: (fn: (args: InputType<T, Z, SCLR>) => void) => void;
  off: (
    fn: (
      e: {
        data?: InputType<T, Z, SCLR>;
        code?: number;
        reason?: string;
        message?: string;
      },
    ) => void,
  ) => void;
  error: (
    fn: (e: { data?: InputType<T, Z, SCLR>; errors?: string[] }) => void,
  ) => void;
  open: () => void;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type FromSelector<
  SELECTOR,
  NAME extends keyof GraphQLTypes,
  SCLR extends ScalarDefinition = {},
> = InputType<
  GraphQLTypes[NAME],
  SELECTOR,
  SCLR
>;

export type ScalarResolver = {
  encode?: (s: unknown) => string;
  decode?: (s: unknown) => unknown;
};

export type SelectionFunction<V> = <T>(t: T | V) => T;

type BuiltInVariableTypes = {
  ["String"]: string;
  ["Int"]: number;
  ["Float"]: number;
  ["ID"]: unknown;
  ["Boolean"]: boolean;
};
type AllVariableTypes = keyof BuiltInVariableTypes | keyof ZEUS_VARIABLES;
type VariableRequired<T extends string> =
  | `${T}!`
  | T
  | `[${T}]`
  | `[${T}]!`
  | `[${T}!]`
  | `[${T}!]!`;
type VR<T extends string> = VariableRequired<VariableRequired<T>>;

export type GraphQLVariableType = VR<AllVariableTypes>;

type ExtractVariableTypeString<T extends string> = T extends VR<infer R1>
  ? R1 extends VR<infer R2>
    ? R2 extends VR<infer R3>
      ? R3 extends VR<infer R4> ? R4 extends VR<infer R5> ? R5
        : R4
      : R3
    : R2
  : R1
  : T;

type DecomposeType<T, Type> = T extends `[${infer R}]`
  ? Array<DecomposeType<R, Type>> | undefined
  : T extends `${infer R}!` ? NonNullable<DecomposeType<R, Type>>
  : Type | undefined;

type ExtractTypeFromGraphQLType<T extends string> = T extends
  keyof ZEUS_VARIABLES ? ZEUS_VARIABLES[T]
  : T extends keyof BuiltInVariableTypes ? BuiltInVariableTypes[T]
  : any;

export type GetVariableType<T extends string> = DecomposeType<
  T,
  ExtractTypeFromGraphQLType<ExtractVariableTypeString<T>>
>;

type UndefinedKeys<T> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];

type WithNullableKeys<T> = Pick<T, UndefinedKeys<T>>;
type WithNonNullableKeys<T> = Omit<T, UndefinedKeys<T>>;

type OptionalKeys<T> = {
  [P in keyof T]?: T[P];
};

export type WithOptionalNullables<T> =
  & OptionalKeys<WithNullableKeys<T>>
  & WithNonNullableKeys<T>;

export type Variable<T extends GraphQLVariableType, Name extends string> = {
  " __zeus_name": Name;
  " __zeus_type": T;
};

export type ExtractVariablesDeep<Query> = Query extends
  Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends string | number | boolean | Array<string | number | boolean>
  // eslint-disable-next-line @typescript-eslint/ban-types
    ? {}
  : UnionToIntersection<
    {
      [K in keyof Query]: WithOptionalNullables<ExtractVariablesDeep<Query[K]>>;
    }[keyof Query]
  >;

export type ExtractVariables<Query> = Query extends
  Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends [infer Inputs, infer Outputs]
    ? ExtractVariablesDeep<Inputs> & ExtractVariables<Outputs>
  : Query extends string | number | boolean | Array<string | number | boolean>
  // eslint-disable-next-line @typescript-eslint/ban-types
    ? {}
  : UnionToIntersection<
    {
      [K in keyof Query]: WithOptionalNullables<ExtractVariables<Query[K]>>;
    }[keyof Query]
  >;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends
  (k: infer I) => void ? I : never;

export const START_VAR_NAME = `$ZEUS_VAR`;
export const GRAPHQL_TYPE_SEPARATOR = `__$GRAPHQL__`;

export const $ = <Type extends GraphQLVariableType, Name extends string>(
  name: Name,
  graphqlType: Type,
) => {
  return (START_VAR_NAME + name + GRAPHQL_TYPE_SEPARATOR +
    graphqlType) as unknown as Variable<Type, Name>;
};
type ZEUS_INTERFACES =
  | GraphQLTypes["AppRole"]
  | GraphQLTypes["MachineEvent"]
  | GraphQLTypes["Node"]
  | GraphQLTypes["Principal"];
export type ScalarCoders = {
  BigInt?: ScalarResolver;
  CaveatSet?: ScalarResolver;
  ISO8601DateTime?: ScalarResolver;
  JSON?: ScalarResolver;
};
type ZEUS_UNIONS = GraphQLTypes["AppChangeActor"];

export type ValueTypes = {
  ["AccessToken"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for AccessToken. */
  ["AccessTokenConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["AccessTokenEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["AccessToken"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AccessTokenEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["AccessToken"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AccessTokenType"]: AccessTokenType;
  /** Autogenerated return type of AddCertificate. */
  ["AddCertificatePayload"]: AliasType<{
    app?: ValueTypes["App"];
    certificate?: ValueTypes["AppCertificate"];
    check?: ValueTypes["HostnameCheck"];
    errors?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["AddOn"]: AliasType<{
    /** The add-on plan */
    addOnPlan?: ValueTypes["AddOnPlan"];
    /** The display name for an add-on plan */
    addOnPlanName?: boolean | `@${string}`;
    /** The add-on provider */
    addOnProvider?: ValueTypes["AddOnProvider"];
    /** An app associated with this add-on */
    app?: ValueTypes["App"];
    apps?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["AppConnection"]];
    /** Environment variables for the add-on */
    environment?: boolean | `@${string}`;
    /** Optional error message when `status` is `error` */
    errorMessage?: boolean | `@${string}`;
    /** DNS hostname for the add-on */
    hostname?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** Add-on metadata */
    metadata?: boolean | `@${string}`;
    /** The service name according to the provider */
    name?: boolean | `@${string}`;
    /** Add-on options */
    options?: boolean | `@${string}`;
    /** Organization that owns this service */
    organization?: ValueTypes["Organization"];
    /** Password for the add-on */
    password?: boolean | `@${string}`;
    /** Region where the primary instance is deployed */
    primaryRegion?: boolean | `@${string}`;
    /** Private flycast IP address of the add-on */
    privateIp?: boolean | `@${string}`;
    /** Public URL for this service */
    publicUrl?: boolean | `@${string}`;
    /** Regions where replica instances are deployed */
    readRegions?: boolean | `@${string}`;
    /** Single sign-on link to the add-on dashboard */
    ssoLink?: boolean | `@${string}`;
    /** Redis database statistics */
    stats?: boolean | `@${string}`;
    /** Status of the add-on */
    status?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for AddOn. */
  ["AddOnConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["AddOnEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["AddOn"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AddOnEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["AddOn"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AddOnPlan"]: AliasType<{
    displayName?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    maxCommandsPerSec?: boolean | `@${string}`;
    maxConcurrentConnections?: boolean | `@${string}`;
    maxDailyBandwidth?: boolean | `@${string}`;
    maxDailyCommands?: boolean | `@${string}`;
    maxDataSize?: boolean | `@${string}`;
    maxRequestSize?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    pricePerMonth?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for AddOnPlan. */
  ["AddOnPlanConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["AddOnPlanEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["AddOnPlan"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AddOnPlanEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["AddOnPlan"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AddOnProvider"]: AliasType<{
    asyncProvisioning?: boolean | `@${string}`;
    autoProvision?: boolean | `@${string}`;
    beta?: boolean | `@${string}`;
    detectPlatform?: boolean | `@${string}`;
    displayName?: boolean | `@${string}`;
    excludedRegions?: ValueTypes["Region"];
    id?: boolean | `@${string}`;
    internal?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    nameSuffix?: boolean | `@${string}`;
    provisioningInstructions?: boolean | `@${string}`;
    regions?: ValueTypes["Region"];
    resourceName?: boolean | `@${string}`;
    selectName?: boolean | `@${string}`;
    selectRegion?: boolean | `@${string}`;
    selectReplicaRegions?: boolean | `@${string}`;
    tosAgreement?: boolean | `@${string}`;
    tosUrl?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["AddOnType"]: AddOnType;
  /** Autogenerated input type of AddWireGuardPeer */
  ["AddWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The region in which to deploy the peer */
    region?: string | undefined | null | Variable<any, string>;
    /** The name with which to refer to the peer */
    name: string | Variable<any, string>;
    /** The 25519 public key for the peer */
    pubkey: string | Variable<any, string>;
    /** Network ID to attach wireguard peer to */
    network?: string | undefined | null | Variable<any, string>;
    /** Add via NATS transaction (deprecated - nats is always used) */
    nats?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of AddWireGuardPeer. */
  ["AddWireGuardPeerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    endpointip?: boolean | `@${string}`;
    network?: boolean | `@${string}`;
    peerip?: boolean | `@${string}`;
    pubkey?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of AllocateIPAddress */
  ["AllocateIPAddressInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The application to allocate the ip address for */
    appId: string | Variable<any, string>;
    /** The type of IP address to allocate (v4, v6, or private_v6) */
    type: ValueTypes["IPAddressType"] | Variable<any, string>;
    /** The organization whose network should be used for private IP allocation */
    organizationId?: string | undefined | null | Variable<any, string>;
    /** Desired IP region (defaults to global) */
    region?: string | undefined | null | Variable<any, string>;
    /** The target network name in the specified organization */
    network?: string | undefined | null | Variable<any, string>;
    /** The name of the associated service */
    serviceName?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of AllocateIPAddress. */
  ["AllocateIPAddressPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    ipAddress?: ValueTypes["IPAddress"];
    __typename?: boolean | `@${string}`;
  }>;
  ["Allocation"]: AliasType<{
    attachedVolumes?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["VolumeConnection"]];
    canary?: boolean | `@${string}`;
    checks?: [{
      /** Filter checks by name */
      name?: string | undefined | null | Variable<any, string>;
    }, ValueTypes["CheckState"]];
    createdAt?: boolean | `@${string}`;
    criticalCheckCount?: boolean | `@${string}`;
    /** Desired status */
    desiredStatus?: boolean | `@${string}`;
    events?: ValueTypes["AllocationEvent"];
    failed?: boolean | `@${string}`;
    healthy?: boolean | `@${string}`;
    /** Unique ID for this instance */
    id?: boolean | `@${string}`;
    /** Short unique ID for this instance */
    idShort?: boolean | `@${string}`;
    /** Indicates if this instance is from the latest job version */
    latestVersion?: boolean | `@${string}`;
    passingCheckCount?: boolean | `@${string}`;
    /** Private IPv6 address for this instance */
    privateIP?: boolean | `@${string}`;
    recentLogs?: [{
      /** Max number of entries to return */
      limit?:
        | number
        | undefined
        | null
        | Variable<any, string>; /** Max age of log entries in seconds */
      range?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["LogEntry"]];
    /** Region this allocation is running in */
    region?: boolean | `@${string}`;
    restarts?: boolean | `@${string}`;
    /** Current status */
    status?: boolean | `@${string}`;
    taskName?: boolean | `@${string}`;
    totalCheckCount?: boolean | `@${string}`;
    transitioning?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    /** The configuration version of this instance */
    version?: boolean | `@${string}`;
    warningCheckCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["AllocationEvent"]: AliasType<{
    message?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["App"]: AliasType<{
    addOns?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      type?: ValueTypes["AddOnType"] | undefined | null | Variable<any, string>;
    }, ValueTypes["AddOnConnection"]];
    allocation?: [
      { id: string | Variable<any, string> },
      ValueTypes["Allocation"],
    ];
    allocations?: [
      { showCompleted?: boolean | undefined | null | Variable<any, string> },
      ValueTypes["Allocation"],
    ];
    appUrl?: boolean | `@${string}`;
    autoscaling?: ValueTypes["AutoscalingConfig"];
    backupRegions?: ValueTypes["Region"];
    builds?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["BuildConnection"]];
    certificate?: [
      { hostname: string | Variable<any, string> },
      ValueTypes["AppCertificate"],
    ];
    certificates?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      filter?: string | undefined | null | Variable<any, string>;
      id?: string | undefined | null | Variable<any, string>;
    }, ValueTypes["AppCertificateConnection"]];
    changes?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["AppChangeConnection"]];
    config?: ValueTypes["AppConfig"];
    createdAt?: boolean | `@${string}`;
    currentLock?: ValueTypes["AppLock"];
    currentPlacement?: ValueTypes["RegionPlacement"];
    /** The latest release of this application */
    currentRelease?: ValueTypes["Release"];
    /** The latest release of this application, without any config processing */
    currentReleaseUnprocessed?: ValueTypes["ReleaseUnprocessed"];
    deployed?: boolean | `@${string}`;
    /** Continuous deployment configuration */
    deploymentSource?: ValueTypes["DeploymentSource"];
    deploymentStatus?: [
      {
        id?: string | undefined | null | Variable<any, string>;
        evaluationId?: string | undefined | null | Variable<any, string>;
      },
      ValueTypes["DeploymentStatus"],
    ];
    /** Check if this app has a configured deployment source */
    hasDeploymentSource?: boolean | `@${string}`;
    healthChecks?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?:
        | number
        | undefined
        | null
        | Variable<any, string>; /** Filter health checks by name */
      name?: string | undefined | null | Variable<any, string>;
    }, ValueTypes["CheckStateConnection"]];
    /** Autogenerated hostname for this application */
    hostname?: boolean | `@${string}`;
    /** Unique application ID */
    id?: boolean | `@${string}`;
    image?: [{ ref: string | Variable<any, string> }, ValueTypes["Image"]];
    /** Image details */
    imageDetails?: ValueTypes["ImageVersion"];
    imageUpgradeAvailable?: boolean | `@${string}`;
    imageVersionTrackingEnabled?: boolean | `@${string}`;
    /** Authentication key to use with Instrumentation endpoints */
    instrumentsKey?: boolean | `@${string}`;
    internalId?: boolean | `@${string}`;
    internalNumericId?: boolean | `@${string}`;
    ipAddress?: [
      { address: string | Variable<any, string> },
      ValueTypes["IPAddress"],
    ];
    ipAddresses?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["IPAddressConnection"]];
    /** This object's unique key */
    key?: boolean | `@${string}`;
    /** Latest image details */
    latestImageDetails?: ValueTypes["ImageVersion"];
    limitedAccessTokens?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["LimitedAccessTokenConnection"]];
    machine?: [{ id: string | Variable<any, string> }, ValueTypes["Machine"]];
    machines?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      version?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Return only started/stopped machines (excludes destroyed, etc.) */
      active?: boolean | undefined | null | Variable<any, string>;
    }, ValueTypes["MachineConnection"]];
    /** The unique application name */
    name?: boolean | `@${string}`;
    network?: boolean | `@${string}`;
    networkId?: boolean | `@${string}`;
    /** Organization that owns this app */
    organization?: ValueTypes["Organization"];
    parseConfig?: [
      { definition: ValueTypes["JSON"] | Variable<any, string> },
      ValueTypes["AppConfig"],
    ];
    /** Fly platform version */
    platformVersion?: boolean | `@${string}`;
    processGroups?: ValueTypes["ProcessGroup"];
    regions?: ValueTypes["Region"];
    release?: [
      {
        id?: string | undefined | null | Variable<any, string>;
        version?: number | undefined | null | Variable<any, string>;
      },
      ValueTypes["Release"],
    ];
    releases?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["ReleaseConnection"]];
    releasesUnprocessed?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      status?: string | undefined | null | Variable<any, string>;
    }, ValueTypes["ReleaseUnprocessedConnection"]];
    role?: ValueTypes["AppRole"];
    /** Application runtime */
    runtime?: boolean | `@${string}`;
    /** Secrets set on the application */
    secrets?: ValueTypes["Secret"];
    services?: ValueTypes["Service"];
    sharedIpAddress?: boolean | `@${string}`;
    state?: boolean | `@${string}`;
    /** Application status */
    status?: boolean | `@${string}`;
    taskGroupCounts?: ValueTypes["TaskGroupCount"];
    usage?: ValueTypes["AppUsage"];
    version?: boolean | `@${string}`;
    vmSize?: ValueTypes["VMSize"];
    vms?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      showCompleted?: boolean | undefined | null | Variable<any, string>;
    }, ValueTypes["VMConnection"]];
    volume?: [
      { internalId: string | Variable<any, string> },
      ValueTypes["Volume"],
    ];
    volumes?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["VolumeConnection"]];
    __typename?: boolean | `@${string}`;
  }>;
  ["AppCertificate"]: AliasType<{
    acmeAlpnConfigured?: boolean | `@${string}`;
    acmeDnsConfigured?: boolean | `@${string}`;
    certificateAuthority?: boolean | `@${string}`;
    certificateRequestedAt?: boolean | `@${string}`;
    check?: boolean | `@${string}`;
    clientStatus?: boolean | `@${string}`;
    configured?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    dnsProvider?: boolean | `@${string}`;
    dnsValidationHostname?: boolean | `@${string}`;
    dnsValidationInstructions?: boolean | `@${string}`;
    dnsValidationTarget?: boolean | `@${string}`;
    domain?: boolean | `@${string}`;
    hostname?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    isAcmeAlpnConfigured?: boolean | `@${string}`;
    isAcmeDnsConfigured?: boolean | `@${string}`;
    isApex?: boolean | `@${string}`;
    isConfigured?: boolean | `@${string}`;
    isWildcard?: boolean | `@${string}`;
    issued?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      includeExpired?: boolean | undefined | null | Variable<any, string>;
    }, ValueTypes["CertificateConnection"]];
    source?: boolean | `@${string}`;
    validationErrors?: ValueTypes["AppCertificateValidationError"];
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for AppCertificate. */
  ["AppCertificateConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["AppCertificateEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["AppCertificate"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AppCertificateEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["AppCertificate"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AppCertificateValidationError"]: AliasType<{
    message?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["AppChange"]: AliasType<{
    /** Object that triggered the change */
    actor?: ValueTypes["AppChangeActor"];
    actorType?: boolean | `@${string}`;
    app?: ValueTypes["App"];
    createdAt?: boolean | `@${string}`;
    description?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    user?: ValueTypes["User"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Objects that change apps */
  ["AppChangeActor"]: AliasType<
    {
      ["...on Build"]: ValueTypes["Build"];
      ["...on Release"]: ValueTypes["Release"];
      ["...on Secret"]: ValueTypes["Secret"];
      __typename?: boolean | `@${string}`;
    }
  >;
  /** The connection type for AppChange. */
  ["AppChangeConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["AppChangeEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["AppChange"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AppChangeEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["AppChange"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AppConfig"]: AliasType<{
    definition?: boolean | `@${string}`;
    errors?: boolean | `@${string}`;
    services?: ValueTypes["Service"];
    valid?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for App. */
  ["AppConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["AppEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["App"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AppEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["App"];
    __typename?: boolean | `@${string}`;
  }>;
  /** app lock */
  ["AppLock"]: AliasType<{
    /** Time when the lock expires */
    expiration?: boolean | `@${string}`;
    /** Lock ID */
    lockId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["AppRole"]: AliasType<{
    /** The name of this role */
    name?: boolean | `@${string}`;
    ["...on EmptyAppRole"]?: Omit<
      ValueTypes["EmptyAppRole"],
      keyof ValueTypes["AppRole"]
    >;
    ["...on FlyctlMachineHostAppRole"]?: Omit<
      ValueTypes["FlyctlMachineHostAppRole"],
      keyof ValueTypes["AppRole"]
    >;
    ["...on PostgresClusterAppRole"]?: Omit<
      ValueTypes["PostgresClusterAppRole"],
      keyof ValueTypes["AppRole"]
    >;
    ["...on RemoteDockerBuilderAppRole"]?: Omit<
      ValueTypes["RemoteDockerBuilderAppRole"],
      keyof ValueTypes["AppRole"]
    >;
    __typename?: boolean | `@${string}`;
  }>;
  ["AppState"]: AppState;
  /** Application usage data */
  ["AppUsage"]: AliasType<{
    /** The timespan interval for this usage sample */
    interval?: boolean | `@${string}`;
    /** Total requests for this time period */
    requestsCount?: boolean | `@${string}`;
    /** Total app execution time (in seconds) for this time period */
    totalAppExecS?: boolean | `@${string}`;
    /** Total GB transferred out in this time period */
    totalDataOutGB?: boolean | `@${string}`;
    /** The start of the timespan for this usage sample */
    ts?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of AttachPostgresCluster */
  ["AttachPostgresClusterInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The postgres cluster application id */
    postgresClusterAppId: string | Variable<any, string>;
    /** The application to attach postgres to */
    appId: string | Variable<any, string>;
    /** The database to attach. Defaults to a new database with the same name as the app. */
    databaseName?: string | undefined | null | Variable<any, string>;
    /** The database user to create. Defaults to using the database name. */
    databaseUser?: string | undefined | null | Variable<any, string>;
    /** The environment variable name to set the connection string to. Defaults to DATABASE_URL */
    variableName?: string | undefined | null | Variable<any, string>;
    /** Flag used to indicate that flyctl will exec calls */
    manualEntry?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of AttachPostgresCluster. */
  ["AttachPostgresClusterPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    connectionString?: boolean | `@${string}`;
    environmentVariableName?: boolean | `@${string}`;
    postgresClusterApp?: ValueTypes["App"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AutoscaleRegionConfig"]: AliasType<{
    /** The region code */
    code?: boolean | `@${string}`;
    /** The minimum number of VMs to run in this region */
    minCount?: boolean | `@${string}`;
    /** The relative weight for this region */
    weight?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Region autoscaling configuration */
  ["AutoscaleRegionConfigInput"]: {
    /** The region code to configure */
    code: string | Variable<any, string>;
    /** The weight */
    weight?: number | undefined | null | Variable<any, string>;
    /** Minimum number of VMs to run in this region */
    minCount?: number | undefined | null | Variable<any, string>;
    /** Reset the configuration for this region */
    reset?: boolean | undefined | null | Variable<any, string>;
  };
  ["AutoscaleStrategy"]: AutoscaleStrategy;
  ["AutoscalingConfig"]: AliasType<{
    backupRegions?: boolean | `@${string}`;
    balanceRegions?: boolean | `@${string}`;
    enabled?: boolean | `@${string}`;
    maxCount?: boolean | `@${string}`;
    minCount?: boolean | `@${string}`;
    preferredRegion?: boolean | `@${string}`;
    regions?: ValueTypes["AutoscaleRegionConfig"];
    strategy?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Represents non-fractional signed whole numeric values. Since the value may exceed the size of a 32-bit integer, it's encoded as a string. */
  ["BigInt"]: unknown;
  ["BillingStatus"]: BillingStatus;
  ["Build"]: AliasType<{
    app?: ValueTypes["App"];
    commitId?: boolean | `@${string}`;
    commitUrl?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** The user who initiated the build */
    createdBy?: ValueTypes["User"];
    /** Indicates if this build is complete and failed */
    failed?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    image?: boolean | `@${string}`;
    /** Indicates if this build is currently in progress */
    inProgress?: boolean | `@${string}`;
    /** Log output */
    logs?: boolean | `@${string}`;
    number?: boolean | `@${string}`;
    /** Status of the build */
    status?: boolean | `@${string}`;
    /** Indicates if this build is complete and succeeded */
    succeeded?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Build. */
  ["BuildConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["BuildEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["Build"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["BuildEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["Build"];
    __typename?: boolean | `@${string}`;
  }>;
  ["BuildFinalImageInput"]: {
    /** Sha256 id of docker image */
    id: string | Variable<any, string>;
    /** Tag used for docker image */
    tag: string | Variable<any, string>;
    /** Size in bytes of the docker image */
    sizeBytes: ValueTypes["BigInt"] | Variable<any, string>;
  };
  ["BuildImageOptsInput"]: {
    /** Path to dockerfile, if one exists */
    dockerfilePath?: string | undefined | null | Variable<any, string>;
    /** Unused in cli? */
    imageRef?: string | undefined | null | Variable<any, string>;
    /** Set of build time variables passed to cli */
    buildArgs?: ValueTypes["JSON"] | undefined | null | Variable<any, string>;
    /** Unused in cli? */
    extraBuildArgs?:
      | ValueTypes["JSON"]
      | undefined
      | null
      | Variable<any, string>;
    /** Image label to use when tagging and pushing to the fly registry */
    imageLabel?: string | undefined | null | Variable<any, string>;
    /** Whether publishing to the registry was requested */
    publish?: boolean | undefined | null | Variable<any, string>;
    /** Docker tag used to publish image to registry */
    tag?: string | undefined | null | Variable<any, string>;
    /** Set the target build stage to build if the Dockerfile has more than one stage */
    target?: string | undefined | null | Variable<any, string>;
    /** Do not use the build cache when building the image */
    noCache?: boolean | undefined | null | Variable<any, string>;
    /** Builtin builder to use */
    builtIn?: string | undefined | null | Variable<any, string>;
    /** Builtin builder settings */
    builtInSettings?:
      | ValueTypes["JSON"]
      | undefined
      | null
      | Variable<any, string>;
    /** Fly.toml build.builder setting */
    builder?: string | undefined | null | Variable<any, string>;
    /** Fly.toml build.buildpacks setting */
    buildPacks?: Array<string> | undefined | null | Variable<any, string>;
  };
  ["BuildStrategyAttemptInput"]: {
    /** Build strategy attempted */
    strategy: string | Variable<any, string>;
    /** Result attempting this strategy */
    result: string | Variable<any, string>;
    /** Optional error message from strategy */
    error?: string | undefined | null | Variable<any, string>;
    /** Optional note about this strategy or its result */
    note?: string | undefined | null | Variable<any, string>;
  };
  ["BuildTimingsInput"]: {
    /** Time to build and push the image, measured by flyctl */
    buildAndPushMs?:
      | ValueTypes["BigInt"]
      | undefined
      | null
      | Variable<any, string>;
    /** Time to initialize client used to connect to either remote or local builder */
    builderInitMs?:
      | ValueTypes["BigInt"]
      | undefined
      | null
      | Variable<any, string>;
    /** Time to build the image including create context, measured by flyctl */
    buildMs?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>;
    /** Time to create the build context tar file, measured by flyctl */
    contextBuildMs?:
      | ValueTypes["BigInt"]
      | undefined
      | null
      | Variable<any, string>;
    /** Time for builder to build image after receiving context, measured by flyctl */
    imageBuildMs?:
      | ValueTypes["BigInt"]
      | undefined
      | null
      | Variable<any, string>;
    /** Time to push completed image to registry, measured by flyctl */
    pushMs?: ValueTypes["BigInt"] | undefined | null | Variable<any, string>;
  };
  ["BuilderMetaInput"]: {
    /** Local or remote builder type */
    builderType: string | Variable<any, string>;
    /** Docker version reported by builder */
    dockerVersion?: string | undefined | null | Variable<any, string>;
    /** Whther or not buildkit is enabled on builder */
    buildkitEnabled?: boolean | undefined | null | Variable<any, string>;
    /** Platform reported by the builder */
    platform?: string | undefined | null | Variable<any, string>;
    /** Remote builder app used */
    remoteAppName?: string | undefined | null | Variable<any, string>;
    /** Remote builder machine used */
    remoteMachineId?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of CancelBuild. */
  ["CancelBuildPayload"]: AliasType<{
    build?: ValueTypes["Build"];
    __typename?: boolean | `@${string}`;
  }>;
  /** A set of base64 messagepack encoded macaroon caveats (See https://github.com/superfly/macaroon) */
  ["CaveatSet"]: unknown;
  ["Certificate"]: AliasType<{
    expiresAt?: boolean | `@${string}`;
    hostname?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Certificate. */
  ["CertificateConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["CertificateEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["Certificate"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CertificateEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["Certificate"];
    __typename?: boolean | `@${string}`;
  }>;
  /** health check */
  ["Check"]: AliasType<{
    httpHeaders?: ValueTypes["CheckHeader"];
    httpMethod?: boolean | `@${string}`;
    httpPath?: boolean | `@${string}`;
    httpProtocol?: boolean | `@${string}`;
    httpTlsSkipVerify?: boolean | `@${string}`;
    /** Check interval in milliseconds */
    interval?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    scriptArgs?: boolean | `@${string}`;
    scriptCommand?: boolean | `@${string}`;
    /** Check timeout in milliseconds */
    timeout?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CheckCertificate */
  ["CheckCertificateInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** Application to ID */
    appId: string | Variable<any, string>;
    /** Certificate hostname to check */
    hostname: string | Variable<any, string>;
  };
  /** Autogenerated return type of CheckCertificate. */
  ["CheckCertificatePayload"]: AliasType<{
    app?: ValueTypes["App"];
    certificate?: ValueTypes["AppCertificate"];
    check?: ValueTypes["HostnameCheck"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CheckDomain */
  ["CheckDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** Domain name to check */
    domainName: string | Variable<any, string>;
  };
  /** Autogenerated return type of CheckDomain. */
  ["CheckDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    dnsAvailable?: boolean | `@${string}`;
    domainName?: boolean | `@${string}`;
    registrationAvailable?: boolean | `@${string}`;
    registrationPeriod?: boolean | `@${string}`;
    registrationPrice?: boolean | `@${string}`;
    registrationSupported?: boolean | `@${string}`;
    tld?: boolean | `@${string}`;
    transferAvailable?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** check job http response */
  ["CheckHTTPResponse"]: AliasType<{
    closeTs?: boolean | `@${string}`;
    connectedTs?: boolean | `@${string}`;
    dnsTs?: boolean | `@${string}`;
    firstTs?: boolean | `@${string}`;
    flyioDebug?: boolean | `@${string}`;
    headers?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    lastTs?: boolean | `@${string}`;
    location?: ValueTypes["CheckLocation"];
    rawHeaders?: boolean | `@${string}`;
    rawOutput?: boolean | `@${string}`;
    resolvedIp?: boolean | `@${string}`;
    sentTs?: boolean | `@${string}`;
    startTs?: boolean | `@${string}`;
    statusCode?: boolean | `@${string}`;
    tlsTs?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for CheckHTTPResponse. */
  ["CheckHTTPResponseConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["CheckHTTPResponseEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["CheckHTTPResponse"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CheckHTTPResponseEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["CheckHTTPResponse"];
    __typename?: boolean | `@${string}`;
  }>;
  /** All available http checks verbs */
  ["CheckHTTPVerb"]: CheckHTTPVerb;
  /** HTTP header for a health check */
  ["CheckHeader"]: AliasType<{
    name?: boolean | `@${string}`;
    value?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["CheckHeaderInput"]: {
    name: string | Variable<any, string>;
    value: string | Variable<any, string>;
  };
  ["CheckInput"]: {
    type: ValueTypes["CheckType"] | Variable<any, string>;
    name?: string | undefined | null | Variable<any, string>;
    /** Check interval in milliseconds */
    interval?: number | undefined | null | Variable<any, string>;
    /** Check timeout in milliseconds */
    timeout?: number | undefined | null | Variable<any, string>;
    httpMethod?:
      | ValueTypes["HTTPMethod"]
      | undefined
      | null
      | Variable<any, string>;
    httpPath?: string | undefined | null | Variable<any, string>;
    httpProtocol?:
      | ValueTypes["HTTPProtocol"]
      | undefined
      | null
      | Variable<any, string>;
    httpTlsSkipVerify?: boolean | undefined | null | Variable<any, string>;
    httpHeaders?:
      | Array<ValueTypes["CheckHeaderInput"]>
      | undefined
      | null
      | Variable<any, string>;
    scriptCommand?: string | undefined | null | Variable<any, string>;
    scriptArgs?: Array<string> | undefined | null | Variable<any, string>;
  };
  /** check job */
  ["CheckJob"]: AliasType<{
    httpOptions?: ValueTypes["CheckJobHTTPOptions"];
    id?: boolean | `@${string}`;
    locations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["CheckLocationConnection"]];
    nextRunAt?: boolean | `@${string}`;
    runs?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["CheckJobRunConnection"]];
    schedule?: boolean | `@${string}`;
    url?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for CheckJob. */
  ["CheckJobConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["CheckJobEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["CheckJob"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CheckJobEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["CheckJob"];
    __typename?: boolean | `@${string}`;
  }>;
  /** health check state */
  ["CheckJobHTTPOptions"]: AliasType<{
    headers?: boolean | `@${string}`;
    verb?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** health check state */
  ["CheckJobHTTPOptionsInput"]: {
    verb: ValueTypes["CheckHTTPVerb"] | Variable<any, string>;
    headers?: Array<string> | undefined | null | Variable<any, string>;
  };
  /** check job run */
  ["CheckJobRun"]: AliasType<{
    completedAt?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    httpOptions?: ValueTypes["CheckJobHTTPOptions"];
    httpResponses?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["CheckHTTPResponseConnection"]];
    id?: boolean | `@${string}`;
    locations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["CheckLocationConnection"]];
    state?: boolean | `@${string}`;
    tests?: boolean | `@${string}`;
    url?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for CheckJobRun. */
  ["CheckJobRunConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["CheckJobRunEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["CheckJobRun"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CheckJobRunEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["CheckJobRun"];
    __typename?: boolean | `@${string}`;
  }>;
  /** check location */
  ["CheckLocation"]: AliasType<{
    coordinates?: boolean | `@${string}`;
    country?: boolean | `@${string}`;
    locality?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    state?: boolean | `@${string}`;
    title?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for CheckLocation. */
  ["CheckLocationConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["CheckLocationEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["CheckLocation"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CheckLocationEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["CheckLocation"];
    __typename?: boolean | `@${string}`;
  }>;
  /** health check state */
  ["CheckState"]: AliasType<{
    allocation?: ValueTypes["Allocation"];
    allocationId?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    output?: [{
      /** The number of characters to truncate output to */
      limit?:
        | number
        | undefined
        | null
        | Variable<any, string>; /** Remove newlines and trim whitespace */
      compact?: boolean | undefined | null | Variable<any, string>;
    }, boolean | `@${string}`];
    serviceName?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for CheckState. */
  ["CheckStateConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["CheckStateEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["CheckState"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CheckStateEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["CheckState"];
    __typename?: boolean | `@${string}`;
  }>;
  ["CheckType"]: CheckType;
  /** Autogenerated input type of ConfigureRegions */
  ["ConfigureRegionsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** Regions to allow running in */
    allowRegions?: Array<string> | undefined | null | Variable<any, string>;
    /** Regions to deny running in */
    denyRegions?: Array<string> | undefined | null | Variable<any, string>;
    /** Fallback regions. Used if preferred regions are having issues */
    backupRegions?: Array<string> | undefined | null | Variable<any, string>;
    /** Process group to modify */
    group?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of ConfigureRegions. */
  ["ConfigureRegionsPayload"]: AliasType<{
    app?: ValueTypes["App"];
    backupRegions?: ValueTypes["Region"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    group?: boolean | `@${string}`;
    regions?: ValueTypes["Region"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateAddOn */
  ["CreateAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** An optional application ID to attach the add-on to after provisioning */
    appId?: string | undefined | null | Variable<any, string>;
    /** The organization which owns the add-on */
    organizationId?: string | undefined | null | Variable<any, string>;
    /** The add-on type to provision */
    type: ValueTypes["AddOnType"] | Variable<any, string>;
    /** An optional name for the add-on */
    name?: string | undefined | null | Variable<any, string>;
    /** The add-on plan ID */
    planId?: string | undefined | null | Variable<any, string>;
    /** Desired primary region for the add-on */
    primaryRegion?: string | undefined | null | Variable<any, string>;
    /** Desired regions to place replicas in */
    readRegions?: Array<string> | undefined | null | Variable<any, string>;
    /** Options specific to the add-on */
    options?: ValueTypes["JSON"] | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of CreateAddOn. */
  ["CreateAddOnPayload"]: AliasType<{
    addOn?: ValueTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateAndRegisterDomain */
  ["CreateAndRegisterDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The domain name */
    name: string | Variable<any, string>;
    /** Enable whois privacy on the registration */
    whoisPrivacy?: boolean | undefined | null | Variable<any, string>;
    /** Enable auto renew on the registration */
    autoRenew?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of CreateAndRegisterDomain. */
  ["CreateAndRegisterDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ValueTypes["Domain"];
    organization?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateAndTransferDomain */
  ["CreateAndTransferDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The domain name */
    name: string | Variable<any, string>;
    /** The authorization code */
    authorizationCode: string | Variable<any, string>;
  };
  /** Autogenerated return type of CreateAndTransferDomain. */
  ["CreateAndTransferDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ValueTypes["Domain"];
    organization?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateApp */
  ["CreateAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The application runtime */
    runtime?:
      | ValueTypes["RuntimeType"]
      | undefined
      | null
      | Variable<any, string>;
    /** The name of the new application. Defaults to a random name. */
    name?: string | undefined | null | Variable<any, string>;
    preferredRegion?: string | undefined | null | Variable<any, string>;
    heroku?: boolean | undefined | null | Variable<any, string>;
    network?: string | undefined | null | Variable<any, string>;
    appRoleId?: string | undefined | null | Variable<any, string>;
    machines?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of CreateApp. */
  ["CreateAppPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateBuild */
  ["CreateBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The name of the app being built */
    appName: string | Variable<any, string>;
    /** The ID of the machine being built (only set for machine builds) */
    machineId?: string | undefined | null | Variable<any, string>;
    /** Options set for building image */
    imageOpts: ValueTypes["BuildImageOptsInput"] | Variable<any, string>;
    /** List of available build strategies that will be attempted */
    strategiesAvailable: Array<string> | Variable<any, string>;
    /** Whether builder is remote or local */
    builderType: string | Variable<any, string>;
  };
  /** Autogenerated return type of CreateBuild. */
  ["CreateBuildPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** build id */
    id?: boolean | `@${string}`;
    /** stored build status */
    status?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateCheckJob */
  ["CreateCheckJobInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** Organization ID */
    organizationId: string | Variable<any, string>;
    /** The URL to check */
    url: string | Variable<any, string>;
    /** http checks locations */
    locations: Array<string> | Variable<any, string>;
    /** http check options */
    httpOptions: ValueTypes["CheckJobHTTPOptionsInput"] | Variable<any, string>;
  };
  /** Autogenerated return type of CreateCheckJob. */
  ["CreateCheckJobPayload"]: AliasType<{
    checkJob?: ValueTypes["CheckJob"];
    checkJobRun?: ValueTypes["CheckJobRun"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateCheckJobRun */
  ["CreateCheckJobRunInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** Check Job ID */
    checkJobId: string | Variable<any, string>;
  };
  /** Autogenerated return type of CreateCheckJobRun. */
  ["CreateCheckJobRunPayload"]: AliasType<{
    checkJob?: ValueTypes["CheckJob"];
    checkJobRun?: ValueTypes["CheckJobRun"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDNSPortal */
  ["CreateDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The unique name of this portal. A random name will be generated if omitted. */
    name?: string | undefined | null | Variable<any, string>;
    /** The title of this portal */
    title?: string | undefined | null | Variable<any, string>;
    /** The return url for this portal */
    returnUrl?: string | undefined | null | Variable<any, string>;
    /** The text to display for the return url link */
    returnUrlText?: string | undefined | null | Variable<any, string>;
    /** The support url for this portal */
    supportUrl?: string | undefined | null | Variable<any, string>;
    /** The text to display for the support url link */
    supportUrlText?: string | undefined | null | Variable<any, string>;
    /** The primary branding color */
    primaryColor?: string | undefined | null | Variable<any, string>;
    /** The secondary branding color */
    accentColor?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of CreateDNSPortal. */
  ["CreateDNSPortalPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    dnsPortal?: ValueTypes["DNSPortal"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDNSPortalSession */
  ["CreateDNSPortalSessionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the dns portal */
    dnsPortalId: string | Variable<any, string>;
    /** The node ID of the domain to edit */
    domainId: string | Variable<any, string>;
    /** Optionally override the portal's default title for this session */
    title?: string | undefined | null | Variable<any, string>;
    /** Optionally override the portal's default return url for this session */
    returnUrl?: string | undefined | null | Variable<any, string>;
    /** Optionally override the portal's default return url text for this session */
    returnUrlText?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of CreateDNSPortalSession. */
  ["CreateDNSPortalSessionPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    dnsPortalSession?: ValueTypes["DNSPortalSession"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDNSRecord */
  ["CreateDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the domain */
    domainId: string | Variable<any, string>;
    /** The type of the record */
    type: ValueTypes["DNSRecordType"] | Variable<any, string>;
    /** The dns record name */
    name: string | Variable<any, string>;
    /** The TTL in seconds */
    ttl: number | Variable<any, string>;
    /** The content of the record */
    rdata: string | Variable<any, string>;
  };
  /** Autogenerated return type of CreateDNSRecord. */
  ["CreateDNSRecordPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    record?: ValueTypes["DNSRecord"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDelegatedWireGuardToken */
  ["CreateDelegatedWireGuardTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The name with which to refer to the peer */
    name?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of CreateDelegatedWireGuardToken. */
  ["CreateDelegatedWireGuardTokenPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    token?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDoctorReport */
  ["CreateDoctorReportInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The report data */
    data: ValueTypes["JSON"] | Variable<any, string>;
  };
  /** Autogenerated return type of CreateDoctorReport. */
  ["CreateDoctorReportPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    reportId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of CreateDoctorUrl. */
  ["CreateDoctorUrlPayload"]: AliasType<{
    putUrl?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDomain */
  ["CreateDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The domain name */
    name: string | Variable<any, string>;
  };
  /** Autogenerated return type of CreateDomain. */
  ["CreateDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ValueTypes["Domain"];
    organization?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateExtensionTosAgreement */
  ["CreateExtensionTosAgreementInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The add-on provider name */
    addOnProviderName: string | Variable<any, string>;
    /** The organization that agrees to the ToS */
    organizationId?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of CreateExtensionTosAgreement. */
  ["CreateExtensionTosAgreementPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateLimitedAccessToken */
  ["CreateLimitedAccessTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    name: string | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    profile: string | Variable<any, string>;
    profileParams?:
      | ValueTypes["JSON"]
      | undefined
      | null
      | Variable<any, string>;
    expiry?: string | undefined | null | Variable<any, string>;
    /** Names of third-party configurations to opt into */
    optInThirdParties?:
      | Array<string>
      | undefined
      | null
      | Variable<any, string>;
    /** Names of third-party configurations to opt out of */
    optOutThirdParties?:
      | Array<string>
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Autogenerated return type of CreateLimitedAccessToken. */
  ["CreateLimitedAccessTokenPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    limitedAccessToken?: ValueTypes["LimitedAccessToken"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateOrganization */
  ["CreateOrganizationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The name of the organization */
    name: string | Variable<any, string>;
    /** Whether or not new apps in this org use Apps V2 by default */
    appsV2DefaultOn?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated input type of CreateOrganizationInvitation */
  ["CreateOrganizationInvitationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The email to invite */
    email: string | Variable<any, string>;
  };
  /** Autogenerated return type of CreateOrganizationInvitation. */
  ["CreateOrganizationInvitationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    invitation?: ValueTypes["OrganizationInvitation"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of CreateOrganization. */
  ["CreateOrganizationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ValueTypes["Organization"];
    token?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreatePostgresClusterDatabase */
  ["CreatePostgresClusterDatabaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The name of the postgres cluster app */
    appName: string | Variable<any, string>;
    /** The name of the database */
    databaseName: string | Variable<any, string>;
  };
  /** Autogenerated return type of CreatePostgresClusterDatabase. */
  ["CreatePostgresClusterDatabasePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    database?: ValueTypes["PostgresClusterDatabase"];
    postgresClusterRole?: ValueTypes["PostgresClusterAppRole"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreatePostgresClusterUser */
  ["CreatePostgresClusterUserInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The name of the postgres cluster app */
    appName: string | Variable<any, string>;
    /** The name of the database */
    username: string | Variable<any, string>;
    /** The password of the user */
    password: string | Variable<any, string>;
    /** Should this user be a superuser */
    superuser?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of CreatePostgresClusterUser. */
  ["CreatePostgresClusterUserPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    postgresClusterRole?: ValueTypes["PostgresClusterAppRole"];
    user?: ValueTypes["PostgresClusterUser"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateRelease */
  ["CreateReleaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** The image to deploy */
    image: string | Variable<any, string>;
    /** nomad or machines */
    platformVersion: string | Variable<any, string>;
    /** app definition */
    definition: ValueTypes["JSON"] | Variable<any, string>;
    /** The strategy for replacing existing instances. Defaults to canary. */
    strategy: ValueTypes["DeploymentStrategy"] | Variable<any, string>;
  };
  /** Autogenerated return type of CreateRelease. */
  ["CreateReleasePayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ValueTypes["Release"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateTemplateDeployment */
  ["CreateTemplateDeploymentInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization to move the app to */
    organizationId: string | Variable<any, string>;
    template: ValueTypes["JSON"] | Variable<any, string>;
    variables?:
      | Array<ValueTypes["PropertyInput"]>
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Autogenerated return type of CreateTemplateDeployment. */
  ["CreateTemplateDeploymentPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    templateDeployment?: ValueTypes["TemplateDeployment"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateThirdPartyConfiguration */
  ["CreateThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** Friendly name for this configuration */
    name: string | Variable<any, string>;
    /** Location URL of the third-party service capable of discharging */
    location: string | Variable<any, string>;
    /** Restrictions to be placed on third-party caveats */
    caveats?:
      | ValueTypes["CaveatSet"]
      | undefined
      | null
      | Variable<any, string>;
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel:
      | ValueTypes["ThirdPartyConfigurationLevel"]
      | Variable<any, string>;
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel:
      | ValueTypes["ThirdPartyConfigurationLevel"]
      | Variable<any, string>;
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel:
      | ValueTypes["ThirdPartyConfigurationLevel"]
      | Variable<any, string>;
  };
  /** Autogenerated return type of CreateThirdPartyConfiguration. */
  ["CreateThirdPartyConfigurationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    thirdPartyConfiguration?: ValueTypes["ThirdPartyConfiguration"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateVolume */
  ["CreateVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The application to attach the new volume to */
    appId: string | Variable<any, string>;
    /** Volume name */
    name: string | Variable<any, string>;
    /** Desired region for volume */
    region: string | Variable<any, string>;
    /** Desired volume size, in GB */
    sizeGb: number | Variable<any, string>;
    /** Volume should be encrypted at rest */
    encrypted?: boolean | undefined | null | Variable<any, string>;
    /** Provision volume in a redundancy zone not already in use by this app */
    requireUniqueZone?: boolean | undefined | null | Variable<any, string>;
    snapshotId?: string | undefined | null | Variable<any, string>;
    fsType?:
      | ValueTypes["FsTypeType"]
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Autogenerated return type of CreateVolume. */
  ["CreateVolumePayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    volume?: ValueTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateVolumeSnapshot */
  ["CreateVolumeSnapshotInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    volumeId: string | Variable<any, string>;
  };
  /** Autogenerated return type of CreateVolumeSnapshot. */
  ["CreateVolumeSnapshotPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    volume?: ValueTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSPortal"]: AliasType<{
    accentColor?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    organization?: ValueTypes["Organization"];
    primaryColor?: boolean | `@${string}`;
    returnUrl?: boolean | `@${string}`;
    returnUrlText?: boolean | `@${string}`;
    supportUrl?: boolean | `@${string}`;
    supportUrlText?: boolean | `@${string}`;
    title?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for DNSPortal. */
  ["DNSPortalConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["DNSPortalEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["DNSPortal"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["DNSPortalEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["DNSPortal"];
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSPortalSession"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    /** The dns portal this session */
    dnsPortal?: ValueTypes["DNSPortal"];
    expiresAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** Is this session expired? */
    isExpired?: boolean | `@${string}`;
    /** The overridden return url for this session */
    returnUrl?: boolean | `@${string}`;
    /** The overridden return url text for this session */
    returnUrlText?: boolean | `@${string}`;
    /** The overridden title for this session */
    title?: boolean | `@${string}`;
    /** The url to access this session's dns portal */
    url?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSRecord"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    /** The domain this record belongs to */
    domain?: ValueTypes["Domain"];
    /** Fully qualified domain name for this record */
    fqdn?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** Is this record at the zone apex? */
    isApex?: boolean | `@${string}`;
    /** Is this a system record? System records are managed by fly and not editable. */
    isSystem?: boolean | `@${string}`;
    /** Is this record a wildcard? */
    isWildcard?: boolean | `@${string}`;
    /** The name of this record. @ indicates the record is at the zone apex. */
    name?: boolean | `@${string}`;
    /** The record data */
    rdata?: boolean | `@${string}`;
    /** The number of seconds this record can be cached for */
    ttl?: boolean | `@${string}`;
    /** The type of record */
    type?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSRecordAttributes"]: AliasType<{
    /** The name of the record. */
    name?: boolean | `@${string}`;
    /** The record data. */
    rdata?: boolean | `@${string}`;
    /** The number of seconds this record can be cached for. */
    ttl?: boolean | `@${string}`;
    /** The type of record. */
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSRecordChangeAction"]: DNSRecordChangeAction;
  ["DNSRecordChangeInput"]: {
    /** The action to perform on this record. */
    action: ValueTypes["DNSRecordChangeAction"] | Variable<any, string>;
    /** The id of the record this action will apply to. This is required if the action is UPDATE or DELETE. */
    recordId?: string | undefined | null | Variable<any, string>;
    /** The record type. This is required if action is CREATE. */
    type?:
      | ValueTypes["DNSRecordType"]
      | undefined
      | null
      | Variable<any, string>;
    /** The name of the record. If omitted it will default to @ - the zone apex. */
    name?: string | undefined | null | Variable<any, string>;
    /** The number of seconds this record can be cached for. Defaults to 1 hour. */
    ttl?: number | undefined | null | Variable<any, string>;
    /** The record data. Required if action is CREATE */
    rdata?: string | undefined | null | Variable<any, string>;
  };
  /** The connection type for DNSRecord. */
  ["DNSRecordConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["DNSRecordEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["DNSRecord"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSRecordDiff"]: AliasType<{
    /** The action that was performed. */
    action?: boolean | `@${string}`;
    /** The attributes for this record after the action was performed. */
    newAttributes?: ValueTypes["DNSRecordAttributes"];
    /** The text representation of this record after the action was performed. */
    newText?: boolean | `@${string}`;
    /** The attributes for this record before the action was performed. */
    oldAttributes?: ValueTypes["DNSRecordAttributes"];
    /** The text representation of this record before the action was performed. */
    oldText?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["DNSRecordEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["DNSRecord"];
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSRecordType"]: DNSRecordType;
  ["DNSRecordWarning"]: AliasType<{
    /** The action to perform. */
    action?: boolean | `@${string}`;
    /** The desired attributes for this record. */
    attributes?: ValueTypes["DNSRecordAttributes"];
    /** The warning message. */
    message?: boolean | `@${string}`;
    /** The record this warning applies to. */
    record?: ValueTypes["DNSRecord"];
    __typename?: boolean | `@${string}`;
  }>;
  ["DelegatedWireGuardToken"]: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for DelegatedWireGuardToken. */
  ["DelegatedWireGuardTokenConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["DelegatedWireGuardTokenEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["DelegatedWireGuardToken"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["DelegatedWireGuardTokenEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["DelegatedWireGuardToken"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteAddOn */
  ["DeleteAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the add-on to delete */
    addOnId?: string | undefined | null | Variable<any, string>;
    /** The name of the add-on to delete */
    name?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteAddOn. */
  ["DeleteAddOnPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    deletedAddOnName?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of DeleteApp. */
  ["DeleteAppPayload"]: AliasType<{
    /** The organization that owned the deleted app */
    organization?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of DeleteCertificate. */
  ["DeleteCertificatePayload"]: AliasType<{
    app?: ValueTypes["App"];
    certificate?: ValueTypes["AppCertificate"];
    errors?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDNSPortal */
  ["DeleteDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the dns portal */
    dnsPortalId: string | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteDNSPortal. */
  ["DeleteDNSPortalPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** The organization that owned the dns portal */
    organization?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDNSPortalSession */
  ["DeleteDNSPortalSessionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the dns portal session */
    dnsPortalSessionId: string | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteDNSPortalSession. */
  ["DeleteDNSPortalSessionPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** The dns portal that owned the session */
    dnsPortal?: ValueTypes["DNSPortal"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDNSRecord */
  ["DeleteDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the DNS record */
    recordId: string | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteDNSRecord. */
  ["DeleteDNSRecordPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ValueTypes["Domain"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDelegatedWireGuardToken */
  ["DeleteDelegatedWireGuardTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The raw WireGuard token */
    token?: string | undefined | null | Variable<any, string>;
    /** The name with which to refer to the token */
    name?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteDelegatedWireGuardToken. */
  ["DeleteDelegatedWireGuardTokenPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    token?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDeploymentSource */
  ["DeleteDeploymentSourceInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The application to update */
    appId: string | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteDeploymentSource. */
  ["DeleteDeploymentSourcePayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDomain */
  ["DeleteDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the domain */
    domainId: string | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteDomain. */
  ["DeleteDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteHealthCheckHandler */
  ["DeleteHealthCheckHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** Handler name */
    name: string | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteHealthCheckHandler. */
  ["DeleteHealthCheckHandlerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteLimitedAccessToken */
  ["DeleteLimitedAccessTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The root of the macaroon */
    token?: string | undefined | null | Variable<any, string>;
    /** The node ID for real */
    id?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteLimitedAccessToken. */
  ["DeleteLimitedAccessTokenPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    token?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteOrganization */
  ["DeleteOrganizationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the organization to delete */
    organizationId: string | Variable<any, string>;
  };
  /** Autogenerated input type of DeleteOrganizationInvitation */
  ["DeleteOrganizationInvitationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the invitation */
    invitationId: string | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteOrganizationInvitation. */
  ["DeleteOrganizationInvitationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteOrganizationMembership */
  ["DeleteOrganizationMembershipInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The node ID of the user */
    userId: string | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteOrganizationMembership. */
  ["DeleteOrganizationMembershipPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ValueTypes["Organization"];
    user?: ValueTypes["User"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of DeleteOrganization. */
  ["DeleteOrganizationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    deletedOrganizationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteRemoteBuilder */
  ["DeleteRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteRemoteBuilder. */
  ["DeleteRemoteBuilderPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteThirdPartyConfiguration */
  ["DeleteThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the configuration */
    thirdPartyConfigurationId: string | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteThirdPartyConfiguration. */
  ["DeleteThirdPartyConfigurationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    ok?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteVolume */
  ["DeleteVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the volume */
    volumeId: string | Variable<any, string>;
    /** Unique lock ID */
    lockId?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of DeleteVolume. */
  ["DeleteVolumePayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeployImage */
  ["DeployImageInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** The image to deploy */
    image: string | Variable<any, string>;
    /** Network services to expose */
    services?:
      | Array<ValueTypes["ServiceInput"]>
      | undefined
      | null
      | Variable<any, string>;
    /** app definition */
    definition?: ValueTypes["JSON"] | undefined | null | Variable<any, string>;
    /** The strategy for replacing existing instances. Defaults to canary. */
    strategy?:
      | ValueTypes["DeploymentStrategy"]
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Autogenerated return type of DeployImage. */
  ["DeployImagePayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ValueTypes["Release"];
    releaseCommand?: ValueTypes["ReleaseCommand"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Continuous deployment configuration */
  ["DeploymentSource"]: AliasType<{
    backend?: boolean | `@${string}`;
    baseDir?: boolean | `@${string}`;
    connected?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    provider?: boolean | `@${string}`;
    /** The ref to build from */
    ref?: boolean | `@${string}`;
    repositoryId?: boolean | `@${string}`;
    /** The repository to fetch source code from */
    repositoryUrl?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DeploymentStatus"]: AliasType<{
    allocations?: ValueTypes["Allocation"];
    description?: boolean | `@${string}`;
    desiredCount?: boolean | `@${string}`;
    healthyCount?: boolean | `@${string}`;
    /** Unique ID for this deployment */
    id?: boolean | `@${string}`;
    inProgress?: boolean | `@${string}`;
    placedCount?: boolean | `@${string}`;
    promoted?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    successful?: boolean | `@${string}`;
    unhealthyCount?: boolean | `@${string}`;
    version?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DeploymentStrategy"]: DeploymentStrategy;
  /** Autogenerated input type of DetachPostgresCluster */
  ["DetachPostgresClusterInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The postgres cluster application id */
    postgresClusterAppId: string | Variable<any, string>;
    /** The application to detach postgres from */
    appId: string | Variable<any, string>;
    /** The postgres attachment id */
    postgresClusterAttachmentId?:
      | string
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Autogenerated return type of DetachPostgresCluster. */
  ["DetachPostgresClusterPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    postgresClusterApp?: ValueTypes["App"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DischargeRootToken */
  ["DischargeRootTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    rootToken: string | Variable<any, string>;
    organizationId: number | Variable<any, string>;
    expiry?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of DischargeRootToken. */
  ["DischargeRootTokenPayload"]: AliasType<{
    authToken?: boolean | `@${string}`;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Domain"]: AliasType<{
    autoRenew?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** The delegated nameservers for the registration */
    delegatedNameservers?: boolean | `@${string}`;
    dnsRecords?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["DNSRecordConnection"]];
    dnsStatus?: boolean | `@${string}`;
    expiresAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** The name for this domain */
    name?: boolean | `@${string}`;
    /** The organization that owns this domain */
    organization?: ValueTypes["Organization"];
    registrationStatus?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    /** The nameservers for the hosted zone */
    zoneNameservers?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Domain. */
  ["DomainConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["DomainEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["Domain"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DomainDNSStatus"]: DomainDNSStatus;
  /** An edge in a connection. */
  ["DomainEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["Domain"];
    __typename?: boolean | `@${string}`;
  }>;
  ["DomainRegistrationStatus"]: DomainRegistrationStatus;
  /** Autogenerated input type of DummyWireGuardPeer */
  ["DummyWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The region in which to deploy the peer */
    region?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of DummyWireGuardPeer. */
  ["DummyWireGuardPeerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    endpointip?: boolean | `@${string}`;
    localpub?: boolean | `@${string}`;
    peerip?: boolean | `@${string}`;
    privkey?: boolean | `@${string}`;
    pubkey?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["EmptyAppRole"]: AliasType<{
    /** The name of this role */
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of EnablePostgresConsul */
  ["EnablePostgresConsulInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId?: string | undefined | null | Variable<any, string>;
    region?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of EnablePostgresConsul. */
  ["EnablePostgresConsulPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    consulUrl?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of EnsureMachineRemoteBuilder */
  ["EnsureMachineRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The unique application name */
    appName?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId?: string | undefined | null | Variable<any, string>;
    /** Desired region for the remote builder */
    region?: string | undefined | null | Variable<any, string>;
    /** Use v2 machines */
    v2?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of EnsureMachineRemoteBuilder. */
  ["EnsureMachineRemoteBuilderPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ValueTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of EstablishSSHKey */
  ["EstablishSSHKeyInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** Establish a key even if one is already set */
    override?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of EstablishSSHKey. */
  ["EstablishSSHKeyPayload"]: AliasType<{
    certificate?: boolean | `@${string}`;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ExportDNSZone */
  ["ExportDNSZoneInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** ID of the domain to export */
    domainId: string | Variable<any, string>;
  };
  /** Autogenerated return type of ExportDNSZone. */
  ["ExportDNSZonePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    contents?: boolean | `@${string}`;
    domain?: ValueTypes["Domain"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ExtendVolume */
  ["ExtendVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the volume */
    volumeId: string | Variable<any, string>;
    /** The target volume size */
    sizeGb: number | Variable<any, string>;
  };
  /** Autogenerated return type of ExtendVolume. */
  ["ExtendVolumePayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    needsRestart?: boolean | `@${string}`;
    volume?: ValueTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of FinishBuild */
  ["FinishBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** Build id returned by createBuild() mutation */
    buildId: string | Variable<any, string>;
    /** The name of the app being built */
    appName: string | Variable<any, string>;
    /** The ID of the machine being built (only set for machine builds) */
    machineId?: string | undefined | null | Variable<any, string>;
    /** Indicate whether build completed or failed */
    status: string | Variable<any, string>;
    /** Build strategies attempted and their result, should be in order of attempt */
    strategiesAttempted?:
      | Array<ValueTypes["BuildStrategyAttemptInput"]>
      | undefined
      | null
      | Variable<any, string>;
    /** Metadata about the builder */
    builderMeta?:
      | ValueTypes["BuilderMetaInput"]
      | undefined
      | null
      | Variable<any, string>;
    /** Information about the docker image that was built */
    finalImage?:
      | ValueTypes["BuildFinalImageInput"]
      | undefined
      | null
      | Variable<any, string>;
    /** Timings for different phases of the build */
    timings?:
      | ValueTypes["BuildTimingsInput"]
      | undefined
      | null
      | Variable<any, string>;
    /** Log or error output */
    logs?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of FinishBuild. */
  ["FinishBuildPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** build id */
    id?: boolean | `@${string}`;
    /** stored build status */
    status?: boolean | `@${string}`;
    /** wall clock time for this build */
    wallclockTimeMs?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["FlyPlatform"]: AliasType<{
    /** Latest flyctl release details */
    flyctl?: ValueTypes["FlyctlRelease"];
    /** Fly global regions */
    regions?: ValueTypes["Region"];
    /** Region current request from */
    requestRegion?: boolean | `@${string}`;
    /** Available VM sizes */
    vmSizes?: ValueTypes["VMSize"];
    __typename?: boolean | `@${string}`;
  }>;
  ["FlyctlMachineHostAppRole"]: AliasType<{
    /** The name of this role */
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["FlyctlRelease"]: AliasType<{
    timestamp?: boolean | `@${string}`;
    version?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ForkVolume */
  ["ForkVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The application to attach the new volume to */
    appId: string | Variable<any, string>;
    /** The volume to fork */
    sourceVolId: string | Variable<any, string>;
    /** Volume name */
    name?: string | undefined | null | Variable<any, string>;
    /** Lock the new volume to only usable on machines */
    machinesOnly?: boolean | undefined | null | Variable<any, string>;
    /** Unique lock ID */
    lockId?: string | undefined | null | Variable<any, string>;
    /** Enables experimental cross-host volume forking */
    remote?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of ForkVolume. */
  ["ForkVolumePayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    volume?: ValueTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  ["FsTypeType"]: FsTypeType;
  ["GithubAppInstallation"]: AliasType<{
    editUrl?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    owner?: boolean | `@${string}`;
    repositories?: ValueTypes["GithubRepository"];
    __typename?: boolean | `@${string}`;
  }>;
  ["GithubIntegration"]: AliasType<{
    installationUrl?: boolean | `@${string}`;
    installations?: ValueTypes["GithubAppInstallation"];
    viewerAuthenticated?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["GithubRepository"]: AliasType<{
    fork?: boolean | `@${string}`;
    fullName?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    private?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of GrantPostgresClusterUserAccess */
  ["GrantPostgresClusterUserAccessInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The name of the postgres cluster app */
    appName: string | Variable<any, string>;
    /** The name of the database */
    username: string | Variable<any, string>;
    /** The database to grant access to */
    databaseName: string | Variable<any, string>;
  };
  /** Autogenerated return type of GrantPostgresClusterUserAccess. */
  ["GrantPostgresClusterUserAccessPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    database?: ValueTypes["PostgresClusterDatabase"];
    postgresClusterRole?: ValueTypes["PostgresClusterAppRole"];
    user?: ValueTypes["PostgresClusterUser"];
    __typename?: boolean | `@${string}`;
  }>;
  ["HTTPMethod"]: HTTPMethod;
  ["HTTPProtocol"]: HTTPProtocol;
  ["HealthCheck"]: AliasType<{
    /** Raw name of entity */
    entity?: boolean | `@${string}`;
    /** Time check last passed */
    lastPassing?: boolean | `@${string}`;
    /** Check name */
    name?: boolean | `@${string}`;
    /** Latest check output */
    output?: boolean | `@${string}`;
    /** Current check state */
    state?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for HealthCheck. */
  ["HealthCheckConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["HealthCheckEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["HealthCheck"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["HealthCheckEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["HealthCheck"];
    __typename?: boolean | `@${string}`;
  }>;
  ["HealthCheckHandler"]: AliasType<{
    /** Handler name */
    name?: boolean | `@${string}`;
    /** Handler type (Slack or Pagerduty) */
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for HealthCheckHandler. */
  ["HealthCheckHandlerConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["HealthCheckHandlerEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["HealthCheckHandler"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["HealthCheckHandlerEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["HealthCheckHandler"];
    __typename?: boolean | `@${string}`;
  }>;
  ["HerokuApp"]: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    releasedAt?: boolean | `@${string}`;
    stack?: boolean | `@${string}`;
    teamName?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["HerokuIntegration"]: AliasType<{
    herokuApps?: ValueTypes["HerokuApp"];
    viewerAuthenticated?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Host"]: AliasType<{
    id?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["HostnameCheck"]: AliasType<{
    aRecords?: boolean | `@${string}`;
    aaaaRecords?: boolean | `@${string}`;
    acmeDnsConfigured?: boolean | `@${string}`;
    caaRecords?: boolean | `@${string}`;
    cnameRecords?: boolean | `@${string}`;
    dnsConfigured?: boolean | `@${string}`;
    dnsProvider?: boolean | `@${string}`;
    dnsVerificationRecord?: boolean | `@${string}`;
    errors?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    isProxied?: boolean | `@${string}`;
    resolvedAddresses?: boolean | `@${string}`;
    soa?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["IPAddress"]: AliasType<{
    address?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for IPAddress. */
  ["IPAddressConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["IPAddressEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["IPAddress"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["IPAddressEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["IPAddress"];
    __typename?: boolean | `@${string}`;
  }>;
  ["IPAddressType"]: IPAddressType;
  /** An ISO 8601-encoded datetime */
  ["ISO8601DateTime"]: unknown;
  ["Image"]: AliasType<{
    absoluteRef?: boolean | `@${string}`;
    compressedSize?: boolean | `@${string}`;
    compressedSizeFull?: boolean | `@${string}`;
    config?: boolean | `@${string}`;
    configDigest?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    digest?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    label?: boolean | `@${string}`;
    manifest?: boolean | `@${string}`;
    ref?: boolean | `@${string}`;
    registry?: boolean | `@${string}`;
    repository?: boolean | `@${string}`;
    tag?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["ImageVersion"]: AliasType<{
    digest?: boolean | `@${string}`;
    registry?: boolean | `@${string}`;
    repository?: boolean | `@${string}`;
    tag?: boolean | `@${string}`;
    version?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of ImportCertificate. */
  ["ImportCertificatePayload"]: AliasType<{
    app?: ValueTypes["App"];
    appCertificate?: ValueTypes["AppCertificate"];
    certificate?: ValueTypes["Certificate"];
    errors?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ImportDNSZone */
  ["ImportDNSZoneInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** ID of the domain to export */
    domainId: string | Variable<any, string>;
    zonefile: string | Variable<any, string>;
  };
  /** Autogenerated return type of ImportDNSZone. */
  ["ImportDNSZonePayload"]: AliasType<{
    changes?: ValueTypes["DNSRecordDiff"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ValueTypes["Domain"];
    warnings?: ValueTypes["DNSRecordWarning"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of IssueCertificate */
  ["IssueCertificateInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The names of the apps this certificate will be limited to accessing */
    appNames?: Array<string> | undefined | null | Variable<any, string>;
    /** Hours for which certificate will be valid */
    validHours?: number | undefined | null | Variable<any, string>;
    /** SSH principals for certificate (e.g. ["fly", "root"]) */
    principals?: Array<string> | undefined | null | Variable<any, string>;
    /** The openssh-formatted ED25519 public key to issue the certificate for */
    publicKey?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of IssueCertificate. */
  ["IssueCertificatePayload"]: AliasType<{
    certificate?: boolean | `@${string}`;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** The private key, if a public_key wasn't specified */
    key?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Untyped JSON data */
  ["JSON"]: unknown;
  /** Autogenerated input type of KillMachine */
  ["KillMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId?: string | undefined | null | Variable<any, string>;
    /** machine id */
    id: string | Variable<any, string>;
  };
  /** Autogenerated return type of KillMachine. */
  ["KillMachinePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ValueTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of LaunchMachine */
  ["LaunchMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the machine */
    id?: string | undefined | null | Variable<any, string>;
    /** The name of the machine */
    name?: string | undefined | null | Variable<any, string>;
    /** Region for the machine */
    region?: string | undefined | null | Variable<any, string>;
    /** Configuration */
    config: ValueTypes["JSON"] | Variable<any, string>;
  };
  /** Autogenerated return type of LaunchMachine. */
  ["LaunchMachinePayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ValueTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  ["LimitedAccessToken"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    expiresAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    profile?: boolean | `@${string}`;
    token?: boolean | `@${string}`;
    tokenHeader?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for LimitedAccessToken. */
  ["LimitedAccessTokenConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["LimitedAccessTokenEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["LimitedAccessToken"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["LimitedAccessTokenEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["LimitedAccessToken"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of LockApp */
  ["LockAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
  };
  /** Autogenerated return type of LockApp. */
  ["LockAppPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** When this lock automatically expires */
    expiration?: boolean | `@${string}`;
    /** Unique lock ID */
    lockId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["LogEntry"]: AliasType<{
    id?: boolean | `@${string}`;
    instanceId?: boolean | `@${string}`;
    level?: boolean | `@${string}`;
    message?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of LogOut */
  ["LogOutInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of LogOut. */
  ["LogOutPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    ok?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["LoggedCertificate"]: AliasType<{
    cert?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    root?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for LoggedCertificate. */
  ["LoggedCertificateConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["LoggedCertificateEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["LoggedCertificate"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["LoggedCertificateEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["LoggedCertificate"];
    __typename?: boolean | `@${string}`;
  }>;
  ["Macaroon"]: AliasType<{
    /** URL for avatar or placeholder */
    avatarUrl?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** Email address for principal */
    email?: boolean | `@${string}`;
    featureFlags?: boolean | `@${string}`;
    hasNodeproxyApps?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    lastRegion?: boolean | `@${string}`;
    /** Display name of principal */
    name?: boolean | `@${string}`;
    organizations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["OrganizationConnection"]];
    personalOrganization?: ValueTypes["Organization"];
    trust?: boolean | `@${string}`;
    twoFactorProtection?: boolean | `@${string}`;
    username?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Machine"]: AliasType<{
    app?: ValueTypes["App"];
    config?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    events?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      kind?: string | undefined | null | Variable<any, string>;
    }, ValueTypes["MachineEventConnection"]];
    host?: ValueTypes["Host"];
    id?: boolean | `@${string}`;
    instanceId?: boolean | `@${string}`;
    ips?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["MachineIPConnection"]];
    name?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    state?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Machine. */
  ["MachineConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["MachineEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["Machine"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["MachineEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  /** A machine state change event */
  ["MachineEvent"]: AliasType<{
    id?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    ["...on MachineEventDestroy"]?: Omit<
      ValueTypes["MachineEventDestroy"],
      keyof ValueTypes["MachineEvent"]
    >;
    ["...on MachineEventExit"]?: Omit<
      ValueTypes["MachineEventExit"],
      keyof ValueTypes["MachineEvent"]
    >;
    ["...on MachineEventGeneric"]?: Omit<
      ValueTypes["MachineEventGeneric"],
      keyof ValueTypes["MachineEvent"]
    >;
    ["...on MachineEventStart"]?: Omit<
      ValueTypes["MachineEventStart"],
      keyof ValueTypes["MachineEvent"]
    >;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for MachineEvent. */
  ["MachineEventConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["MachineEventEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["MachineEvent"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    __typename?: boolean | `@${string}`;
  }>;
  ["MachineEventDestroy"]: AliasType<{
    id?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["MachineEventEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["MachineEvent"];
    __typename?: boolean | `@${string}`;
  }>;
  ["MachineEventExit"]: AliasType<{
    exitCode?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    metadata?: boolean | `@${string}`;
    oomKilled?: boolean | `@${string}`;
    requestedStop?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["MachineEventGeneric"]: AliasType<{
    id?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["MachineEventStart"]: AliasType<{
    id?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["MachineIP"]: AliasType<{
    family?: boolean | `@${string}`;
    /** ID of the object. */
    id?: boolean | `@${string}`;
    ip?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    maskSize?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for MachineIP. */
  ["MachineIPConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["MachineIPEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["MachineIP"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["MachineIPEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["MachineIP"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of MoveApp */
  ["MoveAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The application to move */
    appId: string | Variable<any, string>;
    /** The node ID of the organization to move the app to */
    organizationId: string | Variable<any, string>;
  };
  /** Autogenerated return type of MoveApp. */
  ["MoveAppPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Mutations"]: AliasType<{
    addCertificate?: [{
      /** The application to attach the new hostname to */
      appId: string | Variable<any, string>; /** Certificate's hostname */
      hostname: string | Variable<any, string>;
    }, ValueTypes["AddCertificatePayload"]];
    addWireGuardPeer?: [{
      /** Parameters for AddWireGuardPeer */
      input: ValueTypes["AddWireGuardPeerInput"] | Variable<any, string>;
    }, ValueTypes["AddWireGuardPeerPayload"]];
    allocateIpAddress?: [{
      /** Parameters for AllocateIPAddress */
      input: ValueTypes["AllocateIPAddressInput"] | Variable<any, string>;
    }, ValueTypes["AllocateIPAddressPayload"]];
    attachPostgresCluster?: [{
      /** Parameters for AttachPostgresCluster */
      input: ValueTypes["AttachPostgresClusterInput"] | Variable<any, string>;
    }, ValueTypes["AttachPostgresClusterPayload"]];
    cancelBuild?: [{
      /** The node ID of the build */
      buildId: string | Variable<any, string>;
    }, ValueTypes["CancelBuildPayload"]];
    checkCertificate?: [{
      /** Parameters for CheckCertificate */
      input: ValueTypes["CheckCertificateInput"] | Variable<any, string>;
    }, ValueTypes["CheckCertificatePayload"]];
    checkDomain?: [{
      /** Parameters for CheckDomain */
      input: ValueTypes["CheckDomainInput"] | Variable<any, string>;
    }, ValueTypes["CheckDomainPayload"]];
    configureRegions?: [{
      /** Parameters for ConfigureRegions */
      input: ValueTypes["ConfigureRegionsInput"] | Variable<any, string>;
    }, ValueTypes["ConfigureRegionsPayload"]];
    createAddOn?: [{
      /** Parameters for CreateAddOn */
      input: ValueTypes["CreateAddOnInput"] | Variable<any, string>;
    }, ValueTypes["CreateAddOnPayload"]];
    createAndRegisterDomain?: [{
      /** Parameters for CreateAndRegisterDomain */
      input: ValueTypes["CreateAndRegisterDomainInput"] | Variable<any, string>;
    }, ValueTypes["CreateAndRegisterDomainPayload"]];
    createAndTransferDomain?: [{
      /** Parameters for CreateAndTransferDomain */
      input: ValueTypes["CreateAndTransferDomainInput"] | Variable<any, string>;
    }, ValueTypes["CreateAndTransferDomainPayload"]];
    createApp?: [{
      /** Parameters for CreateApp */
      input: ValueTypes["CreateAppInput"] | Variable<any, string>;
    }, ValueTypes["CreateAppPayload"]];
    createBuild?: [{
      /** Parameters for CreateBuild */
      input: ValueTypes["CreateBuildInput"] | Variable<any, string>;
    }, ValueTypes["CreateBuildPayload"]];
    createCheckJob?: [{
      /** Parameters for CreateCheckJob */
      input: ValueTypes["CreateCheckJobInput"] | Variable<any, string>;
    }, ValueTypes["CreateCheckJobPayload"]];
    createCheckJobRun?: [{
      /** Parameters for CreateCheckJobRun */
      input: ValueTypes["CreateCheckJobRunInput"] | Variable<any, string>;
    }, ValueTypes["CreateCheckJobRunPayload"]];
    createDelegatedWireGuardToken?: [{
      /** Parameters for CreateDelegatedWireGuardToken */
      input:
        | ValueTypes["CreateDelegatedWireGuardTokenInput"]
        | Variable<any, string>;
    }, ValueTypes["CreateDelegatedWireGuardTokenPayload"]];
    createDnsPortal?: [{
      /** Parameters for CreateDNSPortal */
      input: ValueTypes["CreateDNSPortalInput"] | Variable<any, string>;
    }, ValueTypes["CreateDNSPortalPayload"]];
    createDnsPortalSession?: [{
      /** Parameters for CreateDNSPortalSession */
      input: ValueTypes["CreateDNSPortalSessionInput"] | Variable<any, string>;
    }, ValueTypes["CreateDNSPortalSessionPayload"]];
    createDnsRecord?: [{
      /** Parameters for CreateDNSRecord */
      input: ValueTypes["CreateDNSRecordInput"] | Variable<any, string>;
    }, ValueTypes["CreateDNSRecordPayload"]];
    createDoctorReport?: [{
      /** Parameters for CreateDoctorReport */
      input: ValueTypes["CreateDoctorReportInput"] | Variable<any, string>;
    }, ValueTypes["CreateDoctorReportPayload"]];
    createDoctorUrl?: ValueTypes["CreateDoctorUrlPayload"];
    createDomain?: [{
      /** Parameters for CreateDomain */
      input: ValueTypes["CreateDomainInput"] | Variable<any, string>;
    }, ValueTypes["CreateDomainPayload"]];
    createExtensionTosAgreement?: [{
      /** Parameters for CreateExtensionTosAgreement */
      input:
        | ValueTypes["CreateExtensionTosAgreementInput"]
        | Variable<any, string>;
    }, ValueTypes["CreateExtensionTosAgreementPayload"]];
    createLimitedAccessToken?: [{
      /** Parameters for CreateLimitedAccessToken */
      input:
        | ValueTypes["CreateLimitedAccessTokenInput"]
        | Variable<any, string>;
    }, ValueTypes["CreateLimitedAccessTokenPayload"]];
    createOrganization?: [{
      /** Parameters for CreateOrganization */
      input: ValueTypes["CreateOrganizationInput"] | Variable<any, string>;
    }, ValueTypes["CreateOrganizationPayload"]];
    createOrganizationInvitation?: [{
      /** Parameters for CreateOrganizationInvitation */
      input:
        | ValueTypes["CreateOrganizationInvitationInput"]
        | Variable<any, string>;
    }, ValueTypes["CreateOrganizationInvitationPayload"]];
    createPostgresClusterDatabase?: [{
      /** Parameters for CreatePostgresClusterDatabase */
      input:
        | ValueTypes["CreatePostgresClusterDatabaseInput"]
        | Variable<any, string>;
    }, ValueTypes["CreatePostgresClusterDatabasePayload"]];
    createPostgresClusterUser?: [{
      /** Parameters for CreatePostgresClusterUser */
      input:
        | ValueTypes["CreatePostgresClusterUserInput"]
        | Variable<any, string>;
    }, ValueTypes["CreatePostgresClusterUserPayload"]];
    createRelease?: [{
      /** Parameters for CreateRelease */
      input: ValueTypes["CreateReleaseInput"] | Variable<any, string>;
    }, ValueTypes["CreateReleasePayload"]];
    createTemplateDeployment?: [{
      /** Parameters for CreateTemplateDeployment */
      input:
        | ValueTypes["CreateTemplateDeploymentInput"]
        | Variable<any, string>;
    }, ValueTypes["CreateTemplateDeploymentPayload"]];
    createThirdPartyConfiguration?: [{
      /** Parameters for CreateThirdPartyConfiguration */
      input:
        | ValueTypes["CreateThirdPartyConfigurationInput"]
        | Variable<any, string>;
    }, ValueTypes["CreateThirdPartyConfigurationPayload"]];
    createVolume?: [{
      /** Parameters for CreateVolume */
      input: ValueTypes["CreateVolumeInput"] | Variable<any, string>;
    }, ValueTypes["CreateVolumePayload"]];
    createVolumeSnapshot?: [{
      /** Parameters for CreateVolumeSnapshot */
      input: ValueTypes["CreateVolumeSnapshotInput"] | Variable<any, string>;
    }, ValueTypes["CreateVolumeSnapshotPayload"]];
    deleteAddOn?: [{
      /** Parameters for DeleteAddOn */
      input: ValueTypes["DeleteAddOnInput"] | Variable<any, string>;
    }, ValueTypes["DeleteAddOnPayload"]];
    deleteApp?: [{
      /** The application to delete */
      appId: string | Variable<any, string>;
    }, ValueTypes["DeleteAppPayload"]];
    deleteCertificate?: [{
      /** Application to remove hostname from */
      appId:
        | string
        | Variable<any, string>; /** Certificate hostname to delete */
      hostname: string | Variable<any, string>;
    }, ValueTypes["DeleteCertificatePayload"]];
    deleteDelegatedWireGuardToken?: [{
      /** Parameters for DeleteDelegatedWireGuardToken */
      input:
        | ValueTypes["DeleteDelegatedWireGuardTokenInput"]
        | Variable<any, string>;
    }, ValueTypes["DeleteDelegatedWireGuardTokenPayload"]];
    deleteDeploymentSource?: [{
      /** Parameters for DeleteDeploymentSource */
      input: ValueTypes["DeleteDeploymentSourceInput"] | Variable<any, string>;
    }, ValueTypes["DeleteDeploymentSourcePayload"]];
    deleteDnsPortal?: [{
      /** Parameters for DeleteDNSPortal */
      input: ValueTypes["DeleteDNSPortalInput"] | Variable<any, string>;
    }, ValueTypes["DeleteDNSPortalPayload"]];
    deleteDnsPortalSession?: [{
      /** Parameters for DeleteDNSPortalSession */
      input: ValueTypes["DeleteDNSPortalSessionInput"] | Variable<any, string>;
    }, ValueTypes["DeleteDNSPortalSessionPayload"]];
    deleteDnsRecord?: [{
      /** Parameters for DeleteDNSRecord */
      input: ValueTypes["DeleteDNSRecordInput"] | Variable<any, string>;
    }, ValueTypes["DeleteDNSRecordPayload"]];
    deleteDomain?: [{
      /** Parameters for DeleteDomain */
      input: ValueTypes["DeleteDomainInput"] | Variable<any, string>;
    }, ValueTypes["DeleteDomainPayload"]];
    deleteHealthCheckHandler?: [{
      /** Parameters for DeleteHealthCheckHandler */
      input:
        | ValueTypes["DeleteHealthCheckHandlerInput"]
        | Variable<any, string>;
    }, ValueTypes["DeleteHealthCheckHandlerPayload"]];
    deleteLimitedAccessToken?: [{
      /** Parameters for DeleteLimitedAccessToken */
      input:
        | ValueTypes["DeleteLimitedAccessTokenInput"]
        | Variable<any, string>;
    }, ValueTypes["DeleteLimitedAccessTokenPayload"]];
    deleteOrganization?: [{
      /** Parameters for DeleteOrganization */
      input: ValueTypes["DeleteOrganizationInput"] | Variable<any, string>;
    }, ValueTypes["DeleteOrganizationPayload"]];
    deleteOrganizationInvitation?: [{
      /** Parameters for DeleteOrganizationInvitation */
      input:
        | ValueTypes["DeleteOrganizationInvitationInput"]
        | Variable<any, string>;
    }, ValueTypes["DeleteOrganizationInvitationPayload"]];
    deleteOrganizationMembership?: [{
      /** Parameters for DeleteOrganizationMembership */
      input:
        | ValueTypes["DeleteOrganizationMembershipInput"]
        | Variable<any, string>;
    }, ValueTypes["DeleteOrganizationMembershipPayload"]];
    deleteRemoteBuilder?: [{
      /** Parameters for DeleteRemoteBuilder */
      input: ValueTypes["DeleteRemoteBuilderInput"] | Variable<any, string>;
    }, ValueTypes["DeleteRemoteBuilderPayload"]];
    deleteThirdPartyConfiguration?: [{
      /** Parameters for DeleteThirdPartyConfiguration */
      input:
        | ValueTypes["DeleteThirdPartyConfigurationInput"]
        | Variable<any, string>;
    }, ValueTypes["DeleteThirdPartyConfigurationPayload"]];
    deleteVolume?: [{
      /** Parameters for DeleteVolume */
      input: ValueTypes["DeleteVolumeInput"] | Variable<any, string>;
    }, ValueTypes["DeleteVolumePayload"]];
    deployImage?: [{
      /** Parameters for DeployImage */
      input: ValueTypes["DeployImageInput"] | Variable<any, string>;
    }, ValueTypes["DeployImagePayload"]];
    detachPostgresCluster?: [{
      /** Parameters for DetachPostgresCluster */
      input: ValueTypes["DetachPostgresClusterInput"] | Variable<any, string>;
    }, ValueTypes["DetachPostgresClusterPayload"]];
    dischargeRootToken?: [{
      /** Parameters for DischargeRootToken */
      input: ValueTypes["DischargeRootTokenInput"] | Variable<any, string>;
    }, ValueTypes["DischargeRootTokenPayload"]];
    dummyWireGuardPeer?: [{
      /** Parameters for DummyWireGuardPeer */
      input: ValueTypes["DummyWireGuardPeerInput"] | Variable<any, string>;
    }, ValueTypes["DummyWireGuardPeerPayload"]];
    enablePostgresConsul?: [{
      /** Parameters for EnablePostgresConsul */
      input: ValueTypes["EnablePostgresConsulInput"] | Variable<any, string>;
    }, ValueTypes["EnablePostgresConsulPayload"]];
    ensureMachineRemoteBuilder?: [{
      /** Parameters for EnsureMachineRemoteBuilder */
      input:
        | ValueTypes["EnsureMachineRemoteBuilderInput"]
        | Variable<any, string>;
    }, ValueTypes["EnsureMachineRemoteBuilderPayload"]];
    establishSshKey?: [{
      /** Parameters for EstablishSSHKey */
      input: ValueTypes["EstablishSSHKeyInput"] | Variable<any, string>;
    }, ValueTypes["EstablishSSHKeyPayload"]];
    exportDnsZone?: [{
      /** Parameters for ExportDNSZone */
      input: ValueTypes["ExportDNSZoneInput"] | Variable<any, string>;
    }, ValueTypes["ExportDNSZonePayload"]];
    extendVolume?: [{
      /** Parameters for ExtendVolume */
      input: ValueTypes["ExtendVolumeInput"] | Variable<any, string>;
    }, ValueTypes["ExtendVolumePayload"]];
    finishBuild?: [{
      /** Parameters for FinishBuild */
      input: ValueTypes["FinishBuildInput"] | Variable<any, string>;
    }, ValueTypes["FinishBuildPayload"]];
    forkVolume?: [{
      /** Parameters for ForkVolume */
      input: ValueTypes["ForkVolumeInput"] | Variable<any, string>;
    }, ValueTypes["ForkVolumePayload"]];
    grantPostgresClusterUserAccess?: [{
      /** Parameters for GrantPostgresClusterUserAccess */
      input:
        | ValueTypes["GrantPostgresClusterUserAccessInput"]
        | Variable<any, string>;
    }, ValueTypes["GrantPostgresClusterUserAccessPayload"]];
    importCertificate?: [{
      /** The application to attach the new hostname to */
      appId: string | Variable<any, string>; /** Full chain for certificate */
      fullchain:
        | string
        | Variable<any, string>; /** Private signing key for certificate */
      privateKey:
        | string
        | Variable<
          any,
          string
        >; /** Hostname for certificate (certificate Common Name by default) */
      hostname?: string | undefined | null | Variable<any, string>;
    }, ValueTypes["ImportCertificatePayload"]];
    importDnsZone?: [{
      /** Parameters for ImportDNSZone */
      input: ValueTypes["ImportDNSZoneInput"] | Variable<any, string>;
    }, ValueTypes["ImportDNSZonePayload"]];
    issueCertificate?: [{
      /** Parameters for IssueCertificate */
      input: ValueTypes["IssueCertificateInput"] | Variable<any, string>;
    }, ValueTypes["IssueCertificatePayload"]];
    killMachine?: [{
      /** Parameters for KillMachine */
      input: ValueTypes["KillMachineInput"] | Variable<any, string>;
    }, ValueTypes["KillMachinePayload"]];
    launchMachine?: [{
      /** Parameters for LaunchMachine */
      input: ValueTypes["LaunchMachineInput"] | Variable<any, string>;
    }, ValueTypes["LaunchMachinePayload"]];
    lockApp?: [{
      /** Parameters for LockApp */
      input: ValueTypes["LockAppInput"] | Variable<any, string>;
    }, ValueTypes["LockAppPayload"]];
    logOut?: [{
      /** Parameters for LogOut */
      input: ValueTypes["LogOutInput"] | Variable<any, string>;
    }, ValueTypes["LogOutPayload"]];
    moveApp?: [{
      /** Parameters for MoveApp */
      input: ValueTypes["MoveAppInput"] | Variable<any, string>;
    }, ValueTypes["MoveAppPayload"]];
    nomadToMachinesMigration?: [{
      /** Parameters for NomadToMachinesMigration */
      input:
        | ValueTypes["NomadToMachinesMigrationInput"]
        | Variable<any, string>;
    }, ValueTypes["NomadToMachinesMigrationPayload"]];
    nomadToMachinesMigrationPrep?: [{
      /** Parameters for NomadToMachinesMigrationPrep */
      input:
        | ValueTypes["NomadToMachinesMigrationPrepInput"]
        | Variable<any, string>;
    }, ValueTypes["NomadToMachinesMigrationPrepPayload"]];
    pauseApp?: [{
      /** Parameters for PauseApp */
      input: ValueTypes["PauseAppInput"] | Variable<any, string>;
    }, ValueTypes["PauseAppPayload"]];
    registerDomain?: [{
      /** Parameters for RegisterDomain */
      input: ValueTypes["RegisterDomainInput"] | Variable<any, string>;
    }, ValueTypes["RegisterDomainPayload"]];
    releaseIpAddress?: [{
      /** Parameters for ReleaseIPAddress */
      input: ValueTypes["ReleaseIPAddressInput"] | Variable<any, string>;
    }, ValueTypes["ReleaseIPAddressPayload"]];
    removeMachine?: [{
      /** Parameters for RemoveMachine */
      input: ValueTypes["RemoveMachineInput"] | Variable<any, string>;
    }, ValueTypes["RemoveMachinePayload"]];
    removeWireGuardPeer?: [{
      /** Parameters for RemoveWireGuardPeer */
      input: ValueTypes["RemoveWireGuardPeerInput"] | Variable<any, string>;
    }, ValueTypes["RemoveWireGuardPeerPayload"]];
    resetAddOnPassword?: [{
      /** Parameters for ResetAddOnPassword */
      input: ValueTypes["ResetAddOnPasswordInput"] | Variable<any, string>;
    }, ValueTypes["ResetAddOnPasswordPayload"]];
    restartAllocation?: [{
      /** Parameters for RestartAllocation */
      input: ValueTypes["RestartAllocationInput"] | Variable<any, string>;
    }, ValueTypes["RestartAllocationPayload"]];
    restartApp?: [{
      /** Parameters for RestartApp */
      input: ValueTypes["RestartAppInput"] | Variable<any, string>;
    }, ValueTypes["RestartAppPayload"]];
    restoreVolumeSnapshot?: [{
      /** Parameters for RestoreVolumeSnapshot */
      input: ValueTypes["RestoreVolumeSnapshotInput"] | Variable<any, string>;
    }, ValueTypes["RestoreVolumeSnapshotPayload"]];
    resumeApp?: [{
      /** Parameters for ResumeApp */
      input: ValueTypes["ResumeAppInput"] | Variable<any, string>;
    }, ValueTypes["ResumeAppPayload"]];
    revokePostgresClusterUserAccess?: [{
      /** Parameters for RevokePostgresClusterUserAccess */
      input:
        | ValueTypes["RevokePostgresClusterUserAccessInput"]
        | Variable<any, string>;
    }, ValueTypes["RevokePostgresClusterUserAccessPayload"]];
    saveDeploymentSource?: [{
      /** Parameters for SaveDeploymentSource */
      input: ValueTypes["SaveDeploymentSourceInput"] | Variable<any, string>;
    }, ValueTypes["SaveDeploymentSourcePayload"]];
    scaleApp?: [{
      /** Parameters for ScaleApp */
      input: ValueTypes["ScaleAppInput"] | Variable<any, string>;
    }, ValueTypes["ScaleAppPayload"]];
    setAppsV2DefaultOn?: [{
      /** Parameters for SetAppsv2DefaultOn */
      input: ValueTypes["SetAppsv2DefaultOnInput"] | Variable<any, string>;
    }, ValueTypes["SetAppsv2DefaultOnPayload"]];
    setPagerdutyHandler?: [{
      /** Parameters for SetPagerdutyHandler */
      input: ValueTypes["SetPagerdutyHandlerInput"] | Variable<any, string>;
    }, ValueTypes["SetPagerdutyHandlerPayload"]];
    setPlatformVersion?: [{
      /** Parameters for SetPlatformVersion */
      input: ValueTypes["SetPlatformVersionInput"] | Variable<any, string>;
    }, ValueTypes["SetPlatformVersionPayload"]];
    setSecrets?: [{
      /** Parameters for SetSecrets */
      input: ValueTypes["SetSecretsInput"] | Variable<any, string>;
    }, ValueTypes["SetSecretsPayload"]];
    setSlackHandler?: [{
      /** Parameters for SetSlackHandler */
      input: ValueTypes["SetSlackHandlerInput"] | Variable<any, string>;
    }, ValueTypes["SetSlackHandlerPayload"]];
    setVmCount?: [{
      /** Parameters for SetVMCount */
      input: ValueTypes["SetVMCountInput"] | Variable<any, string>;
    }, ValueTypes["SetVMCountPayload"]];
    setVmSize?: [{
      /** Parameters for SetVMSize */
      input: ValueTypes["SetVMSizeInput"] | Variable<any, string>;
    }, ValueTypes["SetVMSizePayload"]];
    startBuild?: [{
      /** Parameters for StartBuild */
      input: ValueTypes["StartBuildInput"] | Variable<any, string>;
    }, ValueTypes["StartBuildPayload"]];
    startMachine?: [{
      /** Parameters for StartMachine */
      input: ValueTypes["StartMachineInput"] | Variable<any, string>;
    }, ValueTypes["StartMachinePayload"]];
    stopAllocation?: [{
      /** Parameters for StopAllocation */
      input: ValueTypes["StopAllocationInput"] | Variable<any, string>;
    }, ValueTypes["StopAllocationPayload"]];
    stopMachine?: [{
      /** Parameters for StopMachine */
      input: ValueTypes["StopMachineInput"] | Variable<any, string>;
    }, ValueTypes["StopMachinePayload"]];
    unlockApp?: [{
      /** Parameters for UnlockApp */
      input: ValueTypes["UnlockAppInput"] | Variable<any, string>;
    }, ValueTypes["UnlockAppPayload"]];
    unsetSecrets?: [{
      /** Parameters for UnsetSecrets */
      input: ValueTypes["UnsetSecretsInput"] | Variable<any, string>;
    }, ValueTypes["UnsetSecretsPayload"]];
    updateAddOn?: [{
      /** Parameters for UpdateAddOn */
      input: ValueTypes["UpdateAddOnInput"] | Variable<any, string>;
    }, ValueTypes["UpdateAddOnPayload"]];
    updateAutoscaleConfig?: [{
      /** Parameters for UpdateAutoscaleConfig */
      input: ValueTypes["UpdateAutoscaleConfigInput"] | Variable<any, string>;
    }, ValueTypes["UpdateAutoscaleConfigPayload"]];
    updateDnsPortal?: [{
      /** Parameters for UpdateDNSPortal */
      input: ValueTypes["UpdateDNSPortalInput"] | Variable<any, string>;
    }, ValueTypes["UpdateDNSPortalPayload"]];
    updateDnsRecord?: [{
      /** Parameters for UpdateDNSRecord */
      input: ValueTypes["UpdateDNSRecordInput"] | Variable<any, string>;
    }, ValueTypes["UpdateDNSRecordPayload"]];
    updateDnsRecords?: [{
      /** Parameters for UpdateDNSRecords */
      input: ValueTypes["UpdateDNSRecordsInput"] | Variable<any, string>;
    }, ValueTypes["UpdateDNSRecordsPayload"]];
    updateOrganizationMembership?: [{
      /** Parameters for UpdateOrganizationMembership */
      input:
        | ValueTypes["UpdateOrganizationMembershipInput"]
        | Variable<any, string>;
    }, ValueTypes["UpdateOrganizationMembershipPayload"]];
    updateRelease?: [{
      /** Parameters for UpdateRelease */
      input: ValueTypes["UpdateReleaseInput"] | Variable<any, string>;
    }, ValueTypes["UpdateReleasePayload"]];
    updateRemoteBuilder?: [{
      /** Parameters for UpdateRemoteBuilder */
      input: ValueTypes["UpdateRemoteBuilderInput"] | Variable<any, string>;
    }, ValueTypes["UpdateRemoteBuilderPayload"]];
    updateThirdPartyConfiguration?: [{
      /** Parameters for UpdateThirdPartyConfiguration */
      input:
        | ValueTypes["UpdateThirdPartyConfigurationInput"]
        | Variable<any, string>;
    }, ValueTypes["UpdateThirdPartyConfigurationPayload"]];
    validateWireGuardPeers?: [{
      /** Parameters for ValidateWireGuardPeers */
      input: ValueTypes["ValidateWireGuardPeersInput"] | Variable<any, string>;
    }, ValueTypes["ValidateWireGuardPeersPayload"]];
    __typename?: boolean | `@${string}`;
  }>;
  /** An object with an ID. */
  ["Node"]: AliasType<{
    /** ID of the object. */
    id?: boolean | `@${string}`;
    ["...on AccessToken"]?: Omit<
      ValueTypes["AccessToken"],
      keyof ValueTypes["Node"]
    >;
    ["...on AddOn"]?: Omit<ValueTypes["AddOn"], keyof ValueTypes["Node"]>;
    ["...on AddOnPlan"]?: Omit<
      ValueTypes["AddOnPlan"],
      keyof ValueTypes["Node"]
    >;
    ["...on Allocation"]?: Omit<
      ValueTypes["Allocation"],
      keyof ValueTypes["Node"]
    >;
    ["...on App"]?: Omit<ValueTypes["App"], keyof ValueTypes["Node"]>;
    ["...on AppCertificate"]?: Omit<
      ValueTypes["AppCertificate"],
      keyof ValueTypes["Node"]
    >;
    ["...on AppChange"]?: Omit<
      ValueTypes["AppChange"],
      keyof ValueTypes["Node"]
    >;
    ["...on Build"]?: Omit<ValueTypes["Build"], keyof ValueTypes["Node"]>;
    ["...on Certificate"]?: Omit<
      ValueTypes["Certificate"],
      keyof ValueTypes["Node"]
    >;
    ["...on CheckHTTPResponse"]?: Omit<
      ValueTypes["CheckHTTPResponse"],
      keyof ValueTypes["Node"]
    >;
    ["...on CheckJob"]?: Omit<ValueTypes["CheckJob"], keyof ValueTypes["Node"]>;
    ["...on CheckJobRun"]?: Omit<
      ValueTypes["CheckJobRun"],
      keyof ValueTypes["Node"]
    >;
    ["...on DNSPortal"]?: Omit<
      ValueTypes["DNSPortal"],
      keyof ValueTypes["Node"]
    >;
    ["...on DNSPortalSession"]?: Omit<
      ValueTypes["DNSPortalSession"],
      keyof ValueTypes["Node"]
    >;
    ["...on DNSRecord"]?: Omit<
      ValueTypes["DNSRecord"],
      keyof ValueTypes["Node"]
    >;
    ["...on DelegatedWireGuardToken"]?: Omit<
      ValueTypes["DelegatedWireGuardToken"],
      keyof ValueTypes["Node"]
    >;
    ["...on Domain"]?: Omit<ValueTypes["Domain"], keyof ValueTypes["Node"]>;
    ["...on Host"]?: Omit<ValueTypes["Host"], keyof ValueTypes["Node"]>;
    ["...on IPAddress"]?: Omit<
      ValueTypes["IPAddress"],
      keyof ValueTypes["Node"]
    >;
    ["...on LimitedAccessToken"]?: Omit<
      ValueTypes["LimitedAccessToken"],
      keyof ValueTypes["Node"]
    >;
    ["...on LoggedCertificate"]?: Omit<
      ValueTypes["LoggedCertificate"],
      keyof ValueTypes["Node"]
    >;
    ["...on Machine"]?: Omit<ValueTypes["Machine"], keyof ValueTypes["Node"]>;
    ["...on MachineIP"]?: Omit<
      ValueTypes["MachineIP"],
      keyof ValueTypes["Node"]
    >;
    ["...on Organization"]?: Omit<
      ValueTypes["Organization"],
      keyof ValueTypes["Node"]
    >;
    ["...on OrganizationInvitation"]?: Omit<
      ValueTypes["OrganizationInvitation"],
      keyof ValueTypes["Node"]
    >;
    ["...on PostgresClusterAttachment"]?: Omit<
      ValueTypes["PostgresClusterAttachment"],
      keyof ValueTypes["Node"]
    >;
    ["...on Release"]?: Omit<ValueTypes["Release"], keyof ValueTypes["Node"]>;
    ["...on ReleaseCommand"]?: Omit<
      ValueTypes["ReleaseCommand"],
      keyof ValueTypes["Node"]
    >;
    ["...on ReleaseUnprocessed"]?: Omit<
      ValueTypes["ReleaseUnprocessed"],
      keyof ValueTypes["Node"]
    >;
    ["...on Secret"]?: Omit<ValueTypes["Secret"], keyof ValueTypes["Node"]>;
    ["...on TemplateDeployment"]?: Omit<
      ValueTypes["TemplateDeployment"],
      keyof ValueTypes["Node"]
    >;
    ["...on ThirdPartyConfiguration"]?: Omit<
      ValueTypes["ThirdPartyConfiguration"],
      keyof ValueTypes["Node"]
    >;
    ["...on User"]?: Omit<ValueTypes["User"], keyof ValueTypes["Node"]>;
    ["...on UserCoupon"]?: Omit<
      ValueTypes["UserCoupon"],
      keyof ValueTypes["Node"]
    >;
    ["...on VM"]?: Omit<ValueTypes["VM"], keyof ValueTypes["Node"]>;
    ["...on Volume"]?: Omit<ValueTypes["Volume"], keyof ValueTypes["Node"]>;
    ["...on VolumeSnapshot"]?: Omit<
      ValueTypes["VolumeSnapshot"],
      keyof ValueTypes["Node"]
    >;
    ["...on WireGuardPeer"]?: Omit<
      ValueTypes["WireGuardPeer"],
      keyof ValueTypes["Node"]
    >;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of NomadToMachinesMigration */
  ["NomadToMachinesMigrationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The application to move */
    appId: string | Variable<any, string>;
  };
  /** Autogenerated return type of NomadToMachinesMigration. */
  ["NomadToMachinesMigrationPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of NomadToMachinesMigrationPrep */
  ["NomadToMachinesMigrationPrepInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The application to move */
    appId: string | Variable<any, string>;
  };
  /** Autogenerated return type of NomadToMachinesMigrationPrep. */
  ["NomadToMachinesMigrationPrepPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Organization"]: AliasType<{
    activeDiscountName?: boolean | `@${string}`;
    /** Single sign-on link for the given integration type */
    addOnSsoLink?: boolean | `@${string}`;
    addOns?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      type?: ValueTypes["AddOnType"] | undefined | null | Variable<any, string>;
    }, ValueTypes["AddOnConnection"]];
    agreedToProviderTos?: [
      { providerName: string | Variable<any, string> },
      boolean | `@${string}`,
    ];
    apps?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["AppConnection"]];
    billable?: boolean | `@${string}`;
    billingStatus?: boolean | `@${string}`;
    /** The account credits in cents */
    creditBalance?: boolean | `@${string}`;
    /** The formatted account credits */
    creditBalanceFormatted?: boolean | `@${string}`;
    delegatedWireGuardTokens?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["DelegatedWireGuardTokenConnection"]];
    dnsPortal?: [
      { name: string | Variable<any, string> },
      ValueTypes["DNSPortal"],
    ];
    dnsPortals?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["DNSPortalConnection"]];
    domain?: [{ name: string | Variable<any, string> }, ValueTypes["Domain"]];
    domains?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["DomainConnection"]];
    extensionSsoLink?: [
      { provider: string | Variable<any, string> },
      boolean | `@${string}`,
    ];
    healthCheckHandlers?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["HealthCheckHandlerConnection"]];
    healthChecks?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["HealthCheckConnection"]];
    id?: boolean | `@${string}`;
    internalNumericId?: boolean | `@${string}`;
    invitations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["OrganizationInvitationConnection"]];
    isCreditCardSaved?: boolean | `@${string}`;
    limitedAccessTokens?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["LimitedAccessTokenConnection"]];
    loggedCertificates?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["LoggedCertificateConnection"]];
    members?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["OrganizationMembershipsConnection"]];
    /** Organization name */
    name?: boolean | `@${string}`;
    paidPlan?: boolean | `@${string}`;
    /** Whether the organization can provision beta extensions */
    provisionsBetaExtensions?: boolean | `@${string}`;
    /** Unmodified unique org slug */
    rawSlug?: boolean | `@${string}`;
    remoteBuilderApp?: ValueTypes["App"];
    remoteBuilderImage?: boolean | `@${string}`;
    settings?: boolean | `@${string}`;
    /** Unique organization slug */
    slug?: boolean | `@${string}`;
    sshCertificate?: boolean | `@${string}`;
    thirdPartyConfigurations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["ThirdPartyConfigurationConnection"]];
    trust?: boolean | `@${string}`;
    /** The type of organization */
    type?: boolean | `@${string}`;
    /** The current user's role in the org */
    viewerRole?: boolean | `@${string}`;
    wireGuardPeer?: [
      { name: string | Variable<any, string> },
      ValueTypes["WireGuardPeer"],
    ];
    wireGuardPeers?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["WireGuardPeerConnection"]];
    __typename?: boolean | `@${string}`;
  }>;
  ["OrganizationAlertsEnabled"]: OrganizationAlertsEnabled;
  /** The connection type for Organization. */
  ["OrganizationConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["OrganizationEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["Organization"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["OrganizationEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  ["OrganizationInvitation"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    email?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** The user who created the invitation */
    inviter?: ValueTypes["User"];
    organization?: ValueTypes["Organization"];
    redeemed?: boolean | `@${string}`;
    redeemedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for OrganizationInvitation. */
  ["OrganizationInvitationConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["OrganizationInvitationEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["OrganizationInvitation"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["OrganizationInvitationEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["OrganizationInvitation"];
    __typename?: boolean | `@${string}`;
  }>;
  ["OrganizationMemberRole"]: OrganizationMemberRole;
  /** The connection type for User. */
  ["OrganizationMembershipsConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["OrganizationMembershipsEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["User"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["OrganizationMembershipsEdge"]: AliasType<{
    /** The alerts settings the user has in this organization */
    alertsEnabled?: boolean | `@${string}`;
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The date the user joined the organization */
    joinedAt?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["User"];
    /** The role the user has in this organization */
    role?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["OrganizationTrust"]: OrganizationTrust;
  ["OrganizationType"]: OrganizationType;
  /** Information about pagination in a connection. */
  ["PageInfo"]: AliasType<{
    /** When paginating forwards, the cursor to continue. */
    endCursor?: boolean | `@${string}`;
    /** When paginating forwards, are there more items? */
    hasNextPage?: boolean | `@${string}`;
    /** When paginating backwards, are there more items? */
    hasPreviousPage?: boolean | `@${string}`;
    /** When paginating backwards, the cursor to continue. */
    startCursor?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of PauseApp */
  ["PauseAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
  };
  /** Autogenerated return type of PauseApp. */
  ["PauseAppPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["PlatformVersionEnum"]: PlatformVersionEnum;
  ["PostgresClusterAppRole"]: AliasType<{
    databases?: ValueTypes["PostgresClusterDatabase"];
    /** The name of this role */
    name?: boolean | `@${string}`;
    users?: ValueTypes["PostgresClusterUser"];
    __typename?: boolean | `@${string}`;
  }>;
  ["PostgresClusterAttachment"]: AliasType<{
    databaseName?: boolean | `@${string}`;
    databaseUser?: boolean | `@${string}`;
    environmentVariableName?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for PostgresClusterAttachment. */
  ["PostgresClusterAttachmentConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["PostgresClusterAttachmentEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["PostgresClusterAttachment"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["PostgresClusterAttachmentEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["PostgresClusterAttachment"];
    __typename?: boolean | `@${string}`;
  }>;
  ["PostgresClusterDatabase"]: AliasType<{
    name?: boolean | `@${string}`;
    users?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["PostgresClusterUser"]: AliasType<{
    databases?: boolean | `@${string}`;
    isSuperuser?: boolean | `@${string}`;
    username?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["PriceTier"]: AliasType<{
    unitAmount?: boolean | `@${string}`;
    upTo?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Principal"]: AliasType<{
    /** URL for avatar or placeholder */
    avatarUrl?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** Email address for principal */
    email?: boolean | `@${string}`;
    featureFlags?: boolean | `@${string}`;
    hasNodeproxyApps?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    lastRegion?: boolean | `@${string}`;
    /** Display name of principal */
    name?: boolean | `@${string}`;
    organizations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["OrganizationConnection"]];
    personalOrganization?: ValueTypes["Organization"];
    trust?: boolean | `@${string}`;
    twoFactorProtection?: boolean | `@${string}`;
    username?: boolean | `@${string}`;
    ["...on Macaroon"]?: Omit<
      ValueTypes["Macaroon"],
      keyof ValueTypes["Principal"]
    >;
    ["...on User"]?: Omit<ValueTypes["User"], keyof ValueTypes["Principal"]>;
    __typename?: boolean | `@${string}`;
  }>;
  ["ProcessGroup"]: AliasType<{
    maxPerRegion?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    regions?: boolean | `@${string}`;
    vmSize?: ValueTypes["VMSize"];
    __typename?: boolean | `@${string}`;
  }>;
  ["Product"]: AliasType<{
    name?: boolean | `@${string}`;
    tiers?: ValueTypes["PriceTier"];
    type?: boolean | `@${string}`;
    unitLabel?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["PropertyInput"]: {
    /** The name of the property */
    name: string | Variable<any, string>;
    /** The value of the property */
    value?: string | undefined | null | Variable<any, string>;
  };
  ["Queries"]: AliasType<{
    accessTokens?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      type?:
        | ValueTypes["AccessTokenType"]
        | undefined
        | null
        | Variable<any, string>;
    }, ValueTypes["AccessTokenConnection"]];
    addOn?: [
      {
        id?: string | undefined | null | Variable<any, string>;
        name?: string | undefined | null | Variable<any, string>;
      },
      ValueTypes["AddOn"],
    ];
    addOnPlans?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["AddOnPlanConnection"]];
    addOnProvider?: [
      { name: string | Variable<any, string> },
      ValueTypes["AddOnProvider"],
    ];
    addOns?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      type?: ValueTypes["AddOnType"] | undefined | null | Variable<any, string>;
    }, ValueTypes["AddOnConnection"]];
    app?: [
      {
        name?: string | undefined | null | Variable<any, string>;
        internalId?: string | undefined | null | Variable<any, string>;
      },
      ValueTypes["App"],
    ];
    apps?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      active?: boolean | undefined | null | Variable<any, string>;
      role?: string | undefined | null | Variable<any, string>;
      platform?: string | undefined | null | Variable<any, string>;
      organizationId?: string | undefined | null | Variable<any, string>;
    }, ValueTypes["AppConnection"]];
    canPerformBluegreenDeployment?: [{
      /** The name of the app */
      name: string | Variable<any, string>;
    }, boolean | `@${string}`];
    certificate?: [
      { id: string | Variable<any, string> },
      ValueTypes["AppCertificate"],
    ];
    checkJobs?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["CheckJobConnection"]];
    checkLocations?: ValueTypes["CheckLocation"];
    currentUser?: ValueTypes["User"];
    domain?: [{ name: string | Variable<any, string> }, ValueTypes["Domain"]];
    githubIntegration?: ValueTypes["GithubIntegration"];
    herokuIntegration?: ValueTypes["HerokuIntegration"];
    ipAddress?: [
      { id: string | Variable<any, string> },
      ValueTypes["IPAddress"],
    ];
    latestImageDetails?: [{
      /** <repositry>/<name>:<tag> */
      image: string | Variable<any, string>;
    }, ValueTypes["ImageVersion"]];
    latestImageTag?: [
      {
        repository: string | Variable<any, string>;
        snapshotId?: string | undefined | null | Variable<any, string>;
      },
      boolean | `@${string}`,
    ];
    machine?: [
      { machineId: string | Variable<any, string> },
      ValueTypes["Machine"],
    ];
    machines?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      appId?: string | undefined | null | Variable<any, string>;
      state?: string | undefined | null | Variable<any, string>;
      version?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["MachineConnection"]];
    nearestRegion?: [
      { wireguardGateway?: boolean | undefined | null | Variable<any, string> },
      ValueTypes["Region"],
    ];
    node?: [{
      /** ID of the object. */
      id: string | Variable<any, string>;
    }, ValueTypes["Node"]];
    nodes?: [{
      /** IDs of the objects. */
      ids: Array<string> | Variable<any, string>;
    }, ValueTypes["Node"]];
    organization?: [
      {
        id?: string | undefined | null | Variable<any, string>;
        name?: string | undefined | null | Variable<any, string>;
        slug?: string | undefined | null | Variable<any, string>;
      },
      ValueTypes["Organization"],
    ];
    organizations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      withBillingIssuesOnly?:
        | boolean
        | undefined
        | null
        | Variable<any, string>;
      admin?: boolean | undefined | null | Variable<any, string>;
      type?:
        | ValueTypes["OrganizationType"]
        | undefined
        | null
        | Variable<any, string>;
    }, ValueTypes["OrganizationConnection"]];
    personalOrganization?: ValueTypes["Organization"];
    /** fly.io platform information */
    platform?: ValueTypes["FlyPlatform"];
    postgresAttachments?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
      appName?: string | undefined | null | Variable<any, string>;
      postgresAppName: string | Variable<any, string>;
    }, ValueTypes["PostgresClusterAttachmentConnection"]];
    /** Fly.io product and price information */
    products?: ValueTypes["Product"];
    /** Whether the authentication token only allows for user access */
    userOnlyToken?: boolean | `@${string}`;
    validateConfig?: [
      { definition: ValueTypes["JSON"] | Variable<any, string> },
      ValueTypes["AppConfig"],
    ];
    viewer?: ValueTypes["Principal"];
    volume?: [{ id: string | Variable<any, string> }, ValueTypes["Volume"]];
    __typename?: boolean | `@${string}`;
  }>;
  ["Region"]: AliasType<{
    /** The IATA airport code for this region */
    code?: boolean | `@${string}`;
    gatewayAvailable?: boolean | `@${string}`;
    /** The latitude of this region */
    latitude?: boolean | `@${string}`;
    /** The longitude of this region */
    longitude?: boolean | `@${string}`;
    /** The name of this region */
    name?: boolean | `@${string}`;
    processGroup?: boolean | `@${string}`;
    requiresPaidPlan?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["RegionPlacement"]: AliasType<{
    /** The desired number of allocations */
    count?: boolean | `@${string}`;
    /** The region code */
    region?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RegisterDomain */
  ["RegisterDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the domain */
    domainId: string | Variable<any, string>;
    /** Enable whois privacy on the registration */
    whoisPrivacy?: boolean | undefined | null | Variable<any, string>;
    /** Enable auto renew on the registration */
    autoRenew?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of RegisterDomain. */
  ["RegisterDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ValueTypes["Domain"];
    __typename?: boolean | `@${string}`;
  }>;
  ["Release"]: AliasType<{
    config?: ValueTypes["AppConfig"];
    createdAt?: boolean | `@${string}`;
    deploymentStrategy?: boolean | `@${string}`;
    /** A description of the release */
    description?: boolean | `@${string}`;
    evaluationId?: boolean | `@${string}`;
    /** Unique ID */
    id?: boolean | `@${string}`;
    /** Docker image */
    image?: ValueTypes["Image"];
    /** Docker image URI */
    imageRef?: boolean | `@${string}`;
    inProgress?: boolean | `@${string}`;
    /** The reason for the release */
    reason?: boolean | `@${string}`;
    /** Version release reverted to */
    revertedTo?: boolean | `@${string}`;
    stable?: boolean | `@${string}`;
    /** The status of the release */
    status?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    /** The user who created the release */
    user?: ValueTypes["User"];
    /** The version of the release */
    version?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["ReleaseCommand"]: AliasType<{
    app?: ValueTypes["App"];
    command?: boolean | `@${string}`;
    evaluationId?: boolean | `@${string}`;
    exitCode?: boolean | `@${string}`;
    failed?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    inProgress?: boolean | `@${string}`;
    instanceId?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    succeeded?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Release. */
  ["ReleaseConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["ReleaseEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["Release"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["ReleaseEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["Release"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ReleaseIPAddress */
  ["ReleaseIPAddressInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId?: string | undefined | null | Variable<any, string>;
    /** The id of the ip address to release */
    ipAddressId?: string | undefined | null | Variable<any, string>;
    ip?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of ReleaseIPAddress. */
  ["ReleaseIPAddressPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["ReleaseUnprocessed"]: AliasType<{
    configDefinition?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    deploymentStrategy?: boolean | `@${string}`;
    /** A description of the release */
    description?: boolean | `@${string}`;
    evaluationId?: boolean | `@${string}`;
    /** Unique ID */
    id?: boolean | `@${string}`;
    /** Docker image */
    image?: ValueTypes["Image"];
    /** Docker image URI */
    imageRef?: boolean | `@${string}`;
    inProgress?: boolean | `@${string}`;
    /** The reason for the release */
    reason?: boolean | `@${string}`;
    /** Version release reverted to */
    revertedTo?: boolean | `@${string}`;
    stable?: boolean | `@${string}`;
    /** The status of the release */
    status?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    /** The user who created the release */
    user?: ValueTypes["User"];
    /** The version of the release */
    version?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for ReleaseUnprocessed. */
  ["ReleaseUnprocessedConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["ReleaseUnprocessedEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["ReleaseUnprocessed"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["ReleaseUnprocessedEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["ReleaseUnprocessed"];
    __typename?: boolean | `@${string}`;
  }>;
  ["RemoteDockerBuilderAppRole"]: AliasType<{
    /** The name of this role */
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RemoveMachine */
  ["RemoveMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId?: string | undefined | null | Variable<any, string>;
    /** machine id */
    id: string | Variable<any, string>;
    /** force kill machine if it's running */
    kill?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of RemoveMachine. */
  ["RemoveMachinePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ValueTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RemoveWireGuardPeer */
  ["RemoveWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The name of the peer to remove */
    name: string | Variable<any, string>;
    /** Add via NATS transaction (for testing only, nosy users) */
    nats?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of RemoveWireGuardPeer. */
  ["RemoveWireGuardPeerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** The organization that owned the peer */
    organization?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ResetAddOnPassword */
  ["ResetAddOnPasswordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the add-on whose password should be reset */
    name: string | Variable<any, string>;
  };
  /** Autogenerated return type of ResetAddOnPassword. */
  ["ResetAddOnPasswordPayload"]: AliasType<{
    addOn?: ValueTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RestartAllocation */
  ["RestartAllocationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** The ID of the app */
    allocId: string | Variable<any, string>;
  };
  /** Autogenerated return type of RestartAllocation. */
  ["RestartAllocationPayload"]: AliasType<{
    allocation?: ValueTypes["Allocation"];
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RestartApp */
  ["RestartAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
  };
  /** Autogenerated return type of RestartApp. */
  ["RestartAppPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RestoreVolumeSnapshot */
  ["RestoreVolumeSnapshotInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    volumeId: string | Variable<any, string>;
    snapshotId: string | Variable<any, string>;
  };
  /** Autogenerated return type of RestoreVolumeSnapshot. */
  ["RestoreVolumeSnapshotPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    snapshot?: ValueTypes["VolumeSnapshot"];
    volume?: ValueTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ResumeApp */
  ["ResumeAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
  };
  /** Autogenerated return type of ResumeApp. */
  ["ResumeAppPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RevokePostgresClusterUserAccess */
  ["RevokePostgresClusterUserAccessInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The name of the postgres cluster app */
    appName: string | Variable<any, string>;
    /** The username to revoke */
    username: string | Variable<any, string>;
    /** The database to revoke access to */
    databaseName: string | Variable<any, string>;
  };
  /** Autogenerated return type of RevokePostgresClusterUserAccess. */
  ["RevokePostgresClusterUserAccessPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    database?: ValueTypes["PostgresClusterDatabase"];
    postgresClusterRole?: ValueTypes["PostgresClusterAppRole"];
    user?: ValueTypes["PostgresClusterUser"];
    __typename?: boolean | `@${string}`;
  }>;
  ["RuntimeType"]: RuntimeType;
  /** Autogenerated input type of SaveDeploymentSource */
  ["SaveDeploymentSourceInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The application to update */
    appId: string | Variable<any, string>;
    provider: string | Variable<any, string>;
    repositoryId: string | Variable<any, string>;
    ref?: string | undefined | null | Variable<any, string>;
    baseDir?: string | undefined | null | Variable<any, string>;
    skipBuild?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of SaveDeploymentSource. */
  ["SaveDeploymentSourcePayload"]: AliasType<{
    app?: ValueTypes["App"];
    build?: ValueTypes["Build"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ScaleApp */
  ["ScaleAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** Regions to scale */
    regions: Array<ValueTypes["ScaleRegionInput"]> | Variable<any, string>;
  };
  /** Autogenerated return type of ScaleApp. */
  ["ScaleAppPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    delta?: ValueTypes["ScaleRegionChange"];
    placement?: ValueTypes["RegionPlacement"];
    __typename?: boolean | `@${string}`;
  }>;
  ["ScaleRegionChange"]: AliasType<{
    /** The original value */
    fromCount?: boolean | `@${string}`;
    /** The region code */
    region?: boolean | `@${string}`;
    /** The new value */
    toCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Region placement configuration */
  ["ScaleRegionInput"]: {
    /** The region to configure */
    region: string | Variable<any, string>;
    /** The value to change by */
    count: number | Variable<any, string>;
  };
  ["Secret"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    /** The digest of the secret value */
    digest?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** The name of the secret */
    name?: boolean | `@${string}`;
    /** The user who initiated the deployment */
    user?: ValueTypes["User"];
    __typename?: boolean | `@${string}`;
  }>;
  /** A secure configuration value */
  ["SecretInput"]: {
    /** The unqiue key for this secret */
    key: string | Variable<any, string>;
    /** The value of this secret */
    value: string | Variable<any, string>;
  };
  /** Global port routing */
  ["Service"]: AliasType<{
    /** Health checks */
    checks?: ValueTypes["Check"];
    description?: boolean | `@${string}`;
    /** Hard concurrency limit */
    hardConcurrency?: boolean | `@${string}`;
    /** Application port to forward traffic to */
    internalPort?: boolean | `@${string}`;
    /** Ports to listen on */
    ports?: ValueTypes["ServicePort"];
    /** Protocol to listen on */
    protocol?: boolean | `@${string}`;
    /** Soft concurrency limit */
    softConcurrency?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["ServiceHandlerType"]: ServiceHandlerType;
  /** Global port routing */
  ["ServiceInput"]: {
    /** Protocol to listen on */
    protocol: ValueTypes["ServiceProtocolType"] | Variable<any, string>;
    /** Ports to listen on */
    ports?:
      | Array<ValueTypes["ServiceInputPort"]>
      | undefined
      | null
      | Variable<any, string>;
    /** Application port to forward traffic to */
    internalPort: number | Variable<any, string>;
    /** Health checks */
    checks?:
      | Array<ValueTypes["CheckInput"]>
      | undefined
      | null
      | Variable<any, string>;
    /** Soft concurrency limit */
    softConcurrency?: number | undefined | null | Variable<any, string>;
    /** Hard concurrency limit */
    hardConcurrency?: number | undefined | null | Variable<any, string>;
  };
  /** Service port */
  ["ServiceInputPort"]: {
    /** Port to listen on */
    port: number | Variable<any, string>;
    /** Handlers to apply before forwarding service traffic */
    handlers?:
      | Array<ValueTypes["ServiceHandlerType"]>
      | undefined
      | null
      | Variable<any, string>;
    /** tls options */
    tlsOptions?:
      | ValueTypes["ServicePortTlsOptionsInput"]
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Service port */
  ["ServicePort"]: AliasType<{
    /** End port for range */
    endPort?: boolean | `@${string}`;
    /** Handlers to apply before forwarding service traffic */
    handlers?: boolean | `@${string}`;
    /** Port to listen on */
    port?: boolean | `@${string}`;
    /** Start port for range */
    startPort?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** TLS handshakes options for a port */
  ["ServicePortTlsOptionsInput"]: {
    defaultSelfSigned?: boolean | undefined | null | Variable<any, string>;
  };
  ["ServiceProtocolType"]: ServiceProtocolType;
  /** Autogenerated input type of SetAppsv2DefaultOn */
  ["SetAppsv2DefaultOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The organization slug */
    organizationSlug: string | Variable<any, string>;
    /** Whether or not new apps in this org use Apps V2 by default */
    defaultOn: boolean | Variable<any, string>;
  };
  /** Autogenerated return type of SetAppsv2DefaultOn. */
  ["SetAppsv2DefaultOnPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetPagerdutyHandler */
  ["SetPagerdutyHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** Handler name */
    name: string | Variable<any, string>;
    /** PagerDuty API token */
    pagerdutyToken: string | Variable<any, string>;
    /** Map of alert severity levels to PagerDuty severity levels */
    pagerdutyStatusMap?:
      | ValueTypes["JSON"]
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Autogenerated return type of SetPagerdutyHandler. */
  ["SetPagerdutyHandlerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    handler?: ValueTypes["HealthCheckHandler"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetPlatformVersion */
  ["SetPlatformVersionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** nomad or machines */
    platformVersion: string | Variable<any, string>;
    /** Unique lock ID */
    lockId?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of SetPlatformVersion. */
  ["SetPlatformVersionPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetSecrets */
  ["SetSecretsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** Secrets to set */
    secrets: Array<ValueTypes["SecretInput"]> | Variable<any, string>;
    /** By default, we set only the secrets you specify. Set this to true to replace all secrets. */
    replaceAll?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of SetSecrets. */
  ["SetSecretsPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ValueTypes["Release"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetSlackHandler */
  ["SetSlackHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** Handler name */
    name: string | Variable<any, string>;
    /** Slack Webhook URL to use for health check notifications */
    slackWebhookUrl: string | Variable<any, string>;
    /** Slack channel to send messages to, defaults to #general */
    slackChannel?: string | undefined | null | Variable<any, string>;
    /** User name to display on Slack Messages (defaults to Fly) */
    slackUsername?: string | undefined | null | Variable<any, string>;
    /** Icon to show with Slack messages */
    slackIconUrl?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of SetSlackHandler. */
  ["SetSlackHandlerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    handler?: ValueTypes["HealthCheckHandler"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetVMCount */
  ["SetVMCountInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** Counts for VM groups */
    groupCounts: Array<ValueTypes["VMCountInput"]> | Variable<any, string>;
    /** Unique lock ID */
    lockId?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of SetVMCount. */
  ["SetVMCountPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ValueTypes["Release"];
    taskGroupCounts?: ValueTypes["TaskGroupCount"];
    warnings?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetVMSize */
  ["SetVMSizeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** The name of the vm size to set */
    sizeName: string | Variable<any, string>;
    /** Optionally request more memory */
    memoryMb?: number | undefined | null | Variable<any, string>;
    /** Process group to modify */
    group?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of SetVMSize. */
  ["SetVMSizePayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** Process Group scale change applied to (if any) */
    processGroup?: ValueTypes["ProcessGroup"];
    /** Default app vm size */
    vmSize?: ValueTypes["VMSize"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of StartBuild */
  ["StartBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
  };
  /** Autogenerated return type of StartBuild. */
  ["StartBuildPayload"]: AliasType<{
    build?: ValueTypes["Build"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of StartMachine */
  ["StartMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId?: string | undefined | null | Variable<any, string>;
    /** machine id */
    id: string | Variable<any, string>;
  };
  /** Autogenerated return type of StartMachine. */
  ["StartMachinePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ValueTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of StopAllocation */
  ["StopAllocationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** The ID of the app */
    allocId: string | Variable<any, string>;
  };
  /** Autogenerated return type of StopAllocation. */
  ["StopAllocationPayload"]: AliasType<{
    allocation?: ValueTypes["Allocation"];
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of StopMachine */
  ["StopMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId?: string | undefined | null | Variable<any, string>;
    /** machine id */
    id: string | Variable<any, string>;
    /** signal to send the machine */
    signal?: string | undefined | null | Variable<any, string>;
    /** how long to wait before force killing the machine */
    killTimeoutSecs?: number | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of StopMachine. */
  ["StopMachinePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ValueTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  ["TaskGroupCount"]: AliasType<{
    count?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["TemplateDeployment"]: AliasType<{
    apps?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["AppConnection"]];
    id?: boolean | `@${string}`;
    organization?: ValueTypes["Organization"];
    status?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Configuration for third-party caveats to be added to user macaroons */
  ["ThirdPartyConfiguration"]: AliasType<{
    /** Restrictions to be placed on third-party caveats */
    caveats?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel?: boolean | `@${string}`;
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** Location URL of the third-party service capable of discharging */
    location?: boolean | `@${string}`;
    /** Friendly name for this configuration */
    name?: boolean | `@${string}`;
    /** Organization that owns this third party configuration */
    organization?: ValueTypes["Organization"];
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for ThirdPartyConfiguration. */
  ["ThirdPartyConfigurationConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["ThirdPartyConfigurationEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["ThirdPartyConfiguration"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["ThirdPartyConfigurationEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["ThirdPartyConfiguration"];
    __typename?: boolean | `@${string}`;
  }>;
  ["ThirdPartyConfigurationLevel"]: ThirdPartyConfigurationLevel;
  /** Autogenerated input type of UnlockApp */
  ["UnlockAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** Unique lock ID */
    lockId: string | Variable<any, string>;
  };
  /** Autogenerated return type of UnlockApp. */
  ["UnlockAppPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UnsetSecrets */
  ["UnsetSecretsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    /** Secret keys to unset */
    keys: Array<string> | Variable<any, string>;
  };
  /** Autogenerated return type of UnsetSecrets. */
  ["UnsetSecretsPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ValueTypes["Release"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateAddOn */
  ["UpdateAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The add-on ID to update */
    addOnId?: string | undefined | null | Variable<any, string>;
    /** The add-on name to update */
    name?: string | undefined | null | Variable<any, string>;
    /** The add-on plan ID */
    planId?: string | undefined | null | Variable<any, string>;
    /** Options specific to the add-on */
    options?: ValueTypes["JSON"] | undefined | null | Variable<any, string>;
    /** Desired regions to place replicas in */
    readRegions?: Array<string> | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of UpdateAddOn. */
  ["UpdateAddOnPayload"]: AliasType<{
    addOn?: ValueTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateAutoscaleConfig */
  ["UpdateAutoscaleConfigInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the app */
    appId: string | Variable<any, string>;
    enabled?: boolean | undefined | null | Variable<any, string>;
    minCount?: number | undefined | null | Variable<any, string>;
    maxCount?: number | undefined | null | Variable<any, string>;
    balanceRegions?: boolean | undefined | null | Variable<any, string>;
    /** Region configs */
    regions?:
      | Array<ValueTypes["AutoscaleRegionConfigInput"]>
      | undefined
      | null
      | Variable<any, string>;
    resetRegions?: boolean | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of UpdateAutoscaleConfig. */
  ["UpdateAutoscaleConfigPayload"]: AliasType<{
    app?: ValueTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateDNSPortal */
  ["UpdateDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    dnsPortalId: string | Variable<any, string>;
    /** The unique name of this portal. */
    name?: string | undefined | null | Variable<any, string>;
    /** The title of this portal */
    title?: string | undefined | null | Variable<any, string>;
    /** The return url for this portal */
    returnUrl?: string | undefined | null | Variable<any, string>;
    /** The text to display for the return url link */
    returnUrlText?: string | undefined | null | Variable<any, string>;
    /** The support url for this portal */
    supportUrl?: string | undefined | null | Variable<any, string>;
    /** The text to display for the support url link */
    supportUrlText?: string | undefined | null | Variable<any, string>;
    /** The primary branding color */
    primaryColor?: string | undefined | null | Variable<any, string>;
    /** The secondary branding color */
    accentColor?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of UpdateDNSPortal. */
  ["UpdateDNSPortalPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    dnsPortal?: ValueTypes["DNSPortal"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateDNSRecord */
  ["UpdateDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the DNS record */
    recordId: string | Variable<any, string>;
    /** The dns record name */
    name?: string | undefined | null | Variable<any, string>;
    /** The TTL in seconds */
    ttl?: number | undefined | null | Variable<any, string>;
    /** The content of the record */
    rdata?: string | undefined | null | Variable<any, string>;
  };
  /** Autogenerated return type of UpdateDNSRecord. */
  ["UpdateDNSRecordPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    record?: ValueTypes["DNSRecord"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateDNSRecords */
  ["UpdateDNSRecordsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the domain */
    domainId: string | Variable<any, string>;
    changes: Array<ValueTypes["DNSRecordChangeInput"]> | Variable<any, string>;
  };
  /** Autogenerated return type of UpdateDNSRecords. */
  ["UpdateDNSRecordsPayload"]: AliasType<{
    changes?: ValueTypes["DNSRecordDiff"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ValueTypes["Domain"];
    warnings?: ValueTypes["DNSRecordWarning"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateOrganizationMembership */
  ["UpdateOrganizationMembershipInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** The node ID of the user */
    userId: string | Variable<any, string>;
    /** The new role for the user */
    role: ValueTypes["OrganizationMemberRole"] | Variable<any, string>;
    /** The new alert settings for the user */
    alertsEnabled?:
      | ValueTypes["OrganizationAlertsEnabled"]
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Autogenerated return type of UpdateOrganizationMembership. */
  ["UpdateOrganizationMembershipPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ValueTypes["Organization"];
    user?: ValueTypes["User"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateRelease */
  ["UpdateReleaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The ID of the release */
    releaseId: string | Variable<any, string>;
    /** The new status for the release */
    status: string | Variable<any, string>;
  };
  /** Autogenerated return type of UpdateRelease. */
  ["UpdateReleasePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ValueTypes["Release"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateRemoteBuilder */
  ["UpdateRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the organization */
    organizationId: string | Variable<any, string>;
    /** Docker image reference */
    image: string | Variable<any, string>;
  };
  /** Autogenerated return type of UpdateRemoteBuilder. */
  ["UpdateRemoteBuilderPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ValueTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateThirdPartyConfiguration */
  ["UpdateThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    /** The node ID of the configuration */
    thirdPartyConfigurationId: string | Variable<any, string>;
    /** Friendly name for this configuration */
    name?: string | undefined | null | Variable<any, string>;
    /** Location URL of the third-party service capable of discharging */
    location?: string | undefined | null | Variable<any, string>;
    /** Restrictions to be placed on third-party caveats */
    caveats?:
      | ValueTypes["CaveatSet"]
      | undefined
      | null
      | Variable<any, string>;
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel?:
      | ValueTypes["ThirdPartyConfigurationLevel"]
      | undefined
      | null
      | Variable<any, string>;
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel?:
      | ValueTypes["ThirdPartyConfigurationLevel"]
      | undefined
      | null
      | Variable<any, string>;
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel?:
      | ValueTypes["ThirdPartyConfigurationLevel"]
      | undefined
      | null
      | Variable<any, string>;
  };
  /** Autogenerated return type of UpdateThirdPartyConfiguration. */
  ["UpdateThirdPartyConfigurationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    thirdPartyConfiguration?: ValueTypes["ThirdPartyConfiguration"];
    __typename?: boolean | `@${string}`;
  }>;
  ["User"]: AliasType<{
    agreedToProviderTos?: [
      { providerName: string | Variable<any, string> },
      boolean | `@${string}`,
    ];
    /** URL for avatar or placeholder */
    avatarUrl?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** Email address for user (private) */
    email?: boolean | `@${string}`;
    /** Whether to create new organizations under Hobby plan */
    enablePaidHobby?: boolean | `@${string}`;
    featureFlags?: boolean | `@${string}`;
    hasNodeproxyApps?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    internalNumericId?: boolean | `@${string}`;
    lastRegion?: boolean | `@${string}`;
    /** Display / full name for user (private) */
    name?: boolean | `@${string}`;
    organizations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["OrganizationConnection"]];
    personalOrganization?: ValueTypes["Organization"];
    trust?: boolean | `@${string}`;
    twoFactorProtection?: boolean | `@${string}`;
    /** Public username for user */
    username?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["UserCoupon"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** Organization that owns this app */
    organization?: ValueTypes["Organization"];
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["VM"]: AliasType<{
    attachedVolumes?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["VolumeConnection"]];
    canary?: boolean | `@${string}`;
    checks?: [{
      /** Filter checks by name */
      name?: string | undefined | null | Variable<any, string>;
    }, ValueTypes["CheckState"]];
    createdAt?: boolean | `@${string}`;
    criticalCheckCount?: boolean | `@${string}`;
    /** Desired status */
    desiredStatus?: boolean | `@${string}`;
    events?: ValueTypes["AllocationEvent"];
    failed?: boolean | `@${string}`;
    healthy?: boolean | `@${string}`;
    /** Unique ID for this instance */
    id?: boolean | `@${string}`;
    /** Short unique ID for this instance */
    idShort?: boolean | `@${string}`;
    /** Indicates if this instance is from the latest job version */
    latestVersion?: boolean | `@${string}`;
    passingCheckCount?: boolean | `@${string}`;
    /** Private IPv6 address for this instance */
    privateIP?: boolean | `@${string}`;
    recentLogs?: [{
      /** Max number of entries to return */
      limit?:
        | number
        | undefined
        | null
        | Variable<any, string>; /** Max age of log entries in seconds */
      range?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["LogEntry"]];
    /** Region this allocation is running in */
    region?: boolean | `@${string}`;
    restarts?: boolean | `@${string}`;
    /** Current status */
    status?: boolean | `@${string}`;
    taskName?: boolean | `@${string}`;
    totalCheckCount?: boolean | `@${string}`;
    transitioning?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    /** The configuration version of this instance */
    version?: boolean | `@${string}`;
    warningCheckCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for VM. */
  ["VMConnection"]: AliasType<{
    activeCount?: boolean | `@${string}`;
    completeCount?: boolean | `@${string}`;
    /** A list of edges. */
    edges?: ValueTypes["VMEdge"];
    failedCount?: boolean | `@${string}`;
    inactiveCount?: boolean | `@${string}`;
    lostCount?: boolean | `@${string}`;
    /** A list of nodes. */
    nodes?: ValueTypes["VM"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    pendingCount?: boolean | `@${string}`;
    runningCount?: boolean | `@${string}`;
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["VMCountInput"]: {
    /** VM group name */
    group?: string | undefined | null | Variable<any, string>;
    /** The desired count */
    count?: number | undefined | null | Variable<any, string>;
    /** Max number of VMs to allow per region */
    maxPerRegion?: number | undefined | null | Variable<any, string>;
  };
  /** An edge in a connection. */
  ["VMEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["VM"];
    __typename?: boolean | `@${string}`;
  }>;
  ["VMSize"]: AliasType<{
    cpuCores?: boolean | `@${string}`;
    maxMemoryMb?: boolean | `@${string}`;
    memoryGb?: boolean | `@${string}`;
    memoryIncrementsMb?: boolean | `@${string}`;
    memoryMb?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    priceMonth?: boolean | `@${string}`;
    priceSecond?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ValidateWireGuardPeers */
  ["ValidateWireGuardPeersInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null | Variable<any, string>;
    peerIps: Array<string> | Variable<any, string>;
  };
  /** Autogenerated return type of ValidateWireGuardPeers. */
  ["ValidateWireGuardPeersPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    invalidPeerIps?: boolean | `@${string}`;
    validPeerIps?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Volume"]: AliasType<{
    app?: ValueTypes["App"];
    attachedAllocation?: ValueTypes["Allocation"];
    attachedAllocationId?: boolean | `@${string}`;
    attachedMachine?: ValueTypes["Machine"];
    createdAt?: boolean | `@${string}`;
    encrypted?: boolean | `@${string}`;
    host?: ValueTypes["Host"];
    id?: boolean | `@${string}`;
    internalId?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    sizeGb?: boolean | `@${string}`;
    snapshots?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null
        | Variable<
          any,
          string
        >; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null | Variable<any, string>;
    }, ValueTypes["VolumeSnapshotConnection"]];
    state?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    usedBytes?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Volume. */
  ["VolumeConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["VolumeEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["Volume"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["VolumeEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  ["VolumeSnapshot"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    digest?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    size?: boolean | `@${string}`;
    volume?: ValueTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for VolumeSnapshot. */
  ["VolumeSnapshotConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["VolumeSnapshotEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["VolumeSnapshot"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["VolumeSnapshotEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["VolumeSnapshot"];
    __typename?: boolean | `@${string}`;
  }>;
  ["WireGuardPeer"]: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    network?: boolean | `@${string}`;
    peerip?: boolean | `@${string}`;
    pubkey?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for WireGuardPeer. */
  ["WireGuardPeerConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ValueTypes["WireGuardPeerEdge"];
    /** A list of nodes. */
    nodes?: ValueTypes["WireGuardPeer"];
    /** Information to aid in pagination. */
    pageInfo?: ValueTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["WireGuardPeerEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ValueTypes["WireGuardPeer"];
    __typename?: boolean | `@${string}`;
  }>;
};

export type ResolverInputTypes = {
  ["schema"]: AliasType<{
    query?: ResolverInputTypes["Queries"];
    mutation?: ResolverInputTypes["Mutations"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AccessToken"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for AccessToken. */
  ["AccessTokenConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["AccessTokenEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["AccessToken"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AccessTokenEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["AccessToken"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AccessTokenType"]: AccessTokenType;
  /** Autogenerated return type of AddCertificate. */
  ["AddCertificatePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    certificate?: ResolverInputTypes["AppCertificate"];
    check?: ResolverInputTypes["HostnameCheck"];
    errors?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["AddOn"]: AliasType<{
    /** The add-on plan */
    addOnPlan?: ResolverInputTypes["AddOnPlan"];
    /** The display name for an add-on plan */
    addOnPlanName?: boolean | `@${string}`;
    /** The add-on provider */
    addOnProvider?: ResolverInputTypes["AddOnProvider"];
    /** An app associated with this add-on */
    app?: ResolverInputTypes["App"];
    apps?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["AppConnection"]];
    /** Environment variables for the add-on */
    environment?: boolean | `@${string}`;
    /** Optional error message when `status` is `error` */
    errorMessage?: boolean | `@${string}`;
    /** DNS hostname for the add-on */
    hostname?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** Add-on metadata */
    metadata?: boolean | `@${string}`;
    /** The service name according to the provider */
    name?: boolean | `@${string}`;
    /** Add-on options */
    options?: boolean | `@${string}`;
    /** Organization that owns this service */
    organization?: ResolverInputTypes["Organization"];
    /** Password for the add-on */
    password?: boolean | `@${string}`;
    /** Region where the primary instance is deployed */
    primaryRegion?: boolean | `@${string}`;
    /** Private flycast IP address of the add-on */
    privateIp?: boolean | `@${string}`;
    /** Public URL for this service */
    publicUrl?: boolean | `@${string}`;
    /** Regions where replica instances are deployed */
    readRegions?: boolean | `@${string}`;
    /** Single sign-on link to the add-on dashboard */
    ssoLink?: boolean | `@${string}`;
    /** Redis database statistics */
    stats?: boolean | `@${string}`;
    /** Status of the add-on */
    status?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for AddOn. */
  ["AddOnConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["AddOnEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["AddOn"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AddOnEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["AddOn"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AddOnPlan"]: AliasType<{
    displayName?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    maxCommandsPerSec?: boolean | `@${string}`;
    maxConcurrentConnections?: boolean | `@${string}`;
    maxDailyBandwidth?: boolean | `@${string}`;
    maxDailyCommands?: boolean | `@${string}`;
    maxDataSize?: boolean | `@${string}`;
    maxRequestSize?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    pricePerMonth?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for AddOnPlan. */
  ["AddOnPlanConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["AddOnPlanEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["AddOnPlan"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AddOnPlanEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["AddOnPlan"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AddOnProvider"]: AliasType<{
    asyncProvisioning?: boolean | `@${string}`;
    autoProvision?: boolean | `@${string}`;
    beta?: boolean | `@${string}`;
    detectPlatform?: boolean | `@${string}`;
    displayName?: boolean | `@${string}`;
    excludedRegions?: ResolverInputTypes["Region"];
    id?: boolean | `@${string}`;
    internal?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    nameSuffix?: boolean | `@${string}`;
    provisioningInstructions?: boolean | `@${string}`;
    regions?: ResolverInputTypes["Region"];
    resourceName?: boolean | `@${string}`;
    selectName?: boolean | `@${string}`;
    selectRegion?: boolean | `@${string}`;
    selectReplicaRegions?: boolean | `@${string}`;
    tosAgreement?: boolean | `@${string}`;
    tosUrl?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["AddOnType"]: AddOnType;
  /** Autogenerated input type of AddWireGuardPeer */
  ["AddWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The region in which to deploy the peer */
    region?: string | undefined | null;
    /** The name with which to refer to the peer */
    name: string;
    /** The 25519 public key for the peer */
    pubkey: string;
    /** Network ID to attach wireguard peer to */
    network?: string | undefined | null;
    /** Add via NATS transaction (deprecated - nats is always used) */
    nats?: boolean | undefined | null;
  };
  /** Autogenerated return type of AddWireGuardPeer. */
  ["AddWireGuardPeerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    endpointip?: boolean | `@${string}`;
    network?: boolean | `@${string}`;
    peerip?: boolean | `@${string}`;
    pubkey?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of AllocateIPAddress */
  ["AllocateIPAddressInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The application to allocate the ip address for */
    appId: string;
    /** The type of IP address to allocate (v4, v6, or private_v6) */
    type: ResolverInputTypes["IPAddressType"];
    /** The organization whose network should be used for private IP allocation */
    organizationId?: string | undefined | null;
    /** Desired IP region (defaults to global) */
    region?: string | undefined | null;
    /** The target network name in the specified organization */
    network?: string | undefined | null;
    /** The name of the associated service */
    serviceName?: string | undefined | null;
  };
  /** Autogenerated return type of AllocateIPAddress. */
  ["AllocateIPAddressPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    ipAddress?: ResolverInputTypes["IPAddress"];
    __typename?: boolean | `@${string}`;
  }>;
  ["Allocation"]: AliasType<{
    attachedVolumes?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["VolumeConnection"]];
    canary?: boolean | `@${string}`;
    checks?: [{
      /** Filter checks by name */
      name?: string | undefined | null;
    }, ResolverInputTypes["CheckState"]];
    createdAt?: boolean | `@${string}`;
    criticalCheckCount?: boolean | `@${string}`;
    /** Desired status */
    desiredStatus?: boolean | `@${string}`;
    events?: ResolverInputTypes["AllocationEvent"];
    failed?: boolean | `@${string}`;
    healthy?: boolean | `@${string}`;
    /** Unique ID for this instance */
    id?: boolean | `@${string}`;
    /** Short unique ID for this instance */
    idShort?: boolean | `@${string}`;
    /** Indicates if this instance is from the latest job version */
    latestVersion?: boolean | `@${string}`;
    passingCheckCount?: boolean | `@${string}`;
    /** Private IPv6 address for this instance */
    privateIP?: boolean | `@${string}`;
    recentLogs?: [{
      /** Max number of entries to return */
      limit?:
        | number
        | undefined
        | null; /** Max age of log entries in seconds */
      range?: number | undefined | null;
    }, ResolverInputTypes["LogEntry"]];
    /** Region this allocation is running in */
    region?: boolean | `@${string}`;
    restarts?: boolean | `@${string}`;
    /** Current status */
    status?: boolean | `@${string}`;
    taskName?: boolean | `@${string}`;
    totalCheckCount?: boolean | `@${string}`;
    transitioning?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    /** The configuration version of this instance */
    version?: boolean | `@${string}`;
    warningCheckCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["AllocationEvent"]: AliasType<{
    message?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["App"]: AliasType<{
    addOns?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      type?: ResolverInputTypes["AddOnType"] | undefined | null;
    }, ResolverInputTypes["AddOnConnection"]];
    allocation?: [{ id: string }, ResolverInputTypes["Allocation"]];
    allocations?: [
      { showCompleted?: boolean | undefined | null },
      ResolverInputTypes["Allocation"],
    ];
    appUrl?: boolean | `@${string}`;
    autoscaling?: ResolverInputTypes["AutoscalingConfig"];
    backupRegions?: ResolverInputTypes["Region"];
    builds?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["BuildConnection"]];
    certificate?: [{ hostname: string }, ResolverInputTypes["AppCertificate"]];
    certificates?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      filter?: string | undefined | null;
      id?: string | undefined | null;
    }, ResolverInputTypes["AppCertificateConnection"]];
    changes?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["AppChangeConnection"]];
    config?: ResolverInputTypes["AppConfig"];
    createdAt?: boolean | `@${string}`;
    currentLock?: ResolverInputTypes["AppLock"];
    currentPlacement?: ResolverInputTypes["RegionPlacement"];
    /** The latest release of this application */
    currentRelease?: ResolverInputTypes["Release"];
    /** The latest release of this application, without any config processing */
    currentReleaseUnprocessed?: ResolverInputTypes["ReleaseUnprocessed"];
    deployed?: boolean | `@${string}`;
    /** Continuous deployment configuration */
    deploymentSource?: ResolverInputTypes["DeploymentSource"];
    deploymentStatus?: [
      {
        id?: string | undefined | null;
        evaluationId?: string | undefined | null;
      },
      ResolverInputTypes["DeploymentStatus"],
    ];
    /** Check if this app has a configured deployment source */
    hasDeploymentSource?: boolean | `@${string}`;
    healthChecks?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null; /** Filter health checks by name */
      name?: string | undefined | null;
    }, ResolverInputTypes["CheckStateConnection"]];
    /** Autogenerated hostname for this application */
    hostname?: boolean | `@${string}`;
    /** Unique application ID */
    id?: boolean | `@${string}`;
    image?: [{ ref: string }, ResolverInputTypes["Image"]];
    /** Image details */
    imageDetails?: ResolverInputTypes["ImageVersion"];
    imageUpgradeAvailable?: boolean | `@${string}`;
    imageVersionTrackingEnabled?: boolean | `@${string}`;
    /** Authentication key to use with Instrumentation endpoints */
    instrumentsKey?: boolean | `@${string}`;
    internalId?: boolean | `@${string}`;
    internalNumericId?: boolean | `@${string}`;
    ipAddress?: [{ address: string }, ResolverInputTypes["IPAddress"]];
    ipAddresses?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["IPAddressConnection"]];
    /** This object's unique key */
    key?: boolean | `@${string}`;
    /** Latest image details */
    latestImageDetails?: ResolverInputTypes["ImageVersion"];
    limitedAccessTokens?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["LimitedAccessTokenConnection"]];
    machine?: [{ id: string }, ResolverInputTypes["Machine"]];
    machines?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      version?:
        | number
        | undefined
        | null; /** Return only started/stopped machines (excludes destroyed, etc.) */
      active?: boolean | undefined | null;
    }, ResolverInputTypes["MachineConnection"]];
    /** The unique application name */
    name?: boolean | `@${string}`;
    network?: boolean | `@${string}`;
    networkId?: boolean | `@${string}`;
    /** Organization that owns this app */
    organization?: ResolverInputTypes["Organization"];
    parseConfig?: [
      { definition: ResolverInputTypes["JSON"] },
      ResolverInputTypes["AppConfig"],
    ];
    /** Fly platform version */
    platformVersion?: boolean | `@${string}`;
    processGroups?: ResolverInputTypes["ProcessGroup"];
    regions?: ResolverInputTypes["Region"];
    release?: [
      { id?: string | undefined | null; version?: number | undefined | null },
      ResolverInputTypes["Release"],
    ];
    releases?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["ReleaseConnection"]];
    releasesUnprocessed?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      status?: string | undefined | null;
    }, ResolverInputTypes["ReleaseUnprocessedConnection"]];
    role?: ResolverInputTypes["AppRole"];
    /** Application runtime */
    runtime?: boolean | `@${string}`;
    /** Secrets set on the application */
    secrets?: ResolverInputTypes["Secret"];
    services?: ResolverInputTypes["Service"];
    sharedIpAddress?: boolean | `@${string}`;
    state?: boolean | `@${string}`;
    /** Application status */
    status?: boolean | `@${string}`;
    taskGroupCounts?: ResolverInputTypes["TaskGroupCount"];
    usage?: ResolverInputTypes["AppUsage"];
    version?: boolean | `@${string}`;
    vmSize?: ResolverInputTypes["VMSize"];
    vms?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      showCompleted?: boolean | undefined | null;
    }, ResolverInputTypes["VMConnection"]];
    volume?: [{ internalId: string }, ResolverInputTypes["Volume"]];
    volumes?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["VolumeConnection"]];
    __typename?: boolean | `@${string}`;
  }>;
  ["AppCertificate"]: AliasType<{
    acmeAlpnConfigured?: boolean | `@${string}`;
    acmeDnsConfigured?: boolean | `@${string}`;
    certificateAuthority?: boolean | `@${string}`;
    certificateRequestedAt?: boolean | `@${string}`;
    check?: boolean | `@${string}`;
    clientStatus?: boolean | `@${string}`;
    configured?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    dnsProvider?: boolean | `@${string}`;
    dnsValidationHostname?: boolean | `@${string}`;
    dnsValidationInstructions?: boolean | `@${string}`;
    dnsValidationTarget?: boolean | `@${string}`;
    domain?: boolean | `@${string}`;
    hostname?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    isAcmeAlpnConfigured?: boolean | `@${string}`;
    isAcmeDnsConfigured?: boolean | `@${string}`;
    isApex?: boolean | `@${string}`;
    isConfigured?: boolean | `@${string}`;
    isWildcard?: boolean | `@${string}`;
    issued?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      includeExpired?: boolean | undefined | null;
    }, ResolverInputTypes["CertificateConnection"]];
    source?: boolean | `@${string}`;
    validationErrors?: ResolverInputTypes["AppCertificateValidationError"];
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for AppCertificate. */
  ["AppCertificateConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["AppCertificateEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["AppCertificate"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AppCertificateEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["AppCertificate"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AppCertificateValidationError"]: AliasType<{
    message?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["AppChange"]: AliasType<{
    /** Object that triggered the change */
    actor?: ResolverInputTypes["AppChangeActor"];
    actorType?: boolean | `@${string}`;
    app?: ResolverInputTypes["App"];
    createdAt?: boolean | `@${string}`;
    description?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    user?: ResolverInputTypes["User"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Objects that change apps */
  ["AppChangeActor"]: AliasType<{
    Build?: ResolverInputTypes["Build"];
    Release?: ResolverInputTypes["Release"];
    Secret?: ResolverInputTypes["Secret"];
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for AppChange. */
  ["AppChangeConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["AppChangeEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["AppChange"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AppChangeEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["AppChange"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AppConfig"]: AliasType<{
    definition?: boolean | `@${string}`;
    errors?: boolean | `@${string}`;
    services?: ResolverInputTypes["Service"];
    valid?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for App. */
  ["AppConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["AppEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["App"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["AppEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["App"];
    __typename?: boolean | `@${string}`;
  }>;
  /** app lock */
  ["AppLock"]: AliasType<{
    /** Time when the lock expires */
    expiration?: boolean | `@${string}`;
    /** Lock ID */
    lockId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["AppRole"]: AliasType<{
    /** The name of this role */
    name?: boolean | `@${string}`;
    ["...on EmptyAppRole"]?: Omit<
      ResolverInputTypes["EmptyAppRole"],
      keyof ResolverInputTypes["AppRole"]
    >;
    ["...on FlyctlMachineHostAppRole"]?: Omit<
      ResolverInputTypes["FlyctlMachineHostAppRole"],
      keyof ResolverInputTypes["AppRole"]
    >;
    ["...on PostgresClusterAppRole"]?: Omit<
      ResolverInputTypes["PostgresClusterAppRole"],
      keyof ResolverInputTypes["AppRole"]
    >;
    ["...on RemoteDockerBuilderAppRole"]?: Omit<
      ResolverInputTypes["RemoteDockerBuilderAppRole"],
      keyof ResolverInputTypes["AppRole"]
    >;
    __typename?: boolean | `@${string}`;
  }>;
  ["AppState"]: AppState;
  /** Application usage data */
  ["AppUsage"]: AliasType<{
    /** The timespan interval for this usage sample */
    interval?: boolean | `@${string}`;
    /** Total requests for this time period */
    requestsCount?: boolean | `@${string}`;
    /** Total app execution time (in seconds) for this time period */
    totalAppExecS?: boolean | `@${string}`;
    /** Total GB transferred out in this time period */
    totalDataOutGB?: boolean | `@${string}`;
    /** The start of the timespan for this usage sample */
    ts?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of AttachPostgresCluster */
  ["AttachPostgresClusterInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The postgres cluster application id */
    postgresClusterAppId: string;
    /** The application to attach postgres to */
    appId: string;
    /** The database to attach. Defaults to a new database with the same name as the app. */
    databaseName?: string | undefined | null;
    /** The database user to create. Defaults to using the database name. */
    databaseUser?: string | undefined | null;
    /** The environment variable name to set the connection string to. Defaults to DATABASE_URL */
    variableName?: string | undefined | null;
    /** Flag used to indicate that flyctl will exec calls */
    manualEntry?: boolean | undefined | null;
  };
  /** Autogenerated return type of AttachPostgresCluster. */
  ["AttachPostgresClusterPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    connectionString?: boolean | `@${string}`;
    environmentVariableName?: boolean | `@${string}`;
    postgresClusterApp?: ResolverInputTypes["App"];
    __typename?: boolean | `@${string}`;
  }>;
  ["AutoscaleRegionConfig"]: AliasType<{
    /** The region code */
    code?: boolean | `@${string}`;
    /** The minimum number of VMs to run in this region */
    minCount?: boolean | `@${string}`;
    /** The relative weight for this region */
    weight?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Region autoscaling configuration */
  ["AutoscaleRegionConfigInput"]: {
    /** The region code to configure */
    code: string;
    /** The weight */
    weight?: number | undefined | null;
    /** Minimum number of VMs to run in this region */
    minCount?: number | undefined | null;
    /** Reset the configuration for this region */
    reset?: boolean | undefined | null;
  };
  ["AutoscaleStrategy"]: AutoscaleStrategy;
  ["AutoscalingConfig"]: AliasType<{
    backupRegions?: boolean | `@${string}`;
    balanceRegions?: boolean | `@${string}`;
    enabled?: boolean | `@${string}`;
    maxCount?: boolean | `@${string}`;
    minCount?: boolean | `@${string}`;
    preferredRegion?: boolean | `@${string}`;
    regions?: ResolverInputTypes["AutoscaleRegionConfig"];
    strategy?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Represents non-fractional signed whole numeric values. Since the value may exceed the size of a 32-bit integer, it's encoded as a string. */
  ["BigInt"]: unknown;
  ["BillingStatus"]: BillingStatus;
  ["Build"]: AliasType<{
    app?: ResolverInputTypes["App"];
    commitId?: boolean | `@${string}`;
    commitUrl?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** The user who initiated the build */
    createdBy?: ResolverInputTypes["User"];
    /** Indicates if this build is complete and failed */
    failed?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    image?: boolean | `@${string}`;
    /** Indicates if this build is currently in progress */
    inProgress?: boolean | `@${string}`;
    /** Log output */
    logs?: boolean | `@${string}`;
    number?: boolean | `@${string}`;
    /** Status of the build */
    status?: boolean | `@${string}`;
    /** Indicates if this build is complete and succeeded */
    succeeded?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Build. */
  ["BuildConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["BuildEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["Build"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["BuildEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["Build"];
    __typename?: boolean | `@${string}`;
  }>;
  ["BuildFinalImageInput"]: {
    /** Sha256 id of docker image */
    id: string;
    /** Tag used for docker image */
    tag: string;
    /** Size in bytes of the docker image */
    sizeBytes: ResolverInputTypes["BigInt"];
  };
  ["BuildImageOptsInput"]: {
    /** Path to dockerfile, if one exists */
    dockerfilePath?: string | undefined | null;
    /** Unused in cli? */
    imageRef?: string | undefined | null;
    /** Set of build time variables passed to cli */
    buildArgs?: ResolverInputTypes["JSON"] | undefined | null;
    /** Unused in cli? */
    extraBuildArgs?: ResolverInputTypes["JSON"] | undefined | null;
    /** Image label to use when tagging and pushing to the fly registry */
    imageLabel?: string | undefined | null;
    /** Whether publishing to the registry was requested */
    publish?: boolean | undefined | null;
    /** Docker tag used to publish image to registry */
    tag?: string | undefined | null;
    /** Set the target build stage to build if the Dockerfile has more than one stage */
    target?: string | undefined | null;
    /** Do not use the build cache when building the image */
    noCache?: boolean | undefined | null;
    /** Builtin builder to use */
    builtIn?: string | undefined | null;
    /** Builtin builder settings */
    builtInSettings?: ResolverInputTypes["JSON"] | undefined | null;
    /** Fly.toml build.builder setting */
    builder?: string | undefined | null;
    /** Fly.toml build.buildpacks setting */
    buildPacks?: Array<string> | undefined | null;
  };
  ["BuildStrategyAttemptInput"]: {
    /** Build strategy attempted */
    strategy: string;
    /** Result attempting this strategy */
    result: string;
    /** Optional error message from strategy */
    error?: string | undefined | null;
    /** Optional note about this strategy or its result */
    note?: string | undefined | null;
  };
  ["BuildTimingsInput"]: {
    /** Time to build and push the image, measured by flyctl */
    buildAndPushMs?: ResolverInputTypes["BigInt"] | undefined | null;
    /** Time to initialize client used to connect to either remote or local builder */
    builderInitMs?: ResolverInputTypes["BigInt"] | undefined | null;
    /** Time to build the image including create context, measured by flyctl */
    buildMs?: ResolverInputTypes["BigInt"] | undefined | null;
    /** Time to create the build context tar file, measured by flyctl */
    contextBuildMs?: ResolverInputTypes["BigInt"] | undefined | null;
    /** Time for builder to build image after receiving context, measured by flyctl */
    imageBuildMs?: ResolverInputTypes["BigInt"] | undefined | null;
    /** Time to push completed image to registry, measured by flyctl */
    pushMs?: ResolverInputTypes["BigInt"] | undefined | null;
  };
  ["BuilderMetaInput"]: {
    /** Local or remote builder type */
    builderType: string;
    /** Docker version reported by builder */
    dockerVersion?: string | undefined | null;
    /** Whther or not buildkit is enabled on builder */
    buildkitEnabled?: boolean | undefined | null;
    /** Platform reported by the builder */
    platform?: string | undefined | null;
    /** Remote builder app used */
    remoteAppName?: string | undefined | null;
    /** Remote builder machine used */
    remoteMachineId?: string | undefined | null;
  };
  /** Autogenerated return type of CancelBuild. */
  ["CancelBuildPayload"]: AliasType<{
    build?: ResolverInputTypes["Build"];
    __typename?: boolean | `@${string}`;
  }>;
  /** A set of base64 messagepack encoded macaroon caveats (See https://github.com/superfly/macaroon) */
  ["CaveatSet"]: unknown;
  ["Certificate"]: AliasType<{
    expiresAt?: boolean | `@${string}`;
    hostname?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Certificate. */
  ["CertificateConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["CertificateEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["Certificate"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CertificateEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["Certificate"];
    __typename?: boolean | `@${string}`;
  }>;
  /** health check */
  ["Check"]: AliasType<{
    httpHeaders?: ResolverInputTypes["CheckHeader"];
    httpMethod?: boolean | `@${string}`;
    httpPath?: boolean | `@${string}`;
    httpProtocol?: boolean | `@${string}`;
    httpTlsSkipVerify?: boolean | `@${string}`;
    /** Check interval in milliseconds */
    interval?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    scriptArgs?: boolean | `@${string}`;
    scriptCommand?: boolean | `@${string}`;
    /** Check timeout in milliseconds */
    timeout?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CheckCertificate */
  ["CheckCertificateInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** Application to ID */
    appId: string;
    /** Certificate hostname to check */
    hostname: string;
  };
  /** Autogenerated return type of CheckCertificate. */
  ["CheckCertificatePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    certificate?: ResolverInputTypes["AppCertificate"];
    check?: ResolverInputTypes["HostnameCheck"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CheckDomain */
  ["CheckDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** Domain name to check */
    domainName: string;
  };
  /** Autogenerated return type of CheckDomain. */
  ["CheckDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    dnsAvailable?: boolean | `@${string}`;
    domainName?: boolean | `@${string}`;
    registrationAvailable?: boolean | `@${string}`;
    registrationPeriod?: boolean | `@${string}`;
    registrationPrice?: boolean | `@${string}`;
    registrationSupported?: boolean | `@${string}`;
    tld?: boolean | `@${string}`;
    transferAvailable?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** check job http response */
  ["CheckHTTPResponse"]: AliasType<{
    closeTs?: boolean | `@${string}`;
    connectedTs?: boolean | `@${string}`;
    dnsTs?: boolean | `@${string}`;
    firstTs?: boolean | `@${string}`;
    flyioDebug?: boolean | `@${string}`;
    headers?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    lastTs?: boolean | `@${string}`;
    location?: ResolverInputTypes["CheckLocation"];
    rawHeaders?: boolean | `@${string}`;
    rawOutput?: boolean | `@${string}`;
    resolvedIp?: boolean | `@${string}`;
    sentTs?: boolean | `@${string}`;
    startTs?: boolean | `@${string}`;
    statusCode?: boolean | `@${string}`;
    tlsTs?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for CheckHTTPResponse. */
  ["CheckHTTPResponseConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["CheckHTTPResponseEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["CheckHTTPResponse"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CheckHTTPResponseEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["CheckHTTPResponse"];
    __typename?: boolean | `@${string}`;
  }>;
  /** All available http checks verbs */
  ["CheckHTTPVerb"]: CheckHTTPVerb;
  /** HTTP header for a health check */
  ["CheckHeader"]: AliasType<{
    name?: boolean | `@${string}`;
    value?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["CheckHeaderInput"]: {
    name: string;
    value: string;
  };
  ["CheckInput"]: {
    type: ResolverInputTypes["CheckType"];
    name?: string | undefined | null;
    /** Check interval in milliseconds */
    interval?: number | undefined | null;
    /** Check timeout in milliseconds */
    timeout?: number | undefined | null;
    httpMethod?: ResolverInputTypes["HTTPMethod"] | undefined | null;
    httpPath?: string | undefined | null;
    httpProtocol?: ResolverInputTypes["HTTPProtocol"] | undefined | null;
    httpTlsSkipVerify?: boolean | undefined | null;
    httpHeaders?:
      | Array<ResolverInputTypes["CheckHeaderInput"]>
      | undefined
      | null;
    scriptCommand?: string | undefined | null;
    scriptArgs?: Array<string> | undefined | null;
  };
  /** check job */
  ["CheckJob"]: AliasType<{
    httpOptions?: ResolverInputTypes["CheckJobHTTPOptions"];
    id?: boolean | `@${string}`;
    locations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["CheckLocationConnection"]];
    nextRunAt?: boolean | `@${string}`;
    runs?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["CheckJobRunConnection"]];
    schedule?: boolean | `@${string}`;
    url?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for CheckJob. */
  ["CheckJobConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["CheckJobEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["CheckJob"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CheckJobEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["CheckJob"];
    __typename?: boolean | `@${string}`;
  }>;
  /** health check state */
  ["CheckJobHTTPOptions"]: AliasType<{
    headers?: boolean | `@${string}`;
    verb?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** health check state */
  ["CheckJobHTTPOptionsInput"]: {
    verb: ResolverInputTypes["CheckHTTPVerb"];
    headers?: Array<string> | undefined | null;
  };
  /** check job run */
  ["CheckJobRun"]: AliasType<{
    completedAt?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    httpOptions?: ResolverInputTypes["CheckJobHTTPOptions"];
    httpResponses?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["CheckHTTPResponseConnection"]];
    id?: boolean | `@${string}`;
    locations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["CheckLocationConnection"]];
    state?: boolean | `@${string}`;
    tests?: boolean | `@${string}`;
    url?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for CheckJobRun. */
  ["CheckJobRunConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["CheckJobRunEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["CheckJobRun"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CheckJobRunEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["CheckJobRun"];
    __typename?: boolean | `@${string}`;
  }>;
  /** check location */
  ["CheckLocation"]: AliasType<{
    coordinates?: boolean | `@${string}`;
    country?: boolean | `@${string}`;
    locality?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    state?: boolean | `@${string}`;
    title?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for CheckLocation. */
  ["CheckLocationConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["CheckLocationEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["CheckLocation"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CheckLocationEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["CheckLocation"];
    __typename?: boolean | `@${string}`;
  }>;
  /** health check state */
  ["CheckState"]: AliasType<{
    allocation?: ResolverInputTypes["Allocation"];
    allocationId?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    output?: [{
      /** The number of characters to truncate output to */
      limit?:
        | number
        | undefined
        | null; /** Remove newlines and trim whitespace */
      compact?: boolean | undefined | null;
    }, boolean | `@${string}`];
    serviceName?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for CheckState. */
  ["CheckStateConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["CheckStateEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["CheckState"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["CheckStateEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["CheckState"];
    __typename?: boolean | `@${string}`;
  }>;
  ["CheckType"]: CheckType;
  /** Autogenerated input type of ConfigureRegions */
  ["ConfigureRegionsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** Regions to allow running in */
    allowRegions?: Array<string> | undefined | null;
    /** Regions to deny running in */
    denyRegions?: Array<string> | undefined | null;
    /** Fallback regions. Used if preferred regions are having issues */
    backupRegions?: Array<string> | undefined | null;
    /** Process group to modify */
    group?: string | undefined | null;
  };
  /** Autogenerated return type of ConfigureRegions. */
  ["ConfigureRegionsPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    backupRegions?: ResolverInputTypes["Region"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    group?: boolean | `@${string}`;
    regions?: ResolverInputTypes["Region"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateAddOn */
  ["CreateAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** An optional application ID to attach the add-on to after provisioning */
    appId?: string | undefined | null;
    /** The organization which owns the add-on */
    organizationId?: string | undefined | null;
    /** The add-on type to provision */
    type: ResolverInputTypes["AddOnType"];
    /** An optional name for the add-on */
    name?: string | undefined | null;
    /** The add-on plan ID */
    planId?: string | undefined | null;
    /** Desired primary region for the add-on */
    primaryRegion?: string | undefined | null;
    /** Desired regions to place replicas in */
    readRegions?: Array<string> | undefined | null;
    /** Options specific to the add-on */
    options?: ResolverInputTypes["JSON"] | undefined | null;
  };
  /** Autogenerated return type of CreateAddOn. */
  ["CreateAddOnPayload"]: AliasType<{
    addOn?: ResolverInputTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateAndRegisterDomain */
  ["CreateAndRegisterDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The domain name */
    name: string;
    /** Enable whois privacy on the registration */
    whoisPrivacy?: boolean | undefined | null;
    /** Enable auto renew on the registration */
    autoRenew?: boolean | undefined | null;
  };
  /** Autogenerated return type of CreateAndRegisterDomain. */
  ["CreateAndRegisterDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ResolverInputTypes["Domain"];
    organization?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateAndTransferDomain */
  ["CreateAndTransferDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The domain name */
    name: string;
    /** The authorization code */
    authorizationCode: string;
  };
  /** Autogenerated return type of CreateAndTransferDomain. */
  ["CreateAndTransferDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ResolverInputTypes["Domain"];
    organization?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateApp */
  ["CreateAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The application runtime */
    runtime?: ResolverInputTypes["RuntimeType"] | undefined | null;
    /** The name of the new application. Defaults to a random name. */
    name?: string | undefined | null;
    preferredRegion?: string | undefined | null;
    heroku?: boolean | undefined | null;
    network?: string | undefined | null;
    appRoleId?: string | undefined | null;
    machines?: boolean | undefined | null;
  };
  /** Autogenerated return type of CreateApp. */
  ["CreateAppPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateBuild */
  ["CreateBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The name of the app being built */
    appName: string;
    /** The ID of the machine being built (only set for machine builds) */
    machineId?: string | undefined | null;
    /** Options set for building image */
    imageOpts: ResolverInputTypes["BuildImageOptsInput"];
    /** List of available build strategies that will be attempted */
    strategiesAvailable: Array<string>;
    /** Whether builder is remote or local */
    builderType: string;
  };
  /** Autogenerated return type of CreateBuild. */
  ["CreateBuildPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** build id */
    id?: boolean | `@${string}`;
    /** stored build status */
    status?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateCheckJob */
  ["CreateCheckJobInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** Organization ID */
    organizationId: string;
    /** The URL to check */
    url: string;
    /** http checks locations */
    locations: Array<string>;
    /** http check options */
    httpOptions: ResolverInputTypes["CheckJobHTTPOptionsInput"];
  };
  /** Autogenerated return type of CreateCheckJob. */
  ["CreateCheckJobPayload"]: AliasType<{
    checkJob?: ResolverInputTypes["CheckJob"];
    checkJobRun?: ResolverInputTypes["CheckJobRun"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateCheckJobRun */
  ["CreateCheckJobRunInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** Check Job ID */
    checkJobId: string;
  };
  /** Autogenerated return type of CreateCheckJobRun. */
  ["CreateCheckJobRunPayload"]: AliasType<{
    checkJob?: ResolverInputTypes["CheckJob"];
    checkJobRun?: ResolverInputTypes["CheckJobRun"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDNSPortal */
  ["CreateDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The unique name of this portal. A random name will be generated if omitted. */
    name?: string | undefined | null;
    /** The title of this portal */
    title?: string | undefined | null;
    /** The return url for this portal */
    returnUrl?: string | undefined | null;
    /** The text to display for the return url link */
    returnUrlText?: string | undefined | null;
    /** The support url for this portal */
    supportUrl?: string | undefined | null;
    /** The text to display for the support url link */
    supportUrlText?: string | undefined | null;
    /** The primary branding color */
    primaryColor?: string | undefined | null;
    /** The secondary branding color */
    accentColor?: string | undefined | null;
  };
  /** Autogenerated return type of CreateDNSPortal. */
  ["CreateDNSPortalPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    dnsPortal?: ResolverInputTypes["DNSPortal"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDNSPortalSession */
  ["CreateDNSPortalSessionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the dns portal */
    dnsPortalId: string;
    /** The node ID of the domain to edit */
    domainId: string;
    /** Optionally override the portal's default title for this session */
    title?: string | undefined | null;
    /** Optionally override the portal's default return url for this session */
    returnUrl?: string | undefined | null;
    /** Optionally override the portal's default return url text for this session */
    returnUrlText?: string | undefined | null;
  };
  /** Autogenerated return type of CreateDNSPortalSession. */
  ["CreateDNSPortalSessionPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    dnsPortalSession?: ResolverInputTypes["DNSPortalSession"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDNSRecord */
  ["CreateDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the domain */
    domainId: string;
    /** The type of the record */
    type: ResolverInputTypes["DNSRecordType"];
    /** The dns record name */
    name: string;
    /** The TTL in seconds */
    ttl: number;
    /** The content of the record */
    rdata: string;
  };
  /** Autogenerated return type of CreateDNSRecord. */
  ["CreateDNSRecordPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    record?: ResolverInputTypes["DNSRecord"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDelegatedWireGuardToken */
  ["CreateDelegatedWireGuardTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The name with which to refer to the peer */
    name?: string | undefined | null;
  };
  /** Autogenerated return type of CreateDelegatedWireGuardToken. */
  ["CreateDelegatedWireGuardTokenPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    token?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDoctorReport */
  ["CreateDoctorReportInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The report data */
    data: ResolverInputTypes["JSON"];
  };
  /** Autogenerated return type of CreateDoctorReport. */
  ["CreateDoctorReportPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    reportId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of CreateDoctorUrl. */
  ["CreateDoctorUrlPayload"]: AliasType<{
    putUrl?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateDomain */
  ["CreateDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The domain name */
    name: string;
  };
  /** Autogenerated return type of CreateDomain. */
  ["CreateDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ResolverInputTypes["Domain"];
    organization?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateExtensionTosAgreement */
  ["CreateExtensionTosAgreementInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The add-on provider name */
    addOnProviderName: string;
    /** The organization that agrees to the ToS */
    organizationId?: string | undefined | null;
  };
  /** Autogenerated return type of CreateExtensionTosAgreement. */
  ["CreateExtensionTosAgreementPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateLimitedAccessToken */
  ["CreateLimitedAccessTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    name: string;
    /** The node ID of the organization */
    organizationId: string;
    profile: string;
    profileParams?: ResolverInputTypes["JSON"] | undefined | null;
    expiry?: string | undefined | null;
    /** Names of third-party configurations to opt into */
    optInThirdParties?: Array<string> | undefined | null;
    /** Names of third-party configurations to opt out of */
    optOutThirdParties?: Array<string> | undefined | null;
  };
  /** Autogenerated return type of CreateLimitedAccessToken. */
  ["CreateLimitedAccessTokenPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    limitedAccessToken?: ResolverInputTypes["LimitedAccessToken"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateOrganization */
  ["CreateOrganizationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The name of the organization */
    name: string;
    /** Whether or not new apps in this org use Apps V2 by default */
    appsV2DefaultOn?: boolean | undefined | null;
  };
  /** Autogenerated input type of CreateOrganizationInvitation */
  ["CreateOrganizationInvitationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The email to invite */
    email: string;
  };
  /** Autogenerated return type of CreateOrganizationInvitation. */
  ["CreateOrganizationInvitationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    invitation?: ResolverInputTypes["OrganizationInvitation"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of CreateOrganization. */
  ["CreateOrganizationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ResolverInputTypes["Organization"];
    token?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreatePostgresClusterDatabase */
  ["CreatePostgresClusterDatabaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The name of the postgres cluster app */
    appName: string;
    /** The name of the database */
    databaseName: string;
  };
  /** Autogenerated return type of CreatePostgresClusterDatabase. */
  ["CreatePostgresClusterDatabasePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    database?: ResolverInputTypes["PostgresClusterDatabase"];
    postgresClusterRole?: ResolverInputTypes["PostgresClusterAppRole"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreatePostgresClusterUser */
  ["CreatePostgresClusterUserInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The name of the postgres cluster app */
    appName: string;
    /** The name of the database */
    username: string;
    /** The password of the user */
    password: string;
    /** Should this user be a superuser */
    superuser?: boolean | undefined | null;
  };
  /** Autogenerated return type of CreatePostgresClusterUser. */
  ["CreatePostgresClusterUserPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    postgresClusterRole?: ResolverInputTypes["PostgresClusterAppRole"];
    user?: ResolverInputTypes["PostgresClusterUser"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateRelease */
  ["CreateReleaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** The image to deploy */
    image: string;
    /** nomad or machines */
    platformVersion: string;
    /** app definition */
    definition: ResolverInputTypes["JSON"];
    /** The strategy for replacing existing instances. Defaults to canary. */
    strategy: ResolverInputTypes["DeploymentStrategy"];
  };
  /** Autogenerated return type of CreateRelease. */
  ["CreateReleasePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ResolverInputTypes["Release"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateTemplateDeployment */
  ["CreateTemplateDeploymentInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization to move the app to */
    organizationId: string;
    template: ResolverInputTypes["JSON"];
    variables?: Array<ResolverInputTypes["PropertyInput"]> | undefined | null;
  };
  /** Autogenerated return type of CreateTemplateDeployment. */
  ["CreateTemplateDeploymentPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    templateDeployment?: ResolverInputTypes["TemplateDeployment"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateThirdPartyConfiguration */
  ["CreateThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** Friendly name for this configuration */
    name: string;
    /** Location URL of the third-party service capable of discharging */
    location: string;
    /** Restrictions to be placed on third-party caveats */
    caveats?: ResolverInputTypes["CaveatSet"] | undefined | null;
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel: ResolverInputTypes["ThirdPartyConfigurationLevel"];
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel: ResolverInputTypes["ThirdPartyConfigurationLevel"];
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel: ResolverInputTypes["ThirdPartyConfigurationLevel"];
  };
  /** Autogenerated return type of CreateThirdPartyConfiguration. */
  ["CreateThirdPartyConfigurationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    thirdPartyConfiguration?: ResolverInputTypes["ThirdPartyConfiguration"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateVolume */
  ["CreateVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The application to attach the new volume to */
    appId: string;
    /** Volume name */
    name: string;
    /** Desired region for volume */
    region: string;
    /** Desired volume size, in GB */
    sizeGb: number;
    /** Volume should be encrypted at rest */
    encrypted?: boolean | undefined | null;
    /** Provision volume in a redundancy zone not already in use by this app */
    requireUniqueZone?: boolean | undefined | null;
    snapshotId?: string | undefined | null;
    fsType?: ResolverInputTypes["FsTypeType"] | undefined | null;
  };
  /** Autogenerated return type of CreateVolume. */
  ["CreateVolumePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    volume?: ResolverInputTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of CreateVolumeSnapshot */
  ["CreateVolumeSnapshotInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    volumeId: string;
  };
  /** Autogenerated return type of CreateVolumeSnapshot. */
  ["CreateVolumeSnapshotPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    volume?: ResolverInputTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSPortal"]: AliasType<{
    accentColor?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    organization?: ResolverInputTypes["Organization"];
    primaryColor?: boolean | `@${string}`;
    returnUrl?: boolean | `@${string}`;
    returnUrlText?: boolean | `@${string}`;
    supportUrl?: boolean | `@${string}`;
    supportUrlText?: boolean | `@${string}`;
    title?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for DNSPortal. */
  ["DNSPortalConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["DNSPortalEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["DNSPortal"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["DNSPortalEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["DNSPortal"];
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSPortalSession"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    /** The dns portal this session */
    dnsPortal?: ResolverInputTypes["DNSPortal"];
    expiresAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** Is this session expired? */
    isExpired?: boolean | `@${string}`;
    /** The overridden return url for this session */
    returnUrl?: boolean | `@${string}`;
    /** The overridden return url text for this session */
    returnUrlText?: boolean | `@${string}`;
    /** The overridden title for this session */
    title?: boolean | `@${string}`;
    /** The url to access this session's dns portal */
    url?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSRecord"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    /** The domain this record belongs to */
    domain?: ResolverInputTypes["Domain"];
    /** Fully qualified domain name for this record */
    fqdn?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** Is this record at the zone apex? */
    isApex?: boolean | `@${string}`;
    /** Is this a system record? System records are managed by fly and not editable. */
    isSystem?: boolean | `@${string}`;
    /** Is this record a wildcard? */
    isWildcard?: boolean | `@${string}`;
    /** The name of this record. @ indicates the record is at the zone apex. */
    name?: boolean | `@${string}`;
    /** The record data */
    rdata?: boolean | `@${string}`;
    /** The number of seconds this record can be cached for */
    ttl?: boolean | `@${string}`;
    /** The type of record */
    type?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSRecordAttributes"]: AliasType<{
    /** The name of the record. */
    name?: boolean | `@${string}`;
    /** The record data. */
    rdata?: boolean | `@${string}`;
    /** The number of seconds this record can be cached for. */
    ttl?: boolean | `@${string}`;
    /** The type of record. */
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSRecordChangeAction"]: DNSRecordChangeAction;
  ["DNSRecordChangeInput"]: {
    /** The action to perform on this record. */
    action: ResolverInputTypes["DNSRecordChangeAction"];
    /** The id of the record this action will apply to. This is required if the action is UPDATE or DELETE. */
    recordId?: string | undefined | null;
    /** The record type. This is required if action is CREATE. */
    type?: ResolverInputTypes["DNSRecordType"] | undefined | null;
    /** The name of the record. If omitted it will default to @ - the zone apex. */
    name?: string | undefined | null;
    /** The number of seconds this record can be cached for. Defaults to 1 hour. */
    ttl?: number | undefined | null;
    /** The record data. Required if action is CREATE */
    rdata?: string | undefined | null;
  };
  /** The connection type for DNSRecord. */
  ["DNSRecordConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["DNSRecordEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["DNSRecord"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSRecordDiff"]: AliasType<{
    /** The action that was performed. */
    action?: boolean | `@${string}`;
    /** The attributes for this record after the action was performed. */
    newAttributes?: ResolverInputTypes["DNSRecordAttributes"];
    /** The text representation of this record after the action was performed. */
    newText?: boolean | `@${string}`;
    /** The attributes for this record before the action was performed. */
    oldAttributes?: ResolverInputTypes["DNSRecordAttributes"];
    /** The text representation of this record before the action was performed. */
    oldText?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["DNSRecordEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["DNSRecord"];
    __typename?: boolean | `@${string}`;
  }>;
  ["DNSRecordType"]: DNSRecordType;
  ["DNSRecordWarning"]: AliasType<{
    /** The action to perform. */
    action?: boolean | `@${string}`;
    /** The desired attributes for this record. */
    attributes?: ResolverInputTypes["DNSRecordAttributes"];
    /** The warning message. */
    message?: boolean | `@${string}`;
    /** The record this warning applies to. */
    record?: ResolverInputTypes["DNSRecord"];
    __typename?: boolean | `@${string}`;
  }>;
  ["DelegatedWireGuardToken"]: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for DelegatedWireGuardToken. */
  ["DelegatedWireGuardTokenConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["DelegatedWireGuardTokenEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["DelegatedWireGuardToken"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["DelegatedWireGuardTokenEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["DelegatedWireGuardToken"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteAddOn */
  ["DeleteAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the add-on to delete */
    addOnId?: string | undefined | null;
    /** The name of the add-on to delete */
    name?: string | undefined | null;
  };
  /** Autogenerated return type of DeleteAddOn. */
  ["DeleteAddOnPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    deletedAddOnName?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of DeleteApp. */
  ["DeleteAppPayload"]: AliasType<{
    /** The organization that owned the deleted app */
    organization?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of DeleteCertificate. */
  ["DeleteCertificatePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    certificate?: ResolverInputTypes["AppCertificate"];
    errors?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDNSPortal */
  ["DeleteDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the dns portal */
    dnsPortalId: string;
  };
  /** Autogenerated return type of DeleteDNSPortal. */
  ["DeleteDNSPortalPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** The organization that owned the dns portal */
    organization?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDNSPortalSession */
  ["DeleteDNSPortalSessionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the dns portal session */
    dnsPortalSessionId: string;
  };
  /** Autogenerated return type of DeleteDNSPortalSession. */
  ["DeleteDNSPortalSessionPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** The dns portal that owned the session */
    dnsPortal?: ResolverInputTypes["DNSPortal"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDNSRecord */
  ["DeleteDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the DNS record */
    recordId: string;
  };
  /** Autogenerated return type of DeleteDNSRecord. */
  ["DeleteDNSRecordPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ResolverInputTypes["Domain"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDelegatedWireGuardToken */
  ["DeleteDelegatedWireGuardTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The raw WireGuard token */
    token?: string | undefined | null;
    /** The name with which to refer to the token */
    name?: string | undefined | null;
  };
  /** Autogenerated return type of DeleteDelegatedWireGuardToken. */
  ["DeleteDelegatedWireGuardTokenPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    token?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDeploymentSource */
  ["DeleteDeploymentSourceInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The application to update */
    appId: string;
  };
  /** Autogenerated return type of DeleteDeploymentSource. */
  ["DeleteDeploymentSourcePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteDomain */
  ["DeleteDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the domain */
    domainId: string;
  };
  /** Autogenerated return type of DeleteDomain. */
  ["DeleteDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteHealthCheckHandler */
  ["DeleteHealthCheckHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** Handler name */
    name: string;
  };
  /** Autogenerated return type of DeleteHealthCheckHandler. */
  ["DeleteHealthCheckHandlerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteLimitedAccessToken */
  ["DeleteLimitedAccessTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The root of the macaroon */
    token?: string | undefined | null;
    /** The node ID for real */
    id?: string | undefined | null;
  };
  /** Autogenerated return type of DeleteLimitedAccessToken. */
  ["DeleteLimitedAccessTokenPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    token?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteOrganization */
  ["DeleteOrganizationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the organization to delete */
    organizationId: string;
  };
  /** Autogenerated input type of DeleteOrganizationInvitation */
  ["DeleteOrganizationInvitationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the invitation */
    invitationId: string;
  };
  /** Autogenerated return type of DeleteOrganizationInvitation. */
  ["DeleteOrganizationInvitationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteOrganizationMembership */
  ["DeleteOrganizationMembershipInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The node ID of the user */
    userId: string;
  };
  /** Autogenerated return type of DeleteOrganizationMembership. */
  ["DeleteOrganizationMembershipPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ResolverInputTypes["Organization"];
    user?: ResolverInputTypes["User"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of DeleteOrganization. */
  ["DeleteOrganizationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    deletedOrganizationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteRemoteBuilder */
  ["DeleteRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
  };
  /** Autogenerated return type of DeleteRemoteBuilder. */
  ["DeleteRemoteBuilderPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteThirdPartyConfiguration */
  ["DeleteThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the configuration */
    thirdPartyConfigurationId: string;
  };
  /** Autogenerated return type of DeleteThirdPartyConfiguration. */
  ["DeleteThirdPartyConfigurationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    ok?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeleteVolume */
  ["DeleteVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the volume */
    volumeId: string;
    /** Unique lock ID */
    lockId?: string | undefined | null;
  };
  /** Autogenerated return type of DeleteVolume. */
  ["DeleteVolumePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DeployImage */
  ["DeployImageInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** The image to deploy */
    image: string;
    /** Network services to expose */
    services?: Array<ResolverInputTypes["ServiceInput"]> | undefined | null;
    /** app definition */
    definition?: ResolverInputTypes["JSON"] | undefined | null;
    /** The strategy for replacing existing instances. Defaults to canary. */
    strategy?: ResolverInputTypes["DeploymentStrategy"] | undefined | null;
  };
  /** Autogenerated return type of DeployImage. */
  ["DeployImagePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ResolverInputTypes["Release"];
    releaseCommand?: ResolverInputTypes["ReleaseCommand"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Continuous deployment configuration */
  ["DeploymentSource"]: AliasType<{
    backend?: boolean | `@${string}`;
    baseDir?: boolean | `@${string}`;
    connected?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    provider?: boolean | `@${string}`;
    /** The ref to build from */
    ref?: boolean | `@${string}`;
    repositoryId?: boolean | `@${string}`;
    /** The repository to fetch source code from */
    repositoryUrl?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DeploymentStatus"]: AliasType<{
    allocations?: ResolverInputTypes["Allocation"];
    description?: boolean | `@${string}`;
    desiredCount?: boolean | `@${string}`;
    healthyCount?: boolean | `@${string}`;
    /** Unique ID for this deployment */
    id?: boolean | `@${string}`;
    inProgress?: boolean | `@${string}`;
    placedCount?: boolean | `@${string}`;
    promoted?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    successful?: boolean | `@${string}`;
    unhealthyCount?: boolean | `@${string}`;
    version?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DeploymentStrategy"]: DeploymentStrategy;
  /** Autogenerated input type of DetachPostgresCluster */
  ["DetachPostgresClusterInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The postgres cluster application id */
    postgresClusterAppId: string;
    /** The application to detach postgres from */
    appId: string;
    /** The postgres attachment id */
    postgresClusterAttachmentId?: string | undefined | null;
  };
  /** Autogenerated return type of DetachPostgresCluster. */
  ["DetachPostgresClusterPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    postgresClusterApp?: ResolverInputTypes["App"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of DischargeRootToken */
  ["DischargeRootTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    rootToken: string;
    organizationId: number;
    expiry?: string | undefined | null;
  };
  /** Autogenerated return type of DischargeRootToken. */
  ["DischargeRootTokenPayload"]: AliasType<{
    authToken?: boolean | `@${string}`;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Domain"]: AliasType<{
    autoRenew?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** The delegated nameservers for the registration */
    delegatedNameservers?: boolean | `@${string}`;
    dnsRecords?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["DNSRecordConnection"]];
    dnsStatus?: boolean | `@${string}`;
    expiresAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** The name for this domain */
    name?: boolean | `@${string}`;
    /** The organization that owns this domain */
    organization?: ResolverInputTypes["Organization"];
    registrationStatus?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    /** The nameservers for the hosted zone */
    zoneNameservers?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Domain. */
  ["DomainConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["DomainEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["Domain"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["DomainDNSStatus"]: DomainDNSStatus;
  /** An edge in a connection. */
  ["DomainEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["Domain"];
    __typename?: boolean | `@${string}`;
  }>;
  ["DomainRegistrationStatus"]: DomainRegistrationStatus;
  /** Autogenerated input type of DummyWireGuardPeer */
  ["DummyWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The region in which to deploy the peer */
    region?: string | undefined | null;
  };
  /** Autogenerated return type of DummyWireGuardPeer. */
  ["DummyWireGuardPeerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    endpointip?: boolean | `@${string}`;
    localpub?: boolean | `@${string}`;
    peerip?: boolean | `@${string}`;
    privkey?: boolean | `@${string}`;
    pubkey?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["EmptyAppRole"]: AliasType<{
    /** The name of this role */
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of EnablePostgresConsul */
  ["EnablePostgresConsulInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId?: string | undefined | null;
    region?: string | undefined | null;
  };
  /** Autogenerated return type of EnablePostgresConsul. */
  ["EnablePostgresConsulPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    consulUrl?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of EnsureMachineRemoteBuilder */
  ["EnsureMachineRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The unique application name */
    appName?: string | undefined | null;
    /** The node ID of the organization */
    organizationId?: string | undefined | null;
    /** Desired region for the remote builder */
    region?: string | undefined | null;
    /** Use v2 machines */
    v2?: boolean | undefined | null;
  };
  /** Autogenerated return type of EnsureMachineRemoteBuilder. */
  ["EnsureMachineRemoteBuilderPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ResolverInputTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of EstablishSSHKey */
  ["EstablishSSHKeyInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** Establish a key even if one is already set */
    override?: boolean | undefined | null;
  };
  /** Autogenerated return type of EstablishSSHKey. */
  ["EstablishSSHKeyPayload"]: AliasType<{
    certificate?: boolean | `@${string}`;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ExportDNSZone */
  ["ExportDNSZoneInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** ID of the domain to export */
    domainId: string;
  };
  /** Autogenerated return type of ExportDNSZone. */
  ["ExportDNSZonePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    contents?: boolean | `@${string}`;
    domain?: ResolverInputTypes["Domain"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ExtendVolume */
  ["ExtendVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the volume */
    volumeId: string;
    /** The target volume size */
    sizeGb: number;
  };
  /** Autogenerated return type of ExtendVolume. */
  ["ExtendVolumePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    needsRestart?: boolean | `@${string}`;
    volume?: ResolverInputTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of FinishBuild */
  ["FinishBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** Build id returned by createBuild() mutation */
    buildId: string;
    /** The name of the app being built */
    appName: string;
    /** The ID of the machine being built (only set for machine builds) */
    machineId?: string | undefined | null;
    /** Indicate whether build completed or failed */
    status: string;
    /** Build strategies attempted and their result, should be in order of attempt */
    strategiesAttempted?:
      | Array<ResolverInputTypes["BuildStrategyAttemptInput"]>
      | undefined
      | null;
    /** Metadata about the builder */
    builderMeta?: ResolverInputTypes["BuilderMetaInput"] | undefined | null;
    /** Information about the docker image that was built */
    finalImage?: ResolverInputTypes["BuildFinalImageInput"] | undefined | null;
    /** Timings for different phases of the build */
    timings?: ResolverInputTypes["BuildTimingsInput"] | undefined | null;
    /** Log or error output */
    logs?: string | undefined | null;
  };
  /** Autogenerated return type of FinishBuild. */
  ["FinishBuildPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** build id */
    id?: boolean | `@${string}`;
    /** stored build status */
    status?: boolean | `@${string}`;
    /** wall clock time for this build */
    wallclockTimeMs?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["FlyPlatform"]: AliasType<{
    /** Latest flyctl release details */
    flyctl?: ResolverInputTypes["FlyctlRelease"];
    /** Fly global regions */
    regions?: ResolverInputTypes["Region"];
    /** Region current request from */
    requestRegion?: boolean | `@${string}`;
    /** Available VM sizes */
    vmSizes?: ResolverInputTypes["VMSize"];
    __typename?: boolean | `@${string}`;
  }>;
  ["FlyctlMachineHostAppRole"]: AliasType<{
    /** The name of this role */
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["FlyctlRelease"]: AliasType<{
    timestamp?: boolean | `@${string}`;
    version?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ForkVolume */
  ["ForkVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The application to attach the new volume to */
    appId: string;
    /** The volume to fork */
    sourceVolId: string;
    /** Volume name */
    name?: string | undefined | null;
    /** Lock the new volume to only usable on machines */
    machinesOnly?: boolean | undefined | null;
    /** Unique lock ID */
    lockId?: string | undefined | null;
    /** Enables experimental cross-host volume forking */
    remote?: boolean | undefined | null;
  };
  /** Autogenerated return type of ForkVolume. */
  ["ForkVolumePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    volume?: ResolverInputTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  ["FsTypeType"]: FsTypeType;
  ["GithubAppInstallation"]: AliasType<{
    editUrl?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    owner?: boolean | `@${string}`;
    repositories?: ResolverInputTypes["GithubRepository"];
    __typename?: boolean | `@${string}`;
  }>;
  ["GithubIntegration"]: AliasType<{
    installationUrl?: boolean | `@${string}`;
    installations?: ResolverInputTypes["GithubAppInstallation"];
    viewerAuthenticated?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["GithubRepository"]: AliasType<{
    fork?: boolean | `@${string}`;
    fullName?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    private?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of GrantPostgresClusterUserAccess */
  ["GrantPostgresClusterUserAccessInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The name of the postgres cluster app */
    appName: string;
    /** The name of the database */
    username: string;
    /** The database to grant access to */
    databaseName: string;
  };
  /** Autogenerated return type of GrantPostgresClusterUserAccess. */
  ["GrantPostgresClusterUserAccessPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    database?: ResolverInputTypes["PostgresClusterDatabase"];
    postgresClusterRole?: ResolverInputTypes["PostgresClusterAppRole"];
    user?: ResolverInputTypes["PostgresClusterUser"];
    __typename?: boolean | `@${string}`;
  }>;
  ["HTTPMethod"]: HTTPMethod;
  ["HTTPProtocol"]: HTTPProtocol;
  ["HealthCheck"]: AliasType<{
    /** Raw name of entity */
    entity?: boolean | `@${string}`;
    /** Time check last passed */
    lastPassing?: boolean | `@${string}`;
    /** Check name */
    name?: boolean | `@${string}`;
    /** Latest check output */
    output?: boolean | `@${string}`;
    /** Current check state */
    state?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for HealthCheck. */
  ["HealthCheckConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["HealthCheckEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["HealthCheck"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["HealthCheckEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["HealthCheck"];
    __typename?: boolean | `@${string}`;
  }>;
  ["HealthCheckHandler"]: AliasType<{
    /** Handler name */
    name?: boolean | `@${string}`;
    /** Handler type (Slack or Pagerduty) */
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for HealthCheckHandler. */
  ["HealthCheckHandlerConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["HealthCheckHandlerEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["HealthCheckHandler"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["HealthCheckHandlerEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["HealthCheckHandler"];
    __typename?: boolean | `@${string}`;
  }>;
  ["HerokuApp"]: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    releasedAt?: boolean | `@${string}`;
    stack?: boolean | `@${string}`;
    teamName?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["HerokuIntegration"]: AliasType<{
    herokuApps?: ResolverInputTypes["HerokuApp"];
    viewerAuthenticated?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Host"]: AliasType<{
    id?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["HostnameCheck"]: AliasType<{
    aRecords?: boolean | `@${string}`;
    aaaaRecords?: boolean | `@${string}`;
    acmeDnsConfigured?: boolean | `@${string}`;
    caaRecords?: boolean | `@${string}`;
    cnameRecords?: boolean | `@${string}`;
    dnsConfigured?: boolean | `@${string}`;
    dnsProvider?: boolean | `@${string}`;
    dnsVerificationRecord?: boolean | `@${string}`;
    errors?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    isProxied?: boolean | `@${string}`;
    resolvedAddresses?: boolean | `@${string}`;
    soa?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["IPAddress"]: AliasType<{
    address?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    type?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for IPAddress. */
  ["IPAddressConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["IPAddressEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["IPAddress"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["IPAddressEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["IPAddress"];
    __typename?: boolean | `@${string}`;
  }>;
  ["IPAddressType"]: IPAddressType;
  /** An ISO 8601-encoded datetime */
  ["ISO8601DateTime"]: unknown;
  ["Image"]: AliasType<{
    absoluteRef?: boolean | `@${string}`;
    compressedSize?: boolean | `@${string}`;
    compressedSizeFull?: boolean | `@${string}`;
    config?: boolean | `@${string}`;
    configDigest?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    digest?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    label?: boolean | `@${string}`;
    manifest?: boolean | `@${string}`;
    ref?: boolean | `@${string}`;
    registry?: boolean | `@${string}`;
    repository?: boolean | `@${string}`;
    tag?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["ImageVersion"]: AliasType<{
    digest?: boolean | `@${string}`;
    registry?: boolean | `@${string}`;
    repository?: boolean | `@${string}`;
    tag?: boolean | `@${string}`;
    version?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated return type of ImportCertificate. */
  ["ImportCertificatePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    appCertificate?: ResolverInputTypes["AppCertificate"];
    certificate?: ResolverInputTypes["Certificate"];
    errors?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ImportDNSZone */
  ["ImportDNSZoneInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** ID of the domain to export */
    domainId: string;
    zonefile: string;
  };
  /** Autogenerated return type of ImportDNSZone. */
  ["ImportDNSZonePayload"]: AliasType<{
    changes?: ResolverInputTypes["DNSRecordDiff"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ResolverInputTypes["Domain"];
    warnings?: ResolverInputTypes["DNSRecordWarning"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of IssueCertificate */
  ["IssueCertificateInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The names of the apps this certificate will be limited to accessing */
    appNames?: Array<string> | undefined | null;
    /** Hours for which certificate will be valid */
    validHours?: number | undefined | null;
    /** SSH principals for certificate (e.g. ["fly", "root"]) */
    principals?: Array<string> | undefined | null;
    /** The openssh-formatted ED25519 public key to issue the certificate for */
    publicKey?: string | undefined | null;
  };
  /** Autogenerated return type of IssueCertificate. */
  ["IssueCertificatePayload"]: AliasType<{
    certificate?: boolean | `@${string}`;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** The private key, if a public_key wasn't specified */
    key?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Untyped JSON data */
  ["JSON"]: unknown;
  /** Autogenerated input type of KillMachine */
  ["KillMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId?: string | undefined | null;
    /** machine id */
    id: string;
  };
  /** Autogenerated return type of KillMachine. */
  ["KillMachinePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ResolverInputTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of LaunchMachine */
  ["LaunchMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId?: string | undefined | null;
    /** The ID of the machine */
    id?: string | undefined | null;
    /** The name of the machine */
    name?: string | undefined | null;
    /** Region for the machine */
    region?: string | undefined | null;
    /** Configuration */
    config: ResolverInputTypes["JSON"];
  };
  /** Autogenerated return type of LaunchMachine. */
  ["LaunchMachinePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ResolverInputTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  ["LimitedAccessToken"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    expiresAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    profile?: boolean | `@${string}`;
    token?: boolean | `@${string}`;
    tokenHeader?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for LimitedAccessToken. */
  ["LimitedAccessTokenConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["LimitedAccessTokenEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["LimitedAccessToken"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["LimitedAccessTokenEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["LimitedAccessToken"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of LockApp */
  ["LockAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of LockApp. */
  ["LockAppPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** When this lock automatically expires */
    expiration?: boolean | `@${string}`;
    /** Unique lock ID */
    lockId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["LogEntry"]: AliasType<{
    id?: boolean | `@${string}`;
    instanceId?: boolean | `@${string}`;
    level?: boolean | `@${string}`;
    message?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of LogOut */
  ["LogOutInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
  };
  /** Autogenerated return type of LogOut. */
  ["LogOutPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    ok?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["LoggedCertificate"]: AliasType<{
    cert?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    root?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for LoggedCertificate. */
  ["LoggedCertificateConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["LoggedCertificateEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["LoggedCertificate"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["LoggedCertificateEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["LoggedCertificate"];
    __typename?: boolean | `@${string}`;
  }>;
  ["Macaroon"]: AliasType<{
    /** URL for avatar or placeholder */
    avatarUrl?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** Email address for principal */
    email?: boolean | `@${string}`;
    featureFlags?: boolean | `@${string}`;
    hasNodeproxyApps?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    lastRegion?: boolean | `@${string}`;
    /** Display name of principal */
    name?: boolean | `@${string}`;
    organizations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["OrganizationConnection"]];
    personalOrganization?: ResolverInputTypes["Organization"];
    trust?: boolean | `@${string}`;
    twoFactorProtection?: boolean | `@${string}`;
    username?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Machine"]: AliasType<{
    app?: ResolverInputTypes["App"];
    config?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    events?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      kind?: string | undefined | null;
    }, ResolverInputTypes["MachineEventConnection"]];
    host?: ResolverInputTypes["Host"];
    id?: boolean | `@${string}`;
    instanceId?: boolean | `@${string}`;
    ips?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["MachineIPConnection"]];
    name?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    state?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Machine. */
  ["MachineConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["MachineEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["Machine"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["MachineEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  /** A machine state change event */
  ["MachineEvent"]: AliasType<{
    id?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    ["...on MachineEventDestroy"]?: Omit<
      ResolverInputTypes["MachineEventDestroy"],
      keyof ResolverInputTypes["MachineEvent"]
    >;
    ["...on MachineEventExit"]?: Omit<
      ResolverInputTypes["MachineEventExit"],
      keyof ResolverInputTypes["MachineEvent"]
    >;
    ["...on MachineEventGeneric"]?: Omit<
      ResolverInputTypes["MachineEventGeneric"],
      keyof ResolverInputTypes["MachineEvent"]
    >;
    ["...on MachineEventStart"]?: Omit<
      ResolverInputTypes["MachineEventStart"],
      keyof ResolverInputTypes["MachineEvent"]
    >;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for MachineEvent. */
  ["MachineEventConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["MachineEventEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["MachineEvent"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    __typename?: boolean | `@${string}`;
  }>;
  ["MachineEventDestroy"]: AliasType<{
    id?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["MachineEventEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["MachineEvent"];
    __typename?: boolean | `@${string}`;
  }>;
  ["MachineEventExit"]: AliasType<{
    exitCode?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    metadata?: boolean | `@${string}`;
    oomKilled?: boolean | `@${string}`;
    requestedStop?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["MachineEventGeneric"]: AliasType<{
    id?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["MachineEventStart"]: AliasType<{
    id?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    timestamp?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["MachineIP"]: AliasType<{
    family?: boolean | `@${string}`;
    /** ID of the object. */
    id?: boolean | `@${string}`;
    ip?: boolean | `@${string}`;
    kind?: boolean | `@${string}`;
    maskSize?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for MachineIP. */
  ["MachineIPConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["MachineIPEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["MachineIP"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["MachineIPEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["MachineIP"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of MoveApp */
  ["MoveAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The application to move */
    appId: string;
    /** The node ID of the organization to move the app to */
    organizationId: string;
  };
  /** Autogenerated return type of MoveApp. */
  ["MoveAppPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Mutations"]: AliasType<{
    addCertificate?: [{
      /** The application to attach the new hostname to */
      appId: string; /** Certificate's hostname */
      hostname: string;
    }, ResolverInputTypes["AddCertificatePayload"]];
    addWireGuardPeer?: [{
      /** Parameters for AddWireGuardPeer */
      input: ResolverInputTypes["AddWireGuardPeerInput"];
    }, ResolverInputTypes["AddWireGuardPeerPayload"]];
    allocateIpAddress?: [{
      /** Parameters for AllocateIPAddress */
      input: ResolverInputTypes["AllocateIPAddressInput"];
    }, ResolverInputTypes["AllocateIPAddressPayload"]];
    attachPostgresCluster?: [{
      /** Parameters for AttachPostgresCluster */
      input: ResolverInputTypes["AttachPostgresClusterInput"];
    }, ResolverInputTypes["AttachPostgresClusterPayload"]];
    cancelBuild?: [{
      /** The node ID of the build */
      buildId: string;
    }, ResolverInputTypes["CancelBuildPayload"]];
    checkCertificate?: [{
      /** Parameters for CheckCertificate */
      input: ResolverInputTypes["CheckCertificateInput"];
    }, ResolverInputTypes["CheckCertificatePayload"]];
    checkDomain?: [{
      /** Parameters for CheckDomain */
      input: ResolverInputTypes["CheckDomainInput"];
    }, ResolverInputTypes["CheckDomainPayload"]];
    configureRegions?: [{
      /** Parameters for ConfigureRegions */
      input: ResolverInputTypes["ConfigureRegionsInput"];
    }, ResolverInputTypes["ConfigureRegionsPayload"]];
    createAddOn?: [{
      /** Parameters for CreateAddOn */
      input: ResolverInputTypes["CreateAddOnInput"];
    }, ResolverInputTypes["CreateAddOnPayload"]];
    createAndRegisterDomain?: [{
      /** Parameters for CreateAndRegisterDomain */
      input: ResolverInputTypes["CreateAndRegisterDomainInput"];
    }, ResolverInputTypes["CreateAndRegisterDomainPayload"]];
    createAndTransferDomain?: [{
      /** Parameters for CreateAndTransferDomain */
      input: ResolverInputTypes["CreateAndTransferDomainInput"];
    }, ResolverInputTypes["CreateAndTransferDomainPayload"]];
    createApp?: [{
      /** Parameters for CreateApp */
      input: ResolverInputTypes["CreateAppInput"];
    }, ResolverInputTypes["CreateAppPayload"]];
    createBuild?: [{
      /** Parameters for CreateBuild */
      input: ResolverInputTypes["CreateBuildInput"];
    }, ResolverInputTypes["CreateBuildPayload"]];
    createCheckJob?: [{
      /** Parameters for CreateCheckJob */
      input: ResolverInputTypes["CreateCheckJobInput"];
    }, ResolverInputTypes["CreateCheckJobPayload"]];
    createCheckJobRun?: [{
      /** Parameters for CreateCheckJobRun */
      input: ResolverInputTypes["CreateCheckJobRunInput"];
    }, ResolverInputTypes["CreateCheckJobRunPayload"]];
    createDelegatedWireGuardToken?: [{
      /** Parameters for CreateDelegatedWireGuardToken */
      input: ResolverInputTypes["CreateDelegatedWireGuardTokenInput"];
    }, ResolverInputTypes["CreateDelegatedWireGuardTokenPayload"]];
    createDnsPortal?: [{
      /** Parameters for CreateDNSPortal */
      input: ResolverInputTypes["CreateDNSPortalInput"];
    }, ResolverInputTypes["CreateDNSPortalPayload"]];
    createDnsPortalSession?: [{
      /** Parameters for CreateDNSPortalSession */
      input: ResolverInputTypes["CreateDNSPortalSessionInput"];
    }, ResolverInputTypes["CreateDNSPortalSessionPayload"]];
    createDnsRecord?: [{
      /** Parameters for CreateDNSRecord */
      input: ResolverInputTypes["CreateDNSRecordInput"];
    }, ResolverInputTypes["CreateDNSRecordPayload"]];
    createDoctorReport?: [{
      /** Parameters for CreateDoctorReport */
      input: ResolverInputTypes["CreateDoctorReportInput"];
    }, ResolverInputTypes["CreateDoctorReportPayload"]];
    createDoctorUrl?: ResolverInputTypes["CreateDoctorUrlPayload"];
    createDomain?: [{
      /** Parameters for CreateDomain */
      input: ResolverInputTypes["CreateDomainInput"];
    }, ResolverInputTypes["CreateDomainPayload"]];
    createExtensionTosAgreement?: [{
      /** Parameters for CreateExtensionTosAgreement */
      input: ResolverInputTypes["CreateExtensionTosAgreementInput"];
    }, ResolverInputTypes["CreateExtensionTosAgreementPayload"]];
    createLimitedAccessToken?: [{
      /** Parameters for CreateLimitedAccessToken */
      input: ResolverInputTypes["CreateLimitedAccessTokenInput"];
    }, ResolverInputTypes["CreateLimitedAccessTokenPayload"]];
    createOrganization?: [{
      /** Parameters for CreateOrganization */
      input: ResolverInputTypes["CreateOrganizationInput"];
    }, ResolverInputTypes["CreateOrganizationPayload"]];
    createOrganizationInvitation?: [{
      /** Parameters for CreateOrganizationInvitation */
      input: ResolverInputTypes["CreateOrganizationInvitationInput"];
    }, ResolverInputTypes["CreateOrganizationInvitationPayload"]];
    createPostgresClusterDatabase?: [{
      /** Parameters for CreatePostgresClusterDatabase */
      input: ResolverInputTypes["CreatePostgresClusterDatabaseInput"];
    }, ResolverInputTypes["CreatePostgresClusterDatabasePayload"]];
    createPostgresClusterUser?: [{
      /** Parameters for CreatePostgresClusterUser */
      input: ResolverInputTypes["CreatePostgresClusterUserInput"];
    }, ResolverInputTypes["CreatePostgresClusterUserPayload"]];
    createRelease?: [{
      /** Parameters for CreateRelease */
      input: ResolverInputTypes["CreateReleaseInput"];
    }, ResolverInputTypes["CreateReleasePayload"]];
    createTemplateDeployment?: [{
      /** Parameters for CreateTemplateDeployment */
      input: ResolverInputTypes["CreateTemplateDeploymentInput"];
    }, ResolverInputTypes["CreateTemplateDeploymentPayload"]];
    createThirdPartyConfiguration?: [{
      /** Parameters for CreateThirdPartyConfiguration */
      input: ResolverInputTypes["CreateThirdPartyConfigurationInput"];
    }, ResolverInputTypes["CreateThirdPartyConfigurationPayload"]];
    createVolume?: [{
      /** Parameters for CreateVolume */
      input: ResolverInputTypes["CreateVolumeInput"];
    }, ResolverInputTypes["CreateVolumePayload"]];
    createVolumeSnapshot?: [{
      /** Parameters for CreateVolumeSnapshot */
      input: ResolverInputTypes["CreateVolumeSnapshotInput"];
    }, ResolverInputTypes["CreateVolumeSnapshotPayload"]];
    deleteAddOn?: [{
      /** Parameters for DeleteAddOn */
      input: ResolverInputTypes["DeleteAddOnInput"];
    }, ResolverInputTypes["DeleteAddOnPayload"]];
    deleteApp?: [{
      /** The application to delete */
      appId: string;
    }, ResolverInputTypes["DeleteAppPayload"]];
    deleteCertificate?: [{
      /** Application to remove hostname from */
      appId: string; /** Certificate hostname to delete */
      hostname: string;
    }, ResolverInputTypes["DeleteCertificatePayload"]];
    deleteDelegatedWireGuardToken?: [{
      /** Parameters for DeleteDelegatedWireGuardToken */
      input: ResolverInputTypes["DeleteDelegatedWireGuardTokenInput"];
    }, ResolverInputTypes["DeleteDelegatedWireGuardTokenPayload"]];
    deleteDeploymentSource?: [{
      /** Parameters for DeleteDeploymentSource */
      input: ResolverInputTypes["DeleteDeploymentSourceInput"];
    }, ResolverInputTypes["DeleteDeploymentSourcePayload"]];
    deleteDnsPortal?: [{
      /** Parameters for DeleteDNSPortal */
      input: ResolverInputTypes["DeleteDNSPortalInput"];
    }, ResolverInputTypes["DeleteDNSPortalPayload"]];
    deleteDnsPortalSession?: [{
      /** Parameters for DeleteDNSPortalSession */
      input: ResolverInputTypes["DeleteDNSPortalSessionInput"];
    }, ResolverInputTypes["DeleteDNSPortalSessionPayload"]];
    deleteDnsRecord?: [{
      /** Parameters for DeleteDNSRecord */
      input: ResolverInputTypes["DeleteDNSRecordInput"];
    }, ResolverInputTypes["DeleteDNSRecordPayload"]];
    deleteDomain?: [{
      /** Parameters for DeleteDomain */
      input: ResolverInputTypes["DeleteDomainInput"];
    }, ResolverInputTypes["DeleteDomainPayload"]];
    deleteHealthCheckHandler?: [{
      /** Parameters for DeleteHealthCheckHandler */
      input: ResolverInputTypes["DeleteHealthCheckHandlerInput"];
    }, ResolverInputTypes["DeleteHealthCheckHandlerPayload"]];
    deleteLimitedAccessToken?: [{
      /** Parameters for DeleteLimitedAccessToken */
      input: ResolverInputTypes["DeleteLimitedAccessTokenInput"];
    }, ResolverInputTypes["DeleteLimitedAccessTokenPayload"]];
    deleteOrganization?: [{
      /** Parameters for DeleteOrganization */
      input: ResolverInputTypes["DeleteOrganizationInput"];
    }, ResolverInputTypes["DeleteOrganizationPayload"]];
    deleteOrganizationInvitation?: [{
      /** Parameters for DeleteOrganizationInvitation */
      input: ResolverInputTypes["DeleteOrganizationInvitationInput"];
    }, ResolverInputTypes["DeleteOrganizationInvitationPayload"]];
    deleteOrganizationMembership?: [{
      /** Parameters for DeleteOrganizationMembership */
      input: ResolverInputTypes["DeleteOrganizationMembershipInput"];
    }, ResolverInputTypes["DeleteOrganizationMembershipPayload"]];
    deleteRemoteBuilder?: [{
      /** Parameters for DeleteRemoteBuilder */
      input: ResolverInputTypes["DeleteRemoteBuilderInput"];
    }, ResolverInputTypes["DeleteRemoteBuilderPayload"]];
    deleteThirdPartyConfiguration?: [{
      /** Parameters for DeleteThirdPartyConfiguration */
      input: ResolverInputTypes["DeleteThirdPartyConfigurationInput"];
    }, ResolverInputTypes["DeleteThirdPartyConfigurationPayload"]];
    deleteVolume?: [{
      /** Parameters for DeleteVolume */
      input: ResolverInputTypes["DeleteVolumeInput"];
    }, ResolverInputTypes["DeleteVolumePayload"]];
    deployImage?: [{
      /** Parameters for DeployImage */
      input: ResolverInputTypes["DeployImageInput"];
    }, ResolverInputTypes["DeployImagePayload"]];
    detachPostgresCluster?: [{
      /** Parameters for DetachPostgresCluster */
      input: ResolverInputTypes["DetachPostgresClusterInput"];
    }, ResolverInputTypes["DetachPostgresClusterPayload"]];
    dischargeRootToken?: [{
      /** Parameters for DischargeRootToken */
      input: ResolverInputTypes["DischargeRootTokenInput"];
    }, ResolverInputTypes["DischargeRootTokenPayload"]];
    dummyWireGuardPeer?: [{
      /** Parameters for DummyWireGuardPeer */
      input: ResolverInputTypes["DummyWireGuardPeerInput"];
    }, ResolverInputTypes["DummyWireGuardPeerPayload"]];
    enablePostgresConsul?: [{
      /** Parameters for EnablePostgresConsul */
      input: ResolverInputTypes["EnablePostgresConsulInput"];
    }, ResolverInputTypes["EnablePostgresConsulPayload"]];
    ensureMachineRemoteBuilder?: [{
      /** Parameters for EnsureMachineRemoteBuilder */
      input: ResolverInputTypes["EnsureMachineRemoteBuilderInput"];
    }, ResolverInputTypes["EnsureMachineRemoteBuilderPayload"]];
    establishSshKey?: [{
      /** Parameters for EstablishSSHKey */
      input: ResolverInputTypes["EstablishSSHKeyInput"];
    }, ResolverInputTypes["EstablishSSHKeyPayload"]];
    exportDnsZone?: [{
      /** Parameters for ExportDNSZone */
      input: ResolverInputTypes["ExportDNSZoneInput"];
    }, ResolverInputTypes["ExportDNSZonePayload"]];
    extendVolume?: [{
      /** Parameters for ExtendVolume */
      input: ResolverInputTypes["ExtendVolumeInput"];
    }, ResolverInputTypes["ExtendVolumePayload"]];
    finishBuild?: [{
      /** Parameters for FinishBuild */
      input: ResolverInputTypes["FinishBuildInput"];
    }, ResolverInputTypes["FinishBuildPayload"]];
    forkVolume?: [{
      /** Parameters for ForkVolume */
      input: ResolverInputTypes["ForkVolumeInput"];
    }, ResolverInputTypes["ForkVolumePayload"]];
    grantPostgresClusterUserAccess?: [{
      /** Parameters for GrantPostgresClusterUserAccess */
      input: ResolverInputTypes["GrantPostgresClusterUserAccessInput"];
    }, ResolverInputTypes["GrantPostgresClusterUserAccessPayload"]];
    importCertificate?: [{
      /** The application to attach the new hostname to */
      appId: string; /** Full chain for certificate */
      fullchain: string; /** Private signing key for certificate */
      privateKey:
        string; /** Hostname for certificate (certificate Common Name by default) */
      hostname?: string | undefined | null;
    }, ResolverInputTypes["ImportCertificatePayload"]];
    importDnsZone?: [{
      /** Parameters for ImportDNSZone */
      input: ResolverInputTypes["ImportDNSZoneInput"];
    }, ResolverInputTypes["ImportDNSZonePayload"]];
    issueCertificate?: [{
      /** Parameters for IssueCertificate */
      input: ResolverInputTypes["IssueCertificateInput"];
    }, ResolverInputTypes["IssueCertificatePayload"]];
    killMachine?: [{
      /** Parameters for KillMachine */
      input: ResolverInputTypes["KillMachineInput"];
    }, ResolverInputTypes["KillMachinePayload"]];
    launchMachine?: [{
      /** Parameters for LaunchMachine */
      input: ResolverInputTypes["LaunchMachineInput"];
    }, ResolverInputTypes["LaunchMachinePayload"]];
    lockApp?: [{
      /** Parameters for LockApp */
      input: ResolverInputTypes["LockAppInput"];
    }, ResolverInputTypes["LockAppPayload"]];
    logOut?: [{
      /** Parameters for LogOut */
      input: ResolverInputTypes["LogOutInput"];
    }, ResolverInputTypes["LogOutPayload"]];
    moveApp?: [{
      /** Parameters for MoveApp */
      input: ResolverInputTypes["MoveAppInput"];
    }, ResolverInputTypes["MoveAppPayload"]];
    nomadToMachinesMigration?: [{
      /** Parameters for NomadToMachinesMigration */
      input: ResolverInputTypes["NomadToMachinesMigrationInput"];
    }, ResolverInputTypes["NomadToMachinesMigrationPayload"]];
    nomadToMachinesMigrationPrep?: [{
      /** Parameters for NomadToMachinesMigrationPrep */
      input: ResolverInputTypes["NomadToMachinesMigrationPrepInput"];
    }, ResolverInputTypes["NomadToMachinesMigrationPrepPayload"]];
    pauseApp?: [{
      /** Parameters for PauseApp */
      input: ResolverInputTypes["PauseAppInput"];
    }, ResolverInputTypes["PauseAppPayload"]];
    registerDomain?: [{
      /** Parameters for RegisterDomain */
      input: ResolverInputTypes["RegisterDomainInput"];
    }, ResolverInputTypes["RegisterDomainPayload"]];
    releaseIpAddress?: [{
      /** Parameters for ReleaseIPAddress */
      input: ResolverInputTypes["ReleaseIPAddressInput"];
    }, ResolverInputTypes["ReleaseIPAddressPayload"]];
    removeMachine?: [{
      /** Parameters for RemoveMachine */
      input: ResolverInputTypes["RemoveMachineInput"];
    }, ResolverInputTypes["RemoveMachinePayload"]];
    removeWireGuardPeer?: [{
      /** Parameters for RemoveWireGuardPeer */
      input: ResolverInputTypes["RemoveWireGuardPeerInput"];
    }, ResolverInputTypes["RemoveWireGuardPeerPayload"]];
    resetAddOnPassword?: [{
      /** Parameters for ResetAddOnPassword */
      input: ResolverInputTypes["ResetAddOnPasswordInput"];
    }, ResolverInputTypes["ResetAddOnPasswordPayload"]];
    restartAllocation?: [{
      /** Parameters for RestartAllocation */
      input: ResolverInputTypes["RestartAllocationInput"];
    }, ResolverInputTypes["RestartAllocationPayload"]];
    restartApp?: [{
      /** Parameters for RestartApp */
      input: ResolverInputTypes["RestartAppInput"];
    }, ResolverInputTypes["RestartAppPayload"]];
    restoreVolumeSnapshot?: [{
      /** Parameters for RestoreVolumeSnapshot */
      input: ResolverInputTypes["RestoreVolumeSnapshotInput"];
    }, ResolverInputTypes["RestoreVolumeSnapshotPayload"]];
    resumeApp?: [{
      /** Parameters for ResumeApp */
      input: ResolverInputTypes["ResumeAppInput"];
    }, ResolverInputTypes["ResumeAppPayload"]];
    revokePostgresClusterUserAccess?: [{
      /** Parameters for RevokePostgresClusterUserAccess */
      input: ResolverInputTypes["RevokePostgresClusterUserAccessInput"];
    }, ResolverInputTypes["RevokePostgresClusterUserAccessPayload"]];
    saveDeploymentSource?: [{
      /** Parameters for SaveDeploymentSource */
      input: ResolverInputTypes["SaveDeploymentSourceInput"];
    }, ResolverInputTypes["SaveDeploymentSourcePayload"]];
    scaleApp?: [{
      /** Parameters for ScaleApp */
      input: ResolverInputTypes["ScaleAppInput"];
    }, ResolverInputTypes["ScaleAppPayload"]];
    setAppsV2DefaultOn?: [{
      /** Parameters for SetAppsv2DefaultOn */
      input: ResolverInputTypes["SetAppsv2DefaultOnInput"];
    }, ResolverInputTypes["SetAppsv2DefaultOnPayload"]];
    setPagerdutyHandler?: [{
      /** Parameters for SetPagerdutyHandler */
      input: ResolverInputTypes["SetPagerdutyHandlerInput"];
    }, ResolverInputTypes["SetPagerdutyHandlerPayload"]];
    setPlatformVersion?: [{
      /** Parameters for SetPlatformVersion */
      input: ResolverInputTypes["SetPlatformVersionInput"];
    }, ResolverInputTypes["SetPlatformVersionPayload"]];
    setSecrets?: [{
      /** Parameters for SetSecrets */
      input: ResolverInputTypes["SetSecretsInput"];
    }, ResolverInputTypes["SetSecretsPayload"]];
    setSlackHandler?: [{
      /** Parameters for SetSlackHandler */
      input: ResolverInputTypes["SetSlackHandlerInput"];
    }, ResolverInputTypes["SetSlackHandlerPayload"]];
    setVmCount?: [{
      /** Parameters for SetVMCount */
      input: ResolverInputTypes["SetVMCountInput"];
    }, ResolverInputTypes["SetVMCountPayload"]];
    setVmSize?: [{
      /** Parameters for SetVMSize */
      input: ResolverInputTypes["SetVMSizeInput"];
    }, ResolverInputTypes["SetVMSizePayload"]];
    startBuild?: [{
      /** Parameters for StartBuild */
      input: ResolverInputTypes["StartBuildInput"];
    }, ResolverInputTypes["StartBuildPayload"]];
    startMachine?: [{
      /** Parameters for StartMachine */
      input: ResolverInputTypes["StartMachineInput"];
    }, ResolverInputTypes["StartMachinePayload"]];
    stopAllocation?: [{
      /** Parameters for StopAllocation */
      input: ResolverInputTypes["StopAllocationInput"];
    }, ResolverInputTypes["StopAllocationPayload"]];
    stopMachine?: [{
      /** Parameters for StopMachine */
      input: ResolverInputTypes["StopMachineInput"];
    }, ResolverInputTypes["StopMachinePayload"]];
    unlockApp?: [{
      /** Parameters for UnlockApp */
      input: ResolverInputTypes["UnlockAppInput"];
    }, ResolverInputTypes["UnlockAppPayload"]];
    unsetSecrets?: [{
      /** Parameters for UnsetSecrets */
      input: ResolverInputTypes["UnsetSecretsInput"];
    }, ResolverInputTypes["UnsetSecretsPayload"]];
    updateAddOn?: [{
      /** Parameters for UpdateAddOn */
      input: ResolverInputTypes["UpdateAddOnInput"];
    }, ResolverInputTypes["UpdateAddOnPayload"]];
    updateAutoscaleConfig?: [{
      /** Parameters for UpdateAutoscaleConfig */
      input: ResolverInputTypes["UpdateAutoscaleConfigInput"];
    }, ResolverInputTypes["UpdateAutoscaleConfigPayload"]];
    updateDnsPortal?: [{
      /** Parameters for UpdateDNSPortal */
      input: ResolverInputTypes["UpdateDNSPortalInput"];
    }, ResolverInputTypes["UpdateDNSPortalPayload"]];
    updateDnsRecord?: [{
      /** Parameters for UpdateDNSRecord */
      input: ResolverInputTypes["UpdateDNSRecordInput"];
    }, ResolverInputTypes["UpdateDNSRecordPayload"]];
    updateDnsRecords?: [{
      /** Parameters for UpdateDNSRecords */
      input: ResolverInputTypes["UpdateDNSRecordsInput"];
    }, ResolverInputTypes["UpdateDNSRecordsPayload"]];
    updateOrganizationMembership?: [{
      /** Parameters for UpdateOrganizationMembership */
      input: ResolverInputTypes["UpdateOrganizationMembershipInput"];
    }, ResolverInputTypes["UpdateOrganizationMembershipPayload"]];
    updateRelease?: [{
      /** Parameters for UpdateRelease */
      input: ResolverInputTypes["UpdateReleaseInput"];
    }, ResolverInputTypes["UpdateReleasePayload"]];
    updateRemoteBuilder?: [{
      /** Parameters for UpdateRemoteBuilder */
      input: ResolverInputTypes["UpdateRemoteBuilderInput"];
    }, ResolverInputTypes["UpdateRemoteBuilderPayload"]];
    updateThirdPartyConfiguration?: [{
      /** Parameters for UpdateThirdPartyConfiguration */
      input: ResolverInputTypes["UpdateThirdPartyConfigurationInput"];
    }, ResolverInputTypes["UpdateThirdPartyConfigurationPayload"]];
    validateWireGuardPeers?: [{
      /** Parameters for ValidateWireGuardPeers */
      input: ResolverInputTypes["ValidateWireGuardPeersInput"];
    }, ResolverInputTypes["ValidateWireGuardPeersPayload"]];
    __typename?: boolean | `@${string}`;
  }>;
  /** An object with an ID. */
  ["Node"]: AliasType<{
    /** ID of the object. */
    id?: boolean | `@${string}`;
    ["...on AccessToken"]?: Omit<
      ResolverInputTypes["AccessToken"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on AddOn"]?: Omit<
      ResolverInputTypes["AddOn"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on AddOnPlan"]?: Omit<
      ResolverInputTypes["AddOnPlan"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on Allocation"]?: Omit<
      ResolverInputTypes["Allocation"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on App"]?: Omit<
      ResolverInputTypes["App"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on AppCertificate"]?: Omit<
      ResolverInputTypes["AppCertificate"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on AppChange"]?: Omit<
      ResolverInputTypes["AppChange"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on Build"]?: Omit<
      ResolverInputTypes["Build"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on Certificate"]?: Omit<
      ResolverInputTypes["Certificate"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on CheckHTTPResponse"]?: Omit<
      ResolverInputTypes["CheckHTTPResponse"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on CheckJob"]?: Omit<
      ResolverInputTypes["CheckJob"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on CheckJobRun"]?: Omit<
      ResolverInputTypes["CheckJobRun"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on DNSPortal"]?: Omit<
      ResolverInputTypes["DNSPortal"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on DNSPortalSession"]?: Omit<
      ResolverInputTypes["DNSPortalSession"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on DNSRecord"]?: Omit<
      ResolverInputTypes["DNSRecord"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on DelegatedWireGuardToken"]?: Omit<
      ResolverInputTypes["DelegatedWireGuardToken"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on Domain"]?: Omit<
      ResolverInputTypes["Domain"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on Host"]?: Omit<
      ResolverInputTypes["Host"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on IPAddress"]?: Omit<
      ResolverInputTypes["IPAddress"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on LimitedAccessToken"]?: Omit<
      ResolverInputTypes["LimitedAccessToken"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on LoggedCertificate"]?: Omit<
      ResolverInputTypes["LoggedCertificate"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on Machine"]?: Omit<
      ResolverInputTypes["Machine"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on MachineIP"]?: Omit<
      ResolverInputTypes["MachineIP"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on Organization"]?: Omit<
      ResolverInputTypes["Organization"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on OrganizationInvitation"]?: Omit<
      ResolverInputTypes["OrganizationInvitation"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on PostgresClusterAttachment"]?: Omit<
      ResolverInputTypes["PostgresClusterAttachment"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on Release"]?: Omit<
      ResolverInputTypes["Release"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on ReleaseCommand"]?: Omit<
      ResolverInputTypes["ReleaseCommand"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on ReleaseUnprocessed"]?: Omit<
      ResolverInputTypes["ReleaseUnprocessed"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on Secret"]?: Omit<
      ResolverInputTypes["Secret"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on TemplateDeployment"]?: Omit<
      ResolverInputTypes["TemplateDeployment"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on ThirdPartyConfiguration"]?: Omit<
      ResolverInputTypes["ThirdPartyConfiguration"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on User"]?: Omit<
      ResolverInputTypes["User"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on UserCoupon"]?: Omit<
      ResolverInputTypes["UserCoupon"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on VM"]?: Omit<
      ResolverInputTypes["VM"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on Volume"]?: Omit<
      ResolverInputTypes["Volume"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on VolumeSnapshot"]?: Omit<
      ResolverInputTypes["VolumeSnapshot"],
      keyof ResolverInputTypes["Node"]
    >;
    ["...on WireGuardPeer"]?: Omit<
      ResolverInputTypes["WireGuardPeer"],
      keyof ResolverInputTypes["Node"]
    >;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of NomadToMachinesMigration */
  ["NomadToMachinesMigrationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The application to move */
    appId: string;
  };
  /** Autogenerated return type of NomadToMachinesMigration. */
  ["NomadToMachinesMigrationPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of NomadToMachinesMigrationPrep */
  ["NomadToMachinesMigrationPrepInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The application to move */
    appId: string;
  };
  /** Autogenerated return type of NomadToMachinesMigrationPrep. */
  ["NomadToMachinesMigrationPrepPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Organization"]: AliasType<{
    activeDiscountName?: boolean | `@${string}`;
    /** Single sign-on link for the given integration type */
    addOnSsoLink?: boolean | `@${string}`;
    addOns?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      type?: ResolverInputTypes["AddOnType"] | undefined | null;
    }, ResolverInputTypes["AddOnConnection"]];
    agreedToProviderTos?: [{ providerName: string }, boolean | `@${string}`];
    apps?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["AppConnection"]];
    billable?: boolean | `@${string}`;
    billingStatus?: boolean | `@${string}`;
    /** The account credits in cents */
    creditBalance?: boolean | `@${string}`;
    /** The formatted account credits */
    creditBalanceFormatted?: boolean | `@${string}`;
    delegatedWireGuardTokens?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["DelegatedWireGuardTokenConnection"]];
    dnsPortal?: [{ name: string }, ResolverInputTypes["DNSPortal"]];
    dnsPortals?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["DNSPortalConnection"]];
    domain?: [{ name: string }, ResolverInputTypes["Domain"]];
    domains?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["DomainConnection"]];
    extensionSsoLink?: [{ provider: string }, boolean | `@${string}`];
    healthCheckHandlers?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["HealthCheckHandlerConnection"]];
    healthChecks?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["HealthCheckConnection"]];
    id?: boolean | `@${string}`;
    internalNumericId?: boolean | `@${string}`;
    invitations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["OrganizationInvitationConnection"]];
    isCreditCardSaved?: boolean | `@${string}`;
    limitedAccessTokens?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["LimitedAccessTokenConnection"]];
    loggedCertificates?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["LoggedCertificateConnection"]];
    members?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["OrganizationMembershipsConnection"]];
    /** Organization name */
    name?: boolean | `@${string}`;
    paidPlan?: boolean | `@${string}`;
    /** Whether the organization can provision beta extensions */
    provisionsBetaExtensions?: boolean | `@${string}`;
    /** Unmodified unique org slug */
    rawSlug?: boolean | `@${string}`;
    remoteBuilderApp?: ResolverInputTypes["App"];
    remoteBuilderImage?: boolean | `@${string}`;
    settings?: boolean | `@${string}`;
    /** Unique organization slug */
    slug?: boolean | `@${string}`;
    sshCertificate?: boolean | `@${string}`;
    thirdPartyConfigurations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["ThirdPartyConfigurationConnection"]];
    trust?: boolean | `@${string}`;
    /** The type of organization */
    type?: boolean | `@${string}`;
    /** The current user's role in the org */
    viewerRole?: boolean | `@${string}`;
    wireGuardPeer?: [{ name: string }, ResolverInputTypes["WireGuardPeer"]];
    wireGuardPeers?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["WireGuardPeerConnection"]];
    __typename?: boolean | `@${string}`;
  }>;
  ["OrganizationAlertsEnabled"]: OrganizationAlertsEnabled;
  /** The connection type for Organization. */
  ["OrganizationConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["OrganizationEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["Organization"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["OrganizationEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  ["OrganizationInvitation"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    email?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** The user who created the invitation */
    inviter?: ResolverInputTypes["User"];
    organization?: ResolverInputTypes["Organization"];
    redeemed?: boolean | `@${string}`;
    redeemedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for OrganizationInvitation. */
  ["OrganizationInvitationConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["OrganizationInvitationEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["OrganizationInvitation"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["OrganizationInvitationEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["OrganizationInvitation"];
    __typename?: boolean | `@${string}`;
  }>;
  ["OrganizationMemberRole"]: OrganizationMemberRole;
  /** The connection type for User. */
  ["OrganizationMembershipsConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["OrganizationMembershipsEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["User"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["OrganizationMembershipsEdge"]: AliasType<{
    /** The alerts settings the user has in this organization */
    alertsEnabled?: boolean | `@${string}`;
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The date the user joined the organization */
    joinedAt?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["User"];
    /** The role the user has in this organization */
    role?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["OrganizationTrust"]: OrganizationTrust;
  ["OrganizationType"]: OrganizationType;
  /** Information about pagination in a connection. */
  ["PageInfo"]: AliasType<{
    /** When paginating forwards, the cursor to continue. */
    endCursor?: boolean | `@${string}`;
    /** When paginating forwards, are there more items? */
    hasNextPage?: boolean | `@${string}`;
    /** When paginating backwards, are there more items? */
    hasPreviousPage?: boolean | `@${string}`;
    /** When paginating backwards, the cursor to continue. */
    startCursor?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of PauseApp */
  ["PauseAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of PauseApp. */
  ["PauseAppPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["PlatformVersionEnum"]: PlatformVersionEnum;
  ["PostgresClusterAppRole"]: AliasType<{
    databases?: ResolverInputTypes["PostgresClusterDatabase"];
    /** The name of this role */
    name?: boolean | `@${string}`;
    users?: ResolverInputTypes["PostgresClusterUser"];
    __typename?: boolean | `@${string}`;
  }>;
  ["PostgresClusterAttachment"]: AliasType<{
    databaseName?: boolean | `@${string}`;
    databaseUser?: boolean | `@${string}`;
    environmentVariableName?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for PostgresClusterAttachment. */
  ["PostgresClusterAttachmentConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["PostgresClusterAttachmentEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["PostgresClusterAttachment"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["PostgresClusterAttachmentEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["PostgresClusterAttachment"];
    __typename?: boolean | `@${string}`;
  }>;
  ["PostgresClusterDatabase"]: AliasType<{
    name?: boolean | `@${string}`;
    users?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["PostgresClusterUser"]: AliasType<{
    databases?: boolean | `@${string}`;
    isSuperuser?: boolean | `@${string}`;
    username?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["PriceTier"]: AliasType<{
    unitAmount?: boolean | `@${string}`;
    upTo?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Principal"]: AliasType<{
    /** URL for avatar or placeholder */
    avatarUrl?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** Email address for principal */
    email?: boolean | `@${string}`;
    featureFlags?: boolean | `@${string}`;
    hasNodeproxyApps?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    lastRegion?: boolean | `@${string}`;
    /** Display name of principal */
    name?: boolean | `@${string}`;
    organizations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["OrganizationConnection"]];
    personalOrganization?: ResolverInputTypes["Organization"];
    trust?: boolean | `@${string}`;
    twoFactorProtection?: boolean | `@${string}`;
    username?: boolean | `@${string}`;
    ["...on Macaroon"]?: Omit<
      ResolverInputTypes["Macaroon"],
      keyof ResolverInputTypes["Principal"]
    >;
    ["...on User"]?: Omit<
      ResolverInputTypes["User"],
      keyof ResolverInputTypes["Principal"]
    >;
    __typename?: boolean | `@${string}`;
  }>;
  ["ProcessGroup"]: AliasType<{
    maxPerRegion?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    regions?: boolean | `@${string}`;
    vmSize?: ResolverInputTypes["VMSize"];
    __typename?: boolean | `@${string}`;
  }>;
  ["Product"]: AliasType<{
    name?: boolean | `@${string}`;
    tiers?: ResolverInputTypes["PriceTier"];
    type?: boolean | `@${string}`;
    unitLabel?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["PropertyInput"]: {
    /** The name of the property */
    name: string;
    /** The value of the property */
    value?: string | undefined | null;
  };
  ["Queries"]: AliasType<{
    accessTokens?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      type?: ResolverInputTypes["AccessTokenType"] | undefined | null;
    }, ResolverInputTypes["AccessTokenConnection"]];
    addOn?: [
      { id?: string | undefined | null; name?: string | undefined | null },
      ResolverInputTypes["AddOn"],
    ];
    addOnPlans?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["AddOnPlanConnection"]];
    addOnProvider?: [{ name: string }, ResolverInputTypes["AddOnProvider"]];
    addOns?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      type?: ResolverInputTypes["AddOnType"] | undefined | null;
    }, ResolverInputTypes["AddOnConnection"]];
    app?: [
      {
        name?: string | undefined | null;
        internalId?: string | undefined | null;
      },
      ResolverInputTypes["App"],
    ];
    apps?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      active?: boolean | undefined | null;
      role?: string | undefined | null;
      platform?: string | undefined | null;
      organizationId?: string | undefined | null;
    }, ResolverInputTypes["AppConnection"]];
    canPerformBluegreenDeployment?: [{
      /** The name of the app */
      name: string;
    }, boolean | `@${string}`];
    certificate?: [{ id: string }, ResolverInputTypes["AppCertificate"]];
    checkJobs?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["CheckJobConnection"]];
    checkLocations?: ResolverInputTypes["CheckLocation"];
    currentUser?: ResolverInputTypes["User"];
    domain?: [{ name: string }, ResolverInputTypes["Domain"]];
    githubIntegration?: ResolverInputTypes["GithubIntegration"];
    herokuIntegration?: ResolverInputTypes["HerokuIntegration"];
    ipAddress?: [{ id: string }, ResolverInputTypes["IPAddress"]];
    latestImageDetails?: [{
      /** <repositry>/<name>:<tag> */
      image: string;
    }, ResolverInputTypes["ImageVersion"]];
    latestImageTag?: [
      { repository: string; snapshotId?: string | undefined | null },
      boolean | `@${string}`,
    ];
    machine?: [{ machineId: string }, ResolverInputTypes["Machine"]];
    machines?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      appId?: string | undefined | null;
      state?: string | undefined | null;
      version?: number | undefined | null;
    }, ResolverInputTypes["MachineConnection"]];
    nearestRegion?: [
      { wireguardGateway?: boolean | undefined | null },
      ResolverInputTypes["Region"],
    ];
    node?: [{
      /** ID of the object. */
      id: string;
    }, ResolverInputTypes["Node"]];
    nodes?: [{
      /** IDs of the objects. */
      ids: Array<string>;
    }, ResolverInputTypes["Node"]];
    organization?: [
      {
        id?: string | undefined | null;
        name?: string | undefined | null;
        slug?: string | undefined | null;
      },
      ResolverInputTypes["Organization"],
    ];
    organizations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      withBillingIssuesOnly?: boolean | undefined | null;
      admin?: boolean | undefined | null;
      type?: ResolverInputTypes["OrganizationType"] | undefined | null;
    }, ResolverInputTypes["OrganizationConnection"]];
    personalOrganization?: ResolverInputTypes["Organization"];
    /** fly.io platform information */
    platform?: ResolverInputTypes["FlyPlatform"];
    postgresAttachments?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
      appName?: string | undefined | null;
      postgresAppName: string;
    }, ResolverInputTypes["PostgresClusterAttachmentConnection"]];
    /** Fly.io product and price information */
    products?: ResolverInputTypes["Product"];
    /** Whether the authentication token only allows for user access */
    userOnlyToken?: boolean | `@${string}`;
    validateConfig?: [
      { definition: ResolverInputTypes["JSON"] },
      ResolverInputTypes["AppConfig"],
    ];
    viewer?: ResolverInputTypes["Principal"];
    volume?: [{ id: string }, ResolverInputTypes["Volume"]];
    __typename?: boolean | `@${string}`;
  }>;
  ["Region"]: AliasType<{
    /** The IATA airport code for this region */
    code?: boolean | `@${string}`;
    gatewayAvailable?: boolean | `@${string}`;
    /** The latitude of this region */
    latitude?: boolean | `@${string}`;
    /** The longitude of this region */
    longitude?: boolean | `@${string}`;
    /** The name of this region */
    name?: boolean | `@${string}`;
    processGroup?: boolean | `@${string}`;
    requiresPaidPlan?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["RegionPlacement"]: AliasType<{
    /** The desired number of allocations */
    count?: boolean | `@${string}`;
    /** The region code */
    region?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RegisterDomain */
  ["RegisterDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the domain */
    domainId: string;
    /** Enable whois privacy on the registration */
    whoisPrivacy?: boolean | undefined | null;
    /** Enable auto renew on the registration */
    autoRenew?: boolean | undefined | null;
  };
  /** Autogenerated return type of RegisterDomain. */
  ["RegisterDomainPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ResolverInputTypes["Domain"];
    __typename?: boolean | `@${string}`;
  }>;
  ["Release"]: AliasType<{
    config?: ResolverInputTypes["AppConfig"];
    createdAt?: boolean | `@${string}`;
    deploymentStrategy?: boolean | `@${string}`;
    /** A description of the release */
    description?: boolean | `@${string}`;
    evaluationId?: boolean | `@${string}`;
    /** Unique ID */
    id?: boolean | `@${string}`;
    /** Docker image */
    image?: ResolverInputTypes["Image"];
    /** Docker image URI */
    imageRef?: boolean | `@${string}`;
    inProgress?: boolean | `@${string}`;
    /** The reason for the release */
    reason?: boolean | `@${string}`;
    /** Version release reverted to */
    revertedTo?: boolean | `@${string}`;
    stable?: boolean | `@${string}`;
    /** The status of the release */
    status?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    /** The user who created the release */
    user?: ResolverInputTypes["User"];
    /** The version of the release */
    version?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["ReleaseCommand"]: AliasType<{
    app?: ResolverInputTypes["App"];
    command?: boolean | `@${string}`;
    evaluationId?: boolean | `@${string}`;
    exitCode?: boolean | `@${string}`;
    failed?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    inProgress?: boolean | `@${string}`;
    instanceId?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    succeeded?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Release. */
  ["ReleaseConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["ReleaseEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["Release"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["ReleaseEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["Release"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ReleaseIPAddress */
  ["ReleaseIPAddressInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId?: string | undefined | null;
    /** The id of the ip address to release */
    ipAddressId?: string | undefined | null;
    ip?: string | undefined | null;
  };
  /** Autogenerated return type of ReleaseIPAddress. */
  ["ReleaseIPAddressPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["ReleaseUnprocessed"]: AliasType<{
    configDefinition?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    deploymentStrategy?: boolean | `@${string}`;
    /** A description of the release */
    description?: boolean | `@${string}`;
    evaluationId?: boolean | `@${string}`;
    /** Unique ID */
    id?: boolean | `@${string}`;
    /** Docker image */
    image?: ResolverInputTypes["Image"];
    /** Docker image URI */
    imageRef?: boolean | `@${string}`;
    inProgress?: boolean | `@${string}`;
    /** The reason for the release */
    reason?: boolean | `@${string}`;
    /** Version release reverted to */
    revertedTo?: boolean | `@${string}`;
    stable?: boolean | `@${string}`;
    /** The status of the release */
    status?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    /** The user who created the release */
    user?: ResolverInputTypes["User"];
    /** The version of the release */
    version?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for ReleaseUnprocessed. */
  ["ReleaseUnprocessedConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["ReleaseUnprocessedEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["ReleaseUnprocessed"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["ReleaseUnprocessedEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["ReleaseUnprocessed"];
    __typename?: boolean | `@${string}`;
  }>;
  ["RemoteDockerBuilderAppRole"]: AliasType<{
    /** The name of this role */
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RemoveMachine */
  ["RemoveMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId?: string | undefined | null;
    /** machine id */
    id: string;
    /** force kill machine if it's running */
    kill?: boolean | undefined | null;
  };
  /** Autogenerated return type of RemoveMachine. */
  ["RemoveMachinePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ResolverInputTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RemoveWireGuardPeer */
  ["RemoveWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The name of the peer to remove */
    name: string;
    /** Add via NATS transaction (for testing only, nosy users) */
    nats?: boolean | undefined | null;
  };
  /** Autogenerated return type of RemoveWireGuardPeer. */
  ["RemoveWireGuardPeerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** The organization that owned the peer */
    organization?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ResetAddOnPassword */
  ["ResetAddOnPasswordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the add-on whose password should be reset */
    name: string;
  };
  /** Autogenerated return type of ResetAddOnPassword. */
  ["ResetAddOnPasswordPayload"]: AliasType<{
    addOn?: ResolverInputTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RestartAllocation */
  ["RestartAllocationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** The ID of the app */
    allocId: string;
  };
  /** Autogenerated return type of RestartAllocation. */
  ["RestartAllocationPayload"]: AliasType<{
    allocation?: ResolverInputTypes["Allocation"];
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RestartApp */
  ["RestartAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of RestartApp. */
  ["RestartAppPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RestoreVolumeSnapshot */
  ["RestoreVolumeSnapshotInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    volumeId: string;
    snapshotId: string;
  };
  /** Autogenerated return type of RestoreVolumeSnapshot. */
  ["RestoreVolumeSnapshotPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    snapshot?: ResolverInputTypes["VolumeSnapshot"];
    volume?: ResolverInputTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ResumeApp */
  ["ResumeAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of ResumeApp. */
  ["ResumeAppPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of RevokePostgresClusterUserAccess */
  ["RevokePostgresClusterUserAccessInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The name of the postgres cluster app */
    appName: string;
    /** The username to revoke */
    username: string;
    /** The database to revoke access to */
    databaseName: string;
  };
  /** Autogenerated return type of RevokePostgresClusterUserAccess. */
  ["RevokePostgresClusterUserAccessPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    database?: ResolverInputTypes["PostgresClusterDatabase"];
    postgresClusterRole?: ResolverInputTypes["PostgresClusterAppRole"];
    user?: ResolverInputTypes["PostgresClusterUser"];
    __typename?: boolean | `@${string}`;
  }>;
  ["RuntimeType"]: RuntimeType;
  /** Autogenerated input type of SaveDeploymentSource */
  ["SaveDeploymentSourceInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The application to update */
    appId: string;
    provider: string;
    repositoryId: string;
    ref?: string | undefined | null;
    baseDir?: string | undefined | null;
    skipBuild?: boolean | undefined | null;
  };
  /** Autogenerated return type of SaveDeploymentSource. */
  ["SaveDeploymentSourcePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    build?: ResolverInputTypes["Build"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ScaleApp */
  ["ScaleAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** Regions to scale */
    regions: Array<ResolverInputTypes["ScaleRegionInput"]>;
  };
  /** Autogenerated return type of ScaleApp. */
  ["ScaleAppPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    delta?: ResolverInputTypes["ScaleRegionChange"];
    placement?: ResolverInputTypes["RegionPlacement"];
    __typename?: boolean | `@${string}`;
  }>;
  ["ScaleRegionChange"]: AliasType<{
    /** The original value */
    fromCount?: boolean | `@${string}`;
    /** The region code */
    region?: boolean | `@${string}`;
    /** The new value */
    toCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Region placement configuration */
  ["ScaleRegionInput"]: {
    /** The region to configure */
    region: string;
    /** The value to change by */
    count: number;
  };
  ["Secret"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    /** The digest of the secret value */
    digest?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** The name of the secret */
    name?: boolean | `@${string}`;
    /** The user who initiated the deployment */
    user?: ResolverInputTypes["User"];
    __typename?: boolean | `@${string}`;
  }>;
  /** A secure configuration value */
  ["SecretInput"]: {
    /** The unqiue key for this secret */
    key: string;
    /** The value of this secret */
    value: string;
  };
  /** Global port routing */
  ["Service"]: AliasType<{
    /** Health checks */
    checks?: ResolverInputTypes["Check"];
    description?: boolean | `@${string}`;
    /** Hard concurrency limit */
    hardConcurrency?: boolean | `@${string}`;
    /** Application port to forward traffic to */
    internalPort?: boolean | `@${string}`;
    /** Ports to listen on */
    ports?: ResolverInputTypes["ServicePort"];
    /** Protocol to listen on */
    protocol?: boolean | `@${string}`;
    /** Soft concurrency limit */
    softConcurrency?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["ServiceHandlerType"]: ServiceHandlerType;
  /** Global port routing */
  ["ServiceInput"]: {
    /** Protocol to listen on */
    protocol: ResolverInputTypes["ServiceProtocolType"];
    /** Ports to listen on */
    ports?: Array<ResolverInputTypes["ServiceInputPort"]> | undefined | null;
    /** Application port to forward traffic to */
    internalPort: number;
    /** Health checks */
    checks?: Array<ResolverInputTypes["CheckInput"]> | undefined | null;
    /** Soft concurrency limit */
    softConcurrency?: number | undefined | null;
    /** Hard concurrency limit */
    hardConcurrency?: number | undefined | null;
  };
  /** Service port */
  ["ServiceInputPort"]: {
    /** Port to listen on */
    port: number;
    /** Handlers to apply before forwarding service traffic */
    handlers?:
      | Array<ResolverInputTypes["ServiceHandlerType"]>
      | undefined
      | null;
    /** tls options */
    tlsOptions?:
      | ResolverInputTypes["ServicePortTlsOptionsInput"]
      | undefined
      | null;
  };
  /** Service port */
  ["ServicePort"]: AliasType<{
    /** End port for range */
    endPort?: boolean | `@${string}`;
    /** Handlers to apply before forwarding service traffic */
    handlers?: boolean | `@${string}`;
    /** Port to listen on */
    port?: boolean | `@${string}`;
    /** Start port for range */
    startPort?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** TLS handshakes options for a port */
  ["ServicePortTlsOptionsInput"]: {
    defaultSelfSigned?: boolean | undefined | null;
  };
  ["ServiceProtocolType"]: ServiceProtocolType;
  /** Autogenerated input type of SetAppsv2DefaultOn */
  ["SetAppsv2DefaultOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The organization slug */
    organizationSlug: string;
    /** Whether or not new apps in this org use Apps V2 by default */
    defaultOn: boolean;
  };
  /** Autogenerated return type of SetAppsv2DefaultOn. */
  ["SetAppsv2DefaultOnPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetPagerdutyHandler */
  ["SetPagerdutyHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** Handler name */
    name: string;
    /** PagerDuty API token */
    pagerdutyToken: string;
    /** Map of alert severity levels to PagerDuty severity levels */
    pagerdutyStatusMap?: ResolverInputTypes["JSON"] | undefined | null;
  };
  /** Autogenerated return type of SetPagerdutyHandler. */
  ["SetPagerdutyHandlerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    handler?: ResolverInputTypes["HealthCheckHandler"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetPlatformVersion */
  ["SetPlatformVersionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** nomad or machines */
    platformVersion: string;
    /** Unique lock ID */
    lockId?: string | undefined | null;
  };
  /** Autogenerated return type of SetPlatformVersion. */
  ["SetPlatformVersionPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetSecrets */
  ["SetSecretsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** Secrets to set */
    secrets: Array<ResolverInputTypes["SecretInput"]>;
    /** By default, we set only the secrets you specify. Set this to true to replace all secrets. */
    replaceAll?: boolean | undefined | null;
  };
  /** Autogenerated return type of SetSecrets. */
  ["SetSecretsPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ResolverInputTypes["Release"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetSlackHandler */
  ["SetSlackHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** Handler name */
    name: string;
    /** Slack Webhook URL to use for health check notifications */
    slackWebhookUrl: string;
    /** Slack channel to send messages to, defaults to #general */
    slackChannel?: string | undefined | null;
    /** User name to display on Slack Messages (defaults to Fly) */
    slackUsername?: string | undefined | null;
    /** Icon to show with Slack messages */
    slackIconUrl?: string | undefined | null;
  };
  /** Autogenerated return type of SetSlackHandler. */
  ["SetSlackHandlerPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    handler?: ResolverInputTypes["HealthCheckHandler"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetVMCount */
  ["SetVMCountInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** Counts for VM groups */
    groupCounts: Array<ResolverInputTypes["VMCountInput"]>;
    /** Unique lock ID */
    lockId?: string | undefined | null;
  };
  /** Autogenerated return type of SetVMCount. */
  ["SetVMCountPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ResolverInputTypes["Release"];
    taskGroupCounts?: ResolverInputTypes["TaskGroupCount"];
    warnings?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of SetVMSize */
  ["SetVMSizeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** The name of the vm size to set */
    sizeName: string;
    /** Optionally request more memory */
    memoryMb?: number | undefined | null;
    /** Process group to modify */
    group?: string | undefined | null;
  };
  /** Autogenerated return type of SetVMSize. */
  ["SetVMSizePayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    /** Process Group scale change applied to (if any) */
    processGroup?: ResolverInputTypes["ProcessGroup"];
    /** Default app vm size */
    vmSize?: ResolverInputTypes["VMSize"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of StartBuild */
  ["StartBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of StartBuild. */
  ["StartBuildPayload"]: AliasType<{
    build?: ResolverInputTypes["Build"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of StartMachine */
  ["StartMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId?: string | undefined | null;
    /** machine id */
    id: string;
  };
  /** Autogenerated return type of StartMachine. */
  ["StartMachinePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ResolverInputTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of StopAllocation */
  ["StopAllocationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** The ID of the app */
    allocId: string;
  };
  /** Autogenerated return type of StopAllocation. */
  ["StopAllocationPayload"]: AliasType<{
    allocation?: ResolverInputTypes["Allocation"];
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of StopMachine */
  ["StopMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId?: string | undefined | null;
    /** machine id */
    id: string;
    /** signal to send the machine */
    signal?: string | undefined | null;
    /** how long to wait before force killing the machine */
    killTimeoutSecs?: number | undefined | null;
  };
  /** Autogenerated return type of StopMachine. */
  ["StopMachinePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    machine?: ResolverInputTypes["Machine"];
    __typename?: boolean | `@${string}`;
  }>;
  ["TaskGroupCount"]: AliasType<{
    count?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["TemplateDeployment"]: AliasType<{
    apps?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["AppConnection"]];
    id?: boolean | `@${string}`;
    organization?: ResolverInputTypes["Organization"];
    status?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Configuration for third-party caveats to be added to user macaroons */
  ["ThirdPartyConfiguration"]: AliasType<{
    /** Restrictions to be placed on third-party caveats */
    caveats?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel?: boolean | `@${string}`;
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** Location URL of the third-party service capable of discharging */
    location?: boolean | `@${string}`;
    /** Friendly name for this configuration */
    name?: boolean | `@${string}`;
    /** Organization that owns this third party configuration */
    organization?: ResolverInputTypes["Organization"];
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for ThirdPartyConfiguration. */
  ["ThirdPartyConfigurationConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["ThirdPartyConfigurationEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["ThirdPartyConfiguration"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["ThirdPartyConfigurationEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["ThirdPartyConfiguration"];
    __typename?: boolean | `@${string}`;
  }>;
  ["ThirdPartyConfigurationLevel"]: ThirdPartyConfigurationLevel;
  /** Autogenerated input type of UnlockApp */
  ["UnlockAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** Unique lock ID */
    lockId: string;
  };
  /** Autogenerated return type of UnlockApp. */
  ["UnlockAppPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UnsetSecrets */
  ["UnsetSecretsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    /** Secret keys to unset */
    keys: Array<string>;
  };
  /** Autogenerated return type of UnsetSecrets. */
  ["UnsetSecretsPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ResolverInputTypes["Release"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateAddOn */
  ["UpdateAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The add-on ID to update */
    addOnId?: string | undefined | null;
    /** The add-on name to update */
    name?: string | undefined | null;
    /** The add-on plan ID */
    planId?: string | undefined | null;
    /** Options specific to the add-on */
    options?: ResolverInputTypes["JSON"] | undefined | null;
    /** Desired regions to place replicas in */
    readRegions?: Array<string> | undefined | null;
  };
  /** Autogenerated return type of UpdateAddOn. */
  ["UpdateAddOnPayload"]: AliasType<{
    addOn?: ResolverInputTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateAutoscaleConfig */
  ["UpdateAutoscaleConfigInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the app */
    appId: string;
    enabled?: boolean | undefined | null;
    minCount?: number | undefined | null;
    maxCount?: number | undefined | null;
    balanceRegions?: boolean | undefined | null;
    /** Region configs */
    regions?:
      | Array<ResolverInputTypes["AutoscaleRegionConfigInput"]>
      | undefined
      | null;
    resetRegions?: boolean | undefined | null;
  };
  /** Autogenerated return type of UpdateAutoscaleConfig. */
  ["UpdateAutoscaleConfigPayload"]: AliasType<{
    app?: ResolverInputTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateDNSPortal */
  ["UpdateDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    dnsPortalId: string;
    /** The unique name of this portal. */
    name?: string | undefined | null;
    /** The title of this portal */
    title?: string | undefined | null;
    /** The return url for this portal */
    returnUrl?: string | undefined | null;
    /** The text to display for the return url link */
    returnUrlText?: string | undefined | null;
    /** The support url for this portal */
    supportUrl?: string | undefined | null;
    /** The text to display for the support url link */
    supportUrlText?: string | undefined | null;
    /** The primary branding color */
    primaryColor?: string | undefined | null;
    /** The secondary branding color */
    accentColor?: string | undefined | null;
  };
  /** Autogenerated return type of UpdateDNSPortal. */
  ["UpdateDNSPortalPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    dnsPortal?: ResolverInputTypes["DNSPortal"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateDNSRecord */
  ["UpdateDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the DNS record */
    recordId: string;
    /** The dns record name */
    name?: string | undefined | null;
    /** The TTL in seconds */
    ttl?: number | undefined | null;
    /** The content of the record */
    rdata?: string | undefined | null;
  };
  /** Autogenerated return type of UpdateDNSRecord. */
  ["UpdateDNSRecordPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    record?: ResolverInputTypes["DNSRecord"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateDNSRecords */
  ["UpdateDNSRecordsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the domain */
    domainId: string;
    changes: Array<ResolverInputTypes["DNSRecordChangeInput"]>;
  };
  /** Autogenerated return type of UpdateDNSRecords. */
  ["UpdateDNSRecordsPayload"]: AliasType<{
    changes?: ResolverInputTypes["DNSRecordDiff"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    domain?: ResolverInputTypes["Domain"];
    warnings?: ResolverInputTypes["DNSRecordWarning"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateOrganizationMembership */
  ["UpdateOrganizationMembershipInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** The node ID of the user */
    userId: string;
    /** The new role for the user */
    role: ResolverInputTypes["OrganizationMemberRole"];
    /** The new alert settings for the user */
    alertsEnabled?:
      | ResolverInputTypes["OrganizationAlertsEnabled"]
      | undefined
      | null;
  };
  /** Autogenerated return type of UpdateOrganizationMembership. */
  ["UpdateOrganizationMembershipPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ResolverInputTypes["Organization"];
    user?: ResolverInputTypes["User"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateRelease */
  ["UpdateReleaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The ID of the release */
    releaseId: string;
    /** The new status for the release */
    status: string;
  };
  /** Autogenerated return type of UpdateRelease. */
  ["UpdateReleasePayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    release?: ResolverInputTypes["Release"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateRemoteBuilder */
  ["UpdateRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the organization */
    organizationId: string;
    /** Docker image reference */
    image: string;
  };
  /** Autogenerated return type of UpdateRemoteBuilder. */
  ["UpdateRemoteBuilderPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    organization?: ResolverInputTypes["Organization"];
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of UpdateThirdPartyConfiguration */
  ["UpdateThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    /** The node ID of the configuration */
    thirdPartyConfigurationId: string;
    /** Friendly name for this configuration */
    name?: string | undefined | null;
    /** Location URL of the third-party service capable of discharging */
    location?: string | undefined | null;
    /** Restrictions to be placed on third-party caveats */
    caveats?: ResolverInputTypes["CaveatSet"] | undefined | null;
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel?:
      | ResolverInputTypes["ThirdPartyConfigurationLevel"]
      | undefined
      | null;
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel?:
      | ResolverInputTypes["ThirdPartyConfigurationLevel"]
      | undefined
      | null;
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel?:
      | ResolverInputTypes["ThirdPartyConfigurationLevel"]
      | undefined
      | null;
  };
  /** Autogenerated return type of UpdateThirdPartyConfiguration. */
  ["UpdateThirdPartyConfigurationPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    thirdPartyConfiguration?: ResolverInputTypes["ThirdPartyConfiguration"];
    __typename?: boolean | `@${string}`;
  }>;
  ["User"]: AliasType<{
    agreedToProviderTos?: [{ providerName: string }, boolean | `@${string}`];
    /** URL for avatar or placeholder */
    avatarUrl?: boolean | `@${string}`;
    createdAt?: boolean | `@${string}`;
    /** Email address for user (private) */
    email?: boolean | `@${string}`;
    /** Whether to create new organizations under Hobby plan */
    enablePaidHobby?: boolean | `@${string}`;
    featureFlags?: boolean | `@${string}`;
    hasNodeproxyApps?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    internalNumericId?: boolean | `@${string}`;
    lastRegion?: boolean | `@${string}`;
    /** Display / full name for user (private) */
    name?: boolean | `@${string}`;
    organizations?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["OrganizationConnection"]];
    personalOrganization?: ResolverInputTypes["Organization"];
    trust?: boolean | `@${string}`;
    twoFactorProtection?: boolean | `@${string}`;
    /** Public username for user */
    username?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["UserCoupon"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    /** Organization that owns this app */
    organization?: ResolverInputTypes["Organization"];
    updatedAt?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["VM"]: AliasType<{
    attachedVolumes?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["VolumeConnection"]];
    canary?: boolean | `@${string}`;
    checks?: [{
      /** Filter checks by name */
      name?: string | undefined | null;
    }, ResolverInputTypes["CheckState"]];
    createdAt?: boolean | `@${string}`;
    criticalCheckCount?: boolean | `@${string}`;
    /** Desired status */
    desiredStatus?: boolean | `@${string}`;
    events?: ResolverInputTypes["AllocationEvent"];
    failed?: boolean | `@${string}`;
    healthy?: boolean | `@${string}`;
    /** Unique ID for this instance */
    id?: boolean | `@${string}`;
    /** Short unique ID for this instance */
    idShort?: boolean | `@${string}`;
    /** Indicates if this instance is from the latest job version */
    latestVersion?: boolean | `@${string}`;
    passingCheckCount?: boolean | `@${string}`;
    /** Private IPv6 address for this instance */
    privateIP?: boolean | `@${string}`;
    recentLogs?: [{
      /** Max number of entries to return */
      limit?:
        | number
        | undefined
        | null; /** Max age of log entries in seconds */
      range?: number | undefined | null;
    }, ResolverInputTypes["LogEntry"]];
    /** Region this allocation is running in */
    region?: boolean | `@${string}`;
    restarts?: boolean | `@${string}`;
    /** Current status */
    status?: boolean | `@${string}`;
    taskName?: boolean | `@${string}`;
    totalCheckCount?: boolean | `@${string}`;
    transitioning?: boolean | `@${string}`;
    updatedAt?: boolean | `@${string}`;
    /** The configuration version of this instance */
    version?: boolean | `@${string}`;
    warningCheckCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for VM. */
  ["VMConnection"]: AliasType<{
    activeCount?: boolean | `@${string}`;
    completeCount?: boolean | `@${string}`;
    /** A list of edges. */
    edges?: ResolverInputTypes["VMEdge"];
    failedCount?: boolean | `@${string}`;
    inactiveCount?: boolean | `@${string}`;
    lostCount?: boolean | `@${string}`;
    /** A list of nodes. */
    nodes?: ResolverInputTypes["VM"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    pendingCount?: boolean | `@${string}`;
    runningCount?: boolean | `@${string}`;
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["VMCountInput"]: {
    /** VM group name */
    group?: string | undefined | null;
    /** The desired count */
    count?: number | undefined | null;
    /** Max number of VMs to allow per region */
    maxPerRegion?: number | undefined | null;
  };
  /** An edge in a connection. */
  ["VMEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["VM"];
    __typename?: boolean | `@${string}`;
  }>;
  ["VMSize"]: AliasType<{
    cpuCores?: boolean | `@${string}`;
    maxMemoryMb?: boolean | `@${string}`;
    memoryGb?: boolean | `@${string}`;
    memoryIncrementsMb?: boolean | `@${string}`;
    memoryMb?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    priceMonth?: boolean | `@${string}`;
    priceSecond?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** Autogenerated input type of ValidateWireGuardPeers */
  ["ValidateWireGuardPeersInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined | null;
    peerIps: Array<string>;
  };
  /** Autogenerated return type of ValidateWireGuardPeers. */
  ["ValidateWireGuardPeersPayload"]: AliasType<{
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: boolean | `@${string}`;
    invalidPeerIps?: boolean | `@${string}`;
    validPeerIps?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  ["Volume"]: AliasType<{
    app?: ResolverInputTypes["App"];
    attachedAllocation?: ResolverInputTypes["Allocation"];
    attachedAllocationId?: boolean | `@${string}`;
    attachedMachine?: ResolverInputTypes["Machine"];
    createdAt?: boolean | `@${string}`;
    encrypted?: boolean | `@${string}`;
    host?: ResolverInputTypes["Host"];
    id?: boolean | `@${string}`;
    internalId?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    sizeGb?: boolean | `@${string}`;
    snapshots?: [{
      /** Returns the elements in the list that come after the specified cursor. */
      after?:
        | string
        | undefined
        | null; /** Returns the elements in the list that come before the specified cursor. */
      before?:
        | string
        | undefined
        | null; /** Returns the first _n_ elements from the list. */
      first?:
        | number
        | undefined
        | null; /** Returns the last _n_ elements from the list. */
      last?: number | undefined | null;
    }, ResolverInputTypes["VolumeSnapshotConnection"]];
    state?: boolean | `@${string}`;
    status?: boolean | `@${string}`;
    usedBytes?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for Volume. */
  ["VolumeConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["VolumeEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["Volume"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["VolumeEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  ["VolumeSnapshot"]: AliasType<{
    createdAt?: boolean | `@${string}`;
    digest?: boolean | `@${string}`;
    id?: boolean | `@${string}`;
    size?: boolean | `@${string}`;
    volume?: ResolverInputTypes["Volume"];
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for VolumeSnapshot. */
  ["VolumeSnapshotConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["VolumeSnapshotEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["VolumeSnapshot"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["VolumeSnapshotEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["VolumeSnapshot"];
    __typename?: boolean | `@${string}`;
  }>;
  ["WireGuardPeer"]: AliasType<{
    id?: boolean | `@${string}`;
    name?: boolean | `@${string}`;
    network?: boolean | `@${string}`;
    peerip?: boolean | `@${string}`;
    pubkey?: boolean | `@${string}`;
    region?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** The connection type for WireGuardPeer. */
  ["WireGuardPeerConnection"]: AliasType<{
    /** A list of edges. */
    edges?: ResolverInputTypes["WireGuardPeerEdge"];
    /** A list of nodes. */
    nodes?: ResolverInputTypes["WireGuardPeer"];
    /** Information to aid in pagination. */
    pageInfo?: ResolverInputTypes["PageInfo"];
    totalCount?: boolean | `@${string}`;
    __typename?: boolean | `@${string}`;
  }>;
  /** An edge in a connection. */
  ["WireGuardPeerEdge"]: AliasType<{
    /** A cursor for use in pagination. */
    cursor?: boolean | `@${string}`;
    /** The item at the end of the edge. */
    node?: ResolverInputTypes["WireGuardPeer"];
    __typename?: boolean | `@${string}`;
  }>;
};

export type ModelTypes = {
  ["schema"]: {
    query?: ModelTypes["Queries"] | undefined;
    mutation?: ModelTypes["Mutations"] | undefined;
  };
  ["AccessToken"]: {
    createdAt: ModelTypes["ISO8601DateTime"];
    id: string;
    name: string;
    type: ModelTypes["AccessTokenType"];
  };
  /** The connection type for AccessToken. */
  ["AccessTokenConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["AccessTokenEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["AccessToken"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AccessTokenEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["AccessToken"] | undefined;
  };
  ["AccessTokenType"]: AccessTokenType;
  /** Autogenerated return type of AddCertificate. */
  ["AddCertificatePayload"]: {
    app?: ModelTypes["App"] | undefined;
    certificate?: ModelTypes["AppCertificate"] | undefined;
    check?: ModelTypes["HostnameCheck"] | undefined;
    errors?: Array<string> | undefined;
  };
  ["AddOn"]: {
    /** The add-on plan */
    addOnPlan?: ModelTypes["AddOnPlan"] | undefined;
    /** The display name for an add-on plan */
    addOnPlanName?: string | undefined;
    /** The add-on provider */
    addOnProvider?: ModelTypes["AddOnProvider"] | undefined;
    /** An app associated with this add-on */
    app?: ModelTypes["App"] | undefined;
    /** Apps associated with this add-on */
    apps?: ModelTypes["AppConnection"] | undefined;
    /** Environment variables for the add-on */
    environment?: ModelTypes["JSON"] | undefined;
    /** Optional error message when `status` is `error` */
    errorMessage?: string | undefined;
    /** DNS hostname for the add-on */
    hostname?: string | undefined;
    id: string;
    /** Add-on metadata */
    metadata?: ModelTypes["JSON"] | undefined;
    /** The service name according to the provider */
    name?: string | undefined;
    /** Add-on options */
    options?: ModelTypes["JSON"] | undefined;
    /** Organization that owns this service */
    organization: ModelTypes["Organization"];
    /** Password for the add-on */
    password?: string | undefined;
    /** Region where the primary instance is deployed */
    primaryRegion?: string | undefined;
    /** Private flycast IP address of the add-on */
    privateIp?: string | undefined;
    /** Public URL for this service */
    publicUrl?: string | undefined;
    /** Regions where replica instances are deployed */
    readRegions?: Array<string> | undefined;
    /** Single sign-on link to the add-on dashboard */
    ssoLink?: string | undefined;
    /** Redis database statistics */
    stats?: ModelTypes["JSON"] | undefined;
    /** Status of the add-on */
    status?: string | undefined;
  };
  /** The connection type for AddOn. */
  ["AddOnConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["AddOnEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["AddOn"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AddOnEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["AddOn"] | undefined;
  };
  ["AddOnPlan"]: {
    displayName?: string | undefined;
    id: string;
    maxCommandsPerSec?: number | undefined;
    maxConcurrentConnections?: number | undefined;
    maxDailyBandwidth?: string | undefined;
    maxDailyCommands?: number | undefined;
    maxDataSize?: string | undefined;
    maxRequestSize?: string | undefined;
    name?: string | undefined;
    pricePerMonth?: number | undefined;
  };
  /** The connection type for AddOnPlan. */
  ["AddOnPlanConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["AddOnPlanEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["AddOnPlan"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AddOnPlanEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["AddOnPlan"] | undefined;
  };
  ["AddOnProvider"]: {
    asyncProvisioning: boolean;
    autoProvision: boolean;
    beta: boolean;
    detectPlatform: boolean;
    displayName?: string | undefined;
    excludedRegions?: Array<ModelTypes["Region"]> | undefined;
    id: string;
    internal: boolean;
    name?: string | undefined;
    nameSuffix?: string | undefined;
    provisioningInstructions?: string | undefined;
    regions?: Array<ModelTypes["Region"]> | undefined;
    resourceName: string;
    selectName: boolean;
    selectRegion: boolean;
    selectReplicaRegions: boolean;
    tosAgreement?: string | undefined;
    tosUrl?: string | undefined;
  };
  ["AddOnType"]: AddOnType;
  /** Autogenerated input type of AddWireGuardPeer */
  ["AddWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The region in which to deploy the peer */
    region?: string | undefined;
    /** The name with which to refer to the peer */
    name: string;
    /** The 25519 public key for the peer */
    pubkey: string;
    /** Network ID to attach wireguard peer to */
    network?: string | undefined;
    /** Add via NATS transaction (deprecated - nats is always used) */
    nats?: boolean | undefined;
  };
  /** Autogenerated return type of AddWireGuardPeer. */
  ["AddWireGuardPeerPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    endpointip: string;
    network?: string | undefined;
    peerip: string;
    pubkey: string;
  };
  /** Autogenerated input type of AllocateIPAddress */
  ["AllocateIPAddressInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to allocate the ip address for */
    appId: string;
    /** The type of IP address to allocate (v4, v6, or private_v6) */
    type: ModelTypes["IPAddressType"];
    /** The organization whose network should be used for private IP allocation */
    organizationId?: string | undefined;
    /** Desired IP region (defaults to global) */
    region?: string | undefined;
    /** The target network name in the specified organization */
    network?: string | undefined;
    /** The name of the associated service */
    serviceName?: string | undefined;
  };
  /** Autogenerated return type of AllocateIPAddress. */
  ["AllocateIPAddressPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    ipAddress?: ModelTypes["IPAddress"] | undefined;
  };
  ["Allocation"]: {
    attachedVolumes: ModelTypes["VolumeConnection"];
    canary: boolean;
    checks: Array<ModelTypes["CheckState"]>;
    createdAt: ModelTypes["ISO8601DateTime"];
    criticalCheckCount: number;
    /** Desired status */
    desiredStatus: string;
    events: Array<ModelTypes["AllocationEvent"]>;
    failed: boolean;
    healthy: boolean;
    /** Unique ID for this instance */
    id: string;
    /** Short unique ID for this instance */
    idShort: string;
    /** Indicates if this instance is from the latest job version */
    latestVersion: boolean;
    passingCheckCount: number;
    /** Private IPv6 address for this instance */
    privateIP?: string | undefined;
    recentLogs: Array<ModelTypes["LogEntry"]>;
    /** Region this allocation is running in */
    region: string;
    restarts: number;
    /** Current status */
    status: string;
    taskName: string;
    totalCheckCount: number;
    transitioning: boolean;
    updatedAt: ModelTypes["ISO8601DateTime"];
    /** The configuration version of this instance */
    version: number;
    warningCheckCount: number;
  };
  ["AllocationEvent"]: {
    message: string;
    timestamp: ModelTypes["ISO8601DateTime"];
    type: string;
  };
  ["App"]: {
    addOns: ModelTypes["AddOnConnection"];
    allocation?: ModelTypes["Allocation"] | undefined;
    allocations: Array<ModelTypes["Allocation"]>;
    appUrl?: string | undefined;
    autoscaling?: ModelTypes["AutoscalingConfig"] | undefined;
    backupRegions: Array<ModelTypes["Region"]>;
    /** [DEPRECATED] Builds of this application */
    builds: ModelTypes["BuildConnection"];
    /** Find a certificate by hostname */
    certificate?: ModelTypes["AppCertificate"] | undefined;
    /** Certificates for this app */
    certificates: ModelTypes["AppCertificateConnection"];
    /** Changes to this application */
    changes: ModelTypes["AppChangeConnection"];
    config: ModelTypes["AppConfig"];
    createdAt: ModelTypes["ISO8601DateTime"];
    currentLock?: ModelTypes["AppLock"] | undefined;
    currentPlacement: Array<ModelTypes["RegionPlacement"]>;
    /** The latest release of this application */
    currentRelease?: ModelTypes["Release"] | undefined;
    /** The latest release of this application, without any config processing */
    currentReleaseUnprocessed?: ModelTypes["ReleaseUnprocessed"] | undefined;
    deployed: boolean;
    /** Continuous deployment configuration */
    deploymentSource?: ModelTypes["DeploymentSource"] | undefined;
    /** Find a deployment by id, defaults to latest */
    deploymentStatus?: ModelTypes["DeploymentStatus"] | undefined;
    /** Check if this app has a configured deployment source */
    hasDeploymentSource: boolean;
    healthChecks: ModelTypes["CheckStateConnection"];
    /** Autogenerated hostname for this application */
    hostname?: string | undefined;
    /** Unique application ID */
    id: string;
    /** Resolve an image from a reference */
    image?: ModelTypes["Image"] | undefined;
    /** Image details */
    imageDetails?: ModelTypes["ImageVersion"] | undefined;
    imageUpgradeAvailable?: boolean | undefined;
    imageVersionTrackingEnabled: boolean;
    /** Authentication key to use with Instrumentation endpoints */
    instrumentsKey?: string | undefined;
    internalId: string;
    internalNumericId: number;
    /** Find an ip address by address string */
    ipAddress?: ModelTypes["IPAddress"] | undefined;
    ipAddresses: ModelTypes["IPAddressConnection"];
    /** This object's unique key */
    key: string;
    /** Latest image details */
    latestImageDetails?: ModelTypes["ImageVersion"] | undefined;
    limitedAccessTokens: ModelTypes["LimitedAccessTokenConnection"];
    machine?: ModelTypes["Machine"] | undefined;
    machines: ModelTypes["MachineConnection"];
    /** The unique application name */
    name: string;
    network?: string | undefined;
    networkId?: number | undefined;
    /** Organization that owns this app */
    organization: ModelTypes["Organization"];
    parseConfig: ModelTypes["AppConfig"];
    /** Fly platform version */
    platformVersion?: ModelTypes["PlatformVersionEnum"] | undefined;
    processGroups: Array<ModelTypes["ProcessGroup"]>;
    regions: Array<ModelTypes["Region"]>;
    /** Find a specific release */
    release?: ModelTypes["Release"] | undefined;
    /** Individual releases for this application */
    releases: ModelTypes["ReleaseConnection"];
    /** Individual releases for this application, without any config processing */
    releasesUnprocessed: ModelTypes["ReleaseUnprocessedConnection"];
    role?: ModelTypes["AppRole"] | undefined;
    /** Application runtime */
    runtime: ModelTypes["RuntimeType"];
    /** Secrets set on the application */
    secrets: Array<ModelTypes["Secret"]>;
    services: Array<ModelTypes["Service"]>;
    sharedIpAddress?: string | undefined;
    state: ModelTypes["AppState"];
    /** Application status */
    status: string;
    taskGroupCounts: Array<ModelTypes["TaskGroupCount"]>;
    usage: Array<ModelTypes["AppUsage"]>;
    version: number;
    vmSize: ModelTypes["VMSize"];
    vms: ModelTypes["VMConnection"];
    volume?: ModelTypes["Volume"] | undefined;
    /** Volumes associated with app */
    volumes: ModelTypes["VolumeConnection"];
  };
  ["AppCertificate"]: {
    acmeAlpnConfigured: boolean;
    acmeDnsConfigured: boolean;
    certificateAuthority?: string | undefined;
    certificateRequestedAt?: ModelTypes["ISO8601DateTime"] | undefined;
    check: boolean;
    clientStatus: string;
    configured: boolean;
    createdAt?: ModelTypes["ISO8601DateTime"] | undefined;
    dnsProvider?: string | undefined;
    dnsValidationHostname: string;
    dnsValidationInstructions: string;
    dnsValidationTarget: string;
    domain?: string | undefined;
    hostname: string;
    id: string;
    isAcmeAlpnConfigured: boolean;
    isAcmeDnsConfigured: boolean;
    isApex: boolean;
    isConfigured: boolean;
    isWildcard: boolean;
    issued: ModelTypes["CertificateConnection"];
    source?: string | undefined;
    validationErrors: Array<ModelTypes["AppCertificateValidationError"]>;
  };
  /** The connection type for AppCertificate. */
  ["AppCertificateConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["AppCertificateEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["AppCertificate"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AppCertificateEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["AppCertificate"] | undefined;
  };
  ["AppCertificateValidationError"]: {
    message: string;
    timestamp: ModelTypes["ISO8601DateTime"];
  };
  ["AppChange"]: {
    /** Object that triggered the change */
    actor?: ModelTypes["AppChangeActor"] | undefined;
    actorType: string;
    app: ModelTypes["App"];
    createdAt: ModelTypes["ISO8601DateTime"];
    description: string;
    id: string;
    status?: string | undefined;
    updatedAt: ModelTypes["ISO8601DateTime"];
    user?: ModelTypes["User"] | undefined;
  };
  /** Objects that change apps */
  ["AppChangeActor"]:
    | ModelTypes["Build"]
    | ModelTypes["Release"]
    | ModelTypes["Secret"];
  /** The connection type for AppChange. */
  ["AppChangeConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["AppChangeEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["AppChange"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AppChangeEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["AppChange"] | undefined;
  };
  ["AppConfig"]: {
    definition: ModelTypes["JSON"];
    errors: Array<string>;
    services: Array<ModelTypes["Service"]>;
    valid: boolean;
  };
  /** The connection type for App. */
  ["AppConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["AppEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["App"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AppEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["App"] | undefined;
  };
  /** app lock */
  ["AppLock"]: {
    /** Time when the lock expires */
    expiration: ModelTypes["ISO8601DateTime"];
    /** Lock ID */
    lockId: string;
  };
  ["AppRole"]:
    | ModelTypes["EmptyAppRole"]
    | ModelTypes["FlyctlMachineHostAppRole"]
    | ModelTypes["PostgresClusterAppRole"]
    | ModelTypes["RemoteDockerBuilderAppRole"];
  ["AppState"]: AppState;
  /** Application usage data */
  ["AppUsage"]: {
    /** The timespan interval for this usage sample */
    interval: string;
    /** Total requests for this time period */
    requestsCount: number;
    /** Total app execution time (in seconds) for this time period */
    totalAppExecS: number;
    /** Total GB transferred out in this time period */
    totalDataOutGB: number;
    /** The start of the timespan for this usage sample */
    ts: ModelTypes["ISO8601DateTime"];
  };
  /** Autogenerated input type of AttachPostgresCluster */
  ["AttachPostgresClusterInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The postgres cluster application id */
    postgresClusterAppId: string;
    /** The application to attach postgres to */
    appId: string;
    /** The database to attach. Defaults to a new database with the same name as the app. */
    databaseName?: string | undefined;
    /** The database user to create. Defaults to using the database name. */
    databaseUser?: string | undefined;
    /** The environment variable name to set the connection string to. Defaults to DATABASE_URL */
    variableName?: string | undefined;
    /** Flag used to indicate that flyctl will exec calls */
    manualEntry?: boolean | undefined;
  };
  /** Autogenerated return type of AttachPostgresCluster. */
  ["AttachPostgresClusterPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    connectionString: string;
    environmentVariableName: string;
    postgresClusterApp: ModelTypes["App"];
  };
  ["AutoscaleRegionConfig"]: {
    /** The region code */
    code: string;
    /** The minimum number of VMs to run in this region */
    minCount?: number | undefined;
    /** The relative weight for this region */
    weight?: number | undefined;
  };
  /** Region autoscaling configuration */
  ["AutoscaleRegionConfigInput"]: {
    /** The region code to configure */
    code: string;
    /** The weight */
    weight?: number | undefined;
    /** Minimum number of VMs to run in this region */
    minCount?: number | undefined;
    /** Reset the configuration for this region */
    reset?: boolean | undefined;
  };
  ["AutoscaleStrategy"]: AutoscaleStrategy;
  ["AutoscalingConfig"]: {
    backupRegions: Array<string>;
    balanceRegions: boolean;
    enabled: boolean;
    maxCount: number;
    minCount: number;
    preferredRegion?: string | undefined;
    regions: Array<ModelTypes["AutoscaleRegionConfig"]>;
    strategy: ModelTypes["AutoscaleStrategy"];
  };
  /** Represents non-fractional signed whole numeric values. Since the value may exceed the size of a 32-bit integer, it's encoded as a string. */
  ["BigInt"]: any;
  ["BillingStatus"]: BillingStatus;
  ["Build"]: {
    app: ModelTypes["App"];
    commitId?: string | undefined;
    commitUrl?: string | undefined;
    createdAt: ModelTypes["ISO8601DateTime"];
    /** The user who initiated the build */
    createdBy?: ModelTypes["User"] | undefined;
    /** Indicates if this build is complete and failed */
    failed: boolean;
    id: string;
    image?: string | undefined;
    /** Indicates if this build is currently in progress */
    inProgress: boolean;
    /** Log output */
    logs: string;
    number: number;
    /** Status of the build */
    status: string;
    /** Indicates if this build is complete and succeeded */
    succeeded: boolean;
    updatedAt: ModelTypes["ISO8601DateTime"];
  };
  /** The connection type for Build. */
  ["BuildConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["BuildEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["Build"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["BuildEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["Build"] | undefined;
  };
  ["BuildFinalImageInput"]: {
    /** Sha256 id of docker image */
    id: string;
    /** Tag used for docker image */
    tag: string;
    /** Size in bytes of the docker image */
    sizeBytes: ModelTypes["BigInt"];
  };
  ["BuildImageOptsInput"]: {
    /** Path to dockerfile, if one exists */
    dockerfilePath?: string | undefined;
    /** Unused in cli? */
    imageRef?: string | undefined;
    /** Set of build time variables passed to cli */
    buildArgs?: ModelTypes["JSON"] | undefined;
    /** Unused in cli? */
    extraBuildArgs?: ModelTypes["JSON"] | undefined;
    /** Image label to use when tagging and pushing to the fly registry */
    imageLabel?: string | undefined;
    /** Whether publishing to the registry was requested */
    publish?: boolean | undefined;
    /** Docker tag used to publish image to registry */
    tag?: string | undefined;
    /** Set the target build stage to build if the Dockerfile has more than one stage */
    target?: string | undefined;
    /** Do not use the build cache when building the image */
    noCache?: boolean | undefined;
    /** Builtin builder to use */
    builtIn?: string | undefined;
    /** Builtin builder settings */
    builtInSettings?: ModelTypes["JSON"] | undefined;
    /** Fly.toml build.builder setting */
    builder?: string | undefined;
    /** Fly.toml build.buildpacks setting */
    buildPacks?: Array<string> | undefined;
  };
  ["BuildStrategyAttemptInput"]: {
    /** Build strategy attempted */
    strategy: string;
    /** Result attempting this strategy */
    result: string;
    /** Optional error message from strategy */
    error?: string | undefined;
    /** Optional note about this strategy or its result */
    note?: string | undefined;
  };
  ["BuildTimingsInput"]: {
    /** Time to build and push the image, measured by flyctl */
    buildAndPushMs?: ModelTypes["BigInt"] | undefined;
    /** Time to initialize client used to connect to either remote or local builder */
    builderInitMs?: ModelTypes["BigInt"] | undefined;
    /** Time to build the image including create context, measured by flyctl */
    buildMs?: ModelTypes["BigInt"] | undefined;
    /** Time to create the build context tar file, measured by flyctl */
    contextBuildMs?: ModelTypes["BigInt"] | undefined;
    /** Time for builder to build image after receiving context, measured by flyctl */
    imageBuildMs?: ModelTypes["BigInt"] | undefined;
    /** Time to push completed image to registry, measured by flyctl */
    pushMs?: ModelTypes["BigInt"] | undefined;
  };
  ["BuilderMetaInput"]: {
    /** Local or remote builder type */
    builderType: string;
    /** Docker version reported by builder */
    dockerVersion?: string | undefined;
    /** Whther or not buildkit is enabled on builder */
    buildkitEnabled?: boolean | undefined;
    /** Platform reported by the builder */
    platform?: string | undefined;
    /** Remote builder app used */
    remoteAppName?: string | undefined;
    /** Remote builder machine used */
    remoteMachineId?: string | undefined;
  };
  /** Autogenerated return type of CancelBuild. */
  ["CancelBuildPayload"]: {
    build: ModelTypes["Build"];
  };
  /** A set of base64 messagepack encoded macaroon caveats (See https://github.com/superfly/macaroon) */
  ["CaveatSet"]: any;
  ["Certificate"]: {
    expiresAt: ModelTypes["ISO8601DateTime"];
    hostname: string;
    id: string;
    type: string;
  };
  /** The connection type for Certificate. */
  ["CertificateConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["CertificateEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["Certificate"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CertificateEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["Certificate"] | undefined;
  };
  /** health check */
  ["Check"]: {
    httpHeaders?: Array<ModelTypes["CheckHeader"]> | undefined;
    httpMethod?: string | undefined;
    httpPath?: string | undefined;
    httpProtocol?: ModelTypes["HTTPProtocol"] | undefined;
    httpTlsSkipVerify?: boolean | undefined;
    /** Check interval in milliseconds */
    interval: number;
    name?: string | undefined;
    scriptArgs?: Array<string> | undefined;
    scriptCommand?: string | undefined;
    /** Check timeout in milliseconds */
    timeout: number;
    type: ModelTypes["CheckType"];
  };
  /** Autogenerated input type of CheckCertificate */
  ["CheckCertificateInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Application to ID */
    appId: string;
    /** Certificate hostname to check */
    hostname: string;
  };
  /** Autogenerated return type of CheckCertificate. */
  ["CheckCertificatePayload"]: {
    app?: ModelTypes["App"] | undefined;
    certificate?: ModelTypes["AppCertificate"] | undefined;
    check?: ModelTypes["HostnameCheck"] | undefined;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CheckDomain */
  ["CheckDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Domain name to check */
    domainName: string;
  };
  /** Autogenerated return type of CheckDomain. */
  ["CheckDomainPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    dnsAvailable: boolean;
    domainName: string;
    registrationAvailable: boolean;
    registrationPeriod?: number | undefined;
    registrationPrice?: number | undefined;
    registrationSupported: boolean;
    tld: string;
    transferAvailable: boolean;
  };
  /** check job http response */
  ["CheckHTTPResponse"]: {
    closeTs: string;
    connectedTs: string;
    dnsTs: string;
    firstTs: string;
    flyioDebug?: ModelTypes["JSON"] | undefined;
    headers: ModelTypes["JSON"];
    id: string;
    lastTs: string;
    location: ModelTypes["CheckLocation"];
    rawHeaders: string;
    rawOutput: Array<string>;
    resolvedIp: string;
    sentTs: string;
    startTs: string;
    statusCode: number;
    tlsTs?: string | undefined;
  };
  /** The connection type for CheckHTTPResponse. */
  ["CheckHTTPResponseConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["CheckHTTPResponseEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["CheckHTTPResponse"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CheckHTTPResponseEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["CheckHTTPResponse"] | undefined;
  };
  ["CheckHTTPVerb"]: CheckHTTPVerb;
  /** HTTP header for a health check */
  ["CheckHeader"]: {
    name: string;
    value: string;
  };
  ["CheckHeaderInput"]: {
    name: string;
    value: string;
  };
  ["CheckInput"]: {
    type: ModelTypes["CheckType"];
    name?: string | undefined;
    /** Check interval in milliseconds */
    interval?: number | undefined;
    /** Check timeout in milliseconds */
    timeout?: number | undefined;
    httpMethod?: ModelTypes["HTTPMethod"] | undefined;
    httpPath?: string | undefined;
    httpProtocol?: ModelTypes["HTTPProtocol"] | undefined;
    httpTlsSkipVerify?: boolean | undefined;
    httpHeaders?: Array<ModelTypes["CheckHeaderInput"]> | undefined;
    scriptCommand?: string | undefined;
    scriptArgs?: Array<string> | undefined;
  };
  /** check job */
  ["CheckJob"]: {
    httpOptions?: ModelTypes["CheckJobHTTPOptions"] | undefined;
    id: string;
    locations: ModelTypes["CheckLocationConnection"];
    nextRunAt?: ModelTypes["ISO8601DateTime"] | undefined;
    runs: ModelTypes["CheckJobRunConnection"];
    schedule?: string | undefined;
    url: string;
  };
  /** The connection type for CheckJob. */
  ["CheckJobConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["CheckJobEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["CheckJob"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CheckJobEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["CheckJob"] | undefined;
  };
  /** health check state */
  ["CheckJobHTTPOptions"]: {
    headers: Array<string>;
    verb: ModelTypes["CheckHTTPVerb"];
  };
  /** health check state */
  ["CheckJobHTTPOptionsInput"]: {
    verb: ModelTypes["CheckHTTPVerb"];
    headers?: Array<string> | undefined;
  };
  /** check job run */
  ["CheckJobRun"]: {
    completedAt?: ModelTypes["ISO8601DateTime"] | undefined;
    createdAt: ModelTypes["ISO8601DateTime"];
    httpOptions: ModelTypes["CheckJobHTTPOptions"];
    httpResponses: ModelTypes["CheckHTTPResponseConnection"];
    id: string;
    locations: ModelTypes["CheckLocationConnection"];
    state: string;
    tests: Array<string>;
    url: string;
  };
  /** The connection type for CheckJobRun. */
  ["CheckJobRunConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["CheckJobRunEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["CheckJobRun"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CheckJobRunEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["CheckJobRun"] | undefined;
  };
  /** check location */
  ["CheckLocation"]: {
    coordinates: Array<number>;
    country: string;
    locality: string;
    name: string;
    state?: string | undefined;
    title: string;
  };
  /** The connection type for CheckLocation. */
  ["CheckLocationConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["CheckLocationEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["CheckLocation"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CheckLocationEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["CheckLocation"] | undefined;
  };
  /** health check state */
  ["CheckState"]: {
    allocation: ModelTypes["Allocation"];
    allocationId: string;
    name: string;
    output: string;
    serviceName: string;
    status: string;
    type: ModelTypes["CheckType"];
    updatedAt: ModelTypes["ISO8601DateTime"];
  };
  /** The connection type for CheckState. */
  ["CheckStateConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["CheckStateEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["CheckState"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CheckStateEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["CheckState"] | undefined;
  };
  ["CheckType"]: CheckType;
  /** Autogenerated input type of ConfigureRegions */
  ["ConfigureRegionsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Regions to allow running in */
    allowRegions?: Array<string> | undefined;
    /** Regions to deny running in */
    denyRegions?: Array<string> | undefined;
    /** Fallback regions. Used if preferred regions are having issues */
    backupRegions?: Array<string> | undefined;
    /** Process group to modify */
    group?: string | undefined;
  };
  /** Autogenerated return type of ConfigureRegions. */
  ["ConfigureRegionsPayload"]: {
    app: ModelTypes["App"];
    backupRegions: Array<ModelTypes["Region"]>;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    group?: string | undefined;
    regions: Array<ModelTypes["Region"]>;
  };
  /** Autogenerated input type of CreateAddOn */
  ["CreateAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** An optional application ID to attach the add-on to after provisioning */
    appId?: string | undefined;
    /** The organization which owns the add-on */
    organizationId?: string | undefined;
    /** The add-on type to provision */
    type: ModelTypes["AddOnType"];
    /** An optional name for the add-on */
    name?: string | undefined;
    /** The add-on plan ID */
    planId?: string | undefined;
    /** Desired primary region for the add-on */
    primaryRegion?: string | undefined;
    /** Desired regions to place replicas in */
    readRegions?: Array<string> | undefined;
    /** Options specific to the add-on */
    options?: ModelTypes["JSON"] | undefined;
  };
  /** Autogenerated return type of CreateAddOn. */
  ["CreateAddOnPayload"]: {
    addOn: ModelTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CreateAndRegisterDomain */
  ["CreateAndRegisterDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The domain name */
    name: string;
    /** Enable whois privacy on the registration */
    whoisPrivacy?: boolean | undefined;
    /** Enable auto renew on the registration */
    autoRenew?: boolean | undefined;
  };
  /** Autogenerated return type of CreateAndRegisterDomain. */
  ["CreateAndRegisterDomainPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: ModelTypes["Domain"];
    organization: ModelTypes["Organization"];
  };
  /** Autogenerated input type of CreateAndTransferDomain */
  ["CreateAndTransferDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The domain name */
    name: string;
    /** The authorization code */
    authorizationCode: string;
  };
  /** Autogenerated return type of CreateAndTransferDomain. */
  ["CreateAndTransferDomainPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: ModelTypes["Domain"];
    organization: ModelTypes["Organization"];
  };
  /** Autogenerated input type of CreateApp */
  ["CreateAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The application runtime */
    runtime?: ModelTypes["RuntimeType"] | undefined;
    /** The name of the new application. Defaults to a random name. */
    name?: string | undefined;
    preferredRegion?: string | undefined;
    heroku?: boolean | undefined;
    network?: string | undefined;
    appRoleId?: string | undefined;
    machines?: boolean | undefined;
  };
  /** Autogenerated return type of CreateApp. */
  ["CreateAppPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CreateBuild */
  ["CreateBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the app being built */
    appName: string;
    /** The ID of the machine being built (only set for machine builds) */
    machineId?: string | undefined;
    /** Options set for building image */
    imageOpts: ModelTypes["BuildImageOptsInput"];
    /** List of available build strategies that will be attempted */
    strategiesAvailable: Array<string>;
    /** Whether builder is remote or local */
    builderType: string;
  };
  /** Autogenerated return type of CreateBuild. */
  ["CreateBuildPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** build id */
    id: string;
    /** stored build status */
    status: string;
  };
  /** Autogenerated input type of CreateCheckJob */
  ["CreateCheckJobInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Organization ID */
    organizationId: string;
    /** The URL to check */
    url: string;
    /** http checks locations */
    locations: Array<string>;
    /** http check options */
    httpOptions: ModelTypes["CheckJobHTTPOptionsInput"];
  };
  /** Autogenerated return type of CreateCheckJob. */
  ["CreateCheckJobPayload"]: {
    checkJob: ModelTypes["CheckJob"];
    checkJobRun?: ModelTypes["CheckJobRun"] | undefined;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CreateCheckJobRun */
  ["CreateCheckJobRunInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Check Job ID */
    checkJobId: string;
  };
  /** Autogenerated return type of CreateCheckJobRun. */
  ["CreateCheckJobRunPayload"]: {
    checkJob: ModelTypes["CheckJob"];
    checkJobRun?: ModelTypes["CheckJobRun"] | undefined;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CreateDNSPortal */
  ["CreateDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The unique name of this portal. A random name will be generated if omitted. */
    name?: string | undefined;
    /** The title of this portal */
    title?: string | undefined;
    /** The return url for this portal */
    returnUrl?: string | undefined;
    /** The text to display for the return url link */
    returnUrlText?: string | undefined;
    /** The support url for this portal */
    supportUrl?: string | undefined;
    /** The text to display for the support url link */
    supportUrlText?: string | undefined;
    /** The primary branding color */
    primaryColor?: string | undefined;
    /** The secondary branding color */
    accentColor?: string | undefined;
  };
  /** Autogenerated return type of CreateDNSPortal. */
  ["CreateDNSPortalPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    dnsPortal: ModelTypes["DNSPortal"];
  };
  /** Autogenerated input type of CreateDNSPortalSession */
  ["CreateDNSPortalSessionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the dns portal */
    dnsPortalId: string;
    /** The node ID of the domain to edit */
    domainId: string;
    /** Optionally override the portal's default title for this session */
    title?: string | undefined;
    /** Optionally override the portal's default return url for this session */
    returnUrl?: string | undefined;
    /** Optionally override the portal's default return url text for this session */
    returnUrlText?: string | undefined;
  };
  /** Autogenerated return type of CreateDNSPortalSession. */
  ["CreateDNSPortalSessionPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    dnsPortalSession: ModelTypes["DNSPortalSession"];
  };
  /** Autogenerated input type of CreateDNSRecord */
  ["CreateDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the domain */
    domainId: string;
    /** The type of the record */
    type: ModelTypes["DNSRecordType"];
    /** The dns record name */
    name: string;
    /** The TTL in seconds */
    ttl: number;
    /** The content of the record */
    rdata: string;
  };
  /** Autogenerated return type of CreateDNSRecord. */
  ["CreateDNSRecordPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    record: ModelTypes["DNSRecord"];
  };
  /** Autogenerated input type of CreateDelegatedWireGuardToken */
  ["CreateDelegatedWireGuardTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The name with which to refer to the peer */
    name?: string | undefined;
  };
  /** Autogenerated return type of CreateDelegatedWireGuardToken. */
  ["CreateDelegatedWireGuardTokenPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    token: string;
  };
  /** Autogenerated input type of CreateDoctorReport */
  ["CreateDoctorReportInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The report data */
    data: ModelTypes["JSON"];
  };
  /** Autogenerated return type of CreateDoctorReport. */
  ["CreateDoctorReportPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    reportId: string;
  };
  /** Autogenerated return type of CreateDoctorUrl. */
  ["CreateDoctorUrlPayload"]: {
    putUrl: string;
  };
  /** Autogenerated input type of CreateDomain */
  ["CreateDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The domain name */
    name: string;
  };
  /** Autogenerated return type of CreateDomain. */
  ["CreateDomainPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: ModelTypes["Domain"];
    organization: ModelTypes["Organization"];
  };
  /** Autogenerated input type of CreateExtensionTosAgreement */
  ["CreateExtensionTosAgreementInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The add-on provider name */
    addOnProviderName: string;
    /** The organization that agrees to the ToS */
    organizationId?: string | undefined;
  };
  /** Autogenerated return type of CreateExtensionTosAgreement. */
  ["CreateExtensionTosAgreementPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CreateLimitedAccessToken */
  ["CreateLimitedAccessTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    name: string;
    /** The node ID of the organization */
    organizationId: string;
    profile: string;
    profileParams?: ModelTypes["JSON"] | undefined;
    expiry?: string | undefined;
    /** Names of third-party configurations to opt into */
    optInThirdParties?: Array<string> | undefined;
    /** Names of third-party configurations to opt out of */
    optOutThirdParties?: Array<string> | undefined;
  };
  /** Autogenerated return type of CreateLimitedAccessToken. */
  ["CreateLimitedAccessTokenPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    limitedAccessToken: ModelTypes["LimitedAccessToken"];
  };
  /** Autogenerated input type of CreateOrganization */
  ["CreateOrganizationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the organization */
    name: string;
    /** Whether or not new apps in this org use Apps V2 by default */
    appsV2DefaultOn?: boolean | undefined;
  };
  /** Autogenerated input type of CreateOrganizationInvitation */
  ["CreateOrganizationInvitationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The email to invite */
    email: string;
  };
  /** Autogenerated return type of CreateOrganizationInvitation. */
  ["CreateOrganizationInvitationPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    invitation: ModelTypes["OrganizationInvitation"];
  };
  /** Autogenerated return type of CreateOrganization. */
  ["CreateOrganizationPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: ModelTypes["Organization"];
    token: string;
  };
  /** Autogenerated input type of CreatePostgresClusterDatabase */
  ["CreatePostgresClusterDatabaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the postgres cluster app */
    appName: string;
    /** The name of the database */
    databaseName: string;
  };
  /** Autogenerated return type of CreatePostgresClusterDatabase. */
  ["CreatePostgresClusterDatabasePayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    database: ModelTypes["PostgresClusterDatabase"];
    postgresClusterRole: ModelTypes["PostgresClusterAppRole"];
  };
  /** Autogenerated input type of CreatePostgresClusterUser */
  ["CreatePostgresClusterUserInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the postgres cluster app */
    appName: string;
    /** The name of the database */
    username: string;
    /** The password of the user */
    password: string;
    /** Should this user be a superuser */
    superuser?: boolean | undefined;
  };
  /** Autogenerated return type of CreatePostgresClusterUser. */
  ["CreatePostgresClusterUserPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    postgresClusterRole: ModelTypes["PostgresClusterAppRole"];
    user: ModelTypes["PostgresClusterUser"];
  };
  /** Autogenerated input type of CreateRelease */
  ["CreateReleaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** The image to deploy */
    image: string;
    /** nomad or machines */
    platformVersion: string;
    /** app definition */
    definition: ModelTypes["JSON"];
    /** The strategy for replacing existing instances. Defaults to canary. */
    strategy: ModelTypes["DeploymentStrategy"];
  };
  /** Autogenerated return type of CreateRelease. */
  ["CreateReleasePayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release?: ModelTypes["Release"] | undefined;
  };
  /** Autogenerated input type of CreateTemplateDeployment */
  ["CreateTemplateDeploymentInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization to move the app to */
    organizationId: string;
    template: ModelTypes["JSON"];
    variables?: Array<ModelTypes["PropertyInput"]> | undefined;
  };
  /** Autogenerated return type of CreateTemplateDeployment. */
  ["CreateTemplateDeploymentPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    templateDeployment: ModelTypes["TemplateDeployment"];
  };
  /** Autogenerated input type of CreateThirdPartyConfiguration */
  ["CreateThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Friendly name for this configuration */
    name: string;
    /** Location URL of the third-party service capable of discharging */
    location: string;
    /** Restrictions to be placed on third-party caveats */
    caveats?: ModelTypes["CaveatSet"] | undefined;
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel: ModelTypes["ThirdPartyConfigurationLevel"];
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel: ModelTypes["ThirdPartyConfigurationLevel"];
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel: ModelTypes["ThirdPartyConfigurationLevel"];
  };
  /** Autogenerated return type of CreateThirdPartyConfiguration. */
  ["CreateThirdPartyConfigurationPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    thirdPartyConfiguration: ModelTypes["ThirdPartyConfiguration"];
  };
  /** Autogenerated input type of CreateVolume */
  ["CreateVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to attach the new volume to */
    appId: string;
    /** Volume name */
    name: string;
    /** Desired region for volume */
    region: string;
    /** Desired volume size, in GB */
    sizeGb: number;
    /** Volume should be encrypted at rest */
    encrypted?: boolean | undefined;
    /** Provision volume in a redundancy zone not already in use by this app */
    requireUniqueZone?: boolean | undefined;
    snapshotId?: string | undefined;
    fsType?: ModelTypes["FsTypeType"] | undefined;
  };
  /** Autogenerated return type of CreateVolume. */
  ["CreateVolumePayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    volume: ModelTypes["Volume"];
  };
  /** Autogenerated input type of CreateVolumeSnapshot */
  ["CreateVolumeSnapshotInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    volumeId: string;
  };
  /** Autogenerated return type of CreateVolumeSnapshot. */
  ["CreateVolumeSnapshotPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    volume: ModelTypes["Volume"];
  };
  ["DNSPortal"]: {
    accentColor: string;
    createdAt: ModelTypes["ISO8601DateTime"];
    id: string;
    name: string;
    organization: ModelTypes["Organization"];
    primaryColor: string;
    returnUrl?: string | undefined;
    returnUrlText?: string | undefined;
    supportUrl?: string | undefined;
    supportUrlText?: string | undefined;
    title: string;
    updatedAt: ModelTypes["ISO8601DateTime"];
  };
  /** The connection type for DNSPortal. */
  ["DNSPortalConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["DNSPortalEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["DNSPortal"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["DNSPortalEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["DNSPortal"] | undefined;
  };
  ["DNSPortalSession"]: {
    createdAt: ModelTypes["ISO8601DateTime"];
    /** The dns portal this session */
    dnsPortal: ModelTypes["DNSPortal"];
    expiresAt: ModelTypes["ISO8601DateTime"];
    id: string;
    /** Is this session expired? */
    isExpired: boolean;
    /** The overridden return url for this session */
    returnUrl?: string | undefined;
    /** The overridden return url text for this session */
    returnUrlText?: string | undefined;
    /** The overridden title for this session */
    title?: string | undefined;
    /** The url to access this session's dns portal */
    url: string;
  };
  ["DNSRecord"]: {
    createdAt: ModelTypes["ISO8601DateTime"];
    /** The domain this record belongs to */
    domain: ModelTypes["Domain"];
    /** Fully qualified domain name for this record */
    fqdn: string;
    id: string;
    /** Is this record at the zone apex? */
    isApex: boolean;
    /** Is this a system record? System records are managed by fly and not editable. */
    isSystem: boolean;
    /** Is this record a wildcard? */
    isWildcard: boolean;
    /** The name of this record. @ indicates the record is at the zone apex. */
    name: string;
    /** The record data */
    rdata: string;
    /** The number of seconds this record can be cached for */
    ttl: number;
    /** The type of record */
    type: ModelTypes["DNSRecordType"];
    updatedAt: ModelTypes["ISO8601DateTime"];
  };
  ["DNSRecordAttributes"]: {
    /** The name of the record. */
    name: string;
    /** The record data. */
    rdata: string;
    /** The number of seconds this record can be cached for. */
    ttl: number;
    /** The type of record. */
    type: ModelTypes["DNSRecordType"];
  };
  ["DNSRecordChangeAction"]: DNSRecordChangeAction;
  ["DNSRecordChangeInput"]: {
    /** The action to perform on this record. */
    action: ModelTypes["DNSRecordChangeAction"];
    /** The id of the record this action will apply to. This is required if the action is UPDATE or DELETE. */
    recordId?: string | undefined;
    /** The record type. This is required if action is CREATE. */
    type?: ModelTypes["DNSRecordType"] | undefined;
    /** The name of the record. If omitted it will default to @ - the zone apex. */
    name?: string | undefined;
    /** The number of seconds this record can be cached for. Defaults to 1 hour. */
    ttl?: number | undefined;
    /** The record data. Required if action is CREATE */
    rdata?: string | undefined;
  };
  /** The connection type for DNSRecord. */
  ["DNSRecordConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["DNSRecordEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["DNSRecord"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  ["DNSRecordDiff"]: {
    /** The action that was performed. */
    action: ModelTypes["DNSRecordChangeAction"];
    /** The attributes for this record after the action was performed. */
    newAttributes?: ModelTypes["DNSRecordAttributes"] | undefined;
    /** The text representation of this record after the action was performed. */
    newText?: string | undefined;
    /** The attributes for this record before the action was performed. */
    oldAttributes?: ModelTypes["DNSRecordAttributes"] | undefined;
    /** The text representation of this record before the action was performed. */
    oldText?: string | undefined;
  };
  /** An edge in a connection. */
  ["DNSRecordEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["DNSRecord"] | undefined;
  };
  ["DNSRecordType"]: DNSRecordType;
  ["DNSRecordWarning"]: {
    /** The action to perform. */
    action: ModelTypes["DNSRecordChangeAction"];
    /** The desired attributes for this record. */
    attributes: ModelTypes["DNSRecordAttributes"];
    /** The warning message. */
    message: string;
    /** The record this warning applies to. */
    record?: ModelTypes["DNSRecord"] | undefined;
  };
  ["DelegatedWireGuardToken"]: {
    id: string;
    name: string;
  };
  /** The connection type for DelegatedWireGuardToken. */
  ["DelegatedWireGuardTokenConnection"]: {
    /** A list of edges. */
    edges?:
      | Array<ModelTypes["DelegatedWireGuardTokenEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?:
      | Array<ModelTypes["DelegatedWireGuardToken"] | undefined>
      | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["DelegatedWireGuardTokenEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["DelegatedWireGuardToken"] | undefined;
  };
  /** Autogenerated input type of DeleteAddOn */
  ["DeleteAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the add-on to delete */
    addOnId?: string | undefined;
    /** The name of the add-on to delete */
    name?: string | undefined;
  };
  /** Autogenerated return type of DeleteAddOn. */
  ["DeleteAddOnPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    deletedAddOnName?: string | undefined;
  };
  /** Autogenerated return type of DeleteApp. */
  ["DeleteAppPayload"]: {
    /** The organization that owned the deleted app */
    organization: ModelTypes["Organization"];
  };
  /** Autogenerated return type of DeleteCertificate. */
  ["DeleteCertificatePayload"]: {
    app?: ModelTypes["App"] | undefined;
    certificate?: ModelTypes["AppCertificate"] | undefined;
    errors?: Array<string> | undefined;
  };
  /** Autogenerated input type of DeleteDNSPortal */
  ["DeleteDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the dns portal */
    dnsPortalId: string;
  };
  /** Autogenerated return type of DeleteDNSPortal. */
  ["DeleteDNSPortalPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The organization that owned the dns portal */
    organization: ModelTypes["Organization"];
  };
  /** Autogenerated input type of DeleteDNSPortalSession */
  ["DeleteDNSPortalSessionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the dns portal session */
    dnsPortalSessionId: string;
  };
  /** Autogenerated return type of DeleteDNSPortalSession. */
  ["DeleteDNSPortalSessionPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The dns portal that owned the session */
    dnsPortal: ModelTypes["DNSPortal"];
  };
  /** Autogenerated input type of DeleteDNSRecord */
  ["DeleteDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the DNS record */
    recordId: string;
  };
  /** Autogenerated return type of DeleteDNSRecord. */
  ["DeleteDNSRecordPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: ModelTypes["Domain"];
  };
  /** Autogenerated input type of DeleteDelegatedWireGuardToken */
  ["DeleteDelegatedWireGuardTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The raw WireGuard token */
    token?: string | undefined;
    /** The name with which to refer to the token */
    name?: string | undefined;
  };
  /** Autogenerated return type of DeleteDelegatedWireGuardToken. */
  ["DeleteDelegatedWireGuardTokenPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    token: string;
  };
  /** Autogenerated input type of DeleteDeploymentSource */
  ["DeleteDeploymentSourceInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to update */
    appId: string;
  };
  /** Autogenerated return type of DeleteDeploymentSource. */
  ["DeleteDeploymentSourcePayload"]: {
    app?: ModelTypes["App"] | undefined;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of DeleteDomain */
  ["DeleteDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the domain */
    domainId: string;
  };
  /** Autogenerated return type of DeleteDomain. */
  ["DeleteDomainPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: ModelTypes["Organization"];
  };
  /** Autogenerated input type of DeleteHealthCheckHandler */
  ["DeleteHealthCheckHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Handler name */
    name: string;
  };
  /** Autogenerated return type of DeleteHealthCheckHandler. */
  ["DeleteHealthCheckHandlerPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of DeleteLimitedAccessToken */
  ["DeleteLimitedAccessTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The root of the macaroon */
    token?: string | undefined;
    /** The node ID for real */
    id?: string | undefined;
  };
  /** Autogenerated return type of DeleteLimitedAccessToken. */
  ["DeleteLimitedAccessTokenPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    token?: string | undefined;
  };
  /** Autogenerated input type of DeleteOrganization */
  ["DeleteOrganizationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the organization to delete */
    organizationId: string;
  };
  /** Autogenerated input type of DeleteOrganizationInvitation */
  ["DeleteOrganizationInvitationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the invitation */
    invitationId: string;
  };
  /** Autogenerated return type of DeleteOrganizationInvitation. */
  ["DeleteOrganizationInvitationPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: ModelTypes["Organization"];
  };
  /** Autogenerated input type of DeleteOrganizationMembership */
  ["DeleteOrganizationMembershipInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The node ID of the user */
    userId: string;
  };
  /** Autogenerated return type of DeleteOrganizationMembership. */
  ["DeleteOrganizationMembershipPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: ModelTypes["Organization"];
    user: ModelTypes["User"];
  };
  /** Autogenerated return type of DeleteOrganization. */
  ["DeleteOrganizationPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    deletedOrganizationId: string;
  };
  /** Autogenerated input type of DeleteRemoteBuilder */
  ["DeleteRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
  };
  /** Autogenerated return type of DeleteRemoteBuilder. */
  ["DeleteRemoteBuilderPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: ModelTypes["Organization"];
  };
  /** Autogenerated input type of DeleteThirdPartyConfiguration */
  ["DeleteThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the configuration */
    thirdPartyConfigurationId: string;
  };
  /** Autogenerated return type of DeleteThirdPartyConfiguration. */
  ["DeleteThirdPartyConfigurationPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    ok: boolean;
  };
  /** Autogenerated input type of DeleteVolume */
  ["DeleteVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the volume */
    volumeId: string;
    /** Unique lock ID */
    lockId?: string | undefined;
  };
  /** Autogenerated return type of DeleteVolume. */
  ["DeleteVolumePayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of DeployImage */
  ["DeployImageInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** The image to deploy */
    image: string;
    /** Network services to expose */
    services?: Array<ModelTypes["ServiceInput"]> | undefined;
    /** app definition */
    definition?: ModelTypes["JSON"] | undefined;
    /** The strategy for replacing existing instances. Defaults to canary. */
    strategy?: ModelTypes["DeploymentStrategy"] | undefined;
  };
  /** Autogenerated return type of DeployImage. */
  ["DeployImagePayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release?: ModelTypes["Release"] | undefined;
    releaseCommand?: ModelTypes["ReleaseCommand"] | undefined;
  };
  /** Continuous deployment configuration */
  ["DeploymentSource"]: {
    backend: ModelTypes["JSON"];
    baseDir: string;
    connected: boolean;
    id: string;
    provider: string;
    /** The ref to build from */
    ref: string;
    repositoryId: string;
    /** The repository to fetch source code from */
    repositoryUrl: string;
  };
  ["DeploymentStatus"]: {
    allocations: Array<ModelTypes["Allocation"]>;
    description: string;
    desiredCount: number;
    healthyCount: number;
    /** Unique ID for this deployment */
    id: string;
    inProgress: boolean;
    placedCount: number;
    promoted: boolean;
    status: string;
    successful: boolean;
    unhealthyCount: number;
    version: number;
  };
  ["DeploymentStrategy"]: DeploymentStrategy;
  /** Autogenerated input type of DetachPostgresCluster */
  ["DetachPostgresClusterInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The postgres cluster application id */
    postgresClusterAppId: string;
    /** The application to detach postgres from */
    appId: string;
    /** The postgres attachment id */
    postgresClusterAttachmentId?: string | undefined;
  };
  /** Autogenerated return type of DetachPostgresCluster. */
  ["DetachPostgresClusterPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    postgresClusterApp: ModelTypes["App"];
  };
  /** Autogenerated input type of DischargeRootToken */
  ["DischargeRootTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    rootToken: string;
    organizationId: number;
    expiry?: string | undefined;
  };
  /** Autogenerated return type of DischargeRootToken. */
  ["DischargeRootTokenPayload"]: {
    authToken: string;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  ["Domain"]: {
    autoRenew?: boolean | undefined;
    createdAt: ModelTypes["ISO8601DateTime"];
    /** The delegated nameservers for the registration */
    delegatedNameservers?: Array<string> | undefined;
    /** The dns records for this domain */
    dnsRecords: ModelTypes["DNSRecordConnection"];
    dnsStatus: ModelTypes["DomainDNSStatus"];
    expiresAt?: ModelTypes["ISO8601DateTime"] | undefined;
    id: string;
    /** The name for this domain */
    name: string;
    /** The organization that owns this domain */
    organization: ModelTypes["Organization"];
    registrationStatus: ModelTypes["DomainRegistrationStatus"];
    updatedAt: ModelTypes["ISO8601DateTime"];
    /** The nameservers for the hosted zone */
    zoneNameservers: Array<string>;
  };
  /** The connection type for Domain. */
  ["DomainConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["DomainEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["Domain"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  ["DomainDNSStatus"]: DomainDNSStatus;
  /** An edge in a connection. */
  ["DomainEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["Domain"] | undefined;
  };
  ["DomainRegistrationStatus"]: DomainRegistrationStatus;
  /** Autogenerated input type of DummyWireGuardPeer */
  ["DummyWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The region in which to deploy the peer */
    region?: string | undefined;
  };
  /** Autogenerated return type of DummyWireGuardPeer. */
  ["DummyWireGuardPeerPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    endpointip: string;
    localpub: string;
    peerip: string;
    privkey: string;
    pubkey: string;
  };
  ["EmptyAppRole"]: {
    /** The name of this role */
    name: string;
  };
  /** Autogenerated input type of EnablePostgresConsul */
  ["EnablePostgresConsulInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    region?: string | undefined;
  };
  /** Autogenerated return type of EnablePostgresConsul. */
  ["EnablePostgresConsulPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    consulUrl: string;
  };
  /** Autogenerated input type of EnsureMachineRemoteBuilder */
  ["EnsureMachineRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The unique application name */
    appName?: string | undefined;
    /** The node ID of the organization */
    organizationId?: string | undefined;
    /** Desired region for the remote builder */
    region?: string | undefined;
    /** Use v2 machines */
    v2?: boolean | undefined;
  };
  /** Autogenerated return type of EnsureMachineRemoteBuilder. */
  ["EnsureMachineRemoteBuilderPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: ModelTypes["Machine"];
  };
  /** Autogenerated input type of EstablishSSHKey */
  ["EstablishSSHKeyInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Establish a key even if one is already set */
    override?: boolean | undefined;
  };
  /** Autogenerated return type of EstablishSSHKey. */
  ["EstablishSSHKeyPayload"]: {
    certificate: string;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of ExportDNSZone */
  ["ExportDNSZoneInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** ID of the domain to export */
    domainId: string;
  };
  /** Autogenerated return type of ExportDNSZone. */
  ["ExportDNSZonePayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    contents: string;
    domain: ModelTypes["Domain"];
  };
  /** Autogenerated input type of ExtendVolume */
  ["ExtendVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the volume */
    volumeId: string;
    /** The target volume size */
    sizeGb: number;
  };
  /** Autogenerated return type of ExtendVolume. */
  ["ExtendVolumePayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    needsRestart: boolean;
    volume: ModelTypes["Volume"];
  };
  /** Autogenerated input type of FinishBuild */
  ["FinishBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Build id returned by createBuild() mutation */
    buildId: string;
    /** The name of the app being built */
    appName: string;
    /** The ID of the machine being built (only set for machine builds) */
    machineId?: string | undefined;
    /** Indicate whether build completed or failed */
    status: string;
    /** Build strategies attempted and their result, should be in order of attempt */
    strategiesAttempted?:
      | Array<ModelTypes["BuildStrategyAttemptInput"]>
      | undefined;
    /** Metadata about the builder */
    builderMeta?: ModelTypes["BuilderMetaInput"] | undefined;
    /** Information about the docker image that was built */
    finalImage?: ModelTypes["BuildFinalImageInput"] | undefined;
    /** Timings for different phases of the build */
    timings?: ModelTypes["BuildTimingsInput"] | undefined;
    /** Log or error output */
    logs?: string | undefined;
  };
  /** Autogenerated return type of FinishBuild. */
  ["FinishBuildPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** build id */
    id: string;
    /** stored build status */
    status: string;
    /** wall clock time for this build */
    wallclockTimeMs: number;
  };
  ["FlyPlatform"]: {
    /** Latest flyctl release details */
    flyctl: ModelTypes["FlyctlRelease"];
    /** Fly global regions */
    regions: Array<ModelTypes["Region"]>;
    /** Region current request from */
    requestRegion?: string | undefined;
    /** Available VM sizes */
    vmSizes: Array<ModelTypes["VMSize"]>;
  };
  ["FlyctlMachineHostAppRole"]: {
    /** The name of this role */
    name: string;
  };
  ["FlyctlRelease"]: {
    timestamp: ModelTypes["ISO8601DateTime"];
    version: string;
  };
  /** Autogenerated input type of ForkVolume */
  ["ForkVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to attach the new volume to */
    appId: string;
    /** The volume to fork */
    sourceVolId: string;
    /** Volume name */
    name?: string | undefined;
    /** Lock the new volume to only usable on machines */
    machinesOnly?: boolean | undefined;
    /** Unique lock ID */
    lockId?: string | undefined;
    /** Enables experimental cross-host volume forking */
    remote?: boolean | undefined;
  };
  /** Autogenerated return type of ForkVolume. */
  ["ForkVolumePayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    volume: ModelTypes["Volume"];
  };
  ["FsTypeType"]: FsTypeType;
  ["GithubAppInstallation"]: {
    editUrl: string;
    id: string;
    owner: string;
    repositories: Array<ModelTypes["GithubRepository"]>;
  };
  ["GithubIntegration"]: {
    installationUrl: string;
    installations: Array<ModelTypes["GithubAppInstallation"]>;
    viewerAuthenticated: boolean;
  };
  ["GithubRepository"]: {
    fork: boolean;
    fullName: string;
    id: string;
    name: string;
    private: boolean;
  };
  /** Autogenerated input type of GrantPostgresClusterUserAccess */
  ["GrantPostgresClusterUserAccessInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the postgres cluster app */
    appName: string;
    /** The name of the database */
    username: string;
    /** The database to grant access to */
    databaseName: string;
  };
  /** Autogenerated return type of GrantPostgresClusterUserAccess. */
  ["GrantPostgresClusterUserAccessPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    database: ModelTypes["PostgresClusterDatabase"];
    postgresClusterRole: ModelTypes["PostgresClusterAppRole"];
    user: ModelTypes["PostgresClusterUser"];
  };
  ["HTTPMethod"]: HTTPMethod;
  ["HTTPProtocol"]: HTTPProtocol;
  ["HealthCheck"]: {
    /** Raw name of entity */
    entity: string;
    /** Time check last passed */
    lastPassing?: ModelTypes["ISO8601DateTime"] | undefined;
    /** Check name */
    name: string;
    /** Latest check output */
    output?: string | undefined;
    /** Current check state */
    state: string;
  };
  /** The connection type for HealthCheck. */
  ["HealthCheckConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["HealthCheckEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["HealthCheck"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["HealthCheckEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["HealthCheck"] | undefined;
  };
  ["HealthCheckHandler"]: {
    /** Handler name */
    name: string;
    /** Handler type (Slack or Pagerduty) */
    type: string;
  };
  /** The connection type for HealthCheckHandler. */
  ["HealthCheckHandlerConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["HealthCheckHandlerEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["HealthCheckHandler"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["HealthCheckHandlerEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["HealthCheckHandler"] | undefined;
  };
  ["HerokuApp"]: {
    id: string;
    name: string;
    region?: string | undefined;
    releasedAt: ModelTypes["ISO8601DateTime"];
    stack?: string | undefined;
    teamName?: string | undefined;
  };
  ["HerokuIntegration"]: {
    herokuApps: Array<ModelTypes["HerokuApp"]>;
    viewerAuthenticated: boolean;
  };
  ["Host"]: {
    id: string;
  };
  ["HostnameCheck"]: {
    aRecords: Array<string>;
    aaaaRecords: Array<string>;
    acmeDnsConfigured: boolean;
    caaRecords: Array<string>;
    cnameRecords: Array<string>;
    dnsConfigured: boolean;
    dnsProvider?: string | undefined;
    dnsVerificationRecord?: string | undefined;
    errors?: Array<string> | undefined;
    id: string;
    isProxied: boolean;
    resolvedAddresses: Array<string>;
    soa?: string | undefined;
  };
  ["IPAddress"]: {
    address: string;
    createdAt: ModelTypes["ISO8601DateTime"];
    id: string;
    region?: string | undefined;
    type: ModelTypes["IPAddressType"];
  };
  /** The connection type for IPAddress. */
  ["IPAddressConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["IPAddressEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["IPAddress"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["IPAddressEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["IPAddress"] | undefined;
  };
  ["IPAddressType"]: IPAddressType;
  /** An ISO 8601-encoded datetime */
  ["ISO8601DateTime"]: any;
  ["Image"]: {
    absoluteRef: string;
    compressedSize: number;
    compressedSizeFull: ModelTypes["BigInt"];
    config: ModelTypes["JSON"];
    configDigest: ModelTypes["JSON"];
    createdAt: ModelTypes["ISO8601DateTime"];
    digest: string;
    id: string;
    label: string;
    manifest: ModelTypes["JSON"];
    ref: string;
    registry: string;
    repository: string;
    tag?: string | undefined;
  };
  ["ImageVersion"]: {
    digest: string;
    registry: string;
    repository: string;
    tag: string;
    version?: string | undefined;
  };
  /** Autogenerated return type of ImportCertificate. */
  ["ImportCertificatePayload"]: {
    app?: ModelTypes["App"] | undefined;
    appCertificate?: ModelTypes["AppCertificate"] | undefined;
    certificate?: ModelTypes["Certificate"] | undefined;
    errors?: Array<string> | undefined;
  };
  /** Autogenerated input type of ImportDNSZone */
  ["ImportDNSZoneInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** ID of the domain to export */
    domainId: string;
    zonefile: string;
  };
  /** Autogenerated return type of ImportDNSZone. */
  ["ImportDNSZonePayload"]: {
    changes: Array<ModelTypes["DNSRecordDiff"]>;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: ModelTypes["Domain"];
    warnings: Array<ModelTypes["DNSRecordWarning"]>;
  };
  /** Autogenerated input type of IssueCertificate */
  ["IssueCertificateInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The names of the apps this certificate will be limited to accessing */
    appNames?: Array<string> | undefined;
    /** Hours for which certificate will be valid */
    validHours?: number | undefined;
    /** SSH principals for certificate (e.g. ["fly", "root"]) */
    principals?: Array<string> | undefined;
    /** The openssh-formatted ED25519 public key to issue the certificate for */
    publicKey?: string | undefined;
  };
  /** Autogenerated return type of IssueCertificate. */
  ["IssueCertificatePayload"]: {
    certificate: string;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The private key, if a public_key wasn't specified */
    key?: string | undefined;
  };
  /** Untyped JSON data */
  ["JSON"]: any;
  /** Autogenerated input type of KillMachine */
  ["KillMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** machine id */
    id: string;
  };
  /** Autogenerated return type of KillMachine. */
  ["KillMachinePayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: ModelTypes["Machine"];
  };
  /** Autogenerated input type of LaunchMachine */
  ["LaunchMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** The node ID of the organization */
    organizationId?: string | undefined;
    /** The ID of the machine */
    id?: string | undefined;
    /** The name of the machine */
    name?: string | undefined;
    /** Region for the machine */
    region?: string | undefined;
    /** Configuration */
    config: ModelTypes["JSON"];
  };
  /** Autogenerated return type of LaunchMachine. */
  ["LaunchMachinePayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: ModelTypes["Machine"];
  };
  ["LimitedAccessToken"]: {
    createdAt: ModelTypes["ISO8601DateTime"];
    expiresAt: ModelTypes["ISO8601DateTime"];
    id: string;
    name: string;
    profile: string;
    token: string;
    tokenHeader?: string | undefined;
  };
  /** The connection type for LimitedAccessToken. */
  ["LimitedAccessTokenConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["LimitedAccessTokenEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["LimitedAccessToken"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["LimitedAccessTokenEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["LimitedAccessToken"] | undefined;
  };
  /** Autogenerated input type of LockApp */
  ["LockAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of LockApp. */
  ["LockAppPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** When this lock automatically expires */
    expiration?: ModelTypes["ISO8601DateTime"] | undefined;
    /** Unique lock ID */
    lockId?: string | undefined;
  };
  ["LogEntry"]: {
    id: string;
    instanceId: string;
    level: string;
    message: string;
    region: string;
    timestamp: ModelTypes["ISO8601DateTime"];
  };
  /** Autogenerated input type of LogOut */
  ["LogOutInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated return type of LogOut. */
  ["LogOutPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    ok: boolean;
  };
  ["LoggedCertificate"]: {
    cert: string;
    id: string;
    root: boolean;
  };
  /** The connection type for LoggedCertificate. */
  ["LoggedCertificateConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["LoggedCertificateEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["LoggedCertificate"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["LoggedCertificateEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["LoggedCertificate"] | undefined;
  };
  ["Macaroon"]: {
    /** URL for avatar or placeholder */
    avatarUrl: string;
    createdAt?: ModelTypes["ISO8601DateTime"] | undefined;
    /** Email address for principal */
    email: string;
    featureFlags?: Array<string> | undefined;
    hasNodeproxyApps?: boolean | undefined;
    id?: string | undefined;
    lastRegion?: string | undefined;
    /** Display name of principal */
    name?: string | undefined;
    organizations?: ModelTypes["OrganizationConnection"] | undefined;
    personalOrganization?: ModelTypes["Organization"] | undefined;
    trust: ModelTypes["OrganizationTrust"];
    twoFactorProtection?: boolean | undefined;
    username?: string | undefined;
  };
  ["Machine"]: {
    app: ModelTypes["App"];
    config: ModelTypes["JSON"];
    createdAt: ModelTypes["ISO8601DateTime"];
    events: ModelTypes["MachineEventConnection"];
    host: ModelTypes["Host"];
    id: string;
    instanceId: string;
    ips: ModelTypes["MachineIPConnection"];
    name: string;
    region: string;
    state: string;
    updatedAt: ModelTypes["ISO8601DateTime"];
  };
  /** The connection type for Machine. */
  ["MachineConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["MachineEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["Machine"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["MachineEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["Machine"] | undefined;
  };
  /** A machine state change event */
  ["MachineEvent"]:
    | ModelTypes["MachineEventDestroy"]
    | ModelTypes["MachineEventExit"]
    | ModelTypes["MachineEventGeneric"]
    | ModelTypes["MachineEventStart"];
  /** The connection type for MachineEvent. */
  ["MachineEventConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["MachineEventEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["MachineEvent"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
  };
  ["MachineEventDestroy"]: {
    id: string;
    kind: string;
    timestamp: ModelTypes["ISO8601DateTime"];
  };
  /** An edge in a connection. */
  ["MachineEventEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["MachineEvent"] | undefined;
  };
  ["MachineEventExit"]: {
    exitCode: number;
    id: string;
    kind: string;
    metadata: ModelTypes["JSON"];
    oomKilled: boolean;
    requestedStop: boolean;
    timestamp: ModelTypes["ISO8601DateTime"];
  };
  ["MachineEventGeneric"]: {
    id: string;
    kind: string;
    timestamp: ModelTypes["ISO8601DateTime"];
  };
  ["MachineEventStart"]: {
    id: string;
    kind: string;
    timestamp: ModelTypes["ISO8601DateTime"];
  };
  ["MachineIP"]: {
    family: string;
    /** ID of the object. */
    id: string;
    ip: string;
    kind: string;
    maskSize: number;
  };
  /** The connection type for MachineIP. */
  ["MachineIPConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["MachineIPEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["MachineIP"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["MachineIPEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["MachineIP"] | undefined;
  };
  /** Autogenerated input type of MoveApp */
  ["MoveAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to move */
    appId: string;
    /** The node ID of the organization to move the app to */
    organizationId: string;
  };
  /** Autogenerated return type of MoveApp. */
  ["MoveAppPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  ["Mutations"]: {
    addCertificate?: ModelTypes["AddCertificatePayload"] | undefined;
    addWireGuardPeer?: ModelTypes["AddWireGuardPeerPayload"] | undefined;
    allocateIpAddress?: ModelTypes["AllocateIPAddressPayload"] | undefined;
    attachPostgresCluster?:
      | ModelTypes["AttachPostgresClusterPayload"]
      | undefined;
    cancelBuild?: ModelTypes["CancelBuildPayload"] | undefined;
    checkCertificate?: ModelTypes["CheckCertificatePayload"] | undefined;
    checkDomain?: ModelTypes["CheckDomainPayload"] | undefined;
    configureRegions?: ModelTypes["ConfigureRegionsPayload"] | undefined;
    createAddOn?: ModelTypes["CreateAddOnPayload"] | undefined;
    createAndRegisterDomain?:
      | ModelTypes["CreateAndRegisterDomainPayload"]
      | undefined;
    createAndTransferDomain?:
      | ModelTypes["CreateAndTransferDomainPayload"]
      | undefined;
    createApp?: ModelTypes["CreateAppPayload"] | undefined;
    createBuild?: ModelTypes["CreateBuildPayload"] | undefined;
    createCheckJob?: ModelTypes["CreateCheckJobPayload"] | undefined;
    createCheckJobRun?: ModelTypes["CreateCheckJobRunPayload"] | undefined;
    createDelegatedWireGuardToken?:
      | ModelTypes["CreateDelegatedWireGuardTokenPayload"]
      | undefined;
    createDnsPortal?: ModelTypes["CreateDNSPortalPayload"] | undefined;
    createDnsPortalSession?:
      | ModelTypes["CreateDNSPortalSessionPayload"]
      | undefined;
    createDnsRecord?: ModelTypes["CreateDNSRecordPayload"] | undefined;
    createDoctorReport?: ModelTypes["CreateDoctorReportPayload"] | undefined;
    createDoctorUrl?: ModelTypes["CreateDoctorUrlPayload"] | undefined;
    createDomain?: ModelTypes["CreateDomainPayload"] | undefined;
    createExtensionTosAgreement?:
      | ModelTypes["CreateExtensionTosAgreementPayload"]
      | undefined;
    createLimitedAccessToken?:
      | ModelTypes["CreateLimitedAccessTokenPayload"]
      | undefined;
    createOrganization?: ModelTypes["CreateOrganizationPayload"] | undefined;
    createOrganizationInvitation?:
      | ModelTypes["CreateOrganizationInvitationPayload"]
      | undefined;
    createPostgresClusterDatabase?:
      | ModelTypes["CreatePostgresClusterDatabasePayload"]
      | undefined;
    createPostgresClusterUser?:
      | ModelTypes["CreatePostgresClusterUserPayload"]
      | undefined;
    createRelease?: ModelTypes["CreateReleasePayload"] | undefined;
    createTemplateDeployment?:
      | ModelTypes["CreateTemplateDeploymentPayload"]
      | undefined;
    createThirdPartyConfiguration?:
      | ModelTypes["CreateThirdPartyConfigurationPayload"]
      | undefined;
    createVolume?: ModelTypes["CreateVolumePayload"] | undefined;
    createVolumeSnapshot?:
      | ModelTypes["CreateVolumeSnapshotPayload"]
      | undefined;
    deleteAddOn?: ModelTypes["DeleteAddOnPayload"] | undefined;
    /** Delete an app */
    deleteApp?: ModelTypes["DeleteAppPayload"] | undefined;
    deleteCertificate?: ModelTypes["DeleteCertificatePayload"] | undefined;
    deleteDelegatedWireGuardToken?:
      | ModelTypes["DeleteDelegatedWireGuardTokenPayload"]
      | undefined;
    deleteDeploymentSource?:
      | ModelTypes["DeleteDeploymentSourcePayload"]
      | undefined;
    deleteDnsPortal?: ModelTypes["DeleteDNSPortalPayload"] | undefined;
    deleteDnsPortalSession?:
      | ModelTypes["DeleteDNSPortalSessionPayload"]
      | undefined;
    deleteDnsRecord?: ModelTypes["DeleteDNSRecordPayload"] | undefined;
    deleteDomain?: ModelTypes["DeleteDomainPayload"] | undefined;
    deleteHealthCheckHandler?:
      | ModelTypes["DeleteHealthCheckHandlerPayload"]
      | undefined;
    deleteLimitedAccessToken?:
      | ModelTypes["DeleteLimitedAccessTokenPayload"]
      | undefined;
    deleteOrganization?: ModelTypes["DeleteOrganizationPayload"] | undefined;
    deleteOrganizationInvitation?:
      | ModelTypes["DeleteOrganizationInvitationPayload"]
      | undefined;
    deleteOrganizationMembership?:
      | ModelTypes["DeleteOrganizationMembershipPayload"]
      | undefined;
    deleteRemoteBuilder?: ModelTypes["DeleteRemoteBuilderPayload"] | undefined;
    deleteThirdPartyConfiguration?:
      | ModelTypes["DeleteThirdPartyConfigurationPayload"]
      | undefined;
    deleteVolume?: ModelTypes["DeleteVolumePayload"] | undefined;
    deployImage?: ModelTypes["DeployImagePayload"] | undefined;
    detachPostgresCluster?:
      | ModelTypes["DetachPostgresClusterPayload"]
      | undefined;
    dischargeRootToken?: ModelTypes["DischargeRootTokenPayload"] | undefined;
    dummyWireGuardPeer?: ModelTypes["DummyWireGuardPeerPayload"] | undefined;
    enablePostgresConsul?:
      | ModelTypes["EnablePostgresConsulPayload"]
      | undefined;
    ensureMachineRemoteBuilder?:
      | ModelTypes["EnsureMachineRemoteBuilderPayload"]
      | undefined;
    establishSshKey?: ModelTypes["EstablishSSHKeyPayload"] | undefined;
    exportDnsZone?: ModelTypes["ExportDNSZonePayload"] | undefined;
    extendVolume?: ModelTypes["ExtendVolumePayload"] | undefined;
    finishBuild?: ModelTypes["FinishBuildPayload"] | undefined;
    forkVolume?: ModelTypes["ForkVolumePayload"] | undefined;
    grantPostgresClusterUserAccess?:
      | ModelTypes["GrantPostgresClusterUserAccessPayload"]
      | undefined;
    importCertificate?: ModelTypes["ImportCertificatePayload"] | undefined;
    importDnsZone?: ModelTypes["ImportDNSZonePayload"] | undefined;
    issueCertificate?: ModelTypes["IssueCertificatePayload"] | undefined;
    killMachine?: ModelTypes["KillMachinePayload"] | undefined;
    launchMachine?: ModelTypes["LaunchMachinePayload"] | undefined;
    lockApp?: ModelTypes["LockAppPayload"] | undefined;
    logOut?: ModelTypes["LogOutPayload"] | undefined;
    moveApp?: ModelTypes["MoveAppPayload"] | undefined;
    nomadToMachinesMigration?:
      | ModelTypes["NomadToMachinesMigrationPayload"]
      | undefined;
    nomadToMachinesMigrationPrep?:
      | ModelTypes["NomadToMachinesMigrationPrepPayload"]
      | undefined;
    pauseApp?: ModelTypes["PauseAppPayload"] | undefined;
    registerDomain?: ModelTypes["RegisterDomainPayload"] | undefined;
    releaseIpAddress?: ModelTypes["ReleaseIPAddressPayload"] | undefined;
    removeMachine?: ModelTypes["RemoveMachinePayload"] | undefined;
    removeWireGuardPeer?: ModelTypes["RemoveWireGuardPeerPayload"] | undefined;
    resetAddOnPassword?: ModelTypes["ResetAddOnPasswordPayload"] | undefined;
    restartAllocation?: ModelTypes["RestartAllocationPayload"] | undefined;
    restartApp?: ModelTypes["RestartAppPayload"] | undefined;
    restoreVolumeSnapshot?:
      | ModelTypes["RestoreVolumeSnapshotPayload"]
      | undefined;
    resumeApp?: ModelTypes["ResumeAppPayload"] | undefined;
    revokePostgresClusterUserAccess?:
      | ModelTypes["RevokePostgresClusterUserAccessPayload"]
      | undefined;
    saveDeploymentSource?:
      | ModelTypes["SaveDeploymentSourcePayload"]
      | undefined;
    scaleApp?: ModelTypes["ScaleAppPayload"] | undefined;
    setAppsV2DefaultOn?: ModelTypes["SetAppsv2DefaultOnPayload"] | undefined;
    setPagerdutyHandler?: ModelTypes["SetPagerdutyHandlerPayload"] | undefined;
    setPlatformVersion?: ModelTypes["SetPlatformVersionPayload"] | undefined;
    setSecrets?: ModelTypes["SetSecretsPayload"] | undefined;
    setSlackHandler?: ModelTypes["SetSlackHandlerPayload"] | undefined;
    setVmCount?: ModelTypes["SetVMCountPayload"] | undefined;
    setVmSize?: ModelTypes["SetVMSizePayload"] | undefined;
    startBuild?: ModelTypes["StartBuildPayload"] | undefined;
    startMachine?: ModelTypes["StartMachinePayload"] | undefined;
    stopAllocation?: ModelTypes["StopAllocationPayload"] | undefined;
    stopMachine?: ModelTypes["StopMachinePayload"] | undefined;
    unlockApp?: ModelTypes["UnlockAppPayload"] | undefined;
    unsetSecrets?: ModelTypes["UnsetSecretsPayload"] | undefined;
    updateAddOn?: ModelTypes["UpdateAddOnPayload"] | undefined;
    updateAutoscaleConfig?:
      | ModelTypes["UpdateAutoscaleConfigPayload"]
      | undefined;
    updateDnsPortal?: ModelTypes["UpdateDNSPortalPayload"] | undefined;
    updateDnsRecord?: ModelTypes["UpdateDNSRecordPayload"] | undefined;
    updateDnsRecords?: ModelTypes["UpdateDNSRecordsPayload"] | undefined;
    updateOrganizationMembership?:
      | ModelTypes["UpdateOrganizationMembershipPayload"]
      | undefined;
    updateRelease?: ModelTypes["UpdateReleasePayload"] | undefined;
    updateRemoteBuilder?: ModelTypes["UpdateRemoteBuilderPayload"] | undefined;
    updateThirdPartyConfiguration?:
      | ModelTypes["UpdateThirdPartyConfigurationPayload"]
      | undefined;
    validateWireGuardPeers?:
      | ModelTypes["ValidateWireGuardPeersPayload"]
      | undefined;
  };
  /** An object with an ID. */
  ["Node"]:
    | ModelTypes["AccessToken"]
    | ModelTypes["AddOn"]
    | ModelTypes["AddOnPlan"]
    | ModelTypes["Allocation"]
    | ModelTypes["App"]
    | ModelTypes["AppCertificate"]
    | ModelTypes["AppChange"]
    | ModelTypes["Build"]
    | ModelTypes["Certificate"]
    | ModelTypes["CheckHTTPResponse"]
    | ModelTypes["CheckJob"]
    | ModelTypes["CheckJobRun"]
    | ModelTypes["DNSPortal"]
    | ModelTypes["DNSPortalSession"]
    | ModelTypes["DNSRecord"]
    | ModelTypes["DelegatedWireGuardToken"]
    | ModelTypes["Domain"]
    | ModelTypes["Host"]
    | ModelTypes["IPAddress"]
    | ModelTypes["LimitedAccessToken"]
    | ModelTypes["LoggedCertificate"]
    | ModelTypes["Machine"]
    | ModelTypes["MachineIP"]
    | ModelTypes["Organization"]
    | ModelTypes["OrganizationInvitation"]
    | ModelTypes["PostgresClusterAttachment"]
    | ModelTypes["Release"]
    | ModelTypes["ReleaseCommand"]
    | ModelTypes["ReleaseUnprocessed"]
    | ModelTypes["Secret"]
    | ModelTypes["TemplateDeployment"]
    | ModelTypes["ThirdPartyConfiguration"]
    | ModelTypes["User"]
    | ModelTypes["UserCoupon"]
    | ModelTypes["VM"]
    | ModelTypes["Volume"]
    | ModelTypes["VolumeSnapshot"]
    | ModelTypes["WireGuardPeer"];
  /** Autogenerated input type of NomadToMachinesMigration */
  ["NomadToMachinesMigrationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to move */
    appId: string;
  };
  /** Autogenerated return type of NomadToMachinesMigration. */
  ["NomadToMachinesMigrationPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of NomadToMachinesMigrationPrep */
  ["NomadToMachinesMigrationPrepInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to move */
    appId: string;
  };
  /** Autogenerated return type of NomadToMachinesMigrationPrep. */
  ["NomadToMachinesMigrationPrepPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  ["Organization"]: {
    activeDiscountName?: string | undefined;
    /** Single sign-on link for the given integration type */
    addOnSsoLink?: string | undefined;
    /** List third party integrations associated with an organization */
    addOns: ModelTypes["AddOnConnection"];
    /** Check if the organization has agreed to the extension provider terms of service */
    agreedToProviderTos: boolean;
    apps: ModelTypes["AppConnection"];
    billable: boolean;
    billingStatus: ModelTypes["BillingStatus"];
    /** The account credits in cents */
    creditBalance: number;
    /** The formatted account credits */
    creditBalanceFormatted: string;
    delegatedWireGuardTokens: ModelTypes["DelegatedWireGuardTokenConnection"];
    /** Find a dns portal by name */
    dnsPortal: ModelTypes["DNSPortal"];
    dnsPortals: ModelTypes["DNSPortalConnection"];
    /** Find a domain by name */
    domain?: ModelTypes["Domain"] | undefined;
    domains: ModelTypes["DomainConnection"];
    /** Single sign-on link for the given extension type */
    extensionSsoLink?: string | undefined;
    healthCheckHandlers: ModelTypes["HealthCheckHandlerConnection"];
    healthChecks: ModelTypes["HealthCheckConnection"];
    id: string;
    internalNumericId: ModelTypes["BigInt"];
    invitations: ModelTypes["OrganizationInvitationConnection"];
    isCreditCardSaved: boolean;
    limitedAccessTokens: ModelTypes["LimitedAccessTokenConnection"];
    loggedCertificates?: ModelTypes["LoggedCertificateConnection"] | undefined;
    members: ModelTypes["OrganizationMembershipsConnection"];
    /** Organization name */
    name: string;
    paidPlan: boolean;
    /** Whether the organization can provision beta extensions */
    provisionsBetaExtensions: boolean;
    /** Unmodified unique org slug */
    rawSlug: string;
    remoteBuilderApp?: ModelTypes["App"] | undefined;
    remoteBuilderImage: string;
    settings?: ModelTypes["JSON"] | undefined;
    /** Unique organization slug */
    slug: string;
    sshCertificate?: string | undefined;
    /** Configurations for third-party caveats to be issued on user macaroons */
    thirdPartyConfigurations: ModelTypes["ThirdPartyConfigurationConnection"];
    trust: ModelTypes["OrganizationTrust"];
    /** The type of organization */
    type: ModelTypes["OrganizationType"];
    /** The current user's role in the org */
    viewerRole: string;
    /** Find a peer by name */
    wireGuardPeer: ModelTypes["WireGuardPeer"];
    wireGuardPeers: ModelTypes["WireGuardPeerConnection"];
  };
  ["OrganizationAlertsEnabled"]: OrganizationAlertsEnabled;
  /** The connection type for Organization. */
  ["OrganizationConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["OrganizationEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["Organization"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["OrganizationEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["Organization"] | undefined;
  };
  ["OrganizationInvitation"]: {
    createdAt: ModelTypes["ISO8601DateTime"];
    email: string;
    id: string;
    /** The user who created the invitation */
    inviter: ModelTypes["User"];
    organization: ModelTypes["Organization"];
    redeemed: boolean;
    redeemedAt?: ModelTypes["ISO8601DateTime"] | undefined;
  };
  /** The connection type for OrganizationInvitation. */
  ["OrganizationInvitationConnection"]: {
    /** A list of edges. */
    edges?:
      | Array<ModelTypes["OrganizationInvitationEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["OrganizationInvitation"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["OrganizationInvitationEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["OrganizationInvitation"] | undefined;
  };
  ["OrganizationMemberRole"]: OrganizationMemberRole;
  /** The connection type for User. */
  ["OrganizationMembershipsConnection"]: {
    /** A list of edges. */
    edges?:
      | Array<ModelTypes["OrganizationMembershipsEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["User"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["OrganizationMembershipsEdge"]: {
    /** The alerts settings the user has in this organization */
    alertsEnabled: ModelTypes["OrganizationAlertsEnabled"];
    /** A cursor for use in pagination. */
    cursor: string;
    /** The date the user joined the organization */
    joinedAt: ModelTypes["ISO8601DateTime"];
    /** The item at the end of the edge. */
    node?: ModelTypes["User"] | undefined;
    /** The role the user has in this organization */
    role: ModelTypes["OrganizationMemberRole"];
  };
  ["OrganizationTrust"]: OrganizationTrust;
  ["OrganizationType"]: OrganizationType;
  /** Information about pagination in a connection. */
  ["PageInfo"]: {
    /** When paginating forwards, the cursor to continue. */
    endCursor?: string | undefined;
    /** When paginating forwards, are there more items? */
    hasNextPage: boolean;
    /** When paginating backwards, are there more items? */
    hasPreviousPage: boolean;
    /** When paginating backwards, the cursor to continue. */
    startCursor?: string | undefined;
  };
  /** Autogenerated input type of PauseApp */
  ["PauseAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of PauseApp. */
  ["PauseAppPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  ["PlatformVersionEnum"]: PlatformVersionEnum;
  ["PostgresClusterAppRole"]: {
    databases: Array<ModelTypes["PostgresClusterDatabase"]>;
    /** The name of this role */
    name: string;
    users: Array<ModelTypes["PostgresClusterUser"]>;
  };
  ["PostgresClusterAttachment"]: {
    databaseName: string;
    databaseUser: string;
    environmentVariableName: string;
    id: string;
  };
  /** The connection type for PostgresClusterAttachment. */
  ["PostgresClusterAttachmentConnection"]: {
    /** A list of edges. */
    edges?:
      | Array<ModelTypes["PostgresClusterAttachmentEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?:
      | Array<ModelTypes["PostgresClusterAttachment"] | undefined>
      | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["PostgresClusterAttachmentEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["PostgresClusterAttachment"] | undefined;
  };
  ["PostgresClusterDatabase"]: {
    name: string;
    users: Array<string>;
  };
  ["PostgresClusterUser"]: {
    databases: Array<string>;
    isSuperuser: boolean;
    username: string;
  };
  ["PriceTier"]: {
    unitAmount?: string | undefined;
    upTo?: ModelTypes["BigInt"] | undefined;
  };
  ["Principal"]: ModelTypes["Macaroon"] | ModelTypes["User"];
  ["ProcessGroup"]: {
    maxPerRegion: number;
    name: string;
    regions: Array<string>;
    vmSize: ModelTypes["VMSize"];
  };
  ["Product"]: {
    name: string;
    tiers: Array<ModelTypes["PriceTier"]>;
    type: string;
    unitLabel?: string | undefined;
  };
  ["PropertyInput"]: {
    /** The name of the property */
    name: string;
    /** The value of the property */
    value?: string | undefined;
  };
  ["Queries"]: {
    accessTokens: ModelTypes["AccessTokenConnection"];
    /** Find an add-on by ID or name */
    addOn?: ModelTypes["AddOn"] | undefined;
    /** List add-on service plans */
    addOnPlans: ModelTypes["AddOnPlanConnection"];
    addOnProvider: ModelTypes["AddOnProvider"];
    /** List add-ons associated with an organization */
    addOns: ModelTypes["AddOnConnection"];
    /** Find an app by name */
    app?: ModelTypes["App"] | undefined;
    /** List apps */
    apps: ModelTypes["AppConnection"];
    /** Verifies if an app can undergo a bluegreen deployment */
    canPerformBluegreenDeployment: boolean;
    /** Find a certificate by ID */
    certificate?: ModelTypes["AppCertificate"] | undefined;
    checkJobs: ModelTypes["CheckJobConnection"];
    checkLocations: Array<ModelTypes["CheckLocation"]>;
    currentUser: ModelTypes["User"];
    /** Find a domain by name */
    domain?: ModelTypes["Domain"] | undefined;
    githubIntegration: ModelTypes["GithubIntegration"];
    herokuIntegration: ModelTypes["HerokuIntegration"];
    /** Find an ip address by ID */
    ipAddress?: ModelTypes["IPAddress"] | undefined;
    /** Returns the latest available tag for a given image repository */
    latestImageDetails: ModelTypes["ImageVersion"];
    /** Returns the latest available tag for a given image repository */
    latestImageTag: string;
    /** Get a single machine */
    machine: ModelTypes["Machine"];
    /** List machines */
    machines: ModelTypes["MachineConnection"];
    nearestRegion: ModelTypes["Region"];
    /** Fetches an object given its ID. */
    node?: ModelTypes["Node"] | undefined;
    /** Fetches a list of objects given a list of IDs. */
    nodes: Array<ModelTypes["Node"] | undefined>;
    /** Find an organization by ID */
    organization?: ModelTypes["Organization"] | undefined;
    organizations: ModelTypes["OrganizationConnection"];
    personalOrganization: ModelTypes["Organization"];
    /** fly.io platform information */
    platform: ModelTypes["FlyPlatform"];
    /** List postgres attachments */
    postgresAttachments: ModelTypes["PostgresClusterAttachmentConnection"];
    /** Fly.io product and price information */
    products: Array<ModelTypes["Product"]>;
    /** Whether the authentication token only allows for user access */
    userOnlyToken: boolean;
    validateConfig: ModelTypes["AppConfig"];
    viewer: ModelTypes["Principal"];
    /** Find a persistent volume by ID */
    volume?: ModelTypes["Volume"] | undefined;
  };
  ["Region"]: {
    /** The IATA airport code for this region */
    code: string;
    gatewayAvailable: boolean;
    /** The latitude of this region */
    latitude?: number | undefined;
    /** The longitude of this region */
    longitude?: number | undefined;
    /** The name of this region */
    name: string;
    processGroup?: string | undefined;
    requiresPaidPlan: boolean;
  };
  ["RegionPlacement"]: {
    /** The desired number of allocations */
    count?: number | undefined;
    /** The region code */
    region: string;
  };
  /** Autogenerated input type of RegisterDomain */
  ["RegisterDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the domain */
    domainId: string;
    /** Enable whois privacy on the registration */
    whoisPrivacy?: boolean | undefined;
    /** Enable auto renew on the registration */
    autoRenew?: boolean | undefined;
  };
  /** Autogenerated return type of RegisterDomain. */
  ["RegisterDomainPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: ModelTypes["Domain"];
  };
  ["Release"]: {
    config?: ModelTypes["AppConfig"] | undefined;
    createdAt: ModelTypes["ISO8601DateTime"];
    deploymentStrategy: ModelTypes["DeploymentStrategy"];
    /** A description of the release */
    description: string;
    evaluationId?: string | undefined;
    /** Unique ID */
    id: string;
    /** Docker image */
    image?: ModelTypes["Image"] | undefined;
    /** Docker image URI */
    imageRef?: string | undefined;
    inProgress: boolean;
    /** The reason for the release */
    reason: string;
    /** Version release reverted to */
    revertedTo?: number | undefined;
    stable: boolean;
    /** The status of the release */
    status: string;
    updatedAt: ModelTypes["ISO8601DateTime"];
    /** The user who created the release */
    user?: ModelTypes["User"] | undefined;
    /** The version of the release */
    version: number;
  };
  ["ReleaseCommand"]: {
    app: ModelTypes["App"];
    command: string;
    evaluationId?: string | undefined;
    exitCode?: number | undefined;
    failed: boolean;
    id: string;
    inProgress: boolean;
    instanceId?: string | undefined;
    status: string;
    succeeded: boolean;
  };
  /** The connection type for Release. */
  ["ReleaseConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["ReleaseEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["Release"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["ReleaseEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["Release"] | undefined;
  };
  /** Autogenerated input type of ReleaseIPAddress */
  ["ReleaseIPAddressInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** The id of the ip address to release */
    ipAddressId?: string | undefined;
    ip?: string | undefined;
  };
  /** Autogenerated return type of ReleaseIPAddress. */
  ["ReleaseIPAddressPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  ["ReleaseUnprocessed"]: {
    configDefinition?: ModelTypes["JSON"] | undefined;
    createdAt: ModelTypes["ISO8601DateTime"];
    deploymentStrategy: ModelTypes["DeploymentStrategy"];
    /** A description of the release */
    description: string;
    evaluationId?: string | undefined;
    /** Unique ID */
    id: string;
    /** Docker image */
    image?: ModelTypes["Image"] | undefined;
    /** Docker image URI */
    imageRef?: string | undefined;
    inProgress: boolean;
    /** The reason for the release */
    reason: string;
    /** Version release reverted to */
    revertedTo?: number | undefined;
    stable: boolean;
    /** The status of the release */
    status: string;
    updatedAt: ModelTypes["ISO8601DateTime"];
    /** The user who created the release */
    user?: ModelTypes["User"] | undefined;
    /** The version of the release */
    version: number;
  };
  /** The connection type for ReleaseUnprocessed. */
  ["ReleaseUnprocessedConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["ReleaseUnprocessedEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["ReleaseUnprocessed"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["ReleaseUnprocessedEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["ReleaseUnprocessed"] | undefined;
  };
  ["RemoteDockerBuilderAppRole"]: {
    /** The name of this role */
    name: string;
  };
  /** Autogenerated input type of RemoveMachine */
  ["RemoveMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** machine id */
    id: string;
    /** force kill machine if it's running */
    kill?: boolean | undefined;
  };
  /** Autogenerated return type of RemoveMachine. */
  ["RemoveMachinePayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: ModelTypes["Machine"];
  };
  /** Autogenerated input type of RemoveWireGuardPeer */
  ["RemoveWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The name of the peer to remove */
    name: string;
    /** Add via NATS transaction (for testing only, nosy users) */
    nats?: boolean | undefined;
  };
  /** Autogenerated return type of RemoveWireGuardPeer. */
  ["RemoveWireGuardPeerPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The organization that owned the peer */
    organization: ModelTypes["Organization"];
  };
  /** Autogenerated input type of ResetAddOnPassword */
  ["ResetAddOnPasswordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the add-on whose password should be reset */
    name: string;
  };
  /** Autogenerated return type of ResetAddOnPassword. */
  ["ResetAddOnPasswordPayload"]: {
    addOn: ModelTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of RestartAllocation */
  ["RestartAllocationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** The ID of the app */
    allocId: string;
  };
  /** Autogenerated return type of RestartAllocation. */
  ["RestartAllocationPayload"]: {
    allocation: ModelTypes["Allocation"];
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of RestartApp */
  ["RestartAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of RestartApp. */
  ["RestartAppPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of RestoreVolumeSnapshot */
  ["RestoreVolumeSnapshotInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    volumeId: string;
    snapshotId: string;
  };
  /** Autogenerated return type of RestoreVolumeSnapshot. */
  ["RestoreVolumeSnapshotPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    snapshot: ModelTypes["VolumeSnapshot"];
    volume: ModelTypes["Volume"];
  };
  /** Autogenerated input type of ResumeApp */
  ["ResumeAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of ResumeApp. */
  ["ResumeAppPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of RevokePostgresClusterUserAccess */
  ["RevokePostgresClusterUserAccessInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the postgres cluster app */
    appName: string;
    /** The username to revoke */
    username: string;
    /** The database to revoke access to */
    databaseName: string;
  };
  /** Autogenerated return type of RevokePostgresClusterUserAccess. */
  ["RevokePostgresClusterUserAccessPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    database: ModelTypes["PostgresClusterDatabase"];
    postgresClusterRole: ModelTypes["PostgresClusterAppRole"];
    user: ModelTypes["PostgresClusterUser"];
  };
  ["RuntimeType"]: RuntimeType;
  /** Autogenerated input type of SaveDeploymentSource */
  ["SaveDeploymentSourceInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to update */
    appId: string;
    provider: string;
    repositoryId: string;
    ref?: string | undefined;
    baseDir?: string | undefined;
    skipBuild?: boolean | undefined;
  };
  /** Autogenerated return type of SaveDeploymentSource. */
  ["SaveDeploymentSourcePayload"]: {
    app?: ModelTypes["App"] | undefined;
    build?: ModelTypes["Build"] | undefined;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of ScaleApp */
  ["ScaleAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Regions to scale */
    regions: Array<ModelTypes["ScaleRegionInput"]>;
  };
  /** Autogenerated return type of ScaleApp. */
  ["ScaleAppPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    delta: Array<ModelTypes["ScaleRegionChange"]>;
    placement: Array<ModelTypes["RegionPlacement"]>;
  };
  ["ScaleRegionChange"]: {
    /** The original value */
    fromCount: number;
    /** The region code */
    region: string;
    /** The new value */
    toCount?: number | undefined;
  };
  /** Region placement configuration */
  ["ScaleRegionInput"]: {
    /** The region to configure */
    region: string;
    /** The value to change by */
    count: number;
  };
  ["Secret"]: {
    createdAt: ModelTypes["ISO8601DateTime"];
    /** The digest of the secret value */
    digest: string;
    id: string;
    /** The name of the secret */
    name: string;
    /** The user who initiated the deployment */
    user?: ModelTypes["User"] | undefined;
  };
  /** A secure configuration value */
  ["SecretInput"]: {
    /** The unqiue key for this secret */
    key: string;
    /** The value of this secret */
    value: string;
  };
  /** Global port routing */
  ["Service"]: {
    /** Health checks */
    checks: Array<ModelTypes["Check"]>;
    description: string;
    /** Hard concurrency limit */
    hardConcurrency: number;
    /** Application port to forward traffic to */
    internalPort: number;
    /** Ports to listen on */
    ports: Array<ModelTypes["ServicePort"]>;
    /** Protocol to listen on */
    protocol: ModelTypes["ServiceProtocolType"];
    /** Soft concurrency limit */
    softConcurrency: number;
  };
  ["ServiceHandlerType"]: ServiceHandlerType;
  /** Global port routing */
  ["ServiceInput"]: {
    /** Protocol to listen on */
    protocol: ModelTypes["ServiceProtocolType"];
    /** Ports to listen on */
    ports?: Array<ModelTypes["ServiceInputPort"]> | undefined;
    /** Application port to forward traffic to */
    internalPort: number;
    /** Health checks */
    checks?: Array<ModelTypes["CheckInput"]> | undefined;
    /** Soft concurrency limit */
    softConcurrency?: number | undefined;
    /** Hard concurrency limit */
    hardConcurrency?: number | undefined;
  };
  /** Service port */
  ["ServiceInputPort"]: {
    /** Port to listen on */
    port: number;
    /** Handlers to apply before forwarding service traffic */
    handlers?: Array<ModelTypes["ServiceHandlerType"]> | undefined;
    /** tls options */
    tlsOptions?: ModelTypes["ServicePortTlsOptionsInput"] | undefined;
  };
  /** Service port */
  ["ServicePort"]: {
    /** End port for range */
    endPort?: number | undefined;
    /** Handlers to apply before forwarding service traffic */
    handlers: Array<ModelTypes["ServiceHandlerType"]>;
    /** Port to listen on */
    port?: number | undefined;
    /** Start port for range */
    startPort?: number | undefined;
  };
  /** TLS handshakes options for a port */
  ["ServicePortTlsOptionsInput"]: {
    defaultSelfSigned?: boolean | undefined;
  };
  ["ServiceProtocolType"]: ServiceProtocolType;
  /** Autogenerated input type of SetAppsv2DefaultOn */
  ["SetAppsv2DefaultOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The organization slug */
    organizationSlug: string;
    /** Whether or not new apps in this org use Apps V2 by default */
    defaultOn: boolean;
  };
  /** Autogenerated return type of SetAppsv2DefaultOn. */
  ["SetAppsv2DefaultOnPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: ModelTypes["Organization"];
  };
  /** Autogenerated input type of SetPagerdutyHandler */
  ["SetPagerdutyHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Handler name */
    name: string;
    /** PagerDuty API token */
    pagerdutyToken: string;
    /** Map of alert severity levels to PagerDuty severity levels */
    pagerdutyStatusMap?: ModelTypes["JSON"] | undefined;
  };
  /** Autogenerated return type of SetPagerdutyHandler. */
  ["SetPagerdutyHandlerPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    handler: ModelTypes["HealthCheckHandler"];
  };
  /** Autogenerated input type of SetPlatformVersion */
  ["SetPlatformVersionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** nomad or machines */
    platformVersion: string;
    /** Unique lock ID */
    lockId?: string | undefined;
  };
  /** Autogenerated return type of SetPlatformVersion. */
  ["SetPlatformVersionPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of SetSecrets */
  ["SetSecretsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Secrets to set */
    secrets: Array<ModelTypes["SecretInput"]>;
    /** By default, we set only the secrets you specify. Set this to true to replace all secrets. */
    replaceAll?: boolean | undefined;
  };
  /** Autogenerated return type of SetSecrets. */
  ["SetSecretsPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release?: ModelTypes["Release"] | undefined;
  };
  /** Autogenerated input type of SetSlackHandler */
  ["SetSlackHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Handler name */
    name: string;
    /** Slack Webhook URL to use for health check notifications */
    slackWebhookUrl: string;
    /** Slack channel to send messages to, defaults to #general */
    slackChannel?: string | undefined;
    /** User name to display on Slack Messages (defaults to Fly) */
    slackUsername?: string | undefined;
    /** Icon to show with Slack messages */
    slackIconUrl?: string | undefined;
  };
  /** Autogenerated return type of SetSlackHandler. */
  ["SetSlackHandlerPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    handler: ModelTypes["HealthCheckHandler"];
  };
  /** Autogenerated input type of SetVMCount */
  ["SetVMCountInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Counts for VM groups */
    groupCounts: Array<ModelTypes["VMCountInput"]>;
    /** Unique lock ID */
    lockId?: string | undefined;
  };
  /** Autogenerated return type of SetVMCount. */
  ["SetVMCountPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release?: ModelTypes["Release"] | undefined;
    taskGroupCounts: Array<ModelTypes["TaskGroupCount"]>;
    warnings: Array<string>;
  };
  /** Autogenerated input type of SetVMSize */
  ["SetVMSizeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** The name of the vm size to set */
    sizeName: string;
    /** Optionally request more memory */
    memoryMb?: number | undefined;
    /** Process group to modify */
    group?: string | undefined;
  };
  /** Autogenerated return type of SetVMSize. */
  ["SetVMSizePayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Process Group scale change applied to (if any) */
    processGroup?: ModelTypes["ProcessGroup"] | undefined;
    /** Default app vm size */
    vmSize?: ModelTypes["VMSize"] | undefined;
  };
  /** Autogenerated input type of StartBuild */
  ["StartBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of StartBuild. */
  ["StartBuildPayload"]: {
    build: ModelTypes["Build"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of StartMachine */
  ["StartMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** machine id */
    id: string;
  };
  /** Autogenerated return type of StartMachine. */
  ["StartMachinePayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: ModelTypes["Machine"];
  };
  /** Autogenerated input type of StopAllocation */
  ["StopAllocationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** The ID of the app */
    allocId: string;
  };
  /** Autogenerated return type of StopAllocation. */
  ["StopAllocationPayload"]: {
    allocation: ModelTypes["Allocation"];
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of StopMachine */
  ["StopMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** machine id */
    id: string;
    /** signal to send the machine */
    signal?: string | undefined;
    /** how long to wait before force killing the machine */
    killTimeoutSecs?: number | undefined;
  };
  /** Autogenerated return type of StopMachine. */
  ["StopMachinePayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: ModelTypes["Machine"];
  };
  ["TaskGroupCount"]: {
    count: number;
    name: string;
  };
  ["TemplateDeployment"]: {
    apps: ModelTypes["AppConnection"];
    id: string;
    organization: ModelTypes["Organization"];
    status: string;
  };
  /** Configuration for third-party caveats to be added to user macaroons */
  ["ThirdPartyConfiguration"]: {
    /** Restrictions to be placed on third-party caveats */
    caveats?: ModelTypes["CaveatSet"] | undefined;
    createdAt: ModelTypes["ISO8601DateTime"];
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel: ModelTypes["ThirdPartyConfigurationLevel"];
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel: ModelTypes["ThirdPartyConfigurationLevel"];
    id: string;
    /** Location URL of the third-party service capable of discharging */
    location: string;
    /** Friendly name for this configuration */
    name: string;
    /** Organization that owns this third party configuration */
    organization: ModelTypes["Organization"];
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel: ModelTypes["ThirdPartyConfigurationLevel"];
    updatedAt: ModelTypes["ISO8601DateTime"];
  };
  /** The connection type for ThirdPartyConfiguration. */
  ["ThirdPartyConfigurationConnection"]: {
    /** A list of edges. */
    edges?:
      | Array<ModelTypes["ThirdPartyConfigurationEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?:
      | Array<ModelTypes["ThirdPartyConfiguration"] | undefined>
      | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["ThirdPartyConfigurationEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["ThirdPartyConfiguration"] | undefined;
  };
  ["ThirdPartyConfigurationLevel"]: ThirdPartyConfigurationLevel;
  /** Autogenerated input type of UnlockApp */
  ["UnlockAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Unique lock ID */
    lockId: string;
  };
  /** Autogenerated return type of UnlockApp. */
  ["UnlockAppPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of UnsetSecrets */
  ["UnsetSecretsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Secret keys to unset */
    keys: Array<string>;
  };
  /** Autogenerated return type of UnsetSecrets. */
  ["UnsetSecretsPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release?: ModelTypes["Release"] | undefined;
  };
  /** Autogenerated input type of UpdateAddOn */
  ["UpdateAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The add-on ID to update */
    addOnId?: string | undefined;
    /** The add-on name to update */
    name?: string | undefined;
    /** The add-on plan ID */
    planId?: string | undefined;
    /** Options specific to the add-on */
    options?: ModelTypes["JSON"] | undefined;
    /** Desired regions to place replicas in */
    readRegions?: Array<string> | undefined;
  };
  /** Autogenerated return type of UpdateAddOn. */
  ["UpdateAddOnPayload"]: {
    addOn: ModelTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of UpdateAutoscaleConfig */
  ["UpdateAutoscaleConfigInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    enabled?: boolean | undefined;
    minCount?: number | undefined;
    maxCount?: number | undefined;
    balanceRegions?: boolean | undefined;
    /** Region configs */
    regions?: Array<ModelTypes["AutoscaleRegionConfigInput"]> | undefined;
    resetRegions?: boolean | undefined;
  };
  /** Autogenerated return type of UpdateAutoscaleConfig. */
  ["UpdateAutoscaleConfigPayload"]: {
    app: ModelTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of UpdateDNSPortal */
  ["UpdateDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    dnsPortalId: string;
    /** The unique name of this portal. */
    name?: string | undefined;
    /** The title of this portal */
    title?: string | undefined;
    /** The return url for this portal */
    returnUrl?: string | undefined;
    /** The text to display for the return url link */
    returnUrlText?: string | undefined;
    /** The support url for this portal */
    supportUrl?: string | undefined;
    /** The text to display for the support url link */
    supportUrlText?: string | undefined;
    /** The primary branding color */
    primaryColor?: string | undefined;
    /** The secondary branding color */
    accentColor?: string | undefined;
  };
  /** Autogenerated return type of UpdateDNSPortal. */
  ["UpdateDNSPortalPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    dnsPortal: ModelTypes["DNSPortal"];
  };
  /** Autogenerated input type of UpdateDNSRecord */
  ["UpdateDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the DNS record */
    recordId: string;
    /** The dns record name */
    name?: string | undefined;
    /** The TTL in seconds */
    ttl?: number | undefined;
    /** The content of the record */
    rdata?: string | undefined;
  };
  /** Autogenerated return type of UpdateDNSRecord. */
  ["UpdateDNSRecordPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    record: ModelTypes["DNSRecord"];
  };
  /** Autogenerated input type of UpdateDNSRecords */
  ["UpdateDNSRecordsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the domain */
    domainId: string;
    changes: Array<ModelTypes["DNSRecordChangeInput"]>;
  };
  /** Autogenerated return type of UpdateDNSRecords. */
  ["UpdateDNSRecordsPayload"]: {
    changes: Array<ModelTypes["DNSRecordDiff"]>;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: ModelTypes["Domain"];
    warnings: Array<ModelTypes["DNSRecordWarning"]>;
  };
  /** Autogenerated input type of UpdateOrganizationMembership */
  ["UpdateOrganizationMembershipInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The node ID of the user */
    userId: string;
    /** The new role for the user */
    role: ModelTypes["OrganizationMemberRole"];
    /** The new alert settings for the user */
    alertsEnabled?: ModelTypes["OrganizationAlertsEnabled"] | undefined;
  };
  /** Autogenerated return type of UpdateOrganizationMembership. */
  ["UpdateOrganizationMembershipPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: ModelTypes["Organization"];
    user: ModelTypes["User"];
  };
  /** Autogenerated input type of UpdateRelease */
  ["UpdateReleaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the release */
    releaseId: string;
    /** The new status for the release */
    status: string;
  };
  /** Autogenerated return type of UpdateRelease. */
  ["UpdateReleasePayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release: ModelTypes["Release"];
  };
  /** Autogenerated input type of UpdateRemoteBuilder */
  ["UpdateRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Docker image reference */
    image: string;
  };
  /** Autogenerated return type of UpdateRemoteBuilder. */
  ["UpdateRemoteBuilderPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: ModelTypes["Organization"];
  };
  /** Autogenerated input type of UpdateThirdPartyConfiguration */
  ["UpdateThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the configuration */
    thirdPartyConfigurationId: string;
    /** Friendly name for this configuration */
    name?: string | undefined;
    /** Location URL of the third-party service capable of discharging */
    location?: string | undefined;
    /** Restrictions to be placed on third-party caveats */
    caveats?: ModelTypes["CaveatSet"] | undefined;
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel?: ModelTypes["ThirdPartyConfigurationLevel"] | undefined;
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel?: ModelTypes["ThirdPartyConfigurationLevel"] | undefined;
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel?: ModelTypes["ThirdPartyConfigurationLevel"] | undefined;
  };
  /** Autogenerated return type of UpdateThirdPartyConfiguration. */
  ["UpdateThirdPartyConfigurationPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    thirdPartyConfiguration: ModelTypes["ThirdPartyConfiguration"];
  };
  ["User"]: {
    /** Check if the organization has agreed to the extension provider terms of service */
    agreedToProviderTos: boolean;
    /** URL for avatar or placeholder */
    avatarUrl: string;
    createdAt: ModelTypes["ISO8601DateTime"];
    /** Email address for user (private) */
    email: string;
    /** Whether to create new organizations under Hobby plan */
    enablePaidHobby: boolean;
    featureFlags: Array<string>;
    hasNodeproxyApps: boolean;
    id: string;
    internalNumericId: number;
    lastRegion?: string | undefined;
    /** Display / full name for user (private) */
    name?: string | undefined;
    organizations: ModelTypes["OrganizationConnection"];
    personalOrganization: ModelTypes["Organization"];
    trust: ModelTypes["OrganizationTrust"];
    twoFactorProtection: boolean;
    /** Public username for user */
    username?: string | undefined;
  };
  ["UserCoupon"]: {
    createdAt: ModelTypes["ISO8601DateTime"];
    id: string;
    /** Organization that owns this app */
    organization: ModelTypes["Organization"];
    updatedAt: ModelTypes["ISO8601DateTime"];
  };
  ["VM"]: {
    attachedVolumes: ModelTypes["VolumeConnection"];
    canary: boolean;
    checks: Array<ModelTypes["CheckState"]>;
    createdAt: ModelTypes["ISO8601DateTime"];
    criticalCheckCount: number;
    /** Desired status */
    desiredStatus: string;
    events: Array<ModelTypes["AllocationEvent"]>;
    failed: boolean;
    healthy: boolean;
    /** Unique ID for this instance */
    id: string;
    /** Short unique ID for this instance */
    idShort: string;
    /** Indicates if this instance is from the latest job version */
    latestVersion: boolean;
    passingCheckCount: number;
    /** Private IPv6 address for this instance */
    privateIP?: string | undefined;
    recentLogs: Array<ModelTypes["LogEntry"]>;
    /** Region this allocation is running in */
    region: string;
    restarts: number;
    /** Current status */
    status: string;
    taskName: string;
    totalCheckCount: number;
    transitioning: boolean;
    updatedAt: ModelTypes["ISO8601DateTime"];
    /** The configuration version of this instance */
    version: number;
    warningCheckCount: number;
  };
  /** The connection type for VM. */
  ["VMConnection"]: {
    activeCount: number;
    completeCount: number;
    /** A list of edges. */
    edges?: Array<ModelTypes["VMEdge"] | undefined> | undefined;
    failedCount: number;
    inactiveCount: number;
    lostCount: number;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["VM"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    pendingCount: number;
    runningCount: number;
    totalCount: number;
  };
  ["VMCountInput"]: {
    /** VM group name */
    group?: string | undefined;
    /** The desired count */
    count?: number | undefined;
    /** Max number of VMs to allow per region */
    maxPerRegion?: number | undefined;
  };
  /** An edge in a connection. */
  ["VMEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["VM"] | undefined;
  };
  ["VMSize"]: {
    cpuCores: number;
    maxMemoryMb: number;
    memoryGb: number;
    memoryIncrementsMb: Array<number>;
    memoryMb: number;
    name: string;
    priceMonth: number;
    priceSecond: number;
  };
  /** Autogenerated input type of ValidateWireGuardPeers */
  ["ValidateWireGuardPeersInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    peerIps: Array<string>;
  };
  /** Autogenerated return type of ValidateWireGuardPeers. */
  ["ValidateWireGuardPeersPayload"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    invalidPeerIps: Array<string>;
    validPeerIps: Array<string>;
  };
  ["Volume"]: {
    app: ModelTypes["App"];
    attachedAllocation?: ModelTypes["Allocation"] | undefined;
    attachedAllocationId?: string | undefined;
    attachedMachine?: ModelTypes["Machine"] | undefined;
    createdAt: ModelTypes["ISO8601DateTime"];
    encrypted: boolean;
    host: ModelTypes["Host"];
    id: string;
    internalId: string;
    name: string;
    region: string;
    sizeGb: number;
    snapshots: ModelTypes["VolumeSnapshotConnection"];
    state: string;
    status: string;
    usedBytes: ModelTypes["BigInt"];
  };
  /** The connection type for Volume. */
  ["VolumeConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["VolumeEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["Volume"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["VolumeEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["Volume"] | undefined;
  };
  ["VolumeSnapshot"]: {
    createdAt: ModelTypes["ISO8601DateTime"];
    digest: string;
    id: string;
    size: ModelTypes["BigInt"];
    volume: ModelTypes["Volume"];
  };
  /** The connection type for VolumeSnapshot. */
  ["VolumeSnapshotConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["VolumeSnapshotEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["VolumeSnapshot"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["VolumeSnapshotEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["VolumeSnapshot"] | undefined;
  };
  ["WireGuardPeer"]: {
    id: string;
    name: string;
    network?: string | undefined;
    peerip: string;
    pubkey: string;
    region: string;
  };
  /** The connection type for WireGuardPeer. */
  ["WireGuardPeerConnection"]: {
    /** A list of edges. */
    edges?: Array<ModelTypes["WireGuardPeerEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<ModelTypes["WireGuardPeer"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: ModelTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["WireGuardPeerEdge"]: {
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: ModelTypes["WireGuardPeer"] | undefined;
  };
};

export type GraphQLTypes = {
  ["AccessToken"]: {
    __typename: "AccessToken";
    createdAt: GraphQLTypes["ISO8601DateTime"];
    id: string;
    name: string;
    type: GraphQLTypes["AccessTokenType"];
  };
  /** The connection type for AccessToken. */
  ["AccessTokenConnection"]: {
    __typename: "AccessTokenConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["AccessTokenEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["AccessToken"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AccessTokenEdge"]: {
    __typename: "AccessTokenEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["AccessToken"] | undefined;
  };
  ["AccessTokenType"]: AccessTokenType;
  /** Autogenerated return type of AddCertificate. */
  ["AddCertificatePayload"]: {
    __typename: "AddCertificatePayload";
    app?: GraphQLTypes["App"] | undefined;
    certificate?: GraphQLTypes["AppCertificate"] | undefined;
    check?: GraphQLTypes["HostnameCheck"] | undefined;
    errors?: Array<string> | undefined;
  };
  ["AddOn"]: {
    __typename: "AddOn";
    /** The add-on plan */
    addOnPlan?: GraphQLTypes["AddOnPlan"] | undefined;
    /** The display name for an add-on plan */
    addOnPlanName?: string | undefined;
    /** The add-on provider */
    addOnProvider?: GraphQLTypes["AddOnProvider"] | undefined;
    /** An app associated with this add-on */
    app?: GraphQLTypes["App"] | undefined;
    /** Apps associated with this add-on */
    apps?: GraphQLTypes["AppConnection"] | undefined;
    /** Environment variables for the add-on */
    environment?: GraphQLTypes["JSON"] | undefined;
    /** Optional error message when `status` is `error` */
    errorMessage?: string | undefined;
    /** DNS hostname for the add-on */
    hostname?: string | undefined;
    id: string;
    /** Add-on metadata */
    metadata?: GraphQLTypes["JSON"] | undefined;
    /** The service name according to the provider */
    name?: string | undefined;
    /** Add-on options */
    options?: GraphQLTypes["JSON"] | undefined;
    /** Organization that owns this service */
    organization: GraphQLTypes["Organization"];
    /** Password for the add-on */
    password?: string | undefined;
    /** Region where the primary instance is deployed */
    primaryRegion?: string | undefined;
    /** Private flycast IP address of the add-on */
    privateIp?: string | undefined;
    /** Public URL for this service */
    publicUrl?: string | undefined;
    /** Regions where replica instances are deployed */
    readRegions?: Array<string> | undefined;
    /** Single sign-on link to the add-on dashboard */
    ssoLink?: string | undefined;
    /** Redis database statistics */
    stats?: GraphQLTypes["JSON"] | undefined;
    /** Status of the add-on */
    status?: string | undefined;
  };
  /** The connection type for AddOn. */
  ["AddOnConnection"]: {
    __typename: "AddOnConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["AddOnEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["AddOn"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AddOnEdge"]: {
    __typename: "AddOnEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["AddOn"] | undefined;
  };
  ["AddOnPlan"]: {
    __typename: "AddOnPlan";
    displayName?: string | undefined;
    id: string;
    maxCommandsPerSec?: number | undefined;
    maxConcurrentConnections?: number | undefined;
    maxDailyBandwidth?: string | undefined;
    maxDailyCommands?: number | undefined;
    maxDataSize?: string | undefined;
    maxRequestSize?: string | undefined;
    name?: string | undefined;
    pricePerMonth?: number | undefined;
  };
  /** The connection type for AddOnPlan. */
  ["AddOnPlanConnection"]: {
    __typename: "AddOnPlanConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["AddOnPlanEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["AddOnPlan"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AddOnPlanEdge"]: {
    __typename: "AddOnPlanEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["AddOnPlan"] | undefined;
  };
  ["AddOnProvider"]: {
    __typename: "AddOnProvider";
    asyncProvisioning: boolean;
    autoProvision: boolean;
    beta: boolean;
    detectPlatform: boolean;
    displayName?: string | undefined;
    excludedRegions?: Array<GraphQLTypes["Region"]> | undefined;
    id: string;
    internal: boolean;
    name?: string | undefined;
    nameSuffix?: string | undefined;
    provisioningInstructions?: string | undefined;
    regions?: Array<GraphQLTypes["Region"]> | undefined;
    resourceName: string;
    selectName: boolean;
    selectRegion: boolean;
    selectReplicaRegions: boolean;
    tosAgreement?: string | undefined;
    tosUrl?: string | undefined;
  };
  ["AddOnType"]: AddOnType;
  /** Autogenerated input type of AddWireGuardPeer */
  ["AddWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The region in which to deploy the peer */
    region?: string | undefined;
    /** The name with which to refer to the peer */
    name: string;
    /** The 25519 public key for the peer */
    pubkey: string;
    /** Network ID to attach wireguard peer to */
    network?: string | undefined;
    /** Add via NATS transaction (deprecated - nats is always used) */
    nats?: boolean | undefined;
  };
  /** Autogenerated return type of AddWireGuardPeer. */
  ["AddWireGuardPeerPayload"]: {
    __typename: "AddWireGuardPeerPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    endpointip: string;
    network?: string | undefined;
    peerip: string;
    pubkey: string;
  };
  /** Autogenerated input type of AllocateIPAddress */
  ["AllocateIPAddressInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to allocate the ip address for */
    appId: string;
    /** The type of IP address to allocate (v4, v6, or private_v6) */
    type: GraphQLTypes["IPAddressType"];
    /** The organization whose network should be used for private IP allocation */
    organizationId?: string | undefined;
    /** Desired IP region (defaults to global) */
    region?: string | undefined;
    /** The target network name in the specified organization */
    network?: string | undefined;
    /** The name of the associated service */
    serviceName?: string | undefined;
  };
  /** Autogenerated return type of AllocateIPAddress. */
  ["AllocateIPAddressPayload"]: {
    __typename: "AllocateIPAddressPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    ipAddress?: GraphQLTypes["IPAddress"] | undefined;
  };
  ["Allocation"]: {
    __typename: "Allocation";
    attachedVolumes: GraphQLTypes["VolumeConnection"];
    canary: boolean;
    checks: Array<GraphQLTypes["CheckState"]>;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    criticalCheckCount: number;
    /** Desired status */
    desiredStatus: string;
    events: Array<GraphQLTypes["AllocationEvent"]>;
    failed: boolean;
    healthy: boolean;
    /** Unique ID for this instance */
    id: string;
    /** Short unique ID for this instance */
    idShort: string;
    /** Indicates if this instance is from the latest job version */
    latestVersion: boolean;
    passingCheckCount: number;
    /** Private IPv6 address for this instance */
    privateIP?: string | undefined;
    recentLogs: Array<GraphQLTypes["LogEntry"]>;
    /** Region this allocation is running in */
    region: string;
    restarts: number;
    /** Current status */
    status: string;
    taskName: string;
    totalCheckCount: number;
    transitioning: boolean;
    updatedAt: GraphQLTypes["ISO8601DateTime"];
    /** The configuration version of this instance */
    version: number;
    warningCheckCount: number;
  };
  ["AllocationEvent"]: {
    __typename: "AllocationEvent";
    message: string;
    timestamp: GraphQLTypes["ISO8601DateTime"];
    type: string;
  };
  ["App"]: {
    __typename: "App";
    addOns: GraphQLTypes["AddOnConnection"];
    allocation?: GraphQLTypes["Allocation"] | undefined;
    allocations: Array<GraphQLTypes["Allocation"]>;
    appUrl?: string | undefined;
    autoscaling?: GraphQLTypes["AutoscalingConfig"] | undefined;
    backupRegions: Array<GraphQLTypes["Region"]>;
    /** [DEPRECATED] Builds of this application */
    builds: GraphQLTypes["BuildConnection"];
    /** Find a certificate by hostname */
    certificate?: GraphQLTypes["AppCertificate"] | undefined;
    /** Certificates for this app */
    certificates: GraphQLTypes["AppCertificateConnection"];
    /** Changes to this application */
    changes: GraphQLTypes["AppChangeConnection"];
    config: GraphQLTypes["AppConfig"];
    createdAt: GraphQLTypes["ISO8601DateTime"];
    currentLock?: GraphQLTypes["AppLock"] | undefined;
    currentPlacement: Array<GraphQLTypes["RegionPlacement"]>;
    /** The latest release of this application */
    currentRelease?: GraphQLTypes["Release"] | undefined;
    /** The latest release of this application, without any config processing */
    currentReleaseUnprocessed?: GraphQLTypes["ReleaseUnprocessed"] | undefined;
    deployed: boolean;
    /** Continuous deployment configuration */
    deploymentSource?: GraphQLTypes["DeploymentSource"] | undefined;
    /** Find a deployment by id, defaults to latest */
    deploymentStatus?: GraphQLTypes["DeploymentStatus"] | undefined;
    /** Check if this app has a configured deployment source */
    hasDeploymentSource: boolean;
    healthChecks: GraphQLTypes["CheckStateConnection"];
    /** Autogenerated hostname for this application */
    hostname?: string | undefined;
    /** Unique application ID */
    id: string;
    /** Resolve an image from a reference */
    image?: GraphQLTypes["Image"] | undefined;
    /** Image details */
    imageDetails?: GraphQLTypes["ImageVersion"] | undefined;
    imageUpgradeAvailable?: boolean | undefined;
    imageVersionTrackingEnabled: boolean;
    /** Authentication key to use with Instrumentation endpoints */
    instrumentsKey?: string | undefined;
    internalId: string;
    internalNumericId: number;
    /** Find an ip address by address string */
    ipAddress?: GraphQLTypes["IPAddress"] | undefined;
    ipAddresses: GraphQLTypes["IPAddressConnection"];
    /** This object's unique key */
    key: string;
    /** Latest image details */
    latestImageDetails?: GraphQLTypes["ImageVersion"] | undefined;
    limitedAccessTokens: GraphQLTypes["LimitedAccessTokenConnection"];
    machine?: GraphQLTypes["Machine"] | undefined;
    machines: GraphQLTypes["MachineConnection"];
    /** The unique application name */
    name: string;
    network?: string | undefined;
    networkId?: number | undefined;
    /** Organization that owns this app */
    organization: GraphQLTypes["Organization"];
    parseConfig: GraphQLTypes["AppConfig"];
    /** Fly platform version */
    platformVersion?: GraphQLTypes["PlatformVersionEnum"] | undefined;
    processGroups: Array<GraphQLTypes["ProcessGroup"]>;
    regions: Array<GraphQLTypes["Region"]>;
    /** Find a specific release */
    release?: GraphQLTypes["Release"] | undefined;
    /** Individual releases for this application */
    releases: GraphQLTypes["ReleaseConnection"];
    /** Individual releases for this application, without any config processing */
    releasesUnprocessed: GraphQLTypes["ReleaseUnprocessedConnection"];
    role?: GraphQLTypes["AppRole"] | undefined;
    /** Application runtime */
    runtime: GraphQLTypes["RuntimeType"];
    /** Secrets set on the application */
    secrets: Array<GraphQLTypes["Secret"]>;
    services: Array<GraphQLTypes["Service"]>;
    sharedIpAddress?: string | undefined;
    state: GraphQLTypes["AppState"];
    /** Application status */
    status: string;
    taskGroupCounts: Array<GraphQLTypes["TaskGroupCount"]>;
    usage: Array<GraphQLTypes["AppUsage"]>;
    version: number;
    vmSize: GraphQLTypes["VMSize"];
    vms: GraphQLTypes["VMConnection"];
    volume?: GraphQLTypes["Volume"] | undefined;
    /** Volumes associated with app */
    volumes: GraphQLTypes["VolumeConnection"];
  };
  ["AppCertificate"]: {
    __typename: "AppCertificate";
    acmeAlpnConfigured: boolean;
    acmeDnsConfigured: boolean;
    certificateAuthority?: string | undefined;
    certificateRequestedAt?: GraphQLTypes["ISO8601DateTime"] | undefined;
    check: boolean;
    clientStatus: string;
    configured: boolean;
    createdAt?: GraphQLTypes["ISO8601DateTime"] | undefined;
    dnsProvider?: string | undefined;
    dnsValidationHostname: string;
    dnsValidationInstructions: string;
    dnsValidationTarget: string;
    domain?: string | undefined;
    hostname: string;
    id: string;
    isAcmeAlpnConfigured: boolean;
    isAcmeDnsConfigured: boolean;
    isApex: boolean;
    isConfigured: boolean;
    isWildcard: boolean;
    issued: GraphQLTypes["CertificateConnection"];
    source?: string | undefined;
    validationErrors: Array<GraphQLTypes["AppCertificateValidationError"]>;
  };
  /** The connection type for AppCertificate. */
  ["AppCertificateConnection"]: {
    __typename: "AppCertificateConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["AppCertificateEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["AppCertificate"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AppCertificateEdge"]: {
    __typename: "AppCertificateEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["AppCertificate"] | undefined;
  };
  ["AppCertificateValidationError"]: {
    __typename: "AppCertificateValidationError";
    message: string;
    timestamp: GraphQLTypes["ISO8601DateTime"];
  };
  ["AppChange"]: {
    __typename: "AppChange";
    /** Object that triggered the change */
    actor?: GraphQLTypes["AppChangeActor"] | undefined;
    actorType: string;
    app: GraphQLTypes["App"];
    createdAt: GraphQLTypes["ISO8601DateTime"];
    description: string;
    id: string;
    status?: string | undefined;
    updatedAt: GraphQLTypes["ISO8601DateTime"];
    user?: GraphQLTypes["User"] | undefined;
  };
  /** Objects that change apps */
  ["AppChangeActor"]: {
    __typename: "Build" | "Release" | "Secret";
    ["...on Build"]: "__union" & GraphQLTypes["Build"];
    ["...on Release"]: "__union" & GraphQLTypes["Release"];
    ["...on Secret"]: "__union" & GraphQLTypes["Secret"];
  };
  /** The connection type for AppChange. */
  ["AppChangeConnection"]: {
    __typename: "AppChangeConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["AppChangeEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["AppChange"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AppChangeEdge"]: {
    __typename: "AppChangeEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["AppChange"] | undefined;
  };
  ["AppConfig"]: {
    __typename: "AppConfig";
    definition: GraphQLTypes["JSON"];
    errors: Array<string>;
    services: Array<GraphQLTypes["Service"]>;
    valid: boolean;
  };
  /** The connection type for App. */
  ["AppConnection"]: {
    __typename: "AppConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["AppEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["App"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["AppEdge"]: {
    __typename: "AppEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["App"] | undefined;
  };
  /** app lock */
  ["AppLock"]: {
    __typename: "AppLock";
    /** Time when the lock expires */
    expiration: GraphQLTypes["ISO8601DateTime"];
    /** Lock ID */
    lockId: string;
  };
  ["AppRole"]: {
    __typename:
      | "EmptyAppRole"
      | "FlyctlMachineHostAppRole"
      | "PostgresClusterAppRole"
      | "RemoteDockerBuilderAppRole";
    /** The name of this role */
    name: string;
    ["...on EmptyAppRole"]: "__union" & GraphQLTypes["EmptyAppRole"];
    ["...on FlyctlMachineHostAppRole"]:
      & "__union"
      & GraphQLTypes["FlyctlMachineHostAppRole"];
    ["...on PostgresClusterAppRole"]:
      & "__union"
      & GraphQLTypes["PostgresClusterAppRole"];
    ["...on RemoteDockerBuilderAppRole"]:
      & "__union"
      & GraphQLTypes["RemoteDockerBuilderAppRole"];
  };
  ["AppState"]: AppState;
  /** Application usage data */
  ["AppUsage"]: {
    __typename: "AppUsage";
    /** The timespan interval for this usage sample */
    interval: string;
    /** Total requests for this time period */
    requestsCount: number;
    /** Total app execution time (in seconds) for this time period */
    totalAppExecS: number;
    /** Total GB transferred out in this time period */
    totalDataOutGB: number;
    /** The start of the timespan for this usage sample */
    ts: GraphQLTypes["ISO8601DateTime"];
  };
  /** Autogenerated input type of AttachPostgresCluster */
  ["AttachPostgresClusterInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The postgres cluster application id */
    postgresClusterAppId: string;
    /** The application to attach postgres to */
    appId: string;
    /** The database to attach. Defaults to a new database with the same name as the app. */
    databaseName?: string | undefined;
    /** The database user to create. Defaults to using the database name. */
    databaseUser?: string | undefined;
    /** The environment variable name to set the connection string to. Defaults to DATABASE_URL */
    variableName?: string | undefined;
    /** Flag used to indicate that flyctl will exec calls */
    manualEntry?: boolean | undefined;
  };
  /** Autogenerated return type of AttachPostgresCluster. */
  ["AttachPostgresClusterPayload"]: {
    __typename: "AttachPostgresClusterPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    connectionString: string;
    environmentVariableName: string;
    postgresClusterApp: GraphQLTypes["App"];
  };
  ["AutoscaleRegionConfig"]: {
    __typename: "AutoscaleRegionConfig";
    /** The region code */
    code: string;
    /** The minimum number of VMs to run in this region */
    minCount?: number | undefined;
    /** The relative weight for this region */
    weight?: number | undefined;
  };
  /** Region autoscaling configuration */
  ["AutoscaleRegionConfigInput"]: {
    /** The region code to configure */
    code: string;
    /** The weight */
    weight?: number | undefined;
    /** Minimum number of VMs to run in this region */
    minCount?: number | undefined;
    /** Reset the configuration for this region */
    reset?: boolean | undefined;
  };
  ["AutoscaleStrategy"]: AutoscaleStrategy;
  ["AutoscalingConfig"]: {
    __typename: "AutoscalingConfig";
    backupRegions: Array<string>;
    balanceRegions: boolean;
    enabled: boolean;
    maxCount: number;
    minCount: number;
    preferredRegion?: string | undefined;
    regions: Array<GraphQLTypes["AutoscaleRegionConfig"]>;
    strategy: GraphQLTypes["AutoscaleStrategy"];
  };
  /** Represents non-fractional signed whole numeric values. Since the value may exceed the size of a 32-bit integer, it's encoded as a string. */
  ["BigInt"]: "scalar" & { name: "BigInt" };
  ["BillingStatus"]: BillingStatus;
  ["Build"]: {
    __typename: "Build";
    app: GraphQLTypes["App"];
    commitId?: string | undefined;
    commitUrl?: string | undefined;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    /** The user who initiated the build */
    createdBy?: GraphQLTypes["User"] | undefined;
    /** Indicates if this build is complete and failed */
    failed: boolean;
    id: string;
    image?: string | undefined;
    /** Indicates if this build is currently in progress */
    inProgress: boolean;
    /** Log output */
    logs: string;
    number: number;
    /** Status of the build */
    status: string;
    /** Indicates if this build is complete and succeeded */
    succeeded: boolean;
    updatedAt: GraphQLTypes["ISO8601DateTime"];
  };
  /** The connection type for Build. */
  ["BuildConnection"]: {
    __typename: "BuildConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["BuildEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["Build"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["BuildEdge"]: {
    __typename: "BuildEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["Build"] | undefined;
  };
  ["BuildFinalImageInput"]: {
    /** Sha256 id of docker image */
    id: string;
    /** Tag used for docker image */
    tag: string;
    /** Size in bytes of the docker image */
    sizeBytes: GraphQLTypes["BigInt"];
  };
  ["BuildImageOptsInput"]: {
    /** Path to dockerfile, if one exists */
    dockerfilePath?: string | undefined;
    /** Unused in cli? */
    imageRef?: string | undefined;
    /** Set of build time variables passed to cli */
    buildArgs?: GraphQLTypes["JSON"] | undefined;
    /** Unused in cli? */
    extraBuildArgs?: GraphQLTypes["JSON"] | undefined;
    /** Image label to use when tagging and pushing to the fly registry */
    imageLabel?: string | undefined;
    /** Whether publishing to the registry was requested */
    publish?: boolean | undefined;
    /** Docker tag used to publish image to registry */
    tag?: string | undefined;
    /** Set the target build stage to build if the Dockerfile has more than one stage */
    target?: string | undefined;
    /** Do not use the build cache when building the image */
    noCache?: boolean | undefined;
    /** Builtin builder to use */
    builtIn?: string | undefined;
    /** Builtin builder settings */
    builtInSettings?: GraphQLTypes["JSON"] | undefined;
    /** Fly.toml build.builder setting */
    builder?: string | undefined;
    /** Fly.toml build.buildpacks setting */
    buildPacks?: Array<string> | undefined;
  };
  ["BuildStrategyAttemptInput"]: {
    /** Build strategy attempted */
    strategy: string;
    /** Result attempting this strategy */
    result: string;
    /** Optional error message from strategy */
    error?: string | undefined;
    /** Optional note about this strategy or its result */
    note?: string | undefined;
  };
  ["BuildTimingsInput"]: {
    /** Time to build and push the image, measured by flyctl */
    buildAndPushMs?: GraphQLTypes["BigInt"] | undefined;
    /** Time to initialize client used to connect to either remote or local builder */
    builderInitMs?: GraphQLTypes["BigInt"] | undefined;
    /** Time to build the image including create context, measured by flyctl */
    buildMs?: GraphQLTypes["BigInt"] | undefined;
    /** Time to create the build context tar file, measured by flyctl */
    contextBuildMs?: GraphQLTypes["BigInt"] | undefined;
    /** Time for builder to build image after receiving context, measured by flyctl */
    imageBuildMs?: GraphQLTypes["BigInt"] | undefined;
    /** Time to push completed image to registry, measured by flyctl */
    pushMs?: GraphQLTypes["BigInt"] | undefined;
  };
  ["BuilderMetaInput"]: {
    /** Local or remote builder type */
    builderType: string;
    /** Docker version reported by builder */
    dockerVersion?: string | undefined;
    /** Whther or not buildkit is enabled on builder */
    buildkitEnabled?: boolean | undefined;
    /** Platform reported by the builder */
    platform?: string | undefined;
    /** Remote builder app used */
    remoteAppName?: string | undefined;
    /** Remote builder machine used */
    remoteMachineId?: string | undefined;
  };
  /** Autogenerated return type of CancelBuild. */
  ["CancelBuildPayload"]: {
    __typename: "CancelBuildPayload";
    build: GraphQLTypes["Build"];
  };
  /** A set of base64 messagepack encoded macaroon caveats (See https://github.com/superfly/macaroon) */
  ["CaveatSet"]: "scalar" & { name: "CaveatSet" };
  ["Certificate"]: {
    __typename: "Certificate";
    expiresAt: GraphQLTypes["ISO8601DateTime"];
    hostname: string;
    id: string;
    type: string;
  };
  /** The connection type for Certificate. */
  ["CertificateConnection"]: {
    __typename: "CertificateConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["CertificateEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["Certificate"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CertificateEdge"]: {
    __typename: "CertificateEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["Certificate"] | undefined;
  };
  /** health check */
  ["Check"]: {
    __typename: "Check";
    httpHeaders?: Array<GraphQLTypes["CheckHeader"]> | undefined;
    httpMethod?: string | undefined;
    httpPath?: string | undefined;
    httpProtocol?: GraphQLTypes["HTTPProtocol"] | undefined;
    httpTlsSkipVerify?: boolean | undefined;
    /** Check interval in milliseconds */
    interval: number;
    name?: string | undefined;
    scriptArgs?: Array<string> | undefined;
    scriptCommand?: string | undefined;
    /** Check timeout in milliseconds */
    timeout: number;
    type: GraphQLTypes["CheckType"];
  };
  /** Autogenerated input type of CheckCertificate */
  ["CheckCertificateInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Application to ID */
    appId: string;
    /** Certificate hostname to check */
    hostname: string;
  };
  /** Autogenerated return type of CheckCertificate. */
  ["CheckCertificatePayload"]: {
    __typename: "CheckCertificatePayload";
    app?: GraphQLTypes["App"] | undefined;
    certificate?: GraphQLTypes["AppCertificate"] | undefined;
    check?: GraphQLTypes["HostnameCheck"] | undefined;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CheckDomain */
  ["CheckDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Domain name to check */
    domainName: string;
  };
  /** Autogenerated return type of CheckDomain. */
  ["CheckDomainPayload"]: {
    __typename: "CheckDomainPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    dnsAvailable: boolean;
    domainName: string;
    registrationAvailable: boolean;
    registrationPeriod?: number | undefined;
    registrationPrice?: number | undefined;
    registrationSupported: boolean;
    tld: string;
    transferAvailable: boolean;
  };
  /** check job http response */
  ["CheckHTTPResponse"]: {
    __typename: "CheckHTTPResponse";
    closeTs: string;
    connectedTs: string;
    dnsTs: string;
    firstTs: string;
    flyioDebug?: GraphQLTypes["JSON"] | undefined;
    headers: GraphQLTypes["JSON"];
    id: string;
    lastTs: string;
    location: GraphQLTypes["CheckLocation"];
    rawHeaders: string;
    rawOutput: Array<string>;
    resolvedIp: string;
    sentTs: string;
    startTs: string;
    statusCode: number;
    tlsTs?: string | undefined;
  };
  /** The connection type for CheckHTTPResponse. */
  ["CheckHTTPResponseConnection"]: {
    __typename: "CheckHTTPResponseConnection";
    /** A list of edges. */
    edges?:
      | Array<GraphQLTypes["CheckHTTPResponseEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["CheckHTTPResponse"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CheckHTTPResponseEdge"]: {
    __typename: "CheckHTTPResponseEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["CheckHTTPResponse"] | undefined;
  };
  /** All available http checks verbs */
  ["CheckHTTPVerb"]: CheckHTTPVerb;
  /** HTTP header for a health check */
  ["CheckHeader"]: {
    __typename: "CheckHeader";
    name: string;
    value: string;
  };
  ["CheckHeaderInput"]: {
    name: string;
    value: string;
  };
  ["CheckInput"]: {
    type: GraphQLTypes["CheckType"];
    name?: string | undefined;
    /** Check interval in milliseconds */
    interval?: number | undefined;
    /** Check timeout in milliseconds */
    timeout?: number | undefined;
    httpMethod?: GraphQLTypes["HTTPMethod"] | undefined;
    httpPath?: string | undefined;
    httpProtocol?: GraphQLTypes["HTTPProtocol"] | undefined;
    httpTlsSkipVerify?: boolean | undefined;
    httpHeaders?: Array<GraphQLTypes["CheckHeaderInput"]> | undefined;
    scriptCommand?: string | undefined;
    scriptArgs?: Array<string> | undefined;
  };
  /** check job */
  ["CheckJob"]: {
    __typename: "CheckJob";
    httpOptions?: GraphQLTypes["CheckJobHTTPOptions"] | undefined;
    id: string;
    locations: GraphQLTypes["CheckLocationConnection"];
    nextRunAt?: GraphQLTypes["ISO8601DateTime"] | undefined;
    runs: GraphQLTypes["CheckJobRunConnection"];
    schedule?: string | undefined;
    url: string;
  };
  /** The connection type for CheckJob. */
  ["CheckJobConnection"]: {
    __typename: "CheckJobConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["CheckJobEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["CheckJob"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CheckJobEdge"]: {
    __typename: "CheckJobEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["CheckJob"] | undefined;
  };
  /** health check state */
  ["CheckJobHTTPOptions"]: {
    __typename: "CheckJobHTTPOptions";
    headers: Array<string>;
    verb: GraphQLTypes["CheckHTTPVerb"];
  };
  /** health check state */
  ["CheckJobHTTPOptionsInput"]: {
    verb: GraphQLTypes["CheckHTTPVerb"];
    headers?: Array<string> | undefined;
  };
  /** check job run */
  ["CheckJobRun"]: {
    __typename: "CheckJobRun";
    completedAt?: GraphQLTypes["ISO8601DateTime"] | undefined;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    httpOptions: GraphQLTypes["CheckJobHTTPOptions"];
    httpResponses: GraphQLTypes["CheckHTTPResponseConnection"];
    id: string;
    locations: GraphQLTypes["CheckLocationConnection"];
    state: string;
    tests: Array<string>;
    url: string;
  };
  /** The connection type for CheckJobRun. */
  ["CheckJobRunConnection"]: {
    __typename: "CheckJobRunConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["CheckJobRunEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["CheckJobRun"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CheckJobRunEdge"]: {
    __typename: "CheckJobRunEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["CheckJobRun"] | undefined;
  };
  /** check location */
  ["CheckLocation"]: {
    __typename: "CheckLocation";
    coordinates: Array<number>;
    country: string;
    locality: string;
    name: string;
    state?: string | undefined;
    title: string;
  };
  /** The connection type for CheckLocation. */
  ["CheckLocationConnection"]: {
    __typename: "CheckLocationConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["CheckLocationEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["CheckLocation"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CheckLocationEdge"]: {
    __typename: "CheckLocationEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["CheckLocation"] | undefined;
  };
  /** health check state */
  ["CheckState"]: {
    __typename: "CheckState";
    allocation: GraphQLTypes["Allocation"];
    allocationId: string;
    name: string;
    output: string;
    serviceName: string;
    status: string;
    type: GraphQLTypes["CheckType"];
    updatedAt: GraphQLTypes["ISO8601DateTime"];
  };
  /** The connection type for CheckState. */
  ["CheckStateConnection"]: {
    __typename: "CheckStateConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["CheckStateEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["CheckState"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["CheckStateEdge"]: {
    __typename: "CheckStateEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["CheckState"] | undefined;
  };
  ["CheckType"]: CheckType;
  /** Autogenerated input type of ConfigureRegions */
  ["ConfigureRegionsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Regions to allow running in */
    allowRegions?: Array<string> | undefined;
    /** Regions to deny running in */
    denyRegions?: Array<string> | undefined;
    /** Fallback regions. Used if preferred regions are having issues */
    backupRegions?: Array<string> | undefined;
    /** Process group to modify */
    group?: string | undefined;
  };
  /** Autogenerated return type of ConfigureRegions. */
  ["ConfigureRegionsPayload"]: {
    __typename: "ConfigureRegionsPayload";
    app: GraphQLTypes["App"];
    backupRegions: Array<GraphQLTypes["Region"]>;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    group?: string | undefined;
    regions: Array<GraphQLTypes["Region"]>;
  };
  /** Autogenerated input type of CreateAddOn */
  ["CreateAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** An optional application ID to attach the add-on to after provisioning */
    appId?: string | undefined;
    /** The organization which owns the add-on */
    organizationId?: string | undefined;
    /** The add-on type to provision */
    type: GraphQLTypes["AddOnType"];
    /** An optional name for the add-on */
    name?: string | undefined;
    /** The add-on plan ID */
    planId?: string | undefined;
    /** Desired primary region for the add-on */
    primaryRegion?: string | undefined;
    /** Desired regions to place replicas in */
    readRegions?: Array<string> | undefined;
    /** Options specific to the add-on */
    options?: GraphQLTypes["JSON"] | undefined;
  };
  /** Autogenerated return type of CreateAddOn. */
  ["CreateAddOnPayload"]: {
    __typename: "CreateAddOnPayload";
    addOn: GraphQLTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CreateAndRegisterDomain */
  ["CreateAndRegisterDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The domain name */
    name: string;
    /** Enable whois privacy on the registration */
    whoisPrivacy?: boolean | undefined;
    /** Enable auto renew on the registration */
    autoRenew?: boolean | undefined;
  };
  /** Autogenerated return type of CreateAndRegisterDomain. */
  ["CreateAndRegisterDomainPayload"]: {
    __typename: "CreateAndRegisterDomainPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: GraphQLTypes["Domain"];
    organization: GraphQLTypes["Organization"];
  };
  /** Autogenerated input type of CreateAndTransferDomain */
  ["CreateAndTransferDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The domain name */
    name: string;
    /** The authorization code */
    authorizationCode: string;
  };
  /** Autogenerated return type of CreateAndTransferDomain. */
  ["CreateAndTransferDomainPayload"]: {
    __typename: "CreateAndTransferDomainPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: GraphQLTypes["Domain"];
    organization: GraphQLTypes["Organization"];
  };
  /** Autogenerated input type of CreateApp */
  ["CreateAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The application runtime */
    runtime?: GraphQLTypes["RuntimeType"] | undefined;
    /** The name of the new application. Defaults to a random name. */
    name?: string | undefined;
    preferredRegion?: string | undefined;
    heroku?: boolean | undefined;
    network?: string | undefined;
    appRoleId?: string | undefined;
    machines?: boolean | undefined;
  };
  /** Autogenerated return type of CreateApp. */
  ["CreateAppPayload"]: {
    __typename: "CreateAppPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CreateBuild */
  ["CreateBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the app being built */
    appName: string;
    /** The ID of the machine being built (only set for machine builds) */
    machineId?: string | undefined;
    /** Options set for building image */
    imageOpts: GraphQLTypes["BuildImageOptsInput"];
    /** List of available build strategies that will be attempted */
    strategiesAvailable: Array<string>;
    /** Whether builder is remote or local */
    builderType: string;
  };
  /** Autogenerated return type of CreateBuild. */
  ["CreateBuildPayload"]: {
    __typename: "CreateBuildPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** build id */
    id: string;
    /** stored build status */
    status: string;
  };
  /** Autogenerated input type of CreateCheckJob */
  ["CreateCheckJobInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Organization ID */
    organizationId: string;
    /** The URL to check */
    url: string;
    /** http checks locations */
    locations: Array<string>;
    /** http check options */
    httpOptions: GraphQLTypes["CheckJobHTTPOptionsInput"];
  };
  /** Autogenerated return type of CreateCheckJob. */
  ["CreateCheckJobPayload"]: {
    __typename: "CreateCheckJobPayload";
    checkJob: GraphQLTypes["CheckJob"];
    checkJobRun?: GraphQLTypes["CheckJobRun"] | undefined;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CreateCheckJobRun */
  ["CreateCheckJobRunInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Check Job ID */
    checkJobId: string;
  };
  /** Autogenerated return type of CreateCheckJobRun. */
  ["CreateCheckJobRunPayload"]: {
    __typename: "CreateCheckJobRunPayload";
    checkJob: GraphQLTypes["CheckJob"];
    checkJobRun?: GraphQLTypes["CheckJobRun"] | undefined;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CreateDNSPortal */
  ["CreateDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The unique name of this portal. A random name will be generated if omitted. */
    name?: string | undefined;
    /** The title of this portal */
    title?: string | undefined;
    /** The return url for this portal */
    returnUrl?: string | undefined;
    /** The text to display for the return url link */
    returnUrlText?: string | undefined;
    /** The support url for this portal */
    supportUrl?: string | undefined;
    /** The text to display for the support url link */
    supportUrlText?: string | undefined;
    /** The primary branding color */
    primaryColor?: string | undefined;
    /** The secondary branding color */
    accentColor?: string | undefined;
  };
  /** Autogenerated return type of CreateDNSPortal. */
  ["CreateDNSPortalPayload"]: {
    __typename: "CreateDNSPortalPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    dnsPortal: GraphQLTypes["DNSPortal"];
  };
  /** Autogenerated input type of CreateDNSPortalSession */
  ["CreateDNSPortalSessionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the dns portal */
    dnsPortalId: string;
    /** The node ID of the domain to edit */
    domainId: string;
    /** Optionally override the portal's default title for this session */
    title?: string | undefined;
    /** Optionally override the portal's default return url for this session */
    returnUrl?: string | undefined;
    /** Optionally override the portal's default return url text for this session */
    returnUrlText?: string | undefined;
  };
  /** Autogenerated return type of CreateDNSPortalSession. */
  ["CreateDNSPortalSessionPayload"]: {
    __typename: "CreateDNSPortalSessionPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    dnsPortalSession: GraphQLTypes["DNSPortalSession"];
  };
  /** Autogenerated input type of CreateDNSRecord */
  ["CreateDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the domain */
    domainId: string;
    /** The type of the record */
    type: GraphQLTypes["DNSRecordType"];
    /** The dns record name */
    name: string;
    /** The TTL in seconds */
    ttl: number;
    /** The content of the record */
    rdata: string;
  };
  /** Autogenerated return type of CreateDNSRecord. */
  ["CreateDNSRecordPayload"]: {
    __typename: "CreateDNSRecordPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    record: GraphQLTypes["DNSRecord"];
  };
  /** Autogenerated input type of CreateDelegatedWireGuardToken */
  ["CreateDelegatedWireGuardTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The name with which to refer to the peer */
    name?: string | undefined;
  };
  /** Autogenerated return type of CreateDelegatedWireGuardToken. */
  ["CreateDelegatedWireGuardTokenPayload"]: {
    __typename: "CreateDelegatedWireGuardTokenPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    token: string;
  };
  /** Autogenerated input type of CreateDoctorReport */
  ["CreateDoctorReportInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The report data */
    data: GraphQLTypes["JSON"];
  };
  /** Autogenerated return type of CreateDoctorReport. */
  ["CreateDoctorReportPayload"]: {
    __typename: "CreateDoctorReportPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    reportId: string;
  };
  /** Autogenerated return type of CreateDoctorUrl. */
  ["CreateDoctorUrlPayload"]: {
    __typename: "CreateDoctorUrlPayload";
    putUrl: string;
  };
  /** Autogenerated input type of CreateDomain */
  ["CreateDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The domain name */
    name: string;
  };
  /** Autogenerated return type of CreateDomain. */
  ["CreateDomainPayload"]: {
    __typename: "CreateDomainPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: GraphQLTypes["Domain"];
    organization: GraphQLTypes["Organization"];
  };
  /** Autogenerated input type of CreateExtensionTosAgreement */
  ["CreateExtensionTosAgreementInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The add-on provider name */
    addOnProviderName: string;
    /** The organization that agrees to the ToS */
    organizationId?: string | undefined;
  };
  /** Autogenerated return type of CreateExtensionTosAgreement. */
  ["CreateExtensionTosAgreementPayload"]: {
    __typename: "CreateExtensionTosAgreementPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of CreateLimitedAccessToken */
  ["CreateLimitedAccessTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    name: string;
    /** The node ID of the organization */
    organizationId: string;
    profile: string;
    profileParams?: GraphQLTypes["JSON"] | undefined;
    expiry?: string | undefined;
    /** Names of third-party configurations to opt into */
    optInThirdParties?: Array<string> | undefined;
    /** Names of third-party configurations to opt out of */
    optOutThirdParties?: Array<string> | undefined;
  };
  /** Autogenerated return type of CreateLimitedAccessToken. */
  ["CreateLimitedAccessTokenPayload"]: {
    __typename: "CreateLimitedAccessTokenPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    limitedAccessToken: GraphQLTypes["LimitedAccessToken"];
  };
  /** Autogenerated input type of CreateOrganization */
  ["CreateOrganizationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the organization */
    name: string;
    /** Whether or not new apps in this org use Apps V2 by default */
    appsV2DefaultOn?: boolean | undefined;
  };
  /** Autogenerated input type of CreateOrganizationInvitation */
  ["CreateOrganizationInvitationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The email to invite */
    email: string;
  };
  /** Autogenerated return type of CreateOrganizationInvitation. */
  ["CreateOrganizationInvitationPayload"]: {
    __typename: "CreateOrganizationInvitationPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    invitation: GraphQLTypes["OrganizationInvitation"];
  };
  /** Autogenerated return type of CreateOrganization. */
  ["CreateOrganizationPayload"]: {
    __typename: "CreateOrganizationPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: GraphQLTypes["Organization"];
    token: string;
  };
  /** Autogenerated input type of CreatePostgresClusterDatabase */
  ["CreatePostgresClusterDatabaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the postgres cluster app */
    appName: string;
    /** The name of the database */
    databaseName: string;
  };
  /** Autogenerated return type of CreatePostgresClusterDatabase. */
  ["CreatePostgresClusterDatabasePayload"]: {
    __typename: "CreatePostgresClusterDatabasePayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    database: GraphQLTypes["PostgresClusterDatabase"];
    postgresClusterRole: GraphQLTypes["PostgresClusterAppRole"];
  };
  /** Autogenerated input type of CreatePostgresClusterUser */
  ["CreatePostgresClusterUserInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the postgres cluster app */
    appName: string;
    /** The name of the database */
    username: string;
    /** The password of the user */
    password: string;
    /** Should this user be a superuser */
    superuser?: boolean | undefined;
  };
  /** Autogenerated return type of CreatePostgresClusterUser. */
  ["CreatePostgresClusterUserPayload"]: {
    __typename: "CreatePostgresClusterUserPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    postgresClusterRole: GraphQLTypes["PostgresClusterAppRole"];
    user: GraphQLTypes["PostgresClusterUser"];
  };
  /** Autogenerated input type of CreateRelease */
  ["CreateReleaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** The image to deploy */
    image: string;
    /** nomad or machines */
    platformVersion: string;
    /** app definition */
    definition: GraphQLTypes["JSON"];
    /** The strategy for replacing existing instances. Defaults to canary. */
    strategy: GraphQLTypes["DeploymentStrategy"];
  };
  /** Autogenerated return type of CreateRelease. */
  ["CreateReleasePayload"]: {
    __typename: "CreateReleasePayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release?: GraphQLTypes["Release"] | undefined;
  };
  /** Autogenerated input type of CreateTemplateDeployment */
  ["CreateTemplateDeploymentInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization to move the app to */
    organizationId: string;
    template: GraphQLTypes["JSON"];
    variables?: Array<GraphQLTypes["PropertyInput"]> | undefined;
  };
  /** Autogenerated return type of CreateTemplateDeployment. */
  ["CreateTemplateDeploymentPayload"]: {
    __typename: "CreateTemplateDeploymentPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    templateDeployment: GraphQLTypes["TemplateDeployment"];
  };
  /** Autogenerated input type of CreateThirdPartyConfiguration */
  ["CreateThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Friendly name for this configuration */
    name: string;
    /** Location URL of the third-party service capable of discharging */
    location: string;
    /** Restrictions to be placed on third-party caveats */
    caveats?: GraphQLTypes["CaveatSet"] | undefined;
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel: GraphQLTypes["ThirdPartyConfigurationLevel"];
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel: GraphQLTypes["ThirdPartyConfigurationLevel"];
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel: GraphQLTypes["ThirdPartyConfigurationLevel"];
  };
  /** Autogenerated return type of CreateThirdPartyConfiguration. */
  ["CreateThirdPartyConfigurationPayload"]: {
    __typename: "CreateThirdPartyConfigurationPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    thirdPartyConfiguration: GraphQLTypes["ThirdPartyConfiguration"];
  };
  /** Autogenerated input type of CreateVolume */
  ["CreateVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to attach the new volume to */
    appId: string;
    /** Volume name */
    name: string;
    /** Desired region for volume */
    region: string;
    /** Desired volume size, in GB */
    sizeGb: number;
    /** Volume should be encrypted at rest */
    encrypted?: boolean | undefined;
    /** Provision volume in a redundancy zone not already in use by this app */
    requireUniqueZone?: boolean | undefined;
    snapshotId?: string | undefined;
    fsType?: GraphQLTypes["FsTypeType"] | undefined;
  };
  /** Autogenerated return type of CreateVolume. */
  ["CreateVolumePayload"]: {
    __typename: "CreateVolumePayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    volume: GraphQLTypes["Volume"];
  };
  /** Autogenerated input type of CreateVolumeSnapshot */
  ["CreateVolumeSnapshotInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    volumeId: string;
  };
  /** Autogenerated return type of CreateVolumeSnapshot. */
  ["CreateVolumeSnapshotPayload"]: {
    __typename: "CreateVolumeSnapshotPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    volume: GraphQLTypes["Volume"];
  };
  ["DNSPortal"]: {
    __typename: "DNSPortal";
    accentColor: string;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    id: string;
    name: string;
    organization: GraphQLTypes["Organization"];
    primaryColor: string;
    returnUrl?: string | undefined;
    returnUrlText?: string | undefined;
    supportUrl?: string | undefined;
    supportUrlText?: string | undefined;
    title: string;
    updatedAt: GraphQLTypes["ISO8601DateTime"];
  };
  /** The connection type for DNSPortal. */
  ["DNSPortalConnection"]: {
    __typename: "DNSPortalConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["DNSPortalEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["DNSPortal"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["DNSPortalEdge"]: {
    __typename: "DNSPortalEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["DNSPortal"] | undefined;
  };
  ["DNSPortalSession"]: {
    __typename: "DNSPortalSession";
    createdAt: GraphQLTypes["ISO8601DateTime"];
    /** The dns portal this session */
    dnsPortal: GraphQLTypes["DNSPortal"];
    expiresAt: GraphQLTypes["ISO8601DateTime"];
    id: string;
    /** Is this session expired? */
    isExpired: boolean;
    /** The overridden return url for this session */
    returnUrl?: string | undefined;
    /** The overridden return url text for this session */
    returnUrlText?: string | undefined;
    /** The overridden title for this session */
    title?: string | undefined;
    /** The url to access this session's dns portal */
    url: string;
  };
  ["DNSRecord"]: {
    __typename: "DNSRecord";
    createdAt: GraphQLTypes["ISO8601DateTime"];
    /** The domain this record belongs to */
    domain: GraphQLTypes["Domain"];
    /** Fully qualified domain name for this record */
    fqdn: string;
    id: string;
    /** Is this record at the zone apex? */
    isApex: boolean;
    /** Is this a system record? System records are managed by fly and not editable. */
    isSystem: boolean;
    /** Is this record a wildcard? */
    isWildcard: boolean;
    /** The name of this record. @ indicates the record is at the zone apex. */
    name: string;
    /** The record data */
    rdata: string;
    /** The number of seconds this record can be cached for */
    ttl: number;
    /** The type of record */
    type: GraphQLTypes["DNSRecordType"];
    updatedAt: GraphQLTypes["ISO8601DateTime"];
  };
  ["DNSRecordAttributes"]: {
    __typename: "DNSRecordAttributes";
    /** The name of the record. */
    name: string;
    /** The record data. */
    rdata: string;
    /** The number of seconds this record can be cached for. */
    ttl: number;
    /** The type of record. */
    type: GraphQLTypes["DNSRecordType"];
  };
  ["DNSRecordChangeAction"]: DNSRecordChangeAction;
  ["DNSRecordChangeInput"]: {
    /** The action to perform on this record. */
    action: GraphQLTypes["DNSRecordChangeAction"];
    /** The id of the record this action will apply to. This is required if the action is UPDATE or DELETE. */
    recordId?: string | undefined;
    /** The record type. This is required if action is CREATE. */
    type?: GraphQLTypes["DNSRecordType"] | undefined;
    /** The name of the record. If omitted it will default to @ - the zone apex. */
    name?: string | undefined;
    /** The number of seconds this record can be cached for. Defaults to 1 hour. */
    ttl?: number | undefined;
    /** The record data. Required if action is CREATE */
    rdata?: string | undefined;
  };
  /** The connection type for DNSRecord. */
  ["DNSRecordConnection"]: {
    __typename: "DNSRecordConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["DNSRecordEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["DNSRecord"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  ["DNSRecordDiff"]: {
    __typename: "DNSRecordDiff";
    /** The action that was performed. */
    action: GraphQLTypes["DNSRecordChangeAction"];
    /** The attributes for this record after the action was performed. */
    newAttributes?: GraphQLTypes["DNSRecordAttributes"] | undefined;
    /** The text representation of this record after the action was performed. */
    newText?: string | undefined;
    /** The attributes for this record before the action was performed. */
    oldAttributes?: GraphQLTypes["DNSRecordAttributes"] | undefined;
    /** The text representation of this record before the action was performed. */
    oldText?: string | undefined;
  };
  /** An edge in a connection. */
  ["DNSRecordEdge"]: {
    __typename: "DNSRecordEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["DNSRecord"] | undefined;
  };
  ["DNSRecordType"]: DNSRecordType;
  ["DNSRecordWarning"]: {
    __typename: "DNSRecordWarning";
    /** The action to perform. */
    action: GraphQLTypes["DNSRecordChangeAction"];
    /** The desired attributes for this record. */
    attributes: GraphQLTypes["DNSRecordAttributes"];
    /** The warning message. */
    message: string;
    /** The record this warning applies to. */
    record?: GraphQLTypes["DNSRecord"] | undefined;
  };
  ["DelegatedWireGuardToken"]: {
    __typename: "DelegatedWireGuardToken";
    id: string;
    name: string;
  };
  /** The connection type for DelegatedWireGuardToken. */
  ["DelegatedWireGuardTokenConnection"]: {
    __typename: "DelegatedWireGuardTokenConnection";
    /** A list of edges. */
    edges?:
      | Array<GraphQLTypes["DelegatedWireGuardTokenEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?:
      | Array<GraphQLTypes["DelegatedWireGuardToken"] | undefined>
      | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["DelegatedWireGuardTokenEdge"]: {
    __typename: "DelegatedWireGuardTokenEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["DelegatedWireGuardToken"] | undefined;
  };
  /** Autogenerated input type of DeleteAddOn */
  ["DeleteAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the add-on to delete */
    addOnId?: string | undefined;
    /** The name of the add-on to delete */
    name?: string | undefined;
  };
  /** Autogenerated return type of DeleteAddOn. */
  ["DeleteAddOnPayload"]: {
    __typename: "DeleteAddOnPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    deletedAddOnName?: string | undefined;
  };
  /** Autogenerated return type of DeleteApp. */
  ["DeleteAppPayload"]: {
    __typename: "DeleteAppPayload";
    /** The organization that owned the deleted app */
    organization: GraphQLTypes["Organization"];
  };
  /** Autogenerated return type of DeleteCertificate. */
  ["DeleteCertificatePayload"]: {
    __typename: "DeleteCertificatePayload";
    app?: GraphQLTypes["App"] | undefined;
    certificate?: GraphQLTypes["AppCertificate"] | undefined;
    errors?: Array<string> | undefined;
  };
  /** Autogenerated input type of DeleteDNSPortal */
  ["DeleteDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the dns portal */
    dnsPortalId: string;
  };
  /** Autogenerated return type of DeleteDNSPortal. */
  ["DeleteDNSPortalPayload"]: {
    __typename: "DeleteDNSPortalPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The organization that owned the dns portal */
    organization: GraphQLTypes["Organization"];
  };
  /** Autogenerated input type of DeleteDNSPortalSession */
  ["DeleteDNSPortalSessionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the dns portal session */
    dnsPortalSessionId: string;
  };
  /** Autogenerated return type of DeleteDNSPortalSession. */
  ["DeleteDNSPortalSessionPayload"]: {
    __typename: "DeleteDNSPortalSessionPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The dns portal that owned the session */
    dnsPortal: GraphQLTypes["DNSPortal"];
  };
  /** Autogenerated input type of DeleteDNSRecord */
  ["DeleteDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the DNS record */
    recordId: string;
  };
  /** Autogenerated return type of DeleteDNSRecord. */
  ["DeleteDNSRecordPayload"]: {
    __typename: "DeleteDNSRecordPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: GraphQLTypes["Domain"];
  };
  /** Autogenerated input type of DeleteDelegatedWireGuardToken */
  ["DeleteDelegatedWireGuardTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The raw WireGuard token */
    token?: string | undefined;
    /** The name with which to refer to the token */
    name?: string | undefined;
  };
  /** Autogenerated return type of DeleteDelegatedWireGuardToken. */
  ["DeleteDelegatedWireGuardTokenPayload"]: {
    __typename: "DeleteDelegatedWireGuardTokenPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    token: string;
  };
  /** Autogenerated input type of DeleteDeploymentSource */
  ["DeleteDeploymentSourceInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to update */
    appId: string;
  };
  /** Autogenerated return type of DeleteDeploymentSource. */
  ["DeleteDeploymentSourcePayload"]: {
    __typename: "DeleteDeploymentSourcePayload";
    app?: GraphQLTypes["App"] | undefined;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of DeleteDomain */
  ["DeleteDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the domain */
    domainId: string;
  };
  /** Autogenerated return type of DeleteDomain. */
  ["DeleteDomainPayload"]: {
    __typename: "DeleteDomainPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: GraphQLTypes["Organization"];
  };
  /** Autogenerated input type of DeleteHealthCheckHandler */
  ["DeleteHealthCheckHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Handler name */
    name: string;
  };
  /** Autogenerated return type of DeleteHealthCheckHandler. */
  ["DeleteHealthCheckHandlerPayload"]: {
    __typename: "DeleteHealthCheckHandlerPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of DeleteLimitedAccessToken */
  ["DeleteLimitedAccessTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The root of the macaroon */
    token?: string | undefined;
    /** The node ID for real */
    id?: string | undefined;
  };
  /** Autogenerated return type of DeleteLimitedAccessToken. */
  ["DeleteLimitedAccessTokenPayload"]: {
    __typename: "DeleteLimitedAccessTokenPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    token?: string | undefined;
  };
  /** Autogenerated input type of DeleteOrganization */
  ["DeleteOrganizationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the organization to delete */
    organizationId: string;
  };
  /** Autogenerated input type of DeleteOrganizationInvitation */
  ["DeleteOrganizationInvitationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the invitation */
    invitationId: string;
  };
  /** Autogenerated return type of DeleteOrganizationInvitation. */
  ["DeleteOrganizationInvitationPayload"]: {
    __typename: "DeleteOrganizationInvitationPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: GraphQLTypes["Organization"];
  };
  /** Autogenerated input type of DeleteOrganizationMembership */
  ["DeleteOrganizationMembershipInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The node ID of the user */
    userId: string;
  };
  /** Autogenerated return type of DeleteOrganizationMembership. */
  ["DeleteOrganizationMembershipPayload"]: {
    __typename: "DeleteOrganizationMembershipPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: GraphQLTypes["Organization"];
    user: GraphQLTypes["User"];
  };
  /** Autogenerated return type of DeleteOrganization. */
  ["DeleteOrganizationPayload"]: {
    __typename: "DeleteOrganizationPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    deletedOrganizationId: string;
  };
  /** Autogenerated input type of DeleteRemoteBuilder */
  ["DeleteRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
  };
  /** Autogenerated return type of DeleteRemoteBuilder. */
  ["DeleteRemoteBuilderPayload"]: {
    __typename: "DeleteRemoteBuilderPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: GraphQLTypes["Organization"];
  };
  /** Autogenerated input type of DeleteThirdPartyConfiguration */
  ["DeleteThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the configuration */
    thirdPartyConfigurationId: string;
  };
  /** Autogenerated return type of DeleteThirdPartyConfiguration. */
  ["DeleteThirdPartyConfigurationPayload"]: {
    __typename: "DeleteThirdPartyConfigurationPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    ok: boolean;
  };
  /** Autogenerated input type of DeleteVolume */
  ["DeleteVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the volume */
    volumeId: string;
    /** Unique lock ID */
    lockId?: string | undefined;
  };
  /** Autogenerated return type of DeleteVolume. */
  ["DeleteVolumePayload"]: {
    __typename: "DeleteVolumePayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of DeployImage */
  ["DeployImageInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** The image to deploy */
    image: string;
    /** Network services to expose */
    services?: Array<GraphQLTypes["ServiceInput"]> | undefined;
    /** app definition */
    definition?: GraphQLTypes["JSON"] | undefined;
    /** The strategy for replacing existing instances. Defaults to canary. */
    strategy?: GraphQLTypes["DeploymentStrategy"] | undefined;
  };
  /** Autogenerated return type of DeployImage. */
  ["DeployImagePayload"]: {
    __typename: "DeployImagePayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release?: GraphQLTypes["Release"] | undefined;
    releaseCommand?: GraphQLTypes["ReleaseCommand"] | undefined;
  };
  /** Continuous deployment configuration */
  ["DeploymentSource"]: {
    __typename: "DeploymentSource";
    backend: GraphQLTypes["JSON"];
    baseDir: string;
    connected: boolean;
    id: string;
    provider: string;
    /** The ref to build from */
    ref: string;
    repositoryId: string;
    /** The repository to fetch source code from */
    repositoryUrl: string;
  };
  ["DeploymentStatus"]: {
    __typename: "DeploymentStatus";
    allocations: Array<GraphQLTypes["Allocation"]>;
    description: string;
    desiredCount: number;
    healthyCount: number;
    /** Unique ID for this deployment */
    id: string;
    inProgress: boolean;
    placedCount: number;
    promoted: boolean;
    status: string;
    successful: boolean;
    unhealthyCount: number;
    version: number;
  };
  ["DeploymentStrategy"]: DeploymentStrategy;
  /** Autogenerated input type of DetachPostgresCluster */
  ["DetachPostgresClusterInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The postgres cluster application id */
    postgresClusterAppId: string;
    /** The application to detach postgres from */
    appId: string;
    /** The postgres attachment id */
    postgresClusterAttachmentId?: string | undefined;
  };
  /** Autogenerated return type of DetachPostgresCluster. */
  ["DetachPostgresClusterPayload"]: {
    __typename: "DetachPostgresClusterPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    postgresClusterApp: GraphQLTypes["App"];
  };
  /** Autogenerated input type of DischargeRootToken */
  ["DischargeRootTokenInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    rootToken: string;
    organizationId: number;
    expiry?: string | undefined;
  };
  /** Autogenerated return type of DischargeRootToken. */
  ["DischargeRootTokenPayload"]: {
    __typename: "DischargeRootTokenPayload";
    authToken: string;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  ["Domain"]: {
    __typename: "Domain";
    autoRenew?: boolean | undefined;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    /** The delegated nameservers for the registration */
    delegatedNameservers?: Array<string> | undefined;
    /** The dns records for this domain */
    dnsRecords: GraphQLTypes["DNSRecordConnection"];
    dnsStatus: GraphQLTypes["DomainDNSStatus"];
    expiresAt?: GraphQLTypes["ISO8601DateTime"] | undefined;
    id: string;
    /** The name for this domain */
    name: string;
    /** The organization that owns this domain */
    organization: GraphQLTypes["Organization"];
    registrationStatus: GraphQLTypes["DomainRegistrationStatus"];
    updatedAt: GraphQLTypes["ISO8601DateTime"];
    /** The nameservers for the hosted zone */
    zoneNameservers: Array<string>;
  };
  /** The connection type for Domain. */
  ["DomainConnection"]: {
    __typename: "DomainConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["DomainEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["Domain"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  ["DomainDNSStatus"]: DomainDNSStatus;
  /** An edge in a connection. */
  ["DomainEdge"]: {
    __typename: "DomainEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["Domain"] | undefined;
  };
  ["DomainRegistrationStatus"]: DomainRegistrationStatus;
  /** Autogenerated input type of DummyWireGuardPeer */
  ["DummyWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The region in which to deploy the peer */
    region?: string | undefined;
  };
  /** Autogenerated return type of DummyWireGuardPeer. */
  ["DummyWireGuardPeerPayload"]: {
    __typename: "DummyWireGuardPeerPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    endpointip: string;
    localpub: string;
    peerip: string;
    privkey: string;
    pubkey: string;
  };
  ["EmptyAppRole"]: {
    __typename: "EmptyAppRole";
    /** The name of this role */
    name: string;
  };
  /** Autogenerated input type of EnablePostgresConsul */
  ["EnablePostgresConsulInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    region?: string | undefined;
  };
  /** Autogenerated return type of EnablePostgresConsul. */
  ["EnablePostgresConsulPayload"]: {
    __typename: "EnablePostgresConsulPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    consulUrl: string;
  };
  /** Autogenerated input type of EnsureMachineRemoteBuilder */
  ["EnsureMachineRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The unique application name */
    appName?: string | undefined;
    /** The node ID of the organization */
    organizationId?: string | undefined;
    /** Desired region for the remote builder */
    region?: string | undefined;
    /** Use v2 machines */
    v2?: boolean | undefined;
  };
  /** Autogenerated return type of EnsureMachineRemoteBuilder. */
  ["EnsureMachineRemoteBuilderPayload"]: {
    __typename: "EnsureMachineRemoteBuilderPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: GraphQLTypes["Machine"];
  };
  /** Autogenerated input type of EstablishSSHKey */
  ["EstablishSSHKeyInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Establish a key even if one is already set */
    override?: boolean | undefined;
  };
  /** Autogenerated return type of EstablishSSHKey. */
  ["EstablishSSHKeyPayload"]: {
    __typename: "EstablishSSHKeyPayload";
    certificate: string;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of ExportDNSZone */
  ["ExportDNSZoneInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** ID of the domain to export */
    domainId: string;
  };
  /** Autogenerated return type of ExportDNSZone. */
  ["ExportDNSZonePayload"]: {
    __typename: "ExportDNSZonePayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    contents: string;
    domain: GraphQLTypes["Domain"];
  };
  /** Autogenerated input type of ExtendVolume */
  ["ExtendVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the volume */
    volumeId: string;
    /** The target volume size */
    sizeGb: number;
  };
  /** Autogenerated return type of ExtendVolume. */
  ["ExtendVolumePayload"]: {
    __typename: "ExtendVolumePayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    needsRestart: boolean;
    volume: GraphQLTypes["Volume"];
  };
  /** Autogenerated input type of FinishBuild */
  ["FinishBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Build id returned by createBuild() mutation */
    buildId: string;
    /** The name of the app being built */
    appName: string;
    /** The ID of the machine being built (only set for machine builds) */
    machineId?: string | undefined;
    /** Indicate whether build completed or failed */
    status: string;
    /** Build strategies attempted and their result, should be in order of attempt */
    strategiesAttempted?:
      | Array<GraphQLTypes["BuildStrategyAttemptInput"]>
      | undefined;
    /** Metadata about the builder */
    builderMeta?: GraphQLTypes["BuilderMetaInput"] | undefined;
    /** Information about the docker image that was built */
    finalImage?: GraphQLTypes["BuildFinalImageInput"] | undefined;
    /** Timings for different phases of the build */
    timings?: GraphQLTypes["BuildTimingsInput"] | undefined;
    /** Log or error output */
    logs?: string | undefined;
  };
  /** Autogenerated return type of FinishBuild. */
  ["FinishBuildPayload"]: {
    __typename: "FinishBuildPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** build id */
    id: string;
    /** stored build status */
    status: string;
    /** wall clock time for this build */
    wallclockTimeMs: number;
  };
  ["FlyPlatform"]: {
    __typename: "FlyPlatform";
    /** Latest flyctl release details */
    flyctl: GraphQLTypes["FlyctlRelease"];
    /** Fly global regions */
    regions: Array<GraphQLTypes["Region"]>;
    /** Region current request from */
    requestRegion?: string | undefined;
    /** Available VM sizes */
    vmSizes: Array<GraphQLTypes["VMSize"]>;
  };
  ["FlyctlMachineHostAppRole"]: {
    __typename: "FlyctlMachineHostAppRole";
    /** The name of this role */
    name: string;
  };
  ["FlyctlRelease"]: {
    __typename: "FlyctlRelease";
    timestamp: GraphQLTypes["ISO8601DateTime"];
    version: string;
  };
  /** Autogenerated input type of ForkVolume */
  ["ForkVolumeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to attach the new volume to */
    appId: string;
    /** The volume to fork */
    sourceVolId: string;
    /** Volume name */
    name?: string | undefined;
    /** Lock the new volume to only usable on machines */
    machinesOnly?: boolean | undefined;
    /** Unique lock ID */
    lockId?: string | undefined;
    /** Enables experimental cross-host volume forking */
    remote?: boolean | undefined;
  };
  /** Autogenerated return type of ForkVolume. */
  ["ForkVolumePayload"]: {
    __typename: "ForkVolumePayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    volume: GraphQLTypes["Volume"];
  };
  ["FsTypeType"]: FsTypeType;
  ["GithubAppInstallation"]: {
    __typename: "GithubAppInstallation";
    editUrl: string;
    id: string;
    owner: string;
    repositories: Array<GraphQLTypes["GithubRepository"]>;
  };
  ["GithubIntegration"]: {
    __typename: "GithubIntegration";
    installationUrl: string;
    installations: Array<GraphQLTypes["GithubAppInstallation"]>;
    viewerAuthenticated: boolean;
  };
  ["GithubRepository"]: {
    __typename: "GithubRepository";
    fork: boolean;
    fullName: string;
    id: string;
    name: string;
    private: boolean;
  };
  /** Autogenerated input type of GrantPostgresClusterUserAccess */
  ["GrantPostgresClusterUserAccessInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the postgres cluster app */
    appName: string;
    /** The name of the database */
    username: string;
    /** The database to grant access to */
    databaseName: string;
  };
  /** Autogenerated return type of GrantPostgresClusterUserAccess. */
  ["GrantPostgresClusterUserAccessPayload"]: {
    __typename: "GrantPostgresClusterUserAccessPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    database: GraphQLTypes["PostgresClusterDatabase"];
    postgresClusterRole: GraphQLTypes["PostgresClusterAppRole"];
    user: GraphQLTypes["PostgresClusterUser"];
  };
  ["HTTPMethod"]: HTTPMethod;
  ["HTTPProtocol"]: HTTPProtocol;
  ["HealthCheck"]: {
    __typename: "HealthCheck";
    /** Raw name of entity */
    entity: string;
    /** Time check last passed */
    lastPassing?: GraphQLTypes["ISO8601DateTime"] | undefined;
    /** Check name */
    name: string;
    /** Latest check output */
    output?: string | undefined;
    /** Current check state */
    state: string;
  };
  /** The connection type for HealthCheck. */
  ["HealthCheckConnection"]: {
    __typename: "HealthCheckConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["HealthCheckEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["HealthCheck"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["HealthCheckEdge"]: {
    __typename: "HealthCheckEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["HealthCheck"] | undefined;
  };
  ["HealthCheckHandler"]: {
    __typename: "HealthCheckHandler";
    /** Handler name */
    name: string;
    /** Handler type (Slack or Pagerduty) */
    type: string;
  };
  /** The connection type for HealthCheckHandler. */
  ["HealthCheckHandlerConnection"]: {
    __typename: "HealthCheckHandlerConnection";
    /** A list of edges. */
    edges?:
      | Array<GraphQLTypes["HealthCheckHandlerEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["HealthCheckHandler"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["HealthCheckHandlerEdge"]: {
    __typename: "HealthCheckHandlerEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["HealthCheckHandler"] | undefined;
  };
  ["HerokuApp"]: {
    __typename: "HerokuApp";
    id: string;
    name: string;
    region?: string | undefined;
    releasedAt: GraphQLTypes["ISO8601DateTime"];
    stack?: string | undefined;
    teamName?: string | undefined;
  };
  ["HerokuIntegration"]: {
    __typename: "HerokuIntegration";
    herokuApps: Array<GraphQLTypes["HerokuApp"]>;
    viewerAuthenticated: boolean;
  };
  ["Host"]: {
    __typename: "Host";
    id: string;
  };
  ["HostnameCheck"]: {
    __typename: "HostnameCheck";
    aRecords: Array<string>;
    aaaaRecords: Array<string>;
    acmeDnsConfigured: boolean;
    caaRecords: Array<string>;
    cnameRecords: Array<string>;
    dnsConfigured: boolean;
    dnsProvider?: string | undefined;
    dnsVerificationRecord?: string | undefined;
    errors?: Array<string> | undefined;
    id: string;
    isProxied: boolean;
    resolvedAddresses: Array<string>;
    soa?: string | undefined;
  };
  ["IPAddress"]: {
    __typename: "IPAddress";
    address: string;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    id: string;
    region?: string | undefined;
    type: GraphQLTypes["IPAddressType"];
  };
  /** The connection type for IPAddress. */
  ["IPAddressConnection"]: {
    __typename: "IPAddressConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["IPAddressEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["IPAddress"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["IPAddressEdge"]: {
    __typename: "IPAddressEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["IPAddress"] | undefined;
  };
  ["IPAddressType"]: IPAddressType;
  /** An ISO 8601-encoded datetime */
  ["ISO8601DateTime"]: "scalar" & { name: "ISO8601DateTime" };
  ["Image"]: {
    __typename: "Image";
    absoluteRef: string;
    compressedSize: number;
    compressedSizeFull: GraphQLTypes["BigInt"];
    config: GraphQLTypes["JSON"];
    configDigest: GraphQLTypes["JSON"];
    createdAt: GraphQLTypes["ISO8601DateTime"];
    digest: string;
    id: string;
    label: string;
    manifest: GraphQLTypes["JSON"];
    ref: string;
    registry: string;
    repository: string;
    tag?: string | undefined;
  };
  ["ImageVersion"]: {
    __typename: "ImageVersion";
    digest: string;
    registry: string;
    repository: string;
    tag: string;
    version?: string | undefined;
  };
  /** Autogenerated return type of ImportCertificate. */
  ["ImportCertificatePayload"]: {
    __typename: "ImportCertificatePayload";
    app?: GraphQLTypes["App"] | undefined;
    appCertificate?: GraphQLTypes["AppCertificate"] | undefined;
    certificate?: GraphQLTypes["Certificate"] | undefined;
    errors?: Array<string> | undefined;
  };
  /** Autogenerated input type of ImportDNSZone */
  ["ImportDNSZoneInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** ID of the domain to export */
    domainId: string;
    zonefile: string;
  };
  /** Autogenerated return type of ImportDNSZone. */
  ["ImportDNSZonePayload"]: {
    __typename: "ImportDNSZonePayload";
    changes: Array<GraphQLTypes["DNSRecordDiff"]>;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: GraphQLTypes["Domain"];
    warnings: Array<GraphQLTypes["DNSRecordWarning"]>;
  };
  /** Autogenerated input type of IssueCertificate */
  ["IssueCertificateInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The names of the apps this certificate will be limited to accessing */
    appNames?: Array<string> | undefined;
    /** Hours for which certificate will be valid */
    validHours?: number | undefined;
    /** SSH principals for certificate (e.g. ["fly", "root"]) */
    principals?: Array<string> | undefined;
    /** The openssh-formatted ED25519 public key to issue the certificate for */
    publicKey?: string | undefined;
  };
  /** Autogenerated return type of IssueCertificate. */
  ["IssueCertificatePayload"]: {
    __typename: "IssueCertificatePayload";
    certificate: string;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The private key, if a public_key wasn't specified */
    key?: string | undefined;
  };
  /** Untyped JSON data */
  ["JSON"]: "scalar" & { name: "JSON" };
  /** Autogenerated input type of KillMachine */
  ["KillMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** machine id */
    id: string;
  };
  /** Autogenerated return type of KillMachine. */
  ["KillMachinePayload"]: {
    __typename: "KillMachinePayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: GraphQLTypes["Machine"];
  };
  /** Autogenerated input type of LaunchMachine */
  ["LaunchMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** The node ID of the organization */
    organizationId?: string | undefined;
    /** The ID of the machine */
    id?: string | undefined;
    /** The name of the machine */
    name?: string | undefined;
    /** Region for the machine */
    region?: string | undefined;
    /** Configuration */
    config: GraphQLTypes["JSON"];
  };
  /** Autogenerated return type of LaunchMachine. */
  ["LaunchMachinePayload"]: {
    __typename: "LaunchMachinePayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: GraphQLTypes["Machine"];
  };
  ["LimitedAccessToken"]: {
    __typename: "LimitedAccessToken";
    createdAt: GraphQLTypes["ISO8601DateTime"];
    expiresAt: GraphQLTypes["ISO8601DateTime"];
    id: string;
    name: string;
    profile: string;
    token: string;
    tokenHeader?: string | undefined;
  };
  /** The connection type for LimitedAccessToken. */
  ["LimitedAccessTokenConnection"]: {
    __typename: "LimitedAccessTokenConnection";
    /** A list of edges. */
    edges?:
      | Array<GraphQLTypes["LimitedAccessTokenEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["LimitedAccessToken"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["LimitedAccessTokenEdge"]: {
    __typename: "LimitedAccessTokenEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["LimitedAccessToken"] | undefined;
  };
  /** Autogenerated input type of LockApp */
  ["LockAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of LockApp. */
  ["LockAppPayload"]: {
    __typename: "LockAppPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** When this lock automatically expires */
    expiration?: GraphQLTypes["ISO8601DateTime"] | undefined;
    /** Unique lock ID */
    lockId?: string | undefined;
  };
  ["LogEntry"]: {
    __typename: "LogEntry";
    id: string;
    instanceId: string;
    level: string;
    message: string;
    region: string;
    timestamp: GraphQLTypes["ISO8601DateTime"];
  };
  /** Autogenerated input type of LogOut */
  ["LogOutInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated return type of LogOut. */
  ["LogOutPayload"]: {
    __typename: "LogOutPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    ok: boolean;
  };
  ["LoggedCertificate"]: {
    __typename: "LoggedCertificate";
    cert: string;
    id: string;
    root: boolean;
  };
  /** The connection type for LoggedCertificate. */
  ["LoggedCertificateConnection"]: {
    __typename: "LoggedCertificateConnection";
    /** A list of edges. */
    edges?:
      | Array<GraphQLTypes["LoggedCertificateEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["LoggedCertificate"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["LoggedCertificateEdge"]: {
    __typename: "LoggedCertificateEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["LoggedCertificate"] | undefined;
  };
  ["Macaroon"]: {
    __typename: "Macaroon";
    /** URL for avatar or placeholder */
    avatarUrl: string;
    createdAt?: GraphQLTypes["ISO8601DateTime"] | undefined;
    /** Email address for principal */
    email: string;
    featureFlags?: Array<string> | undefined;
    hasNodeproxyApps?: boolean | undefined;
    id?: string | undefined;
    lastRegion?: string | undefined;
    /** Display name of principal */
    name?: string | undefined;
    organizations?: GraphQLTypes["OrganizationConnection"] | undefined;
    personalOrganization?: GraphQLTypes["Organization"] | undefined;
    trust: GraphQLTypes["OrganizationTrust"];
    twoFactorProtection?: boolean | undefined;
    username?: string | undefined;
  };
  ["Machine"]: {
    __typename: "Machine";
    app: GraphQLTypes["App"];
    config: GraphQLTypes["JSON"];
    createdAt: GraphQLTypes["ISO8601DateTime"];
    events: GraphQLTypes["MachineEventConnection"];
    host: GraphQLTypes["Host"];
    id: string;
    instanceId: string;
    ips: GraphQLTypes["MachineIPConnection"];
    name: string;
    region: string;
    state: string;
    updatedAt: GraphQLTypes["ISO8601DateTime"];
  };
  /** The connection type for Machine. */
  ["MachineConnection"]: {
    __typename: "MachineConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["MachineEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["Machine"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["MachineEdge"]: {
    __typename: "MachineEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["Machine"] | undefined;
  };
  /** A machine state change event */
  ["MachineEvent"]: {
    __typename:
      | "MachineEventDestroy"
      | "MachineEventExit"
      | "MachineEventGeneric"
      | "MachineEventStart";
    id: string;
    kind: string;
    timestamp: GraphQLTypes["ISO8601DateTime"];
    ["...on MachineEventDestroy"]:
      & "__union"
      & GraphQLTypes["MachineEventDestroy"];
    ["...on MachineEventExit"]: "__union" & GraphQLTypes["MachineEventExit"];
    ["...on MachineEventGeneric"]:
      & "__union"
      & GraphQLTypes["MachineEventGeneric"];
    ["...on MachineEventStart"]: "__union" & GraphQLTypes["MachineEventStart"];
  };
  /** The connection type for MachineEvent. */
  ["MachineEventConnection"]: {
    __typename: "MachineEventConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["MachineEventEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["MachineEvent"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
  };
  ["MachineEventDestroy"]: {
    __typename: "MachineEventDestroy";
    id: string;
    kind: string;
    timestamp: GraphQLTypes["ISO8601DateTime"];
  };
  /** An edge in a connection. */
  ["MachineEventEdge"]: {
    __typename: "MachineEventEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["MachineEvent"] | undefined;
  };
  ["MachineEventExit"]: {
    __typename: "MachineEventExit";
    exitCode: number;
    id: string;
    kind: string;
    metadata: GraphQLTypes["JSON"];
    oomKilled: boolean;
    requestedStop: boolean;
    timestamp: GraphQLTypes["ISO8601DateTime"];
  };
  ["MachineEventGeneric"]: {
    __typename: "MachineEventGeneric";
    id: string;
    kind: string;
    timestamp: GraphQLTypes["ISO8601DateTime"];
  };
  ["MachineEventStart"]: {
    __typename: "MachineEventStart";
    id: string;
    kind: string;
    timestamp: GraphQLTypes["ISO8601DateTime"];
  };
  ["MachineIP"]: {
    __typename: "MachineIP";
    family: string;
    /** ID of the object. */
    id: string;
    ip: string;
    kind: string;
    maskSize: number;
  };
  /** The connection type for MachineIP. */
  ["MachineIPConnection"]: {
    __typename: "MachineIPConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["MachineIPEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["MachineIP"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["MachineIPEdge"]: {
    __typename: "MachineIPEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["MachineIP"] | undefined;
  };
  /** Autogenerated input type of MoveApp */
  ["MoveAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to move */
    appId: string;
    /** The node ID of the organization to move the app to */
    organizationId: string;
  };
  /** Autogenerated return type of MoveApp. */
  ["MoveAppPayload"]: {
    __typename: "MoveAppPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  ["Mutations"]: {
    __typename: "Mutations";
    addCertificate?: GraphQLTypes["AddCertificatePayload"] | undefined;
    addWireGuardPeer?: GraphQLTypes["AddWireGuardPeerPayload"] | undefined;
    allocateIpAddress?: GraphQLTypes["AllocateIPAddressPayload"] | undefined;
    attachPostgresCluster?:
      | GraphQLTypes["AttachPostgresClusterPayload"]
      | undefined;
    cancelBuild?: GraphQLTypes["CancelBuildPayload"] | undefined;
    checkCertificate?: GraphQLTypes["CheckCertificatePayload"] | undefined;
    checkDomain?: GraphQLTypes["CheckDomainPayload"] | undefined;
    configureRegions?: GraphQLTypes["ConfigureRegionsPayload"] | undefined;
    createAddOn?: GraphQLTypes["CreateAddOnPayload"] | undefined;
    createAndRegisterDomain?:
      | GraphQLTypes["CreateAndRegisterDomainPayload"]
      | undefined;
    createAndTransferDomain?:
      | GraphQLTypes["CreateAndTransferDomainPayload"]
      | undefined;
    createApp?: GraphQLTypes["CreateAppPayload"] | undefined;
    createBuild?: GraphQLTypes["CreateBuildPayload"] | undefined;
    createCheckJob?: GraphQLTypes["CreateCheckJobPayload"] | undefined;
    createCheckJobRun?: GraphQLTypes["CreateCheckJobRunPayload"] | undefined;
    createDelegatedWireGuardToken?:
      | GraphQLTypes["CreateDelegatedWireGuardTokenPayload"]
      | undefined;
    createDnsPortal?: GraphQLTypes["CreateDNSPortalPayload"] | undefined;
    createDnsPortalSession?:
      | GraphQLTypes["CreateDNSPortalSessionPayload"]
      | undefined;
    createDnsRecord?: GraphQLTypes["CreateDNSRecordPayload"] | undefined;
    createDoctorReport?: GraphQLTypes["CreateDoctorReportPayload"] | undefined;
    createDoctorUrl?: GraphQLTypes["CreateDoctorUrlPayload"] | undefined;
    createDomain?: GraphQLTypes["CreateDomainPayload"] | undefined;
    createExtensionTosAgreement?:
      | GraphQLTypes["CreateExtensionTosAgreementPayload"]
      | undefined;
    createLimitedAccessToken?:
      | GraphQLTypes["CreateLimitedAccessTokenPayload"]
      | undefined;
    createOrganization?: GraphQLTypes["CreateOrganizationPayload"] | undefined;
    createOrganizationInvitation?:
      | GraphQLTypes["CreateOrganizationInvitationPayload"]
      | undefined;
    createPostgresClusterDatabase?:
      | GraphQLTypes["CreatePostgresClusterDatabasePayload"]
      | undefined;
    createPostgresClusterUser?:
      | GraphQLTypes["CreatePostgresClusterUserPayload"]
      | undefined;
    createRelease?: GraphQLTypes["CreateReleasePayload"] | undefined;
    createTemplateDeployment?:
      | GraphQLTypes["CreateTemplateDeploymentPayload"]
      | undefined;
    createThirdPartyConfiguration?:
      | GraphQLTypes["CreateThirdPartyConfigurationPayload"]
      | undefined;
    createVolume?: GraphQLTypes["CreateVolumePayload"] | undefined;
    createVolumeSnapshot?:
      | GraphQLTypes["CreateVolumeSnapshotPayload"]
      | undefined;
    deleteAddOn?: GraphQLTypes["DeleteAddOnPayload"] | undefined;
    /** Delete an app */
    deleteApp?: GraphQLTypes["DeleteAppPayload"] | undefined;
    deleteCertificate?: GraphQLTypes["DeleteCertificatePayload"] | undefined;
    deleteDelegatedWireGuardToken?:
      | GraphQLTypes["DeleteDelegatedWireGuardTokenPayload"]
      | undefined;
    deleteDeploymentSource?:
      | GraphQLTypes["DeleteDeploymentSourcePayload"]
      | undefined;
    deleteDnsPortal?: GraphQLTypes["DeleteDNSPortalPayload"] | undefined;
    deleteDnsPortalSession?:
      | GraphQLTypes["DeleteDNSPortalSessionPayload"]
      | undefined;
    deleteDnsRecord?: GraphQLTypes["DeleteDNSRecordPayload"] | undefined;
    deleteDomain?: GraphQLTypes["DeleteDomainPayload"] | undefined;
    deleteHealthCheckHandler?:
      | GraphQLTypes["DeleteHealthCheckHandlerPayload"]
      | undefined;
    deleteLimitedAccessToken?:
      | GraphQLTypes["DeleteLimitedAccessTokenPayload"]
      | undefined;
    deleteOrganization?: GraphQLTypes["DeleteOrganizationPayload"] | undefined;
    deleteOrganizationInvitation?:
      | GraphQLTypes["DeleteOrganizationInvitationPayload"]
      | undefined;
    deleteOrganizationMembership?:
      | GraphQLTypes["DeleteOrganizationMembershipPayload"]
      | undefined;
    deleteRemoteBuilder?:
      | GraphQLTypes["DeleteRemoteBuilderPayload"]
      | undefined;
    deleteThirdPartyConfiguration?:
      | GraphQLTypes["DeleteThirdPartyConfigurationPayload"]
      | undefined;
    deleteVolume?: GraphQLTypes["DeleteVolumePayload"] | undefined;
    deployImage?: GraphQLTypes["DeployImagePayload"] | undefined;
    detachPostgresCluster?:
      | GraphQLTypes["DetachPostgresClusterPayload"]
      | undefined;
    dischargeRootToken?: GraphQLTypes["DischargeRootTokenPayload"] | undefined;
    dummyWireGuardPeer?: GraphQLTypes["DummyWireGuardPeerPayload"] | undefined;
    enablePostgresConsul?:
      | GraphQLTypes["EnablePostgresConsulPayload"]
      | undefined;
    ensureMachineRemoteBuilder?:
      | GraphQLTypes["EnsureMachineRemoteBuilderPayload"]
      | undefined;
    establishSshKey?: GraphQLTypes["EstablishSSHKeyPayload"] | undefined;
    exportDnsZone?: GraphQLTypes["ExportDNSZonePayload"] | undefined;
    extendVolume?: GraphQLTypes["ExtendVolumePayload"] | undefined;
    finishBuild?: GraphQLTypes["FinishBuildPayload"] | undefined;
    forkVolume?: GraphQLTypes["ForkVolumePayload"] | undefined;
    grantPostgresClusterUserAccess?:
      | GraphQLTypes["GrantPostgresClusterUserAccessPayload"]
      | undefined;
    importCertificate?: GraphQLTypes["ImportCertificatePayload"] | undefined;
    importDnsZone?: GraphQLTypes["ImportDNSZonePayload"] | undefined;
    issueCertificate?: GraphQLTypes["IssueCertificatePayload"] | undefined;
    killMachine?: GraphQLTypes["KillMachinePayload"] | undefined;
    launchMachine?: GraphQLTypes["LaunchMachinePayload"] | undefined;
    lockApp?: GraphQLTypes["LockAppPayload"] | undefined;
    logOut?: GraphQLTypes["LogOutPayload"] | undefined;
    moveApp?: GraphQLTypes["MoveAppPayload"] | undefined;
    nomadToMachinesMigration?:
      | GraphQLTypes["NomadToMachinesMigrationPayload"]
      | undefined;
    nomadToMachinesMigrationPrep?:
      | GraphQLTypes["NomadToMachinesMigrationPrepPayload"]
      | undefined;
    pauseApp?: GraphQLTypes["PauseAppPayload"] | undefined;
    registerDomain?: GraphQLTypes["RegisterDomainPayload"] | undefined;
    releaseIpAddress?: GraphQLTypes["ReleaseIPAddressPayload"] | undefined;
    removeMachine?: GraphQLTypes["RemoveMachinePayload"] | undefined;
    removeWireGuardPeer?:
      | GraphQLTypes["RemoveWireGuardPeerPayload"]
      | undefined;
    resetAddOnPassword?: GraphQLTypes["ResetAddOnPasswordPayload"] | undefined;
    restartAllocation?: GraphQLTypes["RestartAllocationPayload"] | undefined;
    restartApp?: GraphQLTypes["RestartAppPayload"] | undefined;
    restoreVolumeSnapshot?:
      | GraphQLTypes["RestoreVolumeSnapshotPayload"]
      | undefined;
    resumeApp?: GraphQLTypes["ResumeAppPayload"] | undefined;
    revokePostgresClusterUserAccess?:
      | GraphQLTypes["RevokePostgresClusterUserAccessPayload"]
      | undefined;
    saveDeploymentSource?:
      | GraphQLTypes["SaveDeploymentSourcePayload"]
      | undefined;
    scaleApp?: GraphQLTypes["ScaleAppPayload"] | undefined;
    setAppsV2DefaultOn?: GraphQLTypes["SetAppsv2DefaultOnPayload"] | undefined;
    setPagerdutyHandler?:
      | GraphQLTypes["SetPagerdutyHandlerPayload"]
      | undefined;
    setPlatformVersion?: GraphQLTypes["SetPlatformVersionPayload"] | undefined;
    setSecrets?: GraphQLTypes["SetSecretsPayload"] | undefined;
    setSlackHandler?: GraphQLTypes["SetSlackHandlerPayload"] | undefined;
    setVmCount?: GraphQLTypes["SetVMCountPayload"] | undefined;
    setVmSize?: GraphQLTypes["SetVMSizePayload"] | undefined;
    startBuild?: GraphQLTypes["StartBuildPayload"] | undefined;
    startMachine?: GraphQLTypes["StartMachinePayload"] | undefined;
    stopAllocation?: GraphQLTypes["StopAllocationPayload"] | undefined;
    stopMachine?: GraphQLTypes["StopMachinePayload"] | undefined;
    unlockApp?: GraphQLTypes["UnlockAppPayload"] | undefined;
    unsetSecrets?: GraphQLTypes["UnsetSecretsPayload"] | undefined;
    updateAddOn?: GraphQLTypes["UpdateAddOnPayload"] | undefined;
    updateAutoscaleConfig?:
      | GraphQLTypes["UpdateAutoscaleConfigPayload"]
      | undefined;
    updateDnsPortal?: GraphQLTypes["UpdateDNSPortalPayload"] | undefined;
    updateDnsRecord?: GraphQLTypes["UpdateDNSRecordPayload"] | undefined;
    updateDnsRecords?: GraphQLTypes["UpdateDNSRecordsPayload"] | undefined;
    updateOrganizationMembership?:
      | GraphQLTypes["UpdateOrganizationMembershipPayload"]
      | undefined;
    updateRelease?: GraphQLTypes["UpdateReleasePayload"] | undefined;
    updateRemoteBuilder?:
      | GraphQLTypes["UpdateRemoteBuilderPayload"]
      | undefined;
    updateThirdPartyConfiguration?:
      | GraphQLTypes["UpdateThirdPartyConfigurationPayload"]
      | undefined;
    validateWireGuardPeers?:
      | GraphQLTypes["ValidateWireGuardPeersPayload"]
      | undefined;
  };
  /** An object with an ID. */
  ["Node"]: {
    __typename:
      | "AccessToken"
      | "AddOn"
      | "AddOnPlan"
      | "Allocation"
      | "App"
      | "AppCertificate"
      | "AppChange"
      | "Build"
      | "Certificate"
      | "CheckHTTPResponse"
      | "CheckJob"
      | "CheckJobRun"
      | "DNSPortal"
      | "DNSPortalSession"
      | "DNSRecord"
      | "DelegatedWireGuardToken"
      | "Domain"
      | "Host"
      | "IPAddress"
      | "LimitedAccessToken"
      | "LoggedCertificate"
      | "Machine"
      | "MachineIP"
      | "Organization"
      | "OrganizationInvitation"
      | "PostgresClusterAttachment"
      | "Release"
      | "ReleaseCommand"
      | "ReleaseUnprocessed"
      | "Secret"
      | "TemplateDeployment"
      | "ThirdPartyConfiguration"
      | "User"
      | "UserCoupon"
      | "VM"
      | "Volume"
      | "VolumeSnapshot"
      | "WireGuardPeer";
    /** ID of the object. */
    id: string;
    ["...on AccessToken"]: "__union" & GraphQLTypes["AccessToken"];
    ["...on AddOn"]: "__union" & GraphQLTypes["AddOn"];
    ["...on AddOnPlan"]: "__union" & GraphQLTypes["AddOnPlan"];
    ["...on Allocation"]: "__union" & GraphQLTypes["Allocation"];
    ["...on App"]: "__union" & GraphQLTypes["App"];
    ["...on AppCertificate"]: "__union" & GraphQLTypes["AppCertificate"];
    ["...on AppChange"]: "__union" & GraphQLTypes["AppChange"];
    ["...on Build"]: "__union" & GraphQLTypes["Build"];
    ["...on Certificate"]: "__union" & GraphQLTypes["Certificate"];
    ["...on CheckHTTPResponse"]: "__union" & GraphQLTypes["CheckHTTPResponse"];
    ["...on CheckJob"]: "__union" & GraphQLTypes["CheckJob"];
    ["...on CheckJobRun"]: "__union" & GraphQLTypes["CheckJobRun"];
    ["...on DNSPortal"]: "__union" & GraphQLTypes["DNSPortal"];
    ["...on DNSPortalSession"]: "__union" & GraphQLTypes["DNSPortalSession"];
    ["...on DNSRecord"]: "__union" & GraphQLTypes["DNSRecord"];
    ["...on DelegatedWireGuardToken"]:
      & "__union"
      & GraphQLTypes["DelegatedWireGuardToken"];
    ["...on Domain"]: "__union" & GraphQLTypes["Domain"];
    ["...on Host"]: "__union" & GraphQLTypes["Host"];
    ["...on IPAddress"]: "__union" & GraphQLTypes["IPAddress"];
    ["...on LimitedAccessToken"]:
      & "__union"
      & GraphQLTypes["LimitedAccessToken"];
    ["...on LoggedCertificate"]: "__union" & GraphQLTypes["LoggedCertificate"];
    ["...on Machine"]: "__union" & GraphQLTypes["Machine"];
    ["...on MachineIP"]: "__union" & GraphQLTypes["MachineIP"];
    ["...on Organization"]: "__union" & GraphQLTypes["Organization"];
    ["...on OrganizationInvitation"]:
      & "__union"
      & GraphQLTypes["OrganizationInvitation"];
    ["...on PostgresClusterAttachment"]:
      & "__union"
      & GraphQLTypes["PostgresClusterAttachment"];
    ["...on Release"]: "__union" & GraphQLTypes["Release"];
    ["...on ReleaseCommand"]: "__union" & GraphQLTypes["ReleaseCommand"];
    ["...on ReleaseUnprocessed"]:
      & "__union"
      & GraphQLTypes["ReleaseUnprocessed"];
    ["...on Secret"]: "__union" & GraphQLTypes["Secret"];
    ["...on TemplateDeployment"]:
      & "__union"
      & GraphQLTypes["TemplateDeployment"];
    ["...on ThirdPartyConfiguration"]:
      & "__union"
      & GraphQLTypes["ThirdPartyConfiguration"];
    ["...on User"]: "__union" & GraphQLTypes["User"];
    ["...on UserCoupon"]: "__union" & GraphQLTypes["UserCoupon"];
    ["...on VM"]: "__union" & GraphQLTypes["VM"];
    ["...on Volume"]: "__union" & GraphQLTypes["Volume"];
    ["...on VolumeSnapshot"]: "__union" & GraphQLTypes["VolumeSnapshot"];
    ["...on WireGuardPeer"]: "__union" & GraphQLTypes["WireGuardPeer"];
  };
  /** Autogenerated input type of NomadToMachinesMigration */
  ["NomadToMachinesMigrationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to move */
    appId: string;
  };
  /** Autogenerated return type of NomadToMachinesMigration. */
  ["NomadToMachinesMigrationPayload"]: {
    __typename: "NomadToMachinesMigrationPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of NomadToMachinesMigrationPrep */
  ["NomadToMachinesMigrationPrepInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to move */
    appId: string;
  };
  /** Autogenerated return type of NomadToMachinesMigrationPrep. */
  ["NomadToMachinesMigrationPrepPayload"]: {
    __typename: "NomadToMachinesMigrationPrepPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  ["Organization"]: {
    __typename: "Organization";
    activeDiscountName?: string | undefined;
    /** Single sign-on link for the given integration type */
    addOnSsoLink?: string | undefined;
    /** List third party integrations associated with an organization */
    addOns: GraphQLTypes["AddOnConnection"];
    /** Check if the organization has agreed to the extension provider terms of service */
    agreedToProviderTos: boolean;
    apps: GraphQLTypes["AppConnection"];
    billable: boolean;
    billingStatus: GraphQLTypes["BillingStatus"];
    /** The account credits in cents */
    creditBalance: number;
    /** The formatted account credits */
    creditBalanceFormatted: string;
    delegatedWireGuardTokens: GraphQLTypes["DelegatedWireGuardTokenConnection"];
    /** Find a dns portal by name */
    dnsPortal: GraphQLTypes["DNSPortal"];
    dnsPortals: GraphQLTypes["DNSPortalConnection"];
    /** Find a domain by name */
    domain?: GraphQLTypes["Domain"] | undefined;
    domains: GraphQLTypes["DomainConnection"];
    /** Single sign-on link for the given extension type */
    extensionSsoLink?: string | undefined;
    healthCheckHandlers: GraphQLTypes["HealthCheckHandlerConnection"];
    healthChecks: GraphQLTypes["HealthCheckConnection"];
    id: string;
    internalNumericId: GraphQLTypes["BigInt"];
    invitations: GraphQLTypes["OrganizationInvitationConnection"];
    isCreditCardSaved: boolean;
    limitedAccessTokens: GraphQLTypes["LimitedAccessTokenConnection"];
    loggedCertificates?:
      | GraphQLTypes["LoggedCertificateConnection"]
      | undefined;
    members: GraphQLTypes["OrganizationMembershipsConnection"];
    /** Organization name */
    name: string;
    paidPlan: boolean;
    /** Whether the organization can provision beta extensions */
    provisionsBetaExtensions: boolean;
    /** Unmodified unique org slug */
    rawSlug: string;
    remoteBuilderApp?: GraphQLTypes["App"] | undefined;
    remoteBuilderImage: string;
    settings?: GraphQLTypes["JSON"] | undefined;
    /** Unique organization slug */
    slug: string;
    sshCertificate?: string | undefined;
    /** Configurations for third-party caveats to be issued on user macaroons */
    thirdPartyConfigurations: GraphQLTypes["ThirdPartyConfigurationConnection"];
    trust: GraphQLTypes["OrganizationTrust"];
    /** The type of organization */
    type: GraphQLTypes["OrganizationType"];
    /** The current user's role in the org */
    viewerRole: string;
    /** Find a peer by name */
    wireGuardPeer: GraphQLTypes["WireGuardPeer"];
    wireGuardPeers: GraphQLTypes["WireGuardPeerConnection"];
  };
  ["OrganizationAlertsEnabled"]: OrganizationAlertsEnabled;
  /** The connection type for Organization. */
  ["OrganizationConnection"]: {
    __typename: "OrganizationConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["OrganizationEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["Organization"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["OrganizationEdge"]: {
    __typename: "OrganizationEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["Organization"] | undefined;
  };
  ["OrganizationInvitation"]: {
    __typename: "OrganizationInvitation";
    createdAt: GraphQLTypes["ISO8601DateTime"];
    email: string;
    id: string;
    /** The user who created the invitation */
    inviter: GraphQLTypes["User"];
    organization: GraphQLTypes["Organization"];
    redeemed: boolean;
    redeemedAt?: GraphQLTypes["ISO8601DateTime"] | undefined;
  };
  /** The connection type for OrganizationInvitation. */
  ["OrganizationInvitationConnection"]: {
    __typename: "OrganizationInvitationConnection";
    /** A list of edges. */
    edges?:
      | Array<GraphQLTypes["OrganizationInvitationEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?:
      | Array<GraphQLTypes["OrganizationInvitation"] | undefined>
      | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["OrganizationInvitationEdge"]: {
    __typename: "OrganizationInvitationEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["OrganizationInvitation"] | undefined;
  };
  ["OrganizationMemberRole"]: OrganizationMemberRole;
  /** The connection type for User. */
  ["OrganizationMembershipsConnection"]: {
    __typename: "OrganizationMembershipsConnection";
    /** A list of edges. */
    edges?:
      | Array<GraphQLTypes["OrganizationMembershipsEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["User"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["OrganizationMembershipsEdge"]: {
    __typename: "OrganizationMembershipsEdge";
    /** The alerts settings the user has in this organization */
    alertsEnabled: GraphQLTypes["OrganizationAlertsEnabled"];
    /** A cursor for use in pagination. */
    cursor: string;
    /** The date the user joined the organization */
    joinedAt: GraphQLTypes["ISO8601DateTime"];
    /** The item at the end of the edge. */
    node?: GraphQLTypes["User"] | undefined;
    /** The role the user has in this organization */
    role: GraphQLTypes["OrganizationMemberRole"];
  };
  ["OrganizationTrust"]: OrganizationTrust;
  ["OrganizationType"]: OrganizationType;
  /** Information about pagination in a connection. */
  ["PageInfo"]: {
    __typename: "PageInfo";
    /** When paginating forwards, the cursor to continue. */
    endCursor?: string | undefined;
    /** When paginating forwards, are there more items? */
    hasNextPage: boolean;
    /** When paginating backwards, are there more items? */
    hasPreviousPage: boolean;
    /** When paginating backwards, the cursor to continue. */
    startCursor?: string | undefined;
  };
  /** Autogenerated input type of PauseApp */
  ["PauseAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of PauseApp. */
  ["PauseAppPayload"]: {
    __typename: "PauseAppPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  ["PlatformVersionEnum"]: PlatformVersionEnum;
  ["PostgresClusterAppRole"]: {
    __typename: "PostgresClusterAppRole";
    databases: Array<GraphQLTypes["PostgresClusterDatabase"]>;
    /** The name of this role */
    name: string;
    users: Array<GraphQLTypes["PostgresClusterUser"]>;
  };
  ["PostgresClusterAttachment"]: {
    __typename: "PostgresClusterAttachment";
    databaseName: string;
    databaseUser: string;
    environmentVariableName: string;
    id: string;
  };
  /** The connection type for PostgresClusterAttachment. */
  ["PostgresClusterAttachmentConnection"]: {
    __typename: "PostgresClusterAttachmentConnection";
    /** A list of edges. */
    edges?:
      | Array<GraphQLTypes["PostgresClusterAttachmentEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?:
      | Array<GraphQLTypes["PostgresClusterAttachment"] | undefined>
      | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["PostgresClusterAttachmentEdge"]: {
    __typename: "PostgresClusterAttachmentEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["PostgresClusterAttachment"] | undefined;
  };
  ["PostgresClusterDatabase"]: {
    __typename: "PostgresClusterDatabase";
    name: string;
    users: Array<string>;
  };
  ["PostgresClusterUser"]: {
    __typename: "PostgresClusterUser";
    databases: Array<string>;
    isSuperuser: boolean;
    username: string;
  };
  ["PriceTier"]: {
    __typename: "PriceTier";
    unitAmount?: string | undefined;
    upTo?: GraphQLTypes["BigInt"] | undefined;
  };
  ["Principal"]: {
    __typename: "Macaroon" | "User";
    /** URL for avatar or placeholder */
    avatarUrl: string;
    createdAt?: GraphQLTypes["ISO8601DateTime"] | undefined;
    /** Email address for principal */
    email: string;
    featureFlags?: Array<string> | undefined;
    hasNodeproxyApps?: boolean | undefined;
    id?: string | undefined;
    lastRegion?: string | undefined;
    /** Display name of principal */
    name?: string | undefined;
    organizations?: GraphQLTypes["OrganizationConnection"] | undefined;
    personalOrganization?: GraphQLTypes["Organization"] | undefined;
    trust: GraphQLTypes["OrganizationTrust"];
    twoFactorProtection?: boolean | undefined;
    username?: string | undefined;
    ["...on Macaroon"]: "__union" & GraphQLTypes["Macaroon"];
    ["...on User"]: "__union" & GraphQLTypes["User"];
  };
  ["ProcessGroup"]: {
    __typename: "ProcessGroup";
    maxPerRegion: number;
    name: string;
    regions: Array<string>;
    vmSize: GraphQLTypes["VMSize"];
  };
  ["Product"]: {
    __typename: "Product";
    name: string;
    tiers: Array<GraphQLTypes["PriceTier"]>;
    type: string;
    unitLabel?: string | undefined;
  };
  ["PropertyInput"]: {
    /** The name of the property */
    name: string;
    /** The value of the property */
    value?: string | undefined;
  };
  ["Queries"]: {
    __typename: "Queries";
    accessTokens: GraphQLTypes["AccessTokenConnection"];
    /** Find an add-on by ID or name */
    addOn?: GraphQLTypes["AddOn"] | undefined;
    /** List add-on service plans */
    addOnPlans: GraphQLTypes["AddOnPlanConnection"];
    addOnProvider: GraphQLTypes["AddOnProvider"];
    /** List add-ons associated with an organization */
    addOns: GraphQLTypes["AddOnConnection"];
    /** Find an app by name */
    app?: GraphQLTypes["App"] | undefined;
    /** List apps */
    apps: GraphQLTypes["AppConnection"];
    /** Verifies if an app can undergo a bluegreen deployment */
    canPerformBluegreenDeployment: boolean;
    /** Find a certificate by ID */
    certificate?: GraphQLTypes["AppCertificate"] | undefined;
    checkJobs: GraphQLTypes["CheckJobConnection"];
    checkLocations: Array<GraphQLTypes["CheckLocation"]>;
    currentUser: GraphQLTypes["User"];
    /** Find a domain by name */
    domain?: GraphQLTypes["Domain"] | undefined;
    githubIntegration: GraphQLTypes["GithubIntegration"];
    herokuIntegration: GraphQLTypes["HerokuIntegration"];
    /** Find an ip address by ID */
    ipAddress?: GraphQLTypes["IPAddress"] | undefined;
    /** Returns the latest available tag for a given image repository */
    latestImageDetails: GraphQLTypes["ImageVersion"];
    /** Returns the latest available tag for a given image repository */
    latestImageTag: string;
    /** Get a single machine */
    machine: GraphQLTypes["Machine"];
    /** List machines */
    machines: GraphQLTypes["MachineConnection"];
    nearestRegion: GraphQLTypes["Region"];
    /** Fetches an object given its ID. */
    node?: GraphQLTypes["Node"] | undefined;
    /** Fetches a list of objects given a list of IDs. */
    nodes: Array<GraphQLTypes["Node"] | undefined>;
    /** Find an organization by ID */
    organization?: GraphQLTypes["Organization"] | undefined;
    organizations: GraphQLTypes["OrganizationConnection"];
    personalOrganization: GraphQLTypes["Organization"];
    /** fly.io platform information */
    platform: GraphQLTypes["FlyPlatform"];
    /** List postgres attachments */
    postgresAttachments: GraphQLTypes["PostgresClusterAttachmentConnection"];
    /** Fly.io product and price information */
    products: Array<GraphQLTypes["Product"]>;
    /** Whether the authentication token only allows for user access */
    userOnlyToken: boolean;
    validateConfig: GraphQLTypes["AppConfig"];
    viewer: GraphQLTypes["Principal"];
    /** Find a persistent volume by ID */
    volume?: GraphQLTypes["Volume"] | undefined;
  };
  ["Region"]: {
    __typename: "Region";
    /** The IATA airport code for this region */
    code: string;
    gatewayAvailable: boolean;
    /** The latitude of this region */
    latitude?: number | undefined;
    /** The longitude of this region */
    longitude?: number | undefined;
    /** The name of this region */
    name: string;
    processGroup?: string | undefined;
    requiresPaidPlan: boolean;
  };
  ["RegionPlacement"]: {
    __typename: "RegionPlacement";
    /** The desired number of allocations */
    count?: number | undefined;
    /** The region code */
    region: string;
  };
  /** Autogenerated input type of RegisterDomain */
  ["RegisterDomainInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the domain */
    domainId: string;
    /** Enable whois privacy on the registration */
    whoisPrivacy?: boolean | undefined;
    /** Enable auto renew on the registration */
    autoRenew?: boolean | undefined;
  };
  /** Autogenerated return type of RegisterDomain. */
  ["RegisterDomainPayload"]: {
    __typename: "RegisterDomainPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: GraphQLTypes["Domain"];
  };
  ["Release"]: {
    __typename: "Release";
    config?: GraphQLTypes["AppConfig"] | undefined;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    deploymentStrategy: GraphQLTypes["DeploymentStrategy"];
    /** A description of the release */
    description: string;
    evaluationId?: string | undefined;
    /** Unique ID */
    id: string;
    /** Docker image */
    image?: GraphQLTypes["Image"] | undefined;
    /** Docker image URI */
    imageRef?: string | undefined;
    inProgress: boolean;
    /** The reason for the release */
    reason: string;
    /** Version release reverted to */
    revertedTo?: number | undefined;
    stable: boolean;
    /** The status of the release */
    status: string;
    updatedAt: GraphQLTypes["ISO8601DateTime"];
    /** The user who created the release */
    user?: GraphQLTypes["User"] | undefined;
    /** The version of the release */
    version: number;
  };
  ["ReleaseCommand"]: {
    __typename: "ReleaseCommand";
    app: GraphQLTypes["App"];
    command: string;
    evaluationId?: string | undefined;
    exitCode?: number | undefined;
    failed: boolean;
    id: string;
    inProgress: boolean;
    instanceId?: string | undefined;
    status: string;
    succeeded: boolean;
  };
  /** The connection type for Release. */
  ["ReleaseConnection"]: {
    __typename: "ReleaseConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["ReleaseEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["Release"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["ReleaseEdge"]: {
    __typename: "ReleaseEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["Release"] | undefined;
  };
  /** Autogenerated input type of ReleaseIPAddress */
  ["ReleaseIPAddressInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** The id of the ip address to release */
    ipAddressId?: string | undefined;
    ip?: string | undefined;
  };
  /** Autogenerated return type of ReleaseIPAddress. */
  ["ReleaseIPAddressPayload"]: {
    __typename: "ReleaseIPAddressPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  ["ReleaseUnprocessed"]: {
    __typename: "ReleaseUnprocessed";
    configDefinition?: GraphQLTypes["JSON"] | undefined;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    deploymentStrategy: GraphQLTypes["DeploymentStrategy"];
    /** A description of the release */
    description: string;
    evaluationId?: string | undefined;
    /** Unique ID */
    id: string;
    /** Docker image */
    image?: GraphQLTypes["Image"] | undefined;
    /** Docker image URI */
    imageRef?: string | undefined;
    inProgress: boolean;
    /** The reason for the release */
    reason: string;
    /** Version release reverted to */
    revertedTo?: number | undefined;
    stable: boolean;
    /** The status of the release */
    status: string;
    updatedAt: GraphQLTypes["ISO8601DateTime"];
    /** The user who created the release */
    user?: GraphQLTypes["User"] | undefined;
    /** The version of the release */
    version: number;
  };
  /** The connection type for ReleaseUnprocessed. */
  ["ReleaseUnprocessedConnection"]: {
    __typename: "ReleaseUnprocessedConnection";
    /** A list of edges. */
    edges?:
      | Array<GraphQLTypes["ReleaseUnprocessedEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["ReleaseUnprocessed"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["ReleaseUnprocessedEdge"]: {
    __typename: "ReleaseUnprocessedEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["ReleaseUnprocessed"] | undefined;
  };
  ["RemoteDockerBuilderAppRole"]: {
    __typename: "RemoteDockerBuilderAppRole";
    /** The name of this role */
    name: string;
  };
  /** Autogenerated input type of RemoveMachine */
  ["RemoveMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** machine id */
    id: string;
    /** force kill machine if it's running */
    kill?: boolean | undefined;
  };
  /** Autogenerated return type of RemoveMachine. */
  ["RemoveMachinePayload"]: {
    __typename: "RemoveMachinePayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: GraphQLTypes["Machine"];
  };
  /** Autogenerated input type of RemoveWireGuardPeer */
  ["RemoveWireGuardPeerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The name of the peer to remove */
    name: string;
    /** Add via NATS transaction (for testing only, nosy users) */
    nats?: boolean | undefined;
  };
  /** Autogenerated return type of RemoveWireGuardPeer. */
  ["RemoveWireGuardPeerPayload"]: {
    __typename: "RemoveWireGuardPeerPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The organization that owned the peer */
    organization: GraphQLTypes["Organization"];
  };
  /** Autogenerated input type of ResetAddOnPassword */
  ["ResetAddOnPasswordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the add-on whose password should be reset */
    name: string;
  };
  /** Autogenerated return type of ResetAddOnPassword. */
  ["ResetAddOnPasswordPayload"]: {
    __typename: "ResetAddOnPasswordPayload";
    addOn: GraphQLTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of RestartAllocation */
  ["RestartAllocationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** The ID of the app */
    allocId: string;
  };
  /** Autogenerated return type of RestartAllocation. */
  ["RestartAllocationPayload"]: {
    __typename: "RestartAllocationPayload";
    allocation: GraphQLTypes["Allocation"];
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of RestartApp */
  ["RestartAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of RestartApp. */
  ["RestartAppPayload"]: {
    __typename: "RestartAppPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of RestoreVolumeSnapshot */
  ["RestoreVolumeSnapshotInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    volumeId: string;
    snapshotId: string;
  };
  /** Autogenerated return type of RestoreVolumeSnapshot. */
  ["RestoreVolumeSnapshotPayload"]: {
    __typename: "RestoreVolumeSnapshotPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    snapshot: GraphQLTypes["VolumeSnapshot"];
    volume: GraphQLTypes["Volume"];
  };
  /** Autogenerated input type of ResumeApp */
  ["ResumeAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of ResumeApp. */
  ["ResumeAppPayload"]: {
    __typename: "ResumeAppPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of RevokePostgresClusterUserAccess */
  ["RevokePostgresClusterUserAccessInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The name of the postgres cluster app */
    appName: string;
    /** The username to revoke */
    username: string;
    /** The database to revoke access to */
    databaseName: string;
  };
  /** Autogenerated return type of RevokePostgresClusterUserAccess. */
  ["RevokePostgresClusterUserAccessPayload"]: {
    __typename: "RevokePostgresClusterUserAccessPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    database: GraphQLTypes["PostgresClusterDatabase"];
    postgresClusterRole: GraphQLTypes["PostgresClusterAppRole"];
    user: GraphQLTypes["PostgresClusterUser"];
  };
  ["RuntimeType"]: RuntimeType;
  /** Autogenerated input type of SaveDeploymentSource */
  ["SaveDeploymentSourceInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The application to update */
    appId: string;
    provider: string;
    repositoryId: string;
    ref?: string | undefined;
    baseDir?: string | undefined;
    skipBuild?: boolean | undefined;
  };
  /** Autogenerated return type of SaveDeploymentSource. */
  ["SaveDeploymentSourcePayload"]: {
    __typename: "SaveDeploymentSourcePayload";
    app?: GraphQLTypes["App"] | undefined;
    build?: GraphQLTypes["Build"] | undefined;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of ScaleApp */
  ["ScaleAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Regions to scale */
    regions: Array<GraphQLTypes["ScaleRegionInput"]>;
  };
  /** Autogenerated return type of ScaleApp. */
  ["ScaleAppPayload"]: {
    __typename: "ScaleAppPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    delta: Array<GraphQLTypes["ScaleRegionChange"]>;
    placement: Array<GraphQLTypes["RegionPlacement"]>;
  };
  ["ScaleRegionChange"]: {
    __typename: "ScaleRegionChange";
    /** The original value */
    fromCount: number;
    /** The region code */
    region: string;
    /** The new value */
    toCount?: number | undefined;
  };
  /** Region placement configuration */
  ["ScaleRegionInput"]: {
    /** The region to configure */
    region: string;
    /** The value to change by */
    count: number;
  };
  ["Secret"]: {
    __typename: "Secret";
    createdAt: GraphQLTypes["ISO8601DateTime"];
    /** The digest of the secret value */
    digest: string;
    id: string;
    /** The name of the secret */
    name: string;
    /** The user who initiated the deployment */
    user?: GraphQLTypes["User"] | undefined;
  };
  /** A secure configuration value */
  ["SecretInput"]: {
    /** The unqiue key for this secret */
    key: string;
    /** The value of this secret */
    value: string;
  };
  /** Global port routing */
  ["Service"]: {
    __typename: "Service";
    /** Health checks */
    checks: Array<GraphQLTypes["Check"]>;
    description: string;
    /** Hard concurrency limit */
    hardConcurrency: number;
    /** Application port to forward traffic to */
    internalPort: number;
    /** Ports to listen on */
    ports: Array<GraphQLTypes["ServicePort"]>;
    /** Protocol to listen on */
    protocol: GraphQLTypes["ServiceProtocolType"];
    /** Soft concurrency limit */
    softConcurrency: number;
  };
  ["ServiceHandlerType"]: ServiceHandlerType;
  /** Global port routing */
  ["ServiceInput"]: {
    /** Protocol to listen on */
    protocol: GraphQLTypes["ServiceProtocolType"];
    /** Ports to listen on */
    ports?: Array<GraphQLTypes["ServiceInputPort"]> | undefined;
    /** Application port to forward traffic to */
    internalPort: number;
    /** Health checks */
    checks?: Array<GraphQLTypes["CheckInput"]> | undefined;
    /** Soft concurrency limit */
    softConcurrency?: number | undefined;
    /** Hard concurrency limit */
    hardConcurrency?: number | undefined;
  };
  /** Service port */
  ["ServiceInputPort"]: {
    /** Port to listen on */
    port: number;
    /** Handlers to apply before forwarding service traffic */
    handlers?: Array<GraphQLTypes["ServiceHandlerType"]> | undefined;
    /** tls options */
    tlsOptions?: GraphQLTypes["ServicePortTlsOptionsInput"] | undefined;
  };
  /** Service port */
  ["ServicePort"]: {
    __typename: "ServicePort";
    /** End port for range */
    endPort?: number | undefined;
    /** Handlers to apply before forwarding service traffic */
    handlers: Array<GraphQLTypes["ServiceHandlerType"]>;
    /** Port to listen on */
    port?: number | undefined;
    /** Start port for range */
    startPort?: number | undefined;
  };
  /** TLS handshakes options for a port */
  ["ServicePortTlsOptionsInput"]: {
    defaultSelfSigned?: boolean | undefined;
  };
  ["ServiceProtocolType"]: ServiceProtocolType;
  /** Autogenerated input type of SetAppsv2DefaultOn */
  ["SetAppsv2DefaultOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The organization slug */
    organizationSlug: string;
    /** Whether or not new apps in this org use Apps V2 by default */
    defaultOn: boolean;
  };
  /** Autogenerated return type of SetAppsv2DefaultOn. */
  ["SetAppsv2DefaultOnPayload"]: {
    __typename: "SetAppsv2DefaultOnPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: GraphQLTypes["Organization"];
  };
  /** Autogenerated input type of SetPagerdutyHandler */
  ["SetPagerdutyHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Handler name */
    name: string;
    /** PagerDuty API token */
    pagerdutyToken: string;
    /** Map of alert severity levels to PagerDuty severity levels */
    pagerdutyStatusMap?: GraphQLTypes["JSON"] | undefined;
  };
  /** Autogenerated return type of SetPagerdutyHandler. */
  ["SetPagerdutyHandlerPayload"]: {
    __typename: "SetPagerdutyHandlerPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    handler: GraphQLTypes["HealthCheckHandler"];
  };
  /** Autogenerated input type of SetPlatformVersion */
  ["SetPlatformVersionInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** nomad or machines */
    platformVersion: string;
    /** Unique lock ID */
    lockId?: string | undefined;
  };
  /** Autogenerated return type of SetPlatformVersion. */
  ["SetPlatformVersionPayload"]: {
    __typename: "SetPlatformVersionPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of SetSecrets */
  ["SetSecretsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Secrets to set */
    secrets: Array<GraphQLTypes["SecretInput"]>;
    /** By default, we set only the secrets you specify. Set this to true to replace all secrets. */
    replaceAll?: boolean | undefined;
  };
  /** Autogenerated return type of SetSecrets. */
  ["SetSecretsPayload"]: {
    __typename: "SetSecretsPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release?: GraphQLTypes["Release"] | undefined;
  };
  /** Autogenerated input type of SetSlackHandler */
  ["SetSlackHandlerInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Handler name */
    name: string;
    /** Slack Webhook URL to use for health check notifications */
    slackWebhookUrl: string;
    /** Slack channel to send messages to, defaults to #general */
    slackChannel?: string | undefined;
    /** User name to display on Slack Messages (defaults to Fly) */
    slackUsername?: string | undefined;
    /** Icon to show with Slack messages */
    slackIconUrl?: string | undefined;
  };
  /** Autogenerated return type of SetSlackHandler. */
  ["SetSlackHandlerPayload"]: {
    __typename: "SetSlackHandlerPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    handler: GraphQLTypes["HealthCheckHandler"];
  };
  /** Autogenerated input type of SetVMCount */
  ["SetVMCountInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Counts for VM groups */
    groupCounts: Array<GraphQLTypes["VMCountInput"]>;
    /** Unique lock ID */
    lockId?: string | undefined;
  };
  /** Autogenerated return type of SetVMCount. */
  ["SetVMCountPayload"]: {
    __typename: "SetVMCountPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release?: GraphQLTypes["Release"] | undefined;
    taskGroupCounts: Array<GraphQLTypes["TaskGroupCount"]>;
    warnings: Array<string>;
  };
  /** Autogenerated input type of SetVMSize */
  ["SetVMSizeInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** The name of the vm size to set */
    sizeName: string;
    /** Optionally request more memory */
    memoryMb?: number | undefined;
    /** Process group to modify */
    group?: string | undefined;
  };
  /** Autogenerated return type of SetVMSize. */
  ["SetVMSizePayload"]: {
    __typename: "SetVMSizePayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** Process Group scale change applied to (if any) */
    processGroup?: GraphQLTypes["ProcessGroup"] | undefined;
    /** Default app vm size */
    vmSize?: GraphQLTypes["VMSize"] | undefined;
  };
  /** Autogenerated input type of StartBuild */
  ["StartBuildInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
  };
  /** Autogenerated return type of StartBuild. */
  ["StartBuildPayload"]: {
    __typename: "StartBuildPayload";
    build: GraphQLTypes["Build"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of StartMachine */
  ["StartMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** machine id */
    id: string;
  };
  /** Autogenerated return type of StartMachine. */
  ["StartMachinePayload"]: {
    __typename: "StartMachinePayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: GraphQLTypes["Machine"];
  };
  /** Autogenerated input type of StopAllocation */
  ["StopAllocationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** The ID of the app */
    allocId: string;
  };
  /** Autogenerated return type of StopAllocation. */
  ["StopAllocationPayload"]: {
    __typename: "StopAllocationPayload";
    allocation: GraphQLTypes["Allocation"];
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of StopMachine */
  ["StopMachineInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId?: string | undefined;
    /** machine id */
    id: string;
    /** signal to send the machine */
    signal?: string | undefined;
    /** how long to wait before force killing the machine */
    killTimeoutSecs?: number | undefined;
  };
  /** Autogenerated return type of StopMachine. */
  ["StopMachinePayload"]: {
    __typename: "StopMachinePayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    machine: GraphQLTypes["Machine"];
  };
  ["TaskGroupCount"]: {
    __typename: "TaskGroupCount";
    count: number;
    name: string;
  };
  ["TemplateDeployment"]: {
    __typename: "TemplateDeployment";
    apps: GraphQLTypes["AppConnection"];
    id: string;
    organization: GraphQLTypes["Organization"];
    status: string;
  };
  /** Configuration for third-party caveats to be added to user macaroons */
  ["ThirdPartyConfiguration"]: {
    __typename: "ThirdPartyConfiguration";
    /** Restrictions to be placed on third-party caveats */
    caveats?: GraphQLTypes["CaveatSet"] | undefined;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel: GraphQLTypes["ThirdPartyConfigurationLevel"];
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel: GraphQLTypes["ThirdPartyConfigurationLevel"];
    id: string;
    /** Location URL of the third-party service capable of discharging */
    location: string;
    /** Friendly name for this configuration */
    name: string;
    /** Organization that owns this third party configuration */
    organization: GraphQLTypes["Organization"];
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel: GraphQLTypes["ThirdPartyConfigurationLevel"];
    updatedAt: GraphQLTypes["ISO8601DateTime"];
  };
  /** The connection type for ThirdPartyConfiguration. */
  ["ThirdPartyConfigurationConnection"]: {
    __typename: "ThirdPartyConfigurationConnection";
    /** A list of edges. */
    edges?:
      | Array<GraphQLTypes["ThirdPartyConfigurationEdge"] | undefined>
      | undefined;
    /** A list of nodes. */
    nodes?:
      | Array<GraphQLTypes["ThirdPartyConfiguration"] | undefined>
      | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["ThirdPartyConfigurationEdge"]: {
    __typename: "ThirdPartyConfigurationEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["ThirdPartyConfiguration"] | undefined;
  };
  ["ThirdPartyConfigurationLevel"]: ThirdPartyConfigurationLevel;
  /** Autogenerated input type of UnlockApp */
  ["UnlockAppInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Unique lock ID */
    lockId: string;
  };
  /** Autogenerated return type of UnlockApp. */
  ["UnlockAppPayload"]: {
    __typename: "UnlockAppPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of UnsetSecrets */
  ["UnsetSecretsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    /** Secret keys to unset */
    keys: Array<string>;
  };
  /** Autogenerated return type of UnsetSecrets. */
  ["UnsetSecretsPayload"]: {
    __typename: "UnsetSecretsPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release?: GraphQLTypes["Release"] | undefined;
  };
  /** Autogenerated input type of UpdateAddOn */
  ["UpdateAddOnInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The add-on ID to update */
    addOnId?: string | undefined;
    /** The add-on name to update */
    name?: string | undefined;
    /** The add-on plan ID */
    planId?: string | undefined;
    /** Options specific to the add-on */
    options?: GraphQLTypes["JSON"] | undefined;
    /** Desired regions to place replicas in */
    readRegions?: Array<string> | undefined;
  };
  /** Autogenerated return type of UpdateAddOn. */
  ["UpdateAddOnPayload"]: {
    __typename: "UpdateAddOnPayload";
    addOn: GraphQLTypes["AddOn"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of UpdateAutoscaleConfig */
  ["UpdateAutoscaleConfigInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the app */
    appId: string;
    enabled?: boolean | undefined;
    minCount?: number | undefined;
    maxCount?: number | undefined;
    balanceRegions?: boolean | undefined;
    /** Region configs */
    regions?: Array<GraphQLTypes["AutoscaleRegionConfigInput"]> | undefined;
    resetRegions?: boolean | undefined;
  };
  /** Autogenerated return type of UpdateAutoscaleConfig. */
  ["UpdateAutoscaleConfigPayload"]: {
    __typename: "UpdateAutoscaleConfigPayload";
    app: GraphQLTypes["App"];
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
  };
  /** Autogenerated input type of UpdateDNSPortal */
  ["UpdateDNSPortalInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    dnsPortalId: string;
    /** The unique name of this portal. */
    name?: string | undefined;
    /** The title of this portal */
    title?: string | undefined;
    /** The return url for this portal */
    returnUrl?: string | undefined;
    /** The text to display for the return url link */
    returnUrlText?: string | undefined;
    /** The support url for this portal */
    supportUrl?: string | undefined;
    /** The text to display for the support url link */
    supportUrlText?: string | undefined;
    /** The primary branding color */
    primaryColor?: string | undefined;
    /** The secondary branding color */
    accentColor?: string | undefined;
  };
  /** Autogenerated return type of UpdateDNSPortal. */
  ["UpdateDNSPortalPayload"]: {
    __typename: "UpdateDNSPortalPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    dnsPortal: GraphQLTypes["DNSPortal"];
  };
  /** Autogenerated input type of UpdateDNSRecord */
  ["UpdateDNSRecordInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the DNS record */
    recordId: string;
    /** The dns record name */
    name?: string | undefined;
    /** The TTL in seconds */
    ttl?: number | undefined;
    /** The content of the record */
    rdata?: string | undefined;
  };
  /** Autogenerated return type of UpdateDNSRecord. */
  ["UpdateDNSRecordPayload"]: {
    __typename: "UpdateDNSRecordPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    record: GraphQLTypes["DNSRecord"];
  };
  /** Autogenerated input type of UpdateDNSRecords */
  ["UpdateDNSRecordsInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the domain */
    domainId: string;
    changes: Array<GraphQLTypes["DNSRecordChangeInput"]>;
  };
  /** Autogenerated return type of UpdateDNSRecords. */
  ["UpdateDNSRecordsPayload"]: {
    __typename: "UpdateDNSRecordsPayload";
    changes: Array<GraphQLTypes["DNSRecordDiff"]>;
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    domain: GraphQLTypes["Domain"];
    warnings: Array<GraphQLTypes["DNSRecordWarning"]>;
  };
  /** Autogenerated input type of UpdateOrganizationMembership */
  ["UpdateOrganizationMembershipInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** The node ID of the user */
    userId: string;
    /** The new role for the user */
    role: GraphQLTypes["OrganizationMemberRole"];
    /** The new alert settings for the user */
    alertsEnabled?: GraphQLTypes["OrganizationAlertsEnabled"] | undefined;
  };
  /** Autogenerated return type of UpdateOrganizationMembership. */
  ["UpdateOrganizationMembershipPayload"]: {
    __typename: "UpdateOrganizationMembershipPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: GraphQLTypes["Organization"];
    user: GraphQLTypes["User"];
  };
  /** Autogenerated input type of UpdateRelease */
  ["UpdateReleaseInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The ID of the release */
    releaseId: string;
    /** The new status for the release */
    status: string;
  };
  /** Autogenerated return type of UpdateRelease. */
  ["UpdateReleasePayload"]: {
    __typename: "UpdateReleasePayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    release: GraphQLTypes["Release"];
  };
  /** Autogenerated input type of UpdateRemoteBuilder */
  ["UpdateRemoteBuilderInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the organization */
    organizationId: string;
    /** Docker image reference */
    image: string;
  };
  /** Autogenerated return type of UpdateRemoteBuilder. */
  ["UpdateRemoteBuilderPayload"]: {
    __typename: "UpdateRemoteBuilderPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    organization: GraphQLTypes["Organization"];
  };
  /** Autogenerated input type of UpdateThirdPartyConfiguration */
  ["UpdateThirdPartyConfigurationInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    /** The node ID of the configuration */
    thirdPartyConfigurationId: string;
    /** Friendly name for this configuration */
    name?: string | undefined;
    /** Location URL of the third-party service capable of discharging */
    location?: string | undefined;
    /** Restrictions to be placed on third-party caveats */
    caveats?: GraphQLTypes["CaveatSet"] | undefined;
    /** Whether to add this third-party caveat on session tokens issued to flyctl */
    flyctlLevel?: GraphQLTypes["ThirdPartyConfigurationLevel"] | undefined;
    /** Whether to add this third-party caveat on Fly.io session tokens */
    uiexLevel?: GraphQLTypes["ThirdPartyConfigurationLevel"] | undefined;
    /** Whether to add this third-party caveat on tokens issued via `flyctl tokens create` */
    customLevel?: GraphQLTypes["ThirdPartyConfigurationLevel"] | undefined;
  };
  /** Autogenerated return type of UpdateThirdPartyConfiguration. */
  ["UpdateThirdPartyConfigurationPayload"]: {
    __typename: "UpdateThirdPartyConfigurationPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    thirdPartyConfiguration: GraphQLTypes["ThirdPartyConfiguration"];
  };
  ["User"]: {
    __typename: "User";
    /** Check if the organization has agreed to the extension provider terms of service */
    agreedToProviderTos: boolean;
    /** URL for avatar or placeholder */
    avatarUrl: string;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    /** Email address for user (private) */
    email: string;
    /** Whether to create new organizations under Hobby plan */
    enablePaidHobby: boolean;
    featureFlags: Array<string>;
    hasNodeproxyApps: boolean;
    id: string;
    internalNumericId: number;
    lastRegion?: string | undefined;
    /** Display / full name for user (private) */
    name?: string | undefined;
    organizations: GraphQLTypes["OrganizationConnection"];
    personalOrganization: GraphQLTypes["Organization"];
    trust: GraphQLTypes["OrganizationTrust"];
    twoFactorProtection: boolean;
    /** Public username for user */
    username?: string | undefined;
  };
  ["UserCoupon"]: {
    __typename: "UserCoupon";
    createdAt: GraphQLTypes["ISO8601DateTime"];
    id: string;
    /** Organization that owns this app */
    organization: GraphQLTypes["Organization"];
    updatedAt: GraphQLTypes["ISO8601DateTime"];
  };
  ["VM"]: {
    __typename: "VM";
    attachedVolumes: GraphQLTypes["VolumeConnection"];
    canary: boolean;
    checks: Array<GraphQLTypes["CheckState"]>;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    criticalCheckCount: number;
    /** Desired status */
    desiredStatus: string;
    events: Array<GraphQLTypes["AllocationEvent"]>;
    failed: boolean;
    healthy: boolean;
    /** Unique ID for this instance */
    id: string;
    /** Short unique ID for this instance */
    idShort: string;
    /** Indicates if this instance is from the latest job version */
    latestVersion: boolean;
    passingCheckCount: number;
    /** Private IPv6 address for this instance */
    privateIP?: string | undefined;
    recentLogs: Array<GraphQLTypes["LogEntry"]>;
    /** Region this allocation is running in */
    region: string;
    restarts: number;
    /** Current status */
    status: string;
    taskName: string;
    totalCheckCount: number;
    transitioning: boolean;
    updatedAt: GraphQLTypes["ISO8601DateTime"];
    /** The configuration version of this instance */
    version: number;
    warningCheckCount: number;
  };
  /** The connection type for VM. */
  ["VMConnection"]: {
    __typename: "VMConnection";
    activeCount: number;
    completeCount: number;
    /** A list of edges. */
    edges?: Array<GraphQLTypes["VMEdge"] | undefined> | undefined;
    failedCount: number;
    inactiveCount: number;
    lostCount: number;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["VM"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    pendingCount: number;
    runningCount: number;
    totalCount: number;
  };
  ["VMCountInput"]: {
    /** VM group name */
    group?: string | undefined;
    /** The desired count */
    count?: number | undefined;
    /** Max number of VMs to allow per region */
    maxPerRegion?: number | undefined;
  };
  /** An edge in a connection. */
  ["VMEdge"]: {
    __typename: "VMEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["VM"] | undefined;
  };
  ["VMSize"]: {
    __typename: "VMSize";
    cpuCores: number;
    maxMemoryMb: number;
    memoryGb: number;
    memoryIncrementsMb: Array<number>;
    memoryMb: number;
    name: string;
    priceMonth: number;
    priceSecond: number;
  };
  /** Autogenerated input type of ValidateWireGuardPeers */
  ["ValidateWireGuardPeersInput"]: {
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    peerIps: Array<string>;
  };
  /** Autogenerated return type of ValidateWireGuardPeers. */
  ["ValidateWireGuardPeersPayload"]: {
    __typename: "ValidateWireGuardPeersPayload";
    /** A unique identifier for the client performing the mutation. */
    clientMutationId?: string | undefined;
    invalidPeerIps: Array<string>;
    validPeerIps: Array<string>;
  };
  ["Volume"]: {
    __typename: "Volume";
    app: GraphQLTypes["App"];
    attachedAllocation?: GraphQLTypes["Allocation"] | undefined;
    attachedAllocationId?: string | undefined;
    attachedMachine?: GraphQLTypes["Machine"] | undefined;
    createdAt: GraphQLTypes["ISO8601DateTime"];
    encrypted: boolean;
    host: GraphQLTypes["Host"];
    id: string;
    internalId: string;
    name: string;
    region: string;
    sizeGb: number;
    snapshots: GraphQLTypes["VolumeSnapshotConnection"];
    state: string;
    status: string;
    usedBytes: GraphQLTypes["BigInt"];
  };
  /** The connection type for Volume. */
  ["VolumeConnection"]: {
    __typename: "VolumeConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["VolumeEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["Volume"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["VolumeEdge"]: {
    __typename: "VolumeEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["Volume"] | undefined;
  };
  ["VolumeSnapshot"]: {
    __typename: "VolumeSnapshot";
    createdAt: GraphQLTypes["ISO8601DateTime"];
    digest: string;
    id: string;
    size: GraphQLTypes["BigInt"];
    volume: GraphQLTypes["Volume"];
  };
  /** The connection type for VolumeSnapshot. */
  ["VolumeSnapshotConnection"]: {
    __typename: "VolumeSnapshotConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["VolumeSnapshotEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["VolumeSnapshot"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["VolumeSnapshotEdge"]: {
    __typename: "VolumeSnapshotEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["VolumeSnapshot"] | undefined;
  };
  ["WireGuardPeer"]: {
    __typename: "WireGuardPeer";
    id: string;
    name: string;
    network?: string | undefined;
    peerip: string;
    pubkey: string;
    region: string;
  };
  /** The connection type for WireGuardPeer. */
  ["WireGuardPeerConnection"]: {
    __typename: "WireGuardPeerConnection";
    /** A list of edges. */
    edges?: Array<GraphQLTypes["WireGuardPeerEdge"] | undefined> | undefined;
    /** A list of nodes. */
    nodes?: Array<GraphQLTypes["WireGuardPeer"] | undefined> | undefined;
    /** Information to aid in pagination. */
    pageInfo: GraphQLTypes["PageInfo"];
    totalCount: number;
  };
  /** An edge in a connection. */
  ["WireGuardPeerEdge"]: {
    __typename: "WireGuardPeerEdge";
    /** A cursor for use in pagination. */
    cursor: string;
    /** The item at the end of the edge. */
    node?: GraphQLTypes["WireGuardPeer"] | undefined;
  };
};
export const enum AccessTokenType {
  flyctl = "flyctl",
  ui = "ui",
  pat = "pat",
  grafana = "grafana",
  all = "all",
  sentry = "sentry",
  token = "token",
}
export const enum AddOnType {
  redis = "redis",
  upstash_redis = "upstash_redis",
  sentry = "sentry",
  planetscale = "planetscale",
  kubernetes = "kubernetes",
  supabase = "supabase",
  tigris = "tigris",
}
export const enum AppState {
  PENDING = "PENDING",
  DEPLOYED = "DEPLOYED",
  SUSPENDED = "SUSPENDED",
}
export const enum AutoscaleStrategy {
  NONE = "NONE",
  PREFERRED_REGIONS = "PREFERRED_REGIONS",
  CONNECTION_SOURCES = "CONNECTION_SOURCES",
}
export const enum BillingStatus {
  CURRENT = "CURRENT",
  SOURCE_REQUIRED = "SOURCE_REQUIRED",
  PAST_DUE = "PAST_DUE",
}
/** All available http checks verbs */
export const enum CheckHTTPVerb {
  GET = "GET",
  HEAD = "HEAD",
}
export const enum CheckType {
  TCP = "TCP",
  HTTP = "HTTP",
  SCRIPT = "SCRIPT",
}
export const enum DNSRecordChangeAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
}
export const enum DNSRecordType {
  A = "A",
  AAAA = "AAAA",
  ALIAS = "ALIAS",
  CNAME = "CNAME",
  MX = "MX",
  NS = "NS",
  SOA = "SOA",
  TXT = "TXT",
  SRV = "SRV",
}
export const enum DeploymentStrategy {
  IMMEDIATE = "IMMEDIATE",
  SIMPLE = "SIMPLE",
  ROLLING = "ROLLING",
  ROLLING_ONE = "ROLLING_ONE",
  CANARY = "CANARY",
  BLUEGREEN = "BLUEGREEN",
}
export const enum DomainDNSStatus {
  PENDING = "PENDING",
  UPDATING = "UPDATING",
  READY = "READY",
}
export const enum DomainRegistrationStatus {
  UNMANAGED = "UNMANAGED",
  REGISTERING = "REGISTERING",
  REGISTERED = "REGISTERED",
  TRANSFERRING = "TRANSFERRING",
  EXPIRED = "EXPIRED",
}
export const enum FsTypeType {
  ext4 = "ext4",
  raw = "raw",
}
export const enum HTTPMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  HEAD = "HEAD",
  DELETE = "DELETE",
}
export const enum HTTPProtocol {
  HTTP = "HTTP",
  HTTPS = "HTTPS",
}
export const enum IPAddressType {
  v4 = "v4",
  v6 = "v6",
  private_v6 = "private_v6",
  shared_v4 = "shared_v4",
}
export const enum OrganizationAlertsEnabled {
  ENABLED = "ENABLED",
  NOT_ENABLED = "NOT_ENABLED",
}
export const enum OrganizationMemberRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}
export const enum OrganizationTrust {
  UNKNOWN = "UNKNOWN",
  RESTRICTED = "RESTRICTED",
  BANNED = "BANNED",
  LOW = "LOW",
  HIGH = "HIGH",
}
export const enum OrganizationType {
  PERSONAL = "PERSONAL",
  SHARED = "SHARED",
}
export const enum PlatformVersionEnum {
  nomad = "nomad",
  machines = "machines",
  detached = "detached",
}
export const enum RuntimeType {
  FIRECRACKER = "FIRECRACKER",
  NODEPROXY = "NODEPROXY",
}
export const enum ServiceHandlerType {
  TLS = "TLS",
  PG_TLS = "PG_TLS",
  HTTP = "HTTP",
  EDGE_HTTP = "EDGE_HTTP",
  PROXY_PROTO = "PROXY_PROTO",
}
export const enum ServiceProtocolType {
  TCP = "TCP",
  UDP = "UDP",
}
export const enum ThirdPartyConfigurationLevel {
  DISABLED = "DISABLED",
  OPT_IN = "OPT_IN",
  MEMBER_OPT_OUT = "MEMBER_OPT_OUT",
  ADMIN_OPT_OUT = "ADMIN_OPT_OUT",
  REQUIRED = "REQUIRED",
}

type ZEUS_VARIABLES = {
  ["AccessTokenType"]: ValueTypes["AccessTokenType"];
  ["AddOnType"]: ValueTypes["AddOnType"];
  ["AddWireGuardPeerInput"]: ValueTypes["AddWireGuardPeerInput"];
  ["AllocateIPAddressInput"]: ValueTypes["AllocateIPAddressInput"];
  ["AppState"]: ValueTypes["AppState"];
  ["AttachPostgresClusterInput"]: ValueTypes["AttachPostgresClusterInput"];
  ["AutoscaleRegionConfigInput"]: ValueTypes["AutoscaleRegionConfigInput"];
  ["AutoscaleStrategy"]: ValueTypes["AutoscaleStrategy"];
  ["BigInt"]: ValueTypes["BigInt"];
  ["BillingStatus"]: ValueTypes["BillingStatus"];
  ["BuildFinalImageInput"]: ValueTypes["BuildFinalImageInput"];
  ["BuildImageOptsInput"]: ValueTypes["BuildImageOptsInput"];
  ["BuildStrategyAttemptInput"]: ValueTypes["BuildStrategyAttemptInput"];
  ["BuildTimingsInput"]: ValueTypes["BuildTimingsInput"];
  ["BuilderMetaInput"]: ValueTypes["BuilderMetaInput"];
  ["CaveatSet"]: ValueTypes["CaveatSet"];
  ["CheckCertificateInput"]: ValueTypes["CheckCertificateInput"];
  ["CheckDomainInput"]: ValueTypes["CheckDomainInput"];
  ["CheckHTTPVerb"]: ValueTypes["CheckHTTPVerb"];
  ["CheckHeaderInput"]: ValueTypes["CheckHeaderInput"];
  ["CheckInput"]: ValueTypes["CheckInput"];
  ["CheckJobHTTPOptionsInput"]: ValueTypes["CheckJobHTTPOptionsInput"];
  ["CheckType"]: ValueTypes["CheckType"];
  ["ConfigureRegionsInput"]: ValueTypes["ConfigureRegionsInput"];
  ["CreateAddOnInput"]: ValueTypes["CreateAddOnInput"];
  ["CreateAndRegisterDomainInput"]: ValueTypes["CreateAndRegisterDomainInput"];
  ["CreateAndTransferDomainInput"]: ValueTypes["CreateAndTransferDomainInput"];
  ["CreateAppInput"]: ValueTypes["CreateAppInput"];
  ["CreateBuildInput"]: ValueTypes["CreateBuildInput"];
  ["CreateCheckJobInput"]: ValueTypes["CreateCheckJobInput"];
  ["CreateCheckJobRunInput"]: ValueTypes["CreateCheckJobRunInput"];
  ["CreateDNSPortalInput"]: ValueTypes["CreateDNSPortalInput"];
  ["CreateDNSPortalSessionInput"]: ValueTypes["CreateDNSPortalSessionInput"];
  ["CreateDNSRecordInput"]: ValueTypes["CreateDNSRecordInput"];
  ["CreateDelegatedWireGuardTokenInput"]:
    ValueTypes["CreateDelegatedWireGuardTokenInput"];
  ["CreateDoctorReportInput"]: ValueTypes["CreateDoctorReportInput"];
  ["CreateDomainInput"]: ValueTypes["CreateDomainInput"];
  ["CreateExtensionTosAgreementInput"]:
    ValueTypes["CreateExtensionTosAgreementInput"];
  ["CreateLimitedAccessTokenInput"]:
    ValueTypes["CreateLimitedAccessTokenInput"];
  ["CreateOrganizationInput"]: ValueTypes["CreateOrganizationInput"];
  ["CreateOrganizationInvitationInput"]:
    ValueTypes["CreateOrganizationInvitationInput"];
  ["CreatePostgresClusterDatabaseInput"]:
    ValueTypes["CreatePostgresClusterDatabaseInput"];
  ["CreatePostgresClusterUserInput"]:
    ValueTypes["CreatePostgresClusterUserInput"];
  ["CreateReleaseInput"]: ValueTypes["CreateReleaseInput"];
  ["CreateTemplateDeploymentInput"]:
    ValueTypes["CreateTemplateDeploymentInput"];
  ["CreateThirdPartyConfigurationInput"]:
    ValueTypes["CreateThirdPartyConfigurationInput"];
  ["CreateVolumeInput"]: ValueTypes["CreateVolumeInput"];
  ["CreateVolumeSnapshotInput"]: ValueTypes["CreateVolumeSnapshotInput"];
  ["DNSRecordChangeAction"]: ValueTypes["DNSRecordChangeAction"];
  ["DNSRecordChangeInput"]: ValueTypes["DNSRecordChangeInput"];
  ["DNSRecordType"]: ValueTypes["DNSRecordType"];
  ["DeleteAddOnInput"]: ValueTypes["DeleteAddOnInput"];
  ["DeleteDNSPortalInput"]: ValueTypes["DeleteDNSPortalInput"];
  ["DeleteDNSPortalSessionInput"]: ValueTypes["DeleteDNSPortalSessionInput"];
  ["DeleteDNSRecordInput"]: ValueTypes["DeleteDNSRecordInput"];
  ["DeleteDelegatedWireGuardTokenInput"]:
    ValueTypes["DeleteDelegatedWireGuardTokenInput"];
  ["DeleteDeploymentSourceInput"]: ValueTypes["DeleteDeploymentSourceInput"];
  ["DeleteDomainInput"]: ValueTypes["DeleteDomainInput"];
  ["DeleteHealthCheckHandlerInput"]:
    ValueTypes["DeleteHealthCheckHandlerInput"];
  ["DeleteLimitedAccessTokenInput"]:
    ValueTypes["DeleteLimitedAccessTokenInput"];
  ["DeleteOrganizationInput"]: ValueTypes["DeleteOrganizationInput"];
  ["DeleteOrganizationInvitationInput"]:
    ValueTypes["DeleteOrganizationInvitationInput"];
  ["DeleteOrganizationMembershipInput"]:
    ValueTypes["DeleteOrganizationMembershipInput"];
  ["DeleteRemoteBuilderInput"]: ValueTypes["DeleteRemoteBuilderInput"];
  ["DeleteThirdPartyConfigurationInput"]:
    ValueTypes["DeleteThirdPartyConfigurationInput"];
  ["DeleteVolumeInput"]: ValueTypes["DeleteVolumeInput"];
  ["DeployImageInput"]: ValueTypes["DeployImageInput"];
  ["DeploymentStrategy"]: ValueTypes["DeploymentStrategy"];
  ["DetachPostgresClusterInput"]: ValueTypes["DetachPostgresClusterInput"];
  ["DischargeRootTokenInput"]: ValueTypes["DischargeRootTokenInput"];
  ["DomainDNSStatus"]: ValueTypes["DomainDNSStatus"];
  ["DomainRegistrationStatus"]: ValueTypes["DomainRegistrationStatus"];
  ["DummyWireGuardPeerInput"]: ValueTypes["DummyWireGuardPeerInput"];
  ["EnablePostgresConsulInput"]: ValueTypes["EnablePostgresConsulInput"];
  ["EnsureMachineRemoteBuilderInput"]:
    ValueTypes["EnsureMachineRemoteBuilderInput"];
  ["EstablishSSHKeyInput"]: ValueTypes["EstablishSSHKeyInput"];
  ["ExportDNSZoneInput"]: ValueTypes["ExportDNSZoneInput"];
  ["ExtendVolumeInput"]: ValueTypes["ExtendVolumeInput"];
  ["FinishBuildInput"]: ValueTypes["FinishBuildInput"];
  ["ForkVolumeInput"]: ValueTypes["ForkVolumeInput"];
  ["FsTypeType"]: ValueTypes["FsTypeType"];
  ["GrantPostgresClusterUserAccessInput"]:
    ValueTypes["GrantPostgresClusterUserAccessInput"];
  ["HTTPMethod"]: ValueTypes["HTTPMethod"];
  ["HTTPProtocol"]: ValueTypes["HTTPProtocol"];
  ["IPAddressType"]: ValueTypes["IPAddressType"];
  ["ISO8601DateTime"]: ValueTypes["ISO8601DateTime"];
  ["ImportDNSZoneInput"]: ValueTypes["ImportDNSZoneInput"];
  ["IssueCertificateInput"]: ValueTypes["IssueCertificateInput"];
  ["JSON"]: ValueTypes["JSON"];
  ["KillMachineInput"]: ValueTypes["KillMachineInput"];
  ["LaunchMachineInput"]: ValueTypes["LaunchMachineInput"];
  ["LockAppInput"]: ValueTypes["LockAppInput"];
  ["LogOutInput"]: ValueTypes["LogOutInput"];
  ["MoveAppInput"]: ValueTypes["MoveAppInput"];
  ["NomadToMachinesMigrationInput"]:
    ValueTypes["NomadToMachinesMigrationInput"];
  ["NomadToMachinesMigrationPrepInput"]:
    ValueTypes["NomadToMachinesMigrationPrepInput"];
  ["OrganizationAlertsEnabled"]: ValueTypes["OrganizationAlertsEnabled"];
  ["OrganizationMemberRole"]: ValueTypes["OrganizationMemberRole"];
  ["OrganizationTrust"]: ValueTypes["OrganizationTrust"];
  ["OrganizationType"]: ValueTypes["OrganizationType"];
  ["PauseAppInput"]: ValueTypes["PauseAppInput"];
  ["PlatformVersionEnum"]: ValueTypes["PlatformVersionEnum"];
  ["PropertyInput"]: ValueTypes["PropertyInput"];
  ["RegisterDomainInput"]: ValueTypes["RegisterDomainInput"];
  ["ReleaseIPAddressInput"]: ValueTypes["ReleaseIPAddressInput"];
  ["RemoveMachineInput"]: ValueTypes["RemoveMachineInput"];
  ["RemoveWireGuardPeerInput"]: ValueTypes["RemoveWireGuardPeerInput"];
  ["ResetAddOnPasswordInput"]: ValueTypes["ResetAddOnPasswordInput"];
  ["RestartAllocationInput"]: ValueTypes["RestartAllocationInput"];
  ["RestartAppInput"]: ValueTypes["RestartAppInput"];
  ["RestoreVolumeSnapshotInput"]: ValueTypes["RestoreVolumeSnapshotInput"];
  ["ResumeAppInput"]: ValueTypes["ResumeAppInput"];
  ["RevokePostgresClusterUserAccessInput"]:
    ValueTypes["RevokePostgresClusterUserAccessInput"];
  ["RuntimeType"]: ValueTypes["RuntimeType"];
  ["SaveDeploymentSourceInput"]: ValueTypes["SaveDeploymentSourceInput"];
  ["ScaleAppInput"]: ValueTypes["ScaleAppInput"];
  ["ScaleRegionInput"]: ValueTypes["ScaleRegionInput"];
  ["SecretInput"]: ValueTypes["SecretInput"];
  ["ServiceHandlerType"]: ValueTypes["ServiceHandlerType"];
  ["ServiceInput"]: ValueTypes["ServiceInput"];
  ["ServiceInputPort"]: ValueTypes["ServiceInputPort"];
  ["ServicePortTlsOptionsInput"]: ValueTypes["ServicePortTlsOptionsInput"];
  ["ServiceProtocolType"]: ValueTypes["ServiceProtocolType"];
  ["SetAppsv2DefaultOnInput"]: ValueTypes["SetAppsv2DefaultOnInput"];
  ["SetPagerdutyHandlerInput"]: ValueTypes["SetPagerdutyHandlerInput"];
  ["SetPlatformVersionInput"]: ValueTypes["SetPlatformVersionInput"];
  ["SetSecretsInput"]: ValueTypes["SetSecretsInput"];
  ["SetSlackHandlerInput"]: ValueTypes["SetSlackHandlerInput"];
  ["SetVMCountInput"]: ValueTypes["SetVMCountInput"];
  ["SetVMSizeInput"]: ValueTypes["SetVMSizeInput"];
  ["StartBuildInput"]: ValueTypes["StartBuildInput"];
  ["StartMachineInput"]: ValueTypes["StartMachineInput"];
  ["StopAllocationInput"]: ValueTypes["StopAllocationInput"];
  ["StopMachineInput"]: ValueTypes["StopMachineInput"];
  ["ThirdPartyConfigurationLevel"]: ValueTypes["ThirdPartyConfigurationLevel"];
  ["UnlockAppInput"]: ValueTypes["UnlockAppInput"];
  ["UnsetSecretsInput"]: ValueTypes["UnsetSecretsInput"];
  ["UpdateAddOnInput"]: ValueTypes["UpdateAddOnInput"];
  ["UpdateAutoscaleConfigInput"]: ValueTypes["UpdateAutoscaleConfigInput"];
  ["UpdateDNSPortalInput"]: ValueTypes["UpdateDNSPortalInput"];
  ["UpdateDNSRecordInput"]: ValueTypes["UpdateDNSRecordInput"];
  ["UpdateDNSRecordsInput"]: ValueTypes["UpdateDNSRecordsInput"];
  ["UpdateOrganizationMembershipInput"]:
    ValueTypes["UpdateOrganizationMembershipInput"];
  ["UpdateReleaseInput"]: ValueTypes["UpdateReleaseInput"];
  ["UpdateRemoteBuilderInput"]: ValueTypes["UpdateRemoteBuilderInput"];
  ["UpdateThirdPartyConfigurationInput"]:
    ValueTypes["UpdateThirdPartyConfigurationInput"];
  ["VMCountInput"]: ValueTypes["VMCountInput"];
  ["ValidateWireGuardPeersInput"]: ValueTypes["ValidateWireGuardPeersInput"];
};
