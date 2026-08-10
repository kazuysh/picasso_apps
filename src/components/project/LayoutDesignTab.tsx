import { useCallback, useMemo, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import LayoutEditDialog from './LayoutEditDialog'
import { useConfigStore } from '../../stores/useConfigStore'

type AnyRecord = Record<string, unknown>

type LayoutDesignTabProps = {
  svgText?: string
  input?: AnyRecord
  layout?: AnyRecord
  onInputChange?: (nextInput: AnyRecord) => void
  onLayoutChange?: (nextLayout: AnyRecord) => void
  onLayoutEditApplied?: () => void
}

type GutterRow = {
  id: string
  index: number
  north: string
  south: string
  unitName: string
}

type SelectedGutterUnit = {
  index: number
  unit: AnyRecord
}

type BoxSettingsForm = {
  inputWire: string
  outputWire: string
  selectedCategory: string
  selectedArea: string
  selectedStandard: string
  topGutters: string[]
  bottomGutter: string
  boxWidths: string[]
  boxHeight: string
}

const DEFAULT_BOX_WIDTHS = ['0', '500', '20', '500', '20', '500', '20']
const BOX_WIDTH_LABELS = ['G0', 'W0', 'G1', 'W1', 'G2', 'W2', 'G3']
const BOX_WIDTH_FIELDS = [
  'f_lgutter',
  'i_floor1',
  'i_clgutter',
  'i_floor2',
  'i_crgutter',
  'i_floor3',
  'f_rgutter',
] as const
const BOX_GUTTER_WIDTH_INDICES = new Set([0, 2, 4, 6])
const BOX_WIDTH_GRID_ITEMS = [
  { index: 0, label: 'Left / G0', column: '1' },
  { index: 1, label: 'Area1 / W0', column: '2' },
  { index: 2, label: 'Gt1 / G1', column: '3' },
  { index: 3, label: 'Area2 / W1', column: '4' },
  { index: 4, label: 'Gt2 / G2', column: '5' },
  { index: 5, label: 'Area3 / W2', column: '6' },
  { index: 6, label: 'Right / G3', column: '7' },
] as const
const BOX_DIALOG_FIELD_SX = {
  '& .MuiInputBase-root': {
    height: 36,
    borderRadius: 0,
    backgroundColor: '#fff',
  },
  '& .MuiInputLabel-root': {
    fontSize: 12,
  },
  '& input': {
    fontSize: 13,
    py: 0,
  },
}
const BOX_DIALOG_SECTION_HEADER_SX = {
  bgcolor: '#0071bc',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  px: 1,
  py: 0.5,
  lineHeight: 1.4,
}

const ZOOM_STEP = 0.4
const ZOOM_MIN = 0.25
const ZOOM_MAX = 4
const ZOOM_INITIAL = 0.5
const UNIT_OUTLINE_GROUP_SELECTOR = '#unit-outlines, .unit-outlines'
const UNIT_OUTLINE_RECT_SELECTOR = '#unit-outlines rect, .unit-outlines rect'
const UNIT_OUTLINE_TEXT_SELECTOR = '#unit-outlines text, .unit-outlines text'
const UNIT_NAME_ATTRIBUTE_NAMES = [
  'data-unit-name',
  'data-unit-no',
  'data-unit',
  'unit_no',
  'unitNo',
  'name',
  'aria-label',
  'title',
]
const UNIT_TOKEN_ATTRIBUTE_NAMES = [
  'id',
  'data-unit-i',
  'data-unit-id',
  'data-unit-key',
  'data-id',
  'data-key',
  'unit_id',
  'unit_key',
  'unitKey',
  'key',
  'uid',
  'i',
]
const UNIT_INDIVIDUAL_ID_FIELDS = ['i', 'id', 'unit_i', 'unitId', 'uid', 'unit_key', 'k', 'key']

function clampZoom(value: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(value.toFixed(2))))
}

function isRecord(value: unknown): value is AnyRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function hasValue(value: unknown) {
  return value != null && String(value).trim() !== ''
}

function registerUnitToken(map: Map<string, string>, token: unknown, unitName: unknown) {
  if (!hasValue(token) || !hasValue(unitName)) return
  map.set(String(token), String(unitName))
}

function getRecordUnitName(record: AnyRecord) {
  return record.unit_no ?? record.unitNo ?? record.u ?? record.name ?? record.unit_key ?? record.k ?? record.key ?? record.uid ?? record.id
}

function getRecordIndividualId(record: AnyRecord) {
  for (const field of UNIT_INDIVIDUAL_ID_FIELDS) {
    const value = record[field]
    if (hasValue(value)) return String(value)
  }

  return ''
}

