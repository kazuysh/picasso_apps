import { getCommonColumnDepths, normalizeSizeCandidates } from './unitSizeCompatibility.ts'

export type BoxSearchFilter = Record<string, unknown>

type SearchSource = Record<string, unknown>

function isRecord(value: unknown): value is SearchSource {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function hasBoxSearchValue(value: unknown) {
  return value !== null && value !== undefined && value !== ''
}

function toNumberList(values: unknown) {
  if (!Array.isArray(values)) return []
  return values.map(Number).filter((value) => !Number.isNaN(value))
}

export function buildBoxSearchFilter(
  cabinfo: SearchSource = {},
  layout: SearchSource = {},
): BoxSearchFilter {
  const floor = isRecord(layout.floor) ? layout.floor : {}
  const nrow = layout.nrow
  const boxH = layout.boxH ?? layout.boxh ?? 0
  const filter: BoxSearchFilter = {}

  const setFloorFilter = (key: 'i_floor1' | 'i_floor2' | 'i_floor3', values: unknown) => {
    const numberValues = toNumberList(values)
    if (numberValues.length > 0) filter[key] = { $in: numberValues }
  }

  setFloorFilter('i_floor1', floor['1'])
  setFloorFilter('i_floor2', floor['2'])
  setFloorFilter('i_floor3', floor['3'])

  if (hasBoxSearchValue(cabinfo.floor1)) filter.i_floor1 = { $in: [Number(cabinfo.floor1)] }
  if (hasBoxSearchValue(cabinfo.floor2)) filter.i_floor2 = { $in: [Number(cabinfo.floor2)] }
  if (hasBoxSearchValue(cabinfo.floor3)) filter.i_floor3 = { $in: [Number(cabinfo.floor3)] }

  if (hasBoxSearchValue(nrow)) filter.i_NRow = nrow
  if (hasBoxSearchValue(cabinfo.material)) filter.body_material = cabinfo.material
  if (hasBoxSearchValue(cabinfo.format)) filter.box_location = cabinfo.format
  if (hasBoxSearchValue(cabinfo.outer_color)) filter.out_color = cabinfo.outer_color
  if (hasBoxSearchValue(cabinfo.format2)) filter.box_purpose = cabinfo.format2
  if (hasBoxSearchValue(cabinfo.structure)) filter.structure = cabinfo.structure
  if (hasBoxSearchValue(cabinfo.boxwidth)) filter.i_box_w = Number(cabinfo.boxwidth)
  if (hasBoxSearchValue(cabinfo.boxdepth)) filter.i_box_d = Number(cabinfo.boxdepth)
  const commonDepths = getCommonColumnDepths(layout.column_depths)
  const configuredSupportHeights = hasBoxSearchValue(cabinfo.support_height)
    ? normalizeSizeCandidates([cabinfo.support_height])
    : []

  if (commonDepths !== null) {
    const compatibleSupportHeights = configuredSupportHeights.length > 0
      ? commonDepths.filter((depth) => configuredSupportHeights.includes(depth))
      : commonDepths
    filter.list_support_height = { $in: compatibleSupportHeights }
  } else if (configuredSupportHeights.length > 0) {
    filter.list_support_height = configuredSupportHeights[0]
  }

  if (hasBoxSearchValue(boxH) && Number(boxH) > 0) {
    filter.i_box_h = { $gte: Number(boxH) }
  }
  if (hasBoxSearchValue(cabinfo.boxheight)) filter.i_box_h = Number(cabinfo.boxheight)

  return filter
}
