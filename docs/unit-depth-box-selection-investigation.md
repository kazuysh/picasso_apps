以下の仕様を調査してください。
・ユニットは複数の内規高さを持っているか。この複数の内規高さからどのような箱が選択されるか？
・箱選定には深さが考慮されているか？

# ユニットの内規高さ・奥行きと箱選定に関する調査報告

> **更新（2026-08-22）**: 本書で特定した課題に対し、ユニット追加時の共通サイズ検証と、`column_depths` を箱の `list_support_height` 検索へ連携する改修を実施した。第2章から第12章は改修前の調査結果として残し、実施内容は第13章に記載する。

## 1. 調査目的

以下の点について、現行フロントエンド実装とリポジトリ内のAPI仕様書を調査した。

- ユニットは複数の内規高さを持つことができるか
- 複数の候補値から、どのような箱が選択されるか
- 箱選定時に奥行き（深さ）が考慮されているか

## 2. 結論

1. ユニットの `list_d` は配列型であり、複数値を保持できる。
2. ただし、画面では `list_d` を「内規高さ」と表示している一方、整列API仕様では「許容奥行き」として扱っている。
3. 箱の内器高さは、ユニットの `list_d` とは別の `list_support_height` で管理される。
4. ユニットの `list_d` は、同じ列に配置するユニット間で共通する奥行きが存在するかの判定に使われる。
5. 整列APIが返す共通奥行き `column_depths` は、現行フロントエンドでは箱検索条件に引き継がれていない。
6. 箱の奥行きは、`input.cabinfo.boxdepth` が設定されている場合のみ、箱検索の完全一致条件として考慮される。
7. `boxdepth` が未設定の場合、ユニットの許容奥行きに適合する箱が選ばれる保証はない。

## 3. 用語とデータ項目の整理

現行実装では、「内規高さ」と「奥行き」に関する名称が一部食い違っている。

| データ項目 | 現行画面・用途 | 実装・仕様上の意味 |
| --- | --- | --- |
| `input.unit.list[].list_d` | ユニット一覧では「内規高さ」と表示 | ユニットの許容奥行き候補 |
| `layout.layout[].list_d` | 整列APIへ渡すユニット情報 | ユニットの許容奥行き候補 |
| `column_depths` | 整列APIのレスポンス | 列ごとに全ユニットで共通する奥行き候補 |
| `input.cabinfo.support_height` | 筐体情報の「内規高さ」 | 箱に要求する内器高さ |
| `box.list_support_height` | 箱マスターの「内規高さ」 | 箱が対応する内器高さ候補 |
| `input.cabinfo.boxdepth` | 筐体情報の箱奥行き | 箱検索で要求する奥行き |
| `box.i_box_d` | 箱マスターのサイズ奥 | 箱本体の奥行き |

### 3.1 表示名の不整合

ユニット追加画面では、`list_d` を「内規高さ」と表示している。

参照: `src/components/project/UnitAddDialog.tsx:70-79`

```ts
const unitColumns: Column[] = [
  { title: "UnitNo", key: "unit_no" },
  { title: "選択", key: "actions", action: "select" },
  { title: "Cap", key: "i_cap" },
  { title: "縦", key: "i_unit_h" },
  { title: "横", key: "list_W" },
  { title: "内規高さ", key: "list_d" },
]
```

一方、整列API仕様では `list_d` を奥行き候補として扱っている。

参照: `docs/postLineUp-column-order-v2-api-spec.md:236-243`

```text
common_widths = intersection(items[*].list_w)
common_depths = intersection(items[*].list_d)
```

したがって、本書では `list_d` を「ユニットの許容奥行き候補」として扱う。

## 4. ユニットは複数の候補値を持つか

`UnitItem.list_d` は配列型として定義されているため、複数値を保持できる。

参照: `src/stores/useAppStore.ts:6-17`

```ts
export type UnitItem = {
  id: number | string
  unit_no?: string
  unit_key?: string
  list_w?: number[] | string[] | null
  list_d?: number[] | string[] | null
}
```

