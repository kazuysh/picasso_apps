import assert from 'node:assert/strict'
import test from 'node:test'
import {
  moveLayoutUnit,
  normalizeLineUpBottomGutter,
  normalizeLayoutOrders,
  normalizeLineUpTopGutters,
} from '../src/utils/layoutLineUp.ts'

const units = [
  { i: 'a', c: 1, y: 150, h: 400 },
  { i: 'b', c: 1, y: 700, h: 400 },
  { i: 'c', c: 3, y: 250, h: 400 },
]

test('legacy layout receives stable column orders from y', () => {
  const normalized = normalizeLayoutOrders([
    units[1],
    units[2],
    units[0],
  ])

  assert.deepEqual(
    normalized.map(({ i, c, order }) => [i, c, order]),
    [
      ['a', 1, 0],
      ['b', 1, 1],
      ['c', 3, 0],
    ],
  )
})

test('a drop at the next unit position inserts after it despite SVG float noise', () => {
  const moved = moveLayoutUnit(units, 'a', 1, 699.99998, 400)

  assert.deepEqual(
    moved.map(({ i, c, order }) => [i, c, order]),
    [
      ['b', 1, 0],
      ['a', 1, 1],
      ['c', 3, 0],
    ],
  )
})

test('moving across columns reindexes both source and target columns', () => {
  const moved = moveLayoutUnit(units, 'b', 3, 900, 400)

  assert.deepEqual(
    moved.map(({ i, c, order }) => [i, c, order]),
    [
      ['a', 1, 0],
      ['c', 3, 0],
      ['b', 3, 1],
    ],
  )
})

test('missing top gutters use the API default for each column', () => {
  assert.deepEqual(normalizeLineUpTopGutters([200]), [200, 150, 150])
  assert.deepEqual(normalizeLineUpTopGutters(['', null, 0]), [150, 150, 0])
  assert.equal(normalizeLineUpBottomGutter(''), 150)
})
