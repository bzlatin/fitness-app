const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const clampTzOffsetMinutes = (value?: number | null): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const clamped = Math.max(-14 * 60, Math.min(14 * 60, Math.trunc(value)));
  return clamped;
};

const getUserLocalDate = (date: Date, tzOffsetMinutes: number): Date =>
  new Date(date.getTime() - tzOffsetMinutes * 60 * 1000);

const getUtcDateFromUserLocal = (
  localDate: Date,
  tzOffsetMinutes: number
): Date => new Date(localDate.getTime() + tzOffsetMinutes * 60 * 1000);

export const computeNextNotificationAt = ({
  userId,
  tzOffsetMinutes,
  now = new Date(),
  localHour = 15,
  localMinute = 0,
  windowMinutes = 30,
}: {
  userId: string;
  tzOffsetMinutes: number;
  now?: Date;
  localHour?: number;
  localMinute?: number;
  windowMinutes?: number;
}): Date => {
  const offsetMinutes =
    windowMinutes > 0 ? hashString(userId) % (windowMinutes + 1) : 0;
  const localNow = getUserLocalDate(now, tzOffsetMinutes);
  const localTarget = new Date(localNow.getTime());
  localTarget.setUTCHours(localHour, localMinute, 0, 0);
  localTarget.setUTCMinutes(localTarget.getUTCMinutes() + offsetMinutes);

  if (localNow.getTime() >= localTarget.getTime()) {
    localTarget.setUTCDate(localTarget.getUTCDate() + 1);
  }

  return getUtcDateFromUserLocal(localTarget, tzOffsetMinutes);
};
