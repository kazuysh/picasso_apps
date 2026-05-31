import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { saveWork } from '../api/saveWork'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import MemoryIcon from '@mui/icons-material/Memory'
import ViewListIcon from '@mui/icons-material/ViewList'
import SchemaIcon from '@mui/icons-material/Schema'
import { useAppStore } from '../stores/useAppStore'
import type {
  DeviceBlockItem,
  GraphData,
  LayoutItem,
  UnitItem,
} from '../stores/useAppStore'

type LogLevel = 'info' | 'success' | 'error'

type ProgressLog = {
  id: number
  time: string
  level: LogLevel
  message: string
}

type UnitFlowApiRequest = {
  devices: Array<{
    id: number
    unitNo: string
    node: string
    path_no: number
  }>
  threshold: number
  enforce_dag: boolean
}

type UnitFlowApiResponse = {
  edges?: [string, string][]
}

type UnitLayoutInferRequest = {
  graph: {
    node: Array<{
      Unit_No: string
      w?: any
    }>
    edge: Array<[string, string]>
  }
}

type LineUpResponse = {
  b: { url?: string } | string
  l: LayoutItem[]
  f: Record<string, any>
  n: number
  h: number
}

type BoxSearchItem = {
  code?: string
  box_key?: string
  i_box_w?: number
  i_box_h?: number
  i_box_d?: number
  i_NRow?: number
  i_floor1?: number
  i_floor2?: number
  i_floor3?: number
  body_material?: string
  out_color?: string
  box_location?: string
  box_purpose?: string
  box_purpose2?: string
  structure?: string
  move_board?: string
  list_support_height?: string[] | string
  [key: string]: any
}

type BoxSearchResponse = {
  code?: number
  result?: {
    data?: BoxSearchItem[]
    total?: number
  }
  msg?: string
}

const defaultBoxSortBy = [
  { key: 'i_box_w', order: 'asc' },
  { key: 'i_box_h', order: 'asc' },
  { key: 'i_box_d', order: 'asc' },
]

