import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <p className={styles.status}>開発準備中</p>
        <h1>さわかみ投信・月次課題チェッカー</h1>
        <p>
          課題アンケートの提出完了メールを自動で確認し、GmailとSlackへ結果を通知する非公式の個人用アプリです。
        </p>
      </section>
    </main>
  );
}
