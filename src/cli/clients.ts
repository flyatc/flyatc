import { Thunder, HOST as flyGqlHost } from "fly-gql";
import { MachineAPI } from "fly-machine";

export const clients = (token: string) => {
  const machine = new MachineAPI({
    HEADERS: {
      Authorization: `Bearer ${token}`,
    },
  });
  const api = Thunder(async (query) => {
    const response = await fetch(flyGqlHost, {
      body: JSON.stringify({ query }),
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return new Promise((_, reject) => {
        response
          .text()
          .then((text) => {
            try {
              reject(JSON.parse(text));
            } catch {
              reject(text);
            }
          })
          .catch(reject);
      });
    }

    const json = await response.json();

    return json.data;
  });

  return {
    machine,
    api,
  };
};
