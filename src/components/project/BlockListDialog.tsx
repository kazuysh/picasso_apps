import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Button,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useAppStore, type AnyRecord } from '../../stores/useAppStore'
import { saveWork } from '../../api/saveWork'
import DeviceAddEditDialog from './DeviceAddEditDialog'

type BlockListDialogProps = {
  open: boolean
  /** Mermaid上の表示用ノードID。例: UPN10_10_1@10001 */
  circuitBlockId?: string
  /** input.device.list[].id と照合する検索キー。例: 10001 */
  deviceBlockKey?: string
  items?: AnyRecord[]
  onClose: () => void
  onDeleteUnit?: () => void
}

const headers = [
  { title: 'id', key: 'id' },
  { title: 'subunit', key: 'unit' },
  { title: 'block', key: 'block' },
  { title: '系統番号', key: 'path_no' },
  { title: 'phase', key: 'phase' },
  { title: 'cap', key: 'cap' },
  { title: 'type', key: 'type' },
  { title: 'node', key: 'node' },
]

type UnitSvgResponse = {
  ok?: boolean
  uid?: string
  source?: string
  unit?: {
    id?: number | string
    unit_key?: string
    width?: number
    height?: number
  }
  svg?: string
  warnings?: string[]
}

type UnitSvgClickPayload = {
  type?: string
  areaId?: string
  unitId: number
  unitKey?: string
  subunitNo?: string
  blockNo?: string
  deviceName?: string
  deviceLabel?: string
  deviceIndex: number
  slotIndices: number[]
}

type BlockSelection = {
  subunitNo: string
  blockNo: string
}

type DeviceListItem = {
  raw: string
  code: string
  size: string
  quantity: string
  source: string
}

type PlacementDirection = '-' | 'h' | 'v'

function normalize(value: unknown) {
  return String(value ?? '').trim()
}

function stripInstanceSuffix(value: unknown) {
  // 回路側ノードIDは UPN10_10_1@10001 のようにインスタンス番号付き、
  // 機器ブロック側 item.id は UPN10_10_1 のように @ なし、というケースがある。
  return normalize(value).split('@')[0]
}

function getSuffixAfterAt(value: unknown) {
  const text = normalize(value)
  if (!text.includes('@')) return ''
  return text.split('@').pop() || ''
}

function getItemKeyCandidates(item: AnyRecord) {
  // 今回の正規キーは items[].id。
  // ただし過去データやAPI差異に備えて近いキーもログ確認用に残す。
  return [
    item?.id,
    item?.deviceBlockId,
    item?.device_block_id,
    item?.itemId,
    item?.item_id,
    item?.Unit_No,
    item?.unit_no,
    item?.unitNo,
    item?.unit_id,
    item?.unitId,
    item?.block_id,
    item?.blockId,
  ]
    .map(normalize)
    .filter(Boolean)
}

function sameDeviceBlockId(item: AnyRecord, deviceBlockKey?: string, circuitBlockId?: string) {
  const target = normalize(deviceBlockKey)
  const fallbackFromCircuitId = getSuffixAfterAt(circuitBlockId)
  const fallbackOriginal = normalize(circuitBlockId)
  const targets = [target, fallbackFromCircuitId, fallbackOriginal]
    .map(normalize)
    .filter(Boolean)

  if (targets.length === 0) return false

  // 基本は item.id と deviceBlockKey の一致。
  // 念のため id 以外の候補も比較するが、優先すべきは item.id。
  const candidates = getItemKeyCandidates(item)

  return candidates.some((candidate) => targets.includes(candidate))
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

function firstValue(record: AnyRecord | undefined, keys: string[]) {
  if (!record) return ''

  for (const key of keys) {
    const value = record[key]
    if (hasValue(value)) return normalize(value)
  }

  return ''
}

function getDrawingNo(input: AnyRecord) {
  const basic = input.basic as AnyRecord | undefined

  return firstValue(basic, [
    'drawingNoTemp',
    'drawingNo',
    'DrawingNo',
    'drawing_no',
    'dno',
    'DNO',
  ])
}

function getProjectUid(input: AnyRecord, selectedUnit?: AnyRecord) {
  const basic = input.basic as AnyRecord | undefined

  return (
    firstValue(input, ['uid', 'UID', 'projectUid', 'project_uid']) ||
    firstValue(basic, ['uid', 'UID', 'projectUid', 'project_uid']) ||
    firstValue(selectedUnit, ['projectUid', 'project_uid'])
  )
}

function getUnitIdCandidate(unit?: AnyRecord, deviceBlockKey?: string, circuitBlockId?: string) {
  return (
    normalize(unit?.id) ||
    normalize(unit?.unit_id) ||
    normalize(unit?.unitId) ||
    normalize(deviceBlockKey) ||
    getSuffixAfterAt(circuitBlockId)
  )
}

function formatUnitIdForRequest(value: string) {
  const numericValue = Number(value)
  return value && Number.isFinite(numericValue) ? numericValue : value
}

function getUnitSvgErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const detail =
      error.response?.data?.detail ??
      error.response?.data?.msg ??
      error.response?.data?.message

    if (status === 400) return detail || 'UNIT SVGのリクエスト内容に不備があります。'
    if (status === 404) return detail || '対象ユニットのUNIT SVGが見つかりません。'
    if (status === 500) return detail || 'UNIT SVGの生成中にサーバーエラーが発生しました。'
    if (status) return detail || `UNIT SVGの取得に失敗しました。HTTP ${status}`
  }

  return 'UNIT SVGの取得に失敗しました。'
}

