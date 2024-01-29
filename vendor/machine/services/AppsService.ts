/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { App } from "../models/App.ts"
import type { CreateAppRequest } from "../models/CreateAppRequest.ts"
import type { ListAppsResponse } from "../models/ListAppsResponse.ts"
import type { CancelablePromise } from "../core/CancelablePromise.ts"
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts"
export class AppsService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * @param orgSlug The org slug, or 'personal', to filter apps
   * @returns ListAppsResponse OK
   * @throws ApiError
   */
  public appsList(
    orgSlug: string,
  ): CancelablePromise<ListAppsResponse> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps",
      query: {
        "org_slug": orgSlug,
      },
    });
  }
  /**
   * @param request App body
   * @returns any Created
   * @throws ApiError
   */
  public appsCreate(
    request: CreateAppRequest,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps",
      body: request,
      errors: {
        400: `Bad Request`,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @returns App OK
   * @throws ApiError
   */
  public appsShow(
    appName: string,
  ): CancelablePromise<App> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}",
      path: {
        "app_name": appName,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @returns any Accepted
   * @throws ApiError
   */
  public appsDelete(
    appName: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/apps/{app_name}",
      path: {
        "app_name": appName,
      },
    });
  }
}
