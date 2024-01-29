/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from "./core/BaseHttpRequest.ts"
import type { OpenAPIConfig } from "./core/OpenAPI.ts"
import { FetchHttpRequest } from "./core/FetchHttpRequest.ts"
import { AppsService } from "./services/AppsService.ts"
import { MachinesService } from "./services/MachinesService.ts"
import { VolumesService } from "./services/VolumesService.ts"
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class MachineAPI {
  public readonly apps: AppsService;
  public readonly machines: MachinesService;
  public readonly volumes: VolumesService;
  public readonly request: BaseHttpRequest;
  constructor(
    config?: Partial<OpenAPIConfig>,
    HttpRequest: HttpRequestConstructor = FetchHttpRequest,
  ) {
    this.request = new HttpRequest({
      BASE: config?.BASE ?? "https://api.machines.dev/v1",
      VERSION: config?.VERSION ?? "1.0",
      WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
      CREDENTIALS: config?.CREDENTIALS ?? "include",
      TOKEN: config?.TOKEN,
      USERNAME: config?.USERNAME,
      PASSWORD: config?.PASSWORD,
      HEADERS: config?.HEADERS,
      ENCODE_PATH: config?.ENCODE_PATH,
    });
    this.apps = new AppsService(this.request);
    this.machines = new MachinesService(this.request);
    this.volumes = new VolumesService(this.request);
  }
}
