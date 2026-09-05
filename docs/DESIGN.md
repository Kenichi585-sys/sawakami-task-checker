# さわかみ投信・月次課題チェッカー 設計書

更新日: 2026-09-05  
状態: ドラフト

## 1. この文書の位置づけ

- `REQUIREMENTS.md`: なぜ作るか、誰の何を解決するか、どこまで作るかを記載する。
- `SPEC.md`: 利用者から見た動作、判定条件、通知、エラー時の挙動を記載する。
- `DESIGN.md`: その仕様をどの技術と構造で実現するかを記載する。

## 2. 技術構成

- 言語: TypeScript
- Webフレームワーク: Next.js
- UI: React
- ホスティング: Vercel
- サーバー処理: Next.js Route Handlers / Vercel Functions
- 定期実行: Vercel Cron Jobs
- メール検索・送信: Gmail API
- Slack通知: Slack Incoming Webhook
- データベース: Neon PostgreSQL
- CI: GitHub Actions
- ソースコード管理: GitHub

## 3. 推奨理由

### TypeScriptとNext.js

- 既存のReact・TypeScript学習経験を生かせる。
- 画面とサーバー側API処理を1つのリポジトリで管理できる。
- 外部API、認証、サーバー処理を含むポートフォリオを追加できる。

### FastAPIとの比較

#### 確認できる事実

- FastAPIはPythonの型ヒントとPydanticを利用し、入力検証とOpenAPIドキュメントを自動生成できるAPIフレームワークである。
- Next.jsはTypeScriptで画面を作れるだけでなく、Route HandlersでHTTPのサーバー処理も実装できる。
- 今回は一画面のUIと、少数のGmail・Slack連携処理を同じアプリで扱う。

#### 設計判断

- FastAPIは、独立したAPIを中心に開発する場合や、Python側の処理が大きい場合に有力である。
- 今回FastAPIとReactを分けると、フロントエンドとバックエンドの2構成、別々の依存関係、API通信、CORS、場合によっては別々のデプロイ設定が必要になる。
- 今回のAPIは小規模で、FastAPIの自動APIドキュメントや高度な入力検証の利点を十分に生かす場面が少ない。
- 既存のReact・TypeScript経験を生かし、画面とサーバー処理を1つの言語・リポジトリ・デプロイ先にまとめられるため、Next.jsを第一候補とする。
- この判断はFastAPIの性能や品質が劣るという意味ではなく、今回の規模と目的に対して構成を小さく保つための選択である。

### Vercel

- Next.jsの画面とサーバー処理を同じプロジェクトとして公開できる。
- Hobbyプランは個人・非商用利用向けの無料プランである。
- Cron Jobsは全プランで利用でき、Hobbyでは1日に1回以下の頻度で使用できる。
- HobbyのCronは指定した時刻から最大1時間程度の幅で実行される可能性があるが、今回の月2回の確認では大きな問題になりにくいと推測する。

### データベース

- 15日の判定結果に応じて25日の処理を変えるため、定期確認結果の永続化が必要である。
- PostgreSQLは、対象年月、確認日種別、判定結果、通知成否という構造化された記録を扱いやすい。
- Vercel MarketplaceからPostgreSQLサービスを接続すると、接続情報が環境変数としてプロジェクトへ設定される。
- NeonはVercel Marketplaceから接続でき、無料プランがある。
- 今回の保存件数は月2件以下であり、性能よりも学習価値、管理の容易さ、無料枠を重視する。

#### Neon、Supabase、Firebaseの比較

##### 確認できる事実

- NeonとSupabaseはどちらもVercel Marketplaceのネイティブ連携から利用でき、無料プランがある。
- NeonはPostgreSQLに特化したサービスで、非利用時はコンピュートを停止し、次の接続時に自動起動する。
- SupabaseはPostgreSQLに加えて、Auth、Storage、Realtime、Edge Functionsをまとめて提供する。
- Supabaseの無料プランは、1週間操作がないプロジェクトを一時停止する。
- FirebaseのCloud Firestoreは、テーブルと行ではなくコレクションとドキュメントで保存するNoSQLデータベースである。

##### 今回の設計判断

