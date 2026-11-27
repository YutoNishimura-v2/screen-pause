import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import './icon-candidates.mjs';
import './first-minute.test.mjs';
import './escalation-calendar.test.mjs';
import './preview.test.mjs';

// Mirror Shared/Domain.swift with an explicit local calendar for these cases.
process.env.TZ = 'America/New_York';
const local = (day, hour = 0, minute = 0) => new Date(2026, 10, day, hour, minute);
const sameDay = (a, b) => a?.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const shiftDay = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const weekday = (date) => date.getDay() + 1;

function valid({ days, start, end }) {
  return days.length > 0 && days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)
    && [start, end].every((m) => Number.isInteger(m) && m >= 0 && m < 1440)
    && (end - start + 1440) % 1440 >= 15;
}

function activeDay(schedule, now) {
  if (!valid(schedule)) return null;
  const { days, start, end } = schedule;
  const minute = now.getHours() * 60 + now.getMinutes();
  let day;
  if (start < end) {
    if (minute < start || minute >= end) return null;
    day = shiftDay(now, 0);
  } else if (minute >= start) {
    day = shiftDay(now, 0);
  } else {
    if (minute >= end) return null;
    day = shiftDay(now, -1);
  }
  return days.includes(weekday(day)) ? day : null;
}

const wait = 10_000;
const access = 300_000;
const canUnlock = (requested, now, strict = false, duration = wait) =>
  !strict && now - requested >= duration && now - requested < duration + access;
const expires = (unlocked) => unlocked + access;
const isOpen = (unlocked, now) => now >= unlocked && now < expires(unlocked);
const isBlocking = (schedules, focusEnd, now) =>
  (focusEnd != null && now < focusEnd) || schedules.some((schedule) => activeDay(schedule, now) !== null);
const isStrict = (enabled, active) => enabled && active;
const renewalMargin = 7 * 24 * 60 * 60 * 1000;
const projectedEnd = ({ periodEnd, willAutoRenew }) =>
  periodEnd == null ? null : periodEnd + (willAutoRenew === true ? renewalMargin : 0);
const isPro = (access, now) => access != null && (projectedEnd(access) == null || now < projectedEnd(access));

class Progress {
  countDate;
  giveUps = 0;
  lastKept;
  streak = 0;

  count(now) {
    return sameDay(this.countDate, now) ? this.giveUps : 0;
  }

  giveUp(now) {
    this.giveUps = this.count(now) + 1;
    this.countDate = now;
  }

  finish(day, kept, schedule) {
    if (sameDay(this.lastKept, day)) return;
    if (!kept) {
      this.lastKept = undefined;
      this.streak = 0;
      return;
    }
    this.streak = this.currentStreak(day, schedule) + 1;
    this.lastKept = day;
  }

  currentStreak(day, schedule) {
    if (sameDay(this.lastKept, day)) return this.streak;
    if (!this.lastKept || day < this.lastKept) return 0;
    for (let offset = 1; offset <= 7; offset += 1) {
      const previous = shiftDay(day, -offset);
      if (schedule.days.includes(weekday(previous))) {
        return sameDay(this.lastKept, previous) ? this.streak : 0;
      }
    }
    return 0;
  }
}

const monday = { days: [2], start: 540, end: 600 };
const everyDay = { ...monday, days: [1, 2, 3, 4, 5, 6, 7] };

test('same-day range includes the start and excludes the end', () => {
  assert.equal(activeDay(monday, local(2, 8, 59)), null);
  assert.deepEqual(activeDay(monday, local(2, 9)), local(2));
  assert.deepEqual(activeDay(monday, local(2, 9, 59)), local(2));
  assert.equal(activeDay(monday, local(2, 10)), null);
});

test('same-day ranges only apply on the chosen weekdays', () => {
  assert.equal(activeDay(monday, local(3, 9)), null);
  assert.equal(activeDay(monday, local(1, 9)), null);
});

test('overnight range keeps its starting weekday across local midnight', () => {
  const overnight = { days: [7], start: 1380, end: 60 };
  assert.deepEqual(activeDay(overnight, local(7, 23)), local(7));
  assert.deepEqual(activeDay(overnight, local(8)), local(7));
  assert.deepEqual(activeDay(overnight, local(8, 0, 59)), local(7));
  assert.equal(activeDay(overnight, local(8, 1)), null);
  assert.equal(activeDay(overnight, local(7, 0, 30)), null);
});

test('invalid schedules never become active', () => {
  for (const change of [
    { days: [] }, { days: [0] }, { days: [2, 8] }, { start: -1 },
    { end: 1440 }, { end: 540 }, { end: 554 }, { start: 1435, end: 9 },
  ]) {
    const schedule = { ...monday, ...change };
    assert.equal(valid(schedule), false);
    assert.equal(activeDay(schedule, local(2, 9)), null);
  }
  assert.equal(valid({ ...monday, end: 555 }), true);
  assert.equal(valid({ ...monday, start: 1435, end: 10 }), true);
});

test('the 10-second wait precedes a five-minute window from actual unlock', () => {
  const requested = local(2, 9).getTime();
  const opened = requested + wait + 1500;
  assert.equal(canUnlock(requested, requested - 1), false);
  assert.equal(canUnlock(requested, requested + 9_999), false);
  assert.equal(canUnlock(requested, requested + 10_000), true);
  assert.equal(canUnlock(requested, opened), true);
  assert.equal(canUnlock(requested, requested + 310_000), false);
  assert.equal(isOpen(opened, opened - 1), false);
  assert.equal(isOpen(opened, opened), true);
  assert.equal(expires(opened), opened + 300_000);
  assert.equal(isOpen(opened, opened + 299_999), true);
  assert.equal(isOpen(opened, opened + 300_000), false);
});

test('give-ups roll over at local midnight independently of streak', () => {
  const progress = new Progress();
  progress.finish(local(1), true, everyDay);
  progress.giveUp(local(1, 19, 30));
  progress.giveUp(local(1, 23, 59));
  assert.equal(progress.count(local(1, 23, 59)), 2);
  assert.equal(progress.count(local(2)), 0);
  assert.equal(progress.currentStreak(local(2), everyDay), 1);
  progress.giveUp(local(2));
  assert.equal(progress.count(local(2)), 1);
});

test('custom wait changes both unlock boundaries and still respects strict mode', () => {
  const duration = 25_000;
  assert.equal(canUnlock(0, 24_999, false, duration), false);
  assert.equal(canUnlock(0, 25_000, false, duration), true);
  assert.equal(canUnlock(0, 25_000, true, duration), false);
  assert.equal(canUnlock(0, 324_999, false, duration), true);
  assert.equal(canUnlock(0, 325_000, false, duration), false);
});

test('zero and maximum waits enforce the exact opening and request expiry boundaries', () => {
  const domain = readFileSync(new URL('../Shared/Domain.swift', import.meta.url), 'utf8');
  const range = domain.match(/static let secondsRange = (\d+)\.\.\.(\d+)/);
  assert.ok(range);
  assert.deepEqual(range.slice(1).map(Number), [0, 60]);
  for (const duration of [0, 60_000]) {
    assert.equal(canUnlock(0, duration - 1, false, duration), false);
    assert.equal(canUnlock(0, duration, false, duration), true);
    assert.equal(canUnlock(0, duration, true, duration), false);
    assert.equal(canUnlock(0, duration + access - 1, false, duration), true);
    assert.equal(canUnlock(0, duration + access, false, duration), false);
  }
  assert.match(domain, /!strict && elapsed >= wait && elapsed < wait \+ access/);
  const action = readFileSync(new URL('../Action/Action.swift', import.meta.url), 'utf8');
  assert.match(action, /Date\.now >= request\.date\.addingTimeInterval\(request\.wait\)/);
  assert.match(action, /PauseWindow\.canUnlock\(requestedAt: request\.date, now: now,\s+strict: state\.isStrict\(at: now\), wait: request\.wait\)/);
});

test('a JST midnight during a block resets the stop count but keeps the same overnight session', () => {
  const previousZone = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Tokyo';
    const before = new Date('2026-11-25T14:59:59.999Z');
    const midnight = new Date('2026-11-25T15:00:00.000Z');
    const overnight = { days: [4], start: 1380, end: 60 };
    const progress = new Progress();
    const sessionDay = activeDay(overnight, before);
    assert.deepEqual(sessionDay, local(25));
    progress.giveUp(before);
    assert.equal(progress.count(before), 1);
    assert.equal(progress.count(midnight), 0);
    assert.deepEqual(activeDay(overnight, midnight), sessionDay);
    assert.equal(isBlocking([overnight], null, midnight), true);
    progress.giveUp(midnight);
    assert.equal(progress.count(midnight), 1);
  } finally {
    process.env.TZ = previousZone;
  }
});

test('a missed scheduled day clears the streak without borrowing stops from another day', () => {
  const progress = new Progress();
  for (const day of [2, 3]) {
    progress.giveUp(local(day, 9));
    progress.finish(local(day), true, everyDay);
  }
  assert.equal(progress.currentStreak(local(4), everyDay), 2);
  assert.equal(progress.count(local(4)), 0);
  assert.equal(progress.currentStreak(local(5), everyDay), 0);
  progress.giveUp(local(5, 9));
  progress.finish(local(5), true, everyDay);
  assert.equal(progress.count(local(5)), 1);
  assert.equal(progress.currentStreak(local(5), everyDay), 1);
});

test('Pro expiry invalidates a pending custom wait but retains the primary block and standard wait', () => {
  const activeAt = +local(2, 9);
  const periodEnd = activeAt + 5_000;
  const entitlement = { periodEnd, willAutoRenew: false };
  const customWait = 30_000;
  const effectiveWait = now => isPro(entitlement, now) ? customWait : wait;
  const canFinish = (requested, pendingWait, now) =>
    isBlocking([monday], null, new Date(now)) && pendingWait === effectiveWait(now)
      && canUnlock(requested, now, false, pendingWait);
  assert.equal(effectiveWait(periodEnd - 1), 30_000);
  assert.equal(effectiveWait(periodEnd), 10_000);
  assert.equal(isBlocking([monday], null, new Date(periodEnd)), true);
  assert.equal(canFinish(activeAt, customWait, activeAt + customWait), false);
  assert.equal(canFinish(periodEnd, wait, periodEnd + wait - 1), false);
  assert.equal(canFinish(periodEnd, wait, periodEnd + wait), true);
  const state = readFileSync(new URL('../Shared/ScreenTime.swift', import.meta.url), 'utf8');
  const action = readFileSync(new URL('../Action/Action.swift', import.meta.url), 'utf8');
  const shield = readFileSync(new URL('../Shield/Shield.swift', import.meta.url), 'utf8');
  assert.match(state, /PaywallReason\.customPause\.isAvailable\(on: plan\(at: now\)\) \? customPause \?\? \.standard : \.standard/);
  assert.match(state, /let multipleSchedules = PaywallReason\.secondSchedule\.isAvailable\(on: plan\(at: now\)\)/);
  assert.match(state, /schedules: multipleSchedules \? settings\.schedules : \[settings\.schedule\]/);
  assert.match(action, /pending\.wait == Double\(seconds\)/);
  assert.match(action, /request\.wait == Double\(state\.pause\(at: now\)\.seconds\)/);
  assert.match(shield, /ShieldAppearance\.secondary\(seconds: pause\.seconds\)/);
});

