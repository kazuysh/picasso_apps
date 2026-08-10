import { useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import type { PostGens2JsonResponse } from '../api/postGens2Json'
import { postGens2Json } from '../api/postGens2Json'
import GenzTopologyDiagram from '../components/GenzTopologyDiagram'
import type { CircuitNode, CircuitTopologyResult, TopologyPromptRow } from '../utils/genzTopology'
import { buildPathMermaid, buildTopologies } from '../utils/genzTopology'

const initialJson = `{
  "statusCode": 200,
  "data": {
    "meta": {},
    "boards": []
  }
}`

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { msg?: string; message?: string; detail?: string } | undefined
    return data?.msg || data?.message || data?.detail || error.message
  }
  return error instanceof Error ? error.message : '処理に失敗しました。'
}

function JsonDetails({ label, value }: { label: string; value: unknown }) {
  return (
    <Box component="details" sx={{ mt: 1.5 }}>
      <Typography component="summary" variant="body2" fontWeight={700} sx={{ cursor: 'pointer' }}>{label}</Typography>
      <Box component="pre" sx={{ m: 0, mt: 1, p: 2, borderRadius: 1, bgcolor: 'grey.900', color: 'grey.100',
        fontSize: 12, lineHeight: 1.55, overflow: 'auto', maxHeight: 430 }}>{JSON.stringify(value, null, 2)}</Box>
    </Box>
  )
}

function NodeTable({ nodes }: { nodes: CircuitNode[] }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
      <Table size="small">
        <TableHead><TableRow>
          {['kind', 'block_id', 'qty', 'device_type', 'capacity', 'circuit_name', 'unit_keys'].map((name) =>
            <TableCell key={name} sx={{ fontWeight: 700 }}>{name}</TableCell>)}
        </TableRow></TableHead>
        <TableBody>{nodes.map((node) => (
          <TableRow key={node.id} hover>
            <TableCell><Chip size="small" label={node.kind} /></TableCell>
            <TableCell>{node.block_id || '—'}</TableCell>
            <TableCell>{node.qty}</TableCell>
            <TableCell>{node.metadata.device_type || '—'}</TableCell>
            <TableCell>{node.metadata.capacity || '—'}</TableCell>
            <TableCell>{node.metadata.circuit_name || '—'}</TableCell>
            <TableCell>{node.metadata.unit_keys.join(', ') || '—'}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </TableContainer>
  )
}

function BoardPanel({ result, normalized }: { result: CircuitTopologyResult; normalized: TopologyPromptRow[] }) {
  const boardRows = normalized.filter((row) => row.board_name === result.board_name)
  return (
    <Stack spacing={2}>
      {result.warnings.length > 0 && (
        <Alert severity="warning">
          <Typography fontWeight={700} mb={0.5}>トポロジー警告 {result.warnings.length}件</Typography>
          {result.warnings.map((warning, index) => <Box key={`${warning.code}-${index}`}>PATH {warning.path_no}: [{warning.code}] {warning.message}</Box>)}
        </Alert>
      )}
      {result.paths.map((path, index) => {
        const mermaidSource = buildPathMermaid(path)
        return (
          <Accordion key={path.path_no} defaultExpanded={index === 0} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction={{ xs: 'column', md: 'row' }} gap={1} alignItems={{ md: 'center' }}>
                <Typography fontWeight={800}>PATH {path.path_no}</Typography>
                {path.phase && <Chip size="small" label={path.phase} variant="outlined" />}
                {path.unit_keys.map((key) => <Chip size="small" key={key} label={key} />)}
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 }, bgcolor: '#fbfcfe' }}>
                <GenzTopologyDiagram source={mermaidSource} />
              </Paper>
              <NodeTable nodes={path.nodes} />
              <JsonDetails label="構造化グラフ（nodes / edges）" value={path} />
              <Box component="details" sx={{ mt: 1.5 }}>
                <Typography component="summary" variant="body2" fontWeight={700} sx={{ cursor: 'pointer' }}>Mermaidソース</Typography>
                <Box component="pre" sx={{ m: 0, mt: 1, p: 2, borderRadius: 1, bgcolor: 'grey.900', color: 'grey.100',
                  fontSize: 12, lineHeight: 1.55, overflow: 'auto' }}>{mermaidSource}</Box>
              </Box>
            </AccordionDetails>
          </Accordion>
        )
      })}
      <JsonDetails label="LLMへ渡す盤別正規化データ" value={boardRows} />
      <JsonDetails label="盤全体の構造化グラフ" value={result} />
    </Stack>
  )
}

