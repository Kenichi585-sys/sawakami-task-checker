import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { withGoogleApiRetry, type GoogleApiRequest } from "./oauth";

const requestOptions = {
  url: "https://gmail.googleapis.com/gmail/v1/users/me/messages",
  method: "GET" as const,
};

const createHttpError = (status: number, errorCode?: string) =>
  Object.assign(new Error(errorCode ?? `HTTP ${status}`), {
    name: "GaxiosError",
    response: {
      status,
      data: errorCode === undefined ? {} : { error: errorCode },
    },
  });

const createGmailApiError = (status: number, reason: string) =>
  Object.assign(new Error(reason), {
    name: "GaxiosError",
    response: {
      status,
      data: {
        error: {
          errors: [{ reason }],
        },
      },
    },
  });

describe("withGoogleApiRetry", () => {
  it("一時エラーは1秒、2秒待って最大2回再試行する", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(createHttpError(503))
      .mockRejectedValueOnce(createHttpError(429))
      .mockResolvedValue({
        data: { messages: [] },
      }) as unknown as GoogleApiRequest;
    const wait = vi.fn().mockResolvedValue(undefined);
    const requestWithRetry = withGoogleApiRetry(request, wait);

    const response = await requestWithRetry<{ messages: unknown[] }>(
      requestOptions,
    );

    expect(response).toEqual({ data: { messages: [] } });
    expect(request).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 1_000);
    expect(wait).toHaveBeenNthCalledWith(2, 2_000);
  });

  it("認証エラーは再試行せず種類を保持して返す", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(
        createHttpError(400, "invalid_grant"),
      ) as unknown as GoogleApiRequest;
    const wait = vi.fn().mockResolvedValue(undefined);
    const requestWithRetry = withGoogleApiRetry(request, wait);

    const result = requestWithRetry(requestOptions);

    await expect(result).rejects.toMatchObject({
      name: "GoogleApiRequestError",
      category: "authentication",
    });
    expect(request).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });

  it("一時エラーが続いた場合は3回目の失敗を返す", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(createHttpError(500)) as unknown as GoogleApiRequest;
    const wait = vi.fn().mockResolvedValue(undefined);
    const requestWithRetry = withGoogleApiRetry(request, wait);

    const result = requestWithRetry(requestOptions);

    await expect(result).rejects.toMatchObject({
      category: "temporary",
    });
    expect(request).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("Gmailの一時的な403は再試行する", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(createGmailApiError(403, "rateLimitExceeded"))
      .mockResolvedValue({
        data: { messages: [] },
      }) as unknown as GoogleApiRequest;
    const wait = vi.fn().mockResolvedValue(undefined);
    const requestWithRetry = withGoogleApiRetry(request, wait);

    const response = await requestWithRetry<{ messages: unknown[] }>(
      requestOptions,
    );

    expect(response).toEqual({ data: { messages: [] } });
    expect(request).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1_000);
  });

  it("再試行しても解消しない403は3回目の失敗を返す", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(
        createGmailApiError(403, "userRateLimitExceeded"),
      ) as unknown as GoogleApiRequest;
    const wait = vi.fn().mockResolvedValue(undefined);
    const requestWithRetry = withGoogleApiRetry(request, wait);

    const result = requestWithRetry(requestOptions);

    await expect(result).rejects.toMatchObject({ category: "temporary" });
    expect(request).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("恒久的な403は再試行しない", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(
        createGmailApiError(403, "dailyLimitExceeded"),
      ) as unknown as GoogleApiRequest;
    const wait = vi.fn().mockResolvedValue(undefined);
    const requestWithRetry = withGoogleApiRetry(request, wait);

    const result = requestWithRetry(requestOptions);

    await expect(result).rejects.toMatchObject({ category: "unknown" });
    expect(request).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });

  it("Gmail送信POSTは一時エラーでも再試行しない", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(createHttpError(503)) as unknown as GoogleApiRequest;
    const wait = vi.fn().mockResolvedValue(undefined);
    const requestWithRetry = withGoogleApiRetry(request, wait);

    const result = requestWithRetry({
      url: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      method: "POST",
      data: { raw: "encoded-message" },
    });

    await expect(result).rejects.toMatchObject({ category: "temporary" });
    expect(request).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });
});
