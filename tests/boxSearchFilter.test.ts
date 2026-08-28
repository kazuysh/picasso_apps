import assert from 'node:assert/strict'
import test from 'node:test'

import { buildBoxSearchFilter } from '../src/utils/boxSearchFilter.ts'

test('未選択の空文字を検索条件に含めない', () => {
  const filter = buildBoxSearchFilter(
    {
      format: '',
      format2: '',
      material: '',
      structure: '',
      outer_color: '',
      boxwidth: '',
      boxheight: '',
      boxdepth: '',
      support_height: '',
    },
    { boxH: 1400 },
  )

  assert.deepEqual(filter, { i_box_h: { $gte: 1400 } })
})

test('筐体情報と配置情報をAPI用の検索条件へ変換する', () => {
  const filter = buildBoxSearchFilter(
    {
      floor1: '500',
      material: '鉄',
      format: '屋内',
      outer_color: '5Y7/1',
      format2: '分電盤',
      structure: '自立形',
      boxwidth: '1200',
      boxdepth: 400,
      support_height: 1300,
    },
    {
      floor: { 1: ['450'], 2: [500], 3: [] },
      nrow: 2,
      boxH: '1400',
    },
  )

  assert.deepEqual(filter, {
    i_floor1: { $in: [500] },
    i_floor2: { $in: [500] },
    i_NRow: 2,
    body_material: '鉄',
    box_location: '屋内',
    out_color: '5Y7/1',
    box_purpose: '分電盤',
    structure: '自立形',
    i_box_w: 1200,
    i_box_d: 400,
    list_support_height: '1300',
    i_box_h: { $gte: 1400 },
  })
})

test('筐体高さの指定値は配置から算出した最低高さより優先する', () => {
  assert.deepEqual(
    buildBoxSearchFilter({ boxheight: '1600' }, { boxH: 1400 }),
    { i_box_h: 1600 },
  )
})

test('列間で共通するユニット奥行きを箱の内器高さ候補へ連携する', () => {
  assert.deepEqual(
    buildBoxSearchFilter(
      {},
      {
        boxH: 1400,
        column_depths: {
          1: ['99', '120'],
          2: ['99', '150'],
          3: [],
        },
      },
    ),
    {
      list_support_height: { $in: ['99'] },
      i_box_h: { $gte: 1400 },
    },
  )
})

test('指定内器高さとユニット共通奥行きの両方を満たす値だけを検索する', () => {
  assert.deepEqual(
    buildBoxSearchFilter(
      { support_height: 120 },
      { column_depths: { 1: ['99', '120'], 2: ['120', '150'] } },
    ),
    { list_support_height: { $in: ['120'] } },
  )

  assert.deepEqual(
    buildBoxSearchFilter(
      { support_height: 200 },
      { column_depths: { 1: ['99', '120'], 2: ['120', '150'] } },
    ),
    { list_support_height: { $in: [] } },
  )
})
