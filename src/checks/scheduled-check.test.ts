import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GoogleApiRequestError } from "@/google/oauth";

import {
  buildNotificationMessage,
  runScheduledCheck,
  shouldSkip25thCheck,
  type ScheduledCheckDependencies,
} from "./scheduled-check";

const checkedAt15th = new Date("2026-09-15T10:00:00.000Z");
const checkedAt25th = new Date("2026-09-25T10:00:00.000Z");

const createDependencies = (
  overrides: Partial<ScheduledCheckDependencies> = {},
): ScheduledCheckDependencies => ({
  getScheduledCheck: vi.fn().mockResolvedValue(null),
  reserveScheduledCheck: vi.fn().mockResolvedValue(true),
  completeScheduledCheck: vi.fn().mockResolvedValue(undefined),
  searchCompletionMail: vi.fn().mockResolvedValue({
    status: "unconfirmed",
    targetMonth: { year: 2026, month: 9 },
    completionMailReceivedAt: null,
  }),
  sendGmailNotification: vi.fn().mockResolvedValue(undefined),
  sendSlackNotification: vi.fn().mockResolvedValue("succeeded"),
  ...overrides,
});

describe("buildNotificationMessage", () => {
  it("完了時は対象年月と日本時間の受信日時を含める", () => {
    const message = buildNotificationMessage({
      status: "completed",
      targetMonth: { year: 2026, month: 9 },
      completionMailReceivedAt: new Date("2026-09-08T01:41:00.000Z"),
    });

    expect(message.subject).toBe(
      "【さわかみ投信】2026年9月分の課題アンケート確認結果",
    );
    expect(message.body).toBe(
      "2026年9月分の課題アンケートは提出済みです。\n完了メールは9月8日 10:41に届いています。",
    );
  });

  it("認証エラー時はGmailとの再接続が必要だと伝える", () => {
    const message = buildNotificationMessage({
      status: "error",
      reason: "authentication",
      targetMonth: { year: 2026, month: 9 },
      completionMailReceivedAt: null,
    });

    expect(message.body).toBe(
      "Googleの認証が切れています。Gmailとの再接続が必要です。",
    );
  });
});

describe("shouldSkip25thCheck", () => {
  it("15日が完了で一方の通知に成功していれば25日を省略する", () => {
    expect(
      shouldSkip25thCheck({
        result: "completed",
        gmailNotificationStatus: "succeeded",
        slackNotificationStatus: "failed",
      }),
    ).toBe(true);
  });

  it("15日が完了でも両通知に失敗していれば25日を実行する", () => {
    expect(
      shouldSkip25thCheck({
        result: "completed",
        gmailNotificationStatus: "failed",
        slackNotificationStatus: "failed",
      }),
    ).toBe(false);
  });
});

