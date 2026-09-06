export type SlackNotificationStatus = "succeeded" | "failed" | "skipped";

const SLACK_WEBHOOK_TIMEOUT_MILLISECONDS = 10_000;

type SendSlackMessageInput = Readonly<{
  text: string;
  webhookUrl?: string;
  fetcher?: typeof fetch;
}>;

const isSlackWebhookUrl = (webhookUrl: string) => {
  try {
    const url = new URL(webhookUrl);

    return (
      url.protocol === "https:" &&
      url.hostname === "hooks.slack.com" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === "" &&
      /^\/services\/[^/]+\/[^/]+\/[^/]+$/.test(url.pathname)
    );
  } catch {
    return false;
  }
};

export const sendSlackMessage = async ({
  text,
  webhookUrl,
  fetcher = fetch,
}: SendSlackMessageInput): Promise<SlackNotificationStatus> => {
  if (webhookUrl === undefined || webhookUrl.trim() === "") {
    return "skipped";
  }

  const normalizedWebhookUrl = webhookUrl.trim();

  if (!isSlackWebhookUrl(normalizedWebhookUrl)) {
    return "failed";
  }

  try {
    const response = await fetcher(normalizedWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      redirect: "error",
      signal: AbortSignal.timeout(SLACK_WEBHOOK_TIMEOUT_MILLISECONDS),
    });

    return response.status === 200 ? "succeeded" : "failed";
  } catch {
    return "failed";
  }
};
