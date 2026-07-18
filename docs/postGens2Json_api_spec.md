# postGens2Json API 仕様書

## 1. 概要

Gens 出力 JSON を受け取り、既存 MongoDB マスタを正として、盤/経路ごとのユニット推定結果と、従来 `convert_gens_output.py` が出力していた JSON 相当のデータを返す API。

フロントエンドの新しいインポート画面では、この API に Gens JSON を POST し、レスポンスの `output_data_raw` または `output_data_flat_by_board` を次工程のユニット/ブロック取り込みデータとして利用する。

## 2. エンドポイント

```text
POST /api/postGens2Json
```

実装ファイル:

```text
api/postGens2Json.py
```

認証:

- `require_login` 必須
- 未ログイン時は既存認証処理に従う

## 3. マスタ参照

この API は Excel マスタを参照しない。

正マスタとして MongoDB を使用する。

接続情報:

- `config.MONGO_URI`
- `config.DATABASE_NAME`

必須コレクション:

| コレクション | 用途 |
| --- | --- |
| `UnitList` | `unit_key`, `list_w`, `list_subunit_no`, `edate` を利用してユニット候補を選定する。 |
| `SubUnitList` | `subunit_no` と `block_no` の対応を作る。 |
| `BlockList` | 必須存在チェック対象。現行レスポンス生成では主に将来拡張用。 |

任意コレクション:

| コレクション候補 | 用途 |
| --- | --- |
| `RR` |
| `RemoteRelayUnit` |
| `RemoteRelayList` |

上記のいずれかが存在する場合、`rr_min`, `rr_max`, `rt_min`, `rt_max`, `unit_no` / `unit_key` を使ってリモコンリレー/リモコントランス用制御ユニットを追加する。

## 4. リクエスト

### 4.1 Content-Type

```text
application/json
```

### 4.2 リクエスト形式

以下のどちらも受け付ける。

#### 形式 A: Gens JSON をそのまま POST

```json
{
  "statusCode": 200,
  "data": {
    "meta": {},
    "boards": []
  },
  "model": "Gemini 3 Pro Preview"
}
```

#### 形式 B: `gens_output` に包んで POST

```json
{
  "gens_output": {
    "statusCode": 200,
    "data": {
      "meta": {},
      "boards": []
    },
    "model": "Gemini 3 Pro Preview"
  }
}
```

### 4.3 参照される Gens JSON 構造

API は `convert_gens_output.py` と同じく、次のどちらかから盤リストを取得する。

- `boards`
- `data.boards`

主な参照項目:

| JSON パス | 用途 |
| --- | --- |
| `layout.board_name` | 盤名。 |
| `layout.layout_no.*.dimensions.outside.width` | 盤幅。未取得時は `400`。 |
| `connection.line` | 経路一覧。キーが `path_no`。 |
| `connection.line.*.cable.phase` | 相数。 |
| `connection.line.*.cable.line` | 線数。 |
| `connection.line.*.cable.voltage` | 電圧。 |
| `connection.line.*.main.main_breaker.device_no` | 主幹ブレーカ。 |
| `connection.line.*.main.branch_breaker.device_no` | 分岐ブレーカ。 |
| `connection.line.*.main_breaker.device_no` | 代替形式の主幹ブレーカ。 |
| `connection.line.*.branch_breaker.device_no` | 代替形式の分岐ブレーカ。 |

## 5. レスポンス

### 5.1 成功レスポンス

```json
{
  "ok": true,
  "message": "変換成功",
  "output_data": [],
  "output_data_raw": [],
  "output_data_flat_by_board": {},
  "summary": {
    "flat_count": 371,
    "grouped_count": 20,
    "raw_count": 40,
    "board_count": 5,
    "master_source": "mongodb"
  }
}
```

### 5.2 `output_data`

従来の `output_data.xlsx` 相当。ブロック単位に集約されたデータ。

| フィールド | 内容 |
| --- | --- |
| `board_name` | 盤名。 |
| `unit_key` | 推定されたユニットキー。複数の場合はカンマ区切り。 |
| `subunit` | 推定されたサブユニット。複数の場合はカンマ区切り。 |
| `block_id` | 入力機器から推定した要求ブロック ID。 |
| `path_no` | 経路番号。文字列として扱う。 |
| `phase` | 相線式/電圧。例: `1φ3W 100/200V`。 |
| `breaker_type` | `main_breaker`, `branch_breaker`, `control_unit`。 |
| `qty` | 集約数量。 |
| `device_id` | 機器 ID 一覧。 |
| `connection_type` | 接続方式。 |
| `wire` | 現行は `IV`。 |
| `capacity` | 容量。 |
| `device_type` | `MCB`, `ELB` 等。 |
| `circuit_name` | 回路名称。 |
| `order` | 機器仕様文字列。 |
| `option_main` | オプション文字列。 |

### 5.3 `output_data_raw`

従来の `output_data_raw.xlsx` 相当。ユニット/サブユニット/ブロックへ展開した一覧。

| フィールド | 内容 |
| --- | --- |
| `board_name` | 盤名。 |
| `path_no` | 経路番号。 |
| `unit_key` | ユニットキー。 |
| `subunit` | サブユニット番号。 |
| `block` | ブロック番号。 |
| `wire` | 電線種別。 |
| `phase` | 相線式/電圧。 |

### 5.4 `output_data_flat_by_board`

従来の `output_data_flat_{盤名}.json` 相当。盤名をキーにした辞書。

```json
{
  "L1-1": [
    {
      "unit_key": "UPN20_70_1",
      "wire": "IV",
      "phase": "1φ3W 100/200V",
      "subunit": "UPN20",
      "block": "MA_BRKARR_020",
      "path_no": "1",
      "device_list": ""
    }
  ]
}
```

`device_list` は現行では従来スクリプト互換のため空文字。

## 6. エラー

### 6.1 400 Bad Request

リクエスト内容が不正な場合。

```json
{
  "code": 400,
  "msg": "..."
}
```

### 6.2 500 Internal Server Error

MongoDB 接続失敗、必須マスタコレクション不足、変換処理例外など。

```json
{
  "code": 500,
  "msg": "postGens2Json failed: ..."
}
```

想定例:

- MongoDB に接続できない
- `UnitList`, `SubUnitList`, `BlockList` のいずれかが存在しない
- `UnitList` の `unit_key` / `list_subunit_no` が不足している
- `SubUnitList` の `subunit_no` / `block_no` が不足している

## 7. クライアント実装メモ

### 7.1 インポート画面の基本フロー

1. ユーザーが Gens JSON ファイルを選択する。
2. クライアントで JSON として parse する。
3. `/api/postGens2Json` に POST する。
4. `summary` を表示する。
5. `output_data_raw` を表形式でプレビューする。
6. 必要に応じて `output_data_flat_by_board` を後続の保存/描画 API に渡す。

### 7.2 表示推奨項目

プレビューでは最低限、以下を表示する。

- `board_name`
- `path_no`
- `unit_key`
- `subunit`
- `block`
- `phase`
- `wire`

### 7.3 注意点

- `path_no` は `2_E014` のような文字列になり得るため、数値変換しない。
- 盤名に `/` が含まれる場合、`output_data_flat_by_board` のキーでは `_` に置換される。
- この API はファイルを保存しない。レスポンス JSON をクライアント側で利用する。
- マスタは MongoDB が正。Excel マスタへのフォールバックはしない。

