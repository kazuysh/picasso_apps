import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mermaid from 'mermaid'
import {
  Box,
  Button,
  Dialog,
  IconButton,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import RestartAltIcon from '@mui/icons-material/RestartAlt'

export type CircuitEditDialogProps = {
  open: boolean
  graphdata?: any
  onClose: () => void
  onChange?: (nextGraphdata: any) => void
}

type NodeLike = {
  id?: string
  Unit_No?: string
  unit_no?: string
  label?: string
  [key: string]: any
}

type EdgeLike = {
  from?: string
  to?: string
  source?: string
  target?: string
  src?: string
  dst?: string
  [key: string]: any
}

type NormalizedGraphdata = {
  nodes: NodeLike[]
  edges: EdgeLike[]
  originalNodeKey: 'nodes' | 'node'
  originalEdgeKey: 'edges' | 'edge'
}

function normalize(value: unknown) {
  return String(value ?? '').trim()
}

function sanitizeMermaidId(value: unknown) {
  const text = normalize(value).replace(/[^a-zA-Z0-9_]/g, '_')
  return text || 'EMPTY_NODE'
}

function getNodeId(node: any) {
  return normalize(node?.id ?? node?.Unit_No ?? node?.unit_no ?? node?.UnitNo ?? node?.name)
}

function getNodeLabel(node: any) {
  return normalize(node?.label ?? node?.Label ?? node?.Unit_No ?? node?.unit_no ?? node?.id ?? node?.name)
}

function getEdgeFrom(edge: EdgeLike) {
  return normalize(edge?.from ?? edge?.source ?? edge?.src ?? edge?.v)
}

function getEdgeTo(edge: EdgeLike) {
  return normalize(edge?.to ?? edge?.target ?? edge?.dst ?? edge?.w)
}

function normalizeGraphdata(graphdata: any): NormalizedGraphdata {
  const originalNodeKey: 'nodes' | 'node' = Array.isArray(graphdata?.nodes) ? 'nodes' : 'node'
  const originalEdgeKey: 'edges' | 'edge' = Array.isArray(graphdata?.edges) ? 'edges' : 'edge'

  const rawNodes = Array.isArray(graphdata?.nodes)
    ? graphdata.nodes
    : Array.isArray(graphdata?.node)
      ? graphdata.node
      : []

  const rawEdges = Array.isArray(graphdata?.edges)
    ? graphdata.edges
    : Array.isArray(graphdata?.edge)
      ? graphdata.edge
      : []

  return {
    nodes: rawNodes,
    edges: rawEdges,
    originalNodeKey,
    originalEdgeKey,
  }
}

function toGraphdataShape(baseGraphdata: any, normalized: NormalizedGraphdata) {
  const next = {
    ...(baseGraphdata || {}),
    [normalized.originalNodeKey]: normalized.nodes,
    [normalized.originalEdgeKey]: normalized.edges,
  }

  // 既存コンポーネントが nodes/edges と node/edge のどちらを参照しても表示できるように両方へ同期します。
  next.nodes = normalized.nodes
  next.edges = normalized.edges
  next.node = normalized.nodes
  next.edge = normalized.edges

  return next
}

function getMermaidNodeIdFromDomId(rawDomId: string) {
  // Mermaid の g.node id は以下のような形式になることがあります。
  //   flowchart-IN_1-4
  //   mermaid-xxx-flowchart-IN_1-4
  // 末尾の -4 は Mermaid が付ける内部連番なので除去します。
  const withoutTrailingIndex = rawDomId.replace(/-\d+$/, '')
  const marker = '-flowchart-'

  if (withoutTrailingIndex.includes(marker)) {
    return withoutTrailingIndex.split(marker).pop() || ''
  }

  return withoutTrailingIndex.replace(/^flowchart-/, '')
}

function hasEdgeBetween(edges: EdgeLike[], nodeA: string, nodeB: string) {
  return edges.some((edge) => {
    const from = getEdgeFrom(edge)
    const to = getEdgeTo(edge)
    return (from === nodeA && to === nodeB) || (from === nodeB && to === nodeA)
  })
}

function removeEdgeBetween(edges: EdgeLike[], nodeA: string, nodeB: string) {
  return edges.filter((edge) => {
    const from = getEdgeFrom(edge)
    const to = getEdgeTo(edge)
    return !((from === nodeA && to === nodeB) || (from === nodeB && to === nodeA))
  })
}

function makeEdge(from: string, to: string): EdgeLike {
  return { from, to, source: from, target: to }
}

function sleepFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

const ZOOM_MIN = 0.25
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25
const ZOOM_INITIAL = 1

function clampZoom(value: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))
}

function formatZoomPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export default function CircuitEditDialog({
  open,
  graphdata,
  onClose,
  onChange,
}: CircuitEditDialogProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const renderSeqRef = useRef(0)
  const [dialogEntered, setDialogEntered] = useState(false)
  const [draftGraphdata, setDraftGraphdata] = useState<NormalizedGraphdata>(() => normalizeGraphdata(graphdata))
  const [firstNodeId, setFirstNodeId] = useState<string>('')
  const [message, setMessage] = useState<string>('ブロックを1つ選択してください。')
  const [svgHtml, setSvgHtml] = useState<string>('')
  const [renderError, setRenderError] = useState<string>('')
  const [zoom, setZoom] = useState(ZOOM_INITIAL)

  useEffect(() => {
    if (!open) {
      setDialogEntered(false)
      setSvgHtml('')
      setRenderError('')
      return
    }

    const normalized = normalizeGraphdata(graphdata)
    console.log('[CircuitEditDialog][open] normalized graphdata', {
      nodeCount: normalized.nodes.length,
      edgeCount: normalized.edges.length,
      originalNodeKey: normalized.originalNodeKey,
      originalEdgeKey: normalized.originalEdgeKey,
      graphdata,
    })
    setDraftGraphdata(normalized)
    setFirstNodeId('')
    setMessage('ブロックを1つ選択してください。')
    setZoom(ZOOM_INITIAL)
  }, [graphdata, open])

  const nodeIdMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of draftGraphdata.nodes || []) {
      const originalId = getNodeId(node)
      if (!originalId) continue
      map.set(sanitizeMermaidId(originalId), originalId)
    }
    return map
  }, [draftGraphdata.nodes])

  const mermaidText = useMemo(() => {
    if (!draftGraphdata.nodes.length) {
      return 'flowchart TD\nA[データなし]'
    }

    const lines: string[] = ['flowchart TD']
    lines.push('classDef selected fill:#fff3cd,stroke:#f57c00,stroke-width:3px;')

    for (const node of draftGraphdata.nodes) {
      const originalId = getNodeId(node)
      if (!originalId) continue
      const id = sanitizeMermaidId(originalId)
      const label = String(getNodeLabel(node) || originalId)
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br/>')
      lines.push(`${id}["${label}"]`)
    }

    for (const edge of draftGraphdata.edges || []) {
      const fromOriginal = getEdgeFrom(edge)
      const toOriginal = getEdgeTo(edge)
      const from = sanitizeMermaidId(fromOriginal)
      const to = sanitizeMermaidId(toOriginal)
      if (fromOriginal && toOriginal) lines.push(`${from} --> ${to}`)
    }

    if (firstNodeId) {
      lines.push(`class ${sanitizeMermaidId(firstNodeId)} selected;`)
    }

    const text = lines.join('\n')
    console.log('[CircuitEditDialog][mermaidText]\n' + text)
    return text
  }, [draftGraphdata, firstNodeId])

  const handleNodeClick = useCallback((clickedNodeId: string) => {
    if (!clickedNodeId) return

    if (!firstNodeId) {
      setFirstNodeId(clickedNodeId)
      setMessage(`選択中: ${clickedNodeId}。結合または解除する相手ブロックを選択してください。`)
      return
    }

    if (firstNodeId === clickedNodeId) {
      setMessage(`選択中: ${clickedNodeId}。別のブロックを選択してください。`)
      return
    }

    setDraftGraphdata((current) => {
      const exists = hasEdgeBetween(current.edges, firstNodeId, clickedNodeId)
      const nextEdges = exists
        ? removeEdgeBetween(current.edges, firstNodeId, clickedNodeId)
        : [...current.edges, makeEdge(firstNodeId, clickedNodeId)]

      setMessage(
        exists
          ? `結合を解除しました: ${firstNodeId} - ${clickedNodeId}`
          : `結合しました: ${firstNodeId} - ${clickedNodeId}`,
      )

      return {
        ...current,
        edges: nextEdges,
      }
    })

    setFirstNodeId('')
  }, [firstNodeId])

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
    })
  }, [])

  useEffect(() => {
    const seq = ++renderSeqRef.current

    const render = async () => {
      if (!open || !dialogEntered) return

      try {
        setRenderError('')
        setSvgHtml('')

        // MUI Dialog の transition 完了直後でもサイズ計算が安定しない場合があるため、1フレーム待ってから描画します。
        await sleepFrame()
        if (seq !== renderSeqRef.current) return

        const id = `circuit-edit-mermaid-${Date.now()}-${seq}`
        const result = await mermaid.render(id, mermaidText)
        if (seq !== renderSeqRef.current) return

        const svg = result.svg.replace(
          /<svg /,
          '<svg preserveAspectRatio="xMidYMid meet" style="display:block;" ',
        )

        console.log('[CircuitEditDialog][render] svg generated', {
          svgLength: svg.length,
          nodeCount: draftGraphdata.nodes.length,
          edgeCount: draftGraphdata.edges.length,
        })
        setSvgHtml(svg)
      } catch (error) {
        console.error('[CircuitEditDialog][render] error', error)
        setRenderError(String(error))
      }
    }

    render()
  }, [dialogEntered, draftGraphdata.edges.length, draftGraphdata.nodes.length, mermaidText, open])

  useEffect(() => {
    if (!open || !svgHtml || !ref.current) return

    const svgRoot = ref.current.querySelector('svg')
    if (!svgRoot) {
      console.warn('[CircuitEditDialog][bind] svg not found after html set')
      return
    }

    // 親要素の幅に強制フィットさせると、縮小しても表示幅より小さくなりません。
    // Mermaid が出力する viewBox の実寸を基準にし、外側 Box の CSS zoom で拡大縮小します。
    const viewBox = svgRoot.getAttribute('viewBox')
    const viewBoxParts = viewBox
      ?.split(/\s+/)
      .map((part) => Number(part))
      .filter((part) => Number.isFinite(part))
    const baseWidth = viewBoxParts?.[2]
    const baseHeight = viewBoxParts?.[3]

    svgRoot.removeAttribute('width')
    svgRoot.removeAttribute('height')
    svgRoot.style.width = baseWidth ? `${baseWidth}px` : 'max-content'
    svgRoot.style.maxWidth = 'none'
    svgRoot.style.minWidth = '0'
    svgRoot.style.height = baseHeight ? `${baseHeight}px` : 'auto'
    svgRoot.style.display = 'block'

    const nodeElements = svgRoot.querySelectorAll<SVGGElement>('g.node')
    console.log('[CircuitEditDialog][bind] g.node count =', nodeElements.length, {
      map: Array.from(nodeIdMap.entries()),
    })

    const cleanups: Array<() => void> = []

    nodeElements.forEach((nodeEl) => {
      const mermaidNodeId = getMermaidNodeIdFromDomId(nodeEl.id)
      const originalNodeId = nodeIdMap.get(mermaidNodeId)
      if (!originalNodeId) {
        console.warn('[CircuitEditDialog][bindNode] originalId not found', {
          rawDomId: nodeEl.id,
          mermaidNodeId,
          nodeIdMap: Array.from(nodeIdMap.entries()),
        })
        return
      }

      const onClick = (event: MouseEvent) => {
        event.stopPropagation()
        handleNodeClick(originalNodeId)
      }
      const onKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleNodeClick(originalNodeId)
        }
      }

      nodeEl.style.cursor = 'pointer'
      nodeEl.setAttribute('role', 'button')
      nodeEl.setAttribute('tabindex', '0')
      nodeEl.addEventListener('click', onClick)
      nodeEl.addEventListener('keydown', onKeydown)
      cleanups.push(() => {
        nodeEl.removeEventListener('click', onClick)
        nodeEl.removeEventListener('keydown', onKeydown)
      })
    })

    return () => cleanups.forEach((cleanup) => cleanup())
  }, [handleNodeClick, nodeIdMap, open, svgHtml])

  const handleZoomOut = () => {
    setZoom((current) => clampZoom(current - ZOOM_STEP))
  }

  const handleZoomIn = () => {
    setZoom((current) => clampZoom(current + ZOOM_STEP))
  }

  const handleZoomReset = () => {
    setZoom(ZOOM_INITIAL)
  }

  const handleApply = () => {
    onChange?.(toGraphdataShape(graphdata, draftGraphdata))
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      keepMounted
      TransitionProps={{
        onEntered: () => setDialogEntered(true),
        onExited: () => setDialogEntered(false),
      }}
    >
      <DialogTitle>回路編集</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            結合されていない2つのブロックを順番にクリックすると結合します。結合済みの2つを順番にクリックすると解除します。
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            spacing={1}
          >
            <Typography variant="body2" color={firstNodeId ? 'warning.main' : 'text.secondary'}>
              {message}
            </Typography>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" color="text.secondary">
                表示倍率: {formatZoomPercent(zoom)}
              </Typography>
              <Tooltip title="縮小">
                <span>
                  <IconButton
                    size="small"
                    aria-label="回路図を縮小"
                    onClick={handleZoomOut}
                    disabled={zoom <= ZOOM_MIN}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="拡大">
                <span>
                  <IconButton
                    size="small"
                    aria-label="回路図を拡大"
                    onClick={handleZoomIn}
                    disabled={zoom >= ZOOM_MAX}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RestartAltIcon fontSize="small" />}
                onClick={handleZoomReset}
              >
                Reset
              </Button>
            </Stack>
          </Stack>
          <Paper
            variant="outlined"
            sx={{
              p: 1,
              height: { xs: '62vh', sm: '66vh', md: '70vh' },
              minHeight: 360,
              overflow: 'auto',
              bgcolor: '#fafafa',
            }}
            onClick={() => {
              if (firstNodeId) {
                setFirstNodeId('')
                setMessage('選択を解除しました。ブロックを1つ選択してください。')
              }
            }}
          >
            {renderError ? (
              <Box
                component="pre"
                sx={{
                  m: 0,
                  color: 'error.main',
                  whiteSpace: 'pre-wrap',
                  fontSize: 13,
                }}
              >
                {renderError}
              </Box>
            ) : (
              <Box
                ref={ref}
                sx={{
                  minHeight: 340,
                  minWidth: 0,
                  width: 'fit-content',
                  maxWidth: 'none',
                  zoom,
                }}
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
            )}
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={handleApply}>反映</Button>
      </DialogActions>
    </Dialog>
  )
}
