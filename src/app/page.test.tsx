import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("アプリ名を見出しとして表示する", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: "さわかみ投信・月次課題チェッカー",
      }),
    ).toBeDefined();
  });
});
