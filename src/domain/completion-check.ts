export const COMPLETION_MAIL_SUBJECT =
  "長期投資家デビュープロジェクト｜課題アンケート提出完了";
export const COMPLETION_MAIL_SENDER = "noreply@sawakami.co.jp";

const TOKYO_TIME_ZONE = "Asia/Tokyo";
const TOKYO_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1000;

const targetMonthFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TOKYO_TIME_ZONE,
  year: "numeric",
  month: "numeric",
});

export type TargetMonth = Readonly<{
  year: number;
  month: number;
}>;

export type TargetMonthPeriod = Readonly<{
  targetMonth: TargetMonth;
  startsAt: Date;
  endsAt: Date;
}>;

export type MailCandidate = Readonly<{
  from: string;
  subject: string;
  receivedAt: Date;
}>;

export type CompletionJudgement =
  | Readonly<{
      status: "completed";
      targetMonth: TargetMonth;
      completionMailReceivedAt: Date;
    }>
  | Readonly<{
      status: "unconfirmed";
      targetMonth: TargetMonth;
      completionMailReceivedAt: null;
    }>;

type JudgeCompletionInput = Readonly<{
  checkedAt: Date;
  mails: readonly MailCandidate[];
}>;

const assertValidDate = (date: Date, name: string) => {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`${name}には有効な日時を指定してください。`);
  }
};

const getDatePart = (
  parts: Intl.DateTimeFormatPart[],
  type: "year" | "month",
) => {
  const value = parts.find((part) => part.type === type)?.value;

  if (value === undefined) {
    throw new Error(`日本時間の${type}を取得できませんでした。`);
  }

  return Number(value);
};

const createTokyoMonthStart = (year: number, zeroBasedMonth: number) =>
  new Date(
    Date.UTC(year, zeroBasedMonth, 1, 0, 0, 0) - TOKYO_OFFSET_MILLISECONDS,
  );

const normalizeSenderAddress = (from: string) => {
  const addressInsideBrackets = from.match(/<([^<>]+)>/)?.[1];

  return (addressInsideBrackets ?? from).trim().toLowerCase();
};

export const getTargetMonth = (checkedAt: Date): TargetMonth => {
  assertValidDate(checkedAt, "checkedAt");

  const parts = targetMonthFormatter.formatToParts(checkedAt);

  return {
    year: getDatePart(parts, "year"),
    month: getDatePart(parts, "month"),
  };
};

export const getTargetMonthPeriod = (checkedAt: Date): TargetMonthPeriod => {
  const targetMonth = getTargetMonth(checkedAt);
  const zeroBasedMonth = targetMonth.month - 1;

  return {
    targetMonth,
    startsAt: createTokyoMonthStart(targetMonth.year, zeroBasedMonth),
    endsAt: createTokyoMonthStart(targetMonth.year, zeroBasedMonth + 1),
  };
};

export const judgeCompletion = ({
  checkedAt,
  mails,
}: JudgeCompletionInput): CompletionJudgement => {
  const period = getTargetMonthPeriod(checkedAt);
  const completionMail = mails.find((mail) => {
    const receivedAt = mail.receivedAt.getTime();

    return (
      normalizeSenderAddress(mail.from) === COMPLETION_MAIL_SENDER &&
      mail.subject === COMPLETION_MAIL_SUBJECT &&
      receivedAt >= period.startsAt.getTime() &&
      receivedAt < period.endsAt.getTime()
    );
  });

  if (completionMail === undefined) {
    return {
      status: "unconfirmed",
      targetMonth: period.targetMonth,
      completionMailReceivedAt: null,
    };
  }

  return {
    status: "completed",
    targetMonth: period.targetMonth,
    completionMailReceivedAt: completionMail.receivedAt,
  };
};
