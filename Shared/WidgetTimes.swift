import Foundation

enum WidgetTimes {
    static func entries(
        now: Date, midnight: Date, calendar: Calendar, schedules: [WeeklySchedule],
        focusEnd: Date?, proEnd: Date?
    ) -> [Date] {
        var dates: Set<Date> = [now, midnight]
        let transition = calendar.timeZone.nextDaylightSavingTimeTransition(after: now)
        for boundary in [focusEnd, proEnd, transition].compactMap({ $0 }) where boundary > now && boundary < midnight {
            dates.insert(boundary)
        }
        for schedule in schedules where schedule.isValid {
            for minute in [schedule.start, schedule.end] {
                let time = DateComponents(hour: minute / 60, minute: minute % 60, second: 0)
                for repeated in [Calendar.RepeatedTimePolicy.first, .last] {
                    if let date = calendar.nextDate(after: now, matching: time, matchingPolicy: .strict,
                                                    repeatedTimePolicy: repeated), date < midnight {
                        dates.insert(date)
                    }
                }
            }
        }
        return dates.sorted()
    }
}
