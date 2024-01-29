/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateLeaseRequest } from "../models/CreateLeaseRequest.ts"
import type { CreateMachineRequest } from "../models/CreateMachineRequest.ts"
import type { Lease } from "../models/Lease.ts"
import type { Machine } from "../models/Machine.ts"
import type { MachineEvent } from "../models/MachineEvent.ts"
import type { MachineExecRequest } from "../models/MachineExecRequest.ts"
import type { MachineVersion } from "../models/MachineVersion.ts"
import type { ProcessStat } from "../models/ProcessStat.ts"
import type { SignalRequest } from "../models/SignalRequest.ts"
import type { StopRequest } from "../models/StopRequest.ts"
import type { UpdateMachineRequest } from "../models/UpdateMachineRequest.ts"
import type { CancelablePromise } from "../core/CancelablePromise.ts"
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts"
export class MachinesService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * @param appName Fly App Name
   * @param includeDeleted Include deleted machines
   * @param region Region filter
   * @returns Machine OK
   * @throws ApiError
   */
  public machinesList(
    appName: string,
    includeDeleted?: boolean,
    region?: string,
  ): CancelablePromise<Array<Machine>> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}/machines",
      path: {
        "app_name": appName,
      },
      query: {
        "include_deleted": includeDeleted,
        "region": region,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param request Create machine request
   * @returns Machine OK
   * @throws ApiError
   */
  public machinesCreate(
    appName: string,
    request: CreateMachineRequest,
  ): CancelablePromise<Machine> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/machines",
      path: {
        "app_name": appName,
      },
      body: request,
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @returns Machine OK
   * @throws ApiError
   */
  public machinesShow(
    appName: string,
    machineId: string,
  ): CancelablePromise<Machine> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}/machines/{machine_id}",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @param request Request body
   * @returns Machine OK
   * @throws ApiError
   */
  public machinesUpdate(
    appName: string,
    machineId: string,
    request: UpdateMachineRequest,
  ): CancelablePromise<Machine> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/machines/{machine_id}",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
      body: request,
      errors: {
        400: `Bad Request`,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @param force Force kill the machine if it's running
   * @returns any OK
   * @throws ApiError
   */
  public machinesDelete(
    appName: string,
    machineId: string,
    force?: boolean,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/apps/{app_name}/machines/{machine_id}",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
      query: {
        "force": force,
      },
    });
  }
  /**
   * “Cordoning” a machine refers to disabling its services, so the proxy won’t route requests to it. In flyctl this is used by blue/green deployments; one set of machines is started up with services disabled, and when they are all healthy, the services are enabled on the new machines and disabled on the old ones.
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @returns any OK
   * @throws ApiError
   */
  public machinesCordon(
    appName: string,
    machineId: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/machines/{machine_id}/cordon",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @returns MachineEvent OK
   * @throws ApiError
   */
  public machinesListEvents(
    appName: string,
    machineId: string,
  ): CancelablePromise<Array<MachineEvent>> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}/machines/{machine_id}/events",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @param request Request body
   * @returns string Raw command output bytes are written back
   * @throws ApiError
   */
  public machinesExec(
    appName: string,
    machineId: string,
    request: MachineExecRequest,
  ): CancelablePromise<string> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/machines/{machine_id}/exec",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
      body: request,
      errors: {
        400: `Bad Request`,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @returns Lease OK
   * @throws ApiError
   */
  public machinesShowLease(
    appName: string,
    machineId: string,
  ): CancelablePromise<Lease> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}/machines/{machine_id}/lease",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @param request Request body
   * @returns Lease OK
   * @throws ApiError
   */
  public machinesCreateLease(
    appName: string,
    machineId: string,
    request: CreateLeaseRequest,
  ): CancelablePromise<Lease> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/machines/{machine_id}/lease",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
      body: request,
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @returns any OK
   * @throws ApiError
   */
  public machinesReleaseLease(
    appName: string,
    machineId: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/apps/{app_name}/machines/{machine_id}/lease",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @returns string OK
   * @throws ApiError
   */
  public machinesShowMetadata(
    appName: string,
    machineId: string,
  ): CancelablePromise<Record<string, string>> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}/machines/{machine_id}/metadata",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @param key Metadata Key
   * @returns void
   * @throws ApiError
   */
  public machinesUpdateMetadata(
    appName: string,
    machineId: string,
    key: string,
  ): CancelablePromise<void> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/machines/{machine_id}/metadata/{key}",
      path: {
        "app_name": appName,
        "machine_id": machineId,
        "key": key,
      },
      errors: {
        400: `Bad Request`,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @param key Metadata Key
   * @returns void
   * @throws ApiError
   */
  public machinesDeleteMetadata(
    appName: string,
    machineId: string,
    key: string,
  ): CancelablePromise<void> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/apps/{app_name}/machines/{machine_id}/metadata/{key}",
      path: {
        "app_name": appName,
        "machine_id": machineId,
        "key": key,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @param sortBy Sort by
   * @param order Order
   * @returns ProcessStat OK
   * @throws ApiError
   */
  public machinesListProcesses(
    appName: string,
    machineId: string,
    sortBy?: string,
    order?: string,
  ): CancelablePromise<Array<ProcessStat>> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}/machines/{machine_id}/ps",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
      query: {
        "sort_by": sortBy,
        "order": order,
      },
      errors: {
        400: `Bad Request`,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @param timeout Restart timeout as a Go duration string or number of seconds
   * @returns any OK
   * @throws ApiError
   */
  public machinesRestart(
    appName: string,
    machineId: string,
    timeout?: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/machines/{machine_id}/restart",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
      query: {
        "timeout": timeout,
      },
      errors: {
        400: `Bad Request`,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @param request Request body
   * @returns any OK
   * @throws ApiError
   */
  public machinesSignal(
    appName: string,
    machineId: string,
    request: SignalRequest,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/machines/{machine_id}/signal",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
      body: request,
      errors: {
        400: `Bad Request`,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @returns any OK
   * @throws ApiError
   */
  public machinesStart(
    appName: string,
    machineId: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/machines/{machine_id}/start",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @param request Optional request body
   * @returns any OK
   * @throws ApiError
   */
  public machinesStop(
    appName: string,
    machineId: string,
    request?: StopRequest,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/machines/{machine_id}/stop",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
      body: request,
      errors: {
        400: `Bad Request`,
      },
    });
  }
  /**
   * “Cordoning” a machine refers to disabling its services, so the proxy won’t route requests to it. In flyctl this is used by blue/green deployments; one set of machines is started up with services disabled, and when they are all healthy, the services are enabled on the new machines and disabled on the old ones.
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @returns any OK
   * @throws ApiError
   */
  public machinesUncordon(
    appName: string,
    machineId: string,
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "POST",
      url: "/apps/{app_name}/machines/{machine_id}/uncordon",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @returns MachineVersion OK
   * @throws ApiError
   */
  public machinesListVersions(
    appName: string,
    machineId: string,
  ): CancelablePromise<Array<MachineVersion>> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}/machines/{machine_id}/versions",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
    });
  }
  /**
   * @param appName Fly App Name
   * @param machineId Machine ID
   * @param instanceId instance? version? TODO
   * @param timeout wait timeout. default 60s
   * @param state desired state
   * @returns any OK
   * @throws ApiError
   */
  public machinesWait(
    appName: string,
    machineId: string,
    instanceId?: string,
    timeout?: number,
    state?: "started" | "stopped" | "destroyed",
  ): CancelablePromise<any> {
    return this.httpRequest.request({
      method: "GET",
      url: "/apps/{app_name}/machines/{machine_id}/wait",
      path: {
        "app_name": appName,
        "machine_id": machineId,
      },
      query: {
        "instance_id": instanceId,
        "timeout": timeout,
        "state": state,
      },
      errors: {
        400: `Bad Request`,
      },
    });
  }
}
