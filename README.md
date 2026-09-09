# さわかみ投信・月次課題チェッカー

[![CI](https://github.com/Kenichi585-sys/sawakami-task-checker/actions/workflows/ci.yml/badge.svg)](https://github.com/Kenichi585-sys/sawakami-task-checker/actions/workflows/ci.yml)

さわかみ投信の「長期投資家デビュープロジェクト」で、当月の課題アンケートを提出済みか自動確認する個人用アプリです。

Gmailに届く提出完了メールを検索し、結果をGmailとSlackへ通知します。Gmailを確認するためにスマートフォンを開く回数を減らし、提出忘れと他のアプリへ注意がそれることを防ぐのが目的です。

> このアプリは個人が開発する非公式ツールであり、さわかみ投信株式会社が提供・公認するものではありません。

## 公開デモ

[公開デモを開く](https://sawakami-task-checker.vercel.app/)

トップページでは、ポートフォリオ閲覧者が外部サービスとの連携なしで動作イメージを確認できます。「今すぐ確認（デモ）」を押しても、実際のGmail検索や通知は行いません。

実際のメールアドレス、OAuthトークン、Webhook URL、提出状況は公開画面やソースコードへ含めていません。

## 主な動作

- 毎月15日の19時台に当月の提出状況を確認し、GmailとSlackへ通知する。
- 完了メールが見つかった場合は、提出済みであることと受信日時を通知する。
- Gmailの確認に成功しても完了メールがない場合は「未確認」、API取得に失敗した場合は「確認エラー」として区別する。
- 15日に完了を確認でき、少なくとも一方への通知に成功した場合、25日は処理しない。
- 15日に未確認・確認エラー・両通知失敗・実行記録なしの場合、25日に再確認して通知する。
- 対象年月と実行日を主キーとして記録し、Cronの重複呼び出しによる二重通知を防ぐ。

## 処理の流れ

```text
Vercel Cron
    ↓
Next.js Route Handler ── CRON_SECRETを検証
    ↓
当月のGmailを検索 ── 完了 / 未確認 / 確認エラーを判定
    ↓
Gmail通知 + Slack通知 ── 片方が失敗しても他方を続行
    ↓
Neon PostgreSQLへ判定結果と通知成否を保存
```

## 技術上のポイント

- 対象期間を日本時間の「当月1日以上、翌月1日未満」として計算し、前年同月や前月のメールを除外する。
- Gmail APIのaccess token更新はGoogle Auth Libraryへ任せ、refresh tokenなどの秘密情報は環境変数で管理する。
- 判定処理、Gmail、Slack、データベースを分離し、外部サービスの一部障害で全結果を失わないようにする。
- 外部APIへ接続しない公開デモと、サーバー側の実処理を分離する。
- GitHub Actionsでコード形式、型、Lint、テスト、本番ビルドを自動確認する。

## 技術構成

- TypeScript 5
- Next.js 16 / React 19
- Neon PostgreSQL
- Gmail API / Google OAuth 2.0
- Slack Incoming Webhook
- Vercel Functions / Vercel Cron Jobs
- Vitest / Testing Library
- GitHub Actions

Node.jsはローカルとCIで24.15.0を使用します。Vercelでは同じメジャーバージョンの最新修正版となる24.xを使用します。

## ローカルでの起動

必要なNode.jsバージョンへ切り替え、依存パッケージをインストールします。

```bash
nvm use
npm ci
```

`.env.example`を参考に、Gitへ登録されない`.env.local`へ本人用の設定値を保存します。

```bash
npm run dev
```

開発サーバー起動後、`http://localhost:3000`を開きます。

## 品質確認

```bash
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run build
```

## 現在の範囲

応募用MVPとして、公開デモ、Gmail検索・送信、Slack通知、定期確認、データベース保存、自動テストを実装しています。

本人用の手動確認画面と画面認証は今回の公開範囲に含めていません。また、Google OAuthをTestingからIn productionへ移行して長期運用する設定は、公開デモとは分けて今後行います。

## ドキュメント

- [要求定義](docs/REQUIREMENTS.md)
- [仕様書](docs/SPEC.md)
- [設計書](docs/DESIGN.md)

## セキュリティ

Googleの認証情報、OAuthトークン、Slack Webhook URL、データベース接続情報、Cron認証情報は環境変数で管理し、リポジトリへ登録しません。公開画面は固定したサンプルデータだけを使用します。
