import { Command } from "cliffy";
import { table } from "../util.ts";
import { clients } from "./../clients.ts";

const listSecrets = new Command()
  .name("ls")
  .description("View app secrets")
  .env("FLY_API_TOKEN=<token:string>", "Fly auth token")
  .option("-t, --token <token>", "Fly auth token")
  .option("-o, --org <organization>", "Fly organization", {
    default: "personal",
  })
  .action(async ({ token, flyApiToken, org }) => {
    const resolvedToken = token ?? flyApiToken;

    if (!resolvedToken) {
      console.log(
        `Failed to find a Fly auth token. Supply one via the -t flag or via the FLY_AUTH_TOKEN env var.`
      );
      return;
    }

    const { machine } = clients(resolvedToken);

    const { apps } = await machine.apps.appsList(org);

    console.log(
      table({
        headers: ["Name", "Machines", "Last Deployed"],
        data: (apps ?? []).map(({ name, machine_count }) => [
          name ?? "N/A",
          machine_count ?? 0,
          "",
        ]),
        empty: "No apps found.",
      })
    );
  });

const secrets = new Command()
  .name("secrets")
  .description("Manage app secrets")
  .command("ls", listSecrets);

export default new Command()
  .name("app")
  .arguments("<app>")
  .description("Information on a specific Fly app")
  .command("secrets", secrets);
