-- M4: represent an eligible day with no submitted guess as a distinct Missed
-- outcome. Missed attempts have no start time because the player never began.

alter type public.daily_attempt_status add value if not exists 'missed' after 'failed';

alter table public.daily_attempts
  alter column started_at drop not null;

alter table public.daily_statistics
  add column missed integer not null default 0,
  add constraint daily_statistics_missed_nonnegative check (missed >= 0);
