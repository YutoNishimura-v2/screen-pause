import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const section = (source, start, end) => {
  const from = source.indexOf(start);
  assert.ok(from >= 0, start);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to < 0 ? undefined : to);
};

// Mirrors PauseWindow.waitSeconds in Shared/Domain.swift.
function waitSeconds(unlockCount, base = 10, growth = 2, cap = 60) {
  const clampedBase = Math.max(0, base);
  const clampedCap = Math.max(0, cap);
  if (clampedBase === 0 || clampedCap === 0) return 0;
  const attempt = Math.max(1, unlockCount);
  const factor = Math.max(1, growth);
  let seconds = Math.min(clampedBase, clampedCap);
  if (factor === 1) return seconds;
  for (let step = 1; step < attempt; step += 1) {
    if (seconds >= clampedCap) return clampedCap;
    seconds = Math.min(seconds * factor, clampedCap);
  }
  return seconds;
}

// Mirrors LocalDay.key: the calendar day in the device's current time zone.
function dayKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Mirrors Progress.unlockCount / recordUnlock and SharedState.pause(at:).
class UnlockCounter {
  key = null;
  count = 0;

  unlockCount(now, timeZone) {
    return this.key === dayKey(now, timeZone) ? this.count : 0;
  }

  recordUnlock(now, timeZone) {
    this.count = this.unlockCount(now, timeZone) + 1;
    this.key = dayKey(now, timeZone);
  }

  nextWait(now, timeZone, base = 10) {
    return waitSeconds(this.unlockCount(now, timeZone) + 1, base);
  }
}

const pad = (value) => String(value).padStart(2, '0');
const keyOf = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

// Mirrors Progress.monthCalendar with a Sunday-first calendar (weekday Sunday = 1).
function monthCalendar({ year, month, results = {}, lastKept = null, firstWeekday = 1 }) {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingEmptyDays = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 1 - firstWeekday + 7) % 7;
  const days = [];
  for (let day = 1; day <= count; day += 1) {
    const key = keyOf(year, month, day);
    let status;
    if (key in results) status = results[key] ? 'kept' : 'missed';
    else if (key === lastKept) status = 'kept';
    else status = 'noSchedule';
    days.push(status);
  }
  return { leadingEmptyDays, days };
}

// Mirrors PauseWindow.isPendingActive / pendingAction in Shared/Domain.swift.
const accessSeconds = 300;
const isPendingActive = (requestedAtMs, nowMs, waitSecondsValue) => {
  const elapsed = (nowMs - requestedAtMs) / 1000;
  return elapsed >= 0 && elapsed < waitSecondsValue + accessSeconds;
};

function pendingAction(requestedAtMs, nowMs, waitSecondsValue, strict = false) {
  if (strict || requestedAtMs == null || !isPendingActive(requestedAtMs, nowMs, waitSecondsValue)) {
    return { type: 'restart' };
  }
  const elapsed = (nowMs - requestedAtMs) / 1000;
  if (elapsed >= waitSecondsValue) return { type: 'unlock' };
  const remaining = Math.max(1, Math.ceil(waitSecondsValue - elapsed));
  return { type: 'waiting', remaining };
}

// Mirrors PausePreferences.isValid in Shared/Domain.swift.
const isValidPausePreferences = ({ seconds, message = '', escalating = false }) =>
  seconds >= 0 && seconds <= 30 && (!escalating || seconds > 0) && message.length <= 80;

// Mirrors Progress.recordResult.
function recordResult(results, key, kept, limit = 366) {
  if (results[key] !== false) results[key] = kept;
  for (const stale of Object.keys(results).sort().slice(0, -limit)) delete results[stale];
  return results;
}

