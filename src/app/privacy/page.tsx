import type { Metadata } from "next";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "プライバシーポリシー | 月次課題チェッカー",
  description: "月次課題チェッカーにおけるGoogleユーザーデータの取り扱い",
};

const PrivacyPolicy = () => (
  <main className={styles.main}>
    <article className={styles.article}>
      <Link className={styles.backLink} href="/">
        ← トップページへ戻る
      </Link>

      <header>
        <p className={styles.eyebrow}>PRIVACY POLICY</p>
        <h1>プライバシーポリシー</h1>
        <p className={styles.updatedAt}>最終更新日：2026年9月20日</p>
      </header>

      <p className={styles.introduction}>
        月次課題チェッカー（以下「本アプリ」）は、開発者本人が利用する非公式の個人用アプリです。本アプリがGoogleユーザーデータへどのようにアクセスし、利用・保存するかを以下に示します。
      </p>

      <section className={styles.section}>
        <h2>1. アクセスするGoogleユーザーデータ</h2>
        <ul>
          <li>Gmail内で対象メールを検索するための、送信元、件名、受信日時</li>
          <li>確認結果の通知メールを送信するためのGmail送信権限</li>
        </ul>
        <p>
          メール本文は取得・保存しません。検索時に使用したメッセージIDも保存しません。
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. データの利用目的</h2>
        <p>
          対象月の課題アンケート完了メールが届いているかを判定し、その結果を開発者本人のGmailおよびSlackへ通知する目的に限って利用します。広告、販売、信用評価などには利用しません。
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. 保存する情報と保存場所</h2>
        <ul>
          <li>
            Google
            OAuthのクライアント情報、リフレッシュトークン、通知元・通知先メールアドレスは、ローカル開発環境の
            <code>.env.local</code>
            およびVercelの環境変数として保存します。これらはソースコードやGitリポジトリには保存しません。
          </li>
          <li>
            対象年月、確認日、判定結果、確認日時、完了メールの受信日時、Gmail・Slackの通知結果は、Neon
            PostgreSQLへ保存します。
          </li>
        </ul>
        <p>
          OAuthトークンやメール本文をデータベースへ保存することはありません。
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. 外部サービスへの送信</h2>
        <p>
          本アプリの実行、保存、通知に必要な範囲で、Google Gmail
          API、Vercel、NeonおよびSlackを利用します。Slackには判定結果と完了メールの受信日時を含む通知を送りますが、メール本文は送りません。これらを除き、Googleユーザーデータを第三者へ販売または提供しません。
        </p>
      </section>

      <section className={styles.section}>
        <h2>5. 保持期間と削除</h2>
        <p>
          保存した判定結果は本アプリの運用中に保持し、運用終了時または不要になった時点で削除します。Googleアカウントの設定から本アプリのアクセス権を取り消すことができ、開発者は環境変数の認証情報およびデータベースの記録を削除できます。
        </p>
      </section>

      <section className={styles.section}>
        <h2>6. Google APIに関する方針</h2>
        <p>
          本アプリによるGoogle APIから受け取った情報の利用は、
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          （Limited Use要件を含む）に従います。
        </p>
      </section>

      <section className={styles.section}>
        <h2>7. 利用対象</h2>
        <p>
          本アプリには第三者がGoogleアカウントを登録・接続する機能はなく、開発者本人のGoogleアカウントのみを接続します。
        </p>
      </section>

      <section className={styles.section}>
        <h2>8. 変更とお問い合わせ</h2>
        <p>
          データの取り扱いを変更した場合は、このページを更新します。お問い合わせは
          <a href="https://github.com/Kenichi585-sys/sawakami-task-checker/issues">
            GitHubリポジトリのIssues
          </a>
          からご連絡ください。
        </p>
      </section>
    </article>
  </main>
);

export default PrivacyPolicy;