describe("runScheduledCheck", () => {
  it("15日は現在の判定を両方へ通知して保存する", async () => {
    const completeScheduledCheck = vi.fn().mockResolvedValue(undefined);
    const sendGmailNotification = vi
      .fn()
      .mockRejectedValue(new Error("Gmail送信失敗"));
    const sendSlackNotification = vi.fn().mockResolvedValue("succeeded");
    const dependencies = createDependencies({
      completeScheduledCheck,
      sendGmailNotification,
      sendSlackNotification,
    });

    const outcome = await runScheduledCheck({
      checkedAt: checkedAt15th,
      dependencies,
    });

    expect(sendGmailNotification).toHaveBeenCalledOnce();
    expect(sendSlackNotification).toHaveBeenCalledOnce();
    expect(completeScheduledCheck).toHaveBeenCalledWith({
      targetMonth: { year: 2026, month: 9 },
      scheduleDay: 15,
      result: "unconfirmed",
      checkedAt: checkedAt15th,
      completionMailReceivedAt: null,
      gmailNotificationStatus: "failed",
      slackNotificationStatus: "succeeded",
    });
    expect(outcome).toEqual({
      status: "executed",
      scheduleDay: 15,
      result: "unconfirmed",
      gmailNotificationStatus: "failed",
      slackNotificationStatus: "succeeded",
    });
  });

  it("15日に完了通知済みなら25日の検索と通知を省略する", async () => {
    const reserveScheduledCheck = vi.fn().mockResolvedValue(true);
    const searchCompletionMail = vi.fn();
    const dependencies = createDependencies({
      getScheduledCheck: vi.fn().mockResolvedValue({
        result: "completed",
        gmailNotificationStatus: "succeeded",
        slackNotificationStatus: "failed",
      }),
      reserveScheduledCheck,
      searchCompletionMail,
    });

    const outcome = await runScheduledCheck({
      checkedAt: checkedAt25th,
      dependencies,
    });

    expect(outcome).toEqual({
      status: "skipped",
      reason: "completed_on_15th",
    });
    expect(reserveScheduledCheck).not.toHaveBeenCalled();
    expect(searchCompletionMail).not.toHaveBeenCalled();
  });

  it("15日に完了しても両通知が失敗していれば25日に再実行する", async () => {
    const searchCompletionMail = vi.fn().mockResolvedValue({
      status: "completed",
      targetMonth: { year: 2026, month: 9 },
      completionMailReceivedAt: new Date("2026-09-20T02:00:00.000Z"),
    });
    const dependencies = createDependencies({
      getScheduledCheck: vi.fn().mockResolvedValue({
        result: "completed",
        gmailNotificationStatus: "failed",
        slackNotificationStatus: "failed",
      }),
      searchCompletionMail,
    });

    const outcome = await runScheduledCheck({
      checkedAt: checkedAt25th,
      dependencies,
    });

    expect(searchCompletionMail).toHaveBeenCalledOnce();
    expect(outcome.status).toBe("executed");
  });

  it("15日が未確認なら25日に再実行する", async () => {
    const searchCompletionMail = vi.fn().mockResolvedValue({
      status: "completed",
      targetMonth: { year: 2026, month: 9 },
      completionMailReceivedAt: new Date("2026-09-20T02:00:00.000Z"),
    });
    const dependencies = createDependencies({
      getScheduledCheck: vi.fn().mockResolvedValue({
        result: "unconfirmed",
        gmailNotificationStatus: "succeeded",
        slackNotificationStatus: "succeeded",
      }),
      searchCompletionMail,
    });

    const outcome = await runScheduledCheck({
      checkedAt: checkedAt25th,
      dependencies,
    });

    expect(searchCompletionMail).toHaveBeenCalledOnce();
    expect(outcome.status).toBe("executed");
  });

  it("15日が確認エラーなら25日に再実行する", async () => {
    const searchCompletionMail = vi.fn().mockResolvedValue({
      status: "unconfirmed",
      targetMonth: { year: 2026, month: 9 },
      completionMailReceivedAt: null,
    });
    const dependencies = createDependencies({
      getScheduledCheck: vi.fn().mockResolvedValue({
        result: "error",
        gmailNotificationStatus: "failed",
        slackNotificationStatus: "succeeded",
      }),
      searchCompletionMail,
    });

    const outcome = await runScheduledCheck({
      checkedAt: checkedAt25th,
      dependencies,
    });

    expect(searchCompletionMail).toHaveBeenCalledOnce();
    expect(outcome.status).toBe("executed");
  });

  it("15日の記録がなければ25日に実行する", async () => {
    const searchCompletionMail = vi.fn().mockResolvedValue({
      status: "unconfirmed",
      targetMonth: { year: 2026, month: 9 },
      completionMailReceivedAt: null,
    });
    const dependencies = createDependencies({ searchCompletionMail });

    const outcome = await runScheduledCheck({
      checkedAt: checkedAt25th,
      dependencies,
    });

    expect(searchCompletionMail).toHaveBeenCalledOnce();
    expect(outcome.status).toBe("executed");
  });

  it("25日は当月15日の記録だけを取得する", async () => {
    const getScheduledCheck = vi.fn().mockResolvedValue(null);
    const dependencies = createDependencies({ getScheduledCheck });

    await runScheduledCheck({
      checkedAt: new Date("2027-09-25T10:00:00.000Z"),
      dependencies,
    });

    expect(getScheduledCheck).toHaveBeenCalledWith({
      targetMonth: { year: 2027, month: 9 },
      scheduleDay: 15,
    });
  });

  it("同じ対象月と実行日の記録があれば重複通知しない", async () => {
    const searchCompletionMail = vi.fn();
    const sendGmailNotification = vi.fn();
    const dependencies = createDependencies({
      reserveScheduledCheck: vi.fn().mockResolvedValue(false),
      searchCompletionMail,
      sendGmailNotification,
    });

    const outcome = await runScheduledCheck({
      checkedAt: checkedAt15th,
      dependencies,
    });

    expect(outcome).toEqual({ status: "skipped", reason: "already_recorded" });
    expect(searchCompletionMail).not.toHaveBeenCalled();
    expect(sendGmailNotification).not.toHaveBeenCalled();
  });

  it("15日と25日以外は実行しない", async () => {
    const reserveScheduledCheck = vi.fn();
    const dependencies = createDependencies({ reserveScheduledCheck });

    const outcome = await runScheduledCheck({
      checkedAt: new Date("2026-09-16T10:00:00.000Z"),
      dependencies,
    });

    expect(outcome).toEqual({ status: "skipped", reason: "not_schedule_day" });
    expect(reserveScheduledCheck).not.toHaveBeenCalled();
  });

  it("Gmail認証エラー時はGmail送信を省略してSlackへ再接続を通知する", async () => {
    const completeScheduledCheck = vi.fn().mockResolvedValue(undefined);
    const sendGmailNotification = vi.fn();
    const sendSlackNotification = vi.fn().mockResolvedValue("succeeded");
    const dependencies = createDependencies({
      completeScheduledCheck,
      searchCompletionMail: vi
        .fn()
        .mockRejectedValue(
          new GoogleApiRequestError(
            "authentication",
            new Error("invalid_grant"),
          ),
        ),
      sendGmailNotification,
      sendSlackNotification,
    });

    const outcome = await runScheduledCheck({
      checkedAt: checkedAt15th,
      dependencies,
    });

    expect(sendGmailNotification).not.toHaveBeenCalled();
    expect(sendSlackNotification).toHaveBeenCalledWith(
      expect.stringContaining("Gmailとの再接続が必要です。"),
    );
    expect(completeScheduledCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "error",
        gmailNotificationStatus: "failed",
        slackNotificationStatus: "succeeded",
      }),
    );
    expect(outcome).toEqual({
      status: "executed",
      scheduleDay: 15,
      result: "error",
      gmailNotificationStatus: "failed",
      slackNotificationStatus: "succeeded",
    });
  });

  it("Gmail送信時の認証エラーをSlackへ通知する", async () => {
    const sendSlackNotification = vi.fn().mockResolvedValue("succeeded");
    const dependencies = createDependencies({
      sendGmailNotification: vi
        .fn()
        .mockRejectedValue(
          new GoogleApiRequestError(
            "authentication",
            new Error("insufficient permission"),
          ),
        ),
      sendSlackNotification,
    });

    const outcome = await runScheduledCheck({
      checkedAt: checkedAt15th,
      dependencies,
    });

    expect(sendSlackNotification).toHaveBeenCalledWith(
      expect.stringMatching(
        /提出完了メールを確認できませんでした。[\s\S]*Gmailとの再接続が必要です。/,
      ),
    );
    expect(outcome).toEqual({
      status: "executed",
      scheduleDay: 15,
      result: "unconfirmed",
      gmailNotificationStatus: "failed",
      slackNotificationStatus: "succeeded",
    });
  });

  it("Slack通知に失敗してもGmail通知を実行する", async () => {
    const sendGmailNotification = vi.fn().mockResolvedValue(undefined);
    const dependencies = createDependencies({
      sendGmailNotification,
      sendSlackNotification: vi.fn().mockResolvedValue("failed"),
    });

    const outcome = await runScheduledCheck({
      checkedAt: checkedAt15th,
      dependencies,
    });

    expect(sendGmailNotification).toHaveBeenCalledOnce();
    expect(outcome).toEqual({
      status: "executed",
      scheduleDay: 15,
      result: "unconfirmed",
      gmailNotificationStatus: "succeeded",
      slackNotificationStatus: "failed",
    });
  });
});
