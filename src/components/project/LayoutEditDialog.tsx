import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import {
  getLineUpConflictMessage,
  moveLayoutUnit,
  normalizeLineUpBottomGutter,
  normalizeLayoutOrders,
} from '../../utils/layoutLineUp'

// Existing layout/device payloads contain API-defined dynamic fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

type LayoutEditDialogProps = {
  open: boolean
  svgText?: string
  input: AnyRecord
  layout: AnyRecord
  onClose: () => void
  onInputChange?: (nextInput: AnyRecord) => void
  onLayoutChange?: (nextLayout: AnyRecord) => void
  onApplied?: () => void
}

type DragState = {
  element: SVGGElement
  unitIndex: string
  pointerId: number
  originalTransform: string
  offsetX: number
  offsetY: number
}

type LineUpResponse = {
  coordinate_mode?: 'column-order-v2'
  layout_version?: 2
  success?: boolean
  l?: AnyRecord[]
  f?: AnyRecord
  n?: number
  h?: number
  required_height?: number
  column_heights?: Record<string, number>
  column_depths?: Record<string, string[]>
  errors?: Array<{ code?: string; column?: number }>
}

type CanvasSize = {
  width: number
  height: number
}

type LayerKey = 'box' | 'column' | 'gutter' | 'block' | 'device'

const DEFAULT_BOX_G = ['150', '150', '150']
const DEFAULT_BOX_W = ['0', '500', '20', '500', '20', '500', '20']
const DEFAULT_BOX_GB = '150'
const DEFAULT_CANVAS_SIZE: CanvasSize = { width: 1600, height: 1800 }
const ZOOM_INITIAL = 0.6
const ZOOM_MIN = 0.25
const ZOOM_MAX = 2
const ZOOM_STEP = 0.15
const BOX_WIDTH_FIELDS = [
  'f_lgutter',
  'i_floor1',
  'i_clgutter',
  'i_floor2',
  'i_crgutter',
  'i_floor3',
  'f_rgutter',
]
const LAYER_CONFIG: Array<{ key: LayerKey; label: string; color: string }> = [
  { key: 'box', label: '箱外形', color: '#64748b' },
  { key: 'column', label: '列領域', color: '#f59e0b' },
  { key: 'gutter', label: 'ガター', color: '#f97316' },
  { key: 'block', label: 'ブロック', color: '#16a34a' },
  { key: 'device', label: '機器', color: '#dc2626' },
]
const INITIAL_LAYER_VISIBILITY: Record<LayerKey, boolean> = {
  box: true,
  column: true,
  gutter: true,
  block: true,
  device: true,
}

function clone<T>(value: T): T {
  if (value == null) return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function hasValue(value: unknown) {
  return value != null && String(value).trim() !== ''
}

function normalizeBoxG(value: unknown) {
  const source = Array.isArray(value) ? value : []
  return Array.from({ length: 3 }, (_, index) =>
    hasValue(source[index]) ? source[index] : DEFAULT_BOX_G[index],
  )
}

function normalizeBoxW(layoutState: AnyRecord) {
  const box = layoutState?.box ?? {}
  if (BOX_WIDTH_FIELDS.some((field) => hasValue(box[field]))) {
    return BOX_WIDTH_FIELDS.map((field, index) =>
      hasValue(box[field]) ? box[field] : DEFAULT_BOX_W[index],
    )
  }

  const source = Array.isArray(layoutState?.boxw) ? layoutState.boxw : DEFAULT_BOX_W
  if (source.length === 6) return ['0', ...source]
  if (source.length === 7) return source
  return DEFAULT_BOX_W
}

function getLayoutBoxHeight(layoutState: AnyRecord) {
  const candidates = [
    layoutState?.box?.i_box_h,
    layoutState?.boxh,
    layoutState?.boxH,
  ]
  const positiveHeight = candidates
    .map((value) => toNumber(value))
    .find((value) => value > 0)

  if (positiveHeight) return positiveHeight

  const layoutList = Array.isArray(layoutState?.layout) ? layoutState.layout : []
  const contentHeight = layoutList.reduce(
    (maximum: number, unit: AnyRecord) =>
      Math.max(
        maximum,
        toNumber(unit?.y) + toNumber(unit?.h) + toNumber(unit?.gbottom),
      ),
    0,
  )
  return Math.max(1800, contentHeight)
}

function getColumnStarts(boxWidths: unknown[]) {
  const widths = boxWidths.map((value) => toNumber(value))
  return [
    {
      column: 1,
      layoutX: 0,
      x: widths[0],
      width: widths[1],
      lowerBound: widths[0],
      upperBound: widths[0] + widths[1] + widths[2],
    },
    {
      column: 2,
      layoutX: widths[1],
      x: widths[0] + widths[1] + widths[2],
      width: widths[3],
      lowerBound: widths[0] + widths[1] + widths[2],
      upperBound: widths[0] + widths[1] + widths[2] + widths[3] + widths[4],
    },
    {
      column: 3,
      layoutX: widths[1] + widths[3],
      x: widths[0] + widths[1] + widths[2] + widths[3] + widths[4],
      width: widths[5],
      lowerBound: widths[0] + widths[1] + widths[2] + widths[3] + widths[4],
      upperBound: Number.POSITIVE_INFINITY,
    },
  ]
}

function getSnapTarget(value: number, columns: ReturnType<typeof getColumnStarts>) {
  const normalizedValue = Math.max(0, value)
  return (
    columns.find(
      (column) =>
        normalizedValue >= column.lowerBound && normalizedValue < column.upperBound,
    ) ?? columns[0]
  )
}

function extractTranslate(transform: string | null) {
  const match = (transform || 'translate(0,0)').match(
    /translate\(([^,\s]+)[,\s]+([^)]+)\)/,
  )
  if (!match) return { x: 0, y: 0 }
  return {
    x: Number.parseFloat(match[1]) || 0,
    y: Number.parseFloat(match[2]) || 0,
  }
}

