# 箱選定フローと関連データ仕様（暫定）

この文書は、回路生成・配置生成・箱選定・ガター補正に関わるデータの関係を整理するための暫定仕様です。
ガター編集画面の実装後に、API側の期待キーと合わせて見直す前提です。

## 用語

### UNIT_NO

表示用のユニット品名です。

例:

```text
UPN10-10
```

ULF表示、結果表示、ULFダウンロードでは基本的にこの値を使います。
ただし、同じ案件内に同じ `UNIT_NO` のユニットが複数存在するため、内部処理の識別子としては不足します。

### ユニットインスタンスID

案件内でユニットを一意に区別するIDです。
回路表示では `UNIT_NO@id` の形式で使われます。

例:

```text
UPN10-10@10001
```

この場合、`10001` がユニットインスタンスIDです。
同じ `UPN10-10` が2つあっても、`@10001`, `@10002` のように区別できます。

### ユニットマスターキー

ユニットマスターを参照するためのキーです。
ユニットの大きさ、幅リスト、奥行きリスト、上下ガターなどの仕様情報を取得するために使われます。

例:

```text
UPN10-10_1
```

これは表示用の `UNIT_NO` でも、案件内インスタンスIDでもありません。
マスター参照用のキーとして扱う必要があります。

## キーの役割

| 役割 | 例 | 主な用途 |
| --- | --- | --- |
| 表示用 `UNIT_NO` | `UPN10-10` | ULF表示、結果表示、帳票、ULFダウンロード |
| インスタンス識別 | `10001`, `UPN10-10@10001` | 回路ノード、配置インスタンス識別、同一UNIT_NOの区別 |
| マスター参照 | `UPN10-10_1` | ユニットサイズ、上下ガター、list_w/list_d の取得 |

暫定ルール:

```text
表示/出力: unit_no
案件内インスタンス識別: id または UNIT_NO@id
ユニット仕様参照: unit_key
```

## ストア上の主要データ

### input.unit.list

ユニットの案件内インスタンス一覧です。

想定される関係:

```text
input.unit.list[].id       = 10001
input.unit.list[].unit_no  = UPN10-10
input.unit.list[].unit_key = UPN10-10_1
input.unit.list[].i_row    = 配置列
input.unit.list[].list_w   = 幅候補またはマスター由来の幅情報
input.unit.list[].list_d   = 奥行き候補またはマスター由来の奥行き情報
```

注意:

`unit_no` は重複可能です。
同一 `unit_no` の複数インスタンスを区別する場合は、`id` を使う必要があります。

### input.circuit.graphdata

回路表示・配置推定に使うグラフデータです。

想定:

```text
graphdata.nodes[].id = UPN10-10@10001
graphdata.nodes[].label = UPN10-10
```

`@` 以降の `10001` が `input.unit.list[].id` と対応します。

### layout.ulf

ULF表示・ULFダウンロード用のレイアウト表現です。
基本的には `unit_no` を保持します。

例:

```text
1: [UG15,"UPN10-10",UG15,"UPN10-10",UG0]
```

この例は、同じ列に同じ `UNIT_NO` のユニットが縦に2つ並ぶことを表します。
`UG15` や `UG0` はユニット上下につくガター、つまり配線スペースです。

注意:

`layout.ulf` だけを見ると、2つの `UPN10-10` がどのインスタンスIDに対応するかは分かりません。
内部APIに渡す前には、`input.unit.list` の出現順や `UNIT_NO@id` の情報を使って、インスタンス識別できる形へ変換する必要があります。

### layout.layout

配置座標データです。

想定:

```text
layout.layout[].i = 10001
layout.layout[].u = UPN10-10
layout.layout[].k = UPN10-10_1
layout.layout[].c = 配置列
layout.layout[].x = X座標
layout.layout[].y = Y座標
layout.layout[].w = 幅
layout.layout[].h = 高さ
layout.layout[].gtop = 上ガター
layout.layout[].gbottom = 下ガター
```

暫定的には、次の責務分担が望ましいです。

```text
i: インスタンス識別
u: 表示名
k: マスター参照キー
```

### layout.floor / layout.nrow / layout.boxH

