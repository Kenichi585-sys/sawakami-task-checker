import "server-only";

import type { TargetMonth } from "@/domain/completion-check";
import { getSql } from "@/db/client";

export type ScheduleDay = 15 | 25;
export type ScheduledCheckResult = "completed" | "unconfirmed" | "error";
export type NotificationStatus = "succeeded" | "failed" | "skipped";

export type ScheduledCheckRecord = Readonly<{
  result: ScheduledCheckResult;
  gmailNotificationStatus: NotificationStatus;
  slackNotificationStatus: NotificationStatus;
}>;

type ScheduledCheckKey = Readonly<{
  targetMonth: TargetMonth;
  scheduleDay: ScheduleDay;
}>;

type ReserveScheduledCheckInput = ScheduledCheckKey &
  Readonly<{
    checkedAt: Date;
  }>;

type CompleteScheduledCheckInput = ScheduledCheckKey &
  Readonly<{
    result: ScheduledCheckResult;
    checkedAt: Date;
    completionMailReceivedAt: Date | null;
    gmailNotificationStatus: NotificationStatus;
    slackNotificationStatus: NotificationStatus;
  }>;

type ScheduledCheckRow = Readonly<{
  result: ScheduledCheckResult;
  gmail_notification_status: NotificationStatus;
  slack_notification_status: NotificationStatus;
}>;

const toTargetMonthDate = ({ year, month }: TargetMonth) =>
  `${year}-${String(month).padStart(2, "0")}-01`;

export const getScheduledCheck = async ({
  targetMonth,
  scheduleDay,
}: ScheduledCheckKey): Promise<ScheduledCheckRecord | null> => {
  const sql = getSql();
  const rows = await sql`
    SELECT result, gmail_notification_status, slack_notification_status
    FROM scheduled_checks
    WHERE target_month = ${toTargetMonthDate(targetMonth)}
      AND schedule_day = ${scheduleDay}
    LIMIT 1
  `;
  const row = rows[0] as ScheduledCheckRow | undefined;

  if (row === undefined) {
    return null;
  }

  return {
    result: row.result,
    gmailNotificationStatus: row.gmail_notification_status,
    slackNotificationStatus: row.slack_notification_status,
  };
};

export const reserveScheduledCheck = async ({
  targetMonth,
  scheduleDay,
  checkedAt,
}: ReserveScheduledCheckInput) => {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO scheduled_checks (
      target_month,
      schedule_day,
      result,
      checked_at,
      completion_mail_received_at,
      gmail_notification_status,
      slack_notification_status
    )
    VALUES (
      ${toTargetMonthDate(targetMonth)},
      ${scheduleDay},
      'error',
      ${checkedAt.toISOString()},
      NULL,
      'skipped',
      'skipped'
    )
    ON CONFLICT (target_month, schedule_day) DO NOTHING
    RETURNING target_month
  `;

  return rows.length === 1;
};

export const completeScheduledCheck = async ({
  targetMonth,
  scheduleDay,
  result,
  checkedAt,
  completionMailReceivedAt,
  gmailNotificationStatus,
  slackNotificationStatus,
}: CompleteScheduledCheckInput) => {
  const sql = getSql();
  const rows = await sql`
    UPDATE scheduled_checks
    SET result = ${result},
        checked_at = ${checkedAt.toISOString()},
        completion_mail_received_at = ${completionMailReceivedAt?.toISOString() ?? null},
        gmail_notification_status = ${gmailNotificationStatus},
        slack_notification_status = ${slackNotificationStatus}
    WHERE target_month = ${toTargetMonthDate(targetMonth)}
      AND schedule_day = ${scheduleDay}
    RETURNING target_month
  `;

  if (rows.length !== 1) {
    throw new Error("定期確認結果を更新できませんでした。");
  }
};
