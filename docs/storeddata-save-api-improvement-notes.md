# storeddata 保管API 改善メモ

## 対象

バックエンド:

```text
/Users/kazuysh/Documents/Codex/Apps/pback/api/postWork2Stored.py
```

API:

```text
POST /api/postWork2Stored
```

## 現状

`postWork2Stored.py` は `workdata` の対象 `UID` を取得し、`storeddata` に保存したあと、`workdata` から削除する。

現在のコードにはトランザクション用に以下の処理がある。

```py
with client.start_session() as session:
```

ただし `client` 変数が定義されていないため、このブロックは `NameError` になり、毎回 `except Exception` 側のフォールバック処理で実行される。

## 影響

API自体はフォールバック処理により動作する。

ただし、`storeddata` への保存と `workdata` からの削除がトランザクションとして一体保証されない。

想定される中途半端な状態:

```text
storeddata には保存された
workdata の削除に失敗した
```

この場合、同じ案件が `workdata` と `storeddata` の両方に残る。

## 改善案

未定義の `client` ではなく、`MongoDB` ラッパーが保持しているクライアントを使う。

```py
with db.client.start_session() as session:
```

ただし、MongoDB がレプリカセット構成でない場合、`with_transaction()` が利用できない可能性がある。

そのため、方針としては以下がよい。

```text
1. トランザクションが使える場合は使う
2. 使えない場合はフォールバック処理で保存と削除を行う
3. フォールバック時はレスポンスに note を返す
4. 保存件数、削除件数を確認できるようにする
```

## 追加で検討すること

`storeddata` への保管処理は正式データ更新になるため、将来的には以下も検討する。

```text
created: 初回保管日時
updated: 最終保管日時
status: 保管時に選択した案件ステータス
```

また、保管失敗時に `workdata` を削除しないことを明確に保証する。
