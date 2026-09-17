import dayjs, { Dayjs } from 'dayjs';

export function dueDateForPeriod(period: string, rentDay: number | null | undefined): Dayjs {
  const month = dayjs(`${period}-01`);
  const lastDay = month.endOf('month').date();
  const configuredDay = rentDay ?? 10;
  const dueDay = configuredDay === 0 ? lastDay : Math.min(configuredDay, lastDay);
  return month.date(dueDay).startOf('day');
}

export function dueDateString(period: string, rentDay: number | null | undefined): string {
  return dueDateForPeriod(period, rentDay).format('YYYY-MM-DD');
}