export default function GenzLoad2Page() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [sourceText, setSourceText] = useState(initialJson)
  const [fileName, setFileName] = useState('')
  const [wrapRequest, setWrapRequest] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState<PostGens2JsonResponse | null>(null)
  const [selectedBoard, setSelectedBoard] = useState(0)

  const topology = useMemo(() => {
    if (!response) return null
    if (response.ok !== true) return { error: response.message || 'APIが成功レスポンスを返しませんでした。' }
    if (!Array.isArray(response.output_data)) return { error: 'レスポンスに output_data 配列がありません。' }
    try {
      return { data: buildTopologies(response.output_data) }
    } catch (buildError) {
      return { error: getErrorMessage(buildError) }
    }
  }, [response])

  const handleFile = async (file?: File) => {
    if (!file) return
    try {
      const value = await file.text()
      JSON.parse(value)
      setSourceText(value)
      setFileName(file.name)
      setResponse(null)
      setError('')
    } catch {
      setError('選択したファイルは有効なJSONではありません。')
    }
  }

  const handleSubmit = async () => {
    setError('')
    setResponse(null)
    let payload: unknown
    try {
      payload = JSON.parse(sourceText)
    } catch (parseError) {
      setError(`JSONを解析できません: ${getErrorMessage(parseError)}`)
      return
    }
    setLoading(true)
    try {
      setResponse(await postGens2Json(payload, wrapRequest))
      setSelectedBoard(0)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  const results = topology && 'data' in topology ? topology.data?.results ?? [] : []
  const normalized = topology && 'data' in topology ? topology.data?.normalized ?? [] : []
  const currentBoard = results[selectedBoard]

  return (
    <Box sx={{ minHeight: 'calc(100vh - 64px)', bgcolor: '#f6f8fb', py: { xs: 2, md: 4 }, px: 2, textAlign: 'left' }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Stack direction="row" gap={1.5} alignItems="center" mb={0.5}>
          <AccountTreeOutlinedIcon color="primary" />
          <Typography component="h1" variant="h4" fontWeight={800} sx={{ m: 0 }}>Genz 回路トポロジー テスト</Typography>
        </Stack>
        <Typography color="text.secondary" mb={3}>postGens2Json の output_data から盤・PATH別の構造化グラフとMermaid回路図を生成します。</Typography>

        <Card variant="outlined" sx={{ mb: 3 }}><CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>1. Gens JSONを変換</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }} mb={2}>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => void handleFile(event.target.files?.[0])} />
            <Button variant="outlined" startIcon={<CloudUploadOutlinedIcon />} onClick={() => fileRef.current?.click()}>JSONファイルを選択</Button>
            <Chip label={fileName || '未選択'} variant="outlined" />
          </Stack>
          <TextField fullWidth multiline minRows={9} maxRows={20} label="Gens JSON（貼り付け可能）" value={sourceText}
            onChange={(event) => { setSourceText(event.target.value); setResponse(null) }}
            slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5 } } }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2} mt={2}>
            <FormControlLabel control={<Checkbox checked={wrapRequest} onChange={(event) => setWrapRequest(event.target.checked)} />}
              label="gens_outputで包んで送信（形式B）" />
            <Button variant="contained" size="large" disabled={loading || !sourceText.trim()}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowRoundedIcon />}
              onClick={() => void handleSubmit()}>{loading ? '変換中…' : 'postGens2Jsonを実行'}</Button>
          </Stack>
        </CardContent></Card>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {topology && 'error' in topology && <Alert severity="error" sx={{ mb: 3 }}>{topology.error}</Alert>}

        {results.length > 0 && (
          <Card variant="outlined"><CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1} mb={2}>
              <Box>
                <Typography variant="h6" fontWeight={700}>2. 回路トポロジー</Typography>
                <Typography variant="body2" color="text.secondary">{results.length}盤 / {results.reduce((sum, item) => sum + item.paths.length, 0)} PATH / 正規化データ {normalized.length}件</Typography>
              </Box>
              <Chip color="success" label="ローカル規則で生成・検証済み" />
            </Stack>
            <Divider />
            <Tabs value={selectedBoard} onChange={(_event, value: number) => setSelectedBoard(value)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
              {results.map((result) => <Tab key={result.board_name} label={`${result.board_name} (${result.paths.length} PATH)`} />)}
            </Tabs>
            {currentBoard && <BoardPanel result={currentBoard} normalized={normalized} />}
          </CardContent></Card>
        )}
      </Box>
    </Box>
  )
}