配置データの `LayoutItem.list_d` も配列型である。

参照: `src/stores/useAppStore.ts:68-81`

```ts
export type LayoutItem = {
  // 省略
  list_w?: number[]
  list_d?: number[]
}
```

整列API仕様でも、`list_d` は1件以上の配列で、各値が正の数値として解釈できることを要求している。

参照: `docs/postLineUp-column-order-v2-api-spec.md:180-201`

ただし、このリポジトリにはユニットマスターの実データが含まれていない。そのため、型と処理は複数値を前提としているが、本番マスターに複数の `list_d` を持つユニットが実在するかは、このリポジトリだけでは確認できない。

## 5. 複数の奥行き候補の使われ方

整列処理では、列ごとに、その列へ配置された全ユニットの許容値の積集合を求める。

```text
common_widths = intersection(items[*].list_w)
common_depths = intersection(items[*].list_d)
```

- `common_widths`: 列内の全ユニットで共通する幅候補
- `common_depths`: 列内の全ユニットで共通する奥行き候補

共通幅または共通奥行きが存在しない列は、整列しない仕様である。

整列APIは、共通する幅候補を `f`、共通する奥行き候補を `column_depths` として返す。

```json
{
  "f": {
    "1": ["400", "500"],
    "2": [],
    "3": []
  },
  "column_depths": {
    "1": ["99"],
    "2": [],
    "3": []
  }
}
```

参照: `docs/postLineUp-column-order-v2-api-spec.md:365-384`

## 6. 整列結果から箱検索への受け渡し

フロントエンドは `/api/postLineUp` のレスポンスから、次の値をストアへ保存する。

- `l` → `layout.layout`
- `f` → `layout.floor`
- `n` → `layout.nrow`
- `required_height` または `h` → `layout.boxH`

参照: `src/pages/GenerationRunnerPage.tsx:620-650`

```ts
const ldata = res.data?.l ?? []
const floor = res.data?.f ?? {}
const nRow = res.data?.n ?? 0
const boxH = res.data?.required_height ?? res.data?.h

setLayoutLayout(ldata)
setLayoutFloor(floor)
setLayoutField('nrow', nRow)
setLayoutField('boxH', boxH)
```

この処理では、レスポンスに含まれる `column_depths` をストアへ保存していない。

そのため、ユニットの `list_d` から求めた共通奥行き候補は、後続の箱検索へ引き継がれない。

## 7. 現行の箱検索条件

箱検索条件は `buildBoxSearchFilter` で組み立てられる。

参照: `src/utils/boxSearchFilter.ts:18-57`

主な検索条件は以下のとおり。

| 箱マスター項目 | 条件の生成元 | 条件 |
| --- | --- | --- |
| `i_floor1`～`i_floor3` | `layout.floor` または `cabinfo.floor1`～`floor3` | 候補値への `$in` |
| `i_NRow` | `layout.nrow` | 完全一致 |
| `i_box_h` | `layout.boxH` | 必要高さ以上 `$gte` |
| `i_box_h` | `cabinfo.boxheight` | 指定時は完全一致で上書き |
| `i_box_w` | `cabinfo.boxwidth` | 完全一致 |
| `i_box_d` | `cabinfo.boxdepth` | 完全一致 |
| `list_support_height` | `cabinfo.support_height` | 文字列へ変換して検索 |
| その他 | 材質、設置場所、色、用途、構造 | 完全一致 |

### 7.1 箱高さ

配置から算出した `layout.boxH` が存在する場合、箱高さには次の下限条件が設定される。

```ts
filter.i_box_h = { $gte: Number(boxH) }
```

`cabinfo.boxheight` が指定されている場合は、下限条件ではなく指定値の完全一致になる。

### 7.2 箱の内器高さ

`cabinfo.support_height` が指定されている場合のみ、箱マスターの `list_support_height` が検索条件へ追加される。

