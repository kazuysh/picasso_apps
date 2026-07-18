import { useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DataObjectIcon from '@mui/icons-material/DataObject'
import type { JsonRecord, PostGens2JsonResponse } from '../api/postGens2Json'
import { postGens2Json } from '../api/postGens2Json'

const outputDataFields = [
  'board_name', 'unit_key', 'subunit', 'block_id', 'path_no', 'phase',
  'breaker_type', 'qty', 'device_id', 'connection_type', 'wire', 'capacity',
  'device_type', 'circuit_name', 'order', 'option_main',
]

const outputDataRawFields = [
  'board_name', 'path_no', 'unit_key', 'subunit', 'block', 'wire', 'phase',
]

const initialJson = `{
  "statusCode": 200,
  "data": {
    "meta": {},
    "boards": []
  }
}`

function formatValue(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const response = error.response?.data as { msg?: string; message?: string; detail?: string } | undefined
    return response?.msg || response?.message || response?.detail || error.message
  }
  return error instanceof Error ? error.message : 'APIの実行に失敗しました。'
}

function ResultTable({ rows, fields, emptyText }: {
  rows: JsonRecord[]
  fields: string[]
  emptyText: string
}) {
  const columns = useMemo(() => {
    const extra = rows.flatMap((row) => Object.keys(row)).filter((key) => !fields.includes(key))
    return [...fields, ...Array.from(new Set(extra))]
  }, [rows, fields])

  if (rows.length === 0) {
    return <Alert severity="info">{emptyText}</Alert>
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 440 }}>
      <Table stickyHeader size="small" aria-label="API response table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>#</TableCell>
            {columns.map((field) => (
              <TableCell key={field} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{field}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index} hover>
              <TableCell sx={{ color: 'text.secondary' }}>{index + 1}</TableCell>
              {columns.map((field) => (
                <TableCell key={field} sx={{ minWidth: 110, maxWidth: 320, overflowWrap: 'anywhere' }}>
                  {formatValue(row[field]) || <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function DataSection({ title, description, fields, rows }: {
  title: string
  description: string
  fields: string[]
  rows: JsonRecord[]
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} mb={2}>
          <Box>
            <Typography variant="h6" fontWeight={700}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">{description}</Typography>
          </Box>
          <Chip label={`${rows.length} 件`} color="primary" variant="outlined" sx={{ alignSelf: 'flex-start' }} />
        </Stack>

        <Typography variant="caption" color="text.secondary">仕様上のフィールド</Typography>
        <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} mt={0.5} mb={2}>
          {fields.map((field) => <Chip key={field} label={field} size="small" />)}
        </Stack>

        <ResultTable rows={rows} fields={fields} emptyText={`${title} は空配列です。`} />

        <Box component="details" sx={{ mt: 2 }}>
          <Typography component="summary" variant="body2" sx={{ cursor: 'pointer', fontWeight: 700 }}>
            整形JSONを表示
          </Typography>
          <Box component="pre" sx={{ m: 0, mt: 1, p: 2, bgcolor: 'grey.900', color: 'grey.100', borderRadius: 1,
            textAlign: 'left', fontSize: 12, lineHeight: 1.55, overflow: 'auto', maxHeight: 420 }}>
            {JSON.stringify(rows, null, 2)}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function GenzLoadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sourceText, setSourceText] = useState(initialJson)
  const [fileName, setFileName] = useState('')
  const [wrapRequest, setWrapRequest] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState<PostGens2JsonResponse | null>(null)

  const handleFile = async (file?: File) => {
    if (!file) return
    try {
      const text = await file.text()
      JSON.parse(text)
      setSourceText(text)
      setFileName(file.name)
      setError('')
      setResponse(null)
    } catch {
      setError('選択したファイルは有効なJSONではありません。')
    }
  }

  const handleSubmit = async () => {
    setError('')
    setResponse(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(sourceText)
    } catch (parseError) {
      setError(`JSONを解析できません: ${parseError instanceof Error ? parseError.message : '形式を確認してください。'}`)
      return
    }

    setLoading(true)
    try {
      setResponse(await postGens2Json(parsed, wrapRequest))
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  const outputData = Array.isArray(response?.output_data) ? response.output_data : []
  const outputDataRaw = Array.isArray(response?.output_data_raw) ? response.output_data_raw : []
  const summaryEntries = response?.summary ? Object.entries(response.summary) : []

  return (
    <Box sx={{ minHeight: 'calc(100vh - 64px)', bgcolor: '#f6f8fb', py: { xs: 2, md: 4 }, px: { xs: 2, md: 3 }, textAlign: 'left' }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" gap={1.5} mb={0.5}>
          <DataObjectIcon color="primary" />
          <Typography variant="h4" component="h1" fontWeight={800} sx={{ m: 0, fontSize: { xs: 26, md: 32 } }}>
            Genz JSON 変換テスト
          </Typography>
        </Stack>
        <Typography color="text.secondary" mb={3}>
          Gens出力JSONを <Box component="code">POST /api/postGens2Json</Box> に送信し、変換結果の構造を確認します。
        </Typography>

        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>1. リクエスト</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'center' }} mb={2}>
              <input ref={fileInputRef} type="file" accept="application/json,.json" hidden
                onChange={(event) => void handleFile(event.target.files?.[0])} />
              <Button variant="outlined" startIcon={<CloudUploadOutlinedIcon />} onClick={() => fileInputRef.current?.click()}>
                JSONファイルを選択
              </Button>
              {fileName && <Chip label={fileName} onDelete={() => setFileName('')} />}
              <Button color="inherit" startIcon={<DeleteOutlineIcon />} onClick={() => { setSourceText(''); setFileName(''); setResponse(null) }}>
                クリア
              </Button>
            </Stack>
            <TextField
              value={sourceText}
              onChange={(event) => { setSourceText(event.target.value); setResponse(null) }}
              multiline
              minRows={12}
              maxRows={24}
              fullWidth
              label="Gens JSON（貼り付けも可能）"
              slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 13, lineHeight: 1.55 } } }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" mt={2} gap={2}>
              <FormControlLabel
                control={<Checkbox checked={wrapRequest} onChange={(event) => setWrapRequest(event.target.checked)} />}
                label={<Box><Typography variant="body2">gens_output で包んで送信</Typography><Typography variant="caption" color="text.secondary">仕様書のリクエスト形式 B</Typography></Box>}
              />
              <Button variant="contained" size="large" startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowRoundedIcon />}
                disabled={loading || !sourceText.trim()} onClick={() => void handleSubmit()}>
                {loading ? '変換中…' : 'postGens2Json を実行'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 3, whiteSpace: 'pre-wrap' }}>{error}</Alert>}

        {response && (
          <Stack spacing={3}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>2. 実行結果</Typography>
                    <Alert severity={response.ok === false ? 'warning' : 'success'} sx={{ mt: 1 }}>
                      {response.message || (response.ok === false ? 'APIがエラーを返しました。' : 'レスポンスを受信しました。')}
                    </Alert>
                  </Box>
                  <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} alignContent="flex-start">
                    {summaryEntries.map(([key, value]) => <Chip key={key} label={`${key}: ${formatValue(value)}`} variant="outlined" />)}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Divider><Chip label="主要レスポンス配列" /></Divider>
            <DataSection title="output_data" description="機器をブロック単位に集約したデータ（従来の output_data.xlsx 相当）"
              fields={outputDataFields} rows={outputData} />
            <DataSection title="output_data_raw" description="ユニット / サブユニット / ブロックへ展開したデータ（従来の output_data_raw.xlsx 相当）"
              fields={outputDataRawFields} rows={outputDataRaw} />

            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" fontWeight={700}>レスポンス全体</Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  output_data_flat_by_board や summary を含むAPIレスポンス全体です。
                </Typography>
                <Box component="pre" sx={{ m: 0, p: 2, bgcolor: 'grey.900', color: 'grey.100', borderRadius: 1,
                  fontSize: 12, lineHeight: 1.55, overflow: 'auto', maxHeight: 560 }}>
                  {JSON.stringify(response, null, 2)}
                </Box>
              </CardContent>
            </Card>
          </Stack>
        )}
      </Box>
    </Box>
  )
}