整列配置後に得られる箱選定用の条件です。

`postLineUp` の戻り値から更新され、箱検索条件として使われます。

### layout.box

箱選定結果です。

`postAnyCollByPage` で箱コレクションを検索し、選定された箱データを保存します。

### layout.svg

最終結果表示用SVGです。

`postBoxSvg4` で生成されます。

## 箱選定までの標準フロー

### 1. 回路生成

入力:

```text
input.device.list
```

API:

```text
postUnitFlow
```

出力:

```text
input.circuit.graphdata
```

期待:

回路ノードIDは `UPN10-10@10001` のように、表示用 `UNIT_NO` とインスタンスIDを両方含む形を保つ。

### 2. 配置AI推定

入力:

```text
input.circuit.graphdata
```

API:

```text
postUnitLayoutInfer
```

出力:

```text
layout.ulf
```

期待:

配置推定時は `UPN10-10@10001` または `10001` を使って、同一 `UNIT_NO` の複数インスタンスを区別できることが望ましいです。
ただし、結果表示・ULF出力用の `layout.ulf` は `UPN10-10` 表示に正規化される可能性があります。

### 3. ULFからユニット列を更新

入力:

```text
layout.ulf
input.unit.list
```

出力:

```text
input.unit.list[].i_row
```

注意:

`layout.ulf` が `unit_no` だけを持つ場合、同じ `unit_no` の複数ユニットは出現順で割り当てるしかありません。
この割り当ては暫定処理であり、将来的には `layout.ulf` とは別に内部キー付きULFを持つ方が安全です。

### 4. 配置データ生成

入力:

```text
input.unit.list
layout.ulf
```

API:

```text
postUnits2Layout
```

出力:

```text
layout.layout
```

重要:

`postUnits2Layout` が何をキーとして期待しているかは要確認です。

候補:

```text
unit_no      = UPN10-10
id           = 10001
unit_key     = UPN10-10_1
UNIT_NO@id   = UPN10-10@10001
```

同一 `unit_no` がある場合、`unit_no` だけでは不足します。
一方、サイズやガターをマスターから引く場合は `unit_key` が必要です。
インスタンス識別とマスター参照の両方が必要なら、ULFトークンだけで解決せず、`u` 側の一覧で `id`, `unit_no`, `unit_key` の対応を渡す設計が望ましいです。

### 5. 初期SVG生成

入力:

```text
layout.layout
layout.boxw
layout.boxg
layout.boxh
```

API:

```text
postBoxSvg
postBoxSvg2
```

出力:

```text
配置設計SVG
```

期待:

SVG描画では `layout.layout[].i` をユニットインスタンス識別に使うべきです。
`u` だけでグルーピングすると、同じ `UNIT_NO` が縦並びの時に1つに潰れる可能性があります。

### 6. 整列配置

入力:

```text
layout.layout
layout.boxg
layout.boxgb
layout.backgroundSvgUrl
```

API:

```text
postLineUp
```

出力:

```text
layout.layout
layout.floor
layout.nrow
layout.boxH
layout.backgroundSvgUrl
```

期待:

`postLineUp` 後も `layout.layout[].i`, `u`, `k` の関係が維持される必要があります。

### 7. 箱検索・箱選定

入力:

```text
layout.floor
layout.nrow
layout.boxH
input.cabinfo
```

API:

```text
postAnyCollByPage
```

出力:

```text
layout.box
layout.boxcode
```

検索条件例:

```text
i_floor1 / i_floor2 / i_floor3
i_NRow
i_box_h
body_material
box_location
out_color
box_purpose
structure
i_box_w
i_box_d
list_support_height
```

### 8. ガター補正

入力:

```text
layout.layout
layout.boxg
layout.nrow
layout.box.i_box_h
```

API:

```text
postLayout2Gtr
```

出力:

```text
layout.ulf
```

役割:

`postLayout2Gtr` はユニット上下のガター、つまり配線スペースの補正を行うAPIです。

注意:

このAPIのレスポンスで `unit_no`, `unit_key`, `id` のどれが返るべきかは要確認です。
ガター補正APIであるため、本来は配置済みユニットのインスタンス関係を壊さず、ガター値だけを補正するのが望ましいです。