```ts
if (hasBoxSearchValue(cabinfo.support_height)) {
  filter.list_support_height = String(cabinfo.support_height)
}
```

これはユニットの `list_d` から自動生成される値ではなく、筐体情報として別途入力・設定された値である。

### 7.3 箱奥行き

`cabinfo.boxdepth` が指定されている場合のみ、箱マスターの `i_box_d` が完全一致条件へ追加される。

```ts
if (hasBoxSearchValue(cabinfo.boxdepth)) {
  filter.i_box_d = Number(cabinfo.boxdepth)
}
```

`cabinfo.boxdepth` が未設定の場合、`i_box_d` は検索条件に含まれない。

ユニットから算出された `column_depths` を `i_box_d` の条件へ変換する処理も存在しない。

## 8. 自動選定される箱

自動生成フローでは、箱検索を次の優先順位で昇順ソートする。

参照: `src/pages/GenerationRunnerPage.tsx:220-224`

```ts
const defaultBoxSortBy = [
  { key: 'i_box_w', order: 'asc' },
  { key: 'i_box_h', order: 'asc' },
  { key: 'i_box_d', order: 'asc' },
]
```

検索件数を1件にしてAPIを呼び、返された先頭の箱を自動選定する。

参照: `src/pages/GenerationRunnerPage.tsx:752-809`

```ts
const payload = {
  startPage: 1,
  length: 1,
  filter,
  sort: defaultBoxSortBy,
  collection: 'box',
}

const selectedBox = items[0]
```

したがって、現行の自動選定は次のようになる。

1. 箱幅・列数・必要高さ・筐体情報などの検索条件に一致する箱を抽出する。
2. 箱幅の小さい順に並べる。
3. 同じ箱幅なら箱高さの小さい順に並べる。
4. 箱幅と箱高さが同じなら箱奥行きの小さい順に並べる。
5. 先頭の1件を選定する。

`cabinfo.boxdepth` が未設定の場合、奥行きは適合条件ではなく、第3ソートキーとしてのみ使用される。このため、選ばれた箱の奥行きがユニットの `list_d` に含まれる保証はない。

## 9. 箱選定で奥行きが考慮される条件

| 状況 | ユニット共通奥行き | 箱奥行きの検索条件 | 選定結果 |
| --- | --- | --- | --- |
| `cabinfo.boxdepth` が指定済み | 整列可否には使用 | `i_box_d` の完全一致 | 指定奥行きの箱だけが候補になる |
| `cabinfo.boxdepth` が未指定 | 整列可否には使用 | 条件なし | 幅・高さ等が一致する箱から、ソート上小さい奥行きが選ばれる |
| 列内ユニットに共通する `list_d` がない | 共通候補なし | 箱検索前の整列で失敗 | 箱選定へ進まない |
| `cabinfo.support_height` が指定済み | `list_d` とは無関係 | `list_support_height` を検索 | 指定内器高さを持つ箱が候補になる |

## 10. 現行仕様の問題点

### 10.1 `list_d` の表示名が実際の用途と一致していない

ユニット追加画面では `list_d` を「内規高さ」と表示しているが、整列仕様では奥行きとして使っている。

これにより、次の2項目が同じ意味に見えてしまう。

- ユニットの `list_d`
- 箱の `list_support_height`

実際には別の条件であるため、画面表示やデータ辞書の見直しが必要である。

### 10.2 `column_depths` が箱検索へ接続されていない

整列APIはユニット間で共通する奥行き候補を計算しているが、フロントエンドが保存・利用していない。

そのため、`cabinfo.boxdepth` が未設定の場合は、ユニットの奥行き条件と適合しない箱を選ぶ可能性がある。

### 10.3 奥行きの候補が複数ある場合の採用ルールがない

共通奥行きが複数存在する場合に、次のどのルールを採用するかが現行フロントエンドには実装されていない。

- 最小奥行きを採用する
- 箱マスターに存在する奥行きを優先する
- 複数候補を `$in` 条件として箱検索する
- 利用者に選択させる

