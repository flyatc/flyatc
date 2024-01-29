import { Command } from "cliffy";
import { renderConfig, validateConfig } from "../../config/index.ts";

const render = new Command()
  .name("render")
  .description("Render a flyatc file")
  .option("-f, --file <path>", "Directory containing a flyatc configuration", {
    default: `${Deno.cwd()}/app.flyatc`,
  })
  .action(async ({ file }) => {
    try {
      const config = await renderConfig(file);
      console.log(config);
    } catch (err) {
      console.log(err.message);
    }
  });

const validate = new Command()
  .name("validate")
  .description("Validate a flyatc file")
  .option("-f, --file <path>", "Directory containing a flyatc configuration", {
    default: `${Deno.cwd()}/app.flyatc`,
  })
  .action(async ({ file }) => {
    try {
      await validateConfig(file);
      console.log(`Configuration valid.`);
    } catch (err) {
      console.log(err.message);
    }
  });

export default new Command()
  .name("config")
  .description("Validate and render a flyatc configuration")
  .command("render", render)
  .command("validate", validate);
