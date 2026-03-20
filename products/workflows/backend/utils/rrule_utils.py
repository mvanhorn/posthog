from datetime import datetime

import pytz
from dateutil.rrule import rrulestr

WINDOW_SIZE = 10  # Number of pending runs to maintain


def validate_rrule(rrule_string: str) -> None:
    """Validate an RRULE string. Raises ValueError if invalid."""
    rrulestr(rrule_string)


def compute_next_occurrences(
    rrule_string: str,
    starts_at: datetime,
    timezone_str: str = "UTC",
    after: datetime | None = None,
    count: int = WINDOW_SIZE,
) -> list[datetime]:
    """
    Compute the next `count` occurrences from an RRULE string.

    Expands the RRULE in the given timezone so that "9 AM Europe/Prague"
    stays at 9 AM local time across DST changes, then converts results to UTC.
    """
    tz = pytz.timezone(timezone_str)

    # Convert starts_at to the schedule's timezone for RRULE expansion
    if starts_at.tzinfo is not None:
        starts_at_local = starts_at.astimezone(tz)
    else:
        starts_at_local = tz.localize(starts_at)

    rule = rrulestr(rrule_string, dtstart=starts_at_local)

    if after is None:
        after_local = datetime.now(tz)
    elif after.tzinfo is not None:
        after_local = after.astimezone(tz)
    else:
        after_local = pytz.utc.localize(after).astimezone(tz)

    occurrences: list[datetime] = []
    current = after_local
    for _ in range(count * 10):  # Safety limit
        next_dt = rule.after(current, inc=False)
        if next_dt is None:
            break
        # Convert back to UTC for storage
        occurrences.append(next_dt.astimezone(pytz.utc))
        if len(occurrences) >= count:
            break
        current = next_dt

    return occurrences
