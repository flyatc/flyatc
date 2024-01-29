import { Command } from "cliffy";
import { validateConfig } from "../../../config/index.ts";
import { Spec } from "../../../config/spec.ts";
import { checkApp } from "./app.ts";
import { updateSecrets } from "./secrets.ts";

export default new Command()
  .name("deploy")
  .description("Deploy a Fly app")
  .env("FLY_API_TOKEN=<token:string>", "Fly auth token")
  .option("-t, --token <token>", "Fly auth token")
  .option("-o, --org <organization>", "Fly organization", {
    default: "personal",
  })
  .option("-f, --file <path>", "Directory containing a flyatc configuration", {
    default: `${Deno.cwd()}/app.flyatc`,
  })
  .action(async ({ token, flyApiToken, org, file }) => {
    const resolvedToken = token ?? flyApiToken;

    if (!resolvedToken) {
      console.log(
        `Failed to find a Fly auth token. Supply one via the -t flag or via the FLY_AUTH_TOKEN env var.`
      );
      return;
    }

    let config: Spec;

    try {
      config = await validateConfig(file);
    } catch (err) {
      console.log(err.message);
      return;
    }

    const app = await checkApp(config.name, resolvedToken, org);
    const secrets = await updateSecrets(
      resolvedToken,
      config.name,
      config.secrets ?? {}
    );

    console.log(app, secrets);
  });
