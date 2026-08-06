# postLineUp column-order-v2 API変更仕様

作成日: 2026-07-28

関連資料:

- `docs/layout-coordinate-system-overall-design.md`
- `docs/postBoxSvg2-result2d-backward-compatible-api-spec.md`

## 1. 目的

`POST /api/postLineUp` の列判定を `x` 座標依存から、明示的な列番号と列内順序へ変更する。

新しい整列処理では次を正規入力とする。

- `c`: 列番号
- `order`: 列内順序

`x` とドラッグ終了時の `y` から、列や並び順を推測しない。

今回の変更はAPI側だけを対象とし、現行クライアントへ影響を与えない。

## 2. 対象範囲

### 変更対象

- `pback/api/postLineUp.py`
- `pback/services/UnitAligner.py`
- `pback/tests/test_post_line_up_v2.py`（新規）
- 必要に応じて整列用Pydanticモデルを分離したモジュール

### 今回変更しない

- Reactクライアント
- `postUnits2Layout`
- `postBoxSvg`
- `postBoxSvg2`
- `postBoxSvg4`
- `postLayout2Gtr`
- 保存済み `layout.layout`
- 現行 `UnitAligner.align`

## 3. API変更方針

既存の `POST /api/postLineUp` に任意項目 `coordinate_mode` を追加する。

```text
coordinate_mode 未指定
coordinate_mode = "legacy-x"
    → 現行処理

coordinate_mode = "column-order-v2"
    → 新しい列・順序ベース整列
```

既定値は `legacy-x` とする。

現行クライアントは `coordinate_mode` を送信しないため、変更後も現行処理を使用する。

## 4. 後方互換条件

`coordinate_mode` が未指定または `legacy-x` の場合は、次を変更しない。

- 現行リクエスト項目と型
- `x` を使用した列正規化
- `y` を使用した列内ソート
- `UnitList.list_w` の再取得
- `h=9999` による整列失敗通知
- `b`, `h`, `l`, `f`, `n`, `svg` のレスポンス構造
- テンプレートURLの生成方法
- `Cache-Control: no-store`

既存処理の不具合修正を同時に入れない。v2処理は別メソッドとして追加する。

## 5. v2リクエスト

### 5.1 リクエスト例

```json
{
  "coordinate_mode": "column-order-v2",
  "layout_version": 2,
  "g": [150, 150, 250],
  "gb": 150,
  "b": "/api/getTemplate?w=0,400,0,250,0,500,0&h=1400",
  "l": [
    {
      "u": "UPN10-10",
      "k": "UPN10_10_1",
      "i": "10001",
      "c": 1,
      "order": 0,
      "w": 400,
      "h": 400,
      "list_w": ["400", "500"],
      "list_d": ["99"],
      "gtop": 150,
      "gbottom": 0
    },
    {
      "u": "UPN10-10",
      "k": "UPN10_10_1",
      "i": "10006",
      "c": 1,
      "order": 1,
      "w": 400,
      "h": 400,
      "list_w": ["400", "500"],
      "list_d": ["99"],
      "gtop": 150,
      "gbottom": 0
    }
  ]
}
```

### 5.2 リクエストルート

```python
class LineUpRequest(BaseModel):
    coordinate_mode: Literal["legacy-x", "column-order-v2"] = "legacy-x"
    layout_version: Optional[Literal[2]] = None
    l: List[LineItem]
    g: List[Union[int, float]]
    gb: Union[str, int, float]
    b: str = ""
```

`layout_version` はv2モードでは `2` とする。移行期間中は省略も受け付けるが、レスポンスでは必ず `2` を返す。

### 5.3 LineItem拡張

現行モデルへ次の項目を追加する。

```python
class LineItem(BaseModel):
    u: str
    k: str
    i: str

    # v2の正規配置入力
    c: Optional[int] = None
    order: Optional[int] = None

    # legacy-xでは必須、v2では任意かつ整列判定に使用しない
    x: Optional[float] = None
    y: Optional[float] = None

    w: float
    h: float
    list_w: List[str]
    list_d: List[str]
    gtop: float
    gbottom: float
```

`legacy-x` の場合は既存同様に `x` と `y` を必須とする。モード別バリデーションで未指定を422にする。

`column-order-v2` の場合は `c` と `order` を必須とする。

### 5.4 v2で使用しない項目

- `x`: 列判定に使用しない
- `y`: 並び順判定に使用しない
- `b`: 整列計算に使用しない

`x`, `y`, `b` は移行互換のため受信可能とする。

## 6. v2入力検証

### 6.1 ルート

- `g` は3要素
- `g[*]` は0以上の有限数
- `gb` は0以上の有限数
- `l` は1件以上

### 6.2 ユニット

- `i` はリクエスト内で一意
- `c` は1、2、3のいずれか
- `order` は0以上の整数
- 同じ列の `order` は重複不可
- `w` は0より大きい有限数
- `h` は0より大きい有限数
- `gtop` は0以上の有限数
- `gbottom` は0以上の有限数
- `list_w` は1件以上
- `list_d` は1件以上
- `list_w`, `list_d` の各値は正の数値として解釈可能

