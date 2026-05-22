import { describe, it, expect } from "bun:test";
import { getMonthCalendarGrid, getMonthCalendarCells } from "../dateUtils";

describe("getMonthCalendarGrid", () => {
  it("should generate a correct grid for a standard month (e.g., February 2024 - leap year)", () => {
    // Feb 2024 starts on a Thursday (day 4) and has 29 days
    const grid = getMonthCalendarGrid(2024, 2);

    expect(grid.length % 7).toBe(0);
    expect(grid.length).toBe(35); // 4 leading nulls + 29 days + 2 trailing nulls

    // Check leading nulls
    for (let i = 0; i < 4; i++) {
      expect(grid[i]).toBeNull();
    }

    // Check first day
    expect(grid[4]).not.toBeNull();
    expect(grid[4]?.getDate()).toBe(1);

    // Check last day
    expect(grid[32]).not.toBeNull();
    expect(grid[32]?.getDate()).toBe(29);

    // Check trailing nulls
    expect(grid[33]).toBeNull();
    expect(grid[34]).toBeNull();
  });

  it("should generate a correct grid for a month starting on Sunday (0 leading nulls)", () => {
    // September 2024 starts on a Sunday (day 0) and has 30 days
    const grid = getMonthCalendarGrid(2024, 9);

    expect(grid.length % 7).toBe(0);
    expect(grid.length).toBe(35); // 0 leading nulls + 30 days + 5 trailing nulls

    // Check first day (no leading nulls)
    expect(grid[0]).not.toBeNull();
    expect(grid[0]?.getDate()).toBe(1);

    // Check trailing nulls
    for (let i = 30; i < 35; i++) {
      expect(grid[i]).toBeNull();
    }
  });

  it("should generate a correct grid for a month starting on Saturday (6 leading nulls, spans 6 weeks)", () => {
    // May 2021 starts on a Saturday (day 6) and has 31 days
    const grid = getMonthCalendarGrid(2021, 5);

    expect(grid.length % 7).toBe(0);
    expect(grid.length).toBe(42); // 6 leading nulls + 31 days + 5 trailing nulls

    // Check leading nulls
    for (let i = 0; i < 6; i++) {
      expect(grid[i]).toBeNull();
    }

    // Check first day
    expect(grid[6]).not.toBeNull();
    expect(grid[6]?.getDate()).toBe(1);
  });

  it("should generate a correct grid for a 28-day February starting on Sunday (0 leading, 0 trailing nulls)", () => {
    // February 2015 starts on a Sunday (day 0) and has 28 days
    const grid = getMonthCalendarGrid(2015, 2);

    expect(grid.length % 7).toBe(0);
    expect(grid.length).toBe(28); // 0 leading nulls + 28 days + 0 trailing nulls

    // Check first day
    expect(grid[0]).not.toBeNull();
    expect(grid[0]?.getDate()).toBe(1);

    // Check last day
    expect(grid[27]).not.toBeNull();
    expect(grid[27]?.getDate()).toBe(28);

    // Check that there are no nulls at all in this specific case
    expect(grid.includes(null)).toBe(false);
  });
});

describe("getMonthCalendarCells", () => {
  it("fills the leading slots with previous-month days", () => {
    // Feb 2024 starts on a Thursday (weekday 4) — so 4 leading cells from Jan.
    const cells = getMonthCalendarCells(2024, 2);
    expect(cells.length).toBe(42); // Always 6 weeks.

    // Leading: Jan 28..31
    expect(cells[0].isCurrentMonth).toBe(false);
    expect(cells[0].date.getMonth()).toBe(0); // January
    expect(cells[0].date.getDate()).toBe(28);
    expect(cells[3].date.getDate()).toBe(31);

    // First Feb day
    expect(cells[4].isCurrentMonth).toBe(true);
    expect(cells[4].date.getMonth()).toBe(1);
    expect(cells[4].date.getDate()).toBe(1);

    // Last Feb day (Feb 29 in leap year)
    expect(cells[32].isCurrentMonth).toBe(true);
    expect(cells[32].date.getDate()).toBe(29);

    // Trailing: Mar 1..9
    expect(cells[33].isCurrentMonth).toBe(false);
    expect(cells[33].date.getMonth()).toBe(2);
    expect(cells[33].date.getDate()).toBe(1);
  });

  it("never produces empty cells — every slot has a date", () => {
    const cells = getMonthCalendarCells(2024, 9); // 30 days starting Sunday
    expect(cells.length).toBe(42);
    for (const cell of cells) {
      expect(cell.date).toBeInstanceOf(Date);
    }
    // First day is the 1st of the month (no leading days needed since Sep 1 is Sun).
    expect(cells[0].isCurrentMonth).toBe(true);
    expect(cells[0].date.getDate()).toBe(1);
    // Trailing slots come from October.
    expect(cells[30].isCurrentMonth).toBe(false);
    expect(cells[30].date.getMonth()).toBe(9);
  });

  it("handles year boundaries (December → January)", () => {
    const cells = getMonthCalendarCells(2024, 1); // Jan 2024 starts Monday
    // 1 leading slot from Dec 2023.
    expect(cells[0].date.getFullYear()).toBe(2023);
    expect(cells[0].date.getMonth()).toBe(11);
    expect(cells[0].date.getDate()).toBe(31);
    expect(cells[1].isCurrentMonth).toBe(true);
    expect(cells[1].date.getDate()).toBe(1);
  });
});