function getSvgClickDataValue(
  target: Element,
  boundary: Element | null | undefined,
  datasetKeys: string[],
  attrNames: string[],
) {
  let current: Element | null = target

  while (current) {
    const dataset = (current as HTMLElement | SVGElement).dataset

    for (const key of datasetKeys) {
      const value = dataset?.[key]
      if (hasValue(value)) return normalize(value)
    }

    for (const attrName of attrNames) {
      const value = current.getAttribute(attrName)
      if (hasValue(value)) return normalize(value)
    }

    if (current === boundary) break
    current = current.parentElement
  }

  return ''
}

function getSvgClickNumberValue(
  target: Element,
  boundary: Element | null | undefined,
  datasetKeys: string[],
  attrNames: string[],
  fallback = 0,
) {
  const value = getSvgClickDataValue(target, boundary, datasetKeys, attrNames)
  const numericValue = Number(value)

  return value && Number.isFinite(numericValue) ? numericValue : fallback
}

function parseSlotIndices(value: string) {
  return value
    .split(',')
    .map((slotIndex) => slotIndex.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite)
}

function getSvgElementAttributes(element: Element) {
  return Array.from(element.attributes).reduce<Record<string, string>>((acc, attr) => {
    acc[attr.name] = attr.value
    return acc
  }, {})
}

function parseSvgClickPayload(
  target: HTMLElement | SVGElement,
  hitAreas?: Element | null,
): UnitSvgClickPayload {
  const getValue = (datasetKeys: string[], attrNames: string[]) =>
    getSvgClickDataValue(target, hitAreas, datasetKeys, attrNames)

  const getNumber = (datasetKeys: string[], attrNames: string[], fallback = 0) =>
    getSvgClickNumberValue(target, hitAreas, datasetKeys, attrNames, fallback)

  const slotIndicesText = getValue(
    ['slotIndices', 'slotIndex', 'slots'],
    ['data-slot-indices', 'data-slot-index', 'data-slots'],
  )

  return {
    type: getValue(['clickTarget'], ['data-click-target']),
    areaId: getValue(['areaId', 'area'], ['data-area-id', 'data-area']),
    unitId: getNumber(['unitId', 'unitID'], ['data-unit-id', 'data-unitID']),
    unitKey: getValue(['unitKey'], ['data-unit-key']),
    subunitNo: getValue(
      ['subunitNo', 'subunit', 'unitNo', 'unit'],
      ['data-subunit-no', 'data-subunit', 'data-unit-no', 'data-unit'],
    ),
    blockNo: getValue(
      ['blockNo', 'block', 'blockNumber'],
      ['data-block-no', 'data-block', 'data-block-number'],
    ),
    deviceName: getValue(['deviceName'], ['data-device-name']),
    deviceLabel: getValue(['deviceLabel'], ['data-device-label']),
    deviceIndex: getNumber(['deviceIndex'], ['data-device-index']),
    slotIndices: parseSlotIndices(slotIndicesText),
  }
}

function getItemSubunitNo(item: AnyRecord) {
  return normalize(item?.unit ?? item?.subunit_no ?? item?.subunitNo)
}

function getItemBlockNo(item: AnyRecord) {
  return normalize(item?.block ?? item?.block_no ?? item?.blockNo)
}

function createBlockSelection(subunitNo: unknown, blockNo: unknown): BlockSelection | null {
  const normalizedBlockNo = normalize(blockNo)
  if (!normalizedBlockNo) return null

  return {
    subunitNo: normalize(subunitNo),
    blockNo: normalizedBlockNo,
  }
}

