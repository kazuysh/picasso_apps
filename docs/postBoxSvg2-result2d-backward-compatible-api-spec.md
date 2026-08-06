# postBoxSvg2 結果2Dデザイン対応 API先行変更仕様

作成日: 2026-07-28

## 1. 目的

配置編集画面を結果表示の2Dデザインへ移行するため、SVG生成APIを先行して拡張する。

今回の変更はAPI側だけを対象とし、現行クライアントのリクエスト、レスポンス解析、表示、ドラッグ操作へ影響を与えないことを最優先とする。

## 2. 対象範囲

### 変更対象

- `pback/api/postBoxSvg2.py`
- `pback/services/SvgCreator.py`
- 必要に応じて追加する新しい編集SVGレンダラー
- `postBoxSvg2` のAPIテスト

### 今回変更しない

- Reactクライアント
- `POST /api/postBoxSvg4`
- `POST /api/postBoxScene3d`
- `POST /api/postLineUp`
- `layout.layout` の保存形式
- 既存の最終SVG、2D表示、3D表示

## 3. 結論

`POST /api/postBoxSvg2` に任意項目 `render_mode` を追加する。

```text
render_mode 未指定        → 現行SVGを返す
render_mode = "legacy"    → 現行SVGを返す
render_mode = "result2d"  → 結果2Dデザインの編集用SVGを返す
```

現行クライアントは `render_mode` を送信しないため、変更後も現在と同じ処理経路、SVG構造、表示結果を使用する。

新しい描画を既定値にしない。既存SVG生成処理を新レンダラーで置き換えない。

## 4. 後方互換条件

`render_mode` が未指定または `legacy` の場合、次を維持する。

### 4.1 リクエスト

現在のリクエストをそのまま受け付ける。

```json
{
  "g": "150,150,150",
  "w": "0,500,20,500,20,500,20",
  "h": "1800",
  "l": []
}
```

- 必須項目を追加しない。
- 既存項目の型を変更しない。
- `l[].i` は現在と同様に文字列でも受け付ける。
- 6要素、7要素の `w` の扱いを変更しない。

### 4.2 レスポンス

- HTTPステータス: `200`
- `Content-Type`: `image/svg+xml`
- `Cache-Control`: `no-store`
- JSONラッパーを追加せず、SVG文字列を直接返す。
- SVG直下にあるユニット `g` の構造を変更しない。
- ユニット `g` のID形式 `"{unit_key}#{unit_i}"` を変更しない。
- ユニット `g` の `transform="translate(x, y)"` を変更しない。
- 現在の色、寸法、ラベル、描画順を変更しない。

互換確認では、動的な空白や属性順を除外してSVG DOMを比較する。

## 5. リクエスト拡張

### 5.1 SvgRequest

既存モデルへ次の任意項目を追加する。

```py
class SvgRequest(BaseModel):
    g: str
    w: str
    h: str
    l: List[UnitList]
    render_mode: Literal["legacy", "result2d"] = "legacy"
    devices: List[DeviceItem] = Field(default_factory=list)
    options: Result2dSvgOptions = Field(default_factory=Result2dSvgOptions)
```

`devices` と `options` は `result2d` の場合だけ使用する。`legacy` では値が送られても描画へ影響させない。

### 5.2 DeviceItem

`postBoxSvg4` と同じ入力を再利用できる形にする。

```py
class DeviceItem(BaseModel):
    Name: str
    i: Optional[int] = None
    unit_i: Optional[int] = None
    id: Optional[str] = None
    block: Optional[str] = None
    block_no: Optional[str] = None
    subunit_no: Optional[str] = None
    X: float = 0
    Y: float = 0
    W: float = 0
    H: float = 0
    slot_indices: Optional[List[int]] = None
```

### 5.3 Result2dSvgOptions

```py
class Result2dSvgOptions(BaseModel):
    include_box: bool = True
    include_columns: bool = True
    include_gutters: bool = True
    include_units: bool = True
    include_blocks: bool = True
    include_devices: bool = True
    show_labels: bool = True
    embed_metadata: bool = True
    background: str = "#f8fafc"
```

全項目に既定値を持たせる。

## 6. `result2d` レスポンス仕様

### 6.1 SVGルート

```xml
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="..."
  height="..."
  viewBox="0 0 {box_width} {box_height}"
  preserveAspectRatio="xMinYMin meet"
  data-format="pback.edit-svg.v2"
  data-coordinate-origin="top-left"
  data-coordinate-unit="mm"
>
```

要件:

- 原点は箱正面の左上。
- Xは右方向が正。
- Yは下方向が正。
- 寸法単位はmm。
- `box_width` は正規化後の7要素 `w` の合計。
- `box_height` は `h` を使用する。

