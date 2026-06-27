# EditDevice 機器/追加編集ダイアログ仕様

## 目的

`src/pages/EditDevice.vue` から呼び出される `src/components/DeviceList.vue` の「機器/追加編集」ダイアログ仕様を、React 移行先で参照できる形に整理する。

このダイアログは、選択中のブロックとフェーズに対して追加可能な機器を検索・絞り込み・選択し、親画面のブロック別機器リストへ追加するための UI である。追加後は親画面側で `default_device` を更新し、配置確認ダイアログ `DrugDrop` に渡すデータへ反映する。

## 対象ファイル

- 呼び出し元: `src/pages/EditDevice.vue`
- ダイアログ本体: `src/components/DeviceList.vue`
- 旧実装参考: `src/components/DeviceList.vue_old`
- 追加後の配置確認: `src/components/DrugDrop.vue`
- 共有ストア: `src/stores/app.js`

## 呼び出し元画面の前提

`EditDevice.vue` はルートクエリから以下を受け取る。

| 項目 | 型 | 用途 |
| --- | --- | --- |
| `UnitId` | string | `Number(UnitId)` に変換して、`formdata.input.device.list` の対象レコード検索に使う |
| `UnitKey` | string | `/api/getUnitSvgByID?u={UnitKey}` でユニット SVG を取得する |

画面初期表示時に `/api/getUnitSvgByID?u={UnitKey}` を呼び、レスポンスの `svg` を描画する。SVG 内の `rect` をクリックすると、`rect.id` を `block@subunit@index` として分解し、現在の編集対象ブロックを確定する。

クリック後、親画面は以下の状態を更新する。

| 状態 | 内容 |
| --- | --- |
| `selectedBlock` | `rect.id` の 1 要素目 |
| `selectedSubUnit` | `rect.id` の 2 要素目 |
| `selectedID` | `rect.id` の 3 要素目を数値化した値 |
| `unitBlock.block_no` | `selectedBlock` |
| `unitBlock.phase` | 選択中の `SelectPhase` |
| `parsedJson.id` | `Number(UnitId)` |
| `parsedJson.q.subunit_no` | `selectedSubUnit` |
| `parsedJson.q.block_no` | `selectedBlock` |

`formdata.input.device.list` から `id === Number(UnitId)` かつ `block === selectedBlock` のレコードを探し、`default_device` を親画面の編集テーブル `devicelist` に展開する。

`default_device` の要素は原則として次の文字列形式で扱う。

```text
{deviceName}@{sizeCode}#{quantity}
```

例:

```text
PNX51T@11#1
```

親画面の編集テーブルでは、上記文字列を以下の形に変換する。

| 表示用フィールド | 変換 |
| --- | --- |
| `name` | `#` より前の文字列 |
| `n` | `#` より後の数値。`#` がない場合は `1` |

## ダイアログ表示条件

ダイアログコンポーネントは `unitBlock` prop を受け取る。

```ts
type UnitBlock = {
  block_no?: string;
  phase?: string;
};
```

現在の Vue 実装では、アクティベータボタン押下時に `fetchdname()` を実行する。`unitBlock.block_no` が未設定の場合は `dialogDevice = false` としてダイアログを閉じる。

React 移行時は、ブロック未選択時にボタンを disabled にする、またはブロック選択を促すメッセージを出す実装にしてよい。ただし、API 呼び出しは `block_no` が確定してから行う。

## UI 仕様

ダイアログの最大幅は 1000px 相当。タイトルは `機器/追加編集`。

| UI | 表示/挙動 |
| --- | --- |
| アクティベータボタン | `機器/追加編集`。色は secondary 相当 |
| 機器名セレクト | ラベル `機器名`。候補は `/api/getBlockno2Dname` の `devicename` |
| 機器追加ボタン | 選択行を追加対象として `/api/getDeviceSizeArray` を呼ぶ |
| 列フィルタ解除ボタン | 1 つ以上の列フィルタが有効な時だけ活性 |
| 検索フィールド | ラベル `Search`。スペース区切り AND 検索 |
| 機器候補テーブル | API から返る `headers` と `deviceno` を表示。複数選択可能 |
| Close Dialog ボタン | ダイアログを閉じる |

テーブルは全件表示を初期値とし、ページサイズ選択は `All`, `10`, `20`, `50` を持つ。

## テーブル仕様

### 入力データ

`/api/getBlock2dno` のレスポンスをそのままテーブル定義に使う。