列内の `order` に欠番がある場合は、昇順に並べた後で0から再採番する。

### 6.3 マスターデータ

v2整列では、リクエストに含まれる次の値を配置時点のスナップショットとして使用する。

- `w`
- `h`
- `list_w`
- `list_d`
- `gtop`
- `gbottom`

v2処理中に `UnitList` や `UnitGTR` から上書きしない。

理由:

- ユニットガター画面で編集したNorth/Southを保持するため
- 生成時と再配置時で同じ入力なら同じ結果にするため
- マスター更新により保存済み案件の配置が暗黙に変化することを防ぐため

マスターからの最新値取得は `postUnits2Layout` など、配置データを構築する前段処理の責務とする。

## 7. v2整列アルゴリズム

### 7.1 列分類

```python
columns = {1: [], 2: [], 3: []}

for item in request.l:
    columns[item.c].append(item)
```

`x` による列バケット化や近似比較は行わない。

### 7.2 列内順序

```python
items = sorted(columns[column], key=lambda item: item.order)
```

`y` による並べ替えは行わない。

### 7.3 幅と奥行き

列ごとに全ユニットの許容値の積集合を求める。

```text
common_widths = intersection(items[*].list_w)
common_depths = intersection(items[*].list_d)
```

積集合の順序は列先頭ユニットの配列順を維持する。

採用列幅は次とする。

```text
selected_width = min(common_widths)
```

共通幅または共通奥行きがない列は整列しない。

### 7.4 Y座標

列 `c` の先頭ユニット:

```text
y[0] = max(g[c - 1], gtop[0])
```

2台目以降:

```text
y[n] =
    y[n - 1]
    + h[n - 1]
    + max(gbottom[n - 1], gtop[n])
```

列必要高さ:

```text
column_height[c] =
    last.y
    + last.h
    + max(last.gbottom, gb)
```

全体必要高さ:

```text
required_height = max(column_height.values())
```

### 7.5 order再採番

レスポンスでは列ごとに必ず0開始の連番を返す。

```text
0, 1, 2, ...
```

### 7.6 cの保持

空列があっても `c` を詰めない。

例:

- 第1列: ユニットあり
- 第2列: 空
- 第3列: ユニットあり

この場合も第3列ユニットの `c` は `3` のままとする。

## 8. v2のx座標

v2では `x` を配置判定に使用しない。

`postLineUp` 実行時点では最終筐体が未選定の場合があるため、筐体内の物理Xを確定できない。

レスポンスの `x` は次の互換ルールとする。

- リクエストに `x` があれば、その値を変更せず返す
- リクエストに `x` がなければ `null`
- `x` を列番号や列幅から新規計算しない

クライアントと後続APIは、v2の `x` を配置判定へ使用してはならない。

SVG上の物理Xは、筐体選定後に `c`、筐体列幅、ユニット幅から描画APIが計算する。

## 9. 成功レスポンス

HTTPステータス:

```text
200 OK
```

レスポンス例:

```json
{
  "coordinate_mode": "column-order-v2",
  "layout_version": 2,
  "success": true,
  "l": [
    {
      "u": "UPN10-10",
      "k": "UPN10_10_1",
      "i": "10001",
      "c": 1,
      "order": 0,
      "x": null,
      "y": 150,
      "w": 400,
      "h": 400,
      "list_w": ["400", "500"],
      "list_d": ["99"],
      "gtop": 150,
      "gbottom": 0
    },
    {
      "u": "UPN10-10",
      "k": "UPN10_10_1",
      "i": "10006",
      "c": 1,
      "order": 1,
      "x": null,
      "y": 700,
      "w": 400,
      "h": 400,
      "list_w": ["400", "500"],
      "list_d": ["99"],
      "gtop": 150,
      "gbottom": 0
    }
  ],
  "h": 1250,
  "required_height": 1250,
  "column_heights": {
    "1": 1250
  },
  "f": {
    "1": ["400", "500"],
    "2": [],
    "3": []
  },
  "column_depths": {
    "1": ["99"],
    "2": [],
    "3": []
  },
  "n": 1,
  "errors": []
}
```

### 9.1 互換レスポンス項目

v2でも次の項目名を維持する。

- `l`
- `h`
- `f`
- `n`

### 9.2 v2追加項目

- `coordinate_mode`
- `layout_version`
- `success`
- `required_height`
- `column_heights`
- `column_depths`
- `errors`

### 9.3 v2で返さない項目

v2では次を返さない。

- `svg`
- `b`

整列APIでSVGやテンプレートURLを生成しない。

理由:

- 整列と描画の責務を分離するため
- 最終筐体選定前の仮X座標でSVGを生成しないため
- `postBoxSvg2`、`postBoxSvg4` との重複をなくすため