function getLayoutList(layout: AnyRecord) {
  return Array.isArray(layout.layout) ? layout.layout.filter(isRecord) : []
}

function buildUnitNameLookup(input: AnyRecord, layout: AnyRecord) {
  const lookup = new Map<string, string>()
  const inputUnit = input.unit
  const inputUnitList = isRecord(inputUnit) && Array.isArray(inputUnit.list) ? inputUnit.list : []
  const layoutList = getLayoutList(layout)

  inputUnitList.filter(isRecord).forEach((unit) => {
    const unitName = getRecordUnitName(unit)
    ;[unit.id, unit.unit_no, unit.unitNo, unit.unit_key, unit.key, unit.uid, unit.name, unit.i].forEach((token) =>
      registerUnitToken(lookup, token, unitName),
    )
  })

  layoutList.forEach((unit) => {
    const unitName = getRecordUnitName(unit)
    ;[unit.i, unit.id, unit.unit_no, unit.unitNo, unit.u, unit.unit_key, unit.k, unit.key, unit.uid, unit.name].forEach((token) =>
      registerUnitToken(lookup, token, unitName),
    )
  })

  return lookup
}

function formatGutterValue(value: unknown) {
  return hasValue(value) ? String(value) : '-'
}

function getRecordNorthGutter(record: AnyRecord) {
  return record.gtop ?? record.i_north ?? record.north ?? record.North
}

function getRecordSouthGutter(record: AnyRecord) {
  return record.gbottom ?? record.i_south ?? record.south ?? record.South
}

function buildGutterRows(layout: AnyRecord) {
  return getLayoutList(layout).map((unit, index): GutterRow => ({
    id: getRecordIndividualId(unit) || String(index + 1),
    index,
    unitName: formatGutterValue(getRecordUnitName(unit)),
    north: formatGutterValue(getRecordNorthGutter(unit)),
    south: formatGutterValue(getRecordSouthGutter(unit)),
  }))
}

function getLayoutUnitIndexByClickedUnit(
  layout: AnyRecord,
  clickedUnit: NonNullable<ReturnType<typeof getClickedUnitName>>,
) {
  const layoutList = getLayoutList(layout)

  if (clickedUnit.individualId) {
    const index = layoutList.findIndex(
      (unit) => getRecordIndividualId(unit) === clickedUnit.individualId,
    )
    if (index >= 0) return index
  }

  let occurrenceIndex = 0
  for (let index = 0; index < layoutList.length; index += 1) {
    const unit = layoutList[index]
    if (String(getRecordUnitName(unit) ?? '') !== clickedUnit.unitName) continue
    if (occurrenceIndex === clickedUnit.occurrenceIndex) return index
    occurrenceIndex += 1
  }

  return -1
}

function parseGutterInput(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return ''

  const numericValue = Number(trimmedValue)
  return Number.isFinite(numericValue) ? numericValue : trimmedValue
}

function getCabinfo(input: AnyRecord) {
  return isRecord(input.cabinfo) ? input.cabinfo : {}
}

function normalizeStringArray(value: unknown, length: number, fallback = '') {
  const source = Array.isArray(value) ? value : []
  return Array.from({ length }, (_, index) => String(source[index] ?? fallback))
}

function getBoxWidthSegments(layout: AnyRecord) {
  const box = isRecord(layout.box) ? layout.box : {}
  const hasBoxWidthFields = BOX_WIDTH_FIELDS.some((field) => hasValue(box[field]))

  if (hasBoxWidthFields) {
    return BOX_WIDTH_FIELDS.map((field, index) => String(box[field] ?? DEFAULT_BOX_WIDTHS[index] ?? ''))
  }

  const sourceBoxw = Array.isArray(layout.boxw) && layout.boxw.length === 6
    ? ['0', ...layout.boxw]
    : layout.boxw

  return normalizeStringArray(sourceBoxw, BOX_WIDTH_LABELS.length)
    .map((value, index) => (hasValue(value) ? value : DEFAULT_BOX_WIDTHS[index] ?? ''))
}

function patchBoxWidthFields(box: unknown, boxWidths: string[]) {
  const nextBox = isRecord(box) ? { ...box } : {}
  BOX_WIDTH_FIELDS.forEach((field, index) => {
    nextBox[field] = parseBoxSettingsValue(boxWidths[index] ?? '')
  })
  return nextBox
}