```ts
type DeviceCandidateResponse = {
  headers: TableHeader[];
  deviceno: DeviceCandidate[];
};

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

`no` は行選択のキー、`devicename` は追加 API に渡す機器名として必須。

### 行選択

行選択は `no` をキーとして管理する。Vue 実装では `v-data-table` の `v-model="selected"` と `item-value="no"` により、`selected` は選択済み `no` の配列になる。

React 実装でも同様に、選択状態は行オブジェクトではなく `no[]` として保持する。

### 全文検索

検索文字列はスペースで分割し、空文字を除外する。各キーワードは、行の全フィールド値のいずれかに大文字小文字を無視して部分一致すれば一致とする。

複数キーワードがある場合は AND 条件。

```ts
const keywords = search
  .split(' ')
  .map((value) => value.trim())
  .filter(Boolean);
```

### 列フィルタ

各列ヘッダーにフィルタメニューを表示する。候補値は、元データ `DeviceData` の対象列からユニーク値を作る。

値の正規化ルール:

| 元の値 | フィルタ表示/比較値 |
| --- | --- |
| `null` | `(空白)` |
| `undefined` | `(空白)` |
| 空文字 | `(空白)` |
| その他 | `String(value)` |

列フィルタは全文検索と AND 条件で合成する。全列のフィルタが未設定の場合は、全文検索のみで絞り込む。

## API 仕様

### ブロックに紐づく機器名一覧取得

```http
GET /api/getBlockno2Dname?b={block_no}
```

呼び出しタイミング:

- 「機器/追加編集」ボタン押下時
- `unitBlock.block_no` が存在する場合のみ

レスポンス:

```ts
type BlockDeviceNameResponse = {
  devicename: string[];
};
```

取得した `devicename` を機器名セレクトの候補にする。

### 機器名別候補一覧取得

```http
GET /api/getBlock2dno?b={block_no}&d={device_name}&p={phase}
```

呼び出しタイミング:

- 機器名セレクト `SelectDname` が変更され、値が存在する時

レスポンス:

```ts
type DeviceCandidateResponse = {
  headers: TableHeader[];
  deviceno: DeviceCandidate[];
};
```

取得後の初期化:

- `headers` をテーブルヘッダーへ反映
- `deviceno` を元データへ反映
- 選択行 `selected` を空にする
- 検索文字列 `search` を空にする
- 列フィルタを全解除する
- フィルタ適用後データを更新する

### 選択機器のサイズ付きリスト取得

```http
GET /api/getDeviceSizeArray?b={block_no}&p={phase}&da={device_names}
```

`device_names` は、選択済み `no` に一致する行の `devicename` をカンマ区切りで連結した文字列。

レスポンス:

```ts
type DeviceSizeArrayResponse = {
  devicelist: AddedDevice[];
};

type AddedDevice = {
  name: string;
  n: number;
  [key: string]: unknown;
};
```

成功時:

- `add-device` イベントで `response.data.devicelist` を親へ渡す
- ダイアログを閉じる

現行実装では、選択行が 0 件でも API を呼ぶ可能性がある。React 移行時は、未選択時は「機器追加」ボタンを disabled にするか、API 呼び出し前に return する実装が望ましい。

### 機器転置

親画面の編集テーブルにある `転置` ボタンから呼ぶ。

```http
GET /api/getFlipDeviceOnBlock?block={block_no}&device={device_name}
```

レスポンス:

```ts
type FlipDeviceResponse = {
  device: string;
};
```

成功時は対象行の `name` を `device` で置き換え、親画面の `updateDeviceList()` を実行する。

### 配置確認

親画面の `updateDeviceList()` 実行後、配置方向に応じて `DrugDrop` の処理を呼ぶ。

```http
POST /api/postUnitSvgByID
```

リクエストボディ:

```ts
type PostUnitSvgByIdPayload = {
  id: number;
  q: {
    subunit_no: string;
    block_no: string;
  };
  Device: string[];
  d: '-' | 'h' | 'v';
};
```

配置方向:

| 画面表示 | 値 | 呼び出し |
| --- | --- | --- |
| デフォルト | `-` | `fetchSvgD()` |
| 配置（横） | `h` | `fetchSvgH()` |
| 配置（縦） | `v` | `fetchSvgV()` |

## 親画面へのイベント連携

`DeviceList.vue` は次のイベントを emit する。

```ts
type DeviceListEvents = {
  'add-device': (devices: AddedDevice[]) => void;
};
```

親画面の受け取り処理:

```ts
function handleAddDevice(newDevice: AddedDevice[]) {
  devicelist.push(...newDevice);
  parsedJson.Device = devicelist;
  updateDeviceList();
}
```

注意: `handleAddDevice()` 内で一時的に `parsedJson.Device` へ `AddedDevice[]` を代入しているが、直後の `updateDeviceList()` で `string[]` に置き換わる。React 移行時は `parsedJson.Device` の型を `string[]` に統一し、一時的な異型代入を避ける方が安全。

## 親画面の保存形式

`updateDeviceList()` は `devicelist` を `default_device` 用の文字列配列へ変換する。

```ts
const defaultDevice = devicelist.map((device) => {
  const baseName = device.name.includes('@')
    ? device.name
    : `${device.name}@11`;

  return `${baseName}#${device.n}`;
});
```

更新対象は `formdata.input.device.list` のうち、以下に一致する 1 レコード。

```ts
record.id === Number(UnitId) && record.block === selectedBlock
```

更新内容:

| 更新先 | 値 |
| --- | --- |
| `target.default_device` | 変換後の `string[]` |
| `parsedJson.Device` | `target.default_device` |

`name` に `@` が含まれない場合、現行仕様では `@11` を補完する。

## 追加・編集操作

| 操作 | 現行挙動 |
| --- | --- |
| 機器追加 | ダイアログで選択した機器を `devicelist` へ追加し、即 `updateDeviceList()` を実行 |
| 数量変更 | 親画面テーブルの `N` フィールドを編集。入力時に `parseFloat` される |
| 転置 | API で転置後の機器名を取得し、行の `name` を置換して `updateDeviceList()` を実行 |
| 削除 | 親画面テーブルから行を削除する。`default_device` 反映には別途 `更新` ボタン押下が必要 |
| 空白追加 | `space@11#1` を追加する。`default_device` 反映には別途 `更新` ボタン押下が必要 |
| 更新 | `devicelist` を `default_device` に保存し、配置確認を開く |

