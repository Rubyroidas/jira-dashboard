import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONFIG_DIR } from './config';
import { isWeekend } from '../dates';
import type { Config } from '../types';

export const HOLIDAY_CACHE_PATH = join(CONFIG_DIR, 'holidays.json');
export const DAYS_OFF_PATH = join(CONFIG_DIR, 'days-off.json');

const NAGER_URL = 'https://date.nager.at/api/v3/PublicHolidays';
const REQUEST_TIMEOUT_MS = 20_000;

/** Holiday tables get corrected after publication, so cached years expire. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type DayMarkKind = 'holiday' | 'dayoff';

export interface DayMark {
  kind: DayMarkKind;
  label: string;
  /**
   * Whether the day is actually off for *you*. Only reachable as `false` when
   * no region is configured: a holiday some regions observe — Canada's Civic
   * Holiday, say — is then still worth showing, since we cannot tell whether it
   * is yours, but it does not excuse an empty timesheet. Once `holidayRegion`
   * is set, holidays that miss it are dropped instead.
   */
  observed: boolean;
}

/** Non-working days keyed by local `YYYY-MM-DD` date. */
export type DayMarks = Map<string, DayMark>;

/** A day nobody is expected to log hours on. */
export function isNonWorkingDay(key: string, marks: DayMarks): boolean {
  return isWeekend(key) || marks.get(key)?.observed === true;
}

export interface CachedHoliday {
  date: string;
  name: string;
  /** Subdivisions observing it; absent or empty means the whole country does. */
  counties?: string[];
}

interface CachedYear {
  fetchedAt: string;
  days: CachedHoliday[];
}

/**
 * Bumped when the cached shape changes so old files are discarded rather than
 * misread. v1 stored only nationwide holidays; v2 keeps regional ones too.
 */
const CACHE_VERSION = 2;

interface HolidayCache {
  version: number;
  country: string | null;
  years: Record<string, CachedYear>;
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Statutory holidays plus personal days off across the given years.
 *
 * Never throws: a failed fetch falls back to whatever is cached, and a missing
 * cache to no holidays at all. A dashboard that starts without holiday colours
 * beats one that does not start.
 */
export async function loadDayMarks(config: Config, years: number[]): Promise<DayMarks> {
  return buildDayMarks(await loadHolidays(config, years), config.holidayRegion, readDaysOff());
}

/**
 * The marking rule on its own, free of network and disk so it can be tested
 * directly: which holidays survive, which count as days off, and how personal
 * leave overrides them.
 */
export function buildDayMarks(
  holidays: CachedHoliday[],
  region: string | null,
  daysOff: Array<[string, string]>,
): DayMarks {
  const marks: DayMarks = new Map();

  // One date can carry several regional holidays — Canada's first Monday in
  // August is Civic Holiday, Saskatchewan Day and BC Day at once — so they are
  // merged rather than overwriting each other.
  const regional = new Map<string, { names: string[]; counties: string[] }>();

  for (const holiday of holidays) {
    const counties = holiday.counties ?? [];
    const observed = counties.length === 0 || (region !== null && counties.includes(region));

    if (observed) {
      // An observed holiday always wins the date over merely-regional ones.
      marks.set(holiday.date, { kind: 'holiday', label: holiday.name, observed: true });
      continue;
    }

    // Once you have named your region, another region's holiday is simply not
    // yours — showing it only makes a working day look like a day off. Without
    // a region there is no way to tell, so they are listed instead.
    if (region !== null) continue;

    const group = regional.get(holiday.date) ?? { names: [], counties: [] };
    if (!group.names.includes(holiday.name)) group.names.push(holiday.name);
    for (const county of counties) if (!group.counties.includes(county)) group.counties.push(county);
    regional.set(holiday.date, group);
  }

  for (const [date, { names, counties }] of regional) {
    if (marks.has(date)) continue;
    // Naming the regions explains why the day is flagged but still yours to work.
    marks.set(date, {
      kind: 'holiday',
      label: `${names.join(' / ')} · ${counties.join(', ')}`,
      observed: false,
    });
  }

  // Personal leave wins over a holiday on the same date — it is the more
  // specific statement about the day.
  for (const [date, label] of daysOff) {
    marks.set(date, { kind: 'dayoff', label, observed: true });
  }

  return marks;
}

async function loadHolidays(config: Config, years: number[]): Promise<CachedHoliday[]> {
  const country = config.holidayCountry;
  if (!country) return [];

  const cached = readCache();
  // A different country makes every cached year meaningless. The region is not
  // part of the key: every holiday is cached with the regions observing it, so
  // changing region only re-reads what is already on disk.
  const cache: HolidayCache =
    cached && cached.country === country
      ? cached
      : { version: CACHE_VERSION, country, years: {} };

  const stale = years.filter((year) => !isFresh(cache.years[String(year)]));
  const fetched = await Promise.all(
    stale.map(async (year) => [year, await fetchYear(country, year)] as const),
  );

  let changed = false;
  for (const [year, days] of fetched) {
    if (!days) continue; // Fetch failed; keep any stale entry rather than losing it.
    cache.years[String(year)] = { fetchedAt: new Date().toISOString(), days };
    changed = true;
  }
  if (changed || cached !== cache) writeCache(cache);

  return years.flatMap((year) => cache.years[String(year)]?.days ?? []);
}

function isFresh(entry: CachedYear | undefined): boolean {
  if (!entry) return false;
  const age = Date.now() - Date.parse(entry.fetchedAt);
  return Number.isFinite(age) && age >= 0 && age < CACHE_TTL_MS;
}

interface NagerHoliday {
  date?: unknown;
  localName?: unknown;
  name?: unknown;
  global?: unknown;
  counties?: unknown;
}

/** `null` on any failure, so the caller can fall back to the cache. */
async function fetchYear(country: string, year: number): Promise<CachedHoliday[] | null> {
  try {
    const response = await fetch(`${NAGER_URL}/${year}/${country}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (!Array.isArray(body)) return null;

    const days: CachedHoliday[] = [];
    for (const entry of body as NagerHoliday[]) {
      const date = entry.date;
      if (typeof date !== 'string' || !DATE_KEY.test(date)) continue;
      // Regional holidays are kept, not dropped: which regions observe them is
      // decided at read time against the configured region.
      const counties =
        entry.global === true || !Array.isArray(entry.counties)
          ? []
          : entry.counties.filter((county): county is string => typeof county === 'string');
      const name = typeof entry.localName === 'string' ? entry.localName : entry.name;
      days.push({ date, name: typeof name === 'string' ? name : 'holiday', counties });
    }
    return days;
  } catch {
    return null;
  }
}

function readCache(): HolidayCache | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(HOLIDAY_CACHE_PATH, 'utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

  const { version, country, years } = parsed as Partial<HolidayCache>;
  if (version !== CACHE_VERSION) return null;
  if (typeof years !== 'object' || years === null) return null;

  return {
    version: CACHE_VERSION,
    country: typeof country === 'string' ? country : null,
    years,
  };
}

function writeCache(cache: HolidayCache): void {
  // Written via a temp file so a crash mid-write cannot leave truncated JSON
  // that every later run would have to throw away.
  const temp = `${HOLIDAY_CACHE_PATH}.tmp`;
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(temp, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
    renameSync(temp, HOLIDAY_CACHE_PATH);
  } catch {
    // A read-only config dir costs colours, not the session.
  }
}

/**
 * Hand-maintained leave from `days-off.json`. Accepts a bare array or
 * `{ "dates": [...] }`, holding either date strings or `{ date, label }`.
 * Malformed entries are skipped rather than failing the whole file.
 */
function readDaysOff(): Array<[string, string]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(DAYS_OFF_PATH, 'utf8'));
  } catch {
    return [];
  }

  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { dates?: unknown }).dates)
      ? ((parsed as { dates: unknown[] }).dates)
      : [];

  const days: Array<[string, string]> = [];
  for (const entry of list) {
    if (typeof entry === 'string') {
      if (DATE_KEY.test(entry)) days.push([entry, 'day off']);
      continue;
    }
    if (typeof entry !== 'object' || entry === null) continue;
    const { date, label } = entry as { date?: unknown; label?: unknown };
    if (typeof date !== 'string' || !DATE_KEY.test(date)) continue;
    days.push([date, typeof label === 'string' && label.trim() ? label.trim() : 'day off']);
  }
  return days;
}
