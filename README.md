# さわかみ投信・月次課題チェッカー

さわかみ投信の「長期投資家デビュープロジェクト」で、当月の課題アンケートを提出済みか自動確認する個人用アプリです。

Gmailに届く提出完了メールを検索し、結果をGmailとSlackへ通知します。Gmailを確認するためにスマートフォンを開く回数を減らし、提出忘れと、ほかのアプリへ注意がそれることを防ぐのが目的です。

> このアプリは個人が開発する非公式ツールであり、さわかみ投信株式会社が提供・公認するものではありません。

## 主な動作

- 毎月15日の19時台に当月の提出状況を確認し、GmailとSlackへ通知する。
- 15日に完了を確認でき、少なくとも一方への通知に成功した場合、25日は通知しない。
- 15日に未確認・確認エラー・両方の通知失敗・実行記録なしの場合、25日の19時台に再確認して通知する。
- 本人用画面から手動確認できるが、自動通知を主要な利用方法とする。
- ポートフォリオ閲覧者には、実際のGmailへ接続しないデモデータを表示する。

## 技術構成

- TypeScript
- Next.js / React
- Neon PostgreSQL
- Gmail API
- Slack Incoming Webhook
- Vercel Functions / Vercel Cron Jobs
- GitHub Actions

## 開発環境

```bash
npm install
npm run dev
```

開発サーバー起動後、`http://localhost:3000` を開きます。

型検査、Lint、テスト、コード整形、本番ビルドの確認には、次のコマンドを使用します。

```bash
npm run typecheck
npm run lint
npm run test
npm run format:check
npm run build
```

## ドキュメント

- [要求定義](docs/REQUIREMENTS.md)
- [仕様書](docs/SPEC.md)
- [設計書](docs/DESIGN.md)

## セキュリティ

Googleの認証情報、OAuthトークン、Slack Webhook URL、データベース接続情報は環境変数で管理し、リポジトリへ登録しません。
