type AnyRecord = Record<string, unknown>

type LayoutBoxHeightSource = {
  box?: unknown
  boxh?: unknown
  boxH?: unknown
  layout?: unknown
}

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toFiniteNumber(value: unknown) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

export function getEffectiveBoxHeight(
  layoutState: LayoutBoxHeightSource | null | undefined,
  fallback = 0,
) {
  const box = isRecord(layoutState?.box) ? layoutState.box : {}
  const configuredHeight = [layoutState?.boxh, box.i_box_h, layoutState?.boxH]
    .map(toFiniteNumber)
    .find((value) => value > 0)

  if (configuredHeight !== undefined) return configuredHeight

  const layoutList = Array.isArray(layoutState?.layout) ? layoutState.layout : []
  const contentHeight = layoutList.reduce((maximum, item) => {
    if (!isRecord(item)) return maximum
    return Math.max(
      maximum,
      toFiniteNumber(item.y) + toFiniteNumber(item.h) + toFiniteNumber(item.gbottom),
    )
  }, 0)

  return Math.max(fallback, contentHeight)
}
