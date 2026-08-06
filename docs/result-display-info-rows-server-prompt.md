# ResultDisplayTab 要約情報設定のサーバー実装プロンプト

以下の要件で、`GET /api/getConfig` が返す設定 JSON に `ResultDisplayOption.infoRows` を追加してください。

## 要件

- `ResultDisplayOption.infoRows` は配列とし、配列順を画面の表示順として扱う。
- 各要素は次の3フィールドを持つ。
  - `label`: 要約情報テーブルに表示する日本語ラベル（空でない文字列）
  - `path`: クライアントの Zustand `useAppStore` を起点とした値の参照パス（ドット区切りの空でない文字列）
  - `labelWidth`: 左側のラベル列幅。数値の場合は px として扱い、`"15rem"` や `"30%"` などの CSS 文字列も指定できる。省略時は `240` とする。テーブルの同じ列には共通の幅が適用されるため、通常は全要素に同じ値を設定する。
- 既存の `/api/getConfig` のレスポンス項目は変更・削除せず、次の定義をマージして返す。
- JSON として正しい形式を維持する（コメント、末尾カンマは含めない）。

## 追加する JSON 定義

```json
{
  "ResultDisplayOption": {
    "infoRows": [
      {
        "label": "キャビネット品名",
        "path": "layout.box.code",
        "labelWidth": 240
      },
      {
        "label": "内器高さ",
        "path": "input.cabinfo.support_height",
        "labelWidth": 240
      },
      {
        "label": "移動板",
        "path": "layout.box.move_board",
        "labelWidth": 240
      },
      {
        "label": "入出線位置（入線）",
        "path": "input.cabinfo.input_wire",
        "labelWidth": 240
      },
      {
        "label": "入出線位置（出線）",
        "path": "input.cabinfo.output_wire",
        "labelWidth": 240
      },
      {
        "label": "仕様",
        "path": "input.basic.major_specification",
        "labelWidth": 240
      },
      {
        "label": "省庁",
        "path": "input.basic.minor_specification2",
        "labelWidth": 240
      }
    ]
  }
}
```

## 受け入れ条件

1. `GET /api/getConfig` のレスポンスに上記の `ResultDisplayOption.infoRows` が含まれる。
2. 既存の設定項目が従来どおり返される。
3. 配列の並べ替え、要素の追加・削除、`label` の変更が、フロントエンドの変更なしで要約情報テーブルに反映される。
4. API のレスポンス Content-Type は `application/json` である。
