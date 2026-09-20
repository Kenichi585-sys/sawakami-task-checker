import "server-only";

import {
  completeScheduledCheck,
  getScheduledCheck,
  reserveScheduledCheck,
  type NotificationStatus,
  type ScheduleDay,
  type ScheduledCheckRecord,
  type ScheduledCheckResult,
} from "@/db/scheduled-checks";
import {
  getTargetMonth,
  type CompletionJudgement,
  type TargetMonth,
} from "@/domain/completion-check";
import { searchCompletionMail, sendGmailMessage } from "@/google/gmail";
import {
  createGoogleApiRequest,
  isGoogleAuthenticationError,
} from "@/google/oauth";
import { sendSlackMessage } from "@/slack/webhook";

const TOKYO_TIME_ZONE = "Asia/Tokyo";

const tokyoDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TOKYO_TIME_ZONE,
  day: "numeric",
});

const receivedAtFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: TOKYO_TIME_ZONE,
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type ErrorJudgement = Readonly<{
  status: "error";
  reason: "authentication" | "other";
  targetMonth: TargetMonth;
  completionMailReceivedAt: null;
}>;

type CheckJudgement = CompletionJudgement | ErrorJudgement;

type NotificationMessage = Readonly<{
  subject: string;
  body: string;
}>;

export type ScheduledCheckDependencies = Readonly<{
  getScheduledCheck: typeof getScheduledCheck;
  reserveScheduledCheck: typeof reserveScheduledCheck;
  completeScheduledCheck: typeof completeScheduledCheck;
  searchCompletionMail: (checkedAt: Date) => Promise<CompletionJudgement>;
  sendGmailNotification: (message: NotificationMessage) => Promise<void>;
  sendSlackNotification: (text: string) => Promise<NotificationStatus>;
}>;

type RunScheduledCheckInput = Readonly<{
  checkedAt?: Date;
  dependencies?: ScheduledCheckDependencies;
}>;

export type RunScheduledCheckOutcome =
  | Readonly<{
      status: "skipped";
      reason: "not_schedule_day" | "completed_on_15th" | "already_recorded";
    }>
  | Readonly<{
      status: "executed";
      scheduleDay: ScheduleDay;
      result: ScheduledCheckResult;
      gmailNotificationStatus: NotificationStatus;
      slackNotificationStatus: NotificationStatus;
    }>;

const getRequiredEnvironmentVariable = (name: string) => {
  const value = process.env[name];

  if (value === undefined || value === "") {
    throw new Error(`${name}が設定されていません。`);
  }

  return value;
};

const getScheduleDay = (checkedAt: Date): ScheduleDay | null => {
  const day = Number(tokyoDayFormatter.format(checkedAt));

  return day === 15 || day === 25 ? day : null;
};

export const shouldSkip25thCheck = (record: ScheduledCheckRecord | null) =>
  record?.result === "completed" &&
  (record.gmailNotificationStatus === "succeeded" ||
    record.slackNotificationStatus === "succeeded");

export const buildNotificationMessage = (
  judgement: CheckJudgement,
): NotificationMessage => {
  const target = `${judgement.targetMonth.year}年${judgement.targetMonth.month}月分`;
  const subject = `【さわかみ投信】${target}の課題アンケート確認結果`;

  if (judgement.status === "completed") {
    return {
      subject,
      body: [
        `${target}の課題アンケートは提出済みです。`,
        `完了メールは${receivedAtFormatter.format(judgement.completionMailReceivedAt)}に届いています。`,
      ].join("\n"),
    };
  }

  if (judgement.status === "unconfirmed") {
    return {
      subject,
      body: `${target}の課題アンケート提出完了メールを確認できませんでした。`,
    };
  }

  return {
    subject,
    body:
      judgement.reason === "authentication"
        ? "Googleの認証が切れています。Gmailとの再接続が必要です。"
        : `${target}のGmail確認に失敗しました。手動で確認してください。`,
  };
};

