import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import EditIcon from '@mui/icons-material/Edit'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { useAppStore } from '../../stores/useAppStore'
import { useConfigStore } from '../../stores/useConfigStore'
import BoxScene3dPanel from './BoxScene3dPanel'
import BoxScene2dPanel from './BoxScene2dPanel'
import BoxListDialog from './BoxListDialog'

type AnyRecord = Record<string, any>

type InfoRow = {
  label: string
  value: ReactNode
  labelWidth: number | string
}

type InfoRowConfig = {
  label: string
  path: string
  labelWidth?: number | string
}

type SessionUser = {
  user_name: string
  id_admin: number
  full_name?: string
  update?: string
}

function joinValue(value: any): string {
  if (Array.isArray(value)) return value.join(',')
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const defaultInfoRowConfigs: InfoRowConfig[] = [
  { label: 'キャビネット品名', path: 'layout.box.code', labelWidth: 240 },
  { label: '内器高さ', path: 'input.cabinfo.support_height', labelWidth: 240 },
  { label: '移動板', path: 'layout.box.move_board', labelWidth: 240 },
  { label: '入出線位置（入線）', path: 'input.cabinfo.input_wire', labelWidth: 240 },
  { label: '入出線位置（出線）', path: 'input.cabinfo.output_wire', labelWidth: 240 },
  { label: '仕様', path: 'input.basic.major_specification', labelWidth: 240 },
  { label: '省庁', path: 'input.basic.minor_specification2', labelWidth: 240 },
]

function isInfoRowConfig(value: unknown): value is InfoRowConfig {
  if (!value || typeof value !== 'object') return false

  const row = value as Record<string, unknown>
  const hasValidLabelWidth =
    row.labelWidth === undefined ||
    (typeof row.labelWidth === 'number' && Number.isFinite(row.labelWidth) && row.labelWidth >= 0) ||
    (typeof row.labelWidth === 'string' && row.labelWidth.trim() !== '')

  return (
    typeof row.label === 'string' &&
    row.label.trim() !== '' &&
    typeof row.path === 'string' &&
    row.path.trim() !== '' &&
    hasValidLabelWidth
  )
}

function getValueByPath(source: AnyRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined
    return (value as AnyRecord)[key]
  }, source)
}

function formatUlfUnitWidth(value: any): string {
  if (value === null || value === undefined || value === '' || Number(value) === 0) {
    return ''
  }

  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return String(value)

  return String(numericValue + 100)
}

function downloadTextAsFile(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  downloadBlobAsFile(blob, filename)
}

function downloadBlobAsFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function buildUid(state: AnyRecord, drawingNo: any, fallbackUserID = ''): string {
  const userID =
    state.userID ??
    state.userId ??
    state.session?.userID ??
    state.session?.userId ??
    state.session?.session ??
    state.auth?.userID ??
    state.auth?.userId ??
    fallbackUserID ??
    ''

  return `${String(userID ?? '')}_${String(drawingNo ?? '')}`.trim()
}