function getSvgPoint(
  svg: SVGSVGElement,
  event: PointerEvent | ReactPointerEvent<HTMLElement>,
) {
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: event.clientX, y: event.clientY }
  const transformed = point.matrixTransform(ctm.inverse())
  return { x: transformed.x, y: transformed.y }
}

function getTopLevelUnitTarget(
  target: EventTarget | null,
  svg: SVGSVGElement | null,
): SVGGElement | null {
  if (!(target instanceof Element) || !svg) return null

  let current: Element | null = target
  while (current && current !== svg) {
    if (
      current.tagName.toLowerCase() === 'g' &&
      current.parentNode === svg &&
      (current.hasAttribute('data-unit-i') ||
        (current.getAttribute('id') ?? '').includes('#'))
    ) {
      return current as SVGGElement
    }
    current = current.parentElement
  }

  return null
}

function getUnitIndex(group: SVGGElement) {
  const dataUnitIndex = group.dataset.unitI
  if (dataUnitIndex) return dataUnitIndex

  const idParts = group.id.split('#')
  return idParts.length >= 2 ? idParts[idParts.length - 1] : ''
}

function getCanvasSize(svg: SVGSVGElement): CanvasSize {
  const viewBox = svg.viewBox?.baseVal
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height }
  }

  return {
    width: Math.max(1, toNumber(svg.getAttribute('width'), DEFAULT_CANVAS_SIZE.width)),
    height: Math.max(1, toNumber(svg.getAttribute('height'), DEFAULT_CANVAS_SIZE.height)),
  }
}

function buildDevicePayload(input: AnyRecord) {
  const result: AnyRecord[] = []
  const blocks = Array.isArray(input?.device?.list) ? input.device.list : []

  blocks.forEach((block: AnyRecord) => {
    const devices =
      Array.isArray(block?.devices) && block.devices.length > 0
        ? block.devices
        : block?.Name != null || block?.W != null || block?.H != null
          ? [block]
          : []

    devices.forEach((device: AnyRecord) => {
      const unitIndex =
        device?.i ??
        device?.unit_i ??
        block?.i ??
        block?.unit_i ??
        block?.unitRef?.i ??
        block?.id
      const blockNumber =
        device?.block ??
        device?.block_no ??
        block?.block ??
        block?.block_no
      const subunitNumber =
        device?.subunit_no ??
        block?.subunit_no ??
        block?.unit_no ??
        block?.unitNo

      result.push({
        Name: String(device?.Name ?? block?.Name ?? device?.name ?? block?.name ?? ''),
        ...(unitIndex == null || unitIndex === '' ? {} : { i: toNumber(unitIndex) }),
        ...(blockNumber == null || blockNumber === '' ? {} : { id: String(blockNumber) }),
        ...(subunitNumber == null || subunitNumber === ''
          ? {}
          : { subunit_no: String(subunitNumber) }),
        X: toNumber(device?.X ?? block?.X),
        Y: toNumber(device?.Y ?? block?.Y),
        W: toNumber(device?.W ?? block?.W),
        H: toNumber(device?.H ?? block?.H),
        ...(Array.isArray(device?.slot_indices ?? block?.slot_indices)
          ? { slot_indices: device?.slot_indices ?? block?.slot_indices }
          : {}),
      })
    })
  })

  return result
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback
  }

  const detail =
    error.response?.data && typeof error.response.data === 'object'
      ? String(error.response.data.detail ?? '')
      : ''
  return detail || fallback
}

