import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
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
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import type { OutputDataRawRow } from '../api/postGens2Json'
import { postGens2Json } from '../api/postGens2Json'
import { createUnitDeviceFromRaw, getGenzTemp, saveGenzTemp } from '../api/genzImport'
import type { GenzTempData } from '../api/genzImport'
import { useAppStore } from '../stores/useAppStore'
import type { DeviceBlockItem, UnitItem } from '../stores/useAppStore'
import { useSessionStore } from '../stores/useSessionStore'

type BoardGroup = {
  boardName: string
  rows: OutputDataRawRow[]
  unitCount: number
  pathCount: number
}

function createDefaultInput(drawingNo: string, units: UnitItem[], devices: DeviceBlockItem[], currentID: number) {
  return {
    basic: { drawingNoTemp: drawingNo },
    cabinfo: {
      input_wire: '上',
      output_wire: '下',
      selectedcategory: 'IV',
      selectedarea: '100.0',
      selectedstandard: 'JIS',
    },
    caboption: {},
    unit: { currentID, list: units, newflag: 0 },
    circuit: {},
    device: { list: devices },
  }
}

function createDefaultLayout() {
  return {
    floor: {},
    layout: [],
    ulf: {},
    boxg: ['150', '150', '150'],
    backgroundSvgUrl: '/api/getTemplate?w=0,500,50,500,50,500,50&h=2300',
    nrow: 3,
    boxH: 2300,
    box: {},
    boxcode: '',
    svg: '',
    Info: {},
    boxw: ['0', '500', '50', '500', '50', '500', '50'],
    boxh: '2300',
    boxgb: '150',
  }
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data as { msg?: string; message?: string; detail?: string } | undefined
    return detail?.msg || detail?.message || detail?.detail || error.message
  }
  return error instanceof Error ? error.message : '処理に失敗しました。'
}

function normalizeBoardName(value: unknown) {
  const name = String(value ?? '').trim()
  return name || '盤名未設定'
}

