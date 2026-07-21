import type { DeviceBlockItem } from '../stores/useAppStore'

export type UnitFlowDevice = {
  id: number
  unitNo: string
  node: string
  path_no: number | string
}

export type UnitFlowApiRequest = {
  devices: UnitFlowDevice[]
  threshold: number
  enforce_dag: boolean
}

export function buildUnitFlowDevice(device: DeviceBlockItem): UnitFlowDevice | null {
  const id = Number.parseInt(String(device.id ?? device.unit_i ?? device.i), 10)
  if (!Number.isFinite(id)) return null

  const pathNo = device.path_no ?? device.path ?? device.route ?? 0

  return {
    id,
    unitNo: String(device.unitNo ?? device.unit_no ?? device.unit_key ?? device.unit ?? ''),
    node: String(device.node ?? device.node_type ?? device.type ?? 'MA'),
    path_no: pathNo,
  }
}

export function buildUnitFlowDevices(devices: DeviceBlockItem[]): UnitFlowDevice[] {
  return devices
    .map(buildUnitFlowDevice)
    .filter((device): device is UnitFlowDevice => device !== null)
}
