CREATE TYPE scheduled_check_result AS ENUM (
  'completed',
  'unconfirmed',
  'error'
);

CREATE TYPE notification_status AS ENUM (
  'succeeded',
  'failed',
  'skipped'
);

CREATE TABLE scheduled_checks (
  target_month date NOT NULL,
  schedule_day smallint NOT NULL,
  result scheduled_check_result NOT NULL,
  checked_at timestamp with time zone NOT NULL,
  completion_mail_received_at timestamp with time zone,
  gmail_notification_status notification_status NOT NULL,
  slack_notification_status notification_status NOT NULL,
  PRIMARY KEY (target_month, schedule_day),
  CONSTRAINT scheduled_checks_schedule_day_check
    CHECK (schedule_day IN (15, 25))
);
