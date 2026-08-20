from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime


def _as_date(value: date | datetime | str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(value[:10])


def clamp_day(year: int, month: int, day: int) -> date:
    """Map day 31 onto Feb 28/29 and other short months instead of overflowing."""
    last_day = monthrange(year, month)[1]
    return date(year, month, min(max(day, 1), last_day))


def shift_month(year: int, month: int, delta: int) -> tuple[int, int]:
    month_index = year * 12 + (month - 1) + delta
    return month_index // 12, month_index % 12 + 1


def due_date_for_statement_month(
    year: int,
    month: int,
    statement_closing_day: int,
    payment_due_day: int,
) -> date:
    """Payment due for the statement that closes in ``year/month``.

    If the due day is after the closing day (e.g. close on the 5th, due on the
    25th), both fall in the same month. Otherwise the due date is next month
    (e.g. close on the 28th, due on the 21st).
    """
    if payment_due_day > statement_closing_day:
        return clamp_day(year, month, payment_due_day)
    next_year, next_month = shift_month(year, month, 1)
    return clamp_day(next_year, next_month, payment_due_day)


def calculate_next_due_date(
    statement_closing_day: int,
    payment_due_day: int,
    reference: date | datetime | str,
) -> date:
    ref = _as_date(reference)
    upcoming: list[date] = []
    for delta in range(-1, 3):
        year, month = shift_month(ref.year, ref.month, delta)
        due = due_date_for_statement_month(
            year, month, statement_closing_day, payment_due_day
        )
        if due >= ref:
            upcoming.append(due)
    if not upcoming:
        year, month = shift_month(ref.year, ref.month, 3)
        return due_date_for_statement_month(
            year, month, statement_closing_day, payment_due_day
        )
    return min(upcoming)


def last_statement_close(
    statement_closing_day: int,
    reference: date | datetime | str,
) -> date:
    ref = _as_date(reference)
    this_close = clamp_day(ref.year, ref.month, statement_closing_day)
    if this_close <= ref:
        return this_close
    year, month = shift_month(ref.year, ref.month, -1)
    return clamp_day(year, month, statement_closing_day)


def days_until_due(
    statement_closing_day: int,
    payment_due_day: int,
    reference: date | datetime | str,
) -> int:
    ref = _as_date(reference)
    return (calculate_next_due_date(statement_closing_day, payment_due_day, ref) - ref).days


def days_since_statement_close(
    statement_closing_day: int,
    reference: date | datetime | str,
) -> int:
    ref = _as_date(reference)
    return (ref - last_statement_close(statement_closing_day, ref)).days
