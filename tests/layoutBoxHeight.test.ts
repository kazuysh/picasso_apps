import assert from 'node:assert/strict'
import test from 'node:test'

import { getEffectiveBoxHeight } from '../src/utils/layoutBoxHeight.ts'

test('BOX設定の手入力高さを選定箱と必要高さより優先する', () => {
  assert.equal(
    getEffectiveBoxHeight({
      boxh: '2100',
      box: { i_box_h: 2000 },
      boxH: 1800,
    }),
    2100,
  )
})

test('手入力高さがない場合は選定箱の高さを使用する', () => {
  assert.equal(
    getEffectiveBoxHeight({ boxh: '', box: { i_box_h: '2000' }, boxH: 1800 }),
    2000,
  )
})

test('選定箱もない場合は整列処理の必要高さを使用する', () => {
  assert.equal(getEffectiveBoxHeight({ boxh: '', box: {}, boxH: '1800' }), 1800)
})

test('高さ情報がない場合は配置内容とfallbackから高さを求める', () => {
  const layout = {
    layout: [{ y: 150, h: 1200, gbottom: 200 }],
  }

  assert.equal(getEffectiveBoxHeight(layout, 1800), 1800)
  assert.equal(getEffectiveBoxHeight(layout, 0), 1550)
})
