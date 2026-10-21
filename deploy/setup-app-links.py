#!/usr/bin/env python3
"""Configure public app association identifiers without changing API routing."""
import os
from pathlib import Path
import re
import tempfile


def association_values(apple_id, fingerprints):
    apple_id = apple_id.strip()
    if not re.fullmatch(r"[A-Z0-9]{10}\.org\.cdaconnect\.app", apple_id):
        raise ValueError("Use the Apple App ID prefix followed by .org.cdaconnect.app")
    values = list(dict.fromkeys(value.strip().upper() for value in fingerprints.split(",") if value.strip()))
    if not values or any(not re.fullmatch(r"(?:[A-F0-9]{2}:){31}[A-F0-9]{2}", value) for value in values):
        raise ValueError("Use the SHA-256 app-signing certificate fingerprint from Google Play App integrity")
    return {"IOS_APP_ID": apple_id, "ANDROID_APP_LINK_SHA256": ",".join(values)}


def save(path, updates):
    if path.is_symlink() or not path.is_file():
        raise ValueError("An existing, regular backend environment file is required")
    original = path.read_text()
    lines = [line for line in original.splitlines() if line.split("=", 1)[0].strip() not in updates]
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as output:
            temporary = Path(output.name)
            os.fchmod(output.fileno(), 0o600)
            output.write("\n".join(lines + [key+"="+value for key, value in updates.items()])+"\n")
            output.flush()
            os.fsync(output.fileno())
        temporary.replace(path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def main():
    if os.geteuid() != 0:
        raise SystemExit("Run with sudo on the application server.")
    path = Path("/etc/cda-connect/backend.env")
    if not path.is_file() or path.is_symlink():
        raise SystemExit("Configure the backend environment first.")
    print("Use the App ID prefix from Apple Developer and the app-signing certificate from Google Play.")
    apple = input("Apple application identifier (PREFIX.org.cdaconnect.app): ")
    android = input("Android SHA-256 app-signing fingerprint(s), comma-separated: ")
    updates = association_values(apple, android)
    save(path, updates)
    print("App-link settings saved. Restart the API through the normal deployment, then run verify-public.mjs --native.")


if __name__ == "__main__":
    main()
