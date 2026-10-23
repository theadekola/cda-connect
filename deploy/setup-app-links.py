#!/usr/bin/env python3
"""Configure public app association identifiers without changing API routing."""
import os
import argparse
from pathlib import Path
import re
import tempfile


def association_values(apple_id, fingerprints, platform="both"):
    if platform not in {"both", "ios", "android"}:
        raise ValueError("Choose ios, android or both")
    apple_id = apple_id.strip()
    if platform != "android" and not re.fullmatch(r"[A-Z0-9]{10}\.org\.cdaconnect\.app", apple_id):
        raise ValueError("Use the Apple App ID prefix followed by .org.cdaconnect.app")
    values = list(dict.fromkeys(value.strip().upper() for value in fingerprints.split(",") if value.strip()))
    if platform != "ios" and (not values or any(not re.fullmatch(r"(?:[A-F0-9]{2}:){31}[A-F0-9]{2}", value) for value in values)):
        raise ValueError("Use the SHA-256 app-signing certificate fingerprint from Google Play App integrity")
    result = {}
    if platform != "android":
        result["IOS_APP_ID"] = apple_id
    if platform != "ios":
        result["ANDROID_APP_LINK_SHA256"] = ",".join(values)
    return result


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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", choices=["both", "ios", "android"], default="both")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit("Run with sudo on the application server.")
    path = Path("/etc/cda-connect/backend.env")
    if not path.is_file() or path.is_symlink():
        raise SystemExit("Configure the backend environment first.")
    print("Use the App ID prefix from Apple Developer and the app-signing certificate from Google Play.")
    apple = input("Apple application identifier (PREFIX.org.cdaconnect.app): ") if args.platform != "android" else ""
    android = input("Android SHA-256 app-signing fingerprint(s), comma-separated: ") if args.platform != "ios" else ""
    updates = association_values(apple, android, args.platform)
    save(path, updates)
    print("App-link settings saved. Restart the API through the normal deployment, then run verify-public.mjs --native.")


if __name__ == "__main__":
    main()