export default function ResultDisplayTab() {
  const state = useAppStore((storeState: AnyRecord) => storeState)
  const config = useConfigStore((storeState) => storeState.config)

  const input = state.input ?? {}
  const layout = state.layout ?? {}
  const basic = input.basic ?? {}
  const box = layout.box ?? {}
  const ulf = layout.ulf ?? {}
  const layoutInfo = layout.layout ?? {}
  const drawingNo = basic.drawingNoTemp ?? ''
  const cabinetName = box.code ?? ''
  const [sessionUserID, setSessionUserID] = useState('')
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [loadingSessionUser, setLoadingSessionUser] = useState(true)
  const [boxListOpen, setBoxListOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchSession() {
      try {
        const res = await axios.get('/api/sessioncheck')
        const userID =
          res.data?.session ??
          res.data?.data?.session ??
          res.data?.userID ??
          res.data?.userId ??
          ''

        console.log('[ResultDisplayTab][sessioncheck]', {
          response: res.data,
          userID,
          directSession: res.data?.session,
          nestedSession: res.data?.data?.session,
        })

        if (!cancelled) {
          setSessionUserID(String(userID ?? ''))
        }
      } catch (error) {
        console.error('[ResultDisplayTab][sessioncheck] failed', error)
      }
    }

    async function fetchSessionUser() {
      setLoadingSessionUser(true)

      try {
        const res = await axios.get<{ user: SessionUser | null }>('/api/GetSessionUser', {
          withCredentials: true,
        })
        const nextSessionUser = res.data?.user ?? null

        console.log('[ResultDisplayTab][GetSessionUser]', {
          response: res.data,
          id_admin: nextSessionUser?.id_admin,
        })

        if (!cancelled) {
          setIsAdminUser(Boolean(nextSessionUser && nextSessionUser.id_admin !== 0))
        }
      } catch (error) {
        console.error('[ResultDisplayTab][GetSessionUser] failed', error)
        if (!cancelled) {
          setIsAdminUser(false)
        }
      } finally {
        if (!cancelled) {
          setLoadingSessionUser(false)
        }
      }
    }

    fetchSession()
    fetchSessionUser()

    return () => {
      cancelled = true
    }
  }, [])

  const uid = useMemo(() => {
    const nextUid = buildUid(state, drawingNo, sessionUserID)

    console.log('[ResultDisplayTab][uid]', {
      drawingNo,
      sessionUserID,
      uid: nextUid,
      stateUserID: state.userID,
      stateUserId: state.userId,
      stateSession: state.session,
      stateAuth: state.auth,
    })

    return nextUid
  }, [state, drawingNo, sessionUserID])

  const infoRows: InfoRow[] = useMemo(() => {
    const configuredRows = config?.ResultDisplayOption?.infoRows
    const validConfiguredRows = Array.isArray(configuredRows) ? configuredRows.filter(isInfoRowConfig) : []
    const rowConfigs = validConfiguredRows.length > 0 ? validConfiguredRows : defaultInfoRowConfigs

    return rowConfigs.map((row) => ({
      label: row.label,
      value: joinValue(getValueByPath(state, row.path)),
      labelWidth: row.labelWidth ?? 240,
    }))
  }, [config, state])

  const ulfRows = useMemo(() => {
    const rows: { level: number; width: ReactNode; items: string }[] = []

    for (let i = 1; i <= 3; i += 1) {
      const key = String(i)
      const items = joinValue(ulf?.[key])
      if (items) {
        rows.push({ level: i, width: box[`i_floor${i}`] ?? '', items })
      }
    }

    return rows
  }, [box, ulf])

  const handleDownloadUlf = useCallback(() => {
    const dimension = 26 * 3
    const result: Record<number, any[]> = { 0: [], 1: [], 2: [] }
    const ids = Object.values(layoutInfo)
      .flat()
      .map((item: any) => `"${item?.u ?? ''}"`)

    while (ids.length < dimension) ids.push('""')

    const nrow = Number(layout.nrow ?? 0)
    for (let i = 0; i < nrow; i += 1) {
      result[i] = Array.isArray(ulf?.[i + 1]) ? ulf[i + 1] : []
    }

    const resultText = [
      '"ULF01     ","DUMMY"',
      `"UNIT_HABA ","${formatUlfUnitWidth(box.i_floor1)}","${formatUlfUnitWidth(box.i_floor2)}","${formatUlfUnitWidth(box.i_floor3)}"`,
      `"UNIT_A    ",${result[0] ?? []}`,
      `"UNIT_B    ",${result[1] ?? []}`,
      `"UNIT_C    ",${result[2] ?? []}`,
      `"CABINET_1 ","${box.type ?? ''}","${box.i_box_d ?? ''}"`,
      `"CABINET_2 ","${box.i_box_h ?? ''}","${box.i_box_w ?? ''}"`,
      '"CABINET_3 ",""',
      `"CABINET_4 ","${box.code ?? ''}"`,
      `"NAIKI     ","${box.i_support_height ?? ''}"`,
      '"TANTOU    ",""',
      '"COMENT    ",""',
      '"VERSION   ","K"',
    ].join('\n')

    downloadTextAsFile(resultText, `${drawingNo || 'result'}.ulf`)
  }, [box, drawingNo, layout.nrow, layoutInfo, ulf])

  const handleDownloadExtendedUlf = useCallback(async () => {
    const targetUid = uid.trim()

    if (!targetUid || targetUid === '_') {
      console.warn('[ResultDisplayTab][downloadExtendedUlf] invalid uid', { uid })
      alert('UIDを作成できません。セッション情報または図面番号を確認してください。')
      return
    }

    try {
      const zipFilename = `ULF_EXT_${targetUid}.zip`
      const res = await axios.post(
        '/api/postFixedLenConvert',
        {
          uid: targetUid,
          encoding: 'utf-8',
          pad_char: ' ',
          base: 1,
          as_zip: true,
          line_sep: '\n',
          zip_filename: zipFilename,
        },
        {
          responseType: 'blob',
        }
      )

      downloadBlobAsFile(res.data, zipFilename)
    } catch (error) {
      console.error('[ResultDisplayTab][downloadExtendedUlf] failed', error)
      alert('拡張ULFのダウンロードに失敗しました')
    }
  }, [uid])

  const handleOpenPdf = useCallback(() => {
    const targetUid = uid.trim()

    console.log('[ResultDisplayTab][openPdf]', {
      uid,
      targetUid,
      drawingNo,
      sessionUserID,
    })

    if (!targetUid || targetUid === '_') {
      alert('UIDを作成できません。セッション情報または図面番号を確認してください。')
      return
    }

    const url = `/api/getResultPDF?c=workdata&u=${encodeURIComponent(targetUid)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [drawingNo, sessionUserID, uid])

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} useFlexGap flexWrap="wrap">
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="h6">{cabinetName || 'キャビネット品名結果'}</Typography>
          <Tooltip title="箱選定">
            <IconButton size="small" onClick={() => setBoxListOpen(true)} aria-label="箱選定">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack direction="row" spacing={1} justifyContent="flex-end" useFlexGap flexWrap="wrap">
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownloadUlf}>
            ULF DOWNLOAD
          </Button>
          <Button variant="contained" color="secondary" startIcon={<DownloadIcon />} onClick={handleDownloadExtendedUlf}>
            拡張ULF
          </Button>
          <Button variant="contained" color="inherit" startIcon={<PictureAsPdfIcon />} onClick={handleOpenPdf}>
            詳細表示（PDF）
          </Button>
        </Stack>
      </Stack>

      <BoxListDialog open={boxListOpen} onClose={() => setBoxListOpen(false)} />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.25fr) minmax(360px, 0.75fr)' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {loadingSessionUser ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Alert severity="info">ユーザー情報を確認しています。</Alert>
            </Paper>
          ) : isAdminUser ? (
            <BoxScene3dPanel input={input} layout={layout} />
          ) : (
            <BoxScene2dPanel input={input} layout={layout} />
          )}
        </Box>

        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              要約情報
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  {infoRows.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell sx={{ width: row.labelWidth, whiteSpace: 'nowrap', fontWeight: 700 }}>
                        {row.label}
                      </TableCell>
                      <TableCell>{row.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              ユニットレイアウト
            </Typography>

            {ulfRows.length === 0 ? (
              <Alert severity="info">ユニットレイアウトデータがありません。</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 120, fontWeight: 700 }}>列</TableCell>
                      <TableCell sx={{ width: 160, fontWeight: 700 }}>幅</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>ユニット</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ulfRows.map((row) => (
                      <TableRow key={row.level}>
                        <TableCell>{row.level}</TableCell>
                        <TableCell>{row.width}</TableCell>
                        <TableCell>{row.items}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Stack>
      </Box>

    </Stack>
  )
}
