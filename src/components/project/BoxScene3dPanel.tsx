import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
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
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import ViewInArIcon from '@mui/icons-material/ViewInAr'
import {
  buildBoxScene3dRequest,
  postBoxScene3d,
  type BoxScene3dResponse,
  type Scene3dObject,
} from '../../api/boxScene3d'
import type { AppState } from '../../stores/useAppStore'

type BoxScene3dPanelProps = {
  input: AppState['input']
  layout: AppState['layout']
}

type MaterialPreset = {
  label: string
  color: string
  opacity: number
}

type RenderableBox = {
  object: Scene3dObject
  color: string
  opacity: number
  transparent: boolean
  wireframe: boolean
}

const MATERIAL_PRESETS: Record<string, MaterialPreset> = {
  box: { label: '箱外形', color: '#64748b', opacity: 0.1 },
  floor: { label: '列領域', color: '#f59e0b', opacity: 0.18 },
  gutter: { label: 'ガター', color: '#f97316', opacity: 0.2 },
  unit: { label: 'ユニット', color: '#2563eb', opacity: 0.38 },
  block: { label: 'ブロック', color: '#16a34a', opacity: 0.46 },
  device: { label: '機器', color: '#dc2626', opacity: 0.82 },
}

const LEGEND_TYPES = ['box', 'unit', 'block', 'device'] as const

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

    return `3D表示APIの呼び出しに失敗しました${status ? ` (${status})` : ''}${detail ? `: ${detail}` : ''}`
  }

  if (error instanceof Error) return error.message
  return '3D表示の生成に失敗しました。'
}

function countObjects(scene3d: BoxScene3dResponse | null) {
  const counts = new Map<string, number>()

  ;(scene3d?.objects ?? []).forEach((object) => {
    counts.set(object.type, (counts.get(object.type) ?? 0) + 1)
  })

  return counts
}

function sanitizeBox(object: Scene3dObject): RenderableBox | null {
  if (object.shape !== 'box') return null
  if (!isFinitePositive(object.size?.w) || !isFinitePositive(object.size?.h) || !isFinitePositive(object.size?.d)) {
    return null
  }

  const preset = MATERIAL_PRESETS[object.type] ?? MATERIAL_PRESETS.unit
  const rawOpacity = object.material?.opacity
  const opacity =
    rawOpacity == null || !Number.isFinite(Number(rawOpacity))
      ? preset.opacity
      : Math.min(1, Math.max(0.02, Number(rawOpacity)))

  return {
    object,
    color: object.material?.color ?? preset.color,
    opacity,
    transparent: object.material?.transparent ?? opacity < 1,
    wireframe: object.material?.wireframe ?? false,
  }
}

function disposeObject3d(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (mesh.geometry instanceof THREE.BufferGeometry) {
      mesh.geometry.dispose()
    }

    const material = mesh.material
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose())
    } else if (material instanceof THREE.Material) {
      material.dispose()
    }
  })
}

function fitCameraToBox(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  renderer: THREE.WebGLRenderer,
  box: THREE.Box3,
) {
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 100)

  camera.near = Math.max(0.1, maxDim / 200)
  camera.far = maxDim * 12
  camera.position.set(maxDim * 0.75, maxDim * 0.45, maxDim * 1.25)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()

  controls.target.set(0, 0, 0)
  controls.maxDistance = maxDim * 6
  controls.update()

  renderer.render(scene, camera)
}

