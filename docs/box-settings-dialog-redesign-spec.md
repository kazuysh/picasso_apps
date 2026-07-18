# BOX設定ダイアログ 7要素レイアウト仕様

## 目的

`src/components/project/LayoutDesignTab.tsx` の BOX設定ダイアログを、BOXマスターの横方向分割と同じ7要素モデルで編集できる画面にする。

7要素モデル:

```text
G0, W0, G1, W1, G2, W2, G3
```

意味:

- `G0`: 左端配線ガター
- `W0`: 配置列1
- `G1`: 列1-列2間の配線ガター
- `W1`: 配置列2
- `G2`: 列2-列3間の配線ガター
- `W2`: 配置列3
- `G3`: 右端配線ガター

## 対象

- フロント: `src/components/project/LayoutDesignTab.tsx`
- 関連フロント:
  - `src/pages/GenerationRunnerPage.tsx`
  - `src/components/project/LayoutEditDialog.tsx`
  - `src/api/boxScene3d.ts`
  - `src/stores/useAppStore.ts`
- 関連API:
  - `pback/api/postBoxSvg.py`
  - `pback/api/postBoxSvg2.py`
  - `pback/api/postBoxSvg4.py`
  - `pback/api/postBoxScene3d.py`
  - `pback/api/postLineUp.py`
  - `pback/services/SvgCreator.py`

## 画面構成

ダイアログは2セクション構成にする。

### 実装高さ 入出線設定

青帯見出し: `実装高さ 入出線設定`

入力/操作:

- 実装高さ
- 入線
- 種別
- 断面積
- 規格
- `Gutter計算` ボタン
- 出線

### ガター設定

青帯見出し: `ガター設定`

7列グリッドで表示する。固定の絶対配置は使わず、入力欄が重ならないようにする。

```text
      W0              W1              W2
      Top1            Top2            Top3
G0    W0      G1      W1      G2      W2      G3
Left  Area1   Gt1     Area2   Gt2     Area3   Right
      Bottom1         Bottom2         Bottom3
```

実装上の表示ラベル:

| 表示ラベル | 意味 |
| --- | --- |
| `Left / G0` | 左端配線ガター |
| `Area1 / W0` | 配置列1 |
| `Gt1 / G1` | 列1-列2間の配線ガター |
| `Area2 / W1` | 配置列2 |
| `Gt2 / G2` | 列2-列3間の配線ガター |
| `Area3 / W2` | 配置列3 |
| `Right / G3` | 右端配線ガター |

## データ紐づけ

### 基本項目

| 表示名 | Form field | 読み込み元 | 保存先 | 備考 |
| --- | --- | --- | --- | --- |
| 実装高さ | `boxHeight` | `layout.box.i_box_h` -> `layout.boxh` -> `layout.boxH` | `layout.boxh` | 現状の配置高さ。 |
| 入線 | `inputWire` | `input.cabinfo.input_wire` | `input.cabinfo.input_wire` | 変更時に種別、断面積、規格をクリアする。 |
| 出線 | `outputWire` | `input.cabinfo.output_wire` | `input.cabinfo.output_wire` |  |
| 種別 | `selectedCategory` | `input.cabinfo.selectedcategory` | `input.cabinfo.selectedcategory` | `config.BoxGutter[inputWire]` のキー。 |
| 断面積 | `selectedArea` | `input.cabinfo.selectedarea` | `input.cabinfo.selectedarea` | `config.BoxGutter[inputWire][selectedCategory]` のキー。 |
| 規格 | `selectedStandard` | `input.cabinfo.selectedstandard` | `input.cabinfo.selectedstandard` | `config.BoxGutter[inputWire][selectedCategory][selectedArea]` のキー。 |

### 上下ガター

| 表示名 | Form field | 読み込み元 | 保存先 | 備考 |
| --- | --- | --- | --- | --- |
| Top1 | `topGutters[0]` | `layout.boxg[0]` | `layout.boxg[0]` | 配置列1の上ガター。 |
| Top2 | `topGutters[1]` | `layout.boxg[1]` | `layout.boxg[1]` | 配置列2の上ガター。 |
| Top3 | `topGutters[2]` | `layout.boxg[2]` | `layout.boxg[2]` | 配置列3の上ガター。 |
| Bottom1 | `bottomGutter` | `layout.boxgb` | `layout.boxgb` | 既存データが単一値のため3列共通。 |
| Bottom2 | `bottomGutter` | `layout.boxgb` | `layout.boxgb` | Bottom1と同じ値を表示/編集する。 |
| Bottom3 | `bottomGutter` | `layout.boxgb` | `layout.boxgb` | Bottom1と同じ値を表示/編集する。 |

