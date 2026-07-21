import axios from 'axios'
import type { OutputDataRawRow } from './postGens2Json'

export type GenzTempData = {
  drawing_no: string
  source_file_name?: string
  output_data_raw: OutputDataRawRow[]
  updated_at?: string
}

type GenzTempResponse = {
  ok: boolean
  message?: string
  data: GenzTempData | null
}

export type ImportedUnitDevice = {
  ok: boolean
  message?: string
  currentID?: number
  unit?: unknown[]
  device?: unknown[]
}

export async function getGenzTemp(): Promise<GenzTempData | null> {
  const { data } = await axios.get<GenzTempResponse>('/api/getGenzTemp', {
    withCredentials: true,
  })
  if (!data.ok) throw new Error(data.message || '一時保存データの取得に失敗しました。')
  return data.data
}

export async function saveGenzTemp(value: GenzTempData): Promise<GenzTempData> {
  const { data } = await axios.post<GenzTempResponse>('/api/postGenzTemp', value, {
    withCredentials: true,
  })
  if (!data.ok || !data.data) throw new Error(data.message || '変換結果の一時保存に失敗しました。')
  return data.data
}

export async function createUnitDeviceFromRaw(
  reqKey: string,
  rows: OutputDataRawRow[],
): Promise<ImportedUnitDevice> {
  const { data } = await axios.post<ImportedUnitDevice>(
    '/api/postWorkdataUnitDevice',
    {
      reqKey,
      start_id: 10001,
      type: 'json',
      req_data: rows,
      save: false,
    },
    { withCredentials: true },
  )
  if (!data.ok) throw new Error(data.message || '案件データの生成に失敗しました。')
  return data
}
