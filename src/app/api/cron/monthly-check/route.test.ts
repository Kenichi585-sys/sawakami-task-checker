import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/checks/scheduled-check", () => ({
  runScheduledCheck: vi.fn(),
}));

import { runScheduledCheck } from "@/checks/scheduled-check";

import { GET } from "./route";

const mockedRunScheduledCheck = vi.mocked(runScheduledCheck);

const createRequest = (authorization?: string) =>
  new NextRequest("https://example.com/api/cron/monthly-check", {
    headers: authorization === undefined ? undefined : { authorization },
  });

afterEach(() => {
  mockedRunScheduledCheck.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/cron/monthly-check", () => {
  it("認証情報が一致しなければ401を返して定期確認を実行しない", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    const response = await GET(createRequest("Bearer invalid-secret"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false });
    expect(mockedRunScheduledCheck).not.toHaveBeenCalled();
  });

  it("認証に成功したら定期確認の結果を返す", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    mockedRunScheduledCheck.mockResolvedValue({
      status: "skipped",
      reason: "not_schedule_day",
    });

    const response = await GET(createRequest("Bearer test-cron-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      outcome: { status: "skipped", reason: "not_schedule_day" },
    });
    expect(mockedRunScheduledCheck).toHaveBeenCalledOnce();
  });

  it("定期確認で例外が起きたら500を返す", async () => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    mockedRunScheduledCheck.mockRejectedValue(new Error("unexpected error"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = await GET(createRequest("Bearer test-cron-secret"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ success: false });
    expect(consoleError).toHaveBeenCalledWith("定期確認処理に失敗しました。");
  });
});
