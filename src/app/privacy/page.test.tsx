import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PrivacyPolicy from "./page";

afterEach(() => {
  cleanup();
});

describe("PrivacyPolicy", () => {
  it("Googleユーザーデータの取得・利用・保存・共有方針を表示する", () => {
    render(<PrivacyPolicy />);

    expect(
      screen.getByRole("heading", { name: "プライバシーポリシー" }),
    ).toBeDefined();
    expect(screen.getByText("2. データの利用目的")).toBeDefined();
    expect(screen.getByText("3. 保存する情報と保存場所")).toBeDefined();
    expect(screen.getByText("4. 外部サービスへの送信")).toBeDefined();
    expect(screen.getByText("5. 保持期間と削除")).toBeDefined();
    expect(screen.getByText(".env.local")).toBeDefined();
    expect(screen.getByText(/通知元・通知先メールアドレス/)).toBeDefined();
    expect(
      screen.getByText(/ソースコードやGitリポジトリには保存しません/),
    ).toBeDefined();
  });
});