## React 移行時の推奨コンポーネント境界

```tsx
type DeviceAddEditDialogProps = {
  unitBlock: {
    blockNo?: string;
    phase?: string;
  };
  onAddDevice: (devices: AddedDevice[]) => void;
};
```

親画面側では、選択ブロック、選択サブユニット、フェーズ、`devicelist`、`parsedJson` 相当の配置リクエスト状態を管理する。

ダイアログ側では、以下をローカル state として持つ。

| state | 内容 |
| --- | --- |
| `open` | ダイアログ表示状態 |
| `deviceNames` | 機器名候補 |
| `selectedDeviceName` | 選択中の機器名 |
| `headers` | テーブル列定義 |
| `rows` | API から取得した元データ |
| `selectedNos` | 選択済み `no` 配列 |
| `search` | 全文検索文字列 |
| `columnFilters` | `{ [columnKey]: string | null }` |

React では `rows`, `search`, `columnFilters` から `filteredRows` を `useMemo` で派生させると、Vue 実装の `applyFilters()` と同等の挙動を保ちやすい。

## React 移行時の注意点

- API クエリは `URLSearchParams` で組み立てる。特に `device_names` はカンマ区切りのまま渡す必要があるため、エンコード後のサーバー挙動を確認する。
- `selectedNos` はテーブルライブラリの行インデックスではなく、必ず API レスポンスの `no` をキーにする。
- `/api/getBlock2dno` の `headers` は Vuetify 前提の `{ title, key }` 形式で返る。React のテーブルライブラリに合わせて `header`, `accessorKey` などへ変換する。
- `item.selectable` は Vuetify の `item-selectable="selectable"` で使われる。React 側でも行ごとの選択可否として扱う。
- `default_device` は後続 API が参照するため、保存時は `string[]` に統一する。
- `parsedJson.Device` に `AddedDevice[]` を一時代入する現行挙動は移行時に解消する。
- 現行実装は API エラーを主に `console.error` で扱う。React 側ではダイアログ内にエラーメッセージを表示する状態を追加すると操作性がよい。
- ブロック未選択、機器名未選択、行未選択の状態では、関連ボタンを disabled にするのが望ましい。

## 最小テスト観点

- ブロック未選択時に機器名 API が呼ばれないこと。
- ブロック選択後、「機器/追加編集」押下で機器名候補が表示されること。
- 機器名変更時に候補テーブル、検索、列フィルタ、選択状態が初期化されること。
- 全文検索がスペース区切り AND 条件で動くこと。
- 列フィルタと全文検索が AND 条件で合成されること。
- 行選択後、「機器追加」で `devicename` のカンマ区切りが API に渡ること。
- `add-device` 相当の callback が `devicelist` に追加され、`default_device` が `{name}@{size}#{n}` 形式で更新されること。
- `name` に `@` がない場合に `@11` が補完されること。
- 転置後、対象行の `name` と `default_device` が更新されること。
- 削除、空白追加後、「更新」押下で配置確認 API に反映されること。
