import axios from 'axios'

export type JsonObject = Record<string, unknown>

export type BlockRow = JsonObject & {
  unit_key?: string
  wire?: string
  phase?: string
  subunit?: string
  block?: string
  path_no?: string
  device_list?: string
  _debug?: JsonObject
}

export type HostLine = JsonObject & {
  seq?: number
  host_symbol?: string
  host_description?: string
  quantity?: number
  role?: string
  line_kind?: string
  group_index?: number
  phase?: string
  raw?: string
}

export type PostBCSResponse = {
  ok?: boolean
  api?: string
  format?: string
  basic?: JsonObject
  cabinfo?: JsonObject
  caboption?: { rows?: JsonObject[] } & JsonObject
  block?: { list?: BlockRow[] } & JsonObject
  host_estimate?: { lines?: HostLine[] } & JsonObject
  inference?: {
    status?: string
    parsed_line_count?: number
    block_count?: number
    unmatched_count?: number
    unit_candidates?: Record<string, unknown[]>
    unmatched_lines?: JsonObject[]
  } & JsonObject
  [key: string]: unknown
}

export type BCSRequestOptions = {
  sourceFileName: string
  unitGroup: string
  useInsize: boolean
  defaultPhase: string
  defaultWire: string
  maxBlockCandidates: number
  maxUnitCandidates: number
}

function jsonPayload(text: string, options: BCSRequestOptions) {
  return {
    text,
    source_file_name: options.sourceFileName,
    unit_group: options.unitGroup,
    use_insize: options.useInsize,
    default_phase: options.defaultPhase,
    default_wire: options.defaultWire,
    max_block_candidates: options.maxBlockCandidates,
    max_unit_candidates: options.maxUnitCandidates,
  }
}

export async function postBCSText(
  mode: 'file' | 'json' | 'text',
  text: string,
  file: File | null,
  options: BCSRequestOptions,
): Promise<PostBCSResponse> {
  if (mode === 'file') {
    if (!file) throw new Error('送信するHOSTテキストファイルを選択してください。')
    const body = new FormData()
    body.append('file', file)
    body.append('source_file_name', options.sourceFileName || file.name)
    body.append('unit_group', options.unitGroup)
    body.append('use_insize', String(options.useInsize))
    body.append('default_phase', options.defaultPhase)
    body.append('default_wire', options.defaultWire)
    body.append('max_block_candidates', String(options.maxBlockCandidates))
    body.append('max_unit_candidates', String(options.maxUnitCandidates))
    const { data } = await axios.post<PostBCSResponse>('/api/postBCSTXT2BlockJSON', body, {
      withCredentials: true,
      headers: { Accept: 'application/json' },
    })
    return data
  }

  const { data } = await axios.post<PostBCSResponse>(
    '/api/postBCSTXT2BlockJSON',
    mode === 'json' ? jsonPayload(text, options) : text,
    {
      withCredentials: true,
      headers: {
        Accept: 'application/json',
        'Content-Type': mode === 'json' ? 'application/json' : 'text/plain',
      },
    },
  )
  return data
}
