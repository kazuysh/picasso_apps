# BoxList.vue 仕様書（Vue → React 移行用）

## 1. ページ概要

**BoxList.vue** は「箱選定」画面であり、筐体オプションの絞り込み条件に合致するキャビネット（箱）の一覧をサーバーサイドで表示・ページネーションする。

ユーザーは一覧から目的の箱を選択すると、`postLayout2Gtr` API でガター補正を受け、選定箱を確定して「UnitLocation（配置画面）」へ遷移する。

| 項目 | 内容 |
| --- | --- |
| Vue 側パス | `UnitLocation` から遷移（`BoxList` ルーティング） |
| React 側相当 | `picasso_apps` には既に対応するページ未実装（ResultDisplayTab は結果表示のみ） |
| 用途 | 箱コレクションの一覧表示・絞り込み・箱選定 |

---

## 2. コンポーネント構造

### 2.1 全体構成（Vue 現在）

```
BoxList.vue
├── BoxFilter.vue  （ dialogRef: v-dialog 内の絞り込み設定）
│   ├── ColorPickerDialog（カラーピッカー）
│   └── AutoForm / select 系（equipmentLocation, equipmentPurpose, material, structure...）
└── v-data-table-server（箱一覧テーブル）
```

### 2.2 React 移行時のコンポーネント構成

```
BoxListPage.tsx （新規作成）
├── BoxFilterDialog.tsx  （絞り込み条件設定ダイアログ）
├── BoxListTable.tsx     （箱一覧テーブル）
└── ColorPickerDialog    （既存の ColorPickerDialog を流用）
```

---

## 3. ステート構造（Vue 現在）

```
useAppStore()
  .input.cabinfo  → 絞り込み条件
    .format       → 設備場所
    .format2      → 設備用途1
    .format3      → 設備用途2
    .material     → 材質（selectData から自動設定）
    .structure    → 構造（selectData から自動設定）
    .outer_color  → 塗装色（ColorPickerDialog から設定）
    .boxwidth     → 箱幅（数値）
    .boxheight    → 箱高さ（数値）
    .boxdepth     → 箱奥行き（数値）
    .support_height → 内器高さ（数値）
    .floor1       → 列1（セレクト）
    .floor2       → 列2（セレクト）
    .floor3       → 列3（セレクト）

useAppStore()
  .layout.floor   → 各列のユニットリスト（["1"]:[...], ["2"]:[...], ["3"]:[...]）
  .layout.nrow    → 列数
  .layout.boxH    → 箱高さ
  .layout.boxg    → 箱ガター
  .layout.layout  → 配置データ
  .layout.ulf     → ULF 表現
  .layout.box     → 選定箱
  .layout.boxcode → "確定" + 箱 code

useConfig()
  .config.CabinetinfoOption
    .format       → 設備場所セレクトアイテム
    .format2      → 設備用途1セレクトアイテム
    .format3      → 設備用途2セレクトアイテム
    .material     → 材質セレクトアイテム
    .structure    → 構造セレクトアイテム
    .colors       → カラーデータ { colorKey: { NAME, RGB } }
    .selectData   → 連携データ { 設備場所: { 用途1: { 用途2?: { material, structure, boxdepth } } } }
```

---

## 4. フィルター仕様（BoxFilter.vue）

### 4.1 フィールド一覧

| フィールド | タイプ | 取得元 | 説明 |
| --- | --- | --- | --- |
| 設備場所 | セレクト | `config.CabinetinfoOption.format` | クリア可能 |
| 設備用途1 | セレクト | `config.CabinetinfoOption.format2` | 設備場所依存（selectData リンク） |
| 設備用途2 | セレクト | `config.CabinetinfoOption.format3` | 用途1依存（selectData リンク） |
| 材質 | セレクト | `selectData` から自動設定 or クリア可能 |
| 構造 | セレクト | `selectData` から自動設定 or クリア可能 |
| 塗装色 | カラーピッカー + セレクト | `config.CabinetinfoOption.colors` | ColorPickerDialog → `updateOuterColor` |
| 箱幅 | 数値入力 | フォーム内 | クリア可能 |
| 箱高さ | 数値入力 | フォーム内 | クリア可能 |
| 箱奥行き | 数値入力 | フォーム内 | クリア可能 |
| 内器高さ | 数値入力 | フォーム内 | クリア可能 |
| 列1 | セレクト | `layout.floor["1"]` | クリア可能 |
| 列2 | セレクト | `layout.floor["2"]` | クリア可能 |
| 列3 | セレクト | `layout.floor["3"]` | クリア可能 |

