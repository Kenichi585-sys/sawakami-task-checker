import { describe, expect, it, vi } from "vitest";

import { sendSlackMessage } from "./webhook";

describe("sendSlackMessage", () => {
  it("Webhook URLが未設定なら送信をスキップする", async () => {
    const fetcher = vi.fn<typeof fetch>();

    const status = await sendSlackMessage({
      text: "9月分の確認結果です。",
      fetcher,
    });

    expect(status).toBe("skipped");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("Slackへテキストを送信できたら成功を返す", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const status = await sendSlackMessage({
      text: "9月分の課題アンケートは提出済みです。",
      webhookUrl: "https://hooks.slack.com/services/test/webhook/url",
      fetcher,
    });

    expect(status).toBe("succeeded");
    expect(fetcher).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/test/webhook/url",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: "9月分の課題アンケートは提出済みです。",
        }),
        redirect: "error",
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("Slack以外のURLには送信しない", async () => {
    const fetcher = vi.fn<typeof fetch>();

    const status = await sendSlackMessage({
      text: "9月分の確認結果です。",
      webhookUrl: "https://example.com/services/test/webhook/url",
      fetcher,
    });

    expect(status).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("Slackが200以外を返したら失敗を返す", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("invalid_token", { status: 403 }));

    const status = await sendSlackMessage({
      text: "9月分の確認結果です。",
      webhookUrl: "https://hooks.slack.com/services/test/webhook/url",
      fetcher,
    });

    expect(status).toBe("failed");
  });

  it("通信エラーが起きても例外を外へ投げず失敗を返す", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("network error"));

    const status = await sendSlackMessage({
      text: "9月分の確認結果です。",
      webhookUrl: "https://hooks.slack.com/services/test/webhook/url",
      fetcher,
    });

    expect(status).toBe("failed");
  });
});
