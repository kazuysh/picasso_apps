type UnitSizeSource = Record<string, unknown>

export type UnitSizeCompatibility = {
  valid: boolean
  commonWidths: string[]
  commonDepths: string[]
  missingWidthUnit?: string
  missingDepthUnit?: string
}

function unitLabel(unit: UnitSizeSource) {
  return String(unit.unit_no ?? unit.unitNo ?? unit.unit_key ?? unit.id ?? '不明なユニット')
}

export function normalizeSizeCandidates(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const normalized = value
    .map((candidate) => Number(candidate))
    .filter((candidate) => Number.isFinite(candidate) && candidate > 0)
    .map(String)

  return [...new Set(normalized)]
}

function intersectCandidates(current: string[] | null, next: string[]) {
  if (current === null) return next
  const nextSet = new Set(next)
  return current.filter((candidate) => nextSet.has(candidate))
}

export function getUnitWidthCandidates(unit: UnitSizeSource) {
  return normalizeSizeCandidates(unit.list_w ?? unit.list_W)
}

export function getUnitDepthCandidates(unit: UnitSizeSource) {
  return normalizeSizeCandidates(unit.list_d)
}

export function analyzeUnitSizeCompatibility(
  units: UnitSizeSource[],
): UnitSizeCompatibility {
  let commonWidths: string[] | null = null
  let commonDepths: string[] | null = null
  let missingWidthUnit: string | undefined
  let missingDepthUnit: string | undefined

  units.forEach((unit) => {
    const widths = getUnitWidthCandidates(unit)
    const depths = getUnitDepthCandidates(unit)

    if (widths.length === 0 && !missingWidthUnit) missingWidthUnit = unitLabel(unit)
    if (depths.length === 0 && !missingDepthUnit) missingDepthUnit = unitLabel(unit)

    commonWidths = intersectCandidates(commonWidths, widths)
    commonDepths = intersectCandidates(commonDepths, depths)
  })

  const resolvedWidths: string[] = commonWidths ?? []
  const resolvedDepths: string[] = commonDepths ?? []

  return {
    valid:
      units.length > 0 &&
      !missingWidthUnit &&
      !missingDepthUnit &&
      resolvedWidths.length > 0 &&
      resolvedDepths.length > 0,
    commonWidths: resolvedWidths,
    commonDepths: resolvedDepths,
    missingWidthUnit,
    missingDepthUnit,
  }
}

export function getUnitSizeCompatibilityError(result: UnitSizeCompatibility) {
  if (result.missingWidthUnit) {
    return `${result.missingWidthUnit} に有効な横幅候補（list_w）がないため追加できません。`
  }
  if (result.missingDepthUnit) {
    return `${result.missingDepthUnit} に有効な奥行き候補（list_d）がないため追加できません。`
  }
  if (result.commonWidths.length === 0 && result.commonDepths.length === 0) {
    return '選定済みユニットとの共通横幅・共通奥行きがないため追加できません。'
  }
  if (result.commonWidths.length === 0) {
    return '選定済みユニットとの共通横幅がないため追加できません。'
  }
  return '選定済みユニットとの共通奥行きがないため追加できません。'
}

export function getCommonColumnDepths(value: unknown): string[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const groups = Object.values(value as Record<string, unknown>)
    .map(normalizeSizeCandidates)
    .filter((group) => group.length > 0)

  if (groups.length === 0) return []
  return groups.reduce<string[]>((common, group) => {
    const groupSet = new Set(group)
    return common.filter((candidate) => groupSet.has(candidate))
  }, groups[0])
}