test('the Nth unlock wait grows from the base and stops at the cap', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 50].map((n) => waitSeconds(n)), [10, 20, 40, 60, 60, 60]);
  assert.equal(waitSeconds(0), 10, 'N below 1 behaves as the first unlock');
  assert.equal(waitSeconds(3, 0), 0, 'a zero base never waits');
  assert.equal(waitSeconds(2, 15, 3, 50), 45);
  assert.equal(waitSeconds(3, 15, 3, 50), 50);
  assert.equal(waitSeconds(4, 30, 1, 60), 30, 'growth 1 keeps the base');
  assert.equal(waitSeconds(1, 90, 2, 60), 60, 'the base itself is capped');
  assert.equal(waitSeconds(10_000, 10, 1_000_000, 60), 60);

  const domain = read('../Shared/Domain.swift');
  const pause = section(domain, 'enum PauseWindow', 'struct PausePreferences');
  assert.match(pause, /static let escalationGrowth = 2\s+static let escalationCap = 60/);
  assert.match(pause, /static func waitSeconds\(\s+unlockCount: Int,\s+base: Int = Int\(wait\),\s+growth: Int = escalationGrowth,\s+cap: Int = escalationCap\s+\) -> Int/);
  assert.match(pause, /var seconds = min\(clampedBase, clampedCap\)\s+guard factor > 1 else \{ return seconds \}/);
  assert.match(pause, /multipliedReportingOverflow\(by: factor\)\s+seconds = overflow \? clampedCap : min\(product, clampedCap\)/);
});

