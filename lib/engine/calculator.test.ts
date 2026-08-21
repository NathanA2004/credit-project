import { describe, expect, it } from "vitest";

import {
  calculateNextDueDate,
  calculateRemainingGracePeriod,
  getPaymentPriorityOrder,
  type RankableCard,
} from "./calculator";

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function expectSameDay(actual: Date, expected: Date) {
  expect(actual.getFullYear()).toBe(expected.getFullYear());
  expect(actual.getMonth()).toBe(expected.getMonth());
  expect(actual.getDate()).toBe(expected.getDate());
}

function makeCard(overrides: Partial<RankableCard> & Pick<RankableCard, "id">): RankableCard {
  return {
    institutionName: "Test Bank",
    cardName: overrides.id,
    lastFourDigits: "0000",
    creditLimit: 10_000,
    currentBalance: 1_000,
    apr: 20,
    statementClosingDay: 1,
    paymentDueDay: 15,
    gracePeriodDays: 25,
    cashbackCategory: { default: 0.01 },
    ...overrides,
  };
}

describe("calculateNextDueDate", () => {
  it("clamps a 31st due day to April 30 in a 30-day month", () => {
    const due = calculateNextDueDate(15, 31, localDate(2026, 4, 1));
    expectSameDay(due, localDate(2026, 4, 30));
  });

  it("keeps a 31st due day in January, which has 31 days", () => {
    const due = calculateNextDueDate(15, 31, localDate(2026, 1, 1));
    expectSameDay(due, localDate(2026, 1, 31));
  });

  it("clamps statement close day 31 to April 30 and returns the following May due date", () => {
    const due = calculateNextDueDate(31, 25, localDate(2026, 4, 26));
    expectSameDay(due, localDate(2026, 5, 25));
  });

  it("uses February 29 when the due day is 31 in a leap year", () => {
    const due = calculateNextDueDate(15, 31, localDate(2028, 2, 1));
    expectSameDay(due, localDate(2028, 2, 29));
  });

  it("uses February 28 when the due day is 31 in a non-leap year", () => {
    const due = calculateNextDueDate(15, 31, localDate(2027, 2, 1));
    expectSameDay(due, localDate(2027, 2, 28));
  });

  it("rolls a past month-end due date into the next cycle", () => {
    const due = calculateNextDueDate(15, 31, localDate(2026, 4, 30));
    expectSameDay(due, localDate(2026, 4, 30));
  });
});

describe("calculateRemainingGracePeriod", () => {
  it("returns 0 on the due date", () => {
    expect(calculateRemainingGracePeriod(localDate(2026, 8, 20), localDate(2026, 8, 20))).toBe(0);
  });

  it("returns positive days remaining before the due date", () => {
    expect(calculateRemainingGracePeriod(localDate(2026, 8, 23), localDate(2026, 8, 20))).toBe(3);
  });

  it("returns negative days after the due date", () => {
    expect(calculateRemainingGracePeriod(localDate(2026, 8, 20), localDate(2026, 8, 22))).toBe(-2);
  });

  it("counts 29 days from Feb 1 to Mar 1 in a leap year", () => {
    expect(calculateRemainingGracePeriod(localDate(2028, 3, 1), localDate(2028, 2, 1))).toBe(29);
  });

  it("counts 28 days from Feb 1 to Mar 1 in a non-leap year", () => {
    expect(calculateRemainingGracePeriod(localDate(2027, 3, 1), localDate(2027, 2, 1))).toBe(28);
  });

  it("crosses a 31-day to 30-day month boundary", () => {
    expect(calculateRemainingGracePeriod(localDate(2026, 4, 30), localDate(2026, 3, 31))).toBe(30);
  });
});

describe("getPaymentPriorityOrder", () => {
  const referenceDate = localDate(2026, 8, 20);

  it("ranks an imminent due date (< 3 days) ahead of high utilization (>80%)", () => {
    const imminent = makeCard({
      id: "imminent",
      statementClosingDay: 1,
      paymentDueDay: 22,
      currentBalance: 1_000,
      creditLimit: 10_000,
      apr: 14.99,
    });
    const highUtilization = makeCard({
      id: "high-util",
      statementClosingDay: 28,
      paymentDueDay: 10,
      currentBalance: 9_200,
      creditLimit: 10_000,
      apr: 28.99,
    });

    const ranked = getPaymentPriorityOrder([highUtilization, imminent], referenceDate);

    expect(ranked.map((card) => card.id)).toEqual(["imminent", "high-util"]);
  });

  it("among non-imminent cards, ranks higher APR before higher utilization", () => {
    const highApr = makeCard({
      id: "high-apr",
      statementClosingDay: 28,
      paymentDueDay: 10,
      currentBalance: 1_000,
      creditLimit: 10_000,
      apr: 27.99,
    });
    const highUtilization = makeCard({
      id: "high-util",
      statementClosingDay: 28,
      paymentDueDay: 10,
      currentBalance: 8_500,
      creditLimit: 10_000,
      apr: 18.99,
    });

    const ranked = getPaymentPriorityOrder([highUtilization, highApr], referenceDate);

    expect(ranked.map((card) => card.id)).toEqual(["high-apr", "high-util"]);
  });

  it("with the same APR and no imminent due date, ranks utilization above 80% first", () => {
    const highUtilization = makeCard({
      id: "high-util",
      statementClosingDay: 28,
      paymentDueDay: 10,
      currentBalance: 8_800,
      creditLimit: 10_000,
      apr: 21.99,
    });
    const lowUtilization = makeCard({
      id: "low-util",
      statementClosingDay: 28,
      paymentDueDay: 10,
      currentBalance: 1_200,
      creditLimit: 10_000,
      apr: 21.99,
    });

    const ranked = getPaymentPriorityOrder([lowUtilization, highUtilization], referenceDate);

    expect(ranked.map((card) => card.id)).toEqual(["high-util", "low-util"]);
  });

  it("among imminent cards, ranks the earlier due date first even if the other is over 80% utilized", () => {
    const dueTomorrow = makeCard({
      id: "due-tomorrow",
      statementClosingDay: 1,
      paymentDueDay: 21,
      currentBalance: 500,
      creditLimit: 10_000,
      apr: 19.99,
    });
    const dueInTwoDays = makeCard({
      id: "due-in-two-days",
      statementClosingDay: 1,
      paymentDueDay: 22,
      currentBalance: 9_100,
      creditLimit: 10_000,
      apr: 24.99,
    });

    const ranked = getPaymentPriorityOrder([dueInTwoDays, dueTomorrow], referenceDate);

    expect(ranked.map((card) => card.id)).toEqual(["due-tomorrow", "due-in-two-days"]);
  });
});
