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
  assert.match(picker, /if let pickerSaveError \{\s+Text\(pickerSaveError\)/);
  assert.match(picker, /selection = pickerSelection\s+if step == \.permission \{\s+pickerSaveError = nil\s+save\(\)\s+guard step == \.home else \{ return \}\s+\}\s+picker = false/);
  const save = section(app, 'private func save()', 'private var demoStart');
  assert.match(save, /step = \.home\s+\} catch \{\s+if step == \.permission, picker \{\s+pickerSaveError = needsAppReselection\s+\? "元の予定で制限を再開できませんでした。もう一度お試しください。"\s+: "制限を設定できませんでした。もう一度お試しください。"\s+\} else \{/);
  const open = section(app, 'private func openPicker()', 'private var appPicker:');
  assert.match(open, /pickerSaveError = nil\s+pickerSelection = selection\s+picker = true/);
});

test('an active limit gives a zero-count user the real first-stop action', () => {
  const home = section(app, 'private var homeForm:', 'private var draft:');
  const shield = read('../Shared/ShieldAppearance.swift');
  assert.match(shield, /static let primary = "開かずに戻る"/);
  assert.match(home, /let blocking = snapshot\.isBlocking\(at: now\)/);
  assert.match(home, /let countDetail = blocking\s+\? "対象アプリを開き「\\\(ShieldAppearance\.primary\)」で1回。"\s+: "制限中に「\\\(ShieldAppearance\.primary\)」で1回。"/);
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
  assert.match(form, /if demo \|\| products\[selected\] != nil \{/);
  assert.match(paywall, /var availablePlans: \[ProProduct\] \{\s+ProProduct\.allCases\.filter \{ demo \|\| products\[\$0\] != nil \}\s+\}/);
  const load = section(paywall, 'private func load() async', 'private func buy(');
  assert.match(load, /products = Dictionary[\s\S]+?if !availablePlans\.contains\(selected\), let fallback = availablePlans\.first \{\s+selected = fallback\s+\}/);
  assert.match(load, /if products\.count < ProProduct\.allCases\.count \{ message =/);
  assert.match(form, /Button\("プランを再読み込み"\) \{ Task \{ await load\(\) \} \}/);
});

test('a reload restores the yearly default and keeps a plan explicitly chosen by the user', () => {
  const load = section(paywall, 'private func load() async', 'private func buy(');
  const form = section(paywall, 'Form {', '.navigationTitle');
  assert.match(form, /ForEach\(availablePlans\) \{ option in\s+Button \{\s+selected = option\s+manuallySelected = true/);
  assert.match(load, /selected = fallback\s+\}\s+if !manuallySelected, products\[\.yearly\] != nil \{\s+selected = \.yearly\s+\}/);
  assert.match(load, /trial = await subscription\.isEligibleForIntroOffer/);
  assert.match(paywall, /var hasTrial: Bool \{ selected == \.yearly && \(demo \|\| trial\) \}/);
  assert.match(form, /Button\(hasTrial \? "14日間無料で始める" : "購入する"\)/);
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
  assert.match(live, /let count = state\?\.progress\.count\(at: now, calendar: \.current\) \?\? 0\s+subtitle = pause\.message\.isEmpty \? ShieldAppearance\.stopPrompt\(count: count\) : pause\.message/);
  assert.match(app, /ShieldDemoView\(count: count\) \{/);
  assert.match(demo, /Text\(ShieldAppearance\.stopPrompt\(count: count\)\)/);
});

test('schedule edit explains the specific cause when saving is disabled', () => {
  const editor = section(app, 'private var scheduleForm:', 'private var homeForm:');
  assert.match(editor, /if weekdays\.isEmpty \{\s+Text\("制限する曜日を1つ以上選んでください。"\)\s+\} else if !draft\.isValid \{\s+Text\("開始から終了まで15分以上にしてください。"\)/);
  assert.match(editor, /Button\("変更を保存", action: save\)\s+\.disabled\(!draft\.isValid \|\| !ScreenTime\.hasApps\(selection\)\)/);
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
  assert.match(home, /let schedules = multipleSchedules \? settings\.schedules : \[settings\.schedule\]\s+if blocking \{\s+Text\("制限中"\)\s+\} else if let next = schedules\.compactMap\(\{\s+\$0\.nextStart\(after: now, calendar: calendar\)\s+\}\)\.min\(\) \{\s+LabeledContent\("次の制限開始", value: next\.formatted/);
  assert.match(schedule, /guard isValid else \{ return nil \}\s+return weekdays\.flatMap \{ weekday in/);
  assert.match(schedule, /DateComponents\(hour: start \/ 60, minute: start % 60, second: 0, weekday: weekday\)/);
  assert.match(schedule, /calendar\.nextDate\(after: now, matching: time, matchingPolicy: \.strict,\s+repeatedTimePolicy: occurrence\)[\s\S]+?\}\.min\(\)/);
});