function BoxScene3dCanvas({
  scene3d,
  resetVersion,
}: {
  scene3d: BoxScene3dResponse
  resetVersion: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [renderError, setRenderError] = useState('')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    let mounted = true
    const updateRenderError = (message: string) => {
      window.setTimeout(() => {
        if (mounted) setRenderError(message)
      }, 0)
    }

    updateRenderError('')

    let animationFrame = 0
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 1, 5000)
    const world = new THREE.Group()
    const controls = new OrbitControls(camera, renderer.domElement)
    const resizeRenderer = () => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)

      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    try {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'

      scene.background = new THREE.Color('#f8fafc')
      scene.add(world)
      scene.add(new THREE.HemisphereLight('#ffffff', '#94a3b8', 1.35))

      const keyLight = new THREE.DirectionalLight('#ffffff', 1.9)
      keyLight.position.set(700, 900, 1200)
      scene.add(keyLight)

      const fillLight = new THREE.DirectionalLight('#dbeafe', 0.75)
      fillLight.position.set(-500, 450, -650)
      scene.add(fillLight)

      const renderableBoxes = scene3d.objects
        .map((object) => sanitizeBox(object))
        .filter((object): object is RenderableBox => object !== null)

      renderableBoxes.forEach(({ object, color, opacity, transparent, wireframe }) => {
        const geometry = new THREE.BoxGeometry(object.size.w, object.size.h, object.size.d)
        const material = new THREE.MeshStandardMaterial({
          color,
          opacity,
          transparent,
          wireframe,
          roughness: 0.62,
          metalness: 0.03,
          side: THREE.DoubleSide,
          depthWrite: opacity >= 0.7,
        })
        const mesh = new THREE.Mesh(geometry, material)

        mesh.position.set(object.center.x, -object.center.y, object.center.z)
        mesh.userData = {
          id: object.id,
          type: object.type,
          label: object.label,
          meta: object.meta,
        }
        world.add(mesh)

        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({
            color: object.type === 'box' ? '#334155' : '#1e293b',
            transparent: true,
            opacity: object.type === 'box' ? 0.62 : 0.3,
          }),
        )
        edges.position.copy(mesh.position)
        world.add(edges)
      })

      const bounds = new THREE.Box3().setFromObject(world)
      if (!bounds.isEmpty()) {
        const center = bounds.getCenter(new THREE.Vector3())
        world.position.sub(center)

        const shiftedBounds = new THREE.Box3().setFromObject(world)
        const shiftedSize = shiftedBounds.getSize(new THREE.Vector3())
        const helperSize = Math.max(shiftedSize.x, shiftedSize.z, 100)
        const grid = new THREE.GridHelper(helperSize * 1.25, 12, '#94a3b8', '#cbd5e1')
        grid.position.y = shiftedBounds.min.y
        scene.add(grid)
        scene.add(new THREE.AxesHelper(Math.max(80, helperSize * 0.16)))
        fitCameraToBox(scene, camera, controls, renderer, shiftedBounds)
      }

      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.screenSpacePanning = true

      container.replaceChildren(renderer.domElement)
      resizeRenderer()

      const resizeObserver = new ResizeObserver(resizeRenderer)
      resizeObserver.observe(container)

      const animate = () => {
        controls.update()
        renderer.render(scene, camera)
        animationFrame = window.requestAnimationFrame(animate)
      }
      animate()

      return () => {
        mounted = false
        window.cancelAnimationFrame(animationFrame)
        resizeObserver.disconnect()
        controls.dispose()
        disposeObject3d(scene)
        renderer.dispose()
        renderer.domElement.remove()
      }
    } catch (error) {
      updateRenderError(getErrorMessage(error))
      renderer.dispose()
      return () => {
        mounted = false
        controls.dispose()
        disposeObject3d(scene)
      }
    }
  }, [resetVersion, scene3d])

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: { xs: 420, md: 560 },
        minHeight: 360,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: '#f8fafc',
      }}
    >
      <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />
      {renderError && (
        <Alert severity="error" sx={{ position: 'absolute', inset: 16, alignItems: 'center' }}>
          {renderError}
        </Alert>
      )}
    </Box>
  )
}

export default function BoxScene3dPanel({ input, layout }: BoxScene3dPanelProps) {
  const [scene3d, setScene3d] = useState<BoxScene3dResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [resetVersion, setResetVersion] = useState(0)

  const requestState = useMemo(() => {
    try {
      const request = buildBoxScene3dRequest({ input, layout })
      return { request, error: '' }
    } catch (error) {
      return {
        request: null,
        error: error instanceof Error ? error.message : '3D表示リクエストを作成できません。',
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
        throw new Error(`3D表示APIのレスポンス形式が不正です: ${data?.format ?? 'unknown'}`)
      }

      setScene3d(data)
      setResetVersion((prev) => prev + 1)
    } catch (error) {
      const message = getErrorMessage(error)
      console.error('[BoxScene3dPanel] postBoxScene3d failed', message)
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }, [requestState])

  const resetCamera = useCallback(() => {
    setResetVersion((prev) => prev + 1)
  }, [])

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
              3D表示
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
              3D表示を生成
            </Button>
            <Tooltip title="3Dシーンを再取得">
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
            <Tooltip title="カメラ位置を初期表示へ戻す">
              <span>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<RestartAltIcon />}
                  onClick={resetCamera}
                  disabled={!scene3d}
                >
                  リセット
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
          <BoxScene3dCanvas scene3d={scene3d} resetVersion={resetVersion} />
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
              生成ボタンを押すと、箱・ユニット・ブロック・機器を3Dで表示します。
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  )
}