### 4.2 selectData リンク機構（重要）

`config.CabinetinfoOption.selectData` は以下の階層構造を持つ：

```typescript
selectData: {
  [equipmentLocation: string]: {
    [equipmentPurpose1: string]: {
      [equipmentPurpose2?: string]: {
        material?: string
        structure?: string
        boxdepth?: number | null
      }
      default?: {
        material?: string
        structure?: string
        boxdepth?: number | null
      }
    }
  }
}
```

**連携ロジック**:

1. 設備場所と設備用途1が両方選択された時点で `selectData` から値を検索
2. 設備用途2が選択されれば `selectData[loc][purpose1][purpose2]` を検索
3. 用途2が存在しない場合は `selectData[loc][purpose1].default` または `['']` を検索
4. 見つかった場合、`material`, `structure`, `boxdepth` を `cabinfo` に自動反映

```
equipmentLocation ─→ 用途1 ─→ 用途2?
                    ↓              ↓
            selectData[loc]    selectData[loc][purpose1][purpose2]
                    ↓              or  .default
            selectData[loc][purpose1]
                    ↓
      material / structure / boxdepth
```

### 4.3 Vue の Watch 機構（React 移行時の実装ポイント）

```javascript
// Vue 3 Composition API の watch 相当
watch([
  () => form.format,
  () => form.format2,
  () => form.format3,
], () => {
  applyLinkedData()  // selectData から material/structure/boxdepth を自動設定
})

watch(
  () => item.value?.selectData,
  () => {
    applyLinkedData()  // config 更新時も再適用
  },
  { immediate: true, deep: true }
)
```

**React 移行**: `useEffect` で依存配列 `[cabinfo.format, cabinfo.format2, cabinfo.format3, config.CabinetinfoOption]` を使い、`cabinfo` または `config` が更新されたら `applyLinkedData` を実行。

---

## 5. テーブル仕様（v-data-table-server 相当）

### 5.1 カラム定義

| タイトル | キー (key) | MongoDB フィールド | 説明 |
| --- | --- | --- | --- |
| code | `code` | `code` | 箱コード |
| アクション | `actions` | - | 「選択」ボタン |
| 材質 | `body_material` | `body_material` | 材質 |
| 色 | `out_color` | `out_color` | 塗装色 |
| 設置場所 | `box_location` | `box_location` | 設置場所 |
| 設置用途 | `box_purpose` | `box_purpose` | 設置用途1 |
| 設置用途2 | `box_purpose2` | `box_purpose2` | 設置用途2 |
| 構造 | `structure` | `structure` | 構造 |
| 移動板 | `move_board` | `move_board` | 移動板 |
| サイズ幅 | `i_box_w` | `i_box_w` | 箱幅 |
| サイズ高 | `i_box_h` | `i_box_h` | 箱高さ |
| サイズ奥 | `i_box_d` | `i_box_d` | 箱奥行き |
| 内規高さ | `list_support_height` | `list_support_height` | 内器高さ |
| 列数 | `i_NRow` | `i_NRow` | 列数 |
| 列1 | `i_floor1` | `i_floor1` | 列1の幅 |
| 列2 | `i_floor2` | `i_floor2` | 列2の幅 |
| 列3 | `i_floor3` | `i_floor3` | 列3の幅 |

### 5.2 ページネーション

| 項目 | Vue 側実装 | React 側実装 |
| --- | --- | --- |
| 制御方式 | `v-data-table-server`（サーバーサイド） | `MUIDataTable` または `DataGrid` の `paginationMode="server"` |
| 初期行数 | `ref(1)`（1件/ページ） | state で初期値 `1` |
| 行数オプション | `[1, 10, 25, 50]` | コンポーネント prop で指定 |
| 表示行数ラベル | `表示行数`（日本語） | テキストプロップで日本語化 |

### 5.3 ソート仕様

**デフォルトソート（優先順）**:

```javascript
defaultSortBy = [
  { key: 'i_box_w', order: 'asc' },   // サイズ幅 昇順
  { key: 'i_box_h', order: 'asc' },   // サイズ高 昇順
  { key: 'i_box_d', order: 'asc' },   // サイズ奥 昇順
]
```

**実装ロジック（Vue）**:

```javascript
function normalizeSortBy(inputSortBy) {
  const base = Array.isArray(inputSortBy) ? [...inputSortBy] : []
  const exists = new Set(base.map(s => s.key))
  for (const def of defaultSortBy) {
    if (!exists.has(def.key)) {
      base.push(def)
    }
  }
  return base
}
```

