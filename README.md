# 福島LOVE会 Webサイト

Astro製の静的サイト。Cloudflare Pagesで公開。

## ⚠️ アカウント前提

本サイトのデプロイ・運用で使うすべてのクラウドアカウント
（Cloudflare Pages / GitHub / Google関連）は**個人アカウント `hdk.ogasawara@gmail.com`** を使う。
GLOE業務アカウントは使わない。

## 技術

- [Astro](https://astro.build/) — 静的サイトジェネレータ
- [Leaflet](https://leafletjs.com/) + OpenStreetMap — 地図（無料）
- [Facebook Embedded Posts Plugin](https://developers.facebook.com/docs/plugins/embedded-posts)
  — 各回の投稿を写真付きカードで埋め込み

## ビルド時に読み込むデータ

1. **スプレッドシート** (`https://docs.google.com/spreadsheets/d/.../export?format=csv`)
   - 「ウェブに公開」されている必要あり
   - 回/開催日/店名/食べログ/Instagram/YouTube/住所/特徴メモ/FB投稿URL
2. **`src/data/posts_by_kai.json`** — 回番号→FB投稿メタ情報
   - `scripts/fukushima-love/02_match_by_kai_number.py` が生成
3. **`src/data/geocode_cache.json`** — 住所→緯度経度
   - `scripts/fukushima-love/04_geocode.py` が生成

`src/data/` の2ファイルは**コミット対象**（Cloudflareビルド時に必要）。

## ローカル開発

```bash
npm install
npm run dev    # http://localhost:4321
npm run build  # dist/ に出力
npm run check  # TypeScriptチェック
```

初回ビルド前に最低限以下を完了しておく:
```bash
# リポジトリルートから
python scripts/fukushima-love/01_fetch_posts.py --login
python scripts/fukushima-love/01_fetch_posts.py
python scripts/fukushima-love/02_match_by_kai_number.py
python scripts/fukushima-love/04_geocode.py
```
（`03_update_sheet.py` は任意。シートに書き戻さなくても `posts_by_kai.json` からビルド可能）

## 新規開催追加手順

スプレッドシートに新しい回を入力しただけでは、**Facebook投稿のメタ情報や写真は自動ではサイトに反映されない**。以下の手順でデータを更新し、GitHubにpushする必要がある。

### 前提：GitHub認証（SSHキー）

このPCからGitHubにpushするには、初回にSSHキーを生成・登録する必要がある。

```bash
# 1. SSHキー生成（このPCで1回だけ）
ssh-keygen -t ed25519 -C "hdkoga@github" -f ~/.ssh/id_ed25519 -N ""

# 2. 公開鍵を表示 → https://github.com/settings/keys に登録
cat ~/.ssh/id_ed25519.pub
```

別のPCで既にpushしていた場合、このPCには認証情報がないため、同じ手順が必要になる。

### 全体像

```
[飲み会開催]
    ↓
[スプレッドシートに新規行を入力]
    ↓
[FBグループに投稿]
    ↓
[01_fetch_posts.py] ← FB投稿を取得・更新
    ↓
[02_match_by_kai_number.py] ← 回番号とFB投稿を紐付け
    ↓
[04_geocode.py] ← 新規住所の緯度経度を取得（既存ならスキップ可）
    ↓
[05_download_photos.py --kai {回番号}] ← FB投稿写真をダウンロード
    ↓
[git add / commit / push] → origin/main
    ↓
[Cloudflare Pages: 自動ビルド]
    ↓
[公開URL で最新反映]
```

### Step A: FB投稿の取得（新規投稿がある場合）

```bash
# リポジトリルートから
python scripts/fukushima-love/01_fetch_posts.py --since {YYYY-MM-DD}
# ※FBセッション切れの場合は --login を付けて手動ログイン
```

### Step B: 回番号とFB投稿を紐付け

```bash
python scripts/fukushima-love/02_match_by_kai_number.py
```

出力された `src/data/posts_by_kai.json` を確認し、新しい回の `post_url` や `text_snippet` が正しく入っているかチェックする。手動修正が必要な場合は直接JSONを編集してよい。

### Step C: ジオコーディング（新規住所がある場合）

```bash
python scripts/fukushima-love/04_geocode.py
```

既にキャッシュに存在する住所はスキップされる。失敗した住所は手動で `src/data/geocode_cache.json` に追加するか、正確な住所に修正して再実行する。

### Step D: 写真のダウンロード

```bash
# 特定の回だけ
python scripts/fukushima-love/05_download_photos.py --kai {回番号}

# 未処理の回をすべて
python scripts/fukushima-love/05_download_photos.py --resume
```

### Step E: コミット＆push

```bash
git add src/data/posts_by_kai.json src/data/photos_manifest.json public/photos/{回番号}/
git commit -m "feat: 第{回番号}回 {店名} を追加"
git push origin main
```

push後、Cloudflare Pagesが自動的に再ビルドする（通常1〜3分）。

## デプロイ手順（Phase C）

### 全体像

**スプレッドシートのみ変更した場合（開催日・店名・住所等の修正）:**
```
[Googleスプレッドシート更新]
       ↓
[Apps Script: 時間トリガー (個人アカウント)]
       ↓
[Cloudflare Pages Deploy Hook 呼び出し]
       ↓
[Cloudflare Pages: GitHubリポジトリをビルド]
       ↓
[公開URL で最新反映]
```

**新しい回を追加した場合（FB投稿・写真も必要）:**
```
[スプレッドシートに新規行入力] + [FBグループに投稿]
       ↓
[01_fetch_posts.py → 02_match_by_kai_number.py → 05_download_photos.py]
       ↓
[git commit & push origin main]
       ↓
[Cloudflare Pages: GitHubリポジトリをビルド]
       ↓
[公開URL で最新反映]
```

※スプレッドシート更新だけでは、`posts_by_kai.json` や `photos_manifest.json` は更新されない。新規開催を追加する際は必ず「新規開催追加手順」を実行すること。

### Step 1: スプレッドシートを「ウェブに公開」

個人アカウントで開いたスプレッドシートで:

1. `ファイル → 共有 → ウェブに公開`
2. リンクタブで **「シート1」 + 「カンマ区切り形式 (.csv)」** を選択
3. 「公開」クリック
4. 発行されたURLが `https://docs.google.com/spreadsheets/d/e/xxxx/pub?gid=0&single=true&output=csv` 形式なら問題なし

### Step 2: GitHubリポジトリ作成（個人アカウント）

個人GitHubで新規リポジトリ作成（例: `fukushima-love-kai-site`）。
`sites/fukushima-love/` 配下を新規リポジトリ化するのが綺麗。

### Step 3: Cloudflare Pages 連携

https://pages.cloudflare.com/ に**個人アカウント**でサインアップ/ログイン（無料）。

1. `Create a project → Connect to Git`
2. GitHub認証（個人アカウント）
3. Step 2 で作ったリポジトリを選択
4. ビルド設定:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory (モノレポの場合): `sites/fukushima-love`
5. `Save and Deploy`

数分でビルド完了 → `https://fukushima-love-kai-xxxx.pages.dev` で公開される。

### Step 4: Deploy Hook 発行

Cloudflare Pages プロジェクトの:
1. `Settings → Builds & deployments → Deploy hooks`
2. `Add deploy hook` → Name: `sheet-update` / Branch: `main`
3. 発行された `https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/xxxxx` をコピー

### Step 5: Apps Script 設定

個人アカウントでスプレッドシートを開き:

1. `拡張機能 → Apps Script`
2. `scripts/fukushima-love/deploy-hook-trigger.gs` の中身を貼り付け
3. `プロジェクト設定（歯車）→ スクリプトプロパティ → 追加`
   - プロパティ: `DEPLOY_HOOK_URL`
   - 値: Step 4 でコピーしたURL
4. 関数 `triggerDeploy` を選択して「実行」→ 権限承認
5. `トリガー（時計アイコン）→ トリガーを追加`
   - 実行する関数: `triggerDeployScheduled`
   - イベントソース: 時間主導型
   - 時間間隔: **1時間ごと**

これで**シート更新の1時間以内**に自動でサイトが再ビルドされる。
即時反映が必要ならStep 5-5で `onEditHandler` を「スプレッドシートから - 編集時」で追加（5分デバウンス付き）。

### Step 6: Google Form 作成（投票）

個人アカウントで https://forms.google.com/ :

1. `空白のフォーム` 作成、タイトル `福島LOVE会 次回候補店の提案`
2. 質問: 店名（必須）/ 住所またはURL / 福島との関係 / 提案者 / 補足コメント
3. 右上「送信」→ `<>` アイコン（埋め込み） → iframeコードの **src** 属性をコピー
4. `src/lib/sheet.ts` の `VOTE_FORM_EMBED_URL` に設定
5. 回答タブ（スプレッドシート連携）をオリジナルのスプレッドシートに作成
6. その回答タブを**ウェブに公開（CSV）** → 発行URLを `VOTE_RESPONSES_CSV_URL` に設定
7. コミット & push → Cloudflareが再ビルド

### Step 7: FBグループでの周知

Facebookグループのお知らせにサイトURLを固定。

### トラブルシューティング

**サイトが更新されない**
1. シート更新後、Apps Script のトリガー実行履歴を確認
2. Cloudflare Pages の Deployments タブで最新ビルドのログを確認
3. 手動で Deploy Hook を curl で叩いて確認:
   ```bash
   curl -X POST "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/xxxxx"
   ```

**FB投稿の埋め込みが表示されない**
- 投稿が公開されているか確認（グループの公開設定に従う）
- アドブロッカーがFB SDKをブロックしていないか確認

**地図にピンが表示されない**
- `src/data/geocode_cache.json` が空なら `04_geocode.py` を実行
- 失敗住所は手動で `{"lat": ..., "lon": ..., "status": "ok"}` を追加

**GitHub pushができない（Permission denied / 403）**
- このPCにSSH秘密鍵がない可能性がある。`ls ~/.ssh/id_*` で確認
- 鍵がない場合は「新規開催追加手順 → 前提：GitHub認証（SSHキー）」の手順で生成・登録
- 別のPCでpushしていた場合、このPCには認証情報がないため、同じ設定が必要

## 構成

```
sites/fukushima-love/
├── src/
│   ├── pages/
│   │   ├── index.astro        # トップ（ヒーロー + 直近 + マップ + 候補）
│   │   ├── events/
│   │   │   ├── index.astro    # 全開催リスト（検索可）
│   │   │   └── [kai].astro    # 各回詳細（FB埋め込み + 地図 + 近隣店）
│   │   ├── map.astro          # 全店マップ
│   │   ├── vote.astro         # 次回候補の投票 + 候補一覧
│   │   └── about.astro
│   ├── components/
│   │   ├── EventCard.astro
│   │   ├── MapView.astro      # Leafletクライアントサイド初期化
│   │   └── VoteForm.astro
│   ├── layouts/Base.astro     # 共通レイアウト + FB SDK読み込み
│   ├── lib/
│   │   ├── sheet.ts           # 公開CSV取得 + 型定義
│   │   └── data.ts            # シート + posts_by_kai + geocode の結合
│   ├── data/                  # ビルド入力JSON（コミット対象）
│   │   ├── posts_by_kai.json
│   │   └── geocode_cache.json
│   └── styles/global.css
├── astro.config.mjs
├── package.json
└── tsconfig.json
```
