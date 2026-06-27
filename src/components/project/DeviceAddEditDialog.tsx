import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import FlipIcon from '@mui/icons-material/Flip'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useConfigStore } from '../../stores/useConfigStore'

type UnitBlock = {
  unitId?: number | string
  blockNo?: string
  subunitNo?: string
  phase?: string
  direction?: PlacementDirection
}

type PlacementDirection = '-' | 'h' | 'v'

type TableHeader = {
  title: string
  key: string
  sortable?: boolean
  [key: string]: unknown
}

type DeviceCandidate = {
  no: string | number
  devicename: string
  selectable?: boolean
  [key: string]: unknown
}

type AddedDevice = {
  name: string
  n: number
  [key: string]: unknown
}

type EditableDevice = {
  id: string
  name: string
  sizeCode: string
  quantity: number
  raw: string
}

type DeviceAddEditDialogProps = {
  open: boolean
  unitBlock: UnitBlock
  devices: string[]
  onClose: () => void
  onUpdate: (
    nextDefaultDevices: string[],
    options: { phase: string; direction: PlacementDirection },
  ) => Promise<void> | void
}

type ColumnFilters = Record<string, string | null>

const fallbackPhaseOptions = [{ title: '1φ2W 100V', value: '1φ2W 100V' }]

const placementDirectionOptions: Array<{ title: string; value: PlacementDirection }> = [
  { title: 'デフォルト', value: '-' },
  { title: '配置（横）', value: 'h' },
  { title: '配置（縦）', value: 'v' },
]

function normalize(value: unknown) {
  return String(value ?? '').trim()
}

function toDeviceId(index: number) {
  return `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`
}

function parseQuantity(value: unknown) {
  const quantity = Number(value)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1
}

function splitNameAndSize(value: string) {
  const atIndex = value.lastIndexOf('@')

  if (atIndex < 0) {
    return {
      name: value || 'space',
      sizeCode: '11',
    }
  }

  const name = value.slice(0, atIndex)
  const sizeCode = value.slice(atIndex + 1)

  return {
    name: name || value || 'space',
    sizeCode: sizeCode || '11',
  }
}

function parseDefaultDevice(value: unknown, index: number): EditableDevice | null {
  const raw = normalize(value)
  if (!raw) return null

  const hashIndex = raw.lastIndexOf('#')
  const nameWithSize = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw
  const quantity = hashIndex >= 0 ? parseQuantity(raw.slice(hashIndex + 1)) : 1
  const { name, sizeCode } = splitNameAndSize(nameWithSize)

  return {
    id: toDeviceId(index),
    name,
    sizeCode,
    quantity,
    raw,
  }
}

function parseAddedDevice(device: AddedDevice, index: number): EditableDevice | null {
  const name = normalize(device?.name)
  if (!name) return null

  const { name: deviceName, sizeCode } = splitNameAndSize(name)

  return {
    id: toDeviceId(index),
    name: deviceName,
    sizeCode,
    quantity: parseQuantity(device?.n),
    raw: `${name}#${parseQuantity(device?.n)}`,
  }
}

function serializeDevice(device: EditableDevice) {
  const normalizedName = normalize(device.name) || 'space'
  const nameWithSize = normalizedName.includes('@')
    ? normalizedName
    : `${normalizedName}@${normalize(device.sizeCode) || '11'}`

  return `${nameWithSize}#${parseQuantity(device.quantity)}`
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '(空白)'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function normalizeFilterValue(value: unknown) {
  const normalized = formatCellValue(value)
  return normalized || '(空白)'
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail =
      error.response?.data?.detail ??
      error.response?.data?.msg ??
      error.response?.data?.message

    if (detail) return String(detail)
    if (error.response?.status) return `${fallback} HTTP ${error.response.status}`
  }

  if (error instanceof Error && error.message) return error.message

  return fallback
}

function hasActiveColumnFilters(columnFilters: ColumnFilters) {
  return Object.values(columnFilters).some(Boolean)
}

function getCandidateNo(candidate: DeviceCandidate) {
  return String(candidate.no)
}

