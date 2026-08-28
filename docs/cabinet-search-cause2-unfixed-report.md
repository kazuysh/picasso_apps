# 筐体検索不具合 原因2 未修正レポート

## ステータス

**未修正**

## 対象事象

筐体情報編集画面で「設備用途2」を変更して保存しても、回路・配置生成時の自動筐体選定および結果画面の箱選定一覧に、その条件が反映されない。

## 原因

筐体情報編集画面では、設備用途2を `input.cabinfo.format3` として保存している。

箱データ側には対応する検索項目として `box_purpose2` があり、箱選定一覧にも「設置用途2」として表示される。しかし、現在の検索フィルター生成処理では、次の対応付けが実装されていない。

```ts
filter.box_purpose2 = cabinfo.format3
```

そのため、`format3` はストアに保存されるものの、`POST /api/postAnyCollByPage` の `filter` に含まれない。

## 影響箇所

同じフィルター欠落が2か所に存在する。

### 1. 回路・配置生成時の自動筐体選定

- `src/pages/GenerationRunnerPage.tsx`
- `ensureBoxSelected()` 内の検索フィルター生成処理

この経路では、設備用途1の `cabinfo.format2` は `box_purpose` に設定されるが、設備用途2の `cabinfo.format3` は設定されない。

### 2. 結果画面の箱選定一覧

- `src/components/project/BoxListDialog.tsx`
- `buildBoxFilter()`

この経路でも同様に、`box_purpose2` が検索フィルターへ設定されない。

## 影響

- 設備用途2を変更しても検索結果が変化しない。
- 設備用途1まで同じで設備用途2だけが異なる箱が複数存在する場合、意図しない箱が候補または自動選定結果になる可能性がある。
- 自動筐体選定と手動の箱選定一覧の両方で同じ問題が発生する。
- 画面上では設備用途2を入力・保存できるため、利用者には検索条件として反映されたように見える。

## 再現手順

1. 筐体情報編集画面を開く。
2. 設置場所と設備用途1を選択する。
3. 設備用途2を選択して保存する。
4. 「回路・配置生成」を実行する、または結果画面から箱選定一覧を開く。
5. `POST /api/postAnyCollByPage` のリクエストを確認する。
6. `filter.box_purpose2` が含まれていないことを確認する。

## 修正案

両方の検索経路に、空値を除外したうえで次の条件を追加する。

```ts
if (hasValue(cabinfo.format3)) {
  filter.box_purpose2 = cabinfo.format3
}
```

自動筐体選定側には現在 `hasValue()` と同等の統一的な空値判定がないため、共通の検索フィルター生成関数へ集約することが望ましい。

推奨する対応は次のとおり。

1. `cabinfo` と `layout` から箱検索フィルターを生成する共通関数を作成する。
2. `GenerationRunnerPage` と `BoxListDialog` の両方で共通関数を使用する。
3. `format3` が設定されている場合に `box_purpose2` が生成される単体テストを追加する。
4. 空文字の場合は `box_purpose2` を生成しないことをテストする。
5. 自動選定と箱選定一覧が同一のフィルターを送信することを確認する。

## 未修正とした範囲

本レポート作成時点では、原因1のみ修正済みである。原因2に関係する次のファイルには修正を加えていない。

- `src/pages/GenerationRunnerPage.tsx`
- `src/components/project/BoxListDialog.tsx`

