/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateVolumeRequest } from "../models/CreateVolumeRequest.ts"
import type { ExtendVolumeRequest } from "../models/ExtendVolumeRequest.ts"
import type { ExtendVolumeResponse } from "../models/ExtendVolumeResponse.ts"
import type { UpdateVolumeRequest } from "../models/UpdateVolumeRequest.ts"
import type { Volume } from "../models/Volume.ts"
import type { VolumeSnapshot } from "../models/VolumeSnapshot.ts"
import type { CancelablePromise } from "../core/CancelablePromise.ts"
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts"
export class VolumesService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * @param appName Fly App Name
   * @returns Volume OK
   * @throws ApiError
   */
  public volumesList(
    appName: string,
  ): CancelablePromise<Array<Volume>> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}/volumes",
      path: {
        "app_name": appName,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param request Request body
   * @returns Volume OK
   * @throws ApiError
   */
  public volumesCreate(
    appName: string,
    request: CreateVolumeRequest,
  ): CancelablePromise<Volume> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/volumes",
      path: {
        "app_name": appName,
      },
      body: request,
    });
  }
  /**
   * @param appName Fly App Name
   * @param volumeId Volume ID
   * @returns Volume OK
   * @throws ApiError
   */
  public volumesGetById(
    appName: string,
    volumeId: string,
  ): CancelablePromise<Volume> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}/volumes/{volume_id}",
      path: {
        "app_name": appName,
        "volume_id": volumeId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param volumeId Volume ID
   * @param request Request body
   * @returns Volume OK
   * @throws ApiError
   */
  public volumesUpdate(
    appName: string,
    volumeId: string,
    request: UpdateVolumeRequest,
  ): CancelablePromise<Volume> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/volumes/{volume_id}",
      path: {
        "app_name": appName,
        "volume_id": volumeId,
      },
      body: request,
      errors: {
        400: `Bad Request`,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param volumeId Volume ID
   * @returns Volume OK
   * @throws ApiError
   */
  public volumeDelete(
    appName: string,
    volumeId: string,
  ): CancelablePromise<Volume> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/apps/{app_name}/volumes/{volume_id}",
      path: {
        "app_name": appName,
        "volume_id": volumeId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param volumeId Volume ID
   * @param request Request body
   * @returns ExtendVolumeResponse OK
   * @throws ApiError
   */
  public volumesExtend(
    appName: string,
    volumeId: string,
    request: ExtendVolumeRequest,
  ): CancelablePromise<ExtendVolumeResponse> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/apps/{app_name}/volumes/{volume_id}/extend",
      path: {
        "app_name": appName,
        "volume_id": volumeId,
      },
      body: request,
    });
  }
  /**
   * @param appName Fly App Name
   * @param volumeId Volume ID
   * @returns VolumeSnapshot OK
   * @throws ApiError
   */
  public volumesListSnapshots(
    appName: string,
    volumeId: string,
  ): CancelablePromise<Array<VolumeSnapshot>> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}/volumes/{volume_id}/snapshots",
      path: {
        "app_name": appName,
        "volume_id": volumeId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param volumeId Volume ID
   * @returns any OK
   * @throws ApiError
   */
  public createVolumeSnapshot(
    appName: string,
    volumeId: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/volumes/{volume_id}/snapshots",
      path: {
        "app_name": appName,
        "volume_id": volumeId,
      },
    });
  }
}
