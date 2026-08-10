import { useEffect, useId, useState } from 'react'
import mermaid from 'mermaid'
import { Alert, Box, CircularProgress } from '@mui/material'

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
})

export default function GenzTopologyDiagram({ source }: { source: string }) {
  const reactId = useId()
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const render = async () => {
      try {
        await mermaid.parse(source)
        const id = `genz_topology_${reactId.replace(/[^A-Za-z0-9_]/g, '_')}_${Date.now()}`
        const result = await mermaid.render(id, source)
        if (active) {
          setSvg(result.svg)
          setError('')
        }
      } catch (renderError) {
        if (active) {
          setSvg('')
          setError(renderError instanceof Error ? renderError.message : 'Mermaidの描画に失敗しました。')
        }
      }
    }
    void render()
    return () => { active = false }
  }, [reactId, source])

  if (error) return <Alert severity="error">回路図を生成できませんでした。表形式で回路データを確認してください。<br />{error}</Alert>
  if (!svg) return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><CircularProgress size={28} /></Box>
  return <Box sx={{ overflow: 'auto', '& svg': { display: 'block', mx: 'auto', maxWidth: '100%' } }} dangerouslySetInnerHTML={{ __html: svg }} />
}
