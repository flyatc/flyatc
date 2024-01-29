import { ApiError, App } from "fly-machine";
import { clients } from "./../../clients.ts";

export const checkApp = async (
  name: string,
  token: string,
  org?: string
): Promise<App> => {
  const { machine } = clients(token);

  let app: App;

  try {
    app = await machine.apps.appsShow(name);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return machine.apps.appsCreate({
        app_name: name,
        org_slug: org,
        network: "default",
      });
    }

    throw err;
  }

  return app;
};
