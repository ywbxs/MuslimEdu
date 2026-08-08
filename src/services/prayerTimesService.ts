import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

/**
 * Prayer times via the Aladhan API (https://aladhan.com/prayer-times-api),
 * a free, no-auth public REST API - the only 3rd-party (non-manhaje.com)
 * host this app calls, so it's kept isolated here rather than forced
 * through apiClient/API_BASE_URL, which are hardcoded to our own backend.
 *
 * Location is either the device's own GPS coordinates (preferred, if the
 * user grants location permission - see utils/geolocation.ts) via
 * Aladhan's /timings endpoint, or the school's own address
 * (fetchMySchoolBranding in academicSetupService.ts) via /timingsByAddress
 * as a fallback when permission is denied/unavailable. GPS is more
 * accurate than geocoding a free-text school address and doesn't depend
 * on the address being well-formed.
 */
const ALADHAN_BASE = 'https://api.aladhan.com/v1';
const CACHE_PREFIX = '@prayer_times_cache_v1';

// Muslim World League calculation method, per the feature request.
const CALCULATION_METHOD = 3;

const PRAYER_ORDER = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerName = (typeof PRAYER_ORDER)[number];

export interface PrayerTiming {
  name: PrayerName;
  /** "HH:mm" in 24h, local to the requested address - used for Date math. */
  time24: string;
  /** e.g. "5:02 AM" */
  timeLabel: string;
}

export interface PrayerTimesResult {
  gregorianLabel: string;
  hijriLabel: string;
  /** DD-MM-YYYY, Aladhan's own date param shape - handy for the day switcher. */
  dateKey: string;
  timings: PrayerTiming[];
}

export type PrayerLocation =
  | { kind: 'coords'; latitude: number; longitude: number }
  | { kind: 'address'; address: string };

function locationCacheKeyPart(location: PrayerLocation): string {
  // Coordinates are rounded to ~1km precision for the cache key - plenty
  // accurate for "which city's prayer times" and keeps a walk around the
  // block from missing the cache and refetching.
  return location.kind === 'coords'
    ? `geo:${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`
    : `addr:${location.address}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ddmmyyyy(date: Date): string {
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function to12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${suffix}`;
}

// Aladhan sometimes suffixes a timezone name, e.g. "05:02 (+03)" - strip
// anything past the HH:mm itself before it's used for display or Date math.
function stripTimingSuffix(raw: string): string {
  return raw.trim().slice(0, 5);
}

async function fetchTimingsForDate(location: PrayerLocation, date: Date): Promise<PrayerTimesResult> {
  const url =
    location.kind === 'coords'
      ? `${ALADHAN_BASE}/timings?latitude=${location.latitude}&longitude=${location.longitude}&method=${CALCULATION_METHOD}&date=${ddmmyyyy(date)}`
      : `${ALADHAN_BASE}/timingsByAddress?address=${encodeURIComponent(location.address)}&method=${CALCULATION_METHOD}&date=${ddmmyyyy(date)}`;
  const response = await fetch(url);
  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.code !== 200 || !data.data) {
    throw new Error('Could not load prayer times right now.');
  }

  const rawTimings: Record<string, string> = data.data.timings ?? {};
  const timings: PrayerTiming[] = PRAYER_ORDER.filter((name) => !!rawTimings[name]).map((name) => {
    const time24 = stripTimingSuffix(rawTimings[name]);
    return { name, time24, timeLabel: to12h(time24) };
  });

  const gregorian = data.data.date?.gregorian;
  const hijri = data.data.date?.hijri;
  const gregorianLabel = gregorian
    ? `${gregorian.weekday?.en ?? ''}, ${gregorian.day} ${gregorian.month?.en ?? ''}`.trim()
    : ddmmyyyy(date);
  const hijriLabel = hijri ? `${hijri.day} ${hijri.month?.en ?? ''} ${hijri.year} AH` : '';

  return { gregorianLabel, hijriLabel, dateKey: ddmmyyyy(date), timings };
}

/**
 * One network call per calendar day per location per account - cached via
 * the same cacheThenNetwork every other read-through cache in this app
 * uses (fetchFeed, fetchMySchedule, fetchMySchoolBranding, ...). `token`
 * is only used to namespace the cache key per-account, the same as every
 * other cache here - Aladhan itself needs no auth.
 */
export async function fetchPrayerTimes(token: string, location: PrayerLocation, date: Date = new Date()): Promise<PrayerTimesResult> {
  const cacheKey = cacheKeyFor(CACHE_PREFIX, token, locationCacheKeyPart(location), ddmmyyyy(date));
  return cacheThenNetwork(cacheKey, () => fetchTimingsForDate(location, date));
}

export interface NextPrayerInfo {
  current: PrayerTiming;
  next: PrayerTiming;
  msRemaining: number;
}

/**
 * Pure client-side Date math (no library) - matches the manual-timing
 * precedent already used by CaughtUpCard.tsx's Animated timing and
 * offlineQueue.ts's backoff. Only walks Fajr/Dhuhr/Asr/Maghrib/Isha (skips
 * Sunrise, which isn't a prayer) to decide "current"/"next"; wraps Isha ->
 * tomorrow's Fajr for the overnight case using the same timings (a day's
 * Fajr time is stable enough day-to-day for this purpose).
 */
export function computeNextPrayer(timings: PrayerTiming[], now: Date = new Date()): NextPrayerInfo | null {
  const prayers = timings.filter((t) => t.name !== 'Sunrise');
  if (prayers.length === 0) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const minutesOf = (t: PrayerTiming) => {
    const [h, m] = t.time24.split(':').map((n) => parseInt(n, 10));
    return h * 60 + m;
  };

  const upcoming = prayers.find((t) => minutesOf(t) > nowMinutes);

  if (upcoming) {
    const upcomingIndex = prayers.indexOf(upcoming);
    const current = prayers[upcomingIndex - 1] ?? prayers[prayers.length - 1];
    const msRemaining = Math.max(0, (minutesOf(upcoming) - nowMinutes) * 60 * 1000);
    return { current, next: upcoming, msRemaining };
  }

  // Past the last prayer of the day (Isha) - current is Isha, next is
  // tomorrow's Fajr, counted against tonight's midnight rollover.
  const current = prayers[prayers.length - 1];
  const fajr = prayers[0];
  const minutesUntilMidnight = 24 * 60 - nowMinutes;
  const msRemaining = Math.max(0, (minutesUntilMidnight + minutesOf(fajr)) * 60 * 1000);
  return { current, next: fajr, msRemaining };
}

export function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}
