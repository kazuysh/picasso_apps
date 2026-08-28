import type { OutputDataRow } from '../api/postGens2Json'

export type NodeKind = 'source' | 'main' | 'bus' | 'branch' | 'control' | 'output' | 'unknown'
export type EdgeKind = 'power' | 'branch' | 'control' | 'fallback'

export type TopologyPromptRow = {
  board_name: string
  path_no: string
  unit_keys: string[]
  subunits: string[]
  block_id: string
  breaker_type: string
  qty: number
  device_id: string
  connection_type: string
  wire: string
  phase: string
  capacity: string
  device_type: string
  circuit_name: string
  order: string
  option_main: string
}

export type CircuitNode = {
  id: string
  kind: NodeKind
  label: string
  block_id: string | null
  qty: number
  metadata: Omit<TopologyPromptRow, 'board_name' | 'path_no' | 'block_id' | 'breaker_type' | 'qty' | 'phase'>
}

export type CircuitEdge = {
  id: string
  source: string
  target: string
  kind: EdgeKind
  label: string
}

export type TopologyWarning = {
  code: string
  board_name: string
  path_no: string
  message: string
}

export type CircuitPathGraph = {
  path_no: string
  title: string
  phase: string
  unit_keys: string[]
  nodes: CircuitNode[]
  edges: CircuitEdge[]
}

export type CircuitTopologyResult = {
  schema_version: '1.0'
  prompt_version: 'post-gens-topology-v1' | 'post-baccas-topology-v1'
  board_name: string
  paths: CircuitPathGraph[]
  warnings: TopologyWarning[]
}

