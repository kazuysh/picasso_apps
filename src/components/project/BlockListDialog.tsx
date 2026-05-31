import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

type BlockListDialogProps = {
  open: boolean
  /** Mermaid上の表示用ノードID。例: UPN10_10_1@10001 */
  circuitBlockId?: string
  /** input.device.list[].id と照合する検索キー。例: 10001 */
  deviceBlockKey?: string
  items?: any[]
  onClose: () => void
}

const headers = [
  { title: 'id', key: 'id' },
  { title: 'subunit', key: 'unit' },
  { title: 'block', key: 'block' },
  { title: '系統番号', key: 'path_no' },
  { title: '機器', key: 'default_device' },
  { title: '未配置', key: 'over_device' },
  { title: '候補', key: 'select_device' },
  { title: 'phase', key: 'phase' },
  { title: 'cap', key: 'cap' },
  { title: 'type', key: 'type' },
  { title: 'node', key: 'node' },
]

function normalize(value: unknown) {
  return String(value ?? '').trim()
}

function stripInstanceSuffix(value: unknown) {
  // 回路側ノードIDは UPN10_10_1@10001 のようにインスタンス番号付き、
  // 機器ブロック側 item.id は UPN10_10_1 のように @ なし、というケースがある。
  return normalize(value).split('@')[0]
}

function getSuffixAfterAt(value: unknown) {
  const text = normalize(value)
  if (!text.includes('@')) return ''
  return text.split('@').pop() || ''
}

function getItemKeyCandidates(item: any) {
  // 今回の正規キーは items[].id。
  // ただし過去データやAPI差異に備えて近いキーもログ確認用に残す。
  return [
    item?.id,
    item?.deviceBlockId,
    item?.device_block_id,
    item?.itemId,
    item?.item_id,
    item?.Unit_No,
    item?.unit_no,
    item?.unitNo,
    item?.unit_id,
    item?.unitId,
    item?.block_id,
    item?.blockId,
  ]
    .map(normalize)
    .filter(Boolean)
}

function sameDeviceBlockId(item: any, deviceBlockKey?: string, circuitBlockId?: string) {
  const target = normalize(deviceBlockKey)
  const fallbackFromCircuitId = getSuffixAfterAt(circuitBlockId)
  const fallbackOriginal = normalize(circuitBlockId)
  const targets = [target, fallbackFromCircuitId, fallbackOriginal]
    .map(normalize)
    .filter(Boolean)

  if (targets.length === 0) return false

  // 基本は item.id と deviceBlockKey の一致。
  // 念のため id 以外の候補も比較するが、優先すべきは item.id。
  const candidates = getItemKeyCandidates(item)

  return candidates.some((candidate) => targets.includes(candidate))
}

function renderValue(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) return ''
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {value.map((v, index) => (
          <Chip
            key={`${String(v)}-${index}`}
            label={String(v)}
            size="small"
            variant="outlined"
          />
        ))}
      </Box>
    )
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <Box
        component="pre"
        sx={{
          m: 0,
          maxWidth: 360,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Box>
    )
  }

  return String(value ?? '')
}

export default function BlockListDialog({
  open,
  circuitBlockId,
  deviceBlockKey,
  items = [],
  onClose,
}: BlockListDialogProps) {
  const filteredItems = items.filter((item) => sameDeviceBlockId(item, deviceBlockKey, circuitBlockId))
  const targetBaseId = stripInstanceSuffix(circuitBlockId)
  const fallbackFromCircuitId = getSuffixAfterAt(circuitBlockId)

  console.log('[BlockListDialog][render]', {
    open,
    circuitBlockId,
    deviceBlockKey,
    targetBaseId,
    fallbackFromCircuitId,
    itemCount: items.length,
    filteredCount: filteredItems.length,
    sampleItems: items.slice(0, 5).map((item) => ({
      id: item?.id,
      Unit_No: item?.Unit_No,
      unit_no: item?.unit_no,
      unitNo: item?.unitNo,
      unit_id: item?.unit_id,
      unitId: item?.unitId,
      block_id: item?.block_id,
      blockId: item?.blockId,
      unit: item?.unit,
      block: item?.block,
      candidates: getItemKeyCandidates(item),
    })),
  })

  if (open && filteredItems.length === 0) {
    console.warn('[BlockListDialog][filter] no matched device block rows', {
      circuitBlockId,
      deviceBlockKey,
      targetBaseId,
      fallbackFromCircuitId,
      itemCount: items.length,
      firstItemKeys: items[0] ? Object.keys(items[0]) : [],
      firstItem: items[0],
    })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h6">機器ブロック一覧</Typography>
          <Typography variant="body2" color="text.secondary">
            回路ブロックID: {circuitBlockId || '未選択'}
            {' / '}
            機器ブロックID: {deviceBlockKey || fallbackFromCircuitId || '未選択'}
            {targetBaseId && targetBaseId !== circuitBlockId ? ` / ベースID: ${targetBaseId}` : ''}
            {' / '}
            表示件数: {filteredItems.length}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="閉じる">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ bgcolor: '#fafafa' }}>
        {filteredItems.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography color="text.secondary">
              該当する機器ブロックデータがありません。
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '70vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableCell
                      key={header.key}
                      sx={{
                        fontWeight: 700,
                        bgcolor: '#eeeeee',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {header.title}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.map((item, rowIndex) => (
                  <TableRow key={`${normalize(item?.id)}-${rowIndex}`} hover>
                    {headers.map((header) => (
                      <TableCell key={header.key} sx={{ verticalAlign: 'top' }}>
                        {renderValue(item?.[header.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  )
}
