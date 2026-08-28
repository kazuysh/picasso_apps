import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Card, CardContent, Chip,
  Divider, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { BaccasTopologyRow } from '../utils/baccasTopology'
import type { CircuitNode, CircuitTopologyResult } from '../utils/genzTopology'
import { buildPathMermaid } from '../utils/genzTopology'
import GenzTopologyDiagram from './GenzTopologyDiagram'

function JsonDetails({ label, value }: { label: string; value: unknown }) {
  return (
    <Box component="details" sx={{ mt: 1.5 }}>
      <Typography component="summary" variant="body2" fontWeight={700} sx={{ cursor: 'pointer' }}>{label}</Typography>
      <Box component="pre" sx={{ m: 0, mt: 1, p: 2, borderRadius: 1, bgcolor: 'grey.900', color: 'grey.100',
        fontSize: 12, lineHeight: 1.55, overflow: 'auto', maxHeight: 430 }}>{JSON.stringify(value, null, 2)}</Box>
    </Box>
  )
}

function NodeTable({ nodes }: { nodes: CircuitNode[] }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
      <Table size="small">
        <TableHead><TableRow>
          {['kind', 'block', 'unit_keys', 'subunits', 'wire', 'device_list'].map((name) =>
            <TableCell key={name} sx={{ fontWeight: 700 }}>{name}</TableCell>)}
        </TableRow></TableHead>
        <TableBody>{nodes.map((node) => (
          <TableRow key={node.id} hover>
            <TableCell><Chip size="small" label={node.kind} /></TableCell>
            <TableCell>{node.block_id || '—'}</TableCell>
            <TableCell>{node.metadata.unit_keys.join(', ') || '—'}</TableCell>
            <TableCell>{node.metadata.subunits.join(', ') || '—'}</TableCell>
            <TableCell>{node.metadata.wire || '—'}</TableCell>
            <TableCell>{node.metadata.device_id || '—'}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </TableContainer>
  )
}

export default function BaccasTopologyPanel({ result, normalized }: {
  result: CircuitTopologyResult
  normalized: BaccasTopologyRow[]
}) {
  return (
    <Card variant="outlined"><CardContent>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1} mb={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>3. 回路トポロジー</Typography>
          <Typography variant="body2" color="text.secondary">
            {result.paths.length} PATH / 正規化データ {normalized.length}件
          </Typography>
        </Box>
        <Chip color="success" label="block.listからローカル生成" />
      </Stack>
      <Divider sx={{ mb: 2 }} />
      {result.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography fontWeight={700} mb={0.5}>トポロジー警告 {result.warnings.length}件</Typography>
          {result.warnings.map((warning, index) => (
            <Box key={`${warning.code}-${warning.path_no}-${index}`}>PATH {warning.path_no}: [{warning.code}] {warning.message}</Box>
          ))}
        </Alert>
      )}
      <Stack spacing={2}>
        {result.paths.map((path, index) => {
          const mermaidSource = buildPathMermaid(path)
          return (
            <Accordion key={path.path_no} defaultExpanded={index === 0} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction={{ xs: 'column', md: 'row' }} gap={1} alignItems={{ md: 'center' }}>
                  <Typography fontWeight={800}>PATH {path.path_no}</Typography>
                  {path.phase && <Chip size="small" label={path.phase} variant="outlined" />}
                  {path.unit_keys.map((key) => <Chip size="small" key={key} label={key} />)}
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 }, bgcolor: '#fbfcfe' }}>
                  <GenzTopologyDiagram source={mermaidSource} />
                </Paper>
                <NodeTable nodes={path.nodes} />
                <JsonDetails label="構造化グラフ（nodes / edges）" value={path} />
                <JsonDetails label="Mermaidソース" value={mermaidSource} />
              </AccordionDetails>
            </Accordion>
          )
        })}
      </Stack>
      <JsonDetails label="トポロジー用正規化データ" value={normalized} />
      <JsonDetails label="全体の構造化グラフ" value={result} />
    </CardContent></Card>
  )
}
