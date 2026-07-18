import axios from 'axios'

export type JsonRecord = Record<string, unknown>

export type OutputDataRow = JsonRecord & {
  board_name?: string
  unit_key?: string
  subunit?: string
  block_id?: string
  path_no?: string
  phase?: string
  breaker_type?: string
  qty?: number
}

export type OutputDataRawRow = JsonRecord & {
  board_name?: string
  path_no?: string
  unit_key?: string
  subunit?: string
  block?: string
  wire?: string
  phase?: string
}

export type PostGens2JsonResponse = {
  ok?: boolean
  message?: string
  output_data?: OutputDataRow[]
  output_data_raw?: OutputDataRawRow[]
  output_data_flat_by_board?: Record<string, JsonRecord[]>
  summary?: Record<string, string | number | boolean | null>
  [key: string]: unknown
}

export async function postGens2Json(
  gensOutput: unknown,
  wrapWithGensOutput = false,
): Promise<PostGens2JsonResponse> {
  const payload = wrapWithGensOutput ? { gens_output: gensOutput } : gensOutput
  const { data } = await axios.post<PostGens2JsonResponse>('/api/postGens2Json', payload, {
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
  })
  return data
}
