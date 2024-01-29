import { clients } from "../../clients.ts";

export const getSecrets = (token: string, app: string) => {
  const { api } = clients(token);

  return api("query")({
    app: [
      {
        name: app,
      },
      {
        secrets: {
          name: true,
          createdAt: true,
          digest: true,
        },
      },
    ],
  });
};

export const setSecrets = (
  token: string,
  app: string,
  secrets: Record<string, string>
) => {
  const { api } = clients(token);

  return api("mutation")({
    setSecrets: [
      {
        input: {
          appId: app,
          secrets: Object.entries(secrets).map(([key, value]) => ({
            key,
            value,
          })),
        },
      },
      {
        app: {
          secrets: {
            name: true,
            createdAt: true,
            digest: true,
          },
        },
      },
    ],
  });
};

export const unsetSecrets = (
  token: string,
  app: string,
  secrets: Array<string>
) => {
  const { api } = clients(token);

  return api("mutation")({
    unsetSecrets: [
      {
        input: {
          appId: app,
          keys: secrets,
        },
      },
      {
        app: {
          secrets: {
            name: true,
            createdAt: true,
            digest: true,
          },
        },
      },
    ],
  });
};

export enum SecretUpdateType {
  UNCHANGED,
  UPDATED,
  ADDED,
  REMOVED,
}
export const updateSecrets = async (
  token: string,
  app: string,
  secrets: Record<string, string>
): Promise<Record<string, SecretUpdateType>> => {
  const currSecrets: Record<string, string> = await getSecrets(token, app).then(
    ({ app }) =>
      app?.secrets.reduce(
        (acc, { name, digest }) => ({
          ...acc,
          [name]: digest,
        }),
        {}
      ) ?? {}
  );

  const updatedSecrets: Record<string, string> = Object.keys(secrets).length
    ? await setSecrets(token, app, secrets).then(
        ({ setSecrets }) =>
          setSecrets?.app?.secrets.reduce(
            (acc, { name, digest }) => ({
              ...acc,
              [name]: digest,
            }),
            {}
          ) ?? {}
      )
    : {};

  const secretsToRemove = Object.keys(currSecrets).filter(
    (secret) => !(secret in secrets)
  );
  if (secretsToRemove.length) {
    await unsetSecrets(token, app, secretsToRemove);
  }

  return {
    ...Object.entries(updatedSecrets).reduce(
      (acc, [secret, digest]) => ({
        ...acc,
        [secret]:
          secret in currSecrets && currSecrets[secret] !== digest
            ? SecretUpdateType.UPDATED
            : secret in currSecrets
            ? SecretUpdateType.UNCHANGED
            : SecretUpdateType.ADDED,
      }),
      {}
    ),
    ...secretsToRemove.reduce(
      (acc, secret) => ({
        ...acc,
        [secret]: SecretUpdateType.REMOVED,
      }),
      {}
    ),
  };
};
