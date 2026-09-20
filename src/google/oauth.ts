import "server-only";

import { OAuth2Client } from "google-auth-library";

export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

export type GoogleApiRequestOptions = Readonly<{
  url: string;
  method: "GET" | "POST";
  params?: Readonly<Record<string, unknown>>;
  data?: unknown;
}>;

export type GoogleApiRequest = <Response>(
  options: GoogleApiRequestOptions,
) => Promise<{ data: Response }>;

export type GoogleApiErrorCategory = "authentication" | "temporary" | "unknown";

type GoogleApiErrorShape = Readonly<{
  name?: unknown;
  message?: unknown;
  code?: unknown;
  response?: Readonly<{
    status?: unknown;
    data?: unknown;
  }>;
}>;

type GoogleApiErrorBody = Readonly<{
  error?:
    | string
    | Readonly<{
        errors?: readonly Readonly<{
          reason?: unknown;
        }>[];
      }>;
}>;

const MAX_RETRY_COUNT = 2;
const INITIAL_RETRY_DELAY_MILLISECONDS = 1_000;
const TEMPORARY_HTTP_STATUSES = new Set([429, 500, 502, 503, 504]);
const TEMPORARY_GMAIL_ERROR_REASONS = new Set([
  "rateLimitExceeded",
  "userRateLimitExceeded",
]);
const TEMPORARY_NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
]);

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const getGoogleErrorCode = (error: GoogleApiErrorShape) => {
  if (
    typeof error.response?.data !== "object" ||
    error.response.data === null
  ) {
    return undefined;
  }

  const data = error.response.data as GoogleApiErrorBody;

  return typeof data.error === "string" ? data.error : undefined;
};

const getGoogleErrorReasons = (error: GoogleApiErrorShape) => {
  if (
    typeof error.response?.data !== "object" ||
    error.response.data === null
  ) {
    return [];
  }

  const data = error.response.data as GoogleApiErrorBody;

  if (typeof data.error !== "object" || data.error === null) {
    return [];
  }

  return (data.error.errors ?? [])
    .map(({ reason }) => reason)
    .filter((reason): reason is string => typeof reason === "string");
};

export const classifyGoogleApiError = (
  error: unknown,
): GoogleApiErrorCategory => {
  if (typeof error !== "object" || error === null) {
    return "unknown";
  }

  const googleError = error as GoogleApiErrorShape;
  const status = googleError.response?.status;
  const googleErrorCode = getGoogleErrorCode(googleError);
  const googleErrorReasons = getGoogleErrorReasons(googleError);

  if (
    status === 401 ||
    googleError.message === "invalid_grant" ||
    googleErrorCode === "invalid_grant"
  ) {
    return "authentication";
  }

  if (
    (typeof status === "number" && TEMPORARY_HTTP_STATUSES.has(status)) ||
    (status === 403 &&
      googleErrorReasons.some((reason) =>
        TEMPORARY_GMAIL_ERROR_REASONS.has(reason),
      )) ||
    (typeof googleError.code === "string" &&
      TEMPORARY_NETWORK_ERROR_CODES.has(googleError.code)) ||
    ((googleError.name === "GaxiosError" ||
      googleError.name === "AbortError") &&
      status === undefined)
  ) {
    return "temporary";
  }

  return "unknown";
};

export class GoogleApiRequestError extends Error {
  readonly category: GoogleApiErrorCategory;

  constructor(category: GoogleApiErrorCategory, cause: unknown) {
    super("Google APIへのリクエストに失敗しました。", { cause });
    this.name = "GoogleApiRequestError";
    this.category = category;
  }
}

export const isGoogleAuthenticationError = (error: unknown) =>
  error instanceof GoogleApiRequestError && error.category === "authentication";

export const withGoogleApiRetry =
  (
    request: GoogleApiRequest,
    wait: (milliseconds: number) => Promise<void> = sleep,
  ): GoogleApiRequest =>
  async <Response>(options: GoogleApiRequestOptions) => {
    for (let retryCount = 0; ; retryCount += 1) {
      try {
        return await request<Response>(options);
      } catch (error) {
        const category = classifyGoogleApiError(error);

        const canRetry = options.method === "GET" && category === "temporary";

        if (!canRetry || retryCount >= MAX_RETRY_COUNT) {
          throw new GoogleApiRequestError(category, error);
        }

        await wait(INITIAL_RETRY_DELAY_MILLISECONDS * 2 ** retryCount);
      }
    }
  };

const getRequiredEnvironmentVariable = (name: string) => {
  const value = process.env[name];

  if (value === undefined || value === "") {
    throw new Error(`${name}が設定されていません。`);
  }

  return value;
};

export const createGoogleApiRequest = (): GoogleApiRequest => {
  const oauthClient = new OAuth2Client({
    clientId: getRequiredEnvironmentVariable("GOOGLE_CLIENT_ID"),
    clientSecret: getRequiredEnvironmentVariable("GOOGLE_CLIENT_SECRET"),
  });

  oauthClient.setCredentials({
    refresh_token: getRequiredEnvironmentVariable("GOOGLE_REFRESH_TOKEN"),
  });

  const request: GoogleApiRequest = async <Response>(
    options: GoogleApiRequestOptions,
  ) => {
    const response = await oauthClient.request<Response>(options);

    return { data: response.data };
  };

  return withGoogleApiRetry(request);
};