const allowedBreakers = new Set(['main_breaker', 'branch_breaker', 'control_unit'])
const nodeClasses: Record<NodeKind, string> = {
  source: 'source', main: 'main', bus: 'bus', branch: 'branch',
  control: 'control', output: 'output', unknown: 'unknown',
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

export function splitValues(value: unknown) {
  return text(value).split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
}

export function normalizeOutputData(rows: OutputDataRow[]): TopologyPromptRow[] {
  return rows.map((row) => ({
    board_name: text(row.board_name),
    path_no: text(row.path_no),
    unit_keys: splitValues(row.unit_key),
    subunits: splitValues(row.subunit),
    block_id: text(row.block_id),
    breaker_type: text(row.breaker_type),
    qty: Math.max(0, Math.trunc(Number(row.qty) || 0)),
    device_id: text(row.device_id),
    connection_type: text(row.connection_type),
    wire: text(row.wire),
    phase: text(row.phase),
    capacity: text(row.capacity),
    device_type: text(row.device_type),
    circuit_name: text(row.circuit_name),
    order: text(row.order),
    option_main: text(row.option_main),
  }))
}

function pathSortKey(value: string): [number, number, string] {
  if (/^\d+$/.test(value)) return [0, Number(value), '']
  const pNumber = /^P(\d+)$/i.exec(value)
  if (pNumber) return [1, Number(pNumber[1]), '']
  return [2, 0, value]
}

function comparePaths(a: string, b: string) {
  const ak = pathSortKey(a)
  const bk = pathSortKey(b)
  return ak[0] - bk[0] || ak[1] - bk[1] || ak[2].localeCompare(bk[2], 'ja')
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'))
}

function metadata(row?: TopologyPromptRow): CircuitNode['metadata'] {
  return {
    unit_keys: row?.unit_keys ?? [], subunits: row?.subunits ?? [],
    device_id: row?.device_id ?? '', circuit_name: row?.circuit_name ?? '',
    capacity: row?.capacity ?? '', device_type: row?.device_type ?? '',
    connection_type: row?.connection_type ?? '', wire: row?.wire ?? '',
    order: row?.order ?? '', option_main: row?.option_main ?? '',
  }
}

function deviceSummary(row: TopologyPromptRow) {
  return [row.device_type, row.capacity].filter(Boolean).join(' / ')
}

function rowNode(id: string, kind: NodeKind, heading: string, row: TopologyPromptRow): CircuitNode {
  const count = kind === 'branch' ? `${row.qty}回路` : kind === 'control' ? `${row.qty}台` : ''
  return {
    id,
    kind,
    label: [heading, row.block_id, count, deviceSummary(row)].filter(Boolean).join('\n'),
    block_id: row.block_id || null,
    qty: row.qty,
    metadata: metadata(row),
  }
}

function addWarning(warnings: TopologyWarning[], code: string, board: string, path: string, message: string) {
  warnings.push({ code, board_name: board, path_no: path, message })
}

function makePath(board: string, pathNo: string, rows: TopologyPromptRow[], pathIndex: number, warnings: TopologyWarning[]): CircuitPathGraph {
  const prefix = `p_${pathIndex + 1}`
  const nodes: CircuitNode[] = [{ id: `${prefix}_source`, kind: 'source', label: '入力', block_id: null, qty: 1, metadata: metadata(rows[0]) }]
  const edges: CircuitEdge[] = []
  let edgeIndex = 1
  const connect = (source: string, target: string, kind: EdgeKind, label = '') => {
    edges.push({ id: `${prefix}_edge_${edgeIndex++}`, source, target, kind, label })
  }

  const mains = rows.filter((row) => row.breaker_type === 'main_breaker')
  const branches = rows.filter((row) => row.breaker_type === 'branch_breaker')
  const controls = rows.filter((row) => row.breaker_type === 'control_unit')
  const unknowns = rows.filter((row) => !allowedBreakers.has(row.breaker_type))
  const phases = unique(rows.map((row) => row.phase))

  if (mains.length > 1) addWarning(warnings, 'multiple_main_breaker_rows', board, pathNo, '主幹行が複数あるため並列候補として表示します。')
  if (branches.length && !mains.length) addWarning(warnings, 'missing_main_breaker', board, pathNo, '分岐がありますが主幹がありません。')
  if (!mains.length && !branches.length) addWarning(warnings, 'empty_power_path', board, pathNo, '主幹・分岐のないPATHです。')
  if (phases.length > 1) addWarning(warnings, 'inconsistent_phase', board, pathNo, '同一PATHに複数のphaseがあります。')
  const unitSets = new Set(rows.map((row) => JSON.stringify(unique(row.unit_keys))))
  if (unitSets.size > 1) addWarning(warnings, 'inconsistent_unit_keys', board, pathNo, '同一PATH内でunit_key集合が一致しません。')
  for (const row of unknowns) addWarning(warnings, 'unknown_breaker_type', board, pathNo, `未知のbreaker_type: ${row.breaker_type || '(空)'}`)

  const mainNodes = mains.map((row, index) => rowNode(`${prefix}_main_${index + 1}`, 'main', '主幹', row))
  nodes.push(...mainNodes)

  let controlTarget = `${prefix}_source`
  if (branches.length) {
    const busId = `${prefix}_bus`
    nodes.push({ id: busId, kind: 'bus', label: '分岐母線', block_id: null, qty: 1, metadata: metadata(rows[0]) })
    controlTarget = busId
    if (mainNodes.length) {
      mainNodes.forEach((node, index) => {
        connect(`${prefix}_source`, node.id, 'power', mains[index].wire)
        connect(node.id, busId, 'power', mains[index].wire)
      })
    } else {
      connect(`${prefix}_source`, busId, 'fallback')
    }
    branches.forEach((row, index) => {
      const node = rowNode(`${prefix}_branch_${index + 1}`, 'branch', '分岐', row)
      nodes.push(node)
      connect(busId, node.id, 'branch', row.connection_type)
    })
  } else {
    const outputId = `${prefix}_output`
    nodes.push({ id: outputId, kind: 'output', label: '出力', block_id: null, qty: 1, metadata: metadata(rows[0]) })
    if (mainNodes.length) {
      controlTarget = mainNodes[0].id
      mainNodes.forEach((node, index) => {
        connect(`${prefix}_source`, node.id, 'power', mains[index].wire)
        connect(node.id, outputId, 'power', mains[index].wire)
      })
    } else {
      connect(`${prefix}_source`, outputId, 'fallback')
    }
  }

  controls.forEach((row, index) => {
    const node = rowNode(`${prefix}_control_${index + 1}`, 'control', '制御', row)
    nodes.push(node)
    const hasBus = branches.length > 0
    connect(node.id, controlTarget, hasBus ? 'control' : 'fallback', '制御')
    if (!hasBus) addWarning(warnings, 'control_without_bus', board, pathNo, '制御ユニットを母線以外へ関連付けました。')
  })
  unknowns.forEach((row, index) => nodes.push(rowNode(`${prefix}_unknown_${index + 1}`, 'unknown', '未分類', row)))

  return {
    path_no: pathNo,
    title: `${board} / PATH ${pathNo}`,
    phase: phases.join(' / '),
    unit_keys: unique(rows.flatMap((row) => row.unit_keys)),
    nodes,
    edges,
  }
}

export function buildTopologies(rows: OutputDataRow[]): { normalized: TopologyPromptRow[]; results: CircuitTopologyResult[] } {
  const normalized = normalizeOutputData(rows)
  if (normalized.some((row) => !row.board_name || !row.path_no)) {
    throw new Error('output_data の board_name または path_no が空です。')
  }
  const boards = new Map<string, TopologyPromptRow[]>()
  normalized.forEach((row) => boards.set(row.board_name, [...(boards.get(row.board_name) ?? []), row]))
  const results = Array.from(boards, ([board, boardRows]) => {
    const warnings: TopologyWarning[] = []
    const paths = new Map<string, TopologyPromptRow[]>()
    boardRows.forEach((row) => paths.set(row.path_no, [...(paths.get(row.path_no) ?? []), row]))
    const ordered = [...paths.entries()].sort(([a], [b]) => comparePaths(a, b))
    return {
      schema_version: '1.0' as const,
      prompt_version: 'post-gens-topology-v1' as const,
      board_name: board,
      paths: ordered.map(([pathNo, pathRows], index) => makePath(board, pathNo, pathRows, index, warnings)),
      warnings,
    }
  })
  results.sort((a, b) => a.board_name.localeCompare(b.board_name, 'ja'))
  results.forEach(validateTopology)
  return { normalized, results }
}

export function validateTopology(result: CircuitTopologyResult) {
  const promptVersions: CircuitTopologyResult['prompt_version'][] = ['post-gens-topology-v1', 'post-baccas-topology-v1']
  if (result.schema_version !== '1.0' || !promptVersions.includes(result.prompt_version)) throw new Error('トポロジーのバージョンが不正です。')
  result.paths.forEach((path) => {
    const ids = new Set<string>()
    path.nodes.forEach((node) => {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(node.id) || ids.has(node.id)) throw new Error(`${path.title}: 不正または重複したノードIDです。`)
      if (!Number.isInteger(node.qty) || node.qty < 0) throw new Error(`${path.title}: qtyが不正です。`)
      ids.add(node.id)
    })
    const edgeIds = new Set<string>()
    path.edges.forEach((edge) => {
      if (edgeIds.has(edge.id) || !ids.has(edge.source) || !ids.has(edge.target)) throw new Error(`${path.title}: エッジ参照が不正です。`)
      edgeIds.add(edge.id)
    })
  })
}