- 保存対象は定期確認記録という固定した構造であり、対象年月と確認日種別の一意制約を持たせやすいPostgreSQLを使う。
- 今回はSupabaseのStorage、Realtime、Edge Functionsを使用しない予定である。
- 月2回程度しか動かないため、無料版Supabaseの1週間の非活動による一時停止は定期処理と相性が悪い。
- Neonは休止後も接続時に自動起動するため、低頻度の定期処理に適している。
- Cloud Firestoreでも実装可能だが、今回はSQL、テーブル設計、マイグレーション、一意制約を学び、ポートフォリオで説明できることを重視する。

### GitHub Actions

- テスト、Lint、ビルド確認に利用する。
- 長期間動かす通知の唯一の実行基盤にはしない方針を推奨する。

## 4. 処理の分離

システム内部では、次の処理を独立させる。

1. 対象月の計算
2. Gmail検索
3. 検索結果から完了状態への変換
4. 画面表示用メッセージの生成
5. Gmail通知
6. Slack通知
7. 定期実行

Slack通知が失敗しても、Gmail検索結果を確認エラーへ変更しない。

## 5. Gmail検索方針

- 対象月の開始と終了を `Asia/Tokyo` で計算する。
- Gmail APIへ渡す期間はUnix時刻を使用する。
- 送信元と対象期間で候補を絞る。
- 取得したメールヘッダーの件名を、指定件名と完全一致で確認する。
- メール本文は取得または保存しない。
- 一致メールの受信日時だけを結果へ含める。

### 必要になる可能性が高いOAuthスコープ

- `gmail.readonly`: メールの検索とヘッダー確認
- `gmail.send`: Gmailから結果通知を送信

`gmail.readonly` はRestricted scope、`gmail.send` はSensitive scopeである。
個人用アプリとして審査なしで使用する場合、Googleの未確認アプリ警告が表示される可能性がある。

## 6. モード

### 本人用モード

- 実際のGmail APIを呼び出す。
- 実際のSlackとGmailへ通知する。
- 許可した本人以外は利用できない。

### 公開デモモード

- 固定したサンプルデータを使用する。
- 外部APIを呼び出さない。
- 通知を送らない。
- 個人情報を表示しない。

本人用モードと公開デモモードのURLまたは認証による切り替え方法は未決定。

### 認証とモード切り替えの推奨案

- 未ログインの閲覧者には公開デモモードを表示する。
- 画面上に本人用ログインへの入口を用意する。
- 最初のGoogleログインでは、本人確認に必要な最小限のプロフィール情報だけを許可してもらう。
- サーバー側でGoogleアカウントの変更されない識別子を、環境変数に登録した本人の識別子と照合する。
- 本人と一致した場合だけ本人用モードへ切り替え、その後にGmail検索・送信権限を許可してもらう。
- 本人以外がログインした場合はGmailへアクセスさせず、デモモードのままにするかアクセス拒否を表示する。
- ログアウト後は公開デモモードへ戻す。
- クライアント画面の表示だけでなく、Gmailを呼び出すすべてのサーバー処理でも本人確認を行う。

この方式では利用者が任意にモードを切り替えるのではなく、ログイン状態と本人確認結果からサーバーが自動判定する。

## 7. Slackの公開範囲

Incoming Webhookは、作成時に選択した1つのチャンネルへ投稿する。
そのチャンネルの参加者は投稿を閲覧できる。

他人へ見せないため、以下のいずれかを使用する。

1. 本人だけが参加する個人用Slackワークスペースの専用チャンネル
2. 本人だけが参加する非公開チャンネル

会社や他人と共有している公開チャンネルは使用しない。

### 個人用ワークスペースと非公開チャンネルの違い

- 個人用ワークスペース: Slack上に新しい独立した場所を作り、ほかの人を招待しない。ワークスペース全体の所有者と参加者が本人だけになる。
- 非公開チャンネル: 会社や知人と共有している既存ワークスペース内に作る。チャンネルへ招待された人だけが通常の画面や検索から内容を閲覧できる。

