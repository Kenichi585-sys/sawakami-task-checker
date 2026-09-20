import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({
  getSql: vi.fn(),
}));

import { getSql } from "@/db/client";

import {
  completeScheduledCheck,
  getScheduledCheck,
  reserveScheduledCheck,
} from "./scheduled-checks";

const mockedGetSql = vi.mocked(getSql);

const useSqlResult = (rows: unknown[]) => {
  const sql = vi.fn().mockResolvedValue(rows);

  mockedGetSql.mockReturnValue(sql as unknown as ReturnType<typeof getSql>);

  return sql;
};

beforeEach(() => {
  mockedGetSql.mockReset();
});

describe("reserveScheduledCheck", () => {
  it("対象年月と実行日を使って新しい記録を予約する", async () => {
    const sql = useSqlResult([{ target_month: "2026-09-01" }]);
    const checkedAt = new Date("2026-09-15T10:00:00.000Z");

    const reserved = await reserveScheduledCheck({
      targetMonth: { year: 2026, month: 9 },
      scheduleDay: 15,
      checkedAt,
    });

    const [queryParts, ...values] = sql.mock.calls[0] ?? [];

    expect(reserved).toBe(true);
    expect(Array.from(queryParts as TemplateStringsArray).join(" ")).toContain(
      "ON CONFLICT (target_month, schedule_day) DO NOTHING",
    );
    expect(values).toEqual(["2026-09-01", 15, checkedAt.toISOString()]);
  });

  it("同じ対象年月と実行日の記録があれば予約しない", async () => {
    useSqlResult([]);

    const reserved = await reserveScheduledCheck({
      targetMonth: { year: 2026, month: 9 },
      scheduleDay: 15,
      checkedAt: new Date("2026-09-15T10:00:00.000Z"),
    });

    expect(reserved).toBe(false);
  });
});

describe("getScheduledCheck", () => {
  it("指定した対象年月と実行日の記録を返す", async () => {
    const sql = useSqlResult([
      {
        result: "completed",
        gmail_notification_status: "succeeded",
        slack_notification_status: "failed",
      },
    ]);

    const record = await getScheduledCheck({
      targetMonth: { year: 2027, month: 9 },
      scheduleDay: 15,
    });

    const [, ...values] = sql.mock.calls[0] ?? [];

    expect(values).toEqual(["2027-09-01", 15]);
    expect(record).toEqual({
      result: "completed",
      gmailNotificationStatus: "succeeded",
      slackNotificationStatus: "failed",
    });
  });
});

describe("completeScheduledCheck", () => {
  it("予約した記録を更新できなければ例外を返す", async () => {
    useSqlResult([]);

    const result = completeScheduledCheck({
      targetMonth: { year: 2026, month: 9 },
      scheduleDay: 15,
      result: "unconfirmed",
      checkedAt: new Date("2026-09-15T10:00:00.000Z"),
      completionMailReceivedAt: null,
      gmailNotificationStatus: "succeeded",
      slackNotificationStatus: "failed",
    });

    await expect(result).rejects.toThrow(
      "定期確認結果を更新できませんでした。",
    );
  });
});