export default function GenerationRunnerPage() {
  const navigate = useNavigate()

  const input = useAppStore((s) => s.input)
  const layout = useAppStore((s) => s.layout)
  const generationStartStep = useAppStore((s) => s.generationStartStep ?? 'full')

  const setCircuitGraphData = useAppStore((s) => s.setCircuitGraphData)
  const setCircuitSaveFlag = useAppStore((s) => s.setCircuitSaveFlag)
  const setGenerationStartStep = useAppStore((s) => s.setGenerationStartStep)
  const setLayoutUlf = useAppStore((s) => s.setLayoutUlf)
  const setLayoutLayout = useAppStore((s) => s.setLayoutLayout)
  const setLayoutFloor = useAppStore((s) => s.setLayoutFloor)
  const setLayoutField = useAppStore((s) => s.setLayoutField)
  const setUnitList = useAppStore((s) => s.setUnitList)
  const setUnitNewFlag = useAppStore((s) => s.setUnitNewFlag)

  const [running, setRunning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [logs, setLogs] = useState<ProgressLog[]>([])
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const seqRef = useRef(1)

  const pushLog = useCallback((message: string, level: LogLevel = 'info') => {
    const time = new Date().toLocaleTimeString()
    const next: ProgressLog = {
      id: seqRef.current++,
      time,
      level,
      message,
    }
    setLogs((prev) => [...prev, next])
  }, [])

  const clearLogs = useCallback(() => {
    seqRef.current = 1
    setLogs([])
    setErrorMessage('')
  }, [])

  const units = input.unit
  const devices = input.device
  const circuits = input.circuit

  const drawingNo =
    input.basic?.drawingNoTemp ??
    input.basic?.drawingNo ??
    input.basic?.DrawingNo ??
    ''

  const summary = useMemo(() => {
    return {
      unitCount: units.list?.length ?? 0,
      deviceCount: devices.list?.length ?? 0,
      graphNodeCount: circuits.graphdata?.nodes?.length ?? 0,
      graphEdgeCount: circuits.graphdata?.edges?.length ?? 0,
      layoutCount: Array.isArray(layout.layout) ? layout.layout.length : 0,
    }
  }, [units.list, devices.list, circuits.graphdata, layout.layout])

  const buildUnitMaps = useCallback(() => {
    const idToKey = new Map<string, string>()
    const keyToLabel = new Map<string, string>()

      ; (units.list ?? []).forEach((u: UnitItem) => {
        const id = u.id ?? null
        const unitKey = u.unit_key ?? u.key ?? u.uid ?? null
        const label = u.unit_no ?? u.unitNo ?? u.name ?? unitKey ?? '(unknown)'

        if (id != null && unitKey) idToKey.set(String(id), String(unitKey))
        if (unitKey) keyToLabel.set(String(unitKey), String(label))
      })

    return { idToKey, keyToLabel }
  }, [units.list])

  const isInOut = useCallback((nid: string) => {
    return nid.startsWith('IN#') || nid.startsWith('OUT#')
  }, [])

  const inOutLabel = useCallback((nid: string) => {
    if (nid.startsWith('IN#')) return `入力${nid.slice(2)}`
    if (nid.startsWith('OUT#')) return `出力${nid.slice(3)}`
    return nid
  }, [])

  const updateCircuit = useCallback(() => {
    setCircuitSaveFlag('1')
    pushLog('回路データを保存しました', 'success')
  }, [pushLog, setCircuitSaveFlag])

  const loadCircuit = useCallback(async () => {
    pushLog('回路生成を開始します')

    const { keyToLabel } = buildUnitMaps()

    const payloadDevices: UnitFlowApiRequest['devices'] = (devices.list ?? [])
      .map((d: DeviceBlockItem) => {
        const idNum = Number.parseInt(String(d.id ?? d.unit_i ?? d.i), 10)
        if (!Number.isFinite(idNum)) return null

        return {
          id: idNum,
          unitNo: String(d.unitNo ?? d.unit_no ?? d.unit_key ?? d.unit ?? ''),
          node: String(d.node ?? d.node_type ?? d.type ?? 'MA'),
          path_no: Number(d.path_no ?? d.path ?? d.route ?? 0),
        }
      })
      .filter((v): v is UnitFlowApiRequest['devices'][number] => v !== null)

    if (payloadDevices.length === 0) {
      throw new Error('送信対象の devices.list が空です')
    }

    pushLog(`回路推定API送信: ${payloadDevices.length}件`)

    const body: UnitFlowApiRequest = {
      devices: payloadDevices,
      threshold: circuits.threshold ?? 0.5,
      enforce_dag: true,
    }

    const res = await axios.post<UnitFlowApiResponse>('/api/postUnitFlow', body)
    const edges = res.data?.edges ?? []

    const graphEdges = edges.map(([from, to]) => ({ from, to }))

    const nodeSet = new Set<string>()
    graphEdges.forEach((edge) => {
      nodeSet.add(edge.from)
      nodeSet.add(edge.to)
    })

    const graphNodes = Array.from(nodeSet).map((id) => {
      const label = isInOut(id) ? inOutLabel(id) : (keyToLabel.get(id) ?? id)
      return { id, label }
    })

    const graphdata: GraphData = {
      nodes: graphNodes,
      edges: graphEdges,
    }

    setCircuitGraphData(graphdata)
    pushLog(`回路生成完了: nodes=${graphNodes.length}, edges=${graphEdges.length}`, 'success')
  }, [
    buildUnitMaps,
    devices.list,
    circuits.threshold,
    isInOut,
    inOutLabel,
    pushLog,
    setCircuitGraphData,
  ])

  const buildColumnMapFromUlf = useCallback((ulfObj: Record<string, any>) => {
    const map = new Map<string, number>()
    if (!ulfObj || typeof ulfObj !== 'object') return map

    Object.keys(ulfObj)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((k) => {
        const colNo = Number(k)
        const arr = ulfObj[k] ?? []

        arr.forEach((token: any) => {
          let id: string | null = null

          if (typeof token === 'string') {
            if (token.includes('@')) id = token.split('@').pop() ?? null
            else if (/^\d+$/.test(token)) id = token
          } else if (token && typeof token === 'object') {
            const raw = token.id ?? token.Unit_No ?? null
            if (typeof raw === 'string') {
              id = raw.includes('@')
                ? raw.split('@').pop() ?? null
                : /^\d+$/.test(raw)
                  ? raw
                  : null
            }
          }

          if (id != null) map.set(String(id), colNo)
        })
      })

    return map
  }, [])

  const applyUlfToUnitsIRow = useCallback((ulfObj: Record<string, any>) => {
    const colMap = buildColumnMapFromUlf(ulfObj)
    const nextList = (units.list ?? []).map((u) => {
      const col = colMap.get(String(u.id))
      return { ...u, i_row: Number.isFinite(col) ? col : 1 }
    })
    setUnitList(nextList)
  }, [buildColumnMapFromUlf, setUnitList, units.list])

  const runAutoLayout = useCallback(async () => {
    pushLog('配置AI推定を開始します')

    // loadCircuit() 直後でも最新の回路データを読むため、hook のクロージャではなく
    // Zustand の現在値を参照する。
    const state = useAppStore.getState()
    const g = state.input.circuit.graphdata ?? { nodes: [], edges: [] }
    const unitList = state.input.unit.list ?? []

    const getWidth = (nodeId: string) => {
      const at = String(nodeId).indexOf('@')
      if (at < 0) return undefined
      const tail = String(nodeId).slice(at + 1)
      const hit = unitList.find((u) => String(u.id) === String(tail))
      return hit?.list_w ?? undefined
    }

    const payload: UnitLayoutInferRequest = {
      graph: {
        node: (g.nodes ?? []).map((n) => ({
          Unit_No: n.id,
          w: getWidth(n.id),
        })),
        edge: (g.edges ?? []).map((e) => [e.from, e.to]),
      },
    }

    console.log('postUnitLayoutInfer payload =', payload)
    pushLog(`配置推定API送信: nodes=${payload.graph.node.length}, edges=${payload.graph.edge.length}`)

    if (payload.graph.node.length === 0 || payload.graph.edge.length === 0) {
      throw new Error(
        `配置推定用の回路データが空です。nodes=${payload.graph.node.length}, edges=${payload.graph.edge.length}`,
      )
    }

    const res = await axios.post('/api/postUnitLayoutInfer', payload)

    const ulf =
      res?.data && typeof res.data === 'object' && 'ulf' in res.data
        ? (res.data as any).ulf
        : res?.data

    if (!ulf) {
      throw new Error('配置推定結果にULFがありません')
    }

    const nextUlf = JSON.parse(JSON.stringify(ulf.result ?? ulf))
    console.log('postUnitLayoutInfer response =', res.data)
    console.log('nextUlf =', nextUlf)

    setLayoutUlf(nextUlf)
    pushLog('配置推定結果を layout.ulf に保存しました', 'success')
    return nextUlf
  }, [pushLog, setLayoutUlf])

  const runAiInitialPlacement = useCallback(async () => {
    pushLog('AI初期配置を開始します')
    const ulf = await runAutoLayout()
    applyUlfToUnitsIRow(ulf)
    pushLog('ULFから units.list[i_row] を更新しました', 'success')
  }, [applyUlfToUnitsIRow, pushLog, runAutoLayout])

  const getJoinedBoxW = useCallback(() => {
    const boxw = (layout.boxw ?? ['500', '20', '500', '20', '500', '20']).map(String)
    return boxw.join(',')
  }, [layout.boxw])

  const updateLayoutStore = useCallback(async () => {
    pushLog('配置表示データを生成します')

    const codes2 = (useAppStore.getState().input.unit.list ?? []).map((item) => ({
      unit_no: item.unit_no,
      unit_key: item.unit_key,
      id: item.id,
      row: item.i_row,
    }))

    const currentUlf = useAppStore.getState().layout.ulf ?? {}
    const codes3 = { u: codes2, ulf: currentUlf }
    console.log('postUnits2Layout payload =', codes3)
    const res1 = await axios.post<LayoutItem[]>('/api/postUnits2Layout', codes3)
    setLayoutLayout(res1.data)
    pushLog('postUnits2Layout 完了')

    const w = getJoinedBoxW()
    const boxh = String(useAppStore.getState().layout.boxh ?? 0)
    setLayoutField('backgroundSvgUrl', `/api/getTemplate?w=${w}&h=${boxh}`)

    const latestLayout = useAppStore.getState().layout.layout

    const para = {
      u: codes2,
      l: latestLayout,
      w,
      g: (useAppStore.getState().layout.boxg ?? []).join(','),
      gb: useAppStore.getState().layout.boxgb,
      h: boxh,
    }

    const res2 = await axios.post('/api/postBoxSvg', para)

    if (Array.isArray(res2?.data?.layout)) {
      setLayoutLayout(res2.data.layout)
    }

    setUnitNewFlag(1)
    pushLog('postBoxSvg 完了', 'success')
  }, [getJoinedBoxW, pushLog, setLayoutField, setLayoutLayout, setUnitNewFlag])

  const updateLayoutStore2 = useCallback(async () => {
    const w = getJoinedBoxW()
    const para = {
      l: useAppStore.getState().layout.layout,
      w,
      g: (useAppStore.getState().layout.boxg ?? []).join(','),
      h: String(useAppStore.getState().layout.boxh ?? 0),
    }

    await axios.post('/api/postBoxSvg2', para)
    pushLog('postBoxSvg2 完了', 'success')
  }, [getJoinedBoxW, pushLog])

  const updateLineUp = useCallback(async () => {
    pushLog('整列配置を開始します')

    const state = useAppStore.getState()

    const res = await axios.post<LineUpResponse>('/api/postLineUp', {
      b: state.layout.backgroundSvgUrl,
      g: state.layout.boxg,
      gb: state.layout.boxgb,
      l: state.layout.layout,
    })

    const url = res.data?.b
    const ldata = res.data?.l ?? []
    const floor = res.data?.f ?? {}
    const nRow = res.data?.n ?? 0
    const boxH = res.data?.h ?? 9999

    setLayoutField('backgroundSvgUrl', typeof url === 'string' ? url : (url?.url ?? ''))

    const currentLayout = useAppStore.getState().layout.layout

    if (boxH !== 9999 && currentLayout.length === ldata.length) {
      setLayoutLayout(ldata)
      setLayoutFloor(floor)
      setLayoutField('nrow', nRow)
      setLayoutField('boxH', boxH)
      setUnitNewFlag(0)
      pushLog('整列成功', 'success')
      await updateLayoutStore2()
    } else {
      setLayoutField('boxH', 0)
      setUnitNewFlag(1)
      pushLog('整列失敗のため初期配置へ戻します', 'error')
      await updateLayoutStore()
    }
  }, [
    pushLog,
    setLayoutField,
    setLayoutFloor,
    setLayoutLayout,
    setUnitNewFlag,
    updateLayoutStore,
    updateLayoutStore2,
  ])

  const ensureBoxSelected = useCallback(async () => {
    pushLog('箱選定を開始します')

    const state = useAppStore.getState() as any
    const cabinfo = state.input?.cabinfo ?? {}
    const layoutState = state.layout ?? {}
    const currentBox = layoutState.box ?? {}

    const currentBoxKey =
      currentBox?.code ??
      currentBox?.box_key ??
      (typeof layoutState.boxcode === 'string'
        ? layoutState.boxcode.replace(/^確定/, '')
        : '')

    if (currentBoxKey) {
      pushLog(`箱選定済み: ${String(currentBoxKey)}`, 'success')
      return String(currentBoxKey)
    }

    const floor = layoutState.floor ?? {}
    const nrow = layoutState.nrow
    const boxH = layoutState.boxH ?? layoutState.boxh ?? 0

    const filter: Record<string, any> = {}

    const setFloorFilter = (key: 'i_floor1' | 'i_floor2' | 'i_floor3', values: any) => {
      if (!Array.isArray(values) || values.length === 0) return
      const vals = values.map(Number).filter((v: number) => !Number.isNaN(v))
      if (vals.length > 0) filter[key] = { $in: vals }
    }

    // BoxList.vue の loadItems と同じ検索条件。
    setFloorFilter('i_floor1', floor[1])
    setFloorFilter('i_floor2', floor[2])
    setFloorFilter('i_floor3', floor[3])

    if (cabinfo.floor1 != null) filter.i_floor1 = { $in: [Number(cabinfo.floor1)] }
    if (cabinfo.floor2 != null) filter.i_floor2 = { $in: [Number(cabinfo.floor2)] }
    if (cabinfo.floor3 != null) filter.i_floor3 = { $in: [Number(cabinfo.floor3)] }

    if (nrow != null) filter.i_NRow = nrow
    if (cabinfo.material != null) filter.body_material = cabinfo.material
    if (cabinfo.format != null) filter.box_location = cabinfo.format
    if (cabinfo.outer_color != null) filter.out_color = cabinfo.outer_color
    if (cabinfo.format2 != null) filter.box_purpose = cabinfo.format2
    if (cabinfo.structure != null) filter.structure = cabinfo.structure
    if (cabinfo.boxwidth != null) filter.i_box_w = cabinfo.boxwidth
    if (cabinfo.boxdepth != null) filter.i_box_d = cabinfo.boxdepth
    if (cabinfo.support_height != null) filter.list_support_height = String(cabinfo.support_height)

    if (boxH != null && Number(boxH) > 0) {
      filter.i_box_h = { $gte: Number(boxH) }
    }
    if (cabinfo.boxheight != null) filter.i_box_h = cabinfo.boxheight

    const payload = {
      startPage: 1,
      length: 1,
      filter,
      sort: defaultBoxSortBy,
      collection: 'box',
    }

    console.log('postAnyCollByPage box payload =', payload)

    const res = await axios.post<BoxSearchResponse>('/api/postAnyCollByPage', payload)
    const items = res.data?.result?.data ?? []
    const total = res.data?.result?.total ?? 0

    console.log('postAnyCollByPage box items =', items)


    if (items.length === 0) {
      console.error('箱検索結果なし', { payload, response: res.data })
      throw new Error(`箱検索結果がありません。検索条件を確認してください。total=${total}`)
    }

    const selectedBox = items[0]
    const boxKey = selectedBox.box_key ?? selectedBox.code ?? ''

    if (!boxKey) {
      console.error('箱検索結果に code がありません', selectedBox)
      throw new Error('箱検索結果に code がありません。box コレクションの code 項目を確認してください。')
    }

    // BoxList.vue の goToSlect と同じく、箱高さを使ってガター/ULFを再計算する。
    const gtrPayload = {
      l: useAppStore.getState().layout.layout,
      g: useAppStore.getState().layout.boxg,
      n: useAppStore.getState().layout.nrow,
      boxh: selectedBox.i_box_h,
    }

    console.log('postLayout2Gtr payload =', gtrPayload)

    const gtrRes = await axios.post('/api/postLayout2Gtr', gtrPayload)
    setLayoutUlf(gtrRes.data)
    setLayoutField('box', selectedBox)
    setLayoutField('boxcode', `確定${boxKey}`)

    pushLog(`箱選定完了: ${boxKey}`, 'success')
    return String(boxKey)
  }, [pushLog, setLayoutField, setLayoutUlf])

  const saveSvgData2 = useCallback(async () => {
    pushLog('最終SVG保存を開始します')

    const state = useAppStore.getState() as any

    const boxKey =
      state.layout?.box?.box_key ??
      state.layout?.box?.code ??
      (typeof state.layout?.boxcode === 'string'
        ? state.layout.boxcode.replace(/^確定/, '')
        : '')

    if (!boxKey) {
      throw new Error('box_key が取得できません。箱選定処理 ensureBoxSelected を先に実行してください。')
    }

    const payloadUnits = (state.layout.layout ?? []).map((u: any) => ({
      u: u.unit_no ?? u.u ?? '',
      k: u.unit_key ?? u.k ?? '',
      i: Number(u.i),
      c: Number(u.c ?? 0),
      x: Number(u.x ?? 0),
      y: Number(u.y ?? 0),
      w: Number(u.w ?? 0),
      h: Number(u.h ?? 0),
      list_w: Array.isArray(u.list_w) ? u.list_w : [],
      list_d: Array.isArray(u.list_d) ? u.list_d : [],
      gtop: Number(u.gtop ?? 0),
      gbottom: Number(u.gbottom ?? 0),
    }))

    const payloadDevices: Array<Record<string, any>> = []
    ;(state.input.device.list ?? []).forEach((block: any) => {
      ;(block.devices ?? []).forEach((d: any) => {
        payloadDevices.push({
          Name: d.Name,
          i: Number(block.i ?? block.unit_i ?? block.id ?? block.unitRef?.i ?? 0),
          id: block.block ?? block.block_no ?? null,
          X: Number(d.X ?? 0),
          Y: Number(d.Y ?? 0),
          W: Number(d.W ?? 0),
          H: Number(d.H ?? 0),
        })
      })
    })

    const payload = {
      box_key: boxKey,
      l: payloadUnits,
      devices: payloadDevices,
      background: '#ffffff',
      keep_aspect: true,
      show_index: false,
    }

    console.log('postBoxSvg4', payload)

    const res = await axios.post<string>('/api/postBoxSvg4', payload, {
      responseType: 'text' as const,
      headers: {
        Accept: 'image/svg+xml',
        'Cache-Control': 'no-store',
      },
    })

    setLayoutField('svg', res.data)
    pushLog('最終SVGを layout.svg に保存しました', 'success')
  }, [pushLog, setLayoutField])

  const handleMoveDialogClose = useCallback(() => {
    setMoveDialogOpen(false)
  }, [])

  const handleMoveProjectDetail = useCallback(() => {
    setMoveDialogOpen(false)
    navigate('/project-detail')
  }, [navigate])

  const handleRun = useCallback(async () => {
    setRunning(true)
    clearLogs()

    try {
      pushLog('生成処理を開始します')

      if (generationStartStep === 'full') {
        await loadCircuit()
        updateCircuit()
      } else if (generationStartStep === 'initialPlacement') {
        pushLog('回路編集後のため、AI初期配置から開始します')
      } else if (generationStartStep === 'lineUp') {
        pushLog('配置編集後のため、整列配置から開始します')
      }

      if (generationStartStep === 'full' || generationStartStep === 'initialPlacement') {
        await runAiInitialPlacement()
        await updateLayoutStore()
      }

      await updateLineUp()
      await ensureBoxSelected()
      await saveSvgData2()

      pushLog('バックエンドへ保存します')
      await saveWork()
      setGenerationStartStep('full')
      pushLog('バックエンド同期が完了しました', 'success')
      setMoveDialogOpen(true)
      pushLog('全処理が完了しました', 'success')
    } catch (error: any) {
      const message = error?.message ?? '不明なエラーが発生しました'
      setErrorMessage(message)
      pushLog(message, 'error')
    } finally {
      setRunning(false)
    }
  }, [
    clearLogs,
    generationStartStep,
    loadCircuit,
    pushLog,
    runAiInitialPlacement,
    setGenerationStartStep,
    updateCircuit,
    updateLayoutStore,
    updateLineUp,
    ensureBoxSelected,
    saveSvgData2,
  ])

  const successCount = logs.filter((l) => l.level === 'success').length
  const errorCount = logs.filter((l) => l.level === 'error').length
  const flowSteps = useMemo(
    () => [
      { key: 'loadCircuit', label: '1. loadCircuit' },
      { key: 'updateCircuit', label: '2. updateCircuit' },
      { key: 'runAiInitialPlacement', label: '3. runAiInitialPlacement' },
      { key: 'updateLayoutStore', label: '4. updateLayoutStore' },
      { key: 'updateLineUp', label: '5. updateLineUp' },
      { key: 'ensureBoxSelected', label: '6. ensureBoxSelected' },
      { key: 'saveSvgData2', label: '7. saveSvgData2' },
    ],
    [],
  )
  const startStepKey =
    generationStartStep === 'initialPlacement'
      ? 'runAiInitialPlacement'
      : generationStartStep === 'lineUp'
        ? 'updateLineUp'
        : 'loadCircuit'
  const startStepIndex = flowSteps.findIndex((step) => step.key === startStepKey)
  const startStepLabel = flowSteps[startStepIndex]?.label ?? flowSteps[0].label

  return (
    <Box sx={{ p: 3, backgroundColor: '#f6f8fb', minHeight: '100vh' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            回路生成 / 配置生成
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            生成開始ボタンで、回路生成 → 配置生成 → 整列 → SVG保存まで順に実行します。
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Card sx={{ flex: 1, borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <MemoryIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  ストア概要
                </Typography>
              </Stack>

              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip label={`ユニット: ${summary.unitCount}`} color="default" />
                <Chip label={`デバイス: ${summary.deviceCount}`} color="default" />
                <Chip label={`回路ノード: ${summary.graphNodeCount}`} color="info" />
                <Chip label={`回路エッジ: ${summary.graphEdgeCount}`} color="info" />
                <Chip label={`配置件数: ${summary.layoutCount}`} color="secondary" />
                <Chip label={`成功: ${successCount}`} color="success" />
                <Chip label={`エラー: ${errorCount}`} color="error" />
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={running ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                  onClick={handleRun}
                  disabled={running}
                >
                  {running ? '生成中...' : '生成開始'}
                </Button>

                <Chip
                  icon={running ? <CircularProgress size={16} /> : <DoneAllIcon />}
                  label={running ? '実行中' : '待機中'}
                  color={running ? 'warning' : 'default'}
                  variant="outlined"
                />
              </Stack>

              {errorMessage && (
                <Alert sx={{ mt: 2 }} severity="error" icon={<ErrorOutlineIcon />}>
                  {errorMessage}
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card sx={{ width: { xs: '100%', md: 320 }, borderRadius: 3 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <SchemaIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  実行フロー
                </Typography>
              </Stack>

              <Alert severity="info" sx={{ mb: 1.5 }}>
                今回の開始点: {startStepLabel}
              </Alert>

              <List dense>
                {flowSteps.map((step, index) => {
                  const isStartStep = index === startStepIndex
                  const isSkipped = index < startStepIndex

                  return (
                    <ListItem
                      key={step.key}
                      disablePadding
                      secondaryAction={
                        isStartStep ? (
                          <Chip size="small" label="開始" color="primary" />
                        ) : isSkipped ? (
                          <Chip size="small" label="スキップ" variant="outlined" />
                        ) : null
                      }
                      sx={{
                        py: 0.5,
                        opacity: isSkipped ? 0.45 : 1,
                        '& .MuiListItemText-primary': {
                          fontWeight: isStartStep ? 700 : 400,
                          color: isStartStep ? 'primary.main' : 'text.primary',
                        },
                      }}
                    >
                      <ListItemText primary={step.label} />
                    </ListItem>
                  )
                })}
              </List>
            </CardContent>
          </Card>
        </Stack>

        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <ViewListIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>
                生成ロジック経過
              </Typography>
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                backgroundColor: '#0f172a',
                color: '#e5e7eb',
                minHeight: 420,
                maxHeight: 560,
                overflowY: 'auto',
                borderRadius: 2,
              }}
            >
              {logs.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                  まだ実行されていません。
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {logs.map((log) => (
                    <Box
                      key={log.id}
                      sx={{
                        px: 1.5,
                        py: 1,
                        borderRadius: 1.5,
                        backgroundColor:
                          log.level === 'error'
                            ? 'rgba(239,68,68,0.16)'
                            : log.level === 'success'
                              ? 'rgba(34,197,94,0.14)'
                              : 'rgba(148,163,184,0.10)',
                        border:
                          log.level === 'error'
                            ? '1px solid rgba(239,68,68,0.35)'
                            : log.level === 'success'
                              ? '1px solid rgba(34,197,94,0.25)'
                              : '1px solid rgba(148,163,184,0.18)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', color: '#94a3b8', mb: 0.5 }}
                      >
                        {log.time}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {log.message}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={moveDialogOpen} onClose={handleMoveDialogClose}>
        <DialogTitle>移動確認</DialogTitle>
        <DialogContent>
          <DialogContentText>
            生成が成功しました。移動先を選択してください。
          </DialogContentText>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            図面番号: {String(drawingNo || '')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleMoveDialogClose}>キャンセル</Button>
          <Button onClick={handleMoveProjectDetail} variant="outlined">
            案件詳細へ
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
