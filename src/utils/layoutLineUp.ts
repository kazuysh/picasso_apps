export type LineUpLayoutItem = {
  i?: string | number
  id?: string | number
  c?: number
  column?: number
  order?: number
  y?: number
  h?: number
  [key: string]: unknown
}

const COLUMN_NUMBERS = [1, 2, 3] as const
const ORDER_HIT_EPSILON = 0.5

function toFiniteNumber(value: unknown, fallback = 0) {
  if (value == null || String(value).trim() === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function getLayoutColumn(item: LineUpLayoutItem) {
  const column = toFiniteNumber(item.c ?? item.column, 1)
  return column === 2 || column === 3 ? column : 1
}

function getUnitId(item: LineUpLayoutItem) {
  return String(item.i ?? item.id ?? '')
}

export function normalizeLayoutOrders<T extends LineUpLayoutItem>(
  layout: T[],
): T[] {
  const indexed = layout.map((item, index) => ({ item, index }))
  const result: T[] = []

  COLUMN_NUMBERS.forEach((column) => {
    const columnItems = indexed
      .filter(({ item }) => getLayoutColumn(item) === column)
      .sort((left, right) => {
        const leftHasOrder = Number.isInteger(Number(left.item.order))
        const rightHasOrder = Number.isInteger(Number(right.item.order))

        if (leftHasOrder && rightHasOrder) {
          const orderDifference =
            toFiniteNumber(left.item.order) - toFiniteNumber(right.item.order)
          if (orderDifference !== 0) return orderDifference
        } else if (leftHasOrder !== rightHasOrder) {
          return leftHasOrder ? -1 : 1
        }

        const yDifference =
          toFiniteNumber(left.item.y) - toFiniteNumber(right.item.y)
        return yDifference !== 0 ? yDifference : left.index - right.index
      })

    columnItems.forEach(({ item }, order) => {
      result.push({
        ...item,
        c: column,
        column,
        order,
      })
    })
  })

  return result
}

export function moveLayoutUnit<T extends LineUpLayoutItem>(
  layout: T[],
  unitId: string,
  targetColumn: number,
  targetTop: number,
  unitHeight: number,
): T[] {
  const normalized = normalizeLayoutOrders(layout)
  const moving = normalized.find((item) => getUnitId(item) === unitId)
  if (!moving) return normalized

  const column = targetColumn === 2 || targetColumn === 3 ? targetColumn : 1
  const remaining = normalized.filter((item) => getUnitId(item) !== unitId)
  const targetItems = remaining.filter(
    (item) => getLayoutColumn(item) === column,
  )
  const draggedCenter = targetTop + unitHeight / 2
  const insertionIndex = targetItems.findIndex(
    (item) =>
      draggedCenter <
      toFiniteNumber(item.y) +
        toFiniteNumber(item.h) / 2 -
        ORDER_HIT_EPSILON,
  )
  const nextTargetItems = [...targetItems]
  nextTargetItems.splice(
    insertionIndex < 0 ? nextTargetItems.length : insertionIndex,
    0,
    {
      ...moving,
      c: column,
      column,
      y: targetTop,
    },
  )

  const byColumn = new Map<number, T[]>()
  COLUMN_NUMBERS.forEach((columnNumber) => {
    byColumn.set(
      columnNumber,
      columnNumber === column
        ? nextTargetItems
        : remaining.filter(
            (item) => getLayoutColumn(item) === columnNumber,
          ),
    )
  })

  return COLUMN_NUMBERS.flatMap((columnNumber) =>
    (byColumn.get(columnNumber) ?? []).map((item, order) => ({
      ...item,
      c: columnNumber,
      column: columnNumber,
      order,
    })),
  )
}

export function normalizeLineUpTopGutters(value: unknown) {
  const source = Array.isArray(value) ? value : []
  return COLUMN_NUMBERS.map((_, index) =>
    toFiniteNumber(source[index], 150),
  )
}

export function normalizeLineUpBottomGutter(value: unknown) {
  return toFiniteNumber(value, 150)
}

export function getLineUpConflictMessage(
  error: unknown,
  fallback: string,
) {
  if (
    typeof error !== 'object' ||
    error == null ||
    !('response' in error)
  ) {
    return error instanceof Error ? error.message : fallback
  }

  const response = (
    error as {
      response?: {
        status?: number
        data?: {
          detail?: {
            message?: string
            errors?: Array<{ code?: string; column?: number }>
          }
        }
      }
    }
  ).response
  const detail = response?.data?.detail
  if (response?.status !== 409 || !detail) return fallback

  const conflicts = (detail.errors ?? [])
    .map((item) => {
      const label =
        item.code === 'NO_COMMON_WIDTH'
          ? '共通幅なし'
          : item.code === 'NO_COMMON_DEPTH'
            ? '共通奥行きなし'
            : item.code ?? '配置条件不一致'
      return item.column ? `列${item.column}: ${label}` : label
    })
    .join('、')

  return [detail.message, conflicts].filter(Boolean).join(' ')
}
