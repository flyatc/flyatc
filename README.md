# flyatc

Fly _Air Traffic Control_

Region-focused, templatable Fly.io app configuration management and CLI.

## Motivation

- `fly.toml` isn't templatable, making IaC and environment management
  complicated.
- `fly.toml` is in TOML, a lesser-used and arguably more confusing derivative of
  JSON and YAML.
- `fly.toml` doesn't let you manage multi-region deployments.
- `fly.toml` doesn't let you manage secrets.
- The Fly Terraform provider is deprecated with no official replacement.

## Goals

- Highly configurable YAML + eta.js templating
- Region and secret support

FlyATC is **not** aiming to replace `flyctl`, only make deploying your Fly apps more convienient and configurable. There will be no parity
between FlyATC and flyctl, there will also be no attempt at maintaining any compatiblity between `.flyatc` files and `fly.toml`.

## Getting Started

We use the same Fly auth token you'd use with `flyctl`. You can set it as an environment variable under `FLY_API_TOKEN` or pass it in via the
`--token` CLI flag.

From there, consult the documentation on CLI operations and process at: 
