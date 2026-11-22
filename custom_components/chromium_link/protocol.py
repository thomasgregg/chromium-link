"""Validate a dashboard destination and build Chromium's tab-creation request."""

from urllib.parse import quote, urlsplit


def validate_destination(value: str) -> str:
    """Accept absolute web URLs that contain no embedded credentials."""
    if len(value) > 4096 or any(char.isspace() or ord(char) < 32 for char in value):
        raise ValueError("Use an HTTP or HTTPS URL without whitespace.")

    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        raise ValueError("The web address is invalid.") from None

    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or "\\" in value
        or port == 0
    ):
        raise ValueError("Use an HTTP or HTTPS URL without credentials.")

    return value


def new_tab_path(destination: str) -> str:
    """Encode the whole URL as the first query component of the DevTools request."""
    return f"/json/new?{quote(validate_destination(destination), safe='')}"