今回の推奨は個人用ワークスペースである。本人がWorkspace Primary Ownerになるため、SlackアプリやWebhookの設定権限を自分で管理しやすく、個人的な投資関連通知を仕事用ワークスペースから分離できる。

## 8. 秘密情報

以下をソースコードへ直接記載しない。

- Google OAuth Client Secret
- Google refresh token
- Slack Webhook URL
- 本人用画面の認証情報
- 必要に応じて通知先メールアドレス

VercelまたはGitHubのSecrets / Environment Variablesへ保存する。
`.env` の実ファイルはGitへ登録しない。

## 9. データ保存

定期確認結果を `scheduled_checks` テーブルへ保存する案とする。

### 保存項目

- `target_month`: 対象年月。年を含む値として保持する。
- `schedule_day`: 15または25。
- `result`: `completed`、`unconfirmed`、`error` のいずれか。
- `checked_at`: 確認処理を実行した日時。
- `completion_mail_received_at`: 完了メールの受信日時。完了以外は空とする。
- `gmail_notification_status`: Gmail通知の成否。
- `slack_notification_status`: Slack通知の成否。

`target_month` と `schedule_day` の組み合わせに一意制約を設定し、同じ定期確認の記録を重複させない。

### 25日の分岐

1. 当月15日の記録を取得する。
2. 記録の結果が `completed` で、GmailまたはSlackの少なくとも一方への通知が成功していれば処理を終了する。
3. `completed` でも両方の通知が失敗している場合、`unconfirmed`、`error`、または記録なしの場合はGmailを再検索する。
4. 現在の結果をGmailとSlackへ通知する。
5. 25日の結果を保存する。

25日の両通知が失敗した場合も追加の定期実行は設けず、データベースとVercelのログに失敗を残して終了する。

手動確認は補助機能であり、`scheduled_checks` へ保存しない。したがって、15日に未確認だった月は、その後に手動確認しても25日に自動確認と通知を行う。

## 10. テスト方針案

- 月初と翌月初の境界値テスト
- 前月メールを誤って完了扱いしないテスト
- 前年同月のメールを誤って完了扱いしないテスト
- 件名または送信元が異なるメールを除外するテスト
- 同月に一致メールが複数ある場合のテスト
- Gmail API成功、認証エラー、一時エラーのテスト
- Slack未設定、成功、失敗のテスト
- Gmail通知成功、失敗のテスト
- 一方の通知失敗が他方へ影響しないテスト
- デモモードで外部APIが呼ばれないテスト
- 秘密情報が画面やログへ出ないことの確認
- 15日が完了で少なくとも一方の通知が成功していれば25日を実行しないテスト
- 15日が完了でも両方の通知が失敗していれば25日に再確認・再通知するテスト
- 15日が未確認またはエラーなら25日に確認・通知するテスト
- 15日の記録がなければ25日に確認・通知するテスト
- 前年同月の記録で当月25日を省略しないテスト
- 手動確認結果が25日の実行要否を変更しないテスト
- 25日の両通知が失敗しても追加の定期実行を作成しないテスト

## 11. 未決事項

- 推奨技術構成を採用するか
- 本人用モードの認証方法
- 公開デモとの切り替え方法
- Gmail通知の宛先

## 12. 参照資料

- Gmail API検索: https://developers.google.com/workspace/gmail/api/guides/filtering
- Gmail APIスコープ: https://developers.google.com/workspace/gmail/api/auth/scopes
- Gmail API利用上限: https://developers.google.com/workspace/gmail/api/reference/quota
- Slack Incoming Webhook: https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/
- Vercel Functions: https://vercel.com/docs/functions
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs/manage-cron-jobs
- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Vercel Marketplace Storage: https://vercel.com/docs/marketplace-storage
- Neon on Vercel: https://vercel.com/marketplace/neon
- Neon Scale to Zero: https://neon.com/docs/introduction/scale-to-zero
- Supabase on Vercel: https://vercel.com/marketplace/supabase
- Supabase Pricing: https://supabase.com/pricing
- Cloud Firestore Data Model: https://firebase.google.com/docs/firestore/data-model
- Cloud Firestore Pricing: https://firebase.google.com/docs/firestore/pricing
- GitHub Actions: https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows
