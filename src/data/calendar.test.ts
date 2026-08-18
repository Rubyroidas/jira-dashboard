import { describe, expect, test } from '@jest/globals';

import { buildDayMarks, isNonWorkingDay, type CachedHoliday, type DayMarks } from './calendar';

/** Real 2026 Canadian entries from date.nager.at, as cached on disk. */
const LABOUR_DAY: CachedHoliday = { date: '2026-09-07', name: 'Labour Day', counties: [] };
const CIVIC_HOLIDAY: CachedHoliday = {
  date: '2026-08-03',
  name: 'Civic Holiday',
  counties: ['CA-MB', 'CA-NL', 'CA-NT', 'CA-NU', 'CA-ON'],
};
const BC_DAY: CachedHoliday = {
  date: '2026-08-03',
  name: 'British Columbia Day',
  counties: ['CA-BC'],
};
const GOLD_CUP: CachedHoliday = {
  date: '2026-08-17',
  name: 'Gold Cup Parade Day',
  counties: ['CA-PE'],
};
const DISCOVERY_DAY: CachedHoliday = {
  date: '2026-08-17',
  name: 'Discovery Day',
  counties: ['CA-YT'],
};

describe('buildDayMarks', () => {
  test('a nationwide holiday is observed everywhere', () => {
    const marks = buildDayMarks([LABOUR_DAY], 'CA-ON', []);

    expect(marks.get('2026-09-07')).toEqual({
      kind: 'holiday',
      label: 'Labour Day',
      observed: true,
    });
  });

  test('a nationwide holiday is observed even with no region configured', () => {
    const marks = buildDayMarks([LABOUR_DAY], null, []);

    expect(marks.get('2026-09-07')?.observed).toBe(true);
  });

  test('a regional holiday covering your region is observed, and keeps its bare name', () => {
    const marks = buildDayMarks([CIVIC_HOLIDAY], 'CA-ON', []);

    expect(marks.get('2026-08-03')).toEqual({
      kind: 'holiday',
      label: 'Civic Holiday',
      observed: true,
    });
  });

  // Regression guard for issue #1: a CA-ON user was shown Yukon and PEI holidays.
  test('holidays observed only in other regions are dropped once a region is set', () => {
    const marks = buildDayMarks([GOLD_CUP, DISCOVERY_DAY], 'CA-ON', []);

    expect(marks.has('2026-08-17')).toBe(false);
    expect(marks.size).toBe(0);
  });

  test('with no region set, other regions\u2019 holidays are merged into one unobserved mark', () => {
    const marks = buildDayMarks([GOLD_CUP, DISCOVERY_DAY], null, []);

    expect(marks.get('2026-08-17')).toEqual({
      kind: 'holiday',
      label: 'Gold Cup Parade Day / Discovery Day · CA-PE, CA-YT',
      observed: false,
    });
  });

  test('an observed holiday wins the date over a same-day regional one', () => {
    const marks = buildDayMarks([BC_DAY, CIVIC_HOLIDAY], 'CA-ON', []);

    expect(marks.get('2026-08-03')).toEqual({
      kind: 'holiday',
      label: 'Civic Holiday',
      observed: true,
    });
  });

  test('personal leave overrides a holiday on the same date', () => {
    const marks = buildDayMarks([LABOUR_DAY], 'CA-ON', [['2026-09-07', 'moving day']]);

    expect(marks.get('2026-09-07')).toEqual({
      kind: 'dayoff',
      label: 'moving day',
      observed: true,
    });
  });
});

describe('isNonWorkingDay', () => {
  const marks: DayMarks = buildDayMarks([LABOUR_DAY, GOLD_CUP], null, []);

  test('weekends are non-working whether or not they are marked', () => {
    expect(isNonWorkingDay('2026-08-15', marks)).toBe(true); // a bare Saturday
  });

  test('an observed holiday is non-working', () => {
    expect(isNonWorkingDay('2026-09-07', marks)).toBe(true);
  });

  test('a holiday observed only elsewhere is still a working day', () => {
    expect(isNonWorkingDay('2026-08-17', marks)).toBe(false); // Monday, CA-PE only
  });

  test('an unmarked weekday is a working day', () => {
    expect(isNonWorkingDay('2026-08-18', marks)).toBe(false);
  });
});