function savedTime(daily, baseline, week, today) {
  const baselineDays = Array.from({ length: 7 }, (_, offset) => shiftDay(baseline, offset));
  if (today <= baselineDays[6] || baselineDays.some(day => !daily.has(+day))) return null;
  if (week <= baselineDays[6]) return null;
  const currentDays = [];
  for (let day = week; day < today; day = shiftDay(day, 1)) currentDays.push(day);
  if (!currentDays.length || currentDays.length > 6 || currentDays.some(day => !daily.has(+day))) {
    return null;
  }
  const sum = days => days.reduce((total, day) => total + daily.get(+day), 0);
  return Math.max(0, sum(baselineDays.slice(0, currentDays.length)) - sum(currentDays));
}

test('saved time compares equal numbers of completed days across the daylight saving change', () => {
  const baseline = local(1);
  const week = local(9);
  const daily = new Map(Array.from({ length: 7 }, (_, index) => [+local(1 + index), 3600]));
  daily.set(+week, 1800);
  daily.set(+local(10), 0);
  daily.set(+local(11), 9000); // Today may still change.
  assert.equal(savedTime(daily, baseline, week, local(11)), 5400);
  assert.equal(savedTime(daily, baseline, week, week), null);
  assert.equal(savedTime(daily, baseline, local(2), local(6)), null);
  daily.set(+local(10), 9000);
  assert.equal(savedTime(daily, baseline, week, local(11)), 0);
  daily.delete(+local(7));
  assert.equal(savedTime(daily, baseline, week, local(11)), null);
});

test('a fresh report fills omitted zero-use days without inventing expired history', () => {
  const daily = new Map([[+local(2), 60], [+local(4), 120]]);
  const first = Math.min(...daily.keys());
  const updated = local(6, 12);
  for (let day = local(1); day <= local(7); day = shiftDay(day, 1)) {
    if (+day >= first && day <= updated && !daily.has(+day)) daily.set(+day, 0);
  }
  assert.deepEqual(Array.from({ length: 7 }, (_, i) => daily.get(+local(1 + i))),
    [undefined, 60, 0, 120, 0, 0, undefined]);
  const report = readFileSync(new URL('../Report/UsageReport.swift', import.meta.url), 'utf8');
  const periods = readFileSync(new URL('../Shared/UsagePeriods.swift', import.meta.url), 'utf8');
  assert.match(report, /fillZeroDays\([^)]*updatedAt: data\.lastUpdatedDate/s);
  assert.match(periods, /day >= firstObserved, day <= updatedAt, daily\[day\] == nil/);
});

