import {
  COMPLETION_MAIL_SENDER,
  COMPLETION_MAIL_SUBJECT,
  getTargetMonthPeriod,
  judgeCompletion,
  type CompletionJudgement,
  type MailCandidate,
} from "@/domain/completion-check";
import type { GoogleApiRequest } from "@/google/oauth";

const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

type GmailMessageReference = Readonly<{
  id?: string;
}>;

type GmailMessageListResponse = Readonly<{
  messages?: readonly GmailMessageReference[];
}>;

type GmailHeader = Readonly<{
  name?: string;
  value?: string;
}>;

type GmailMessageResponse = Readonly<{
  id?: string;
  internalDate?: string;
  payload?: Readonly<{
    headers?: readonly GmailHeader[];
  }>;
}>;

type GmailSendResponse = Readonly<{
  id?: string;
}>;

type SearchCompletionMailInput = Readonly<{
  checkedAt: Date;
  request: GoogleApiRequest;
}>;

type SendGmailMessageInput = Readonly<{
  from: string;
  to: string;
  subject: string;
  body: string;
  request: GoogleApiRequest;
}>;

const getHeaderValue = (
  headers: readonly GmailHeader[],
  name: "From" | "Subject",
) =>
  headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())
    ?.value;

const toMailCandidate = (
  message: GmailMessageResponse,
): MailCandidate | undefined => {
  const headers = message.payload?.headers ?? [];
  const from = getHeaderValue(headers, "From");
  const subject = getHeaderValue(headers, "Subject");

  if (
    from === undefined ||
    subject === undefined ||
    message.internalDate === undefined
  ) {
    return undefined;
  }

  return {
    from,
    subject,
    receivedAt: new Date(Number(message.internalDate)),
  };
};

const assertSingleLineHeader = (value: string, name: string) => {
  if (/[\r\n]/.test(value)) {
    throw new Error(`${name}に改行を含めることはできません。`);
  }
};

const encodeGmailMessage = (
  from: string,
  to: string,
  subject: string,
  body: string,
) => {
  assertSingleLineHeader(from, "from");
  assertSingleLineHeader(to, "to");
  assertSingleLineHeader(subject, "subject");

  const encodedSubject = Buffer.from(subject).toString("base64");
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${encodedSubject}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message).toString("base64url");
};

export const buildCompletionMailQuery = (checkedAt: Date) => {
  const period = getTargetMonthPeriod(checkedAt);
  const startsAfter = Math.floor(period.startsAt.getTime() / 1000) - 1;
  const endsBefore = Math.floor(period.endsAt.getTime() / 1000);

  return [
    `from:${COMPLETION_MAIL_SENDER}`,
    `subject:"${COMPLETION_MAIL_SUBJECT}"`,
    `after:${startsAfter}`,
    `before:${endsBefore}`,
  ].join(" ");
};

export const searchCompletionMail = async ({
  checkedAt,
  request,
}: SearchCompletionMailInput): Promise<CompletionJudgement> => {
  const listResponse = await request<GmailMessageListResponse>({
    url: `${GMAIL_API_BASE_URL}/messages`,
    method: "GET",
    params: {
      q: buildCompletionMailQuery(checkedAt),
      includeSpamTrash: false,
      maxResults: 1,
    },
  });

  const messageId = listResponse.data.messages?.[0]?.id;

  if (messageId === undefined) {
    return judgeCompletion({ checkedAt, mails: [] });
  }

  const messageResponse = await request<GmailMessageResponse>({
    url: `${GMAIL_API_BASE_URL}/messages/${encodeURIComponent(messageId)}`,
    method: "GET",
    params: {
      format: "metadata",
    },
  });

  const mail = toMailCandidate(messageResponse.data);

  return judgeCompletion({
    checkedAt,
    mails: mail === undefined ? [] : [mail],
  });
};

export const sendGmailMessage = async ({
  from,
  to,
  subject,
  body,
  request,
}: SendGmailMessageInput) => {
  const response = await request<GmailSendResponse>({
    url: `${GMAIL_API_BASE_URL}/messages/send`,
    method: "POST",
    data: {
      raw: encodeGmailMessage(from, to, subject, body),
    },
  });

  return { messageId: response.data.id ?? null };
};
