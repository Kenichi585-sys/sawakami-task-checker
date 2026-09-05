import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "さわかみ投信・月次課題チェッカー",
  description:
    "課題アンケートの提出完了メールを確認し、結果を通知する非公式の個人用アプリです。",
};

const RootLayout = ({ children }: LayoutProps<"/">) => {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
