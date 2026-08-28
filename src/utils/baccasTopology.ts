import type { BlockRow } from '../api/postBCSTXT2BlockJSON'
import type {
  CircuitEdge,
  CircuitNode,
  CircuitPathGraph,
  CircuitTopologyResult,
  EdgeKind,
  NodeKind,
  TopologyWarning,
} from './genzTopology'
import { splitValues, validateTopology } from './genzTopology'

export type BaccasTopologyRow = {
  board_name: string
  path_no: string
  unit_keys: string[]
  subunits: string[]
  block_id: string
  device_list: string
  wire: string
  phase: string
  inferred_kind: Exclude<NodeKind, 'source' | 'bus' | 'output' | 'unknown'>
}

function text(value: unknown) {
  return String(value ?? '').trim()
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'))
}

function comparePaths(a: string, b: string) {
  const numberA = /^P?(\d+)$/i.exec(a)
  const numberB = /^P?(\d+)$/i.exec(b)
  if (numberA && numberB) return Number(numberA[1]) - Number(numberB[1])
  if (numberA) return -1
  if (numberB) return 1
  return a.localeCompare(b, 'ja')
}

function inferKind(block: string): BaccasTopologyRow['inferred_kind'] {
  const value = block.toUpperCase()
  if (/(^|[_-])(MAIN|MA)([_-]|$)|主幹/.test(value)) return 'main'
  if (/(CONTROL|CTRL|CONT|REMOTE|REM|RELAY|RY|TR)([_-]|$)|制御|リモコン/.test(value)) return 'control'
  return 'branch'
}

function toMetadata(row?: BaccasTopologyRow): CircuitNode['metadata'] {
  return {
    unit_keys: row?.unit_keys ?? [],
    subunits: row?.subunits ?? [],
    device_id: row?.device_list ?? '',
    circuit_name: '',
    capacity: '',
    device_type: row?.block_id ?? '',
    connection_type: '',
    wire: row?.wire ?? '',
    order: '',
    option_main: '',
  }
}

function blockNode(id: string, kind: NodeKind, heading: string, row: BaccasTopologyRow): CircuitNode {
  return {
    id,
    kind,
    label: [heading, row.block_id, row.unit_keys.join(', '), row.subunits.join(', ')].filter(Boolean).join('\n'),
    block_id: row.block_id || null,
    qty: 1,
    metadata: toMetadata(row),
  }
}

function addWarning(warnings: TopologyWarning[], code: string, board: string, path: string, message: string) {
  warnings.push({ code, board_name: board, path_no: path, message })
}

function makePath(
  board: string,
  pathNo: string,
  rows: BaccasTopologyRow[],
  pathIndex: number,
  warnings: TopologyWarning[],
): CircuitPathGraph {
  const prefix = `b_${pathIndex + 1}`
  const nodes: CircuitNode[] = [{
    id: `${prefix}_source`, kind: 'source', label: '入力', block_id: null, qty: 1, metadata: toMetadata(rows[0]),
  }]
  const edges: CircuitEdge[] = []
  let edgeIndex = 1
  const connect = (source: string, target: string, kind: EdgeKind, label = '') => {
    edges.push({ id: `${prefix}_edge_${edgeIndex++}`, source, target, kind, label })
  }

  const mains = rows.filter((row) => row.inferred_kind === 'main')
  const branches = rows.filter((row) => row.inferred_kind === 'branch')
  const controls = rows.filter((row) => row.inferred_kind === 'control')
  const phases = unique(rows.map((row) => row.phase))

  if (!mains.length) addWarning(warnings, 'inferred_missing_main', board, pathNo, '主幹ブロックを識別できないため、入力を母線へ直接接続しました。')
  if (mains.length > 1) addWarning(warnings, 'inferred_multiple_main', board, pathNo, '主幹候補が複数あるため並列に表示します。')
  if (phases.length > 1) addWarning(warnings, 'inconsistent_phase', board, pathNo, '同一PATHに複数のphaseがあります。')

  const mainNodes = mains.map((row, index) => blockNode(`${prefix}_main_${index + 1}`, 'main', '主幹', row))
  nodes.push(...mainNodes)
  const busId = `${prefix}_bus`
  nodes.push({ id: busId, kind: 'bus', label: '分岐母線', block_id: null, qty: 1, metadata: toMetadata(rows[0]) })

  if (mainNodes.length) {
    mainNodes.forEach((node, index) => {
      connect(`${prefix}_source`, node.id, 'power', mains[index].wire)
      connect(node.id, busId, 'power', mains[index].wire)
    })
  } else {
    connect(`${prefix}_source`, busId, 'fallback')
  }

  branches.forEach((row, index) => {
    const node = blockNode(`${prefix}_branch_${index + 1}`, 'branch', '分岐', row)
    nodes.push(node)
    connect(busId, node.id, 'branch', row.wire)
  })
  controls.forEach((row, index) => {
    const node = blockNode(`${prefix}_control_${index + 1}`, 'control', '制御', row)
    nodes.push(node)
    connect(node.id, busId, 'control', '制御')
  })

  if (!branches.length) {
    const outputId = `${prefix}_output`
    nodes.push({ id: outputId, kind: 'output', label: '出力', block_id: null, qty: 1, metadata: toMetadata(rows[0]) })
    connect(busId, outputId, 'fallback')
  }

  return {
    path_no: pathNo,
    title: `${board} / PATH ${pathNo}`,
    phase: phases.join(' / '),
    unit_keys: unique(rows.flatMap((row) => row.unit_keys)),
    nodes,
    edges,
  }
}

export function buildBaccasTopology(rows: BlockRow[], boardName = 'Baccas'): {
  normalized: BaccasTopologyRow[]
  result: CircuitTopologyResult
} {
  const board = boardName.trim() || 'Baccas'
  const normalized = rows.map((row, index) => {
    const pathNo = text(row.path_no) || `未設定-${index + 1}`
    const blockId = text(row.block) || '(block未設定)'
    return {
      board_name: board,
      path_no: pathNo,
      unit_keys: splitValues(row.unit_key),
      subunits: splitValues(row.subunit),
      block_id: blockId,
      device_list: text(row.device_list),
      wire: text(row.wire),
      phase: text(row.phase),
      inferred_kind: inferKind(blockId),
    }
  })
  const grouped = new Map<string, BaccasTopologyRow[]>()
  normalized.forEach((row) => grouped.set(row.path_no, [...(grouped.get(row.path_no) ?? []), row]))
  const warnings: TopologyWarning[] = []
  const paths = [...grouped.entries()]
    .sort(([a], [b]) => comparePaths(a, b))
    .map(([pathNo, pathRows], index) => makePath(board, pathNo, pathRows, index, warnings))
  const result: CircuitTopologyResult = {
    schema_version: '1.0',
    prompt_version: 'post-baccas-topology-v1',
    board_name: board,
    paths,
    warnings,
  }
  validateTopology(result)
  return { normalized, result }
}