const createDefaultDependencies = (): ScheduledCheckDependencies => ({
  getScheduledCheck,
  reserveScheduledCheck,
  completeScheduledCheck,
  searchCompletionMail: (checkedAt) =>
    searchCompletionMail({ checkedAt, request: createGoogleApiRequest() }),
  sendGmailNotification: async ({ subject, body }) => {
    await sendGmailMessage({
      from: getRequiredEnvironmentVariable("GMAIL_SENDER_ADDRESS"),
      to: getRequiredEnvironmentVariable("GMAIL_NOTIFICATION_TO"),
      subject,
      body,
      request: createGoogleApiRequest(),
    });
  },
  sendSlackNotification: (text) =>
    sendSlackMessage({
      text,
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
    }),
});

const getJudgement = async (
  checkedAt: Date,
  dependencies: ScheduledCheckDependencies,
): Promise<CheckJudgement> => {
  try {
    return await dependencies.searchCompletionMail(checkedAt);
  } catch (error) {
    return {
      status: "error",
      reason: isGoogleAuthenticationError(error) ? "authentication" : "other",
      targetMonth: getTargetMonth(checkedAt),
      completionMailReceivedAt: null,
    };
  }
};

type GmailNotificationAttempt = Readonly<{
  status: NotificationStatus;
  requiresReconnection: boolean;
}>;

const trySendGmailNotification = async (
  message: NotificationMessage,
  dependencies: ScheduledCheckDependencies,
  gmailAuthenticationAvailable: boolean,
): Promise<GmailNotificationAttempt> => {
  if (!gmailAuthenticationAvailable) {
    return { status: "failed", requiresReconnection: false };
  }

  try {
    await dependencies.sendGmailNotification(message);

    return { status: "succeeded", requiresReconnection: false };
  } catch (error) {
    return {
      status: "failed",
      requiresReconnection: isGoogleAuthenticationError(error),
    };
  }
};

const sendNotifications = async (
  message: NotificationMessage,
  dependencies: ScheduledCheckDependencies,
  gmailAuthenticationAvailable: boolean,
) => {
  const gmailNotification = await trySendGmailNotification(
    message,
    dependencies,
    gmailAuthenticationAvailable,
  );
  const slackText = gmailNotification.requiresReconnection
    ? `${message.subject}\n\n${message.body}\n\nGoogleの認証が切れています。Gmailとの再接続が必要です。`
    : `${message.subject}\n\n${message.body}`;
  const slackNotificationStatus = await dependencies
    .sendSlackNotification(slackText)
    .catch<NotificationStatus>(() => "failed");

  return {
    gmailNotificationStatus: gmailNotification.status,
    slackNotificationStatus,
  };
};

export const runScheduledCheck = async ({
  checkedAt = new Date(),
  dependencies = createDefaultDependencies(),
}: RunScheduledCheckInput = {}): Promise<RunScheduledCheckOutcome> => {
  const scheduleDay = getScheduleDay(checkedAt);

  if (scheduleDay === null) {
    return { status: "skipped", reason: "not_schedule_day" };
  }

  const targetMonth = getTargetMonth(checkedAt);

  if (scheduleDay === 25) {
    const fifteenthRecord = await dependencies.getScheduledCheck({
      targetMonth,
      scheduleDay: 15,
    });

    if (shouldSkip25thCheck(fifteenthRecord)) {
      return { status: "skipped", reason: "completed_on_15th" };
    }
  }

  const reserved = await dependencies.reserveScheduledCheck({
    targetMonth,
    scheduleDay,
    checkedAt,
  });

  if (!reserved) {
    return { status: "skipped", reason: "already_recorded" };
  }

  const judgement = await getJudgement(checkedAt, dependencies);
  const message = buildNotificationMessage(judgement);
  const gmailAuthenticationAvailable = !(
    judgement.status === "error" && judgement.reason === "authentication"
  );
  const notificationStatuses = await sendNotifications(
    message,
    dependencies,
    gmailAuthenticationAvailable,
  );

  await dependencies.completeScheduledCheck({
    targetMonth,
    scheduleDay,
    result: judgement.status,
    checkedAt,
    completionMailReceivedAt: judgement.completionMailReceivedAt,
    ...notificationStatuses,
  });

  return {
    status: "executed",
    scheduleDay,
    result: judgement.status,
    ...notificationStatuses,
  };
};