function getAreaTokenValue(areaId: string, labels: string[]) {
  const normalizedLabels = labels.map((label) => label.toLowerCase())
  const tokens = areaId.split(/[^A-Za-z0-9]+/).filter(Boolean)

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const lowerToken = token.toLowerCase()

    for (const label of normalizedLabels) {
      const compactMatch = lowerToken.match(new RegExp(`^${label}(?:no|number)?([a-z0-9]+)$`))
      if (compactMatch?.[1]) return compactMatch[1]
    }

    if (!normalizedLabels.includes(lowerToken)) continue

    const nextToken = tokens[index + 1]?.toLowerCase()
    const valueOffset = nextToken === 'no' || nextToken === 'number' ? 2 : 1
    const value = tokens[index + valueOffset]
    if (value) return value
  }

  return ''
}

function blockSelectionFromAreaId(areaId?: string) {
  const normalizedAreaId = normalize(areaId)
  if (!normalizedAreaId) return null

  const blockNo = getAreaTokenValue(normalizedAreaId, ['block'])
  if (!blockNo) return null

  const subunitNo = getAreaTokenValue(normalizedAreaId, ['subunit', 'unit'])

  return createBlockSelection(subunitNo, blockNo)
}

function blockSelectionFromPayload(payload: UnitSvgClickPayload) {
  return (
    createBlockSelection(payload.subunitNo, payload.blockNo) ||
    blockSelectionFromAreaId(payload.areaId)
  )
}

function blockSelectionFromRow(item: AnyRecord) {
  return createBlockSelection(getItemSubunitNo(item), getItemBlockNo(item))
}

function rowMatchesBlockSelection(item: AnyRecord, selection: BlockSelection | null) {
  if (!selection) return false

  const itemBlockNo = getItemBlockNo(item)
  if (!itemBlockNo || itemBlockNo !== selection.blockNo) return false

  const itemSubunitNo = getItemSubunitNo(item)
  if (!selection.subunitNo) return true

  return itemSubunitNo === selection.subunitNo
}

function isPlaceholderDevice(value: unknown) {
  return typeof value === 'string' && value.trim().startsWith('@')
}

function getSelectedDeviceValues(item: AnyRecord) {
  const defaultDevices = Array.isArray(item?.default_device) ? item.default_device : []
  const overDevices = Array.isArray(item?.over_device) ? item.over_device : []

  if (defaultDevices.length > 0) {
    return {
      values: defaultDevices,
      source: 'default_device',
    }
  }

  return {
    values: overDevices,
    source: 'over_device',
  }
}

function parseDeviceValue(value: unknown, source: string): DeviceListItem | null {
  if (!hasValue(value) || isPlaceholderDevice(value)) return null

  const raw = normalize(value)
  if (!raw) return null

  const hashIndex = raw.lastIndexOf('#')
  const codeAndSize = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw
  const quantity = hashIndex >= 0 ? raw.slice(hashIndex + 1) : ''
  const atIndex = codeAndSize.lastIndexOf('@')
  const code = atIndex >= 0 ? codeAndSize.slice(0, atIndex) : codeAndSize
  const size = atIndex >= 0 ? codeAndSize.slice(atIndex + 1) : ''

  return {
    raw,
    code: code || raw,
    size,
    quantity,
    source,
  }
}

function getDeviceListItems(item: AnyRecord) {
  const { values, source } = getSelectedDeviceValues(item)

  return values
    .map((value) => parseDeviceValue(value, source))
    .filter((value): value is DeviceListItem => Boolean(value))
}

function getDeviceStringItems(item: AnyRecord | null | undefined) {
  if (!item) return []

  return getSelectedDeviceValues(item)
    .values.map(normalize)
    .filter(Boolean)
}

function getMeaningfulDeviceStrings(values: unknown) {
  if (!Array.isArray(values)) return []

  return values
    .map(normalize)
    .filter((value) => value && !isPlaceholderDevice(value))
}

function getPlacementIssueDevices(item: AnyRecord | null | undefined) {
  if (!item) return []

  return [
    ...getMeaningfulDeviceStrings(item.unarranged),
    ...getMeaningfulDeviceStrings(item.unarranged_device),
    ...getMeaningfulDeviceStrings(item.unarranged_devices),
    ...getMeaningfulDeviceStrings(item.over_device),
  ]
}

function hasPlacementIssue(item: AnyRecord | null | undefined) {
  return getPlacementIssueDevices(item).length > 0
}

function getBlockSelectionKey(selection: BlockSelection | null) {
  if (!selection) return ''
  return `${selection.subunitNo}::${selection.blockNo}`
}

function getPlacementDirection(item: AnyRecord | null | undefined): PlacementDirection {
  const value = normalize(
    item?.placement_direction ??
      item?.placementDirection ??
      item?.placement ??
      item?.direction ??
      item?.d,
  )

  return value === 'h' || value === 'v' ? value : '-'
}