## 11. 改善候補

ユニットの奥行きを箱選定へ確実に反映する場合、以下の対応が考えられる。

1. `postLineUp` の `column_depths` を `layout` ストアへ保存する。
2. 複数列の奥行き候補をどのように統合するか決定する。
3. 箱検索条件の `i_box_d` に共通奥行き候補を反映する。
4. 複数候補を許容する場合は、例えば次の検索条件を使用する。

```ts
filter.i_box_d = { $in: compatibleDepths }
```

5. `cabinfo.boxdepth` が明示指定されている場合は、ユニットの共通奥行きに含まれるか検証する。
6. ユニット一覧の `list_d` の表示名を、実際の意味に合わせて「許容奥行き」などへ変更する。

## 12. 最終整理

- ユニットの `list_d` は複数値を持てる。
- 現行仕様上、`list_d` は内器高さではなく許容奥行きとして使われる。
- 複数ユニットを同じ列へ配置するときは、`list_d` の積集合が整列可否に使われる。
- その積集合は、現状では箱検索へ渡されない。
- 箱奥行きは `cabinfo.boxdepth` が設定されている場合だけ検索条件になる。
- 未設定時は奥行きがソート条件にしかならず、ユニットとの奥行き適合は保証されない。
- 箱の内器高さ `list_support_height` は、ユニットの `list_d` とは別の条件である。

## 13. 改修内容（2026-08-22）

### 13.1 ユニット追加時の共通サイズ検証

`src/utils/unitSizeCompatibility.ts` を追加し、選定済みユニットと追加候補ユニットの全体について、以下の積集合を算出するようにした。

- `list_w` または `list_W` の共通横幅
- `list_d` の共通奥行き

単体追加とProduct/SFDからの一括追加の両方で検証を実行する。共通横幅または共通奥行きがなくなる場合は、エラーメッセージを表示して追加を中止する。

一括追加は、対象ユニットをすべて取得して全体の互換性を確認した後に機器情報を取得・配置する。このため、不適合な一括追加が途中まで登録されることはない。

候補値は数値として正規化するため、例えば文字列の `"500"` と数値の `500` は同じ候補として判定する。空値、非数値、0以下の値は有効な候補として扱わない。

### 13.2 整列結果の共通奥行き保持

`postLineUp` が返す `column_depths` を `layout.column_depths` へ保存するようにした。

対象:

- 自動生成フローの整列処理
- 配置編集ダイアログ内の再整列処理

整列に失敗した場合は、古い共通奥行きを再利用しないよう、自動生成フローの `layout.column_depths` をクリアする。

### 13.3 箱の内器高さ検索への連携

箱検索条件の生成時に、各使用列の `column_depths` をさらに積集合にし、箱全体で共通する奥行きを求めるようにした。

例えば次の整列結果の場合:

```json
{
  "1": ["99", "120"],
  "2": ["99", "150"],
  "3": []
}
```

箱全体の共通奥行きは `"99"` となり、次の条件を箱検索APIへ送る。

```json
{
  "list_support_height": {
    "$in": ["99"]
  }
}
```

`postAnyCollByPage` は受け取ったフィルターをMongoDBの `find` へ渡す実装であるため、`$in` により、箱マスターの `list_support_height` に共通奥行きのいずれかを持つ箱だけが候補になる。

`cabinfo.support_height` が明示指定されている場合は、ユニット共通奥行きとの積集合を検索条件にする。両者が一致しない場合は `$in: []` となり、物理条件を満たさない箱は選定されない。

### 13.4 テスト

以下を自動テストへ追加した。

- `list_w` / `list_W` および数値・文字列の表記揺れを吸収できること
- 共通横幅がなくなるユニットを不適合にすること
- 共通奥行きがなくなるユニットを不適合にすること
- 複数列の奥行き候補から箱全体の積集合を算出すること
- 共通奥行きを `list_support_height.$in` へ連携すること
- 明示指定された内器高さと共通奥行きの両方を満たす値だけを検索すること
