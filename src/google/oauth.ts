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

  return async <Response>(options: GoogleApiRequestOptions) => {
    const response = await oauthClient.request<Response>(options);

    return { data: response.data };
  };
};
