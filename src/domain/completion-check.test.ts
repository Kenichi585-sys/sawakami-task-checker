import { describe, expect, it } from "vitest";

import {
  COMPLETION_MAIL_SENDER,
  COMPLETION_MAIL_SUBJECT,
  getTargetMonth,
  getTargetMonthPeriod,
  judgeCompletion,
  type MailCandidate,
} from "./completion-check";

const createMail = (overrides: Partial<MailCandidate> = {}): MailCandidate => ({
  from: COMPLETION_MAIL_SENDER,
  subject: COMPLETION_MAIL_SUBJECT,
  receivedAt: new Date("2026-09-12T01:41:00.000Z"),
  ...overrides,
});

describe("getTargetMonth", () => {
  it("日本時間で対象年月を判定する", () => {
    expect(getTargetMonth(new Date("2026-08-31T14:59:59.999Z"))).toEqual({
      year: 2026,
      month: 8,
    });
    expect(getTargetMonth(new Date("2026-08-31T15:00:00.000Z"))).toEqual({
      year: 2026,
      month: 9,
    });
  });

  it("無効な確認日時を受け付けない", () => {
    expect(() => getTargetMonth(new Date("invalid"))).toThrow(RangeError);
  });
});

describe("getTargetMonthPeriod", () => {
  it("日本時間の月初以上、翌月月初未満となる期間を返す", () => {
    const period = getTargetMonthPeriod(new Date("2026-09-15T10:00:00.000Z"));

    expect(period).toEqual({
      targetMonth: { year: 2026, month: 9 },
      startsAt: new Date("2026-08-31T15:00:00.000Z"),
      endsAt: new Date("2026-09-30T15:00:00.000Z"),
    });
  });

  it("12月から翌年1月へ正しく繰り上げる", () => {
    const period = getTargetMonthPeriod(new Date("2026-12-31T15:00:00.000Z"));

    expect(period).toEqual({
      targetMonth: { year: 2027, month: 1 },
      startsAt: new Date("2026-12-31T15:00:00.000Z"),
      endsAt: new Date("2027-01-31T15:00:00.000Z"),
    });
  });
});

describe("judgeCompletion", () => {
  const checkedAt = new Date("2026-09-15T10:00:00.000Z");

  it("対象月内で一致するメールがあれば完了と判定する", () => {
    const receivedAt = new Date("2026-09-08T01:41:00.000Z");
    const result = judgeCompletion({
      checkedAt,
      mails: [
        createMail({
          from: `さわかみ投信 <${COMPLETION_MAIL_SENDER}>`,
          receivedAt,
        }),
      ],
    });

    expect(result).toEqual({
      status: "completed",
      targetMonth: { year: 2026, month: 9 },
      completionMailReceivedAt: receivedAt,
    });
  });

  it("前月のメールを完了判定に使用しない", () => {
    const result = judgeCompletion({
      checkedAt,
      mails: [createMail({ receivedAt: new Date("2026-08-08T01:41:00.000Z") })],
    });

    expect(result.status).toBe("unconfirmed");
  });

  it("前年同月のメールを完了判定に使用しない", () => {
    const result = judgeCompletion({
      checkedAt: new Date("2027-09-15T10:00:00.000Z"),
      mails: [createMail({ receivedAt: new Date("2026-09-08T01:41:00.000Z") })],
    });

    expect(result).toEqual({
      status: "unconfirmed",
      targetMonth: { year: 2027, month: 9 },
      completionMailReceivedAt: null,
    });
  });

  it("対象月の開始日時ちょうどのメールを当月分に含める", () => {
    const receivedAt = new Date("2026-08-31T15:00:00.000Z");
    const result = judgeCompletion({
      checkedAt,
      mails: [createMail({ receivedAt })],
    });

    expect(result.status).toBe("completed");
    expect(result.completionMailReceivedAt).toEqual(receivedAt);
  });

  it("対象月の終了日時ちょうどのメールを次月分として除外する", () => {
    const result = judgeCompletion({
      checkedAt,
      mails: [createMail({ receivedAt: new Date("2026-09-30T15:00:00.000Z") })],
    });

    expect(result.status).toBe("unconfirmed");
  });

  it("件名または送信元が異なるメールを除外する", () => {
    const result = judgeCompletion({
      checkedAt,
      mails: [
        createMail({ subject: `${COMPLETION_MAIL_SUBJECT}のお知らせ` }),
        createMail({ from: "another@example.com" }),
      ],
    });

    expect(result.status).toBe("unconfirmed");
  });

  it("候補メールがなければ未確認と判定する", () => {
    const result = judgeCompletion({ checkedAt, mails: [] });

    expect(result.status).toBe("unconfirmed");
  });
});
