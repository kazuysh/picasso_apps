import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material'
import { useAppStore } from '../../stores/useAppStore'

type AnyRecord = Record<string, any>

type SortOption = {
  key: string
  order: 'asc' | 'desc'
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
  result?: {
    data?: BoxSearchItem[]
    total?: number
  }
}

type Props = {
  open: boolean
  onClose: () => void
}

const defaultSortBy: SortOption[] = [
  { key: 'i_box_w', order: 'asc' },
  { key: 'i_box_h', order: 'asc' },
  { key: 'i_box_d', order: 'asc' },
]

const columns = [
  { title: 'code', key: 'code' },
  { title: '材質', key: 'body_material' },
  { title: '色', key: 'out_color' },
  { title: '設置場所', key: 'box_location' },
  { title: '設置用途', key: 'box_purpose' },
  { title: '設置用途2', key: 'box_purpose2' },
  { title: '構造', key: 'structure' },
  { title: '移動板', key: 'move_board' },
  { title: 'サイズ幅', key: 'i_box_w' },
  { title: 'サイズ高', key: 'i_box_h' },
  { title: 'サイズ奥', key: 'i_box_d' },
  { title: '内規高さ', key: 'list_support_height' },
  { title: '列数', key: 'i_NRow' },
  { title: '列1', key: 'i_floor1' },
  { title: '列2', key: 'i_floor2' },
  { title: '列3', key: 'i_floor3' },
]

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== ''
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function stripCsvQuotes(value: string) {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function quoteCsvValue(value: string) {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

function normalizeSortBy(sortBy: SortOption[]) {
  const base = [...sortBy]
  const exists = new Set(base.map((sort) => sort.key))

  defaultSortBy.forEach((sort) => {
    if (!exists.has(sort.key)) base.push(sort)
  })

  return base
}

function toNumberList(values: unknown) {
  if (!Array.isArray(values)) return []
  return values.map(Number).filter((value) => !Number.isNaN(value))
}

function buildBoxFilter(cabinfo: AnyRecord, layout: AnyRecord) {
  const floor = layout.floor ?? {}
  const nrow = layout.nrow
  const boxH = layout.boxH ?? layout.boxh ?? 0
  const filter: AnyRecord = {}

  const setFloorFilter = (key: 'i_floor1' | 'i_floor2' | 'i_floor3', values: unknown) => {
    const numberValues = toNumberList(values)
    if (numberValues.length > 0) filter[key] = { $in: numberValues }
  }

  setFloorFilter('i_floor1', floor[1] ?? floor['1'])
  setFloorFilter('i_floor2', floor[2] ?? floor['2'])
  setFloorFilter('i_floor3', floor[3] ?? floor['3'])

  if (hasValue(cabinfo.floor1)) filter.i_floor1 = { $in: [Number(cabinfo.floor1)] }
  if (hasValue(cabinfo.floor2)) filter.i_floor2 = { $in: [Number(cabinfo.floor2)] }
  if (hasValue(cabinfo.floor3)) filter.i_floor3 = { $in: [Number(cabinfo.floor3)] }

  if (hasValue(nrow)) filter.i_NRow = nrow
  if (hasValue(cabinfo.material)) filter.body_material = cabinfo.material
  if (hasValue(cabinfo.format)) filter.box_location = cabinfo.format
  if (hasValue(cabinfo.outer_color)) filter.out_color = cabinfo.outer_color
  if (hasValue(cabinfo.format2)) filter.box_purpose = cabinfo.format2
  if (hasValue(cabinfo.structure)) filter.structure = cabinfo.structure
  if (hasValue(cabinfo.boxwidth)) filter.i_box_w = Number(cabinfo.boxwidth)
  if (hasValue(cabinfo.boxdepth)) filter.i_box_d = Number(cabinfo.boxdepth)
  if (hasValue(cabinfo.support_height)) filter.list_support_height = String(cabinfo.support_height)

  if (hasValue(boxH) && Number(boxH) > 0) {
    filter.i_box_h = { $gte: Number(boxH) }
  }
  if (hasValue(cabinfo.boxheight)) filter.i_box_h = Number(cabinfo.boxheight)

  return filter
}

function normalizeLayoutUlf(rawUlf: unknown) {
  if (!rawUlf || typeof rawUlf !== 'object' || Array.isArray(rawUlf)) return null

  const state = useAppStore.getState()
  const tokenToUnitNo = new Map<string, string>()

  ;(state.input.unit.list ?? []).forEach((unit: AnyRecord) => {
    const unitNo = String(unit.unit_no ?? unit.unitNo ?? unit.name ?? '')
    if (!unitNo) return

    ;[unit.unit_key, unit.key, unit.uid, unit.id, unitNo].forEach((value) => {
      if (hasValue(value)) tokenToUnitNo.set(String(value), unitNo)
    })
  })

  ;(state.layout.layout ?? []).forEach((item: AnyRecord) => {
    const unitNo = String(item.unit_no ?? item.u ?? item.unitNo ?? '')
    if (!unitNo) return

    ;[item.unit_key, item.k, item.id, item.i, unitNo].forEach((value) => {
      if (hasValue(value)) tokenToUnitNo.set(String(value), unitNo)
    })
  })

  const normalized: Record<string, unknown[]> = {}

  Object.keys(rawUlf as AnyRecord)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((key) => {
      const value = (rawUlf as AnyRecord)[key]
      const rowItems = Array.isArray(value) ? value : value == null ? [] : [value]

      normalized[key] = rowItems.map((item) => {
        if (typeof item !== 'string') return item

        const unquoted = stripCsvQuotes(item)
        const idTail = unquoted.includes('@') ? (unquoted.split('@').pop() ?? unquoted) : unquoted
        const unitNo = tokenToUnitNo.get(unquoted) ?? tokenToUnitNo.get(idTail)

        return unitNo ? quoteCsvValue(unitNo) : item
      })
    })

  return normalized
}

export default function BoxListDialog({ open, onClose }: Props) {
  const cabinfo = useAppStore((state) => state.input.cabinfo)
  const layout = useAppStore((state) => state.layout)
  const setLayoutField = useAppStore((state) => state.setLayoutField)
  const setLayoutUlf = useAppStore((state) => state.setLayoutUlf)

  const [items, setItems] = useState<BoxSearchItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortOption[]>(defaultSortBy)
  const [loading, setLoading] = useState(false)
  const [selectingCode, setSelectingCode] = useState('')
  const [error, setError] = useState('')

  const filter = useMemo(() => buildBoxFilter(cabinfo ?? {}, layout ?? {}), [cabinfo, layout])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const payload = {
        startPage: page + 1,
        length: rowsPerPage,
        filter,
        sort: normalizeSortBy(sortBy),
        collection: 'box',
      }

      const res = await axios.post<BoxSearchResponse>('/api/postAnyCollByPage', payload)
      setItems(res.data?.result?.data ?? [])
      setTotal(res.data?.result?.total ?? 0)
    } catch (fetchError) {
      console.error('[BoxListDialog][fetchItems] failed', fetchError)
      setItems([])
      setTotal(0)
      setError('箱一覧の取得に失敗しました。')
    } finally {
      setLoading(false)
    }
  }, [filter, page, rowsPerPage, sortBy])

  useEffect(() => {
    if (!open) return
    fetchItems()
  }, [fetchItems, open])

  useEffect(() => {
    if (!open) return
    setPage(0)
  }, [filter, open])

  const handleSort = (key: string) => {
    setPage(0)
    setSortBy((prev) => {
      const current = prev.find((sort) => sort.key === key)
      if (!current) return [{ key, order: 'asc' }]
      return [{ key, order: current.order === 'asc' ? 'desc' : 'asc' }]
    })
  }

  const handleSelect = async (item: BoxSearchItem) => {
    const boxKey = item.box_key ?? item.code ?? ''
    if (!boxKey) {
      setError('選択した箱に code がありません。')
      return
    }

    setSelectingCode(String(boxKey))
    setError('')

    try {
      const state = useAppStore.getState()
      const currentLayout = state.layout.layout ?? []

      if (Array.isArray(currentLayout) && currentLayout.length > 0) {
        const gtrRes = await axios.post('/api/postLayout2Gtr', {
          l: currentLayout,
          g: state.layout.boxg,
          n: state.layout.nrow,
          boxh: item.i_box_h,
        })
        const nextUlf = normalizeLayoutUlf(gtrRes.data)

        if (nextUlf) {
          setLayoutUlf(nextUlf)
        } else {
          console.warn('[BoxListDialog][postLayout2Gtr] invalid response', gtrRes.data)
        }
      }

      setLayoutField('box', item)
      setLayoutField('boxcode', `確定${boxKey}`)
      onClose()
    } catch (selectError) {
      console.error('[BoxListDialog][handleSelect] failed', selectError)
      setError('箱の選択処理に失敗しました。')
    } finally {
      setSelectingCode('')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>箱選定</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {loading && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="body2" color="text.secondary">
            検索条件は案件・仕様設定の筐体情報データを使用しています。
          </Typography>

          <TableContainer sx={{ maxHeight: 560 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      bgcolor: '#3399b3',
                      color: 'common.white',
                      fontSize: 10,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    アクション
                  </TableCell>
                  {columns.map((column) => {
                    const activeSort = sortBy.find((sort) => sort.key === column.key)

                    return (
                      <TableCell
                        key={column.key}
                        sx={{
                          bgcolor: '#3399b3',
                          color: 'common.white',
                          fontSize: 10,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <TableSortLabel
                          active={Boolean(activeSort)}
                          direction={activeSort?.order ?? 'asc'}
                          onClick={() => handleSort(column.key)}
                          sx={{
                            color: 'common.white',
                            '&.Mui-active': { color: 'common.white' },
                            '& .MuiTableSortLabel-icon': { color: 'common.white !important' },
                          }}
                        >
                          {column.title}
                        </TableSortLabel>
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1}>
                      <Alert severity="info">検索条件に一致する箱がありません。</Alert>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => {
                    const rowKey = String(item.box_key ?? item.code ?? index)
                    const isSelecting = selectingCode === String(item.box_key ?? item.code ?? '')

                    return (
                      <TableRow key={rowKey} hover>
                        <TableCell sx={{ fontSize: 10, p: 0.5, whiteSpace: 'nowrap' }}>
                          <Button
                            variant="contained"
                            size="small"
                            disabled={Boolean(selectingCode)}
                            onClick={() => handleSelect(item)}
                          >
                            {isSelecting ? '選択中' : '選択'}
                          </Button>
                        </TableCell>
                        {columns.map((column) => (
                          <TableCell key={column.key} sx={{ fontSize: 10, p: 0.5, whiteSpace: 'nowrap' }}>
                            {formatValue(item[column.key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[1, 10, 25, 50]}
            labelRowsPerPage="表示行数"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count !== -1 ? count : `${to}以上`}`}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value))
              setPage(0)
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  )
}
