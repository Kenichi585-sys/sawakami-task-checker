import { describe, expect, it } from "vitest";

import {
  buildCompletionMailQuery,
  searchCompletionMail,
  sendGmailMessage,
} from "./gmail";
import type { GoogleApiRequest, GoogleApiRequestOptions } from "./oauth";

const createRequest =
  (
    responses: unknown[],
    requests: GoogleApiRequestOptions[] = [],
  ): GoogleApiRequest =>
  async <Response>(options: GoogleApiRequestOptions) => {
    requests.push(options);

    return { data: responses.shift() as Response };
  };

describe("buildCompletionMailQuery", () => {
  it("送信元、件名、日本時間の対象月を検索条件にする", () => {
    const query = buildCompletionMailQuery(
      new Date("2026-09-15T10:00:00.000Z"),
    );

    expect(query).toContain("from:noreply@sawakami.co.jp");
    expect(query).toContain(
      'subject:"長期投資家デビュープロジェクト｜課題アンケート提出完了"',
    );
    expect(query).toContain("after:1788188399");
    expect(query).toContain("before:1790780400");
  });
});

describe("searchCompletionMail", () => {
  const checkedAt = new Date("2026-09-15T10:00:00.000Z");

  it("Gmailのメッセージを取得して完了と判定する", async () => {
    const requests: GoogleApiRequestOptions[] = [];
    const request = createRequest(
      [
        { messages: [{ id: "message-1" }] },
        {
          id: "message-1",
          internalDate: "1788831660000",
          payload: {
            headers: [
              {
                name: "From",
                value: "さわかみ投信 <noreply@sawakami.co.jp>",
              },
              {
                name: "Subject",
                value: "長期投資家デビュープロジェクト｜課題アンケート提出完了",
              },
            ],
          },
        },
      ],
      requests,
    );

    const result = await searchCompletionMail({ checkedAt, request });

    expect(result).toEqual({
      status: "completed",
      targetMonth: { year: 2026, month: 9 },
      completionMailReceivedAt: new Date("2026-09-08T01:41:00.000Z"),
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]?.params).toMatchObject({
      includeSpamTrash: false,
      maxResults: 1,
    });
    expect(requests[1]?.params).toEqual({ format: "metadata" });
  });

  it("一致するメッセージがなければ未確認と判定する", async () => {
    const request = createRequest([{ messages: [] }]);

    const result = await searchCompletionMail({ checkedAt, request });

    expect(result.status).toBe("unconfirmed");
  });
});

describe("sendGmailMessage", () => {
  it("日本語の件名と本文をGmail API用に変換して送信する", async () => {
    const requests: GoogleApiRequestOptions[] = [];
    const request = createRequest([{ id: "sent-message-1" }], requests);

    const result = await sendGmailMessage({
      from: "user@gmail.com",
      to: "user@example.com",
      subject: "9月分の確認結果",
      body: "提出済みです。",
      request,
    });

    const requestBody = requests[0]?.data as { raw: string };
    const decodedMessage = Buffer.from(requestBody.raw, "base64url").toString();

    expect(result).toEqual({ messageId: "sent-message-1" });
    expect(decodedMessage).toContain("From: user@gmail.com");
    expect(decodedMessage).toContain("To: user@example.com");
    expect(decodedMessage).toContain("提出済みです。");
  });

  it("メールヘッダーへの改行を受け付けない", async () => {
    const request = createRequest([]);

    await expect(
      sendGmailMessage({
        from: "user@gmail.com",
        to: "user@example.com\r\nBcc: another@example.com",
        subject: "9月分の確認結果",
        body: "提出済みです。",
        request,
      }),
    ).rejects.toThrow("toに改行を含めることはできません。");
  });
});
