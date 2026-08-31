# 鉄道路線プランナー

駅を自分の好きな順番に並べて、一日の鉄道旅程を組み立てるWebアプリ。
一般的な乗換案内が出発地と目的地から経路を決めるのに対して、こちらは
「名古屋 → 大阪難波 → 吉野 → 名古屋」のように**通りたい駅を自分で並べる**のが狙い。

APIキー不要・完全無料で動くデモ版（Phase 1）まで完成している。

## フォルダ構成

| 場所 | 中身 |
| --- | --- |
| [`rail-route-builder/`](rail-route-builder/) | アプリ本体（React + TypeScript + Vite）。**使い方はこの中のREADME** |
| [`rail-route-builder_design.md`](rail-route-builder_design.md) | 設計書（仕様の正本） |
| [`rail-route-builder_claude-prompt.md`](rail-route-builder_claude-prompt.md) | 実装をAIへ依頼するときの指示文 |
| `artifacts/` | 作業完了時のサマリー（HTML） |

## 起動

```bash
cd rail-route-builder
npm install
npm run dev
```

Windowsなら `rail-route-builder/起動.bat` をダブルクリックでも起動する。

## できること

- 全画面の地図から駅をタップして旅程に追加（全国約8,700駅）
- 線路を新幹線・JR・私鉄など**7種で色分け**し、種別ごとに表示を切り替え
- 旅程の線は**実際の線路をなぞって**描画（線路網のグラフ上で最短経路を探索）
- 駅の並べ替え、途中駅の滞在時間の設定
- 滞在時間を踏まえた区間ごとの時刻の連鎖計算、便の選択と後続区間の再計算
- プランの端末内保存・読込

**時刻と運賃は架空のデモデータ**（MockProvider）。実データ提供元は `TransitProvider`
インターフェースの差し替えで対応できる構造にしてある。

## データの出典

| データ | 出典 |
| --- | --- |
| 地図タイル・駅 | © OpenStreetMap contributors（ODbL） |
| 線路 | 「国土数値情報（鉄道データ）」（国土交通省）を加工して作成 |

いずれも表示が利用条件のため、画面のクレジット表記を消さないこと。
