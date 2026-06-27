import axios from 'axios'
import type { AnyRecord, AppState } from '../stores/useAppStore'

export type Scene3dVector = {
  x: number
  y: number
  z: number
}

export type Scene3dSize = {
  w: number
  h: number
  d: number
}

export type Scene3dMaterial = {
  color?: string
  opacity?: number
  transparent?: boolean
  wireframe?: boolean
}

export type Scene3dObject = {
  id: string
  type: 'box' | 'floor' | 'gutter' | 'unit' | 'block' | 'device' | string
  shape: 'box' | string
  label?: string
  origin?: Scene3dVector
  center: Scene3dVector
  size: Scene3dSize
  material?: Scene3dMaterial
  meta?: AnyRecord
}

export type BoxScene3dResponse = {
  ok: boolean
  format: 'pback.scene3d.v1' | string
  unit?: string
  coordinate_system?: AnyRecord
  box?: {
    box_key?: string
    size?: Scene3dSize
    floors?: number[]
  }
  objects: Scene3dObject[]
  warnings?: string[]
}

export type BoxScene3dRequest = {
  box_key: string
  l: Array<{
    u: string
    k: string
    i: number
    c: number
    x: number
    y: number
    w: number
    h: number
    list_w: string[]
    list_d: string[]
    gtop: number
    gbottom: number
  }>
  devices: Array<{
    Name: string
    i: number
    id: string | number | null
    subunit_no?: string
    X: number
    Y: number
    W: number
    H: number
    slot_indices?: number[]
  }>
  format: 'scene-json'
  options: {
    include_box: boolean
    include_columns: boolean
    include_units: boolean
    include_blocks: boolean
    include_devices: boolean
    default_box_depth: number
    default_unit_depth: number
    default_device_depth: number
    slot_depth: number
    unit_z_mode: 'front' | 'center' | 'back'
  }
}

type Scene3dState = Pick<AppState, 'input' | 'layout'>

function toNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item))
}

function toNumberArray(value: unknown) {
  if (!Array.isArray(value)) return undefined

  const values = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))

  return values.length > 0 ? values : undefined
}

function stripConfirmedPrefix(value: unknown) {
  return typeof value === 'string' ? value.replace(/^確定/, '') : ''
}

export function getScene3dBoxKey(layout: Scene3dState['layout']) {
  return String(
    layout.box?.box_key ??
      layout.box?.code ??
      stripConfirmedPrefix(layout.boxcode) ??
      '',
  ).trim()
}

function buildDevicePayload(block: AnyRecord, device: AnyRecord) {
  const slotIndices = toNumberArray(device.slot_indices ?? block.slot_indices)
  const subunitNo = device.subunit_no ?? block.subunit_no ?? block.unit_no ?? block.unitNo

  return {
    Name: String(device.Name ?? block.Name ?? device.name ?? block.name ?? ''),
    i: toNumber(device.i ?? device.unit_i ?? block.i ?? block.unit_i ?? block.id ?? block.unitRef?.i),
    id: device.block ?? device.block_no ?? block.block ?? block.block_no ?? null,
    ...(subunitNo == null || subunitNo === '' ? {} : { subunit_no: String(subunitNo) }),
    X: toNumber(device.X ?? block.X),
    Y: toNumber(device.Y ?? block.Y),
    W: toNumber(device.W ?? block.W),
    H: toNumber(device.H ?? block.H),
    ...(slotIndices ? { slot_indices: slotIndices } : {}),
  }
}

export function buildBoxScene3dRequest(state: Scene3dState): BoxScene3dRequest {
  const boxKey = getScene3dBoxKey(state.layout)
  if (!boxKey) {
    throw new Error('3D表示に必要な box_key がありません。先に箱選定を実行してください。')
  }

  const layoutList = Array.isArray(state.layout.layout) ? state.layout.layout : []
  if (layoutList.length === 0) {
    throw new Error('3D表示に必要な配置データがありません。先に配置生成を実行してください。')
  }

  const units = layoutList.map((unit) => ({
    u: String(unit.unit_no ?? unit.u ?? ''),
    k: String(unit.unit_key ?? unit.k ?? ''),
    i: toNumber(unit.i),
    c: toNumber(unit.c),
    x: toNumber(unit.x),
    y: toNumber(unit.y),
    w: toNumber(unit.w),
    h: toNumber(unit.h),
    list_w: toStringArray(unit.list_w),
    list_d: toStringArray(unit.list_d),
    gtop: toNumber(unit.gtop),
    gbottom: toNumber(unit.gbottom),
  }))

  const devices: BoxScene3dRequest['devices'] = []
  const deviceBlocks = state.input.device?.list ?? []

  deviceBlocks.forEach((block) => {
    if (Array.isArray(block.devices) && block.devices.length > 0) {
      block.devices.forEach((device) => {
        devices.push(buildDevicePayload(block, device))
      })
      return
    }

    if (block.Name != null || block.W != null || block.H != null) {
      devices.push(buildDevicePayload(block, block))
    }
  })

  return {
    box_key: boxKey,
    l: units,
    devices,
    format: 'scene-json',
    options: {
      include_box: true,
      include_columns: true,
      include_units: true,
      include_blocks: true,
      include_devices: true,
      default_box_depth: 300,
      default_unit_depth: 99,
      default_device_depth: 30,
      slot_depth: 6,
      unit_z_mode: 'front',
    },
  }
}

export async function postBoxScene3d(request: BoxScene3dRequest) {
  const { data } = await axios.post<BoxScene3dResponse>('/api/postBoxScene3d', request, {
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
    },
    withCredentials: true,
  })

  return data
}
