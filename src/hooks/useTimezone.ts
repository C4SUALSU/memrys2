import { useCallback } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { useAuth } from '@/context/AuthContext';

export function useTimezone() {
  const { profile } = useAuth();
  const tz = profile?.timezone ?? 'UTC';

  const toLocal = useCallback((utcIso: string, fmt = 'PPp') => {
    try {
      const zoned = toZonedTime(parseISO(utcIso), tz);
      return format(zoned, fmt);
    } catch {
      return utcIso;
    }
  }, [tz]);

  const toLocalDate = useCallback((utcIso: string) => {
    try {
      return toZonedTime(parseISO(utcIso), tz);
    } catch {
      return new Date(utcIso);
    }
  }, [tz]);

  const toUTC = useCallback((localIso: string) => {
    try {
      return fromZonedTime(parseISO(localIso), tz).toISOString();
    } catch {
      return localIso;
    }
  }, [tz]);

  const formatEventTime = useCallback((start: string, end: string, isAllDay: boolean) => {
    if (isAllDay) {
      return format(parseISO(start), 'MMM d, yyyy');
    }
    const startLocal = toZonedTime(parseISO(start), tz);
    const endLocal = toZonedTime(parseISO(end), tz);
    return `${format(startLocal, 'MMM d, yyyy h:mm a')} — ${format(endLocal, 'h:mm a')}`;
  }, [tz]);

  const nowInTz = useCallback(() => {
    return toZonedTime(new Date(), tz);
  }, [tz]);

  const timezoneLabel = useCallback(() => {
    try {
      const offset = format(nowInTz(), 'xxx');
      return `${tz.replace(/_/g, ' ')} (UTC${offset})`;
    } catch {
      return tz;
    }
  }, [tz, nowInTz]);

  const relativeTime = useCallback((utcIso: string) => {
    try {
      return formatDistanceToNow(parseISO(utcIso), { addSuffix: true });
    } catch {
      return utcIso;
    }
  }, []);

  return { tz, toLocal, toLocalDate, toUTC, formatEventTime, nowInTz, timezoneLabel, relativeTime };
}