### 9. 最終SVG生成

入力:

```text
layout.box
layout.layout
input.device.list
```

API:

```text
postBoxSvg4
```

出力:

```text
layout.svg
```

期待:

最終SVGでも `layout.layout[].i` をインスタンス識別に使うべきです。
`unit_no` だけで描画対象をまとめると、同じユニットが1つに潰れる可能性があります。

## 再開フローの注意点

### full

回路生成から全工程をやり直します。

```text
loadCircuit
updateCircuit
runAiInitialPlacement
updateLayoutStore
updateLineUp
ensureBoxSelected
saveSvgData2
```

回路表示からやり直すとうまくいく場合、`UNIT_NO@id` のインスタンス関係がこのフローで復元されている可能性があります。

### initialPlacement

回路編集後に、配置AI推定から再開します。

```text
runAiInitialPlacement
updateLayoutStore
updateLineUp
ensureBoxSelected
saveSvgData2
```

### lineUp

配置編集後に、整列配置から再開します。

```text
updateLineUp
ensureBoxSelected
saveSvgData2
```

注意:

このフローでは `updateLayoutStore` がスキップされます。
そのため、`layout.ulf`, `input.unit.list`, `layout.layout` の対応関係が古いまま残る可能性があります。

配置編集後に同一 `UNIT_NO` の縦並びが1つに潰れる場合、この再開フローで内部キーの関係が再構成されていないことが疑われます。

## 現時点の暫定判断

現時点では、次の分離を守るのが安全です。

```text
unit_no: 表示とULF出力
id: 案件内インスタンス識別
unit_key: ユニットマスター参照
```

`layout.ulf` は表示用として `unit_no` を保持してよいですが、内部配置APIに渡す時には `id` または `unit_key` を含む形に変換する必要があります。

ただし、どのAPIがどのキーを期待しているかは未確定です。
特に `postUnits2Layout` と `postLayout2Gtr` は慎重に確認が必要です。

## 要確認事項

### postUnits2Layout

確認したいこと:

```text
ULFトークンとして unit_no を期待しているか
ULFトークンとして unit_key を期待しているか
ULFトークンとして id または UNIT_NO@id を期待しているか
u 側の unit_no/unit_key/id 対応を参照しているか
```

判断基準:

同一 `UNIT_NO` が複数ある場合に、2つのユニットを別インスタンスとして `layout.layout` に出力できること。

### postLineUp

確認したいこと:

```text
layout.layout[].i を維持するか
layout.layout[].u を表示用として維持するか
layout.layout[].k をマスター参照用として維持するか
```

### postLayout2Gtr

確認したいこと:

```text
ガター補正時に unit_key を使ってマスター情報を参照しているか
戻り値ULFに unit_no / unit_key / id のどれを返す仕様か
同一UNIT_NOの複数インスタンス順序を維持するか
```

### postBoxSvg2 / postBoxSvg4

確認したいこと:

```text
SVG要素IDに layout.layout[].i が入るか
同じ unit_no を描画時に1つにまとめていないか
縦並びの同一UNIT_NOを別要素として出力するか
```

## ガター編集画面実装後に決めること

ガター編集画面では、表示上は `UPN10-10` を見せても、編集対象は `id = 10001` のようなインスタンス単位で持つ必要があります。

望ましい編集データ:

```text
unit_id: 10001
unit_no: UPN10-10
unit_key: UPN10-10_1
gtop: 上ガター
gbottom: 下ガター
```

この形なら、同じ `UPN10-10` が複数あっても、別々にガター編集できます。

## 暫定的なリスク

現在の暫定処理では、`layout.ulf` に `unit_no` しかない場合、同じ `UNIT_NO` のインスタンスを出現順で `input.unit.list` に対応付けています。
これはフルフローでは動きやすいですが、配置編集後の再開フローでは順序がずれる可能性があります。

長期的には、表示用ULFとは別に、内部用のキー付きULFを持つことを検討すべきです。

候補:

```text
layout.ulf        = 表示/出力用 unit_no
layout.ulfKeys    = 内部用 id または UNIT_NO@id
layout.layout     = 座標と unit_no/unit_key/id の確定データ
```