export default function GenzImportPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceAll = useAppStore((state) => state.replaceAll)
  const sessionUser = useSessionStore((state) => state.userID)
  const [drawingNo, setDrawingNo] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [tempData, setTempData] = useState<GenzTempData | null>(null)
  const [checkingTemp, setCheckingTemp] = useState(true)
  const [loading, setLoading] = useState(false)
  const [creatingBoard, setCreatingBoard] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadTemp = async () => {
    setCheckingTemp(true)
    setError('')
    try {
      const saved = await getGenzTemp()
      setTempData(saved)
      if (saved?.drawing_no) setDrawingNo(saved.drawing_no)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setCheckingTemp(false)
    }
  }

  useEffect(() => {
    let active = true
    getGenzTemp()
      .then((saved) => {
        if (!active) return
        setTempData(saved)
        if (saved?.drawing_no) setDrawingNo(saved.drawing_no)
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError))
      })
      .finally(() => {
        if (active) setCheckingTemp(false)
      })
    return () => {
      active = false
    }
  }, [])

  const boardGroups = useMemo<BoardGroup[]>(() => {
    const grouped = new Map<string, OutputDataRawRow[]>()
    for (const row of tempData?.output_data_raw ?? []) {
      const boardName = normalizeBoardName(row.board_name)
      grouped.set(boardName, [...(grouped.get(boardName) ?? []), row])
    }
    return Array.from(grouped, ([boardName, rows]) => ({
      boardName,
      rows,
      unitCount: new Set(rows.map((row) => String(row.unit_key ?? '')).filter(Boolean)).size,
      pathCount: new Set(rows.map((row) => String(row.path_no ?? '')).filter(Boolean)).size,
    }))
  }, [tempData])

  const handleLoad = async () => {
    const baseDrawingNo = drawingNo.trim()
    if (!baseDrawingNo) {
      setError('図面番号を入力してください。')
      return
    }
    if (!selectedFile) {
      setError('Gens JSONファイルを選択してください。')
      return
    }

    setLoading(true)
    setError('')
    setNotice('')
    try {
      const parsed = JSON.parse(await selectedFile.text()) as unknown
      const converted = await postGens2Json(parsed)
      if (converted.ok === false) throw new Error(converted.message || 'postGens2Json がエラーを返しました。')
      if (!Array.isArray(converted.output_data_raw)) throw new Error('レスポンスに output_data_raw がありません。')

      const saved = await saveGenzTemp({
        drawing_no: baseDrawingNo,
        source_file_name: selectedFile.name,
        output_data_raw: converted.output_data_raw,
      })
      setTempData(saved)
      setNotice(`${converted.output_data_raw.length}件を一時保存しました。`)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (group: BoardGroup) => {
    const baseDrawingNo = drawingNo.trim()
    if (!baseDrawingNo) {
      setError('図面番号を入力してください。')
      return
    }
    if (!sessionUser) {
      setError('ログインユーザーを取得できません。再ログインしてください。')
      return
    }

    const projectDrawingNo = `${baseDrawingNo}_${group.boardName}`
    setCreatingBoard(group.boardName)
    setError('')
    setNotice('')
    try {
      const result = await createUnitDeviceFromRaw(`${sessionUser}_${projectDrawingNo}`, group.rows)
      replaceAll({
        generationStartStep: 'full',
        projectMeta: { uid: '', status: '設計中' },
        input: createDefaultInput(
          projectDrawingNo,
          (result.unit ?? []) as UnitItem[],
          (result.device ?? []) as DeviceBlockItem[],
          result.currentID ?? 10000,
        ),
        output: { box: {} },
        workblock: { block: {} },
        layout: createDefaultLayout(),
      })
      navigate('/GenerationRunnerPage')
    } catch (requestError) {
      setError(errorMessage(requestError))
      setCreatingBoard('')
    }
  }

  return (
    <Box sx={{ minHeight: 'calc(100vh - 64px)', bgcolor: '#f6f7fb', py: 4, textAlign: 'left' }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} mb={3}>
          <Box>
            <Typography component="h1" variant="h4" fontWeight={800} sx={{ m: 0 }}>Genzから新規案件作成</Typography>
            <Typography color="text.secondary" mt={0.5}>Gens JSONを変換し、盤ごとに新しい案件データを作成します。</Typography>
          </Box>
          <Chip label={`ユーザー: ${sessionUser || '取得中'}`} variant="outlined" sx={{ alignSelf: 'flex-start' }} />
        </Stack>

        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2}>取込ファイル</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'flex-start' }}>
              <TextField label="図面番号" value={drawingNo} onChange={(event) => setDrawingNo(event.target.value)}
                required inputProps={{ maxLength: 16 }} helperText="盤ごとの図面番号は「図面番号_盤名」になります" sx={{ minWidth: 280 }} />
              <input ref={fileInputRef} hidden type="file" accept="application/json,.json"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
              <Button variant="outlined" size="large" startIcon={<CloudUploadOutlinedIcon />}
                onClick={() => fileInputRef.current?.click()} sx={{ minHeight: 56 }}>
                JSONファイルを選択
              </Button>
              <Box sx={{ flex: 1, minWidth: 0, pt: { md: 1.5 } }}>
                <Typography noWrap color={selectedFile ? 'text.primary' : 'text.secondary'}>
                  {selectedFile?.name || 'ファイルが選択されていません'}
                </Typography>
              </Box>
              <Button variant="contained" size="large" startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <DownloadRoundedIcon />}
                disabled={loading} onClick={() => void handleLoad()} sx={{ minHeight: 56, minWidth: 130 }}>
                {loading ? 'ロード中' : 'ロード'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}

        <Paper variant="outlined">
          <Stack direction="row" alignItems="center" justifyContent="space-between" p={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>一時保存された盤一覧</Typography>
              <Typography variant="body2" color="text.secondary">
                {tempData ? `${tempData.source_file_name || 'Gens JSON'} / output_data_raw ${tempData.output_data_raw.length}件` : '保存データはありません。'}
              </Typography>
            </Box>
            <Button startIcon={<RefreshRoundedIcon />} onClick={() => void loadTemp()} disabled={checkingTemp}>再読込</Button>
          </Stack>

          {checkingTemp ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>
          ) : boardGroups.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>一時保存された output_data_raw はありません。JSONを選択してロードしてください。</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>board_name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>作成する図面番号</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>データ件数</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>ユニット</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>経路</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {boardGroups.map((group) => (
                    <TableRow key={group.boardName} hover>
                      <TableCell><Typography fontWeight={700}>{group.boardName}</Typography></TableCell>
                      <TableCell>{`${drawingNo.trim() || '図面番号'}_${group.boardName}`}</TableCell>
                      <TableCell align="right">{group.rows.length}</TableCell>
                      <TableCell align="right">{group.unitCount}</TableCell>
                      <TableCell align="right">{group.pathCount}</TableCell>
                      <TableCell align="right">
                        <Button variant="contained" startIcon={creatingBoard === group.boardName ? <CircularProgress size={17} color="inherit" /> : <AddCircleOutlineRoundedIcon />}
                          disabled={Boolean(creatingBoard)} onClick={() => void handleCreate(group)}>
                          {creatingBoard === group.boardName ? '作成中' : '新規作成'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Container>
    </Box>
  )
}