### 6.2 レイヤー構成

描画順は次のとおりとする。

1. 背景
2. 箱外形
3. 列領域
4. ガター
5. ユニット
6. ブロック
7. 機器
8. ラベル・選択用外枠

箱、列、ガターはSVG直下へ描画してよいが、`id` を付けない。現行クライアントはSVG直下の `g[id]` をドラッグ候補として扱うため、非ユニット要素にIDを付けないことで誤認を防ぐ。

### 6.3 色

結果表示2Dと同じ色を使用する。

| 種別 | 色 | 標準不透明度 |
| --- | --- | --- |
| 箱 | `#64748b` | `0.08` |
| 列領域 | `#f59e0b` | `0.12` |
| ガター | `#f97316` | `0.16` |
| ユニット | `#2563eb` | `0.32` |
| ブロック | `#16a34a` | `0.42` |
| 機器 | `#dc2626` | `0.78` |

色指定はSVG要素の属性またはSVG内の `<style>` で完結させる。外部CSSへ依存させない。

### 6.4 ユニットグループ

各ユニットはSVG直下の1つの `g` とする。

```xml
<g
  id="UPN10-10_1#10001"
  class="scene-object scene-unit"
  transform="translate(150, 200)"
  data-object-type="unit"
  data-unit-i="10001"
  data-unit-no="UPN10-10"
  data-unit-key="UPN10-10_1"
  data-column="1"
  data-layout-x="150"
  data-layout-y="200"
  data-render-x="150"
  data-render-y="200"
  data-width="400"
  data-height="300"
>
  ...
</g>
```

必須条件:

- `id` は現行互換の `"{unit_key}#{unit_i}"` とする。
- `unit_i` を案件内の一意キーとして扱う。
- 同一 `unit_no` が複数存在しても、別の `g` として出力する。
- ユニット外形、所属ブロック、所属機器、ラベルを同じ親 `g` 内へ配置する。
- 子要素の座標はユニット左上を原点とする相対座標へ変換する。

親 `g` へ `transform` を設定することで、将来のクライアントは親だけを移動し、ユニット、ブロック、機器を一緒に追従表示できる。

### 6.5 ユニット描画X座標

結果2Dと同じく、列内でユニットを中央寄せする。

```text
render_x = column_left + (column_width - unit_width) / 2
```

列開始位置:

```text
column1 = G0
column2 = G0 + W0 + G1
column3 = G0 + W0 + G1 + W1 + G2
```

`data-layout-x` には入力 `l[].x` を保持し、`data-render-x` と `transform` には実描画位置を設定する。

これにより、入力上の配置座標と中央寄せ後の描画座標を混同しない。

### 6.6 ブロック

ブロックは所属ユニット `g` の子要素として出力する。

```xml
<rect
  class="scene-object scene-block"
  data-object-type="block"
  data-parent-unit-i="10001"
  data-subunit-no="..."
  data-block-no="..."
  data-row="0"
  data-col="0"
  x="..."
  y="..."
  width="..."
  height="..."
/>
```

- `x`, `y` はユニット左上からの相対座標。
- ブロックマスターが取得できない場合は、ユニット外形だけを出力する。
- マスター不足はSVG生成失敗にせず、警告メタデータへ記録する。

### 6.7 機器

`devices` が渡された場合だけ描画する。

- `i` または `unit_i` で親ユニットを特定する。
- `id`, `block`, `block_no` と任意の `subunit_no` でアンカーブロックを特定する。
- 所属ユニット `g` の子要素として出力する。
- 機器SVGが存在しない場合は、結果SVGと同様に矩形と機器名でフォールバックする。
- 親ユニットまたはアンカーが解決できない機器は描画せず、警告メタデータへ記録する。

機器要素には次を付与する。

```xml
data-object-type="device"
data-parent-unit-i="10001"
data-device-name="..."
data-block-no="..."
```

### 6.8 メタデータ

`options.embed_metadata = true` の場合、SVGへJSONメタデータを埋め込む。

```xml
<metadata id="edit-scene-metadata">
{
  "format": "pback.edit-svg.v2",
  "coordinateSystem": {
    "origin": "cabinet-front-top-left",
    "x": "right",
    "y": "down",
    "unit": "mm"
  },
  "box": {
    "widths": [0, 500, 20, 500, 20, 500, 20],
    "height": 1800
  },
  "units": [],
  "warnings": []
}
</metadata>
```

JSONは表示用ラベルから復元せず、リクエストとマスター情報から生成する。

## 7. 幅・ガターの正規化

### 7.1 `w`