function applyLayerVisibility(
  svg: SVGSVGElement,
  visibility: Record<LayerKey, boolean>,
) {
  const selectors: Record<LayerKey, string> = {
    box: '[data-layer="box"]',
    column: '[data-layer="column"]',
    gutter: '[data-layer="gutter"]',
    block: '[data-object-type="block"]',
    device: '[data-object-type="device"]',
  }

  Object.entries(selectors).forEach(([key, selector]) => {
    svg.querySelectorAll<SVGElement>(selector).forEach((element) => {
      element.style.display = visibility[key as LayerKey] ? '' : 'none'
    })
  })
}

function applySelectedUnit(svg: SVGSVGElement, selectedUnitId: string) {
  svg
    .querySelectorAll<SVGGElement>(':scope > g[data-unit-i], :scope > g[id*="#"]')
    .forEach((group) => {
    const selected = getUnitIndex(group) === selectedUnitId
    group.style.filter = selected ? 'drop-shadow(0 0 5px rgba(37, 99, 235, 0.8))' : ''
    const outline = group.querySelector<SVGRectElement>(
      ':scope > rect[data-object-type="unit-outline"]',
    )
    if (outline) {
      outline.style.strokeWidth = selected ? '4px' : '1px'
      outline.style.fillOpacity = selected ? '0.5' : '0.32'
    }
  })
}