**要点**: ユーザーのソート設定 (`options.sortBy`) に `defaultSortBy` のキーが含まれていない場合は末尾へ追加。これにより、ソート順の優先度が確保される。

**React 側実装ポイント**: `MUIDataTable` の `sort` プロパティにデフォルトソート設定を渡すか、API リクエスト時の `sort` フィールドへデフォルトソートも追加して送付。

### 5.4 各カラムのスタイル（Vue CSS）

```css
.customized-table {
  font-size: 10px;
}
.customized-table th {
  font-size: 10px;
  background-color: #3399b3;  /* ヘッダー背景 */
  color: white;                /* ヘッダー文字 */
  white-space: nowrap;         /* ヘッダー折り返し防止 */
}
.customized-table td {
  font-size: 10px;
  padding: 4px;
  white-space: nowrap;         /* セル折り返し防止 */
}
```

**React 移行**: MUI の `DataGrid` を使用する場合、`columnHeaderStyle` / `cellStyle` で同様のスタイルを適用。フォントサイズ `10px` は MUI デフォルトより小さいため `sx` で明示。

---

## 6. API 仕様

### 6.1 箱一覧取得（postAnyCollByPage）

| 項目 | 内容 |
| --- | --- |
| エンドポイント | `POST /api/postAnyCollByPage` |
| リクエストボディ | `p` オブジェクト |

**リクエストフォーマット**:

```typescript
type PostAnyCollByPageRequest = {
  startPage: number;      // ページ番号（1-origin）
  length: number;         // ページサイズ
  filter: BoxFilter;      // 絞り込み条件
  sort: Array<{ key: string, order: 'asc' | 'desc' }>;
  collection: 'box';      // コレクション名（固定）
};

type BoxFilter = {
  i_floor1?: { $in: number[] } | number;
  i_floor2?: { $in: number[] } | number;
  i_floor3?: { $in: number[] } | number;
  i_NRow?: number;
  body_material?: string;
  box_location?: string;
  out_color?: string;
  box_purpose?: string;
  structure?: string;
  i_box_w?: number;
  i_box_d?: number;
  list_support_height?: string;       // 数値を文字列に変換
  i_box_h?: number | { $gte: number }; // boxheight 指定時は固定値、否则 $gte
};
```

**フィルターの生成ロジック**:

```javascript
const filter = {};

// floor はレイアウト.floor から（配列）
if (f[1].length > 0) {
  const vals = f[1].map(Number).filter(v => !isNaN(v));
  if (vals.length > 0) filter.i_floor1 = { $in: vals };
}
if (f[2].length > 0) {
  const vals = f[2].map(Number).filter(v => !isNaN(v));
  if (vals.length > 0) filter.i_floor2 = { $in: vals };
}
if (f[3].length > 0) {
  const vals = f[3].map(Number).filter(v => !isNaN(v));
  if (vals.length > 0) filter.i_floor3 = { $in: vals };
}

// フォームからの個別値（優先度高）
if (floor1 != null) filter.i_floor1 = { $in: [Number(floor1)] };
if (floor2 != null) filter.i_floor2 = { $in: [Number(floor2)] };
if (floor3 != null) filter.i_floor3 = { $in: [Number(floor3)] };

if (n != null) filter.i_NRow = n;
if (basem != null) filter.body_material = basem;
if (location != null) filter.box_location = location;
if (color != null) filter.out_color = color;
if (format2 != null) filter.box_purpose = format2;
if (structure != null) filter.structure = structure;
if (boxwidth != null) filter.i_box_w = boxwidth;
if (boxdepth != null) filter.i_box_d = boxdepth;
if (supporth != null) filter.list_support_height = String(supporth);
// 注: list_support_height は文字列に変換

// i_box_h は特殊：boxheight が null の場合は $gte: layout.boxH
filter.i_box_h = { $gte: h }
if (boxheight != null) filter.i_box_h = boxheight;
```

**レスポンスフォーマット**:

```typescript
type PostAnyCollByPageResponse = {
  result: {
    data: BoxSearchItem[];  // 箱データ一覧
    total: number;           // 総件数
  };
};

type BoxSearchItem = {
  code?: string;
  box_key?: string;
  i_box_w?: number;
  i_box_h?: number;
  i_box_d?: number;
  i_NRow?: number;
  i_floor1?: number;
  i_floor2?: number;
  i_floor3?: number;
  body_material?: string;
  out_color?: string;
  box_location?: string;
  box_purpose?: string;
  box_purpose2?: string;
  structure?: string;
  move_board?: string;
  list_support_height?: string[] | string;
  [key: string]: any;       // その他フィールド
};
```

