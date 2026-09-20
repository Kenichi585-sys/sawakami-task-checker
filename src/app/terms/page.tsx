import type { Metadata } from "next";
import Link from "next/link";

import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "利用規約 | 月次課題チェッカー",
  description: "月次課題チェッカーの利用条件",
};

const Terms = () => (
  <main className={styles.main}>
    <article className={styles.article}>
      <Link className={styles.backLink} href="/">
        ← トップページへ戻る
      </Link>

      <header>
        <p className={styles.eyebrow}>TERMS OF SERVICE</p>
        <h1>利用規約</h1>
        <p className={styles.updatedAt}>最終更新日：2026年9月20日</p>
      </header>

      <p className={styles.introduction}>
        月次課題チェッカー（以下「本アプリ」）は、開発者本人による個人利用を目的とした非公式ツールです。
      </p>

      <section className={styles.section}>
        <h2>1. 利用目的</h2>
        <p>
          本アプリは、課題アンケートの提出状況をGmailの完了メールから確認し、結果を通知するために利用します。公開画面はポートフォリオ用のデモであり、実際のGmail検索や通知は行いません。
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. 非公式サービス</h2>
        <p>
          本アプリは、さわかみ投信株式会社が提供または公認するものではありません。同社が提供するサービスの利用条件は、同社の案内をご確認ください。
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. 提供の変更・停止</h2>
        <p>
          個人開発のため、事前の予告なく機能の変更、停止または公開終了を行う場合があります。本アプリの判定結果だけに依存せず、必要に応じて提出状況を手動で確認します。
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. お問い合わせ</h2>
        <p>
          お問い合わせは
          <a href="https://github.com/Kenichi585-sys/sawakami-task-checker/issues">
            GitHubリポジトリのIssues
          </a>
          からご連絡ください。
        </p>
      </section>
    </article>
  </main>
);

export default Terms;
