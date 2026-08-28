import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_PROJECT_STATUS_OPTIONS,
  getProjectStatusOptions,
} from '../src/utils/resultDisplayConfig.ts'

test('ステータス行の options を案件ステータス候補として返す', () => {
  const config = {
    ResultDisplayOption: {
      infoRows: [
        {
          label: 'ステータス',
          path: 'projectMeta.status',
          options: ['設計中', '確認中', '完了'],
        },
      ],
    },
  }

  assert.deepEqual(getProjectStatusOptions(config), ['設計中', '確認中', '完了'])
})

test('ステータス設定が不正な場合は既定候補を返す', () => {
  assert.deepEqual(getProjectStatusOptions({ ResultDisplayOption: { infoRows: [] } }), DEFAULT_PROJECT_STATUS_OPTIONS)
})