- 7要素 `[G0,W0,G1,W1,G2,W2,G3]` を標準とする。
- 6要素 `[W0,G1,W1,G2,W2,G3]` は先頭へ `G0=0` を補う。
- 6要素、7要素以外はHTTP `400` とする。
- 数値化できない値、負数、NaN、InfinityはHTTP `400` とする。

### 7.2 `g`

- 3要素を列1〜3の上ガターとして扱う。
- 不足分は既定値 `150` で補う。
- `result2d` の箱高さは `h` とし、`g` を箱高さへ加算しない。

`legacy` の既存計算は変更しない。

## 8. エラー仕様

| HTTPステータス | 条件 |
| --- | --- |
| `400` | `g`, `w`, `h` の形式不正、幅要素数不正、列番号が1〜3以外 |
| `401` | 未ログイン |
| `422` | Pydanticモデル検証エラー |
| `500` | SVG生成中の予期しないエラー |

エラーレスポンス形式はFastAPI標準の `{"detail": ...}` を維持する。

`legacy` の既存エラー条件・メッセージは変更しない。厳密な追加検証は `result2d` の処理経路だけに適用する。

## 9. 実装方針

### 9.1 APIルーティング

```py
if req.render_mode == "legacy":
    return render_legacy_svg(req)

return render_result2d_edit_svg(req)
```

既存コードを `render_legacy_svg` 相当としてそのまま残す。共通化によって既存出力が変わる可能性があるため、初回対応では数値正規化や描画ロジックを無理に共有しない。

### 9.2 レンダラー

推奨:

- `SvgCreator` はlegacy専用として維持する。
- `SvgCreator2` のブロック展開、機器配置ロジックを再利用可能な純粋計算へ分離する。
- 新規 `EditableResult2dSvgCreator` が、ユニット単位の親子構造でSVGを構築する。

避けること:

- `SvgCreator2.render()` の出力をそのまま `postBoxSvg2` へ流用する。
- `postBoxSvg4` のSVG DOM構造を変更する。
- `object.id` や表示名からユニットIDを推測する。
- legacyとresult2dで同じ可変DOMを条件分岐しながら組み立てる。

## 10. APIテスト

### 10.1 legacy回帰

1. 現行リクエストを `render_mode` なしで送信する。
2. `render_mode="legacy"` で送信する。
3. 両方が同じ正規化済みSVG DOMになることを確認する。
4. 現行版で保存したゴールデンSVGと比較する。
5. ユニット直下 `g` のIDとtransformを確認する。
6. 6要素、7要素の `w` をそれぞれ確認する。

### 10.2 result2d

- ルートの `data-format` と座標系
- 結果2Dと同じ色、透明度、描画順
- 1ユニットにつきSVG直下の `g` が1つ
- `g.id = unit_key#unit_i`
- `data-unit-i` と入力 `l[].i` の一致
- 同一 `unit_no` の複数インスタンス
- ブロック、機器が正しい親ユニット内に存在
- 親 `g` のtransform変更で子要素が追従
- 6要素幅のG0補完
- 列中央寄せ座標
- マスター不足時のフォールバックと警告
- 危険な文字を含むラベルがXMLエスケープされること

### 10.3 HTTP

- ログイン必須
- `Content-Type: image/svg+xml`
- `Cache-Control: no-store`
- 不正な `render_mode` は `422`
- 不正な幅、列番号は `result2d` だけ `400`

## 11. 受け入れ条件

1. 現行クライアントを変更せず、配置編集画面の表示とドラッグ操作が変更前と同じである。
2. `render_mode` 未指定時の正規化済みSVG DOMが変更前と一致する。
3. `postBoxSvg4`、`postBoxScene3d` のレスポンスが変わらない。
4. `render_mode="result2d"` で結果2Dと同じ配色のSVGが生成される。
5. result2d SVGでユニット、ブロック、機器の親子関係をDOMとdata属性から一意に判定できる。
6. 同一 `unit_no` の複数ユニットが `unit_i` により別々に出力される。
7. ユニット親 `g` のtransformだけで、所属ブロックと機器が追従する。
8. result2d処理の追加によってlegacyのエラー条件を厳格化しない。
9. legacy回帰テストとresult2d APIテストが自動化される。

## 12. 次工程で行うクライアント変更

API先行変更が完了しても、クライアントは自動的に新SVGへ切り替えない。

次工程で次を行う。

- 配置編集時に `render_mode: "result2d"` と `devices` を送信する。
- `data-unit-i` を使ってドラッグ対象を識別する。
- `data-layout-x` と `data-render-x` を区別して座標を更新する。
- 選択表示、ズーム、パン、反映、キャンセルを実装する。

この切替はAPIのlegacy回帰確認後に、独立したクライアント変更として実施する。