function getPlacementResultPatch(data: AnyRecord) {
  const patch: AnyRecord = {}
  const lmap = data?.lmap
  const placedDevices = Array.isArray(data?.device)
    ? data.device
    : Array.isArray(data?.devices)
      ? data.devices
      : null

  if (Array.isArray(lmap)) patch.lmap = lmap
  if (placedDevices) patch.devices = placedDevices
  if (Array.isArray(data?.arranged)) patch.arranged = data.arranged
  if (Array.isArray(data?.unarranged)) patch.unarranged = data.unarranged
  if (data?.outside && typeof data.outside === 'object') patch.outside = data.outside
  if (hasValue(data?.direction)) patch.direction = data.direction
  if (hasValue(data?.svg)) patch.svg = data.svg

  return patch
}

function getUnarrangedDevices(data: AnyRecord) {
  return getMeaningfulDeviceStrings(data?.unarranged)
}

function formatPlacementIssueMessage(devices: string[]) {
  const displayDevices = devices.slice(0, 8).join('、')
  const suffix = devices.length > 8 ? ` ほか${devices.length - 8}件` : ''

  return `配置エリアに収まらない機器があります: ${displayDevices}${suffix}`
}

function renderValue(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) return ''
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {value.map((v, index) => (
          <Chip
            key={`${String(v)}-${index}`}
            label={String(v)}
            size="small"
            variant="outlined"
          />
        ))}
      </Box>
    )
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <Box
        component="pre"
        sx={{
          m: 0,
          maxWidth: 360,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Box>
    )
  }

  return String(value ?? '')
}

