import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  Divider,
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
import DownloadIcon from '@mui/icons-material/Download'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { useAppStore } from '../../stores/useAppStore'

type AnyRecord = Record<string, any>

type InfoRow = {
  label: string
  value: ReactNode
}

function joinValue(value: any): string {
  if (Array.isArray(value)) return value.join(',')
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
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

  const input = state.input ?? {}
  const layout = state.layout ?? {}
  const basic = input.basic ?? {}
  const cabinfo = input.cabinfo ?? {}
  const box = layout.box ?? {}
  const ulf = layout.ulf ?? {}
  const layoutInfo = layout.layout ?? {}
  const drawingNo = basic.drawingNoTemp ?? ''
  const [sessionUserID, setSessionUserID] = useState('')

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

    fetchSession()

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
    return [
      { label: 'キャビネット品名', value: box.code ?? '' },
      { label: '内器高さ', value: cabinfo.support_height ?? '' },
      { label: '移動板', value: box.move_board ?? '' },
      { label: '入出線位置（入線）', value: cabinfo.input_wire ?? '' },
      { label: '入出線位置（出線）', value: cabinfo.output_wire ?? '' },
      { label: '仕様', value: basic.major_specification ?? '' },
      { label: '省庁', value: basic.minor_specification2 ?? '' },
      { label: 'ユニットレイアウト（１）', value: joinValue(ulf?.['1']) },
      { label: 'ユニットレイアウト（２）', value: joinValue(ulf?.['2']) },
      { label: 'ユニットレイアウト（３）', value: joinValue(ulf?.['3']) },
    ]
  }, [basic, box, cabinfo, ulf])

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
      <Typography variant="h6">箱選定結果表示</Typography>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
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
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          要約情報
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableBody>
              {infoRows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell sx={{ width: 240, whiteSpace: 'nowrap', fontWeight: 700 }}>{row.label}</TableCell>
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

      <Divider />

      <Box>
        <Typography variant="body2" color="text.secondary">
          箱選定SVG表示領域は、React移行時に削除しています。
        </Typography>
      </Box>
    </Stack>
  )
}