### 6.2 箱選択時処理（postLayout2Gtr）

| 項目 | 内容 |
| --- | --- |
| エンドポイント | `POST /api/postLayout2Gtr` |
| リクエストボディ | ガター補正用パラメータ |

**リクエストフォーマット**:

```typescript
type PostLayout2GtrRequest = {
  l: any[];         // layout.layout（配置データ）
  g: any[];         // layout.boxg（箱ガター）
  n: number;        // layout.nrow（列数）
  boxh: number;     // 選定箱の i_box_h
};
```

**レスポンス**:

```typescript
type PostLayout2GtrResponse = Record<string, any>;
// ulf データが返される（例: { "1": [...], "2": [...], "3": [...] }）
```

**処理内容**:
1. レスポンスを `layout.ulf` に設定
2. 選定した箱アイテムを `layout.box` に設定
3. `layout.boxcode` を `"確定" + item.code` に設定
4. `UnitLocation` ページへ遷移（Vue: `router.push('UnitLocation')`）

### 6.3 再検索ボタン

```javascript
refreshTable() {
  loadItems({
    page: 1,
    itemsPerPage: itemsPerPage.value,
    sortBy: defaultSortBy,  // デフォルトソートに戻す
  });
}
```

---

## 7. React 移行時の実装要点

### 7.1 BoxListPage.tsx

```
BoxListPage.tsx
├── ステート管理
│   ├── serverItems: BoxSearchItem[]
│   ├── totalItems: number
│   ├── loading: boolean
│   ├── itemsPerPage: number
│   ├── page: number
│   ├── sortBy: SortOption[]
│   ├── filterOpen: boolean
│   └── fetchFromAPI: (page, itemsPerPage, sortBy, filter) => void
│
├── ヘッダーバー
│   ├── タイトル: "箱選定"
│   ├── 「絞り込み設定」ボタン → filterOpen = true
│   ├── 「再検索」ボタン → refreshTable()
│   └── 「戻る」ボタン → router.push('/UnitLocation')
│
└── BoxFilterDialog
    ├── 開閉制御
    ├── 絞り込み条件の双方向バインディング
    ├── selectData リンク機構（useEffect）
    └── カラーピッカー統合
```

### 7.2 BoxFilterDialog.tsx

**props**:

```typescript
type BoxFilterDialogProps = {
  open: boolean;
  onClose: () => void;
  filter: CabInfo;            // 絞り込み条件
  onFilterChange: (nextFilter: CabInfo) => void;
  floorOptions: Array<number>[];  // layout.floor の各列のオプション
  cabinetinfoOption: CabinetinfoOption | null;  // config から取得
};
```

**selectData リンクの実装（React）**:

```typescript
// useEffect で連動処理
useEffect(() => {
  const selectData = cabinetinfoOption?.selectData;
  if (!selectData) return;

  const loc = filter.format;
  const purpose1 = filter.format2;
  const purpose2 = filter.format3;

  if (!loc || !purpose1) {
    // 未選択時は material/structure をクリア
    onFilterChange({ ...filter, material: undefined, structure: undefined, boxdepth: undefined });
    return;
  }

  const lv1 = selectData[loc];
  if (!lv1) return;

  const lv2 = lv1[purpose1];
  if (!lv2) return;

  let linked: { material?: string; structure?: string; boxdepth?: number | null } | null = null;

  if (purpose2) {
    linked = lv2[purpose2] ?? lv2.default ?? lv2[''];
  } else {
    linked = lv2.default ?? lv2[''];
  }

  if (linked) {
    onFilterChange({
      ...filter,
      material: linked.material,
      structure: linked.structure,
      boxdepth: linked.boxdepth ?? undefined,
    });
  }
}, [filter.format, filter.format2, filter.format3, cabinetinfoOption]);
```

### 7.3 テーブル実装（React 側）

**候補**:

| 選択肢 | 利点 | 注意点 |
| --- | --- | --- |
| MUI `DataGrid` | MUI と統一感、サーバーサイドページネーション対応 | セル幅調整が必要 |
| MUI `Table` + `Pagination` | 自由度が高い、既存の ProjectListPage と同様の実装 | コード量が多い |

**推奨**: `MUIDataTable` のようにサーバーサイドページネーション・ソートに対応するか、または `ProjectListPage` と同様に `Table` + `Pagination` + `Select` で実装。

**MUI DataGrid の場合**:

