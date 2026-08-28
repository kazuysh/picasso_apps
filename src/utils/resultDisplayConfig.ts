type AnyRecord = Record<string, unknown>

export const DEFAULT_PROJECT_STATUS_OPTIONS = ['設計中', '確認中', '承認待ち', '完了']

function isRecord(value: unknown): value is AnyRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeStringOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item, index, list) => item !== '' && list.indexOf(item) === index)
}

export function getProjectStatusOptions(config: unknown): string[] {
  if (!isRecord(config)) return DEFAULT_PROJECT_STATUS_OPTIONS

  const resultDisplayOption = config.ResultDisplayOption
  if (!isRecord(resultDisplayOption)) return DEFAULT_PROJECT_STATUS_OPTIONS

  const rows = Array.isArray(resultDisplayOption.infoRows) ? resultDisplayOption.infoRows : []
  const statusRow = rows.find(
    (row) => isRecord(row) && row.path === 'projectMeta.status',
  )
  const configuredOptions = isRecord(statusRow)
    ? normalizeStringOptions(statusRow.options)
    : []

  return configuredOptions.length > 0 ? configuredOptions : DEFAULT_PROJECT_STATUS_OPTIONS
}
