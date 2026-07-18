import { useCallback, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import ViewInArIcon from '@mui/icons-material/ViewInAr'
import {
  buildBoxScene3dRequest,
  postBoxScene3d,
  type BoxScene3dResponse,
  type Scene3dObject,
} from '../../api/boxScene3d'
import type { AppState } from '../../stores/useAppStore'

type BoxScene2dPanelProps = {
  input: AppState['input']
  layout: AppState['layout']
}

type MaterialPreset = {
  label: string
  color: string
  opacity: number
}

type RenderableRect = {
  id: string
  type: string
  label: string
  x: number
  y: number
  w: number
  h: number
  color: string
  opacity: number
  stroke: string
  strokeWidth: number
}

const MATERIAL_PRESETS: Record<string, MaterialPreset> = {
  box: { label: '箱外形', color: '#64748b', opacity: 0.08 },
  floor: { label: '列領域', color: '#f59e0b', opacity: 0.12 },
  gutter: { label: 'ガター', color: '#f97316', opacity: 0.16 },
  unit: { label: 'ユニット', color: '#2563eb', opacity: 0.32 },
  block: { label: 'ブロック', color: '#16a34a', opacity: 0.42 },
  device: { label: '機器', color: '#dc2626', opacity: 0.78 },
}

const LEGEND_TYPES = ['box', 'unit', 'block', 'device'] as const
const TYPE_ORDER: Record<string, number> = {
  box: 0,
  floor: 1,
  gutter: 2,
  unit: 3,
  block: 4,
  device: 5,
}

function isFinitePositive(value: unknown) {
  return Number.isFinite(Number(value)) && Number(value) > 0
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail?: unknown }).detail ?? '')
        : ''

    return `2D表示APIの呼び出しに失敗しました${status ? ` (${status})` : ''}${detail ? `: ${detail}` : ''}`
  }

  if (error instanceof Error) return error.message
  return '2D表示の生成に失敗しました。'
}

function countObjects(scene3d: BoxScene3dResponse | null) {
  const counts = new Map<string, number>()

  ;(scene3d?.objects ?? []).forEach((object) => {
    counts.set(object.type, (counts.get(object.type) ?? 0) + 1)
  })

  return counts
}

function toRenderableRect(object: Scene3dObject): RenderableRect | null {
  if (object.shape !== 'box') return null
  if (!isFinitePositive(object.size?.w) || !isFinitePositive(object.size?.h)) return null

  const preset = MATERIAL_PRESETS[object.type] ?? MATERIAL_PRESETS.unit
  const rawOpacity = object.material?.opacity
  const opacity =
    rawOpacity == null || !Number.isFinite(Number(rawOpacity))
      ? preset.opacity
      : Math.min(1, Math.max(0.03, Number(rawOpacity)))
  const x = Number(object.center.x) - Number(object.size.w) / 2
  const y = Number(object.center.y) - Number(object.size.h) / 2

  return {
    id: object.id,
    type: object.type,
    label: object.label ?? object.id,
    x,
    y,
    w: Number(object.size.w),
    h: Number(object.size.h),
    color: object.material?.color ?? preset.color,
    opacity,
    stroke: object.type === 'box' ? '#334155' : '#1e293b',
    strokeWidth: object.type === 'box' ? 3 : 1,
  }
}

function buildViewBox(rects: RenderableRect[]) {
  if (rects.length === 0) return '0 0 100 100'

  const minX = Math.min(...rects.map((rect) => rect.x))
  const minY = Math.min(...rects.map((rect) => rect.y))
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w))
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h))
  const width = Math.max(100, maxX - minX)
  const height = Math.max(100, maxY - minY)
  const padding = Math.max(20, Math.max(width, height) * 0.04)

  return `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`
}

