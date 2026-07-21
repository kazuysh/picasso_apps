# Genz Import 一時保存 API 仕様

## 1. 概要

`Pages/GenzImport` が `postGens2Json` の変換結果をログインユーザー単位で一時保存・再取得するための API。

- 実装先プロジェクト: `pback`
- MongoDB データベース: `hakodashi`
- コレクション: `tempgenz`
- 認証: 既存の `require_login` を必須とする
- ユーザーキーはリクエスト本文から受け取らず、サーバー側の session から取得する
- 1ユーザーにつき1レコードとし、再保存時は置き換える（upsert）

## 2. 保存 API

### `POST /api/postGenzTemp`

`postGens2Json` の `output_data_raw` と、案件作成に必要な図面番号を保存する。

リクエスト:

```json
{
  "drawing_no": "A12345",
  "source_file_name": "gens-result.json",
  "output_data_raw": [
    {
      "board_name": "L1-1",
      "path_no": "1",
      "unit_key": "UPN20_70_1",
      "subunit": "UPN20",
      "block": "MA_BRKARR_020",
      "wire": "IV",
      "phase": "1φ3W 100/200V"
    }
  ]
}
```

バリデーション:

- `drawing_no`: 必須文字列
- `output_data_raw`: 必須配列
- 配列要素はオブジェクトであること
- `path_no` は文字列のまま保存し、数値変換しない

MongoDB 保存例:

```json
{
  "user_id": "login-user",
  "drawing_no": "A12345",
  "source_file_name": "gens-result.json",
  "output_data_raw": [],
  "updated_at": "2026-07-21T10:00:00+09:00"
}
```

`user_id` に unique index を作成し、次の条件で upsert する。

```text
filter: { "user_id": session_user }
update: { "$set": request fields + updated_at }
upsert: true
```

成功レスポンス（200）:

```json
{
  "ok": true,
  "message": "一時保存しました",
  "data": {
    "drawing_no": "A12345",
    "source_file_name": "gens-result.json",
    "output_data_raw": [],
    "updated_at": "2026-07-21T10:00:00+09:00"
  }
}
```

## 3. 取得 API

### `GET /api/getGenzTemp`

session のログインユーザーに対応する一時保存データを取得する。

保存データあり（200）:

```json
{
  "ok": true,
  "data": {
    "drawing_no": "A12345",
    "source_file_name": "gens-result.json",
    "output_data_raw": [],
    "updated_at": "2026-07-21T10:00:00+09:00"
  }
}
```

保存データなし（200）:

```json
{
  "ok": true,
  "data": null
}
```

未保存は正常状態として扱い、404 にはしない。

## 4. 共通エラー

不正リクエスト（400）:

```json
{
  "ok": false,
  "message": "drawing_no is required"
}
```

未認証時は既存認証処理に従う。MongoDB 接続・保存・取得エラーは 500 とする。

```json
{
  "ok": false,
  "message": "Genz temporary data operation failed: ..."
}
```

## 5. 画面からの呼び出し順

1. 画面表示時に `GET /api/getGenzTemp` を必ず実行する。
2. ファイルロード時に `POST /api/postGens2Json` を実行する。
3. 成功レスポンスの `output_data_raw` を `POST /api/postGenzTemp` で保存する。
4. `board_name` 単位で一覧表示する。
5. 新規作成時、選択した盤の行だけを既存の `POST /api/postWorkdataUnitDevice` に渡す。
6. 図面番号を `{drawing_no}_{board_name}` に設定して `/project-detail` へ遷移する。
