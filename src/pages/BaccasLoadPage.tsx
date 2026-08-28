import { useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
  Typography,
} from '@mui/material'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import type { BlockRow, JsonObject, PostBCSResponse } from '../api/postBCSTXT2BlockJSON'
import { postBCSText } from '../api/postBCSTXT2BlockJSON'
import BaccasTopologyPanel from '../components/BaccasTopologyPanel'
import { buildBaccasTopology } from '../utils/baccasTopology'

type SendMode = 'file' | 'json' | 'text'

const blockFields = ['path_no', 'phase', 'wire', 'unit_key', 'subunit', 'block', 'device_list']

function display(value: unknown) {
  if (value == null || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { msg?: string; message?: string; detail?: string } | undefined
    const detail = body?.msg || body?.message || body?.detail || error.message
    return `${error.response?.status ? `HTTP ${error.response.status}: ` : ''}${detail}`
  }
  return error instanceof Error ? error.message : 'APIの実行に失敗しました。'
}

function JsonCard({ title, value }: { title: string; value: unknown }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} mb={1}>{title}</Typography>
        <Box component="pre" sx={{
          m: 0, p: 1.5, minHeight: 96, maxHeight: 300, overflow: 'auto',
          bgcolor: '#172033', color: '#eef4ff', borderRadius: 1, fontSize: 12,
          lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
        }}>
          {JSON.stringify(value ?? {}, null, 2)}
        </Box>
      </CardContent>
    </Card>
  )
}

function BlockTable({ rows }: { rows: BlockRow[] }) {
  const columns = useMemo(() => {
    const extras = rows.flatMap((row) => Object.keys(row)).filter((key) => !blockFields.includes(key))
    return [...blockFields, ...Array.from(new Set(extras))]
  }, [rows])

  if (!rows.length) return <Alert severity="info">block.list は空です。</Alert>
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 480 }}>
      <Table stickyHeader size="small" aria-label="変換されたブロック一覧">
        <TableHead><TableRow>
          <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
          {columns.map((column) => <TableCell key={column} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{column}</TableCell>)}
        </TableRow></TableHead>
        <TableBody>
          {rows.map((row, index) => <TableRow hover key={`${row.path_no ?? ''}-${index}`}>
            <TableCell>{index + 1}</TableCell>
            {columns.map((column) => <TableCell key={column} sx={{ minWidth: 110, maxWidth: 320, overflowWrap: 'anywhere' }}>
              {display(row[column])}
            </TableCell>)}
          </TableRow>)}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export type BaccasLoadPageProps = {
  showTopology?: boolean
}

