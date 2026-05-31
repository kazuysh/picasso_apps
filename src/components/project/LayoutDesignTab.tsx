import { useMemo, useState } from 'react'
import { Box, Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import LayoutEditDialog from './LayoutEditDialog'

type AnyRecord = Record<string, any>

type LayoutDesignTabProps = {
  svgText?: string
  input?: AnyRecord
  layout?: AnyRecord
  onInputChange?: (nextInput: AnyRecord) => void
  onLayoutChange?: (nextLayout: AnyRecord) => void
}

const ZOOM_STEP = 0.4
const ZOOM_MIN = 0.25
const ZOOM_MAX = 4
const ZOOM_INITIAL = 0.5

function clampZoom(value: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(value.toFixed(2))))
}

function SvgView({ svgText }: { svgText?: string }) {
  const [scale, setScale] = useState(ZOOM_INITIAL)

  const zoomPercent = useMemo(() => Math.round(scale * 100), [scale])

  const zoomIn = () => {
    setScale((prev) => clampZoom(prev + ZOOM_STEP))
  }

  const zoomOut = () => {
    setScale((prev) => clampZoom(prev - ZOOM_STEP))
  }

  const resetZoom = () => {
    setScale(1)
  }

  if (!svgText) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          minHeight: 420,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#fafafa',
        }}
      >
        <Typography color="text.secondary">SVGデータがありません</Typography>
      </Paper>
    )
  }

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="flex-end"
        sx={{ mb: 1 }}
      >
        <Button variant="outlined" size="small" onClick={zoomOut}>
          −
        </Button>
        <Button variant="outlined" size="small" onClick={zoomIn}>
          ＋
        </Button>
        <Button variant="outlined" size="small" onClick={resetZoom}>
          Reset
        </Button>
        <Typography
          variant="body2"
          sx={{
            minWidth: 64,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {zoomPercent}%
        </Typography>
      </Stack>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          minHeight: 420,
          width: '100%',
          height: 800,
          overflow: 'auto',
          bgcolor: '#fafafa',
        }}
      >
        <Box
          sx={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            display: 'inline-block',
          }}
          dangerouslySetInnerHTML={{ __html: svgText }}
        />
      </Paper>
    </Box>
  )
}

export default function LayoutDesignTab({
  svgText,
  input = {},
  layout = {},
  onInputChange,
  onLayoutChange,
}: LayoutDesignTabProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">配置ブロック</Typography>
        <Tooltip title="配置編集">
          <IconButton size="small" onClick={() => setEditDialogOpen(true)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <SvgView svgText={svgText} />

      <LayoutEditDialog
        open={editDialogOpen}
        svgText={svgText}
        input={input}
        layout={layout}
        onInputChange={onInputChange}
        onLayoutChange={onLayoutChange}
        onClose={() => setEditDialogOpen(false)}
      />
    </>
  )
}
