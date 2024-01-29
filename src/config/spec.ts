import { z } from "zod";

const env = z.record(
  z
    .string()
    .regex(
      /^(?!FLY)[a-zA-Z-_]+$/,
      "Environment variable/secret names cannot start with FLY and must be [a-zA-Z0-9-_]"
    ),
  z.string()
);

// "global" vm options
const global = z
  .object({
    console_command: z.string().optional(),
    kill_signal: z
      .enum([
        "SIGINT",
        "SIGTERM",
        "SIGQUIT",
        "SIGUSR1",
        "SIGUSR2",
        "SIGKILL",
        "SIGSTOP",
      ])
      .optional(),
    kill_timeout: z.number().optional(),
    swap_size_mb: z.number().optional(),
  })
  .optional();

const dockerfile = z.object({
  dockerfile: z.string().optional(),
  args: z.record(z.string()).optional(),
});

const build = z.union([z.object({ image: z.string() }), dockerfile], {
  errorMap: (issue, ctx) => {
    switch (issue.code) {
      case z.ZodIssueCode.invalid_union:
        return {
          message: `Must choose between image and dockerfile.`,
        };
      default:
        return {
          message: ctx.defaultError,
        };
    }
  },
});

const concurrency = z
  .object({
    type: z.enum(["connections", "requests"]),
    hard_limit: z.number(),
    soft_limit: z.number(),
  })
  .optional();

const tcp_check = z.object({
  grace_period: z.string().optional(),
  interval: z.number().optional(),
  timeout: z.number().optional(),
});

const http_check = z
  .object({
    method: z
      .enum(["get", "post", "put", "patch", "delete", "head"])
      .optional(),
    path: z.string().optional(),
    protocol: z.enum(["http", "https"]).optional(),
    tlsSkipVerify: z.boolean().optional(),
    headers: z.record(z.string()).optional(),
  })
  .merge(tcp_check)
  .optional();

const proxy_proto_options = z.object({
  version: z.enum(["v1", "v2"]),
});

const port_http_options_response = z.object({
  headers: z.record(z.string()),
});

const port_http_options = z.object({
  compress: z.boolean().optional(),
  h2_backend: z.boolean().optional(),
  response: port_http_options_response,
});

const port_tls_options = z.object({
  alpn: z.array(z.string()).optional(),
  versions: z.array(z.string()).optional(),
  default_self_signed: z.boolean().optional(),
});

const port_general = z.object({
  handlers: z.enum(["http", "tls", "pg_tls", "proxy_protocol"]).optional(),
  force_https: z.boolean().optional(),
  http_options: port_http_options,
  proxy_proto_options,
  tls_options: port_tls_options,
});

const port_static = z
  .object({
    port: z.number(),
  })
  .merge(port_general);

const port_range = z
  .object({
    start_port: z.number(),
    end_port: z.number(),
  })
  .merge(port_general);

const port = z.union([port_static, port_range]);

const service = z.object({
  auto_start_machines: z.boolean().optional(),
  auto_stop_machines: z.boolean().optional(),
  min_machines_running: z.number().optional(),
  concurrency,
  http_checks: z.array(http_check).optional(),
  tcp_checks: z.array(tcp_check).optional(),
  ports: z.array(port).optional(),
  processes: z.array(z.string()),
  protocol: z.enum(["tcp", "udp"]).optional(),
  internal_port: z.number().optional(),
});

const metric = z.object({
  path: z.string().optional(),
  port: z.number().optional(),
  processes: z.array(z.string()).optional(),
});

const mount = z.object({
  auto_extend_size_increment: z.string().optional(),
  auto_extend_size_limit: z.string().optional(),
  auto_extend_size_threshold: z.number().optional(),
  destination: z.string().optional(),
  initial_size: z.string().optional(),
  processes: z.array(z.string()).optional(),
  source: z.string().optional(),
});

const compute = z.object({
  cpu_kind: z.enum(["shared", "performance"]).optional(),
  cpus: z.number().optional(),
  gpu_kind: z.enum(["a100-pcie-40gb", "a100-sxm4-80gb", "l40s"]).optional(),
  host_detication_id: z.string().optional(),
  memory: z.string().or(z.number()).optional(),
  processes: z.array(z.string()).optional(),
  size: z.enum([
    "shared-cpu-1x",
    "shared-cpu-2x",
    "shared-cpu-4x",
    "shared-cpu-8x",
    "performance-1x",
    "performance-2x",
    "performance-4x",
    "performance-8x",
    "performance-16x",
    "a100-40gb",
    "a100-80gb",
    "l40s",
  ]),
});

const region_enum = z.enum([
  "ams",
  "arn",
  "atl",
  "bog",
  "bom",
  "bos",
  "cdg",
  "den",
  "dfw",
  "ewr",
  "eze",
  "fra",
  "gdl",
  "gig",
  "gru",
  "hkg",
  "iad",
  "jnb",
  "lax",
  "lhr",
  "mad",
  "mia",
  "nrt",
  "ord",
  "otp",
  "phx",
  "qro",
  "scl",
  "sea",
  "sin",
  "sjc",
  "syd",
  "waw",
  "yul",
  "yyz",
]);

const regions = z.record(
  region_enum,
  z.object({
    replicas: z.number(),
    env: env.optional(),
  })
);

export const spec = z.object({
  version: z.number().min(1).max(1),
  name: z.string().regex(/^[a-zA-Z0-9-_]+$/),
  regions,
  secrets: env.optional(),
  global,
  build,
  env: env.optional(),
  resources: z.array(compute).optional(),
  services: z.array(service).optional(),
  metrics: z.array(metric).optional(),
  mounts: z.array(mount).optional(),
});
export type Spec = z.infer<typeof spec>;