function buildBoxSettingsForm(input: AnyRecord, layout: AnyRecord): BoxSettingsForm {
  const cabinfo = getCabinfo(input)

  return {
    inputWire: String(cabinfo.input_wire ?? ''),
    outputWire: String(cabinfo.output_wire ?? ''),
    selectedCategory: String(cabinfo.selectedcategory ?? ''),
    selectedArea: String(cabinfo.selectedarea ?? ''),
    selectedStandard: String(cabinfo.selectedstandard ?? ''),
    topGutters: normalizeStringArray(layout.boxg, 3),
    bottomGutter: String(layout.boxgb ?? ''),
    boxWidths: getBoxWidthSegments(layout),
    boxHeight: String((isRecord(layout.box) ? layout.box.i_box_h : undefined) ?? layout.boxh ?? layout.boxH ?? ''),
  }
}

function formatBoxSummaryValue(value: unknown) {
  return hasValue(value) ? String(value) : '-'
}

function parseBoxSettingsValue(value: string) {
  return value.trim()
}

function getObjectKeys(value: unknown) {
  return isRecord(value) ? Object.keys(value) : []
}

function getStringOptions(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

// サーバー生成SVGの data-unit-i を個別IDとして優先する。
// 属性がない古いSVGだけ、同名ユニットの出現順で layout.layout にフォールバックする。
function getDirectChildText(element: Element, tagName: string) {
  const child = Array.from(element.children).find(
    (item) => item.tagName.toLowerCase() === tagName,
  )
  return child?.textContent?.trim() || ''
}

function getSvgPoint(svg: SVGSVGElement, event: ReactMouseEvent) {
  const bounds = svg.getBoundingClientRect()
  const viewBox = svg.viewBox.baseVal
  const svgWidth = viewBox?.width || svg.width.baseVal.value || bounds.width
  const svgHeight = viewBox?.height || svg.height.baseVal.value || bounds.height
  const svgX = viewBox?.x || 0
  const svgY = viewBox?.y || 0

  if (bounds.width === 0 || bounds.height === 0) {
    return { x: event.clientX, y: event.clientY }
  }

  return {
    x: svgX + ((event.clientX - bounds.left) / bounds.width) * svgWidth,
    y: svgY + ((event.clientY - bounds.top) / bounds.height) * svgHeight,
  }
}

function getNumberAttribute(element: Element, name: string) {
  const value = Number(element.getAttribute(name))
  return Number.isFinite(value) ? value : 0
}

function isPointInRect(point: { x: number; y: number }, rect: SVGRectElement) {
  const x = getNumberAttribute(rect, 'x')
  const y = getNumberAttribute(rect, 'y')
  const width = getNumberAttribute(rect, 'width')
  const height = getNumberAttribute(rect, 'height')

  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height
}

function getSiblingText(element: Element) {
  const next = element.nextElementSibling
  if (next?.tagName.toLowerCase() === 'text') return next.textContent?.trim() || ''

  const previous = element.previousElementSibling
  if (previous?.tagName.toLowerCase() === 'text') return previous.textContent?.trim() || ''

  return ''
}

function getElementIndividualId(element: Element) {
  return element.getAttribute('data-unit-i') || element.getAttribute('data-unit-id') || element.getAttribute('i') || ''
}

function getTokenCandidates(rawValue: string) {
  const value = rawValue.trim()
  const withoutPrefix = value
    .replace(/^unit[-_\s]?outlines?[-_\s:]*/i, '')
    .replace(/^unit[-_\s:]*/i, '')
    .replace(/^outline[-_\s:]*/i, '')
  const tail = value.split(/[@:#/]/).pop() || value

  return [value, withoutPrefix, tail].filter((item, index, list) => item && list.indexOf(item) === index)
}

function getUnitNameFromOutlineElement(element: Element, unitNameLookup: Map<string, string>) {
  for (const attributeName of UNIT_NAME_ATTRIBUTE_NAMES) {
    const value = element.getAttribute(attributeName)
    if (!hasValue(value)) continue

    for (const candidate of getTokenCandidates(String(value))) {
      const unitName = unitNameLookup.get(candidate)
      if (unitName) return unitName
    }

    return String(value)
  }

  for (const attributeName of UNIT_TOKEN_ATTRIBUTE_NAMES) {
    const value = element.getAttribute(attributeName)
    if (!hasValue(value)) continue

    for (const candidate of getTokenCandidates(String(value))) {
      const unitName = unitNameLookup.get(candidate)
      if (unitName) return unitName
    }
  }

  const titleText = getDirectChildText(element, 'title')
  if (titleText) return unitNameLookup.get(titleText) ?? titleText

  const text = element.querySelector('text')?.textContent?.trim()
  return text ? (unitNameLookup.get(text) ?? text) : ''
}

function getUnitOutlineNameAtIndex(svg: SVGSVGElement, outlineIndex: number, unitNameLookup: Map<string, string>) {
  const rects = Array.from(svg.querySelectorAll<SVGRectElement>(UNIT_OUTLINE_RECT_SELECTOR))
  const rect = rects[outlineIndex]
  if (!rect) return ''

  const unitName =
    getUnitNameFromOutlineElement(rect, unitNameLookup) ||
    getSiblingText(rect)

  return unitName ? (unitNameLookup.get(unitName) ?? unitName) : ''
}

function getUnitNameOccurrenceIndex(
  svg: SVGSVGElement,
  outlineIndex: number,
  unitName: string,
  unitNameLookup: Map<string, string>,
) {
  let occurrenceIndex = 0

  for (let index = 0; index < outlineIndex; index += 1) {
    if (getUnitOutlineNameAtIndex(svg, index, unitNameLookup) === unitName) {
      occurrenceIndex += 1
    }
  }

  return occurrenceIndex
}

function getClickedUnitName(
  svg: SVGSVGElement,
  event: ReactMouseEvent,
  unitNameLookup: Map<string, string>,
) {
  const target = event.target instanceof Element ? event.target : null
  const clickedText = target?.closest(UNIT_OUTLINE_TEXT_SELECTOR)
  if (clickedText) {
    const text = clickedText.textContent?.trim() || ''
    if (!text) return null

    const texts = Array.from(svg.querySelectorAll<SVGTextElement>(UNIT_OUTLINE_TEXT_SELECTOR))
    const outlineIndex = Math.max(0, texts.indexOf(clickedText as SVGTextElement))
    const unitName = unitNameLookup.get(text) ?? text

    return {
      individualId: getElementIndividualId(clickedText),
      outlineIndex,
      occurrenceIndex: getUnitNameOccurrenceIndex(svg, outlineIndex, unitName, unitNameLookup),
      unitName,
    }
  }

  const point = getSvgPoint(svg, event)
  const rects = Array.from(svg.querySelectorAll<SVGRectElement>(UNIT_OUTLINE_RECT_SELECTOR))
  const outlineIndex = rects.findIndex((item) => isPointInRect(point, item))
  const rect = outlineIndex >= 0 ? rects[outlineIndex] : null
  if (!rect) return null

  const unitName =
    getUnitNameFromOutlineElement(rect, unitNameLookup) ||
    getSiblingText(rect)
  const resolvedUnitName = unitName ? (unitNameLookup.get(unitName) ?? unitName) : ''
  if (!resolvedUnitName) return null

  return {
    individualId: getElementIndividualId(rect),
    outlineIndex,
    occurrenceIndex: getUnitNameOccurrenceIndex(svg, outlineIndex, resolvedUnitName, unitNameLookup),
    unitName: resolvedUnitName,
  }
}

function SvgView({
  svgText,
  toolbarStart,
  input,
  layout,
  onInputChange,
  onLayoutChange,
}: {
  svgText?: string
  toolbarStart: ReactNode
  input: AnyRecord
  layout: AnyRecord
  onInputChange?: (nextInput: AnyRecord) => void
  onLayoutChange?: (nextLayout: AnyRecord) => void
}) {
  const [scale, setScale] = useState(ZOOM_INITIAL)
  const [selectedGutterUnit, setSelectedGutterUnit] = useState<SelectedGutterUnit | null>(null)
  const [northGutter, setNorthGutter] = useState('')
  const [southGutter, setSouthGutter] = useState('')
  const [boxDialogOpen, setBoxDialogOpen] = useState(false)
  const [boxSettingsForm, setBoxSettingsForm] = useState<BoxSettingsForm>(() => buildBoxSettingsForm(input, layout))

  const config = useConfigStore((state) => state.config)
  const zoomPercent = useMemo(() => Math.round(scale * 100), [scale])
  const cabinfo = useMemo(() => getCabinfo(input), [input])
  const unitNameLookup = useMemo(() => buildUnitNameLookup(input, layout), [input, layout])
  const gutterRows = useMemo(() => buildGutterRows(layout), [layout])
  const boxGutterStore = useMemo(() => (isRecord(config.BoxGutter) ? config.BoxGutter : {}), [config])
  const cabinetInfoOptions = useMemo(
    () => (isRecord(config.CabinetinfoOption) ? config.CabinetinfoOption : {}),
    [config],
  )
  const inputWireOptions = useMemo(() => getStringOptions(cabinetInfoOptions.input_wire), [cabinetInfoOptions])
  const outputWireOptions = useMemo(() => getStringOptions(cabinetInfoOptions.output_wire), [cabinetInfoOptions])
  const categoryOptions = useMemo(
    () => [boxSettingsForm.selectedCategory, ...getObjectKeys(boxGutterStore[boxSettingsForm.inputWire])]
      .filter((value, index, list) => value && list.indexOf(value) === index),
    [boxGutterStore, boxSettingsForm.inputWire, boxSettingsForm.selectedCategory],
  )
  const areaOptions = useMemo(() => {
    const categoryStore: AnyRecord = isRecord(boxGutterStore[boxSettingsForm.inputWire])
      ? boxGutterStore[boxSettingsForm.inputWire] as AnyRecord
      : {}
    return [boxSettingsForm.selectedArea, ...getObjectKeys(categoryStore[boxSettingsForm.selectedCategory])]
      .filter((value, index, list) => value && list.indexOf(value) === index)
  }, [boxGutterStore, boxSettingsForm.inputWire, boxSettingsForm.selectedArea, boxSettingsForm.selectedCategory])
  const standardOptions = useMemo(() => {
    const categoryStore: AnyRecord = isRecord(boxGutterStore[boxSettingsForm.inputWire])
      ? boxGutterStore[boxSettingsForm.inputWire] as AnyRecord
      : {}
    const areaStore: AnyRecord = isRecord(categoryStore[boxSettingsForm.selectedCategory])
      ? categoryStore[boxSettingsForm.selectedCategory] as AnyRecord
      : {}
    return [boxSettingsForm.selectedStandard, ...getObjectKeys(areaStore[boxSettingsForm.selectedArea])]
      .filter((value, index, list) => value && list.indexOf(value) === index)
  }, [boxGutterStore, boxSettingsForm.inputWire, boxSettingsForm.selectedArea, boxSettingsForm.selectedCategory, boxSettingsForm.selectedStandard])

  const zoomIn = () => {
    setScale((prev) => clampZoom(prev + ZOOM_STEP))
  }

  const zoomOut = () => {
    setScale((prev) => clampZoom(prev - ZOOM_STEP))
  }

  const resetZoom = () => {
    setScale(1)
  }

  const openGutterDialog = useCallback((index: number) => {
    const unit = getLayoutList(layout)[index]
    if (!unit) return

    setSelectedGutterUnit({ index, unit })
    setNorthGutter(formatGutterValue(getRecordNorthGutter(unit)) === '-' ? '' : String(getRecordNorthGutter(unit)))
    setSouthGutter(formatGutterValue(getRecordSouthGutter(unit)) === '-' ? '' : String(getRecordSouthGutter(unit)))
  }, [layout])

  const closeGutterDialog = useCallback(() => {
    setSelectedGutterUnit(null)
  }, [])

  const openBoxDialog = useCallback(() => {
    setBoxSettingsForm(buildBoxSettingsForm(input, layout))
    setBoxDialogOpen(true)
  }, [input, layout])

  const closeBoxDialog = useCallback(() => {
    setBoxDialogOpen(false)
  }, [])

  const updateBoxSettingsField = useCallback(
    (field: keyof Omit<BoxSettingsForm, 'topGutters' | 'boxWidths'>, value: string) => {
      setBoxSettingsForm((prev) => ({
        ...prev,
        [field]: value,
      }))
    },
    [],
  )

  const updateBoxSettingsArrayField = useCallback(
    (field: 'topGutters' | 'boxWidths', index: number, value: string) => {
      setBoxSettingsForm((prev) => ({
        ...prev,
        [field]: prev[field].map((item, itemIndex) => (itemIndex === index ? value : item)),
      }))
    },
    [],
  )

  const saveBoxDialog = useCallback(() => {
    if (onInputChange) {
      const currentCabinfo = getCabinfo(input)
      onInputChange({
        ...input,
        cabinfo: {
          ...currentCabinfo,
          input_wire: boxSettingsForm.inputWire,
          output_wire: boxSettingsForm.outputWire,
          selectedcategory: boxSettingsForm.selectedCategory,
          selectedarea: boxSettingsForm.selectedArea,
          selectedstandard: boxSettingsForm.selectedStandard,
        },
      })
    }

    if (onLayoutChange) {
      onLayoutChange({
        ...layout,
        box: patchBoxWidthFields(layout.box, boxSettingsForm.boxWidths),
        boxg: boxSettingsForm.topGutters.map(parseBoxSettingsValue),
        boxgb: parseBoxSettingsValue(boxSettingsForm.bottomGutter),
        boxw: boxSettingsForm.boxWidths.map(parseBoxSettingsValue),
        boxh: parseBoxSettingsValue(boxSettingsForm.boxHeight),
      })
    }

    closeBoxDialog()
  }, [boxSettingsForm, closeBoxDialog, input, layout, onInputChange, onLayoutChange])

  const calcGutter = useCallback(() => {
    setBoxSettingsForm((prev) => {
      if (!prev.selectedStandard) return prev

      const inputWireStore: AnyRecord = isRecord(boxGutterStore[prev.inputWire])
        ? boxGutterStore[prev.inputWire] as AnyRecord
        : {}
      const categoryStore: AnyRecord = isRecord(inputWireStore[prev.selectedCategory])
        ? inputWireStore[prev.selectedCategory] as AnyRecord
        : {}
      const areaStore: AnyRecord = isRecord(categoryStore[prev.selectedArea])
        ? categoryStore[prev.selectedArea] as AnyRecord
        : {}
      const gutterData = areaStore[prev.selectedStandard]

      if (!Array.isArray(gutterData)) return prev

      return {
        ...prev,
        topGutters: [gutterData[0], gutterData[0], gutterData[0]].map((value) => String(value ?? '')),
        bottomGutter: String(gutterData[1] ?? ''),
        boxWidths: prev.boxWidths.map((value, index) =>
          BOX_GUTTER_WIDTH_INDICES.has(index) ? String(gutterData[2] ?? '') : value,
        ),
      }
    })
  }, [boxGutterStore])

  const saveGutterDialog = useCallback(() => {
    if (!selectedGutterUnit || !onLayoutChange) return

    const sourceLayoutList = Array.isArray(layout.layout) ? layout.layout : []
    const nextLayoutList = sourceLayoutList.map((unit, index) => {
      if (index !== selectedGutterUnit.index || !isRecord(unit)) return unit

      return {
        ...unit,
        gtop: parseGutterInput(northGutter),
        gbottom: parseGutterInput(southGutter),
      }
    })

    onLayoutChange({
      ...layout,
      layout: nextLayoutList,
    })
    closeGutterDialog()
  }, [closeGutterDialog, layout, northGutter, onLayoutChange, selectedGutterUnit, southGutter])

  const handleSvgClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const svg = event.currentTarget.querySelector('svg')
      if (!svg) return

      const clickedUnit = getClickedUnitName(svg, event, unitNameLookup)
      if (!clickedUnit) return
      const unitIndex = getLayoutUnitIndexByClickedUnit(layout, clickedUnit)
      if (unitIndex < 0) return
      openGutterDialog(unitIndex)
    },
    [layout, openGutterDialog, unitNameLookup],
  )

  if (!svgText) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          {toolbarStart}
        </Stack>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            minHeight: 420,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#fafafa',
          }}
        >
          <Typography color="text.secondary">SVGデータがありません</Typography>
        </Paper>
      </Box>
    )
  }

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
        useFlexGap
        flexWrap="wrap"
        sx={{ mb: 1 }}
      >
        {toolbarStart}
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
          <Button variant="outlined" size="small" onClick={zoomOut}>
            −
          </Button>
          <Button variant="outlined" size="small" onClick={zoomIn}>
            ＋
          </Button>
          <Button variant="outlined" size="small" onClick={resetZoom}>
            Reset
          </Button>
          <Typography
            variant="body2"
            sx={{
              minWidth: 64,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {zoomPercent}%
          </Typography>
        </Stack>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          minHeight: 420,
          width: '100%',
          height: 800,
          overflow: 'auto',
          bgcolor: '#fafafa',
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'flex-start',
            gap: 2,
          }}
        >
          <Box
            sx={{
              flex: '0 0 auto',
              width: 300,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: '#fff',
              overflow: 'hidden',
            }}
          >
            <Box
              role="button"
              tabIndex={0}
              onClick={openBoxDialog}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openBoxDialog()
                }
              }}
              sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: '#f8fafc',
                },
              }}
            >
              <Box
                sx={{
                  px: 1,
                  py: 0.5,
                  bgcolor: '#f3f4f6',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  実装高さ 入出線設定
                </Typography>
              </Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '48px minmax(0, 1fr) 56px minmax(0, 1fr)',
                  columnGap: 1,
                  rowGap: 0.5,
                  alignItems: 'baseline',
                  px: 1,
                  py: 1,
                }}
              >
                {[
                  ['入線', cabinfo.input_wire, '種別', cabinfo.selectedcategory],
                  ['出線', cabinfo.output_wire, '断面積', cabinfo.selectedarea],
                  [
                    '高さ',
                    (isRecord(layout.box) ? layout.box.i_box_h : undefined) ?? layout.boxh ?? layout.boxH,
                    '規格',
                    cabinfo.selectedstandard,
                  ],
                ].flatMap((row, rowIndex) =>
                  row.map((value, columnIndex) => (
                    <Typography
                      key={`${rowIndex}-${columnIndex}`}
                      variant="body2"
                      sx={{
                        color: columnIndex % 2 === 0 ? 'text.secondary' : 'text.primary',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {columnIndex % 2 === 0 ? String(value) : formatBoxSummaryValue(value)}
                    </Typography>
                  )),
                )}
              </Box>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(120px, 1fr) 64px 64px',
                columnGap: 1,
                px: 1,
                py: 0.75,
                bgcolor: '#f3f4f6',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              {['ユニット名', 'North', 'South'].map((label) => (
                <Typography
                  key={label}
                  variant="caption"
                  sx={{ fontWeight: 700, color: 'text.secondary' }}
                >
                  {label}
                </Typography>
              ))}
            </Box>
            {gutterRows.length > 0 ? (
              gutterRows.map((row, index) => (
                <Box
                  key={`${row.id}-${index}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openGutterDialog(row.index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openGutterDialog(row.index)
                    }
                  }}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(120px, 1fr) 64px 64px',
                    columnGap: 1,
                    px: 1,
                    py: 0.75,
                    borderBottom: index === gutterRows.length - 1 ? 0 : '1px solid',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    minHeight: 32,
                    '&:hover': {
                      bgcolor: '#f8fafc',
                    },
                  }}
                >
                  {[row.unitName, row.north, row.south].map((value, valueIndex) => (
                    <Typography
                      key={valueIndex}
                      variant="body2"
                      title={value}
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {value}
                    </Typography>
                  ))}
                </Box>
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 1 }}>
                ガターデータがありません
              </Typography>
            )}
          </Box>
          <Box
            onClick={handleSvgClick}
            sx={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              [`& ${UNIT_OUTLINE_GROUP_SELECTOR}`]: {
                cursor: 'pointer',
              },
              [`& ${UNIT_OUTLINE_RECT_SELECTOR}`]: {
                cursor: 'pointer',
                pointerEvents: 'all',
              },
              [`& ${UNIT_OUTLINE_TEXT_SELECTOR}`]: {
                cursor: 'pointer',
              },
            }}
            dangerouslySetInnerHTML={{ __html: svgText }}
          />
        </Box>
      </Paper>

      <Dialog open={Boolean(selectedGutterUnit)} onClose={closeGutterDialog} fullWidth maxWidth="xs">
        <DialogTitle>ガター編集</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="ユニット名"
              value={selectedGutterUnit ? formatGutterValue(getRecordUnitName(selectedGutterUnit.unit)) : ''}
              fullWidth
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="North"
              type="number"
              value={northGutter}
              onChange={(event) => setNorthGutter(event.target.value)}
              fullWidth
              inputProps={{ step: 25 }}
            />
            <TextField
              label="South"
              type="number"
              value={southGutter}
              onChange={(event) => setSouthGutter(event.target.value)}
              fullWidth
              inputProps={{ step: 25 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeGutterDialog}>Cancel</Button>
          <Button variant="contained" onClick={saveGutterDialog} disabled={!onLayoutChange}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={boxDialogOpen} onClose={closeBoxDialog} fullWidth maxWidth="md">
        <DialogTitle>BOX設定</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Box>
              <Box sx={BOX_DIALOG_SECTION_HEADER_SX}>実装高さ 入出線設定</Box>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(120px, 1fr))',
                    md: 'repeat(5, minmax(120px, 1fr))',
                  },
                  gap: 1.5,
                  p: 1,
                  alignItems: 'center',
                }}
              >
                <TextField
                  label="実装高さ"
                  type="number"
                  size="small"
                  value={boxSettingsForm.boxHeight}
                  onChange={(event) => updateBoxSettingsField('boxHeight', event.target.value)}
                  fullWidth
                  inputProps={{ step: 25 }}
                  sx={BOX_DIALOG_FIELD_SX}
                />
                <TextField
                  label="入線"
                  select
                  size="small"
                  value={boxSettingsForm.inputWire}
                  onChange={(event) => {
                    updateBoxSettingsField('inputWire', event.target.value)
                    updateBoxSettingsField('selectedCategory', '')
                    updateBoxSettingsField('selectedArea', '')
                    updateBoxSettingsField('selectedStandard', '')
                  }}
                  fullWidth
                  sx={BOX_DIALOG_FIELD_SX}
                >
                  <MenuItem value="">Clear</MenuItem>
                  {[boxSettingsForm.inputWire, ...inputWireOptions]
                    .filter((value, index, list) => value && list.indexOf(value) === index)
                    .map((value) => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                </TextField>
                <TextField
                  label="種別"
                  select
                  size="small"
                  value={boxSettingsForm.selectedCategory}
                  onChange={(event) => {
                    updateBoxSettingsField('selectedCategory', event.target.value)
                    updateBoxSettingsField('selectedArea', '')
                    updateBoxSettingsField('selectedStandard', '')
                  }}
                  fullWidth
                  sx={BOX_DIALOG_FIELD_SX}
                >
                  <MenuItem value="">Clear</MenuItem>
                  {categoryOptions.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="断面積"
                  select
                  size="small"
                  value={boxSettingsForm.selectedArea}
                  onChange={(event) => {
                    updateBoxSettingsField('selectedArea', event.target.value)
                    updateBoxSettingsField('selectedStandard', '')
                  }}
                  fullWidth
                  sx={BOX_DIALOG_FIELD_SX}
                >
                  <MenuItem value="">Clear</MenuItem>
                  {areaOptions.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="規格"
                  select
                  size="small"
                  value={boxSettingsForm.selectedStandard}
                  onChange={(event) => updateBoxSettingsField('selectedStandard', event.target.value)}
                  fullWidth
                  sx={BOX_DIALOG_FIELD_SX}
                >
                  <MenuItem value="">Clear</MenuItem>
                  {standardOptions.map((value) => (
                    <MenuItem key={value} value={value}>
                      {value}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  onClick={calcGutter}
                  sx={{ height: 36, borderRadius: 0, fontSize: 13, fontWeight: 700 }}
                >
                  Gutter計算
                </Button>
                <TextField
                  label="出線"
                  select
                  size="small"
                  value={boxSettingsForm.outputWire}
                  onChange={(event) => updateBoxSettingsField('outputWire', event.target.value)}
                  fullWidth
                  sx={BOX_DIALOG_FIELD_SX}
                >
                  <MenuItem value="">Clear</MenuItem>
                  {[boxSettingsForm.outputWire, ...outputWireOptions]
                    .filter((value, index, list) => value && list.indexOf(value) === index)
                    .map((value) => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                </TextField>
              </Box>
            </Box>

            <Box>
              <Box sx={BOX_DIALOG_SECTION_HEADER_SX}>ガター設定</Box>
              <Box sx={{ overflowX: 'auto', p: 1 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '120px 130px 90px 130px 90px 130px 120px',
                    gap: 1,
                    minWidth: 850,
                    alignItems: 'center',
                  }}
                >
                  {[0, 1, 2].map((index) => (
                    <TextField
                      key={`top-${index}`}
                      label={`Top${index + 1}`}
                      type="number"
                      size="small"
                      value={boxSettingsForm.topGutters[index] ?? ''}
                      onChange={(event) => updateBoxSettingsArrayField('topGutters', index, event.target.value)}
                      inputProps={{ step: 25 }}
                      sx={{ ...BOX_DIALOG_FIELD_SX, gridColumn: `${2 + index * 2}` }}
                    />
                  ))}

                  {BOX_WIDTH_GRID_ITEMS.map((item) => (
                    <TextField
                      key={item.index}
                      label={item.label}
                      type="number"
                      size="small"
                      value={boxSettingsForm.boxWidths[item.index] ?? ''}
                      onChange={(event) => updateBoxSettingsArrayField('boxWidths', item.index, event.target.value)}
                      inputProps={{ step: 25 }}
                      sx={{ ...BOX_DIALOG_FIELD_SX, gridColumn: item.column }}
                    />
                  ))}

                  {[0, 1, 2].map((index) => (
                    <TextField
                      key={`bottom-${index}`}
                      label={`Bottom${index + 1}`}
                      type="number"
                      size="small"
                      value={boxSettingsForm.bottomGutter}
                      onChange={(event) => updateBoxSettingsField('bottomGutter', event.target.value)}
                      inputProps={{ step: 25 }}
                      sx={{ ...BOX_DIALOG_FIELD_SX, gridColumn: `${2 + index * 2}` }}
                    />
                  ))}
                </Box>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBoxDialog}>Cancel</Button>
          <Button variant="contained" onClick={saveBoxDialog} disabled={!onInputChange && !onLayoutChange}>
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default function LayoutDesignTab({
  svgText,
  input = {},
  layout = {},
  onInputChange,
  onLayoutChange,
  onLayoutEditApplied,
}: LayoutDesignTabProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  return (
    <>
      <SvgView
        svgText={svgText}
        input={input}
        layout={layout}
        onInputChange={onInputChange}
        onLayoutChange={onLayoutChange}
        toolbarStart={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6">配置編集</Typography>
            <Tooltip title="配置編集">
              <IconButton size="small" onClick={() => setEditDialogOpen(true)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      <LayoutEditDialog
        open={editDialogOpen}
        svgText={svgText}
        input={input}
        layout={layout}
        onInputChange={onInputChange}
        onLayoutChange={onLayoutChange}
        onApplied={onLayoutEditApplied}
        onClose={() => setEditDialogOpen(false)}
      />
    </>
  )
}
