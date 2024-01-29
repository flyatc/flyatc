import { Command } from "cliffy";

import app from "./commands/app.ts";
import apps from "./commands/apps.ts";
import config from "./commands/config.ts";
import deploy from "./commands/deploy/index.ts";

await new Command()
  .name("flyatc")
  .version("0.0.0")
  .description(
    "Region-focused, templatable Fly.io app configuration management and CLI."
  )
  .command("config", config)
  .command("apps", apps)
  .command("app", app)
  .command("deploy", deploy)
  .parse(Deno.args);
