import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App/ScreenPauseApp.swift');
const paywall = read('../App/Paywall.swift');
const section = (source, from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `Missing source section: ${from}`);
  return source.slice(start, end);
};

test('the listing describes the immediate first hour before schedule editing', () => {
  const { description } = JSON.parse(read('../docs/app-store/metadata.ja.json'));
  const overview = description.split('\n\n')[1];
  assert.match(overview, /アプリを選ぶと、すぐに1時間の制限を始められます。/);
  assert.match(overview, /同じ時間帯に毎日[^。]+曜日や時間帯はあとから変更できます。/);
});

test('permission recovery shows Settings only for denied or revoked access', () => {
  const intro = section(app, 'private var permissionForm:', 'private var setupActionTitle:');
  assert.match(intro, /Text\(permissionIssue\.rawValue\)\s+if permissionIssue == \.denied \|\| permissionIssue == \.revoked \{\s+Button\("設定を開く"\)/);
  assert.match(intro, /Button\(setupActionTitle\) \{\s+Task \{ await beginSetup\(\) \}/);
});

test('first save failure stays in the picker with its selection and retry feedback', () => {
  const picker = section(app, 'private var appPicker:', 'private func setupHeading');
  assert.match(picker, /if let pickerSaveError \{\s+Text\(pickerSaveError\)\.font\(\.footnote\)\s+\}\s+if let firstRunSchedule \{\s+firstRunTerms\(firstRunSchedule\)/);
  assert.match(picker, /Button \{\s+confirmApps\(displayedSchedule: firstRunSchedule\)\s+\} label: \{\s+Text\(pickerActionTitle\)(?:(?!\.disabled)[\s\S])*\.disabled\(!canConfirmApps\)/);
  assert.match(picker, /selection = pickerSelection\s+if step == \.permission \|\| step == \.home \{\s+pickerSaveError = nil\s+save\(firstRunSchedule: displayedSchedule, at: confirmedAt\)\s+guard pickerSaveError == nil, step == \.home else \{ return \}\s+\}\s+picker = false/);
  const save = section(app, 'private func save(', 'private var demoStart');
  assert.match(save, /step = \.home\s+\} catch \{\s+if \(step == \.permission \|\| step == \.home\), picker \{\s+pickerSaveError = needsAppReselection\s+\? "元の予定で制限を再開できませんでした。もう一度お試しください。"\s+: "制限を設定できませんでした。もう一度お試しください。"\s+\} else \{/);
  const open = section(app, 'private func openPicker()', 'private var appPicker:');
  assert.match(open, /pickerSaveError = nil\s+pickerSelection = selection\s+firstRunSchedule = step == \.permission && !needsAppReselection\s+\? immediateSchedule\(at: demo \? demoStart : \.now\) : nil\s+picker = true/);
});

test('first-run confirmation refreshes stale terms before passing the displayed schedule to install', () => {
  const picker = section(app, 'private func pickerActions(', 'private func setupHeading');
  assert.match(picker, /firstRunTerms\(firstRunSchedule\)[\s\S]*confirmApps\(displayedSchedule: firstRunSchedule\)/);
  assert.match(picker, /let currentSchedule = immediateSchedule\(at: confirmedAt\)\s+guard displayedSchedule == currentSchedule else \{\s+firstRunSchedule = currentSchedule\s+pickerSaveError = "[^"]+"\s+return\s+\}/);
  const save = section(app, 'private func save(', 'private var demoStart');
  assert.match(save, /snapshot\.settings\?\.schedule \?\? firstRunSchedule else \{[^}]+\}\s+var settings = BlockSettings\(schedule: schedule, selection: selection\)/);
  assert.doesNotMatch(save, /immediateSchedule\(/);
  assert.match(app, /SetupView\(demo: true, demoConfirmationDelay:[\s\S]*?\.contains\("--screenshot-cross-minute"\) \? 60 : 0\)/);
  assert.match(picker, /demoStart\.addingTimeInterval\(demoConfirmationDelay\)/);
  const ui = read('../ScreenshotTests/ScreenshotTests.swift');
  const rollover = section(ui, 'func testFirstBlockRequiresFreshConsentAfterMinuteChanges', 'private func exerciseFirstBlockDemo');
  assert.match(rollover, /--screenshot-cross-minute/);
  assert.match(rollover, /20:00〜21:00[\s\S]*start\.tap\(\)[\s\S]*20:01〜21:01[\s\S]*XCTAssertFalse\(element\("home-count", in: app\)\.exists\)[\s\S]*start\.tap\(\)[\s\S]*app\.buttons\["毎日 20:01〜21:01"\]/);
});

test('the system picker and fixture reserve space for candidates and verify AX5 in both appearances', () => {
  const container = section(app, 'private var appPicker:', '@ViewBuilder private var pickerCandidates:');
  assert.match(container, /pickerCandidates\s+\.safeAreaInset\(edge: \.bottom, spacing: 0\)/);
  assert.match(container, /ViewThatFits\(in: \.vertical\) \{\s+actions\s+ScrollView \{\s+actions[\s\S]*\.frame\(maxHeight: geometry\.size\.height \/ 2\)/);
  const candidates = section(app, '@ViewBuilder private var pickerCandidates:', 'private func demoAppRow');
  assert.match(candidates, /if demo \{[\s\S]*demoAppRow\(app\)[\s\S]*\} else \{\s+FamilyActivityPicker\(selection: \$pickerSelection\)/);
  const ui = read('../ScreenshotTests/ScreenshotTests.swift');
  for (const appearance of ['light', 'dark']) {
    assert.ok(ui.includes('exerciseFirstBlockDemo(appearance: "' + appearance + '", accessibilitySize: true)'));
  }
  assert.match(ui, /if accessibilitySize \{ app\.launchArguments\.append\("--screenshot-ax5"\) \}/);
  assert.match(ui, /if accessibilitySize \{\s+verifyDemoSelection\(/);
  const selection = section(ui, 'private func verifyDemoSelection', 'private func element(');
  for (const control of ['row', 'terms', 'start']) {
    assert.ok(selection.includes('XCTAssertTrue(' + control + '.isHittable)'));
  }
  assert.match(selection, /XCTAssertLessThanOrEqual\(row\.frame\.maxY, start\.frame\.minY\)/);
});

test('home app picker loads saved selection, labels confirm action, and persists via save()', () => {
  const open = section(app, 'private func openPicker()', 'private var appPicker:');
  assert.match(open, /if step == \.home, let saved = snapshot\.settings\?\.selection \{\s+selection = saved\s+\}/);
  const title = section(app, 'private var pickerActionTitle:', 'private func confirmApps(');
  assert.match(title, /if step == \.schedule \|\| step == \.home \{ return "選択を反映" \}/);
  const confirm = section(app, 'private func confirmApps(', 'private func setupHeading');
  assert.match(confirm, /step == \.permission \|\| step == \.home[\s\S]*save\(firstRunSchedule: displayedSchedule, at: confirmedAt\)[\s\S]*pickerSaveError == nil/);
  const save = section(app, 'private func save(', 'private var demoStart');
  assert.match(save, /\(step == \.permission \|\| step == \.home\), picker/);
  assert.match(save, /try ScreenTime\.install\(settings/);
});

test('an active limit gives a zero-count user the real first-stop action', () => {
  const home = section(app, 'private var homeForm:', 'private var draft:');
  const shield = read('../Shared/ShieldAppearance.swift');
  assert.match(shield, /static let primary = "開かずに戻る"/);
  assert.match(home, /let blocking = snapshot\.isBlocking\(at: now\)/);
  assert.match(home, /: \(blocking\s+\? "対象アプリを開き「\\\(ShieldAppearance\.primary\)」で1回。"\s+: "制限中に「\\\(ShieldAppearance\.primary\)」で1回。"\)/);
  assert.match(home, /if count == 0 \{\s+Text\(countDetail\)/);
  assert.match(home, /\.accessibilityHint\(count == 0 \? countDetail : ""\)/);
});

test('the paywall states the free report boundary before plan prices', () => {
  const form = section(paywall, 'Form {', '.navigationTitle');
  const free = form.indexOf('Text("利用時間レポートは無料で使えます。")');
  const prices = form.indexOf('Text(displayPrice(option))');
  assert.ok(free >= 0 && free < prices);
});

test('partial StoreKit results select a purchasable plan and hide unpriced choices', () => {
  const form = section(paywall, 'Form {', '.navigationTitle');
  assert.match(form, /ForEach\(availablePlans\) \{ option in/);
  assert.match(form, /if demo \|\| \(!loading && products\[selected\] != nil\) \{/);
  assert.match(paywall, /var availablePlans: \[ProProduct\] \{\s+ProProduct\.allCases\.filter \{ demo \|\| products\[\$0\] != nil \}\s+\}/);
  const load = section(paywall, 'private func load() async', 'private func buy(');
  assert.match(load, /products = Dictionary[\s\S]+?else if !availablePlans\.contains\(selected\), let fallback = availablePlans\.first \{\s+selectPlan\(fallback\)\s+\}/);
  assert.match(load, /if products\.count < ProProduct\.allCases\.count \{ loadMessage =/);
  assert.match(form, /Button\("プランを再読み込み"\) \{\s+Task \{\s+guard !loading, !busy else \{ return \}\s+await load\(\)/);
});

test('a reload restores the yearly default and keeps a plan explicitly chosen by the user', () => {
  const load = section(paywall, 'private func load() async', 'private func buy(');
  const form = section(paywall, 'Form {', '.navigationTitle');
  const plans = section(form, 'ForEach(availablePlans)', '} label:');
  assert.match(plans, /selectPlan\(option\)\s+manuallySelected = true/);
  assert.match(load, /if !manuallySelected, products\[\.yearly\] != nil \{\s+selectPlan\(\.yearly\)/);
  assert.match(load, /trial = await subscription\.isEligibleForIntroOffer/);
  assert.match(paywall, /var hasTrial: Bool \{ selected == \.yearly && \(demo \|\| trial\) \}/);
  assert.match(form, /Button\(hasTrial \? "14日間無料で始める" : "購入する"\)/);
});

test('changing the selected plan clears purchase feedback for both taps and StoreKit reloads', () => {
  const selection = section(paywall, 'private func selectPlan(', 'private func load() async');
  assert.match(selection, /if selected != option, feedback\?\.operation == \.purchase \{ feedback = nil \}\s+selected = option/);
});

test('progress shows a seven-day stop total while a comparable week is unavailable', () => {
  const reports = read('../App/ReportsView.swift');
  const domain = read('../Shared/Domain.swift');
  assert.match(reports, /if let comparison = progress\.weeklyComparison[\s\S]+?\} else \{\s+Section\("開かずに戻れた回数"\) \{\s+LabeledContent\("直近7日間", value: "\\\(progress\.recentStopCount\(at: now, calendar: calendar\)\)回"\)/);
  const recent = section(domain, 'func recentStopCount', 'func weeklyComparison');
  assert.match(recent, /value: -6, to: today/);
  assert.match(recent, /history\(at: now, calendar: calendar\)\.filter \{ \$0\.date >= start \}/);
  assert.match(recent, /records\.contains \{ calendar\.isDate\(\$0\.date, inSameDayAs: now\) \}\s+\? recordedCount : recordedCount \+ count\(at: now, calendar: calendar\)/);
});

test('the fifth-stop prompt uses the saved daily count without overriding custom copy', () => {
  const appearance = read('../Shared/ShieldAppearance.swift');
  const live = read('../Shield/Shield.swift');
  const demo = read('../App/ShieldDemoView.swift');
  assert.match(appearance, /case 4: return "今日は4回戻れました。開かずに戻ると5回目です。"\s+case 5: return "今日は5回、開かずに戻れました。"\s+default: return subtitle/);
  assert.match(live, /let count = state\?\.progress\.count\(at: now, calendar: calendar\) \?\? 0\s+subtitle = pause\.message\.isEmpty \? ShieldAppearance\.stopPrompt\(count: count\) : pause\.message/);
  assert.match(app, /ShieldDemoView\(count: count\) \{/);
  assert.match(demo, /Text\(ShieldAppearance\.stopPrompt\(count: count\)\)/);
});

test('schedule edit explains the specific cause when saving is disabled', () => {
  const editor = section(app, 'private var scheduleForm:', 'private var homeForm:');
  assert.match(editor, /if weekdays\.isEmpty \{\s+Text\("制限する曜日を1つ以上選んでください。"\)\s+\} else if !draft\.isValid \{\s+Text\("開始から終了まで15分以上にしてください。"\)/);
  assert.match(editor, /Button\("変更を保存"\) \{ save\(\) \}\s+\.disabled\(!draft\.isValid \|\| !ScreenTime\.hasApps\(selection\)\)/);
});

test('overnight schedules identify the end day in both the list and the editor', () => {
  const editor = section(app, 'private var scheduleForm:', 'private var homeForm:');
  const label = section(app, 'private func scheduleLabel', 'private var weekdaySummary');
  assert.match(editor, /else if start > end \{\s+Text\("翌日の終了時刻まで制限します。曜日は開始日です。"\)/);
  assert.match(label, /let endDay = schedule\.start > schedule\.end \? "翌日" : ""\s+return "[^"\n]+〜\\\(endDay\)\\\(time\(schedule\.end\)\)"/);
});

test('the home return cue shows the earliest future start among enabled schedules', () => {
  const home = section(app, 'private var homeForm:', 'private var draft:');
  const schedule = section(read('../Shared/Domain.swift'), 'func nextStart', 'func previousDay');
  assert.match(home, /let schedules = multipleSchedules \? settings\.schedules : \[settings\.schedule\]\s+if blocking \{\s+if let until = snapshot\.blockingUntil\(at: now, calendar: calendar\)[\s\S]*?LabeledContent\("制限中", value:[\s\S]*?\} else if let next = schedules\.compactMap\(\{\s+\$0\.nextStart\(after: now, calendar: calendar\)\s+\}\)\.min\(\) \{\s+LabeledContent\("次の制限開始", value: next\.formatted/);
  assert.match(schedule, /guard isValid else \{ return nil \}\s+return weekdays\.flatMap \{ weekday in/);
  assert.match(schedule, /DateComponents\(hour: start \/ 60, minute: start % 60, second: 0, weekday: weekday\)/);
  assert.match(schedule, /calendar\.nextDate\(after: now, matching: time, matchingPolicy: \.strict,\s+repeatedTimePolicy: occurrence\)[\s\S]+?\}\.min\(\)/);
});

test('home has at most three sections, shows block end time, and moves secondary settings', () => {
  const home = section(app, 'private var homeForm:', 'private var draft:');
  const sections = home.match(/^\s*Section\b/gm) ?? [];
  assert.ok(sections.length <= 3, `expected <= 3 sections in homeForm, got ${sections.length}`);
  assert.doesNotMatch(home, /snapshot\.baselineStart\b.*\n.*利用時間はスクリーンタイム/);
  assert.match(home, /blockingUntil\(at: now, calendar: calendar\)/);
  assert.match(home, /LabeledContent\("制限中", value: "[^"]*まで（あと\\\(remaining\)分）"\)/);
  assert.match(home, /Button\("制限するアプリを選ぶ", action: openPicker\)/);
  assert.doesNotMatch(home, /scheduleLabel\(/);
  assert.doesNotMatch(home, /CustomPauseView\(/);

  const settings = app.slice(app.indexOf('private var settingsView:'));
  assert.match(settings, /scheduleLabel\(schedules\[index\]\)/);
  assert.match(settings, /CustomPauseView\(/);
  assert.match(settings, /LegalLinks\(\)/);
  assert.match(settings, /\.navigationTitle\("設定"\)/);
  assert.match(app, /confirmRemoveSchedule = true/);
  assert.match(app, /\.confirmationDialog\("この予定を削除しますか？"/);

  const local = (day, hour = 0, minute = 0) => new Date(2026, 10, day, hour, minute);
  const shiftDay = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  const activeDay = (schedule, now) => {
    const minute = now.getHours() * 60 + now.getMinutes();
    let day;
    if (schedule.start < schedule.end) {
      if (minute < schedule.start || minute >= schedule.end) return null;
      day = shiftDay(now, 0);
    } else if (minute >= schedule.start) {
      day = shiftDay(now, 0);
    } else {
      if (minute >= schedule.end) return null;
      day = shiftDay(now, -1);
    }
    return schedule.days.includes(day.getDay() + 1) ? day : null;
  };
  const activeEnd = (schedule, now) => {
    const startDay = activeDay(schedule, now);
    if (!startDay) return null;
    const endDay = schedule.start < schedule.end ? startDay : shiftDay(startDay, 1);
    return new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(),
      Math.floor(schedule.end / 60), schedule.end % 60, 0);
  };
  const blockingUntil = (schedules, focusEnd, now) => {
    const ends = schedules.map((s) => activeEnd(s, now)).filter(Boolean).map((d) => +d);
    if (focusEnd != null && +focusEnd > +now) ends.push(+focusEnd);
    return ends.length ? new Date(Math.max(...ends)) : null;
  };
  const monday = { days: [2], start: 540, end: 600 };
  assert.deepEqual(blockingUntil([monday], null, local(2, 9, 42)), local(2, 10, 0));
  const overnight = { days: [7], start: 1380, end: 60 };
  assert.deepEqual(blockingUntil([overnight], null, local(8, 0, 30)), local(8, 1, 0));
  assert.deepEqual(blockingUntil([monday], local(2, 10, 30), local(2, 9, 42)), local(2, 10, 30));
  assert.equal(blockingUntil([monday], null, local(2, 10, 0)), null);
});

test('terms include Pro strict mode and monthly calendar', () => {
  const terms = read('../docs/legal/terms.md');
  const proSection = terms.split('## Proの購入')[1].split('## 自動更新と無料体験')[0];
  assert.match(proSection, /厳格モード/);
  assert.match(proSection, /月ごとの達成カレンダー/);
});

test('strict migration notice, reason-aware paywall, and confirmed subscription prices are wired', () => {
  const needsMigration = (strictEnabled, plan) => strictEnabled === true && plan === 'free';
  assert.equal(needsMigration(true, 'free'), true);
  assert.equal(needsMigration(true, 'pro'), false);
  assert.equal(needsMigration(false, 'free'), false);

  const state = read('../Shared/ScreenTime.swift');
  assert.match(state, /func needsStrictMigrationNotice\(at now: Date\) -> Bool \{\s+settings\?\.strictEnabled == true && !PaywallReason\.strictMode\.isAvailable\(on: plan\(at: now\)\)/);
  assert.match(app, /snapshot\.needsStrictMigrationNotice\(at: now\)/);
  assert.match(app, /home-strict-migration-notice/);
  assert.match(app, /Button\("確認した"\) \{ setStrict\(false\) \}/);

  assert.match(paywall, /private var reasonSummary: String/);
  for (const reason of ['secondSchedule', 'progressHistory', 'customPause', 'strictMode']) {
    assert.match(paywall, new RegExp(`case \\.${reason}:`));
  }
  const proStore = read('../App/ProStore.swift');
  assert.match(proStore, /case \.monthly: 600\s+case \.yearly: 4800/);
  assert.match(paywall, /option\.confirmedDisplayPrice/);
  assert.match(paywall, /ProProduct\.monthly\.jpyPrice/);
  assert.match(paywall, /ProProduct\.yearly\.jpyPrice/);
  assert.doesNotMatch(paywall, /仮|¥580|¥7,800|lifetime|買い切り/);
  assert.equal(Math.round((1 - 4800 / (600 * 12)) * 100), 33);
  const paywallPreview = read('../tools/preview/paywall.html');
  assert.match(paywallPreview, /¥600／月/);
  assert.match(paywallPreview, /¥4,800／年/);
  assert.match(paywallPreview, /月額比 約33%お得/);
  assert.doesNotMatch(paywallPreview, /仮|¥580|¥7,800|31%|買い切り/);
  assert.match(paywall, /\.frame\(maxWidth: \.infinity, minHeight: 44\)/);
  assert.match(paywall, /if availablePlans\.isEmpty \{[\s\S]*価格を確認中…/);
});
