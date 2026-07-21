import assert from 'node:assert/strict'
import test from 'node:test'
import { buildUnitFlowDevice, buildUnitFlowDevices } from '../src/api/unitFlow.ts'

const deviceDefaults = {
  id: 1,
  unitNo: 'U1',
  node: 'MA',
}

test('numeric path_no remains a number', () => {
  assert.equal(buildUnitFlowDevice({ ...deviceDefaults, path_no: 2 })?.path_no, 2)
})

test('numeric-string path_no remains a string', () => {
  assert.equal(buildUnitFlowDevice({ ...deviceDefaults, path_no: '2' })?.path_no, '2')
})

test('alphanumeric path_no remains unchanged', () => {
  assert.equal(buildUnitFlowDevice({ ...deviceDefaults, path_no: '2_E014' })?.path_no, '2_E014')
})

test('nullish path_no uses the fallback value 0', () => {
  assert.equal(buildUnitFlowDevice({ ...deviceDefaults, path_no: null })?.path_no, 0)
  assert.equal(buildUnitFlowDevice({ ...deviceDefaults })?.path_no, 0)
})

test('empty path_no remains empty instead of being coerced to 0', () => {
  assert.equal(buildUnitFlowDevice({ ...deviceDefaults, path_no: '' })?.path_no, '')
})

test('serialized API payload never converts supported path numbers to null', () => {
  const devices = buildUnitFlowDevices([
    { ...deviceDefaults, id: 1, path_no: 2 },
    { ...deviceDefaults, id: 2, path_no: '2' },
    { ...deviceDefaults, id: 3, path_no: '2_E014' },
    { ...deviceDefaults, id: 4, path_no: null },
    { ...deviceDefaults, id: 5 },
  ])
  const serialized = JSON.stringify({ devices, threshold: 0.5, enforce_dag: true })
  const payload = JSON.parse(serialized) as { devices: Array<{ path_no: number | string | null }> }

  assert.deepEqual(payload.devices.map(({ path_no }) => path_no), [2, '2', '2_E014', 0, 0])
  assert.equal(payload.devices.some(({ path_no }) => path_no === null), false)
})