test('the unlock counter resets at local midnight and follows a time zone change', () => {
  const counter = new UnlockCounter();
  const lateJst = new Date('2026-11-25T14:59:59.999Z'); // 23:59:59.999 JST
  const midnightJst = new Date('2026-11-25T15:00:00.000Z'); // 00:00 JST
  assert.equal(counter.nextWait(lateJst, 'Asia/Tokyo'), 10);
  counter.recordUnlock(lateJst, 'Asia/Tokyo');
  counter.recordUnlock(lateJst, 'Asia/Tokyo');
  assert.equal(counter.nextWait(lateJst, 'Asia/Tokyo'), 40);
  assert.equal(counter.unlockCount(midnightJst, 'Asia/Tokyo'), 0);
  assert.equal(counter.nextWait(midnightJst, 'Asia/Tokyo'), 10);

  // 04:30Z is still Nov 25 in New York but Nov 26 in Tokyo.
  const travel = new Date('2026-11-26T04:30:00.000Z');
  const traveller = new UnlockCounter();
  traveller.recordUnlock(travel, 'America/New_York');
  assert.equal(traveller.nextWait(travel, 'America/New_York'), 20);
  assert.equal(traveller.nextWait(travel, 'Asia/Tokyo'), 10, 'moving to a zone past midnight starts a new day');

  const domain = read('../Shared/Domain.swift');
  assert.match(domain, /enum LocalDay \{[\s\S]*?static func key\(at date: Date, calendar: Calendar\) -> String \{\s+let parts = calendar\.dateComponents\(\[\.year, \.month, \.day\], from: date\)/);
  assert.match(domain, /func unlockCount\(at now: Date, calendar: Calendar\) -> Int \{\s+guard unlockDayKey == LocalDay\.key\(at: now, calendar: calendar\) else \{ return 0 \}/);
  assert.match(domain, /mutating func recordUnlock\(at now: Date, calendar: Calendar\) \{\s+unlocksToday = unlockCount\(at: now, calendar: calendar\) \+ 1\s+unlockDayKey = LocalDay\.key\(at: now, calendar: calendar\)/);
  const state = read('../Shared/ScreenTime.swift');
  assert.match(state, /guard base\.isEscalating else \{ return base \}\s+let attempt = progress\.unlockCount\(at: now, calendar: calendar\) \+ 1\s+let seconds = PauseWindow\.waitSeconds\(unlockCount: attempt, base: base\.seconds\)/);
  // The only place a permit is granted counts the unlock.
  const action = read('../Action/Action.swift');
  assert.equal(action.match(/state\.permit = \.init/g)?.length, 1);
  assert.match(action, /state\.permit = \.init\(app: request\.app, date: now\)\s+state\.session\?\.kept = false\s+state\.progress\.recordUnlock\(at: now, calendar: \.current\)/);
});

test('free users keep the fixed wait and see the escalating option locked with one reason', () => {
  const state = read('../Shared/ScreenTime.swift');
  assert.match(state, /func configuredPause\(at now: Date\) -> PausePreferences \{\s+PaywallReason\.customPause\.isAvailable\(on: plan\(at: now\)\) \? customPause \?\? \.standard : \.standard/);
  assert.match(read('../Shared/Domain.swift'), /static let standard = Self\(seconds: Int\(PauseWindow\.wait\), message: ""\)/);
  const app = read('../App/ScreenPauseApp.swift');
  const locked = section(app, 'Button { paywall = .customPause } label: {', '.accessibilityIdentifier("home-custom-pause-locked")');
  assert.match(locked, /Label\("待ち時間とメッセージ", systemImage: "lock\.fill"\)/);
  const reasons = [...locked.matchAll(/Text\("([^"]+)"\)/g)].map(([, text]) => text);
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /^無料では待ち時間は\\\(Int\(PauseWindow\.wait\)\)秒固定です。[^。]+Pro で使えます。$/);
  // The editor edits the saved setting, not today's escalated wait, and rejects 0s + escalating.
  assert.match(app, /CustomPauseView\(preferences: snapshot\.configuredPause\(at: now\)\)/);
  const editor = read('../App/CustomPauseView.swift');
  assert.match(editor, /Toggle\("開くたびに待ち時間を延ばす", isOn: \$escalating\)/);
  assert.match(editor, /\.disabled\(seconds == 0 && !escalating\)/);
  assert.match(editor, /\.onChange\(of: seconds\) \{ _, newValue in\s+if newValue == 0 \{ escalating = false \}/);
  assert.match(editor, /\.disabled\(!draft\.isValid\)/);
  assert.match(editor, /escalating: escalating\s+\)\s+onSave\(try ScreenTime\.setCustomPause\(preferences\)\)/);
  assert.equal(isValidPausePreferences({ seconds: 0, escalating: false }), true);
  assert.equal(isValidPausePreferences({ seconds: 0, escalating: true }), false);
  assert.equal(isValidPausePreferences({ seconds: 1, escalating: true }), true);
  assert.deepEqual([1, 2, 3].map((n) => waitSeconds(n, 1)), [1, 2, 4]);
  assert.match(read('../Shared/Domain.swift'), /\(!isEscalating \|\| seconds > 0\)/);
  assert.match(state, /guard state\.settings != nil, preferences\.isValid else \{ throw Failure\.invalidSettings \}/);
});

test('the month calendar marks kept, missed and no-schedule days across month ends and leap February', () => {
  const results = { '2024-02-28': true, '2024-02-29': true, '2024-03-01': false };
  const feb = monthCalendar({ year: 2024, month: 2, results });
  assert.equal(feb.days.length, 29);
  assert.equal(feb.leadingEmptyDays, 4); // 2024-02-01 is a Thursday
  assert.equal(feb.days[26], 'noSchedule', 'days without stored results are never guessed');
  assert.equal(feb.days[27], 'kept');
  assert.equal(feb.days[28], 'kept', 'the leap day is kept');
  const mar = monthCalendar({ year: 2024, month: 3, results });
  assert.equal(mar.days.length, 31);
  assert.deepEqual(mar.days.slice(0, 5), ['missed', 'noSchedule', 'noSchedule', 'noSchedule', 'noSchedule']);
  assert.equal(monthCalendar({ year: 2023, month: 2 }).days.length, 28);
  assert.equal(monthCalendar({ year: 2100, month: 2 }).days.length, 28);

  // Month and year boundaries reflect only stored results.
  const dec = monthCalendar({ year: 2026, month: 12, results: { '2026-12-30': true, '2026-12-31': false } });
  const jan = monthCalendar({ year: 2027, month: 1, results: { '2027-01-01': true }, lastKept: '2027-01-04' });
  assert.equal(dec.days[29], 'kept');
  assert.equal(dec.days[30], 'missed');
  assert.equal(jan.leadingEmptyDays, 5); // 2027-01-01 is a Friday
  assert.deepEqual(jan.days.slice(0, 5), ['kept', 'noSchedule', 'noSchedule', 'kept', 'noSchedule']);
  const monday = monthCalendar({ year: 2027, month: 2, firstWeekday: 2 });
  assert.equal(monday.leadingEmptyDays, 0); // 2027-02-01 is a Monday

  // Adding a weekday on Wednesday never marks Tuesday missed, and an unfinished overnight session stays noSchedule.
  const addedTuesday = monthCalendar({ year: 2026, month: 11, results: { '2026-11-23': true } });
  assert.equal(addedTuesday.days[22], 'kept'); // Mon Nov 23
  assert.equal(addedTuesday.days[23], 'noSchedule'); // Tue Nov 24 was unscheduled
  const unfinishedOvernight = monthCalendar({ year: 2026, month: 11, results: { '2026-11-16': true } });
  assert.equal(unfinishedOvernight.days[22], 'noSchedule'); // Mon Nov 23 at 00:01 Tue before reconcile
  const reconciledFailure = monthCalendar({
    year: 2026, month: 11, results: { '2026-11-16': true, '2026-11-23': false },
  });
  assert.equal(reconciledFailure.days[22], 'missed');

  const kept = recordResult({}, '2026-11-02', false);
  assert.equal(recordResult(kept, '2026-11-02', true)['2026-11-02'], false, 'a missed day stays missed');
  const bounded = {};
  for (let day = 0; day < 400; day += 1) recordResult(bounded, `k${String(day).padStart(4, '0')}`, true);
  assert.equal(Object.keys(bounded).length, 366);
  assert.ok(!('k0000' in bounded) && 'k0399' in bounded);

  const domain = read('../Shared/Domain.swift');
  const calendar = section(domain, 'func monthCalendar(', 'func currentStreak');
  assert.match(calendar, /func monthCalendar\(for month: Date, calendar: Calendar\) -> MonthCalendarGrid/);
  assert.match(calendar, /calendar\.range\(of: \.day, in: \.month, for: monthStart\)/);
  assert.match(calendar, /let leadingEmptyDays = \(firstWeekday - calendar\.firstWeekday \+ 7\) % 7/);
  assert.match(calendar, /status = kept \? \.kept : \.missed/);
  assert.doesNotMatch(calendar, /schedules|trackingStart/);
  assert.match(domain, /recordResult\(day: day, kept: kept, calendar: calendar\)\s+guard kept else/);
  assert.match(domain, /if results\[key\] != false \{ results\[key\] = kept \}/);
  assert.match(domain, /dropLast\(Self\.resultDays\)/);
  assert.match(domain, /private static let resultDays = 366/);
  // The calendar must not widen the weekly comparison's history.
  assert.equal(domain.match(/historyStart = /g)?.length, 1);

  const reports = read('../App/ReportsView.swift');
  const streak = reports.indexOf('Section("連続日数")');
  const grid = reports.indexOf('Section("月ごとの記録")');
  assert.ok(streak > 0 && grid > streak, 'the current streak is shown above the month grid');
  assert.match(reports, /progress\.monthCalendar\(for: displayedMonth \?\? now, calendar: calendar\)/);
  assert.match(reports, /記録はこの端末だけに保存します。/);
});

test('the wait screen shows one calm sentence with the seconds and the app runs the countdown', () => {
  const appearance = read('../Shared/ShieldAppearance.swift');
  assert.match(appearance, /"今日 \\\(max\(1, attempt\)\)回目・\\\(max\(0, seconds\)\)秒"/);
  const status = section(appearance, 'static func waitStatus', '\n    }');
  const lines = [...status.matchAll(/"([^"]+)"/g)].map(([, text]) => text);
  assert.equal(lines.length, 2);
  for (const line of lines) {
    assert.equal(line.split('。').filter(Boolean).length <= 2, true, line);
    assert.doesNotMatch(line, /[「」『』]|ダメ|甘え|弱い|負け|意志|恥|情けない|言葉/);
  }
  assert.match(lines[0], /あと\\\(remainingSeconds\)秒$/);

  const shield = read('../Shield/Shield.swift');
  assert.doesNotMatch(shield, /Timer\(|TimelineView/);
  assert.match(shield, /ShieldAppearance\.attemptWaitLabel\(attempt: attempt, seconds: pause\.seconds\) \+ "\\n" \+ subtitle/);
  const app = read('../App/ScreenPauseApp.swift');
  assert.match(app, /if let pending = snapshot\.activePending\(at: now, calendar: calendar\)/);
  assert.match(app, /if snapshot\.activePending\(at: context\.date, calendar: calendar\) == pending/);
  assert.match(app, /TimelineView\(\.periodic\(from: pending\.date, by: 1\)\)/);
  assert.match(app, /requestedAt: pending\.date, now: context\.date, wait: pending\.wait/);
  const demo = read('../App/ShieldDemoView.swift');
  assert.match(demo, /TimelineView\(\.periodic\(from: requestedAt, by: 1\)\)/);
  assert.match(demo, /switch PauseWindow\.pendingAction\([\s\S]*case \.unlock:[\s\S]*dismiss\(\)[\s\S]*case \.restart:[\s\S]*requestedAt = now/);
  assert.match(demo, /case \.restart:\s+EmptyView\(\)/);
  assert.match(read('../Shared/Domain.swift'), /return max\(0, Int\(ceil\(remaining\)\)\)/);
});

test('overnight pending waits agree between home and shield action across midnight', () => {
  const counter = new UnlockCounter();
  const requestedAt = Date.parse('2026-11-23T23:59:35+09:00');
  counter.recordUnlock(requestedAt, 'Asia/Tokyo');
  counter.recordUnlock(requestedAt, 'Asia/Tokyo');
  const pendingWait = counter.nextWait(requestedAt, 'Asia/Tokyo');
  assert.equal(pendingWait, 40);

  const activePending = (pending, nowMs, blocking = true, strict = false, permit = false) =>
    blocking && !strict && !permit && pending != null
      && pending.wait === counter.nextWait(nowMs, 'Asia/Tokyo')
      && isPendingActive(pending.date, nowMs, pending.wait)
      ? pending
      : null;

  const pending = { date: requestedAt, wait: pendingWait };
  const beforeMidnight = Date.parse('2026-11-23T23:59:55+09:00');
  assert.deepEqual(activePending(pending, beforeMidnight), pending);

  const afterMidnight = Date.parse('2026-11-24T00:00:15+09:00');
  assert.equal(counter.nextWait(afterMidnight, 'Asia/Tokyo'), 10);
  // Both home display and action reuse must reject the stale 40s pending request after midnight.
  assert.equal(activePending(pending, afterMidnight), null);

  const screenTime = read('../Shared/ScreenTime.swift');
  const activeFn = section(screenTime, 'func activePending(', 'mutating func reconcile');
  assert.match(activeFn, /pending\.wait == Double\(pause\(at: now, calendar: calendar\)\.seconds\)/);
  assert.match(activeFn, /PauseWindow\.isPendingActive\(requestedAt: pending\.date, now: now, wait: pending\.wait\)/);
  assert.match(read('../Action/Action.swift'), /let seconds = state\.pause\(at: now, calendar: calendar\)\.seconds/);
  assert.match(read('../Action/Action.swift'), /pending\.wait == Double\(seconds\)/);
  assert.match(read('../Shield/Shield.swift'), /state\?\.activePending\(at: now\)/);
});

test('preview expiry at wait plus access matches the button restart behavior', () => {
  const requestedAt = 1_000_000;
  const wait = 10;
  assert.deepEqual(pendingAction(requestedAt, requestedAt + 9_000, wait), { type: 'waiting', remaining: 1 });
  assert.deepEqual(pendingAction(requestedAt, requestedAt + 10_000, wait), { type: 'unlock' });
  assert.deepEqual(pendingAction(requestedAt, requestedAt + 309_999, wait), { type: 'unlock' });
  assert.deepEqual(pendingAction(requestedAt, requestedAt + (wait + accessSeconds) * 1000, wait), { type: 'restart' });
  assert.deepEqual(pendingAction(requestedAt, requestedAt + 400_000, wait), { type: 'restart' });

  const domain = read('../Shared/Domain.swift');
  assert.match(domain, /enum PendingAction: Equatable/);
  assert.match(domain, /static func pendingAction\(/);
});

test('docs/benchmark.md covers the three points with valid file:line references and no product names', () => {
  const benchmark = read('../docs/benchmark.md');
  for (const heading of ['段階的な待ち時間', '月ごとの記録', '待ち時間の画面']) {
    assert.ok(benchmark.includes(heading), heading);
  }
  const refs = [...benchmark.matchAll(/([A-Za-z]+\/[A-Za-z]+\.(?:swift|md)):(\d+)(?:-(\d+))?/g)];
  assert.ok(refs.length >= 8, 'file:line references');
  for (const [, file, start, end] of refs) {
    const count = read(`../${file}`).split(/\r?\n/).length;
    for (const line of [start, end].filter(Boolean).map(Number)) {
      assert.ok(line >= 1 && line <= count, `${file}:${line}`);
    }
  }
  assert.doesNotMatch(benchmark, /19,977|19977|80万|800K|4\.6|4\.7/);
});