export default function DeviceAddEditDialog({
  open,
  unitBlock,
  devices,
  onClose,
  onUpdate,
}: DeviceAddEditDialogProps) {
  const config = useConfigStore((state) => state.config)
  const unitAddOption = config?.UnitAddOption ?? {}
  const phaseOptions = Array.isArray(unitAddOption.Phase)
    ? unitAddOption.Phase
    : fallbackPhaseOptions
  const initialPhase = normalize(unitBlock.phase) || String(phaseOptions[0]?.value ?? '')
  const initialDirection = unitBlock.direction ?? '-'

  const [editableDevices, setEditableDevices] = useState<EditableDevice[]>([])
  const [deviceNames, setDeviceNames] = useState<string[]>([])
  const [selectedDeviceName, setSelectedDeviceName] = useState('')
  const [headers, setHeaders] = useState<TableHeader[]>([])
  const [rows, setRows] = useState<DeviceCandidate[]>([])
  const [selectedNos, setSelectedNos] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [selectedPhase, setSelectedPhase] = useState(initialPhase)
  const [placementDirection, setPlacementDirection] =
    useState<PlacementDirection>(initialDirection)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(-1)
  const [loadingNames, setLoadingNames] = useState(false)
  const [loadingRows, setLoadingRows] = useState(false)
  const [adding, setAdding] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [flippingId, setFlippingId] = useState('')
  const [error, setError] = useState('')

  const filteredRows = useMemo(() => {
    const keywords = search
      .split(' ')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)

    return rows.filter((row) => {
      const matchesSearch =
        keywords.length === 0 ||
        keywords.every((keyword) =>
          Object.values(row).some((value) =>
            formatCellValue(value).toLowerCase().includes(keyword),
          ),
        )

      if (!matchesSearch) return false

      return Object.entries(columnFilters).every(([key, filterValue]) => {
        if (!filterValue) return true
        return normalizeFilterValue(row[key]) === filterValue
      })
    })
  }, [columnFilters, rows, search])

  const pagedRows = useMemo(() => {
    if (rowsPerPage === -1) return filteredRows
    const start = page * rowsPerPage
    return filteredRows.slice(start, start + rowsPerPage)
  }, [filteredRows, page, rowsPerPage])

  const filterOptionsByColumn = useMemo(() => {
    const options: Record<string, string[]> = {}

    headers.forEach((header) => {
      options[header.key] = Array.from(
        new Set(rows.map((row) => normalizeFilterValue(row[header.key]))),
      ).sort((a, b) => a.localeCompare(b, 'ja'))
    })

    return options
  }, [headers, rows])

  useEffect(() => {
    if (!open) return

    setEditableDevices(
      devices
        .map((device, index) => parseDefaultDevice(device, index))
        .filter((device): device is EditableDevice => Boolean(device)),
    )
    setSelectedPhase(initialPhase)
    setPlacementDirection(initialDirection)
    setSelectedDeviceName('')
    setHeaders([])
    setRows([])
    setSelectedNos([])
    setSearch('')
    setColumnFilters({})
    setPage(0)
    setRowsPerPage(-1)
    setError('')
  }, [devices, initialDirection, initialPhase, open])

  useEffect(() => {
    const controller = new AbortController()

    async function fetchDeviceNames() {
      if (!open || !unitBlock.blockNo) return

      setLoadingNames(true)
      setError('')

      try {
        const params = new URLSearchParams({ b: unitBlock.blockNo })
        const response = await axios.get<{ devicename?: string[] }>(
          `/api/getBlockno2Dname?${params.toString()}`,
          { signal: controller.signal },
        )

        if (controller.signal.aborted) return

        setDeviceNames(Array.isArray(response.data?.devicename) ? response.data.devicename : [])
      } catch (fetchError) {
        if (controller.signal.aborted || axios.isCancel(fetchError)) return
        console.error('[DeviceAddEditDialog][fetchDeviceNames] failed', fetchError)
        setDeviceNames([])
        setError(getErrorMessage(fetchError, '機器名候補の取得に失敗しました。'))
      } finally {
        if (!controller.signal.aborted) setLoadingNames(false)
      }
    }

    fetchDeviceNames()

    return () => {
      controller.abort()
    }
  }, [open, unitBlock.blockNo])

  useEffect(() => {
    const controller = new AbortController()

    async function fetchRows() {
      if (!open || !unitBlock.blockNo || !selectedDeviceName) {
        setHeaders([])
        setRows([])
        setSelectedNos([])
        return
      }

      setLoadingRows(true)
      setError('')

      try {
        const params = new URLSearchParams({
          b: unitBlock.blockNo,
          d: selectedDeviceName,
          p: selectedPhase,
        })
        const response = await axios.get<{
          headers?: TableHeader[]
          deviceno?: DeviceCandidate[]
        }>(`/api/getBlock2dno?${params.toString()}`, { signal: controller.signal })

        if (controller.signal.aborted) return

        setHeaders(Array.isArray(response.data?.headers) ? response.data.headers : [])
        setRows(Array.isArray(response.data?.deviceno) ? response.data.deviceno : [])
        setSelectedNos([])
        setSearch('')
        setColumnFilters({})
        setPage(0)
      } catch (fetchError) {
        if (controller.signal.aborted || axios.isCancel(fetchError)) return
        console.error('[DeviceAddEditDialog][fetchRows] failed', fetchError)
        setHeaders([])
        setRows([])
        setSelectedNos([])
        setError(getErrorMessage(fetchError, '機器候補の取得に失敗しました。'))
      } finally {
        if (!controller.signal.aborted) setLoadingRows(false)
      }
    }

    fetchRows()

    return () => {
      controller.abort()
    }
  }, [open, selectedDeviceName, selectedPhase, unitBlock.blockNo])

  const persistDevices = async (
    nextDevices: EditableDevice[],
    options?: { phase?: string; direction?: PlacementDirection },
  ) => {
    setUpdating(true)
    setError('')

    try {
      await onUpdate(nextDevices.map(serializeDevice), {
        phase: options?.phase ?? selectedPhase,
        direction: options?.direction ?? placementDirection,
      })
      return true
    } catch (updateError) {
      console.error('[DeviceAddEditDialog][persistDevices] failed', updateError)
      setError(getErrorMessage(updateError, '機器データの更新に失敗しました。'))
      return false
    } finally {
      setUpdating(false)
    }
  }

  const handlePhaseChange = (value: string) => {
    setSelectedPhase(value)
    setSelectedNos([])
  }

  const handlePlacementDirectionChange = (value: PlacementDirection) => {
    setPlacementDirection(value)
  }

  const handleToggleRow = (row: DeviceCandidate) => {
    if (row.selectable === false) return

    const no = getCandidateNo(row)
    setSelectedNos((current) =>
      current.includes(no) ? current.filter((value) => value !== no) : [...current, no],
    )
  }

  const handleAddSelectedDevices = async () => {
    const selectedRows = rows.filter((row) => selectedNos.includes(getCandidateNo(row)))
    if (!unitBlock.blockNo || selectedRows.length === 0) return

    setAdding(true)
    setError('')

    try {
      const deviceNamesParam = selectedRows
        .map((row) => normalize(row.devicename))
        .filter(Boolean)
        .join(',')

      const params = new URLSearchParams({
        b: unitBlock.blockNo,
        p: selectedPhase,
        da: deviceNamesParam,
      })
      const response = await axios.get<{ devicelist?: AddedDevice[] }>(
        `/api/getDeviceSizeArray?${params.toString()}`,
      )
      const addedDevices = Array.isArray(response.data?.devicelist)
        ? response.data.devicelist
            .map((device, index) => parseAddedDevice(device, editableDevices.length + index))
            .filter((device): device is EditableDevice => Boolean(device))
        : []

      const nextDevices = [...editableDevices, ...addedDevices]
      setEditableDevices(nextDevices)
      setSelectedNos([])
    } catch (addError) {
      console.error('[DeviceAddEditDialog][handleAddSelectedDevices] failed', addError)
      setError(getErrorMessage(addError, '機器追加に失敗しました。'))
    } finally {
      setAdding(false)
    }
  }

  const handleAddSpace = async () => {
    const nextDevices = [
      ...editableDevices,
      {
        id: toDeviceId(editableDevices.length),
        name: 'space',
        sizeCode: '11',
        quantity: 1,
        raw: 'space@11#1',
      },
    ]

    setEditableDevices(nextDevices)
  }

  const handleChangeDeviceField = (
    devicesToUpdate: EditableDevice[],
    deviceId: string,
    key: 'name' | 'sizeCode' | 'quantity',
    value: string,
  ) => {
    return devicesToUpdate.map((device) =>
      device.id === deviceId
        ? {
            ...device,
            [key]: key === 'quantity' ? parseQuantity(value) : value,
          }
        : device,
    )
  }

  const handleEditDeviceField = (
    deviceId: string,
    key: 'name' | 'sizeCode' | 'quantity',
    value: string,
  ) => {
    setEditableDevices((current) =>
      handleChangeDeviceField(current, deviceId, key, value),
    )
  }

  const handleCommitDeviceField = (
    deviceId: string,
    key: 'name' | 'sizeCode' | 'quantity',
    value: string,
  ) => {
    const nextDevices = handleChangeDeviceField(editableDevices, deviceId, key, value)
    setEditableDevices(nextDevices)
  }

  const handleDeleteDevice = (deviceId: string) => {
    const nextDevices = editableDevices.filter((device) => device.id !== deviceId)
    setEditableDevices(nextDevices)
  }

  const handleFlipDevice = async (device: EditableDevice) => {
    if (!unitBlock.blockNo) return

    setFlippingId(device.id)
    setError('')

    try {
      const params = new URLSearchParams({
        block: unitBlock.blockNo,
        device: serializeDevice(device).split('#')[0],
      })
      const response = await axios.get<{ device?: string }>(
        `/api/getFlipDeviceOnBlock?${params.toString()}`,
      )
      const flippedDeviceName = normalize(response.data?.device)
      if (!flippedDeviceName) throw new Error('転置後の機器名が空です。')

      const { name, sizeCode } = splitNameAndSize(flippedDeviceName)
      const nextDevices = editableDevices.map((currentDevice) =>
        currentDevice.id === device.id
          ? {
              ...currentDevice,
              name,
              sizeCode,
              raw: `${flippedDeviceName}#${currentDevice.quantity}`,
            }
          : currentDevice,
      )

      setEditableDevices(nextDevices)
    } catch (flipError) {
      console.error('[DeviceAddEditDialog][handleFlipDevice] failed', flipError)
      setError(getErrorMessage(flipError, '機器転置に失敗しました。'))
    } finally {
      setFlippingId('')
    }
  }

  const handleUpdateAndClose = async () => {
    const updated = await persistDevices(editableDevices)
    if (updated) onClose()
  }

  const busy = loadingNames || loadingRows || adding || updating || Boolean(flippingId)
  const activeFilter = hasActiveColumnFilters(columnFilters)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h6">機器/追加編集</Typography>
          <Typography variant="body2" color="text.secondary">
            block: {unitBlock.blockNo || '未選択'}
            {' / '}
            subunit: {unitBlock.subunitNo || '未選択'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="閉じる">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ bgcolor: '#fafafa' }}>
        <Stack spacing={2}>
          {busy && <LinearProgress />}
          {error && <Alert severity="error">{error}</Alert>}
          {!unitBlock.blockNo && (
            <Alert severity="warning">ブロックを選択してから機器を編集してください。</Alert>
          )}

          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Phase</InputLabel>
                <Select
                  label="Phase"
                  value={selectedPhase}
                  onChange={(event) => handlePhaseChange(String(event.target.value))}
                  disabled={!unitBlock.blockNo || updating}
                >
                  {phaseOptions.map((option: Record<string, unknown>) => (
                    <MenuItem key={String(option.value)} value={String(option.value)}>
                      {String(option.title ?? option.value)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>配置方向</InputLabel>
                <Select
                  label="配置方向"
                  value={placementDirection}
                  onChange={(event) =>
                    handlePlacementDirectionChange(event.target.value as PlacementDirection)
                  }
                  disabled={!unitBlock.blockNo || updating}
                >
                  {placementDirectionOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ flexGrow: 1 }} />

              <Button
                variant="outlined"
                startIcon={<AddIcon fontSize="small" />}
                onClick={handleAddSpace}
                disabled={!unitBlock.blockNo || updating}
              >
                空白追加
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ bgcolor: 'background.paper' }}>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                現在の機器
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>機器コード</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 140 }}>大きさ</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 120 }}>数量</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, width: 180 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editableDevices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary' }}>
                        機器がありません。
                      </TableCell>
                    </TableRow>
                  ) : (
                    editableDevices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          <TextField
                            value={device.name}
                            size="small"
                            fullWidth
                            onChange={(event) =>
                              handleEditDeviceField(device.id, 'name', event.target.value)
                            }
                            onBlur={(event) =>
                              handleCommitDeviceField(device.id, 'name', event.target.value)
                            }
                            disabled={updating}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={device.sizeCode}
                            size="small"
                            onChange={(event) =>
                              handleEditDeviceField(device.id, 'sizeCode', event.target.value)
                            }
                            onBlur={(event) =>
                              handleCommitDeviceField(device.id, 'sizeCode', event.target.value)
                            }
                            disabled={updating}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={device.quantity}
                            type="number"
                            size="small"
                            inputProps={{ min: 1, step: 1 }}
                            onChange={(event) =>
                              handleEditDeviceField(device.id, 'quantity', event.target.value)
                            }
                            onBlur={(event) =>
                              handleCommitDeviceField(device.id, 'quantity', event.target.value)
                            }
                            disabled={updating}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={1} justifyContent="center">
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<FlipIcon fontSize="small" />}
                              onClick={() => handleFlipDevice(device)}
                              disabled={busy || !unitBlock.blockNo}
                            >
                              転置
                            </Button>
                            <Button
                              variant="contained"
                              color="error"
                              size="small"
                              startIcon={<DeleteIcon fontSize="small" />}
                              onClick={() => handleDeleteDevice(device.id)}
                              disabled={updating}
                            >
                              削除
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <FormControl size="small" sx={{ minWidth: 240 }}>
                  <InputLabel>機器名</InputLabel>
                  <Select
                    label="機器名"
                    value={selectedDeviceName}
                    onChange={(event) => setSelectedDeviceName(String(event.target.value))}
                    disabled={!unitBlock.blockNo || loadingNames}
                  >
                    {deviceNames.map((deviceName) => (
                      <MenuItem key={deviceName} value={deviceName}>
                        {deviceName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  startIcon={<AddIcon fontSize="small" />}
                  onClick={handleAddSelectedDevices}
                  disabled={!unitBlock.blockNo || selectedNos.length === 0 || adding || updating}
                >
                  機器追加
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon fontSize="small" />}
                  onClick={() => setColumnFilters({})}
                  disabled={!activeFilter}
                >
                  列フィルタ解除
                </Button>

                <TextField
                  label="Search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(0)
                  }}
                  size="small"
                  sx={{ flexGrow: 1, minWidth: 220 }}
                />
              </Stack>

              <TableContainer variant="outlined" component={Paper} sx={{ maxHeight: 420 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ bgcolor: '#eeeeee' }} />
                      {headers.map((header) => (
                        <TableCell
                          key={header.key}
                          sx={{ bgcolor: '#eeeeee', minWidth: 150, verticalAlign: 'top' }}
                        >
                          <Stack spacing={0.75}>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {header.title}
                            </Typography>
                            <Select
                              value={columnFilters[header.key] ?? ''}
                              size="small"
                              displayEmpty
                              onChange={(event) => {
                                setColumnFilters((current) => ({
                                  ...current,
                                  [header.key]: event.target.value
                                    ? String(event.target.value)
                                    : null,
                                }))
                                setPage(0)
                              }}
                              sx={{ bgcolor: 'background.paper', fontSize: 12 }}
                            >
                              <MenuItem value="">すべて</MenuItem>
                              {(filterOptionsByColumn[header.key] ?? []).map((value) => (
                                <MenuItem key={value} value={value}>
                                  {value}
                                </MenuItem>
                              ))}
                            </Select>
                          </Stack>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={headers.length + 1}
                          align="center"
                          sx={{ color: 'text.secondary', height: 48 }}
                        >
                          候補がありません。
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedRows.map((row) => {
                        const no = getCandidateNo(row)
                        const disabled = row.selectable === false
                        const selected = selectedNos.includes(no)

                        return (
                          <TableRow
                            key={no}
                            hover={!disabled}
                            selected={selected}
                            onClick={() => handleToggleRow(row)}
                            sx={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox checked={selected} disabled={disabled} />
                            </TableCell>
                            {headers.map((header) => (
                              <TableCell key={header.key} sx={{ whiteSpace: 'nowrap' }}>
                                {formatCellValue(row[header.key])}
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
                count={filteredRows.length}
                page={rowsPerPage === -1 ? 0 : page}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[
                  { label: 'All', value: -1 },
                  10,
                  20,
                  50,
                ]}
                labelRowsPerPage="Items per page:"
                labelDisplayedRows={({ from, to, count }) =>
                  rowsPerPage === -1 ? `All ${count}` : `${from}-${to} of ${count}`
                }
                onPageChange={(_, nextPage) => setPage(nextPage)}
                onRowsPerPageChange={(event) => {
                  setRowsPerPage(Number(event.target.value))
                  setPage(0)
                }}
              />
            </Stack>
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button
          variant="contained"
          onClick={handleUpdateAndClose}
          disabled={!unitBlock.blockNo || busy}
        >
          更新
        </Button>
      </DialogActions>
    </Dialog>
  )
}
