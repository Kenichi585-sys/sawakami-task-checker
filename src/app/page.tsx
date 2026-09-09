"use client";

import { useState } from "react";

import styles from "./page.module.css";

type DemoStatus = "ready" | "completed";

const Home = () => {
  const [demoStatus, setDemoStatus] = useState<DemoStatus>("ready");
  const isCompleted = demoStatus === "completed";

  return (
    <main className={styles.main}>
      <div className={styles.page}>
        <header className={styles.header}>
          <a className={styles.brand} href="#top" aria-label="ページ上部へ戻る">
            <span className={styles.brandMark} aria-hidden="true">
              S
            </span>
            <span>さわかみ投信・月次課題チェッカー</span>
          </a>
          <a
            className={styles.githubLink}
            href="https://github.com/Kenichi585-sys/sawakami-task-checker"
            target="_blank"
            rel="noreferrer"
          >
            GitHubを見る
            <span aria-hidden="true">↗</span>
          </a>
        </header>

        <section className={styles.hero} id="top">
          <div className={styles.heroCopy}>
            <h1 className={styles.visuallyHidden}>
              さわかみ投信・月次課題チェッカー
            </h1>
            <p className={styles.lead}>
              さわかみ投信「長期投資家デビュープロジェクト」の課題アンケート提出状況を
              Gmailの完了メールから自動判定し、GmailとSlackへ通知する個人用アプリです。
            </p>
            <div className={styles.labels} aria-label="アプリの属性">
              <span>非公式</span>
              <span>個人開発</span>
              <span>公開画面はデモデータ</span>
            </div>
          </div>

          <section
            className={styles.resultCard}
            aria-labelledby="result-heading"
          >
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardLabel}>デモ結果</p>
                <h2 id="result-heading">2026年9月分</h2>
              </div>
              <span
                className={
                  isCompleted ? styles.completedBadge : styles.readyBadge
                }
              >
                {isCompleted ? "提出済み" : "確認前"}
              </span>
            </div>

            <div
              className={
                isCompleted
                  ? `${styles.result} ${styles.resultWithIcon}`
                  : styles.result
              }
              aria-live="polite"
            >
              {isCompleted && (
                <span className={styles.resultIcon} aria-hidden="true">
                  ✓
                </span>
              )}
              <div>
                <p className={styles.resultTitle}>
                  {isCompleted
                    ? "課題アンケートは提出済みです"
                    : "デモ確認を実行できます"}
                </p>
                <p className={styles.resultDetail}>
                  {isCompleted
                    ? "サンプルの完了メールは9月9日 10:41に届いています。"
                    : "この操作で実際のGmail検索や通知は行いません。"}
                </p>
              </div>
            </div>

            <button
              className={styles.checkButton}
              type="button"
              disabled={isCompleted}
              onClick={() => setDemoStatus("completed")}
            >
              {isCompleted ? "デモ確認済み" : "今すぐ確認（デモ）"}
            </button>
            <p className={styles.safetyNote}>
              実際のメールアドレス、OAuthトークン、提出状況は公開していません。
            </p>
          </section>
        </section>

        <section className={styles.explanation} aria-label="処理の流れ">
          <ol className={styles.flowList} aria-label="処理の流れ">
            <li>
              <span>01</span>
              <div>
                <h3>Gmailを検索</h3>
                <p>
                  当月に届いた指定の送信元・件名の完了メールだけを探します。
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>提出状況を判定</h3>
                <p>
                  完了、未確認、確認エラーを区別し、結果をPostgreSQLへ保存します。
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>2つの経路で通知</h3>
                <p>
                  GmailとSlackを別々に実行し、一方の失敗がもう一方へ影響しないようにします。
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className={styles.schedule} aria-labelledby="schedule-heading">
          <h2 id="schedule-heading">定期実行</h2>
          <div className={styles.scheduleItems}>
            <article>
              <p className={styles.scheduleDate}>
                15<span>日</span>
              </p>
              <div>
                <h3>当月の状況を必ず確認</h3>
                <p>19時台にGmailを検索し、現在の判定結果を通知します。</p>
              </div>
            </article>
            <article>
              <p className={styles.scheduleDate}>
                25<span>日</span>
              </p>
              <div>
                <h3>必要な月だけ再確認</h3>
                <p>
                  15日に未確認・確認エラー・両通知失敗だった場合だけ再実行します。
                </p>
              </div>
            </article>
          </div>
        </section>

        <footer className={styles.footer}>
          <p>
            TypeScript / Next.js / Gmail API / Slack Incoming Webhook / Neon
            PostgreSQL / Vercel Cron
          </p>
          <p>
            本アプリは個人が開発する非公式ツールであり、さわかみ投信株式会社が提供・公認するものではありません。
          </p>
        </footer>
      </div>
    </main>
  );
};

export default Home;