export default function BaccasLoadPage({ showTopology = false }: BaccasLoadPageProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<SendMode>('file')
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [sourceFileName, setSourceFileName] = useState('')
  const [unitGroup, setUnitGroup] = useState('UPN')
  const [useInsize, setUseInsize] = useState(true)
  const [defaultPhase, setDefaultPhase] = useState('1φ3W 100/200V')
  const [defaultWire, setDefaultWire] = useState('IV')
  const [maxBlockCandidates, setMaxBlockCandidates] = useState(8)
  const [maxUnitCandidates, setMaxUnitCandidates] = useState(8)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState<PostBCSResponse | null>(null)

  const topology = useMemo(() => {
    if (!showTopology || !response || response.ok === false) return null
    const rows = response.block?.list ?? []
    if (!rows.length) return null
    const basic = response.basic ?? {}
    const boardName = String(
      basic.board_name ?? basic.boardName ?? basic.drawingNoTemp ?? basic.drawingNo ?? sourceFileName ?? 'Baccas',
    )
    try {
      return { data: buildBaccasTopology(rows, boardName) }
    } catch (buildError) {
      return { error: errorMessage(buildError) }
    }
  }, [response, showTopology, sourceFileName])

  const handleFile = async (nextFile?: File) => {
    if (!nextFile) return
    setFile(nextFile)
    setSourceFileName(nextFile.name)
    setError('')
    setResponse(null)
    try {
      setText(await nextFile.text())
    } catch {
      setText('')
    }
  }

  const clear = () => {
    setFile(null)
    setText('')
    setSourceFileName('')
    setResponse(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const submit = async () => {
    if (mode !== 'file' && !text.trim()) {
      setError('送信するHOST見積もり画面テキストを入力してください。')
      return
    }
    setLoading(true)
    setError('')
    setResponse(null)
    try {
      setResponse(await postBCSText(mode, text, file, {
        sourceFileName, unitGroup, useInsize, defaultPhase, defaultWire,
        maxBlockCandidates, maxUnitCandidates,
      }))
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const blocks = response?.block?.list ?? []
  const unmatched = response?.inference?.unmatched_lines ?? []
  const inference = response?.inference
  const statusColor = inference?.status === 'partial' ? 'warning' : 'success'

  return (
    <Box sx={{ minHeight: 'calc(100vh - 64px)', bgcolor: '#f5f7fb', p: { xs: 2, md: 3 }, textAlign: 'left' }}>
      <Box sx={{ maxWidth: 1480, mx: 'auto' }}>
        <Stack direction="row" gap={1.5} alignItems="center" mb={0.5}>
          {showTopology ? <AccountTreeOutlinedIcon color="primary" /> : <TextSnippetOutlinedIcon color="primary" />}
          <Typography component="h1" variant="h4" fontWeight={800} sx={{ fontSize: { xs: 25, md: 32 } }}>
            {showTopology ? 'Baccas 回路トポロジー テスト' : 'Baccas HOSTテキスト変換テスト'}
          </Typography>
        </Stack>
        <Typography color="text.secondary" mb={3}>
          HOST見積もり画面テキストを <Box component="code">POST /api/postBCSTXT2BlockJSON</Box> に送り、
          {showTopology ? 'block.listからPATH別の構造化グラフとMermaid回路図を生成します。' : 'workData候補を確認します。'}
        </Typography>

        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>1. リクエスト</Typography>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} mb={2}>
              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel id="send-mode-label">送信方式</InputLabel>
                <Select labelId="send-mode-label" label="送信方式" value={mode} onChange={(event) => setMode(event.target.value as SendMode)}>
                  <MenuItem value="file">multipart / ファイル</MenuItem>
                  <MenuItem value="json">application/json</MenuItem>
                  <MenuItem value="text">text/plain</MenuItem>
                </Select>
              </FormControl>
              <input ref={inputRef} hidden type="file" accept=".txt,text/plain" onChange={(event) => void handleFile(event.target.files?.[0])} />
              <Button variant="outlined" startIcon={<CloudUploadOutlinedIcon />} onClick={() => inputRef.current?.click()}>
                HOSTテキストを選択
              </Button>
              {file && <Chip label={`${file.name} / ${(file.size / 1024).toFixed(1)} KB`} sx={{ alignSelf: 'center' }} />}
              <Button color="inherit" startIcon={<DeleteOutlineIcon />} onClick={clear}>クリア</Button>
            </Stack>

            <TextField fullWidth multiline minRows={10} maxRows={22} value={text}
              disabled={mode === 'file'} label={mode === 'file' ? 'ファイル内容（プレビュー）' : 'HOST見積もり画面テキスト'}
              onChange={(event) => { setText(event.target.value); setResponse(null) }}
              slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13, lineHeight: 1.55 } } }} />

            <Typography variant="subtitle2" fontWeight={700} mt={3} mb={1.5}>推定オプション</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
              <TextField label="source_file_name" value={sourceFileName} onChange={(event) => setSourceFileName(event.target.value)} />
              <TextField label="unit_group（空欄で全group）" value={unitGroup} onChange={(event) => setUnitGroup(event.target.value)} />
              <TextField label="default_phase" value={defaultPhase} onChange={(event) => setDefaultPhase(event.target.value)} />
              <TextField label="default_wire" value={defaultWire} onChange={(event) => setDefaultWire(event.target.value)} />
              <TextField type="number" label="max_block_candidates" value={maxBlockCandidates}
                slotProps={{ htmlInput: { min: 1, max: 50 } }}
                onChange={(event) => setMaxBlockCandidates(Math.min(50, Math.max(1, Number(event.target.value))))} />
              <TextField type="number" label="max_unit_candidates" value={maxUnitCandidates}
                slotProps={{ htmlInput: { min: 1, max: 50 } }}
                onChange={(event) => setMaxUnitCandidates(Math.min(50, Math.max(1, Number(event.target.value))))} />
              <FormControlLabel control={<Checkbox checked={useInsize} onChange={(event) => setUseInsize(event.target.checked)} />}
                label="UnitList.insize をスコアに利用" />
            </Box>

            <Stack direction="row" justifyContent="flex-end" mt={2}>
              <Button variant="contained" size="large" disabled={loading || (mode === 'file' ? !file : !text.trim())}
                startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowRoundedIcon />}
                onClick={() => void submit()}>
                {loading ? '変換中…' : '変換APIを実行'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 3, whiteSpace: 'pre-wrap' }}>{error}</Alert>}
        {topology && 'error' in topology && <Alert severity="error" sx={{ mb: 3 }}>{topology.error}</Alert>}

        {response && <Stack spacing={3}>
          <Card variant="outlined"><CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
              <Box>
                <Typography variant="h6" fontWeight={700}>2. 実行結果</Typography>
                <Alert severity={response.ok === false ? 'error' : statusColor} sx={{ mt: 1 }}>
                  {response.ok === false ? 'APIがエラー結果を返しました。' :
                    inference?.status === 'partial' ? '変換は完了しましたが、未マッチ明細があります。' : '変換が完了しました。'}
                </Alert>
              </Box>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} alignContent="flex-start">
                <Chip label={`format: ${response.format ?? '—'}`} variant="outlined" />
                <Chip label={`解析: ${inference?.parsed_line_count ?? 0}件`} variant="outlined" />
                <Chip label={`block: ${inference?.block_count ?? blocks.length}件`} color="primary" variant="outlined" />
                <Chip label={`未マッチ: ${inference?.unmatched_count ?? unmatched.length}件`}
                  color={unmatched.length ? 'warning' : 'default'} variant="outlined" />
              </Stack>
            </Stack>
          </CardContent></Card>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
            <JsonCard title="basic" value={response.basic} />
            <JsonCard title="cabinfo" value={response.cabinfo} />
            <JsonCard title="caboption" value={response.caboption} />
          </Box>

          <Card variant="outlined"><CardContent>
            <Typography variant="h6" fontWeight={700}>block.list</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>workData のblock系データへ格納する主データです。</Typography>
            <BlockTable rows={blocks} />
          </CardContent></Card>

          {topology && 'data' in topology && topology.data && (
            <BaccasTopologyPanel result={topology.data.result} normalized={topology.data.normalized} />
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            <JsonCard title={`未マッチ明細（${unmatched.length}件）`} value={unmatched} />
            <JsonCard title="PATH別 unit候補" value={inference?.unit_candidates ?? {}} />
          </Box>

          <Card variant="outlined"><CardContent>
            <Typography variant="h6" fontWeight={700} mb={1}>レスポンス全体</Typography>
            <Box component="pre" sx={{ m: 0, p: 2, bgcolor: '#172033', color: '#eef4ff', borderRadius: 1,
              fontSize: 12, lineHeight: 1.55, overflow: 'auto', maxHeight: 640 }}>
              {JSON.stringify(response as JsonObject, null, 2)}
            </Box>
          </CardContent></Card>
        </Stack>}
      </Box>
    </Box>
  )
}