### 横方向7要素

読み込み優先順位:

1. `layout.box` のBOXマスター由来フィールド
2. `layout.boxw`
3. デフォルト値

旧6要素データ `[W0, G1, W1, G2, W2, G3]` は、読み込み時に `[0, W0, G1, W1, G2, W2, G3]` として扱う。

| 表示ラベル | Form field | `layout.box` field | `layout.boxw` index | 備考 |
| --- | --- | --- | --- | --- |
| `Left / G0` | `boxWidths[0]` | `f_lgutter` | `layout.boxw[0]` | 左端配線ガター。 |
| `Area1 / W0` | `boxWidths[1]` | `i_floor1` | `layout.boxw[1]` | 配置列1。 |
| `Gt1 / G1` | `boxWidths[2]` | `i_clgutter` | `layout.boxw[2]` | 列1-列2間の配線ガター。 |
| `Area2 / W1` | `boxWidths[3]` | `i_floor2` | `layout.boxw[3]` | 配置列2。 |
| `Gt2 / G2` | `boxWidths[4]` | `i_crgutter` | `layout.boxw[4]` | 列2-列3間の配線ガター。 |
| `Area3 / W2` | `boxWidths[5]` | `i_floor3` | `layout.boxw[5]` | 配置列3。 |
| `Right / G3` | `boxWidths[6]` | `f_rgutter` | `layout.boxw[6]` | 右端配線ガター。 |

保存時は `layout.boxw` に7要素配列を保存し、同時に `layout.box` のBOXマスター由来フィールドにも同じ値を反映する。

## Gutter計算

`Gutter計算` は `calcGutter()` を呼び出す。

参照元:

```text
config.BoxGutter[inputWire][selectedCategory][selectedArea][selectedStandard]
```

反映先:

- `topGutters[0..2]`: `gutterData[0]`
- `bottomGutter`: `gutterData[1]`
- `boxWidths[0]`, `boxWidths[2]`, `boxWidths[4]`, `boxWidths[6]`: `gutterData[2]`

配置列幅 `W0/W1/W2` は `Gutter計算` では変更しない。

## 描画API連携

### 初期/編集用描画

`postBoxSvg` / `postBoxSvg2` / `getTemplate` には `layout.boxw` の7要素をカンマ区切りで渡す。

旧6要素が残っている場合は、送信前に左端 `G0=0` を補って7要素として扱う。

### 整列配置

`postLineUp` は、列幅算出後のテンプレートURLを7要素形式で返す。

箱未選定段階では左右/列間ガターが未確定のため、暫定的に `[0, W0, 0, W1, 0, W2, 0]` とする。

### 箱選定後の最終描画

`postBoxSvg4` は従来、`box_key` からBOXマスターを取得し、
`[f_lgutter, i_floor1, i_clgutter, i_floor2, i_crgutter, i_floor3, f_rgutter]`
を使って描画していた。

BOX設定ダイアログで調整した値を反映するため、クライアントは `box_w` として7要素配列を渡す。

API側は `box_w` が渡された場合はそれを優先し、未指定の場合のみBOXマスター値を使う。

### 2D/3D表示

`postBoxScene3d` も `box_w` を受け取り、渡された場合はBOXマスターの7要素フィールドを上書きして描画/シーン生成する。

## バリデーション

- 入力欄は数値入力とする。
- 保存時は既存実装に合わせ、文字列をtrimして保存する。
- 空欄は空文字として保存する。
- API送信時は必要な箇所で数値化する。

## レスポンシブ仕様

- ダイアログ全体は横幅に応じて折り返す。
- ガター設定の7列グリッドは最小幅を持ち、狭い画面では横スクロールする。
- 入力欄は重ならないこと。
- 固定座標/絶対配置で入力欄を重ねないこと。

## 受け入れ条件

- BOX設定ダイアログが2セクション構成で表示される。
- 横方向設定が7要素 `[G0,W0,G1,W1,G2,W2,G3]` として表示/編集できる。
- 選定済みBOXがある場合、`layout.box` のBOXマスター由来フィールドを優先して読み込む。
- 旧6要素 `layout.boxw` を持つ案件でも、左端 `G0=0` を補って開ける。
- `Update` 実行時に `layout.boxw` と `layout.box` の7要素フィールドが更新される。
- `Gutter計算` で `G0/G1/G2/G3` が更新される。
- 初期/編集用SVG、最終SVG、2D/3D表示が7要素を受け取れる。
- ガター設定欄の入力UIが重ならない。