```tsx
<DataGrid
  rows={serverItems}
  columns={columns}
  pageSizeOptions={[1, 10, 25, 50]}
  paginationMode="server"
  rowCount={totalItems}
  loading={loading}
  sortModel={sortModel}
  onSortModelChange={handleSortChange}
  onPageSizeChange={(newSize) => setItemsPerPage(newSize)}
  onPageChange={(newPage) => setPage(newPage)}
  columnBuffer={10}
  sx={{
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: '#3399b3',
      color: 'white',
      fontSize: '10px',
    },
    '& .MuiDataGrid-cell': {
      fontSize: '10px',
      padding: '4px',
      whiteSpace: 'nowrap',
    },
  }}
/>
```

### 7.4 ソート処理（React 側）

```typescript
// デフォルトソート追加
const normalizeSortBy = useCallback((sortBy: SortModel) => {
  const base = [...sortBy];
  const defaultSortKeys = new Set(['i_box_w', 'i_box_h', 'i_box_d']);
  defaultSortKeys.forEach((key) => {
    if (!base.some((s) => s.field === key)) {
      base.push({ field: key, sort: 'asc' as const });
    }
  });
  return base;
}, []);
```

### 7.5 既存 picasso_apps との整合性

| 項目 | picasso_apps 側 | BoxList 移行後 |
| --- | --- | --- |
| `input.cabinfo` の構造 | 既にある | BoxFilterDialog が `cabinfo` を更新 |
| `layout.boxH` | 既にある | `layout.boxH` をフィルターに使用 |
| `layout.floor` | 既にある | 各列のセットからオプションを生成 |
| `config.CabinetinfoOption` | `useConfigStore` で取得 | BoxFilterDialog で読み取り |
| `layout.ulf` | 既にある | `postLayout2Gtr` で更新 |
| `layout.box` | 既にある | 選定箱を保存 |
| `layout.boxcode` | 既にある | "確定" + code を設定 |
| `layout.nrow` | 既にある | `i_NRow` フィルターに使用 |
| `layout.layout` | 既にある | `l` パラメータとして送信 |
| `layout.boxg` | 既にある | `g` パラメータとして送信 |

---

## 8. データフロー図

```
[UserLocation] ────▶ [BoxListPage]
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              [BoxFilter ]  [BoxList  ] [API]
              Dialog      Table     呼び出し
                    │         │         │
                    │         │    POST
                    │         │   /api/
                    │         │ postAny
                    │         │ CollByPage
                    │         │
                    │         ▼
                    │    [サーバー]
                    │         │
                    │    JSON (箱データ)
                    │         │
                    │         ▼
                    │    [serverItems]
                    │         │
                    │         ▼ (選択ボタン)
                    │    [goToSelect]
                    │         │
                    │    POST /api/
                    │    postLayout2Gtr
                    │         │
                    │    返答 (ulf)
                    │         │
                    │         ▼
                    │    [layout.ulf]
                    │    [layout.box]
                    │    [layout.boxcode]
                    │         │
                    ▼         ▼
              [UserLocation] ◀─── router.push
```

---

## 9. 注意点・移行時の確認事項

### 9.1 Vue ↔ React の違い

| 項目 | Vue | React 移行 |
| --- | --- | --- |
| リアクティブ更新 | `v-model` / `watch` | `useState` / `useEffect` |
| 連動処理 | 3つの watch | 1つの useEffect で依存配列 |
| selectData | `computed` で取得 | `useMemo` で取得 |
| ストア | `useAppStore()`（pinia） | `useAppStore`（zustand）→ `getState()` |
| ダイアログ | `v-dialog v-model` | `Dialog` の `open` prop |
| テーブル | `v-data-table-server` | 新規実装（DataGrid or Table） |
| カラーピッカー | 子コンポーネント → emit | 子コンポーネント → `onColorSelected` prop |

### 9.2 既知の挙動

1. **floor フィルターの重複**: `layout.floor` と `cabinfo.floor1` の両方が設定された場合、`cabinfo.floor1` の値が優先（後から代入）

2. **i_box_h の特殊処理**: `boxheight` が null の場合は `$gte: layout.boxH` で下限指定、値がある場合は固定値

3. **list_support_height**: 数値を文字列に変換して送信（`String(supporth)`）

4. **ソート優先**: デフォルトソートキーがユーザーソートに含まれていない場合は末尾追加

5. **selectData の fallback**: `purpose2` が存在しない場合 `default` や `['']` にフォールバック

6. **hasCombination（Vue 側）**: `selectData` が null の場合や必要なキーが不足している場合に赤文字で「（組み合わせなし）」を表示
