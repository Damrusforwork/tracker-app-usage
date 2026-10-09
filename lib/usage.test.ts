import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) },
}));

import {
  coalesceSessions,
  formatDuration,
  isDisplayable,
  mergeSessions,
  mergeWindow,
  summarizePackage,
  UsageSession,
} from './usage';
import { pruneSessions } from './prefs';

function session(partial: Partial<UsageSession> & { packageName: string }): UsageSession {
  const start = partial.startedAt ?? '2026-10-04T19:00:00.000+07:00';
  const end = partial.endedAt ?? '2026-10-04T19:05:00.000+07:00';
  return {
    id: `${partial.packageName}-${start}-${end}`,
    appName: partial.packageName,
    startedAt: start,
    endedAt: end,
    durationSeconds: 300,
    ...partial,
  };
}

describe('formatDuration', () => {
  it('shows seconds below one minute', () => {
    expect(formatDuration(45)).toBe('45 วินาที');
    expect(formatDuration(45, 'en')).toBe('45 sec');
  });
  it('shows minutes and hours', () => {
    expect(formatDuration(300)).toBe('5 นาที');
    expect(formatDuration(3900)).toBe('1 ชม. 5 นาที');
    expect(formatDuration(3900, 'en')).toBe('1h 5m');
  });
  it('precise mode shows h/m/s parts', () => {
    expect(formatDuration(3723, 'th', true)).toBe('1 ชม. 2 นาที 3 วินาที');
    expect(formatDuration(3723, 'en', true)).toBe('1h 2m 3s');
    expect(formatDuration(90, 'th', true)).toBe('1 นาที 30 วินาที');
  });
});

describe('coalesceSessions', () => {
  it('merges same-app sessions within gap', () => {
    const items = [
      session({ packageName: 'a', startedAt: '2026-10-04T19:00:00.000+07:00', endedAt: '2026-10-04T19:01:00.000+07:00', durationSeconds: 60 }),
      session({ packageName: 'a', startedAt: '2026-10-04T19:01:20.000+07:00', endedAt: '2026-10-04T19:02:00.000+07:00', durationSeconds: 40 }),
    ];
    const out = coalesceSessions(items);
    expect(out).toHaveLength(1);
    expect(out[0].durationSeconds).toBe(120);
  });
  it('keeps separate packages and wide gaps apart', () => {
    const items = [
      session({ packageName: 'a', startedAt: '2026-10-04T19:00:00.000+07:00', endedAt: '2026-10-04T19:01:00.000+07:00', durationSeconds: 60 }),
      session({ packageName: 'b', startedAt: '2026-10-04T19:01:20.000+07:00', endedAt: '2026-10-04T19:02:00.000+07:00', durationSeconds: 40 }),
      session({ packageName: 'a', startedAt: '2026-10-04T19:10:00.000+07:00', endedAt: '2026-10-04T19:11:00.000+07:00', durationSeconds: 60 }),
    ];
    expect(coalesceSessions(items)).toHaveLength(3);
  });
});

describe('mergeSessions', () => {
  it('incoming wins on same id and sorts desc', () => {
    const oldItem = session({ packageName: 'a', durationSeconds: 60 });
    const updated = session({ packageName: 'a', durationSeconds: 120 });
    const newer = session({ packageName: 'b', startedAt: '2026-10-04T20:00:00.000+07:00', endedAt: '2026-10-04T20:01:00.000+07:00', durationSeconds: 60 });
    const out = mergeSessions([oldItem], [updated, newer]);
    expect(out).toHaveLength(2);
    expect(out.find((s) => s.packageName === 'a')?.durationSeconds).toBe(120);
    expect(out[0].packageName).toBe('b');
  });
});

describe('mergeWindow', () => {
  it('keeps pre-window sessions and upserts the rest', () => {
    const windowStart = new Date('2026-10-04T19:00:00.000+07:00').getTime();
    const oldItem = session({ packageName: 'old', startedAt: '2026-10-04T18:00:00.000+07:00', endedAt: '2026-10-04T18:05:00.000+07:00', durationSeconds: 300 });
    const live = session({ packageName: 'live', startedAt: '2026-10-04T19:00:00.000+07:00', endedAt: '2026-10-04T19:01:00.000+07:00', durationSeconds: 60 });
    const out = mergeWindow([oldItem, live], [live], windowStart);
    expect(out.find((s) => s.packageName === 'old')).toBeDefined();
    expect(out.filter((s) => s.packageName === 'live')).toHaveLength(1);
  });
});

describe('isDisplayable', () => {
  it('hides package-style names', () => {
    expect(isDisplayable(session({ packageName: 'x', appName: 'com.foo.bar' }))).toBe(false);
    expect(isDisplayable(session({ packageName: 'x', appName: 'LINE' }))).toBe(true);
    expect(isDisplayable(session({ packageName: 'x', appName: '' }))).toBe(false);
  });
});

describe('summarizePackage', () => {
  it('returns null for unknown package and aggregates known ones', () => {
    expect(summarizePackage([], 'a')).toBeNull();
    const items = [
      session({ packageName: 'a', appName: 'A', startedAt: '2026-10-04T19:00:00.000+07:00', endedAt: '2026-10-04T19:01:00.000+07:00', durationSeconds: 60 }),
      session({ packageName: 'a', appName: 'A', startedAt: '2026-10-04T20:00:00.000+07:00', endedAt: '2026-10-04T20:02:00.000+07:00', durationSeconds: 120 }),
    ];
    const summary = summarizePackage(items, 'a');
    expect(summary?.launches).toBe(2);
    expect(summary?.totalSeconds).toBe(180);
    expect(summary?.lastOpened).toBe('2026-10-04T20:00:00.000+07:00');
  });
});

describe('pruneSessions', () => {
  it('drops sessions older than retention', () => {
    const now = new Date('2026-10-04T12:00:00.000+07:00');
    const oldItem = session({ packageName: 'a', startedAt: '2026-09-01T12:00:00.000+07:00', endedAt: '2026-09-01T12:01:00.000+07:00', durationSeconds: 60 });
    const fresh = session({ packageName: 'b' });
    expect(pruneSessions([oldItem, fresh], 7, now)).toHaveLength(1);
    expect(pruneSessions([oldItem, fresh], 0, now)).toHaveLength(2);
  });
});
