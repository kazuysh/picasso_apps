# 機器追加/編集ダイアログ設計

## 目的

`docs/edit-device-device-dialog-spec.md` の Vue 仕様を、React 側の `BlockListDialog` から呼び出せる機器追加/編集ダイアログとして設計する。

対象は、選択中のユニット内ブロックに対して以下を行う画面である。

- 現在の `default_device` を編集可能な機器一覧として表示する
- ブロックとフェーズに紐づく追加候補を検索・絞り込み・複数選択する
- 選択候補を機器一覧へ追加する
- 数量変更、転置、削除、空白追加を行う
- 保存時に `default_device` を `{deviceName}@{sizeCode}#{quantity}` の `string[]` に統一して親へ返す

## 配置方針

React では次のコンポーネント境界にする。

| 役割 | ファイル案 | 責務 |
| --- | --- | --- |
| 親画面 | `src/components/project/BlockListDialog.tsx` | SVG/ブロック選択、対象 device record の特定、保存結果の store 反映 |
| 子ダイアログ | `src/components/project/DeviceAddEditDialog.tsx` | 機器候補検索、列フィルタ、選択、編集 UI、保存 payload 作成 |

`BlockListDialog` の下段機器一覧にある `機器/追加編集` ボタンから `DeviceAddEditDialog` を開く。

ブロック未選択時は `機器/追加編集` ボタンを disabled にし、API を呼ばない。

## 親から渡す props

```ts
type DeviceAddEditDialogProps = {
  open: boolean;
  unitBlock: {
    unitId?: number | string;
    blockNo?: string;
    subunitNo?: string;
    phase?: string;
  };
  devices: string[];
  onClose: () => void;
  onSave: (nextDefaultDevices: string[]) => void;
};
```

`devices` は対象 device record の `default_device` を渡す。`default_device` が空で `over_device` だけ存在する場合は、親側で `over_device` を初期編集値として渡してよい。ただし保存先は常に `default_device` とする。

## データモデル

### 編集用機器行

```ts
type EditableDevice = {
  id: string;
  name: string;
  sizeCode: string;
  quantity: number;
  raw: string;
};
```

### 候補テーブル

```ts
type TableHeader = {
  title: string;
  key: string;
  sortable?: boolean;
  [key: string]: unknown;
};

type DeviceCandidate = {
  no: string | number;
  devicename: string;
  selectable?: boolean;
  [key: string]: unknown;
};
```

### API 追加結果

```ts
type AddedDevice = {
  name: string;
  n: number;
  [key: string]: unknown;
};
```

`AddedDevice.name` は `@` を含む場合と含まない場合がある。保存時に `@` がなければ現行仕様どおり `@11` を補完する。

## 変換ルール

### `string` から編集行

入力形式:

```text
{deviceName}@{sizeCode}#{quantity}
```

変換:

| 入力 | 出力 |
| --- | --- |
| `PNX51T@11#1` | `{ name: "PNX51T", sizeCode: "11", quantity: 1 }` |
| `PNX51T#2` | `{ name: "PNX51T", sizeCode: "11", quantity: 2 }` |
| `PNX51T@11` | `{ name: "PNX51T", sizeCode: "11", quantity: 1 }` |

`#` がない場合は `quantity = 1`。`@` がない場合は `sizeCode = "11"`。

### 編集行から `default_device`

```ts
function serializeDevice(device: EditableDevice) {
  const nameWithSize = device.name.includes("@")
    ? device.name
    : `${device.name}@${device.sizeCode || "11"}`;

  return `${nameWithSize}#${Number.isFinite(device.quantity) ? device.quantity : 1}`;
}
```

保存結果は必ず `string[]` にする。

## UI 構成

ダイアログ最大幅は `1000px` 相当、タイトルは `機器/追加編集`。

### ヘッダー

- タイトル: `機器/追加編集`
- サブ情報: `block`, `subunit`, `phase`
- 閉じるアイコン

### 現在の機器一覧

上部に現在編集中の機器を表示する。

| 列 | UI | 挙動 |
| --- | --- | --- |
| 機器コード | text | `name` を表示 |
| 大きさ | text/select | `sizeCode` を表示。初期実装は text でよい |
| 数量 | number input | 入力時に数値化。空または不正値は保存時に `1` |
| Actions | buttons | `転置`, `削除` |

追加ボタン:

| ボタン | 挙動 |
| --- | --- |
| 空白追加 | `space@11#1` 相当の行を追加 |
| 更新 | 現在の編集行を `default_device` 形式に変換して `onSave` |

### 追加候補エリア

下部に候補検索エリアを置く。

| UI | 表示/挙動 |
| --- | --- |
| 機器名セレクト | `/api/getBlockno2Dname` の `devicename` を表示 |
| 機器追加ボタン | 選択候補を `/api/getDeviceSizeArray` でサイズ付きリストへ変換し、現在の機器一覧へ追加 |
| 列フィルタ解除 | 1 つ以上の列フィルタがある時だけ enabled |
| Search | スペース区切り AND 検索 |
| 候補テーブル | API の `headers` と `deviceno` を表示。`no[]` で複数選択 |
| Close Dialog | 保存せず閉じる |

`機器追加` は `selectedNos.length === 0` の時 disabled にする。

## State 設計

```ts
type ColumnFilters = Record<string, string | null>;
```