現行クライアントはlegacyモードのため影響を受けない。

## 10. エラーレスポンス

### 10.1 入力形式エラー

HTTPステータス:

```text
422 Unprocessable Entity
```

対象例:

- `c` が1〜3以外
- `order` がない
- 同一列内で `order` が重複
- `i` が重複
- `g` が3要素でない
- 負数、NaN、Infinity

### 10.2 配置条件競合

HTTPステータス:

```text
409 Conflict
```

レスポンス例:

```json
{
  "detail": {
    "code": "LAYOUT_CONFLICT",
    "message": "配置条件を満たす共通幅または共通奥行きがありません。",
    "errors": [
      {
        "code": "NO_COMMON_WIDTH",
        "column": 2,
        "unit_ids": ["10001", "10004"]
      }
    ]
  }
}
```

エラーコード:

| コード | 内容 |
| --- | --- |
| `NO_COMMON_WIDTH` | 列内ユニットの共通幅がない |
| `NO_COMMON_DEPTH` | 列内ユニットの共通奥行きがない |
| `DUPLICATE_UNIT_ID` | `i` が重複 |
| `DUPLICATE_ORDER` | 同じ列で `order` が重複 |
| `INVALID_COLUMN` | `c` が1〜3以外 |
| `INVALID_GUTTER` | ガター値が不正 |
| `INVALID_DIMENSION` | 幅、高さが不正 |

v2では `h=9999` をエラー通知として使用しない。

## 11. 実装構成

### 11.1 UnitAligner

現行メソッドは変更しない。

```python
class UnitAligner:
    def align(self, data):
        # 現行legacy処理
        ...

    def align_by_column_order(self, data):
        # v2処理
        ...
```

`align_by_column_order` は次の形式で返す。

```python
{
    "data": aligned_data,
    "required_height": required_height,
    "column_heights": column_heights,
    "column_list_ws": column_list_ws,
    "column_list_ds": column_list_ds,
    "errors": errors,
}
```

### 11.2 postLineUp

```python
if data.coordinate_mode == "column-order-v2":
    return handle_v2(data)

return handle_legacy(data)
```

legacy処理とv2処理で、入力整形・DB参照・レスポンス組み立てを共有しない。

これによりv2追加が現行クライアントへ影響することを防ぐ。

## 12. ログ

本番ログへリクエスト全体やユニットマスター全体を出力しない。

次のみ構造化ログとして記録する。

- `coordinate_mode`
- ユニット件数
- 列ごとの件数
- `required_height`
- エラーコード
- 処理時間

ユーザー名、セッション情報、機器情報は出力しない。

## 13. APIテスト

### 13.1 後方互換

1. `coordinate_mode` 未指定で現行処理が選択される。
2. `legacy-x` で現行レスポンス構造を維持する。
3. 現行の正常系fixtureでレスポンス差分がない。
4. 現行の `h=9999` 動作が変わらない。

### 13.2 v2正常系

1. 1列のみの整列。
2. 3列すべての整列。
3. 第2列が空で第3列だけ存在しても `c=3` を保持。
4. `x` が全件同じでも `c` ごとに正しく分類。
5. `y` が全件同じでも `order` どおりに整列。
6. `order` に欠番があっても0から再採番。
7. 列ごとに異なる `g` を使用。
8. `gtop > 前gbottom`。
9. `前gbottom > gtop`。
10. 最終ユニットで `gbottom > gb`。
11. `gb > 最終gbottom`。
12. 小数値を含む寸法とガター。
13. リクエストの `x` を変更せず返す。
14. `x` 未指定では `null` を返す。

### 13.3 v2異常系

1. `c=0`、`c=4`。
2. `order` 未指定。
3. 同一列で `order` 重複。
4. `i` 重複。
5. `g` が2要素または4要素。
6. 負のガター。
7. 高さ0、負の幅。
8. `list_w` が空。
9. `list_d` が空。
10. 共通幅なしで409。
11. 共通奥行きなしで409。

## 14. 完了条件

- legacyテストがすべて成功する。
- v2テストがすべて成功する。
- `coordinate_mode` 未指定時のAPIレスポンスが変更前と一致する。
- v2処理内に `x` を使った列推測が存在しない。
- v2処理内に `y` を使った順序推測が存在しない。
- v2処理はMongoDBのマスターデータを参照しない。
- v2レスポンスは `h=9999` を使用しない。
- v2レスポンスはSVGを生成しない。

## 15. クライアント対応までの状態

API変更完了後も、現行クライアントはlegacyモードを使用する。

クライアント対応時に次を行う。

1. 回路・配置生成で `order` を構築する。
2. 配置編集でドロップ位置から `target_column / target_index` を求める。
3. 両画面から `coordinate_mode: "column-order-v2"` を送る。
4. `409 Conflict` の構造化エラーを表示する。
5. 現在の第3列X微小補正を削除する。

API変更だけでは、本番クライアントの生成・配置動作は変化しない。