function escapeLabel(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br/>')
}

export function buildPathMermaid(path: CircuitPathGraph) {
  const lines = [
    'flowchart TB',
    '  classDef source fill:#e3f2fd,stroke:#1565c0,color:#0d2a4a',
    '  classDef main fill:#fff3e0,stroke:#ef6c00,color:#5d2b00',
    '  classDef bus fill:#eeeeee,stroke:#616161,color:#212121',
    '  classDef branch fill:#e8f5e9,stroke:#2e7d32,color:#173b1a',
    '  classDef control fill:#f3e5f5,stroke:#7b1fa2,color:#3f0d48',
    '  classDef output fill:#e3f2fd,stroke:#1565c0,color:#0d2a4a',
    '  classDef unknown fill:#ffebee,stroke:#c62828,color:#5f1010',
  ]
  path.nodes.forEach((node) => {
    const label = escapeLabel(node.label)
    const shape = node.kind === 'source' || node.kind === 'output' ? `(["${label}"])` : node.kind === 'bus' ? `(("${label}"))` : `["${label}"]`
    lines.push(`  ${node.id}${shape}:::${nodeClasses[node.kind]}`)
  })
  path.edges.forEach((edge) => {
    const arrow = edge.kind === 'control' ? '-.->' : '-->'
    const label = edge.label ? `|${escapeLabel(edge.label)}|` : ''
    lines.push(`  ${edge.source} ${arrow}${label} ${edge.target}`)
  })
  return lines.join('\n')
}