| state | 内容 |
| --- | --- |
| `editableDevices` | 現在の機器一覧。`devices` prop から open 時に初期化 |
| `deviceNames` | `/api/getBlockno2Dname` の候補 |
| `selectedDeviceName` | 機器名セレクトの値 |
| `headers` | 候補テーブル列 |
| `rows` | 候補テーブル元データ |
| `selectedNos` | 選択済み `no` 配列 |
| `search` | 全文検索文字列 |
| `columnFilters` | 列別フィルタ |
| `loadingNames` | 機器名候補取得中 |
| `loadingRows` | 候補一覧取得中 |
| `adding` | 選択候補追加中 |
| `flippingId` | 転置中の編集行 id |
| `error` | ダイアログ内エラー表示 |

`filteredRows` は `rows`, `search`, `columnFilters` から `useMemo` で派生させる。

## API フロー

### 1. ダイアログ open

条件:

- `open === true`
- `unitBlock.blockNo` が存在する

処理:

1. `devices` を `editableDevices` に変換
2. `GET /api/getBlockno2Dname?b={blockNo}`
3. `deviceNames` をセット
4. `selectedDeviceName`, `headers`, `rows`, `selectedNos`, `search`, `columnFilters` を初期化

### 2. 機器名選択

```http
GET /api/getBlock2dno?b={blockNo}&d={deviceName}&p={phase}
```

成功時:

- `headers` 更新
- `rows` 更新
- `selectedNos` クリア
- `search` クリア
- `columnFilters` 全解除

### 3. 候補追加

`selectedNos` に一致する行の `devicename` をカンマ区切りにする。

```http
GET /api/getDeviceSizeArray?b={blockNo}&p={phase}&da={deviceNames}
```

成功時:

1. `response.data.devicelist` を `EditableDevice[]` に変換
2. `editableDevices` の末尾へ追加
3. `selectedNos` をクリア

この時点ではダイアログを閉じない。最終保存は `更新` ボタンで行う。旧仕様と同じ「追加即保存」に寄せる必要が出た場合は、追加成功後に `onSave()` を呼ぶだけで切り替え可能にする。

### 4. 転置

```http
GET /api/getFlipDeviceOnBlock?block={blockNo}&device={deviceNameWithSize}
```

成功時:

- 対象行の `name` と `sizeCode` をレスポンスの `device` から再分解して更新

保存は `更新` ボタンで行う。

### 5. 保存

1. `editableDevices.map(serializeDevice)` で `string[]` を作る
2. `onSave(nextDefaultDevices)` を呼ぶ
3. 親が対象 record の `default_device` を更新する
4. 必要なら親が配置確認 API へ渡す `Device` も同じ `string[]` に更新する
5. ダイアログを閉じる

## 親側保存処理

`BlockListDialog` 側で対象 record を次の条件で特定する。

```ts
record.id === unitBlock.unitId
record.block === unitBlock.blockNo
record.unit === unitBlock.subunitNo
```

`subunitNo` が取得できない場合のみ、既存の `rowMatchesBlockSelection()` と同じく `blockNo` 一致を許容する。

更新内容:

| 更新先 | 値 |
| --- | --- |
| `target.default_device` | `nextDefaultDevices` |
| `target.over_device` | 原則変更しない |
| `target.select_device` | 原則変更しない |

配置確認用 payload を作る場合:

```ts
type PlacementPayload = {
  id: number | string;
  q: {
    subunit_no: string;
    block_no: string;
  };
  Device: string[];
  d: "-" | "h" | "v";
};
```

## Disabled / Empty 状態

| 状態 | UI |
| --- | --- |
| ブロック未選択 | `機器/追加編集` disabled |
| `blockNo` なしで open | API 呼び出しせず error 表示 |
| 機器名未選択 | 候補テーブルは空、`機器追加` disabled |
| 候補行未選択 | `機器追加` disabled |
| 編集行なし | 現在の機器一覧に「機器がありません」表示 |
| API error | Dialog 内に `Alert severity="error"` |

## 実装順序

1. `DeviceAddEditDialog.tsx` を追加し、props と編集行変換だけ実装
2. `BlockListDialog` の `機器/追加編集` ボタンで open/close する
3. `GET /api/getBlockno2Dname` と機器名セレクトを実装
4. `GET /api/getBlock2dno` と候補テーブル、検索、列フィルタを実装
5. `GET /api/getDeviceSizeArray` で候補追加を実装
6. 数量変更、削除、空白追加を実装
7. `GET /api/getFlipDeviceOnBlock` で転置を実装
8. `onSave` で `default_device` を更新し、既存の下段機器一覧へ即反映する

## テスト観点

- ブロック未選択時に `getBlockno2Dname` が呼ばれない
- open 時に `default_device` が編集行へ正しく分解される
- `@` なし、`#` なしの機器文字列でも `@11` と数量 `1` が補完される
- 機器名変更時に候補テーブル、検索、列フィルタ、選択状態が初期化される
- 全文検索がスペース区切り AND 条件で動く
- 列フィルタと全文検索が AND 条件で合成される
- `selectedNos` は行 index ではなく `no` で管理される
- `selectable === false` の行は選択できない
- 候補追加で `devicename` カンマ区切りが `da` に渡る
- 更新時に `default_device` が `{name}@{size}#{quantity}` の `string[]` になる
- 転置後に対象行だけが更新される
- 削除、空白追加、数量変更後に保存結果が下段機器一覧へ反映される
