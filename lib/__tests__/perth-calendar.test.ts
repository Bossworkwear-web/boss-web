import { describe, expect, it } from "vitest";

import {
  PERTH_TZ,
  addCalendarDaysYmd,
  getPerthDateSheetRangeDescending,
  getPerthYmd,
  isPerthDayOfMonth,
  perthMondayYmdOfWeekContaining,
  perthWeekdayIsoNumericMon1Sun7,
  supplierReportMonthRange,
} from "@/lib/perth-calendar";

describe("perth-calendar", () => {
  describe("getPerthYmd", () => {
    it("formats midnight Perth as the next calendar day from late UTC", () => {
      // 2026-05-18 16:00 UTC = 2026-05-19 00:00 Perth
      const result = getPerthYmd(new Date("2026-05-18T16:00:00.000Z"));
      expect(result).toEqual({
        year: 2026,
        month: 5,
        day: 19,
        ymd: "2026-05-19",
      });
    });

    it("uses Australia/Perth timezone", () => {
      expect(PERTH_TZ).toBe("Australia/Perth");
    });
  });

  describe("isPerthDayOfMonth", () => {
    it("matches Perth day-of-month for the given instant", () => {
      const instant = new Date("2026-05-18T16:00:00.000Z"); // May 19 in Perth
      expect(isPerthDayOfMonth(instant, 19)).toBe(true);
      expect(isPerthDayOfMonth(instant, 18)).toBe(false);
    });
  });

  describe("supplierReportMonthRange", () => {
    it("returns inclusive 1st through 25th for the month", () => {
      expect(supplierReportMonthRange(2026, 3)).toEqual({
        start: "2026-03-01",
        end: "2026-03-25",
      });
    });

    it("zero-pads single-digit months", () => {
      expect(supplierReportMonthRange(2026, 9)).toEqual({
        start: "2026-09-01",
        end: "2026-09-25",
      });
    });
  });

  describe("addCalendarDaysYmd", () => {
    it("adds days within the same month", () => {
      expect(addCalendarDaysYmd("2026-05-10", 5)).toBe("2026-05-15");
    });

    it("rolls over month boundaries", () => {
      expect(addCalendarDaysYmd("2026-05-30", 3)).toBe("2026-06-02");
    });

    it("subtracts days across month boundaries", () => {
      expect(addCalendarDaysYmd("2026-05-01", -1)).toBe("2026-04-30");
    });
  });

  describe("perthWeekdayIsoNumericMon1Sun7", () => {
    it("maps weekdays with Monday = 1 and Sunday = 7", () => {
      expect(perthWeekdayIsoNumericMon1Sun7("2026-05-18")).toBe(1); // Monday
      expect(perthWeekdayIsoNumericMon1Sun7("2026-05-21")).toBe(4); // Thursday
      expect(perthWeekdayIsoNumericMon1Sun7("2026-05-24")).toBe(7); // Sunday
    });
  });

  describe("perthMondayYmdOfWeekContaining", () => {
    it("returns the Monday of the week containing the date", () => {
      expect(perthMondayYmdOfWeekContaining("2026-05-21")).toBe("2026-05-18");
      expect(perthMondayYmdOfWeekContaining("2026-05-18")).toBe("2026-05-18");
    });
  });

  describe("getPerthDateSheetRangeDescending", () => {
    const now = new Date("2026-05-18T16:00:00.000Z"); // 2026-05-19 Perth

    it("returns newest-first dates covering dayCount calendar days", () => {
      expect(getPerthDateSheetRangeDescending(3, now)).toEqual([
        "2026-05-19",
        "2026-05-18",
        "2026-05-17",
      ]);
    });

    it("returns a single day when dayCount is 1", () => {
      expect(getPerthDateSheetRangeDescending(1, now)).toEqual(["2026-05-19"]);
    });
  });
});