function BoxScene2dSvg({ scene3d }: { scene3d: BoxScene3dResponse }) {
  const rects = useMemo(
    () =>
      scene3d.objects
        .map((object) => toRenderableRect(object))
        .filter((rect): rect is RenderableRect => rect !== null)
        .sort((a, b) => (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99)),
    [scene3d.objects],
  )
  const viewBox = useMemo(() => buildViewBox(rects), [rects])

  if (rects.length === 0) {
    return (
      <Box
        sx={{
          minHeight: 360,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
        }}
      >
        <Typography color="text.secondary">2D表示できる矩形データがありません。</Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: { xs: 420, md: 560 },
        minHeight: 360,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: '#f8fafc',
      }}
    >
      <svg width="100%" height="100%" viewBox={viewBox} role="img" aria-label="キャビネット正面2D表示">
        <rect x="-100000" y="-100000" width="200000" height="200000" fill="#f8fafc" />
        {rects.map((rect) => {
          const showLabel = rect.type !== 'box' && rect.w >= 40 && rect.h >= 18

          return (
            <g key={rect.id}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                fill={rect.color}
                fillOpacity={rect.opacity}
                stroke={rect.stroke}
                strokeOpacity={rect.type === 'box' ? 0.72 : 0.35}
                strokeWidth={rect.strokeWidth}
                vectorEffect="non-scaling-stroke"
              />
              {showLabel && (
                <text
                  x={rect.x + rect.w / 2}
                  y={rect.y + rect.h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(18, Math.max(9, rect.h * 0.18))}
                  fill="#0f172a"
                  pointerEvents="none"
                >
                  {rect.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </Box>
  )
}

export default function BoxScene2dPanel({ input, layout }: BoxScene2dPanelProps) {
  const [scene3d, setScene3d] = useState<BoxScene3dResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const requestState = useMemo(() => {
    try {
      const request = buildBoxScene3dRequest({ input, layout })
      return { request, error: '' }
    } catch (error) {
      return {
        request: null,
        error: error instanceof Error ? error.message.replaceAll('3D表示', '2D表示') : '2D表示リクエストを作成できません。',
      }
    }
  }, [input, layout])

  const objectCounts = useMemo(() => countObjects(scene3d), [scene3d])

  const handleLoad = useCallback(async () => {
    if (!requestState.request) {
      setErrorMessage(requestState.error)
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      const data = await postBoxScene3d(requestState.request)

      if (!data?.ok || data.format !== 'pback.scene3d.v1') {
        throw new Error(`2D表示APIのレスポンス形式が不正です: ${data?.format ?? 'unknown'}`)
      }

      setScene3d(data)
    } catch (error) {
      const message = getErrorMessage(error)
      console.error('[BoxScene2dPanel] postBoxScene3d failed', message)
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [requestState])

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ textAlign: 'left' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              2D表示
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
              {LEGEND_TYPES.map((type) => (
                <Chip
                  key={type}
                  size="small"
                  variant="outlined"
                  label={`${MATERIAL_PRESETS[type].label}${objectCounts.has(type) ? ` ${objectCounts.get(type)}` : ''}`}
                  sx={{
                    borderColor: MATERIAL_PRESETS[type].color,
                    color: MATERIAL_PRESETS[type].color,
                    bgcolor: `${MATERIAL_PRESETS[type].color}14`,
                    fontWeight: 700,
                  }}
                />
              ))}
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} justifyContent="flex-end" useFlexGap flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ViewInArIcon />}
              onClick={handleLoad}
              disabled={loading || !requestState.request}
            >
              2D表示を生成
            </Button>
            <Tooltip title="2Dシーンを再取得">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleLoad}
                  disabled={loading || !requestState.request}
                >
                  更新
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {!requestState.request && <Alert severity="info">{requestState.error}</Alert>}
        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        {scene3d?.warnings && scene3d.warnings.length > 0 && (
          <Alert severity="warning">{scene3d.warnings.join(' / ')}</Alert>
        )}

        {scene3d ? (
          <BoxScene2dSvg scene3d={scene3d} />
        ) : (
          <Box
            sx={{
              minHeight: 360,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 2,
            }}
          >
            <Typography color="text.secondary">
              生成ボタンを押すと、箱・ユニット・ブロック・機器を正面から2D表示します。
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  )
}