test('an expired or overlapping baseline falls back to this week and at least yesterday', () => {
  const week = local(23);
  const comparisonStart = start =>
    start >= shiftDay(week, -35) && shiftDay(start, 7) <= week ? start : null;
  assert.deepEqual(comparisonStart(shiftDay(week, -35)), shiftDay(week, -35));
  assert.equal(comparisonStart(shiftDay(week, -36)), null);
  assert.equal(comparisonStart(local(17)), null);
  const periods = readFileSync(new URL('../Shared/UsagePeriods.swift', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../App/ReportsView.swift', import.meta.url), 'utf8');
  assert.match(periods, /value: -35, to: week/);
  assert.match(app, /comparisonStart == nil \? \.currentUsage : \.selectedUsage/);
  assert.match(app, /let yesterday = calendar\.date\(byAdding: \.day, value: -1, to: today\)/);
  assert.match(app, /let start = comparisonStart \?\? min\(week, yesterday\)/);
  assert.match(app, /\.hourly\(during: DateInterval\(start: start, end: end\)\)/);
});

function widgetEntries({ now, schedules, focusEnd, entitlement, progress }) {
  const midnight = shiftDay(now, 1);
  const dates = new Set([+now, +midnight]);
  const minutes = new Set(schedules.filter(valid).flatMap(({ start, end }) => [start, end]));
  // Walk actual minutes to model Calendar's strict matches and repeated local times.
  const minuteMs = 60_000;
  let previousOffset = now.getTimezoneOffset();
  for (let time = (Math.floor(+now / minuteMs) + 1) * minuteMs; time < +midnight; time += minuteMs) {
    const date = new Date(time);
    const offset = date.getTimezoneOffset();
    if (minutes.has(date.getHours() * 60 + date.getMinutes()) || offset !== previousOffset) dates.add(time);
    previousOffset = offset;
  }
  for (const boundary of [focusEnd, entitlement && projectedEnd(entitlement)]) {
    if (boundary != null && boundary > now && boundary < midnight) dates.add(+boundary);
  }
  return [...dates].sort((a, b) => a - b).map(time => {
    const date = new Date(time);
    const activeSchedules = isPro(entitlement, date) ? schedules : schedules.slice(0, 1);
    const status = focusEnd > date ? 'focus' : isBlocking(activeSchedules, null, date) ? 'scheduled' : 'idle';
    return { date, count: progress.count(date), status };
  });
}

test('widget entries refresh focus and schedule boundaries and reset the count at midnight', () => {
  const now = local(2, 8, 45);
  const progress = new Progress();
  progress.giveUp(now);
  const input = { now, schedules: [monday], focusEnd: local(2, 9, 30), entitlement: {}, progress };
  assert.deepEqual(widgetEntries(input), [
    { date: now, count: 1, status: 'focus' },
    { date: local(2, 9), count: 1, status: 'focus' },
    { date: local(2, 9, 30), count: 1, status: 'scheduled' },
    { date: local(2, 10), count: 1, status: 'idle' },
    { date: local(3), count: 0, status: 'idle' },
  ]);
  const expiry = local(2, 9, 15);
  assert.deepEqual(widgetEntries({ ...input, entitlement: { periodEnd: +expiry } })[2],
    { date: expiry, count: 1, status: 'focus' });
  assert.deepEqual(widgetEntries({ ...input, entitlement: null })[0],
    { date: now, count: 1, status: 'focus' });
});

test('widget midnight keeps an overnight session active while clearing the count', () => {
  const now = local(7, 23, 50);
  const progress = new Progress();
  progress.giveUp(now);
  const schedules = [{ days: [7], start: 1380, end: 60 }];
  assert.deepEqual(widgetEntries({ now, schedules, entitlement: {}, progress }).at(-1),
    { date: local(8), count: 0, status: 'scheduled' });
});

test('widget entries account for both copies of a repeated local hour', () => {
  const entries = widgetEntries({
    now: local(1), schedules: [{ days: [1], start: 75, end: 105 }], entitlement: {}, progress: new Progress(),
  });
  assert.deepEqual(entries.slice(1, -1).map(({ date, status }) => [date.toISOString(), status]), [
    ['2026-11-01T05:15:00.000Z', 'scheduled'],
    ['2026-11-01T05:45:00.000Z', 'idle'],
    ['2026-11-01T06:00:00.000Z', 'idle'],
    ['2026-11-01T06:15:00.000Z', 'scheduled'],
    ['2026-11-01T06:45:00.000Z', 'idle'],
  ]);
});

test('report and widget targets are embedded and read their respective data sources', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  const project = read('../project.yml');
  for (const target of ['PauseReport', 'PauseWidgets']) {
    assert.match(project, new RegExp(`- target: ${target}\\s+embed: true`));
  }
  assert.match(project, /EXExtensionPointIdentifier: com\.apple\.deviceactivityui\.report-extension/);
  assert.match(project, /NSExtensionPointIdentifier: com\.apple\.widgetkit-extension/);
  assert.match(read('../Shared/UsagePeriods.swift'), /^import SwiftUI$/m);
  assert.match(read('../Report/UsageReport.swift'), /for await segment in data\.activitySegments/);
  assert.match(read('../Widgets/PauseWidget.swift'), /ScreenTime\.readWidgetState\(\)/);
  assert.match(read('../Shared/ScreenTime.swift'), /WidgetCenter\.shared\.reloadAllTimelines\(\)/);
});

test('generated report and widget property lists follow the other XcodeGen targets', () => {
  const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(ignore, /^\/Report\/Info\.plist\r?$/m);
  assert.match(ignore, /^\/Widgets\/Info\.plist\r?$/m);
});

test('saving Pro pause preferences reapplies shields and resets a stale failure', () => {
  const shared = readFileSync(new URL('../Shared/ScreenTime.swift', import.meta.url), 'utf8');
  const setter = shared.slice(shared.indexOf('static func setCustomPause'), shared.indexOf('static func updateAccess'));
  assert.match(setter, /try transaction\(applyShields: true\)/);
  assert.match(setter, /if state\.customPause != preferences \{\s+state\.pending = nil\s+state\.unlockFailed = false/);
});

test('the report filter requests selected apps and categories for the current user and device', () => {
  const report = readFileSync(new URL('../App/ReportsView.swift', import.meta.url), 'utf8');
  assert.match(report, /applications: selection\.applicationTokens,\s+categories: selection\.categoryTokens/);
  assert.doesNotMatch(report, /\b(users|devices):/);
});

test('streak increments once per kept day and resets after a missed or unlocked day', () => {
  const progress = new Progress();
  progress.finish(local(2), true, everyDay);
  progress.finish(local(3), true, everyDay);
  progress.finish(local(3), true, everyDay);
  assert.equal(progress.currentStreak(local(3), everyDay), 2);
  assert.equal(progress.currentStreak(local(4), everyDay), 2);
  assert.equal(progress.currentStreak(local(5), everyDay), 0);
  progress.finish(local(5), true, everyDay);
  assert.equal(progress.currentStreak(local(5), everyDay), 1);
  progress.finish(local(6), false, everyDay);
  assert.equal(progress.currentStreak(local(6), everyDay), 0);
});

test('days off preserve streak and consecutive scheduled Mondays extend it', () => {
  const progress = new Progress();
  progress.finish(local(2), true, monday);
  assert.equal(progress.currentStreak(local(8), monday), 1);
  progress.finish(local(9), true, monday);
  assert.equal(progress.currentStreak(local(9), monday), 2);
  assert.equal(progress.currentStreak(local(17), monday), 0);
});

function assertFreeReportRoute() {
  const app = readFileSync(new URL('../App/ScreenPauseApp.swift', import.meta.url), 'utf8');
  const reports = readFileSync(new URL('../App/ReportsView.swift', import.meta.url), 'utf8');
  const home = app.slice(app.indexOf('private var homeForm:'), app.indexOf('private var draft:'));
  const route = home.match(
    /^ {12}Section \{\s+if let settings = snapshot\.settings \{\s+NavigationLink\("利用時間を見る"\) \{([^}]+)\}/m
  )?.[1];
  assert.ok(route, 'the report link must sit directly under the app-selection check');
  assert.match(route, /ReportsView\(selection: settings\.selection, baselineStart: snapshot\.baselineStart/);
  assert.doesNotMatch(home, /Button\("利用時間を見る"\)/);
  const usage = reports.slice(0, reports.indexOf('struct ProgressHistoryView'));
  assert.doesNotMatch(usage, /Paywall|ProAccess|\.plan\(/);
  assert.match(usage, /DeviceActivityReport\(context, filter: DeviceActivityFilter\(/);
  assert.match(usage, /applications: selection\.applicationTokens,\s+categories: selection\.categoryTokens/);
}

test('a user without Pro opens the selected apps report from home', () => {
  assertFreeReportRoute();
});

test('the first screen explains the Screen Time difference in one Japanese line', () => {
  const app = readFileSync(new URL('../App/ScreenPauseApp.swift', import.meta.url), 'utf8');
  const intro = app.split('private var permissionForm:')[1]?.split('private var setupActionTitle:')[0];
  assert.match(app, /@State private var step = Step\.permission/);
  assert.match(intro, /setupHeading\([^\n]+detail: "スクリーンタイムと違い、[^"\n]*開く前に[^"\n]*開かずに戻れた回数を記録[^"\n]*。"/);
});

test('welcome leads through iOS consent and the app picker directly to an active limit', () => {
  const app = readFileSync(new URL('../App/ScreenPauseApp.swift', import.meta.url), 'utf8');
  const screenTime = readFileSync(new URL('../Shared/ScreenTime.swift', import.meta.url), 'utf8');
  const entry = app.slice(app.indexOf('private var permissionForm:'), app.indexOf('private func setupHeading'));
  const setup = app.slice(app.indexOf('private func beginSetup'), app.indexOf('private func restore()'));
  const save = app.slice(app.indexOf('private func save()'), app.indexOf('private func removeSchedule'));
  assert.match(entry, /Button\(setupActionTitle\) \{\s+Task \{ await beginSetup\(\) \}/);
  assert.match(setup, /await authorize\(\)[\s\S]*?guard authorization\.authorizationStatus == \.approved[\s\S]*?openPicker\(\)/);
  assert.match(setup, /requestAuthorization\(for: \.individual\)/);
  assert.match(app, /\.sheet\(isPresented: \$picker\) \{ appPicker \}/);
  assert.match(entry, /FamilyActivityPicker\(selection: \$pickerSelection\)/);
  assert.match(entry, /Button\(pickerActionTitle, action: confirmApps\)[\s\S]*?\.disabled\(!demo && !ScreenTime\.hasApps\(pickerSelection\)\)/);
  assert.match(entry, /今から1時間の制限を始める/);
  assert.match(entry, /private func confirmApps\(\) \{\s+selection = pickerSelection\s+if step == \.permission \|\| step == \.home \{\s+pickerSaveError = nil\s+save\(\)\s+guard pickerSaveError == nil, step == \.home else \{ return \}\s+\}\s+picker = false\s+\}/);
  assert.match(save, /let firstStart = demo \? demoStart : \.now\s+let schedule = step == \.schedule \? draft : snapshot\.settings\?\.schedule \?\? immediateSchedule\(at: firstStart\)/);
  assert.match(app, /start: minute, end: \(minute \+ 60\) % 1440/);
  assert.match(save, /snapshot = try ScreenTime\.install\(settings, replacingRevokedSelection: recovering\)\s+needsAppReselection = false\s+now = \.now\s+errorMessage = nil\s+step = \.home/);
  assert.match(screenTime, /static func install\([\s\S]*?transaction\(applyShields: true/);
  assert.doesNotMatch(app, /case \.apps:|prepareSchedule|setup-schedule/);
});

test('App Review and the device checklist use the live onboarding actions', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  const app = read('../App/ScreenPauseApp.swift');
  const instructions = ['../docs/app-store/review-notes.ja.md', '../README.md'].map(read);
  for (const label of ['許可してアプリを選ぶ', '今から1時間の制限を始める']) {
    assert.ok(app.includes(`"${label}"`), label);
    for (const doc of instructions) assert.ok(doc.includes(`「${label}」`), label);
  }
  for (const doc of instructions) assert.doesNotMatch(doc, /この時間で始める/);
});

test('authorization loss explains the state in Japanese and returns to retry or Settings', () => {
  const app = readFileSync(new URL('../App/ScreenPauseApp.swift', import.meta.url), 'utf8');
  const issues = app.match(/private enum PermissionIssue: String \{([^}]+)\}/)?.[1];
  assert.ok(issues);
  const messages = [...issues.matchAll(/case (\w+) = "([^"]+)"/g)];
  assert.deepEqual(messages.map(([, state]) => state), ['denied', 'revoked', 'restricted', 'unavailable']);
  for (const [, state, message] of messages) assert.match(message, /^[^。]*[ぁ-ん一-龯][^。]*。$/u, state);
  assert.match(app, /if let permissionIssue \{\s+Text\(permissionIssue\.rawValue\)\s+if permissionIssue == \.denied \|\| permissionIssue == \.revoked \{\s+Button\("設定を開く"\) \{\s+guard let url = URL\(string: UIApplication\.openSettingsURLString\) else \{ return \}\s+openURL\(url\)/);
  assert.match(app, /if permissionIssue != nil \{ return "許可を再試行" \}/);
  const restore = app.slice(app.indexOf('private func restore()'), app.indexOf('private func immediateSchedule'));
  assert.match(restore, /case \.notDetermined:[\s\S]*?showPermissionIssue\(\.revoked\)/);
  assert.match(restore, /case \.denied:[\s\S]*?showPermissionIssue\(\.denied\)/);
  assert.match(restore, /case \.approved:\s+permissionIssue = nil/);
  assert.match(restore, /@unknown default:\s+showPermissionIssue\(\.unavailable\)/);
  assert.match(restore, /step = \.permission\s+picker = false\s+paywall = nil/);
  assert.match(app, /previous == \.approved, current != \.approved \{\s+showPermissionIssue\(\.revoked\)/);
});

test('cold launch tries saved authorization before entering recovery', () => {
  const app = readFileSync(new URL('../App/ScreenPauseApp.swift', import.meta.url), 'utf8');
  const activation = app.split('private func restoreOnActivation() async {')[1]?.split('private func restore()')[0];
  assert.ok(activation, 'cold launch needs a foreground authorization check');
  assert.match(app, /\.task\(id: scenePhase\) \{\s+guard !demo, scenePhase == \.active else \{ return \}\s+await restoreOnActivation\(\)/);
  assert.match(activation, /authorization\.authorizationStatus == \.notDetermined, step == \.permission,\s+permissionIssue == nil, !needsAppReselection/);
  assert.match(activation, /if try ScreenTime\.transaction\(\{ \$0\.settings != nil \}\) \{\s+await authorize\(\)[\s\S]*?\r?\n        restore\(\)/);
  assert.doesNotMatch(activation, /showPermissionIssue|needsAppReselection\s*=/);
  const authorize = app.split('private func authorize() async {')[1].split('private func restoreOnActivation')[0];
  assert.match(authorize, /try await authorization\.requestAuthorization\(for: \.individual\)\s+if authorization\.authorizationStatus != \.approved \{ showPermissionIssue\(\.denied\) \}/);
  const restore = app.split('private func restore() {')[1].split('private func showPermissionIssue')[0];
  const undetermined = restore.split('case .notDetermined:')[1].split('case .denied:')[0];
  assert.match(undetermined, /if permissionIssue == nil, step != \.permission \|\| needsAppReselection \{\s+showPermissionIssue\(\.revoked\)/);
  assert.doesNotMatch(undetermined, /settings/);
  assert.match(restore, /case \.approved:\s+permissionIssue = nil[\s\S]*?if !needsAppReselection \{\s+refresh\(\)/);
});

test('explicit approval refreshes Pro state without holding up the app picker', () => {
  const app = readFileSync(new URL('../App/ScreenPauseApp.swift', import.meta.url), 'utf8');
  const setup = app.split('private func beginSetup() async {')[1].split('private func authorize()')[0];
  assert.match(setup, /guard authorization\.authorizationStatus == \.approved[\s\S]*?openPicker\(\) \}\s+if needsAuthorization \{ await store\.refresh\(\) \}/);
});

test('demo and production save the same schedule draft when editing', () => {
  const app = readFileSync(new URL('../App/ScreenPauseApp.swift', import.meta.url), 'utf8');
  const save = app.split('private func save() {')[1].split('private func removeSchedule')[0];
  assert.match(save, /let schedule = step == \.schedule \? draft :[^\n]+\s+var settings = BlockSettings\(schedule: schedule, selection: selection\)/);
  assert.match(save, /settings\.setSchedules\(schedules\)\s+\}\s+if demo \{\s+now = firstStart\s+snapshot\.settings = settings/);
  assert.match(save, /snapshot = try ScreenTime\.install\(settings,/);
});

test('the screenshot publisher matches each capture exactly once per appearance', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  const captures = [...read('../ScreenshotTests/ScreenshotTests.swift').matchAll(/\bcapture\("([^"]+)"/g)]
    .map(([, name]) => name);
  const workflow = read('../.github/workflows/screenshots.yml');
  const manifest = workflow.match(/^\s+screens = \{\r?\n([\s\S]*?)^\s+\}/m)?.[1];
  assert.ok(manifest, 'publishable screens must be listed in the workflow');
  const published = [...manifest.matchAll(/^\s+"([^"]+)":/gm)].map(([, name]) => name);
  assert.ok(published.length > 0);
  assert.deepEqual(captures.toSorted(), published.toSorted());
  for (const screen of published) {
    assert.deepEqual(captures.filter(name => name.startsWith(screen)), [screen]);
  }
  assert.match(workflow, /for appearance in \("light", "dark"\):/);
  assert.match(workflow, new RegExp(`name: ${published.length * 2}枚を確認して目次を生成`));
  const qa = read('../docs/qa-states.md');
  for (const screen of published) assert.ok(qa.includes(`\`${screen}\``), screen);
});

test('home explains the first return when today’s count is zero', () => {
  const app = readFileSync(new URL('../App/ScreenPauseApp.swift', import.meta.url), 'utf8');
  const home = app.slice(app.indexOf('private var homeForm:'), app.indexOf('private var draft:'));
  assert.match(home, /let count = snapshot\.progress\.count\(at: now, calendar: calendar\)/);
  assert.match(home, /let countDetail = blocking\s+\? "対象アプリを開き「\\\(ShieldAppearance\.primary\)」で1回。"\s+: "制限中に「\\\(ShieldAppearance\.primary\)」で1回。"/);
  assert.ok(home.includes('Text("\\(count)回")'));
  assert.match(home, /if count == 0 \{\s+Text\(countDetail\)/);
  assert.match(home, /\.accessibilityHint\(count == 0 \? countDetail : ""\)/);
});

test('Pro explains app-computed weekly comparison and streak before any plan price', () => {
  const paywall = readFileSync(new URL('../App/Paywall.swift', import.meta.url), 'utf8');
  const form = paywall.slice(paywall.indexOf('Form {'), paywall.indexOf('.navigationTitle'));
  const value = form.indexOf('Text("開かずに戻れた回数の履歴・週比較と連続日数")');
  const price = form.indexOf('Text(displayPrice(option))');
  assert.ok(value >= 0 && value < price, 'app-computed value should precede the first price');
  assertFreeReportRoute();
});

test('the production plan gate lists only app features documented for App Review', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  const domain = read('../Shared/Domain.swift');
  const gate = domain.match(/enum PaywallReason:[^{]+\{([\s\S]*?)^\}/m)?.[1];
  assert.ok(gate);
  const features = {
    secondSchedule: '複数の制限予定',
    progressHistory: '開かずに戻れた回数の履歴・週比較と連続日数',
    customPause: '待ち時間と制限画面のメッセージの変更',
    strictMode: '厳格モード',
  };
  const gated = [...gate.matchAll(/^\s*case\s+([^\r\n]+)/gm)]
    .flatMap(([, cases]) => cases.split(',').map(name => name.trim()));
  assert.deepEqual(gated.sort(), Object.keys(features).sort());
  assert.match(gate, /func isAvailable\(on plan: Plan\) -> Bool \{ plan == \.pro \}/);
  const review = read('../docs/app-store/review-notes.ja.md').match(/Proで追加されるのは、([^。]+)/)?.[1];
  assert.ok(review);
  const paywall = read('../App/Paywall.swift');
  const metadata = JSON.parse(read('../docs/app-store/metadata.ja.json')).description;
  for (const label of Object.values(features)) {
    assert.ok(review.includes(label), label);
    assert.ok(paywall.includes(label), label);
    assert.ok(metadata.includes(label), label);
  }
  assert.doesNotMatch(review, /利用時間|スクリーンタイム/);
  const history = read('../App/ReportsView.swift').split('struct ProgressHistoryView')[1];
  assert.match(history, /PaywallReason\.progressHistory\.isAvailable/);
  assert.match(history, /progress\.weeklyComparison\(/);
  assert.doesNotMatch(history, /DeviceActivity/);
  assert.match(read('../Action/Action.swift'), /case \.primaryButtonPressed:\s+state\.progress\.giveUp\(/);
  assert.match(domain, /mutating func giveUp[\s\S]*?dailyStops = /);
  assert.match(domain, /func weeklyComparison[\s\S]*?let records = history\(/);
});

test('Pro expiry returns to free without removing the report route or its app selection', () => {
  const periodEnd = +local(2, 9);
  const entitlement = { periodEnd, willAutoRenew: false };
  assert.equal(isPro(entitlement, periodEnd - 1), true);
  assert.equal(isPro(entitlement, periodEnd), false);
  const domain = readFileSync(new URL('../Shared/Domain.swift', import.meta.url), 'utf8');
  const state = readFileSync(new URL('../Shared/ScreenTime.swift', import.meta.url), 'utf8');
  assert.match(domain, /return now < projectedEnd \? \.pro : \.free/);
  const update = state.slice(state.indexOf('static func updateAccess'), state.indexOf('static func setStrict'));
  const reconcile = state.slice(state.indexOf('mutating func reconcile'), state.indexOf('enum ScreenTime'));
  assert.match(update, /state\.proAccess = access\s+state\.reconcile\(/);
  assert.doesNotMatch(update + reconcile, /(?:settings|baselineStart)\s*=/);
  assertFreeReportRoute();
});

test('strict mode rejects an in-flight unlock until the last active window ends', () => {
  const requested = local(2, 9, 59).getTime();
  const focusEnd = local(2, 10, 1);
  const allowed = (now) => {
    const active = isBlocking([monday], focusEnd, now);
    return active && canUnlock(requested, now, isStrict(true, active));
  };
  assert.equal(allowed(new Date(requested + wait)), false);
  assert.equal(allowed(local(2, 10)), false);
  assert.equal(allowed(focusEnd), false);
  assert.equal(isStrict(true, isBlocking([monday], focusEnd, focusEnd)), false);
  assert.equal(canUnlock(requested, requested + wait, isStrict(false, true)), true);
});

test('overlapping schedules keep blocking through one ending, including overnight', () => {
  const sundayNight = { days: [1], start: 1380, end: 570 };
  const schedules = [sundayNight, monday];
  for (const now of [local(1, 23), local(2, 0), local(2, 9), local(2, 9, 30), local(2, 9, 59)]) {
    assert.equal(isBlocking(schedules, null, now), true);
  }
  assert.equal(isBlocking(schedules, null, local(2, 10)), false);
  assert.equal(isBlocking([monday], null, local(2, 8)), false);
  assert.equal(isBlocking([], local(2, 10), local(2, 9)), true);
});

test('a renewal keeps additional schedules active after the period ends', () => {
  const periodEnd = local(2, 9).getTime();
  const now = new Date(periodEnd + 1000);
  const primary = { ...monday, start: 600, end: 660 };
  const pro = isPro({ periodEnd, willAutoRenew: true }, now);
  const blocking = isBlocking(pro ? [primary, monday] : [primary], null, now);
  assert.equal(pro, true);
  assert.equal(blocking, true);
});

test('cancelled and legacy subscriptions expire on time, while renewal access is bounded', () => {
  const periodEnd = local(2, 9).getTime();
  for (const willAutoRenew of [false, undefined]) {
    assert.equal(isPro({ periodEnd, willAutoRenew }, periodEnd - 1), true);
    assert.equal(isPro({ periodEnd, willAutoRenew }, periodEnd + 1000), false);
  }
  const renewing = { periodEnd, willAutoRenew: true };
  assert.equal(isPro(renewing, periodEnd + renewalMargin - 1), true);
  assert.equal(isPro(renewing, periodEnd + renewalMargin), false);
  assert.equal(isPro({}, periodEnd + renewalMargin), true);
  assert.equal(isPro(null, periodEnd), false);
});

test('the app projects verified renewal intent and the extensions use the projected deadline', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const domain = read('../Shared/Domain.swift');
  const store = read('../App/ProStore.swift');
  const screenTime = read('../Shared/ScreenTime.swift');
  const app = read('../App/ScreenPauseApp.swift');
  assert.match(domain, /renewalMargin: TimeInterval = 7 \* 24 \* 60 \* 60/);
  assert.match(domain, /willAutoRenew == true \? Self\.renewalMargin : 0/);
  assert.match(domain, /let willAutoRenew: Bool\?/);
  assert.match(store, /case \.verified\(let renewal\) = status\.renewalInfo/);
  assert.match(store, /willAutoRenew: status\.state == \.subscribed && renewal\.willAutoRenew/);
  assert.match(store, /gracePeriodExpirationDate \?\? end, willAutoRenew: false/);
  assert.match(store, /await self\.applyEntitlements\(\)\s+\}\s+pendingRefresh = task\s+return await task\.value/);
  assert.match(store, /try ScreenTime\.updateAccess\(access\)\s+accessError = nil\s+revision \+= 1/);
  assert.match(screenTime, /return proAccess\.plan\(at: now\)/);
  assert.match(screenTime, /let end = access\?\.projectedEnd/);
  assert.match(screenTime, /!monitoringExpiry \|\| state\.proAccess\?\.projectedEnd != end/);
  assert.match(screenTime, /try registerCallback\(planExpiry, at: callback\)/);
  assert.match(screenTime, /state\.proAccess = access\s+state\.reconcile\(/);
  // Authorization recovery can apply the saved state immediately. Await the StoreKit
  // refresh before the final restore so it reapplies shields using the shared entitlement.
  assert.match(app, /\.task\(id: scenePhase\) \{\s+guard !demo, scenePhase == \.active else \{ return \}\s+await restoreOnActivation\(\)\s+await store\.refresh\(\)\s+guard !Task\.isCancelled else \{ return \}\s+restore\(\)/,
    'scene activation must refresh the shared entitlement before the final restore');
});

test('Japanese App Store metadata fits its field limits', () => {
  const metadata = JSON.parse(readFileSync(new URL('../docs/app-store/metadata.ja.json', import.meta.url), 'utf8'));
  for (const [field, limit] of [['subtitle', 30], ['searchTerms', 100]]) {
    const value = metadata[field];
    assert.ok(typeof value === 'string' && value.trim(), `${field} must be a nonempty string`);
    const characters = Array.from(value).length;
    assert.ok(characters <= limit, `${field}: ${characters} characters exceeds ${limit}`);
  }
});

test('the app and every extension package a privacy manifest and share bundle versions', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const project = read('../project.yml').replace(/\r\n/g, '\n');
  const targets = project.split('\ntargets:\n')[1].split('\nschemes:\n')[0];
  const shippedTargets = targets.split(/(?:^|\n) {2}\w+:\n/)
    .filter(target => /^    type: (?:application|(?:app|extensionkit)-extension)$/m.test(target));
  assert.equal(shippedTargets.length, 6);
  assert.match(project, /^    MARKETING_VERSION: "\d+\.\d+\.\d+"$/m);
  assert.match(project, /^    CURRENT_PROJECT_VERSION: "\d+"$/m);
  assert.match(project, /^        UILaunchScreen: \{\}$/m);
  for (const target of shippedTargets) {
    assert.match(target, /CFBundleShortVersionString: \$\(MARKETING_VERSION\)/);
    assert.match(target, /CFBundleVersion: \$\(CURRENT_PROJECT_VERSION\)/);
    const manifest = target.match(/- path: (\w+\/PrivacyInfo\.xcprivacy)\n        buildPhase: resources/);
    assert.ok(manifest, 'shipped target must embed a privacy manifest');
    const plist = read(`../${manifest[1]}`);
    assert.match(plist, /<key>NSPrivacyTracking<\/key>\s*<false\/>/);
    assert.match(plist, /<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/);
  }
});

test('paywall and settings expose the same published and bundled legal documents', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  assert.match(read('../App/Paywall.swift'), /LegalLinks\(\)/);
  assert.match(read('../App/ScreenPauseApp.swift'), /private var settingsView: some View \{[\s\S]*LegalLinks\(\)[\s\S]*\.navigationTitle\("設定"\)/);
  const links = read('../App/LegalLinks.swift');
  assert.match(links, /Link\(document\.title, destination: url\)/);
  assert.match(links, /document\.localPage/);
  assert.match(links, /appendingPathComponent\(rawValue\)\.appendingPathExtension\("html"\)/);
  assert.match(links, /Bundle\.main\.url\(forResource: rawValue, withExtension: "md"\)/);
  const project = read('../project.yml').replace(/\r\n/g, '\n');
  assert.match(project, /LegalBaseURL: \$\(SCREEN_PAUSE_LEGAL_BASE_URL\)/);
  for (const document of ['privacy', 'terms']) {
    const path = `docs/legal/${document}.md`;
    assert.ok(project.includes(`- path: ${path}\n        buildPhase: resources`));
    assert.match(read(`../${path}`), /^---\r?\ntitle: .+\r?\n---\r?\n/);
  }
});

test('local StoreKit products match the runtime IDs and confirmed JPY prices', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const config = JSON.parse(read('../ScreenPause.storekit'));
  const [group] = config.subscriptionGroups;
  assert.equal(config.products.length, 0);
  assert.equal(group.subscriptions.length, 2);
  const [monthly, yearly] = group.subscriptions;
  const storeSource = read('../App/ProStore.swift');
  assert.doesNotMatch(storeSource, /lifetime|買い切り/);
  const ids = Array.from(storeSource.matchAll(/case (?:monthly|yearly) = "([^"]+)"/g),
    (match) => match[1]);
  assert.deepEqual(ids, [monthly.productID, yearly.productID]);
  assert.equal(config.settings._storefront, 'JPN');
  assert.equal(config.settings._locale, 'ja_JP');
  assert.equal(Number(monthly.displayPrice), 600);
  assert.equal(Number(yearly.displayPrice), 4800);
  assert.match(storeSource, /case \.monthly: 600\s+case \.yearly: 4800/);
  for (const product of [monthly, yearly]) {
    assert.doesNotMatch(product.referenceName, /仮|provisional|TBD/i);
    for (const loc of product.localizations) {
      assert.doesNotMatch(loc.description, /仮|provisional|TBD/i);
    }
  }
  assert.equal(monthly.recurringSubscriptionPeriod, 'P1M');
  assert.equal(yearly.recurringSubscriptionPeriod, 'P1Y');
  assert.equal(yearly.introductoryOffer.subscriptionPeriod, 'P2W');
  assert.equal(yearly.introductoryOffer.paymentMode, 'free');
});
