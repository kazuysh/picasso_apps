import assert from 'node:assert/strict'
import test from 'node:test'

import {
  analyzeUnitSizeCompatibility,
  getCommonColumnDepths,
  getUnitSizeCompatibilityError,
} from '../src/utils/unitSizeCompatibility.ts'

test('表記揺れを吸収してユニット全体の共通幅と共通奥行きを算出する', () => {
  const result = analyzeUnitSizeCompatibility([
    { unit_no: 'U1', list_w: ['400', 500], list_d: ['99', 120] },
    { unit_no: 'U2', list_W: [500, 600], list_d: [99, '150'] },
  ])

  assert.deepEqual(result, {
    valid: true,
    commonWidths: ['500'],
    commonDepths: ['99'],
    missingWidthUnit: undefined,
    missingDepthUnit: undefined,
  })
})

test('共通幅がなくなるユニットを不適合とする', () => {
  const result = analyzeUnitSizeCompatibility([
    { unit_no: 'U1', list_w: [400], list_d: [99] },
    { unit_no: 'U2', list_w: [500], list_d: [99] },
  ])

  assert.equal(result.valid, false)
  assert.equal(result.commonWidths.length, 0)
  assert.match(getUnitSizeCompatibilityError(result), /共通横幅/)
})

test('共通奥行きがなくなるユニットを不適合とする', () => {
  const result = analyzeUnitSizeCompatibility([
    { unit_no: 'U1', list_w: [400], list_d: [99] },
    { unit_no: 'U2', list_w: [400], list_d: [120] },
  ])

  assert.equal(result.valid, false)
  assert.equal(result.commonDepths.length, 0)
  assert.match(getUnitSizeCompatibilityError(result), /共通奥行き/)
})

test('複数列の共通奥行きを箱全体で再度積集合にする', () => {
  assert.deepEqual(
    getCommonColumnDepths({
      1: ['99', '120'],
      2: [99, '150'],
      3: [],
    }),
    ['99'],
  )
})