export default function BlockListDialog({
  open,
  circuitBlockId,
  deviceBlockKey,
  items = [],
  onClose,
  onDeleteUnit,
}: BlockListDialogProps) {
  const input = useAppStore((state) => state.input)
  const unitList = input.unit.list
  const filteredItems = useMemo(
    () => items.filter((item) => sameDeviceBlockId(item, deviceBlockKey, circuitBlockId)),
    [circuitBlockId, deviceBlockKey, items],
  )
  const targetBaseId = stripInstanceSuffix(circuitBlockId)
  const fallbackFromCircuitId = getSuffixAfterAt(circuitBlockId)
  const selectedUnit = useMemo(() => {
    const targets = [deviceBlockKey, fallbackFromCircuitId, circuitBlockId]
      .map(normalize)
      .filter(Boolean)

    return unitList.find((unit) => {
      const candidates = [unit?.id, unit?.unit_id, unit?.unitId, unit?.uid]
        .map(normalize)
        .filter(Boolean)

      return candidates.some((candidate) => targets.includes(candidate))
    })
  }, [circuitBlockId, deviceBlockKey, fallbackFromCircuitId, unitList])
  const requestUnitId = getUnitIdCandidate(selectedUnit, deviceBlockKey, circuitBlockId)
  const requestUid = getProjectUid(input as AnyRecord, selectedUnit as AnyRecord | undefined)
  const requestDno = getDrawingNo(input as AnyRecord)
  const [svgHtml, setSvgHtml] = useState('')
  const [svgLoading, setSvgLoading] = useState(false)
  const [svgError, setSvgError] = useState('')
  const [svgWarnings, setSvgWarnings] = useState<string[]>([])
  const [svgUnit, setSvgUnit] = useState<UnitSvgResponse['unit'] | null>(null)
  const [svgRefreshKey, setSvgRefreshKey] = useState(0)
  const [selectedSvgPayload, setSelectedSvgPayload] = useState<UnitSvgClickPayload | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<BlockSelection | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deviceEditDialogOpen, setDeviceEditDialogOpen] = useState(false)
  const [placementErrorsByBlock, setPlacementErrorsByBlock] = useState<Record<string, string[]>>({})
  const svgContainerRef = useRef<HTMLDivElement | null>(null)
  const selectedDeviceRecord = useMemo(() => {
    if (!selectedBlock) return null

    return (
      filteredItems.find((item) => rowMatchesBlockSelection(item, selectedBlock)) ?? null
    )
  }, [filteredItems, selectedBlock])
  const selectedDeviceStrings = useMemo(
    () => getDeviceStringItems(selectedDeviceRecord),
    [selectedDeviceRecord],
  )
  const selectedDeviceItems = useMemo(() => {
    if (!selectedBlock) return []

    return filteredItems
      .filter((item) => rowMatchesBlockSelection(item, selectedBlock))
      .flatMap((item) => getDeviceListItems(item))
  }, [filteredItems, selectedBlock])

  console.log('[BlockListDialog][render]', {
    open,
    circuitBlockId,
    deviceBlockKey,
    targetBaseId,
    fallbackFromCircuitId,
    itemCount: items.length,
    filteredCount: filteredItems.length,
    sampleItems: items.slice(0, 5).map((item) => ({
      id: item?.id,
      Unit_No: item?.Unit_No,
      unit_no: item?.unit_no,
      unitNo: item?.unitNo,
      unit_id: item?.unit_id,
      unitId: item?.unitId,
      block_id: item?.block_id,
      blockId: item?.blockId,
      unit: item?.unit,
      block: item?.block,
      candidates: getItemKeyCandidates(item),
    })),
  })

  if (open && filteredItems.length === 0) {
    console.warn('[BlockListDialog][filter] no matched device block rows', {
      circuitBlockId,
      deviceBlockKey,
      targetBaseId,
      fallbackFromCircuitId,
      itemCount: items.length,
      firstItemKeys: items[0] ? Object.keys(items[0]) : [],
      firstItem: items[0],
    })
  }

  useEffect(() => {
    const controller = new AbortController()
    const preserveSelection = svgRefreshKey > 0

    async function fetchUnitSvg() {
      await Promise.resolve()
      if (controller.signal.aborted) return

      if (!open) {
        setSvgHtml('')
        setSvgError('')
        setSvgWarnings([])
        setSvgUnit(null)
        setSelectedSvgPayload(null)
        setSelectedBlock(null)
        return
      }

      if (!requestUnitId) {
        setSvgHtml('')
        setSvgWarnings([])
        setSvgUnit(null)
        if (!preserveSelection) {
          setSelectedSvgPayload(null)
          setSelectedBlock(null)
        }
        setSvgError('UNIT SVGを取得するユニットIDを特定できません。')
        return
      }

      if (!requestUid && !requestDno) {
        setSvgHtml('')
        setSvgWarnings([])
        setSvgUnit(null)
        if (!preserveSelection) {
          setSelectedSvgPayload(null)
          setSelectedBlock(null)
        }
        setSvgError('UIDまたは図面番号がないため、UNIT SVGを取得できません。')
        return
      }

      setSvgLoading(true)
      setSvgError('')
      setSvgWarnings([])
      setSvgUnit(null)
      if (!preserveSelection) {
        setSelectedSvgPayload(null)
        setSelectedBlock(null)
      }

      try {
        const payload: AnyRecord = {
          unit_id: formatUnitIdForRequest(requestUnitId),
          source: 'auto',
          mode: 'editor',
          options: {
            show_slots: true,
            show_labels: true,
            include_empty_blocks: true,
            hit_area_debug: false,
          },
        }

        if (requestDno) {
          payload.dno = requestDno
        } else {
          payload.uid = requestUid
        }

        const res = await axios.post<UnitSvgResponse>('/api/unit-svg/from-workdata', payload, {
          signal: controller.signal,
          withCredentials: true,
        })

        if (controller.signal.aborted) return

        if (res.data?.ok === false) {
          throw new Error('UNIT SVG APIが ok:false を返しました。')
        }

        setSvgHtml(res.data?.svg ?? '')
        setSvgWarnings(Array.isArray(res.data?.warnings) ? res.data.warnings : [])
        setSvgUnit(res.data?.unit ?? null)

        if (!res.data?.svg) {
          setSvgError('UNIT SVGデータが空です。')
        }
      } catch (error) {
        if (controller.signal.aborted || axios.isCancel(error)) return

        console.error('[BlockListDialog][fetchUnitSvg] failed', error)
        setSvgHtml('')
        setSvgWarnings([])
        setSvgUnit(null)
        if (!preserveSelection) {
          setSelectedSvgPayload(null)
          setSelectedBlock(null)
        }
        setSvgError(getUnitSvgErrorMessage(error))
      } finally {
        if (!controller.signal.aborted) {
          setSvgLoading(false)
        }
      }
    }

    fetchUnitSvg()

    return () => {
      controller.abort()
    }
  }, [open, requestDno, requestUid, requestUnitId, svgRefreshKey])

  useEffect(() => {
    const container = svgContainerRef.current
    if (!container) return

    container.innerHTML = open ? svgHtml : ''

    if (!open || !svgHtml) return

    const svgRoot = container.querySelector('svg')
    const hitAreas = svgRoot?.querySelector('#hit-areas')

    svgRoot?.removeAttribute('width')
    svgRoot?.removeAttribute('height')
    if (svgRoot instanceof SVGElement) {
      svgRoot.style.display = 'block'
      svgRoot.style.width = '100%'
      svgRoot.style.height = 'auto'
      svgRoot.style.maxWidth = '100%'
    }

    hitAreas?.querySelectorAll<SVGElement>('[data-click-target]').forEach((element) => {
      element.style.cursor = 'pointer'
      element.style.pointerEvents = 'all'
    })

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return

      const target = event.target.closest<HTMLElement | SVGElement>('[data-click-target]')
      if (!target) return
      if (!hitAreas || !hitAreas.contains(target)) return

      const payload = parseSvgClickPayload(target, hitAreas)
      const nextSelection = blockSelectionFromPayload(payload)
      if (!nextSelection) {
        console.warn('[BlockListDialog][svgClick] block selection not resolved', {
          payload,
          targetAttributes: getSvgElementAttributes(target),
        })
        return
      }

      setSelectedSvgPayload(payload)
      setSelectedBlock(nextSelection)
    }

    container.addEventListener('click', handleClick)

    return () => {
      container.removeEventListener('click', handleClick)
    }
  }, [open, svgHtml])

  const handleClose = () => {
    setDeleteConfirmOpen(false)
    setPlacementErrorsByBlock({})
    setSvgRefreshKey(0)
    onClose()
  }

  const handleOpenDeleteConfirm = () => {
    if (!onDeleteUnit || !circuitBlockId) return
    setDeleteConfirmOpen(true)
  }

  const handleCloseDeleteConfirm = () => {
    setDeleteConfirmOpen(false)
  }

  const handleConfirmDeleteUnit = () => {
    setDeleteConfirmOpen(false)
    onDeleteUnit?.()
  }

  const handleOpenDeviceEditDialog = () => {
    if (!selectedDeviceRecord) return
    setDeviceEditDialogOpen(true)
  }

  const handleCloseDeviceEditDialog = () => {
    setDeviceEditDialogOpen(false)
  }

  const handleSelectRowBlock = (item: AnyRecord) => {
    const nextSelection = blockSelectionFromRow(item)
    if (!nextSelection) return

    setSelectedSvgPayload(null)
    setSelectedBlock(nextSelection)
  }

  const handleUpdateSelectedDevices = async (
    nextDefaultDevices: string[],
    options: { phase: string; direction: PlacementDirection },
  ) => {
    if (!selectedDeviceRecord) {
      throw new Error('更新対象の機器ブロックが選択されていません。')
    }

    const blockNo = selectedBlock?.blockNo || getItemBlockNo(selectedDeviceRecord)
    const subunitNo = selectedBlock?.subunitNo || getItemSubunitNo(selectedDeviceRecord)
    const unitId = normalize(selectedDeviceRecord.id) || requestUnitId

    if (!blockNo || !unitId) {
      throw new Error('更新対象のユニットIDまたはブロック番号を特定できません。')
    }

    const targetSelection = createBlockSelection(subunitNo, blockNo)
    const targetSelectionKey = getBlockSelectionKey(targetSelection)
    const validDevices = nextDefaultDevices.filter(
      (device) => !String(device ?? '').trim().startsWith('@'),
    )
    const placementPayload: AnyRecord = {
      q: {
        subunit_no: subunitNo,
        block_no: blockNo,
      },
      Device: validDevices,
      d: options.direction,
    }
    let placementPatch: AnyRecord = { lmap: [], devices: [], arranged: [], unarranged: [] }

    if (validDevices.length > 0) {
      const placementData =
        (
          await axios.post(
            '/api/postUnitPlaceOnly',
            placementPayload,
            { withCredentials: true },
          )
        ).data ?? {}
      const unarrangedDevices = getUnarrangedDevices(placementData)

      if (unarrangedDevices.length > 0) {
        if (targetSelectionKey) {
          setPlacementErrorsByBlock((current) => ({
            ...current,
            [targetSelectionKey]: unarrangedDevices,
          }))
        }
        throw new Error(formatPlacementIssueMessage(unarrangedDevices))
      }

      placementPatch = getPlacementResultPatch(placementData)
    }

    if (targetSelectionKey) {
      setPlacementErrorsByBlock((current) => {
        if (!current[targetSelectionKey]) return current
        const next = { ...current }
        delete next[targetSelectionKey]
        return next
      })
    }

    const unitSvgResponse = await axios.post<UnitSvgResponse>(
      '/api/postUnitSvgByID',
      {
        id: formatUnitIdForRequest(unitId),
        ...placementPayload,
      },
      { withCredentials: true },
    )
    setSvgWarnings(
      Array.isArray(unitSvgResponse.data?.warnings) ? unitSvgResponse.data.warnings : [],
    )
    setSvgUnit(unitSvgResponse.data?.unit ?? svgUnit)

    useAppStore.setState((current) => ({
      ...current,
      input: {
        ...current.input,
        device: {
          ...current.input.device,
          list: (current.input.device.list ?? []).map((record) => {
            const matchesTarget =
              sameDeviceBlockId(record, deviceBlockKey, circuitBlockId) &&
              rowMatchesBlockSelection(record, targetSelection)

            if (!matchesTarget) return record

            return {
              ...record,
              ...placementPatch,
              default_device: nextDefaultDevices,
              phase: options.phase,
              placement: options.direction,
              placement_direction: options.direction,
              d: options.direction,
            }
          }),
        },
      },
    }))

    await saveWork()

    if (requestUnitId && (requestUid || requestDno)) {
      const refreshPayload: AnyRecord = {
        unit_id: formatUnitIdForRequest(requestUnitId),
        source: 'auto',
        mode: 'editor',
        cache_bust: Date.now(),
        options: {
          show_slots: true,
          show_labels: true,
          include_empty_blocks: true,
          hit_area_debug: false,
        },
      }

      if (requestDno) {
        refreshPayload.dno = requestDno
      } else {
        refreshPayload.uid = requestUid
      }

      const refreshedUnitSvg = await axios.post<UnitSvgResponse>(
        '/api/unit-svg/from-workdata',
        refreshPayload,
        {
          withCredentials: true,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      )

      if (refreshedUnitSvg.data?.ok === false) {
        throw new Error('UNIT SVG APIが ok:false を返しました。')
      }

      setSvgHtml(refreshedUnitSvg.data?.svg ?? '')
      setSvgWarnings(
        Array.isArray(refreshedUnitSvg.data?.warnings) ? refreshedUnitSvg.data.warnings : [],
      )
      setSvgUnit(refreshedUnitSvg.data?.unit ?? svgUnit)

      if (!refreshedUnitSvg.data?.svg) {
        setSvgError('UNIT SVGデータが空です。')
      } else {
        setSvgError('')
      }
    }
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="xl" fullWidth>
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h6">機器ブロック一覧</Typography>
            <Typography variant="body2" color="text.secondary">
              回路ブロックID: {circuitBlockId || '未選択'}
              {' / '}
              機器ブロックID: {deviceBlockKey || fallbackFromCircuitId || '未選択'}
              {targetBaseId && targetBaseId !== circuitBlockId ? ` / ベースID: ${targetBaseId}` : ''}
              {' / '}
              表示件数: {filteredItems.length}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              color="error"
              onClick={handleOpenDeleteConfirm}
              disabled={!circuitBlockId || !onDeleteUnit}
            >
              ユニット削除
            </Button>
            <IconButton onClick={handleClose} aria-label="閉じる">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

      <Divider />

      <DialogContent sx={{ bgcolor: '#fafafa' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '380px minmax(0, 1fr)' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              maxHeight: { xs: 420, lg: '70vh' },
              overflow: 'auto',
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={1}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  UNIT SVG
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  unit_id: {requestUnitId || '未特定'}
                  {svgUnit?.unit_key ? ` / ${svgUnit.unit_key}` : ''}
                </Typography>
              </Box>

              {svgLoading && (
                <Box>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary">
                    UNIT SVGを取得中です。
                  </Typography>
                </Box>
              )}

              {svgError && <Alert severity="error">{svgError}</Alert>}

              {svgWarnings.length > 0 && (
                <Alert severity="warning" variant="outlined" sx={{ py: 0.5 }}>
                  <Typography variant="caption">
                    {svgWarnings.join(' / ')}
                  </Typography>
                </Alert>
              )}

              {!svgLoading && !svgError && !svgHtml && (
                <Alert severity="info">UNIT SVGデータがありません。</Alert>
              )}

              <Box
                ref={svgContainerRef}
                sx={{
                  minHeight: 240,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: '#fff',
                  overflow: 'auto',
                  '& svg': {
                    display: 'block',
                    maxWidth: '100%',
                    height: 'auto',
                  },
                  '& svg #hit-areas': {
                    pointerEvents: 'all !important',
                  },
                  '& svg #hit-areas [data-click-target]': {
                    cursor: 'pointer',
                    pointerEvents: 'all !important',
                  },
                }}
              />

              {selectedBlock && (
                <Paper variant="outlined" sx={{ p: 1, bgcolor: '#fafafa' }}>
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                    ブロック選択中
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    {[
                      selectedBlock.subunitNo ? `subunit:${selectedBlock.subunitNo}` : '',
                      `block:${selectedBlock.blockNo}`,
                      selectedSvgPayload?.deviceLabel || selectedSvgPayload?.deviceName
                        ? `device:${selectedSvgPayload.deviceLabel || selectedSvgPayload.deviceName}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                  </Typography>
                </Paper>
              )}
            </Stack>
          </Paper>

          <Stack spacing={2} sx={{ minWidth: 0 }}>
            {filteredItems.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 3 }}>
                <Typography color="text.secondary">
                  該当する機器ブロックデータがありません。
                </Typography>
              </Paper>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '42vh' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableCell
                          key={header.key}
                          sx={{
                            fontWeight: 700,
                            bgcolor: '#eeeeee',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {header.title}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredItems.map((item, rowIndex) => {
                      const selected = rowMatchesBlockSelection(item, selectedBlock)
                      const rowSelection = blockSelectionFromRow(item)
                      const rowPlacementErrors =
                        placementErrorsByBlock[getBlockSelectionKey(rowSelection)] ?? []
                      const placementIssue =
                        rowPlacementErrors.length > 0 || hasPlacementIssue(item)

                      return (
                        <TableRow
                          key={`${normalize(item?.id)}-${rowIndex}`}
                          hover
                          selected={selected}
                          onClick={() => handleSelectRowBlock(item)}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: placementIssue ? '#ffebee' : undefined,
                            '&:hover': {
                              bgcolor: placementIssue ? '#ffcdd2' : undefined,
                            },
                            '&.Mui-selected': {
                              bgcolor: placementIssue ? '#ffcdd2' : '#e3f2fd',
                            },
                            '&.Mui-selected:hover': {
                              bgcolor: placementIssue ? '#ef9a9a' : '#bbdefb',
                            },
                          }}
                        >
                          {headers.map((header) => (
                            <TableCell key={header.key} sx={{ verticalAlign: 'top' }}>
                              {header.key === 'block' && placementIssue ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Box>{renderValue(item?.[header.key])}</Box>
                                  <Chip
                                    label="配置NG"
                                    color="error"
                                    size="small"
                                    variant="outlined"
                                  />
                                </Stack>
                              ) : (
                                renderValue(item?.[header.key])
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Box>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['機器コード', '数量', 'Actions'].map((title) => (
                        <TableCell
                          key={title}
                          align={title === '数量' || title === 'Actions' ? 'center' : 'left'}
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            fontWeight: 700,
                            fontSize: 18,
                            bgcolor: '#fff',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {title}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedDeviceItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          align="center"
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            color: 'text.secondary',
                            height: 42,
                          }}
                        >
                          {selectedBlock ? '選択中の機器はありません。' : 'ブロックを選択してください。'}
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Button
                            variant="contained"
                            size="small"
                            onClick={handleOpenDeviceEditDialog}
                            disabled={!selectedDeviceRecord}
                          >
                            追加編集
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedDeviceItems.map((device, index) => (
                        <TableRow key={`${device.raw}-${device.source}-${index}`} hover>
                          <TableCell
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              verticalAlign: 'top',
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {device.code}
                            </Typography>
                            {device.size && (
                              <Typography variant="caption" color="text.secondary">
                                大きさ: {device.size}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell
                            align="center"
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              verticalAlign: 'middle',
                            }}
                          >
                            {device.quantity || '-'}
                          </TableCell>
                          <TableCell
                            align="center"
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Stack direction="row" spacing={1} justifyContent="center">
                              <Button
                                variant="contained"
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleOpenDeviceEditDialog()
                                }}
                              >
                                追加編集
                              </Button>
                              <Button
                                variant="contained"
                                color="error"
                                size="small"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleOpenDeviceEditDialog()
                                }}
                              >
                                削除
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Stack>
        </Box>
      </DialogContent>
      </Dialog>
      <Dialog open={open && deleteConfirmOpen} onClose={handleCloseDeleteConfirm} maxWidth="xs" fullWidth>
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography variant="h6">ユニット削除確認</Typography>
          <IconButton onClick={handleCloseDeleteConfirm} aria-label="閉じる">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={1.5}>
            <Alert severity="warning">
              このユニットを削除します。削除すると、回路図と機器ブロック一覧から対象データが外れます。
            </Alert>
            <Typography variant="body2" color="text.secondary">
              回路ブロックID: {circuitBlockId || '未選択'}
              {' / '}
              機器ブロックID: {deviceBlockKey || fallbackFromCircuitId || '未選択'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteConfirm}>キャンセル</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDeleteUnit}>
            削除する
          </Button>
        </DialogActions>
      </Dialog>
      <DeviceAddEditDialog
        open={open && deviceEditDialogOpen}
        unitBlock={{
          unitId: selectedDeviceRecord?.id ?? requestUnitId,
          blockNo: selectedBlock?.blockNo ?? getItemBlockNo(selectedDeviceRecord ?? {}),
          subunitNo: selectedBlock?.subunitNo ?? getItemSubunitNo(selectedDeviceRecord ?? {}),
          phase: normalize(selectedDeviceRecord?.phase),
          direction: getPlacementDirection(selectedDeviceRecord),
        }}
        devices={selectedDeviceStrings}
        onClose={handleCloseDeviceEditDialog}
        onUpdate={handleUpdateSelectedDevices}
      />
    </>
  )
}