export default function LayoutEditDialog({
  open,
  input,
  layout,
  onClose,
  onLayoutChange,
  onApplied,
}: LayoutEditDialogProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null)
  const innerSvgRef = useRef<SVGSVGElement | null>(null)
  const draggingRef = useRef<DragState | null>(null)
  const layerVisibilityRef = useRef(INITIAL_LAYER_VISIBILITY)
  const selectedUnitIdRef = useRef('')

  const [draftLayout, setDraftLayout] = useState<AnyRecord>(() => clone(layout ?? {}))
  const [editableSvgText, setEditableSvgText] = useState('')
  const [svgRevision, setSvgRevision] = useState(0)
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [selectedUnitLabel, setSelectedUnitLabel] = useState('')
  const [position, setPosition] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [liningUp, setLiningUp] = useState(false)
  const [generatingSvg, setGeneratingSvg] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [zoom, setZoom] = useState(ZOOM_INITIAL)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(DEFAULT_CANVAS_SIZE)
  const [layerVisibility, setLayerVisibility] = useState(INITIAL_LAYER_VISIBILITY)

  const devices = useMemo(() => buildDevicePayload(input), [input])
  const boxg = useMemo(() => normalizeBoxG(draftLayout?.boxg), [draftLayout?.boxg])
  const boxw = useMemo(() => normalizeBoxW(draftLayout), [draftLayout])
  const columns = useMemo(() => getColumnStarts(boxw), [boxw])
  const boxHeight = useMemo(() => getLayoutBoxHeight(draftLayout), [draftLayout])
  const boxCode =
    draftLayout?.boxcode ??
    draftLayout?.box?.box_key ??
    draftLayout?.box?.code ??
    '箱未選定'
  const busy = liningUp || generatingSvg

  useEffect(() => {
    layerVisibilityRef.current = layerVisibility
  }, [layerVisibility])

  useEffect(() => {
    selectedUnitIdRef.current = selectedUnitId
  }, [selectedUnitId])

  const requestEditableSvg = useCallback(
    async (layoutState: AnyRecord) => {
      const currentLayout = Array.isArray(layoutState?.layout)
        ? layoutState.layout
        : []
      if (currentLayout.length === 0) {
        setEditableSvgText('')
        innerSvgRef.current = null
        return false
      }

      setGeneratingSvg(true)
      setErrorMessage('')

      try {
        const response = await axios.post(
          '/api/postBoxSvg2',
          {
            l: currentLayout,
            w: normalizeBoxW(layoutState).map(String).join(','),
            g: normalizeBoxG(layoutState?.boxg).map(String).join(','),
            h: String(getLayoutBoxHeight(layoutState)),
            render_mode: 'result2d',
            devices,
            options: {
              include_box: true,
              include_columns: true,
              include_gutters: true,
              include_units: true,
              include_blocks: true,
              include_devices: true,
              show_labels: true,
              embed_metadata: true,
              background: '#f8fafc',
            },
          },
          {
            responseType: 'text',
            headers: {
              Accept: 'image/svg+xml',
              'Cache-Control': 'no-store',
            },
          },
        )
        const nextSvg =
          typeof response.data === 'string' ? response.data : response.data?.svg ?? ''
        setEditableSvgText(nextSvg)
        setSvgRevision((revision) => revision + 1)
        return Boolean(nextSvg)
      } catch (error) {
        console.error('[LayoutEditDialog] postBoxSvg2 result2d failed', error)
        setErrorMessage(
          getApiErrorMessage(error, '結果2Dデザインの配置編集SVG生成に失敗しました。'),
        )
        return false
      } finally {
        setGeneratingSvg(false)
      }
    },
    [devices],
  )

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => {
      const nextDraft = clone(layout ?? {})
      setDraftLayout(nextDraft)
      setEditableSvgText('')
      setSvgRevision((revision) => revision + 1)
      setSelectedUnitId('')
      setSelectedUnitLabel('')
      setPosition('')
      setErrorMessage('')
      setInfoMessage('')
      setDirty(false)
      setZoom(ZOOM_INITIAL)
      setCanvasSize(DEFAULT_CANVAS_SIZE)
      setLayerVisibility(INITIAL_LAYER_VISIBILITY)
      draggingRef.current = null
      void requestEditableSvg(nextDraft)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [layout, open, requestEditableSvg])

  useEffect(() => {
    const host = canvasHostRef.current
    if (!host) {
      innerSvgRef.current = null
      return
    }

    host.innerHTML = editableSvgText
    if (!editableSvgText) {
      innerSvgRef.current = null
      return
    }

    const svg = host.querySelector(':scope > svg') as SVGSVGElement | null
    innerSvgRef.current = svg
    if (!svg) return

    setCanvasSize(getCanvasSize(svg))
    svg
      .querySelectorAll<SVGGElement>(':scope > g[data-unit-i], :scope > g[id*="#"]')
      .forEach((group) => {
        group.style.cursor = 'grab'
      })
    applyLayerVisibility(svg, layerVisibilityRef.current)
    applySelectedUnit(svg, selectedUnitIdRef.current)
  }, [editableSvgText, svgRevision])

  useEffect(() => {
    const svg = innerSvgRef.current
    if (svg) applyLayerVisibility(svg, layerVisibility)
  }, [layerVisibility])

  useEffect(() => {
    const svg = innerSvgRef.current
    if (svg) applySelectedUnit(svg, selectedUnitId)
  }, [selectedUnitId])

  const updateLineUp = useCallback(
    async (previousDraft: AnyRecord, nextLayoutList: AnyRecord[]) => {
      setLiningUp(true)
      setErrorMessage('')
      setInfoMessage('整列配置を実行中です...')

      try {
        const lineUpLayout = normalizeLayoutOrders(nextLayoutList)
        const response = await axios.post<LineUpResponse>('/api/postLineUp', {
          coordinate_mode: 'column-order-v2',
          layout_version: 2,
          g: normalizeBoxG(previousDraft?.boxg).map((value) => toNumber(value, 150)),
          gb: normalizeLineUpBottomGutter(
            previousDraft?.boxgb ?? DEFAULT_BOX_GB,
          ),
          l: lineUpLayout,
        })

        const alignedLayout = response.data?.l ?? []
        const boxH = response.data?.required_height ?? response.data?.h
        if (
          response.data?.success !== true ||
          boxH == null ||
          alignedLayout.length !== nextLayoutList.length
        ) {
          throw new Error('整列APIから有効な配置結果が返されませんでした。')
        }

        const nextDraft = {
          ...previousDraft,
          layout: alignedLayout,
          floor: response.data?.f ?? {},
          nrow: response.data?.n ?? 0,
          boxH,
          layout_version: 2,
        }
        setDraftLayout(nextDraft)
        setDirty(true)
        setInfoMessage('整列配置を作業中のデータへ反映しました。')
        await requestEditableSvg(nextDraft)
      } catch (error) {
        console.error('[LayoutEditDialog] postLineUp v2 failed', error)
        setDraftLayout(previousDraft)
        setInfoMessage('移動前の整列済み配置へ戻しました。')
        await requestEditableSvg(previousDraft)
        setErrorMessage(
          getLineUpConflictMessage(
            error,
            '整列配置に失敗しました。移動前の配置を保持しています。',
          ),
        )
      } finally {
        setLiningUp(false)
      }
    },
    [requestEditableSvg],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (busy) return

      const svg = innerSvgRef.current
      const group = getTopLevelUnitTarget(event.target, svg)
      if (!group || !svg) return

      const unitIndex = getUnitIndex(group)
      const canDrag = Array.isArray(draftLayout?.layout)
        ? draftLayout.layout.some(
            (item: AnyRecord) => String(item.i) === String(unitIndex),
          )
        : false
      if (!unitIndex || !canDrag) return

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      setSelectedUnitId(unitIndex)
      setSelectedUnitLabel(
        group.dataset.unitNo || group.dataset.unitKey || group.id.split('#')[0] || '',
      )

      const currentPoint = getSvgPoint(svg, event)
      const translate = extractTranslate(group.getAttribute('transform'))
      group.style.cursor = 'grabbing'
      draggingRef.current = {
        element: group,
        unitIndex,
        pointerId: event.pointerId,
        originalTransform: group.getAttribute('transform') ?? 'translate(0, 0)',
        offsetX: currentPoint.x - translate.x,
        offsetY: currentPoint.y - translate.y,
      }
    },
    [busy, draftLayout],
  )

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = draggingRef.current
    const svg = innerSvgRef.current
    if (!drag || !svg || drag.pointerId !== event.pointerId) return

    event.preventDefault()
    const point = getSvgPoint(svg, event)
    const x = point.x - drag.offsetX
    const y = point.y - drag.offsetY
    drag.element.setAttribute('transform', `translate(${x}, ${y})`)
    setPosition(`X ${Math.round(x)} / Y ${Math.round(y)}`)
  }, [])

  const handlePointerUp = useCallback(
    async (event: ReactPointerEvent<HTMLElement>) => {
      const drag = draggingRef.current
      const svg = innerSvgRef.current
      if (!drag || !svg || drag.pointerId !== event.pointerId) return

      event.preventDefault()
      draggingRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      drag.element.style.cursor = 'grab'

      const point = getSvgPoint(svg, event)
      const rawX = point.x - drag.offsetX
      const rawY = point.y - drag.offsetY
      const target = getSnapTarget(rawX, columns)
      const minY = toNumber(boxg[target.column - 1], 150)
      const y = Math.max(minY, rawY)
      const sourceUnit = Array.isArray(draftLayout?.layout)
        ? draftLayout.layout.find(
            (item: AnyRecord) => String(item.i) === String(drag.unitIndex),
          )
        : null
      const unitWidth = toNumber(drag.element.dataset.width ?? sourceUnit?.w)
      const renderX = target.x + (target.width - unitWidth) / 2

      drag.element.setAttribute('transform', `translate(${renderX}, ${y})`)
      setPosition(
        `列 ${target.column} / X ${Math.round(target.layoutX)} / Y ${Math.round(y)}`,
      )

      const previousDraft = clone(draftLayout)
      const nextLayoutList = moveLayoutUnit(
        clone(draftLayout?.layout ?? []),
        drag.unitIndex,
        target.column,
        y,
        toNumber(sourceUnit?.h ?? drag.element.dataset.height),
      )

      setDraftLayout({ ...draftLayout, layout: nextLayoutList })
      await updateLineUp(previousDraft, nextLayoutList)
    },
    [boxg, columns, draftLayout, updateLineUp],
  )

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = draggingRef.current
      if (!drag || drag.pointerId !== event.pointerId) return

      drag.element.setAttribute('transform', drag.originalTransform)
      drag.element.style.cursor = 'grab'
      draggingRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      setPosition('')
    },
    [],
  )

  const handleApply = useCallback(() => {
    if (busy || !onLayoutChange) return
    onLayoutChange(clone(draftLayout))
    onClose()
    onApplied?.()
  }, [busy, draftLayout, onApplied, onClose, onLayoutChange])

  const handleCancel = useCallback(() => {
    if (busy) return
    if (dirty && !window.confirm('未反映の配置変更を破棄しますか？')) return
    onClose()
  }, [busy, dirty, onClose])

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayerVisibility((current) => ({ ...current, [key]: !current[key] }))
  }, [])

  return (
    <Dialog open={open} onClose={handleCancel} fullWidth maxWidth="xl">
      <DialogTitle>配置編集</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Chip label={boxCode} color="primary" />
              <Chip
                label={`ユニット ${selectedUnitLabel || '未選択'}`}
                variant="outlined"
              />
              {selectedUnitId && (
                <Chip label={`ID ${selectedUnitId}`} variant="outlined" />
              )}
              {position && <Typography variant="body2">{position}</Typography>}
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  setZoom((value) => Math.max(ZOOM_MIN, value - ZOOM_STEP))
                }
                disabled={zoom <= ZOOM_MIN}
              >
                −
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  setZoom((value) => Math.min(ZOOM_MAX, value + ZOOM_STEP))
                }
                disabled={zoom >= ZOOM_MAX}
              >
                ＋
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setZoom(ZOOM_INITIAL)}
              >
                Reset
              </Button>
              <Typography
                variant="body2"
                sx={{ minWidth: 54, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              >
                {Math.round(zoom * 100)}%
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              size="small"
              label="ユニット"
              sx={{
                borderColor: '#2563eb',
                color: '#2563eb',
                bgcolor: '#2563eb14',
                fontWeight: 700,
              }}
              variant="outlined"
            />
            {LAYER_CONFIG.map((layer) => (
              <Chip
                key={layer.key}
                size="small"
                clickable
                label={layer.label}
                variant={layerVisibility[layer.key] ? 'filled' : 'outlined'}
                onClick={() => toggleLayer(layer.key)}
                sx={{
                  borderColor: layer.color,
                  color: layerVisibility[layer.key] ? '#fff' : layer.color,
                  bgcolor: layerVisibility[layer.key] ? layer.color : `${layer.color}14`,
                  fontWeight: 700,
                  '&:hover': {
                    bgcolor: layerVisibility[layer.key]
                      ? layer.color
                      : `${layer.color}24`,
                  },
                }}
              />
            ))}
          </Stack>

          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            <Typography variant="body2">高さ: {boxHeight}</Typography>
            <Typography variant="body2">
              列幅: {JSON.stringify(draftLayout?.floor ?? {})}
            </Typography>
            <Typography variant="body2">
              ULF: {JSON.stringify(draftLayout?.ulf ?? {})}
            </Typography>
          </Stack>

          {infoMessage && <Alert severity="info">{infoMessage}</Alert>}
          {errorMessage && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => void requestEditableSvg(draftLayout)}
                  disabled={busy}
                >
                  再試行
                </Button>
              }
            >
              {errorMessage}
            </Alert>
          )}
          {liningUp && <Alert severity="info">整列配置を実行中です。</Alert>}
          {generatingSvg && (
            <Alert severity="info">結果2Dデザインの配置編集SVGを生成中です。</Alert>
          )}

          <Divider />

          <Paper
            variant="outlined"
            sx={{
              p: 1,
              height: 720,
              overflow: 'auto',
              bgcolor: '#f8fafc',
            }}
          >
            {editableSvgText ? (
              <Box
                sx={{
                  width: Math.max(320, canvasSize.width * zoom),
                  height: Math.max(360, canvasSize.height * zoom),
                }}
              >
                <Box
                  ref={canvasHostRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  sx={{
                    width: '100%',
                    height: '100%',
                    userSelect: 'none',
                    touchAction: 'none',
                    '& > svg': {
                      display: 'block',
                      width: '100%',
                      height: '100%',
                    },
                  }}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  height: 360,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 2,
                }}
              >
                <Typography color="text.secondary">
                  {generatingSvg
                    ? '配置編集用SVGを生成しています。'
                    : '配置編集用SVGデータがありません。'}
                </Typography>
              </Box>
            )}
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={busy}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={busy || !dirty || !onLayoutChange}
        >
          反映
        </Button>
      </DialogActions>
    </Dialog>
  )
}
