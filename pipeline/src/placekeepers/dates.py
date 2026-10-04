"""Calendar helpers shared by the pipeline."""

from __future__ import annotations

import calendar
from datetime import date


def months_before(day: date, months: int) -> date:
    """The same calendar day `months` earlier, clamped to the end of shorter months."""
    index = day.year * 12 + (day.month - 1) - months
    year, month = divmod(index, 12)
    month += 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))
