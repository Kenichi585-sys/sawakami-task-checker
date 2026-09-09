import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Home from "./page";

afterEach(() => {
  cleanup();
});

describe("Home", () => {
  it("アプリ名と目的を表示する", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: "さわかみ投信・月次課題チェッカー",
        hidden: true,
      }),
    ).toBeDefined();
  });

  it("公開画面がデモデータであることを表示する", () => {
    render(<Home />);

    expect(screen.getByText("公開画面はデモデータ")).toBeDefined();
    expect(
      screen.getByText("この操作で実際のGmail検索や通知は行いません。"),
    ).toBeDefined();
  });

  it("デモ確認ボタンでサンプルの完了結果を表示する", () => {
    render(<Home />);

    const button = screen.getByRole("button", { name: "今すぐ確認（デモ）" });

    fireEvent.click(button);

    expect(screen.getByText("課題アンケートは提出済みです")).toBeDefined();
    expect(
      screen.getByText("サンプルの完了メールは9月9日 10:41に届いています。"),
    ).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: "デモ確認済み" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
