#!/usr/bin/env python3
"""Configure a dedicated Ubuntu coturn VM or the CDA Connect app VM.

Run --relay on the relay host and --app on the application host. Inputs and
secrets are requested locally. This does not open firewalls or configure DNS.
"""
import argparse
import datetime
import getpass
import ipaddress
import os
import pathlib
import re
import shutil
import subprocess
import tempfile


def hostname(value):
    value = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?", value) or "." not in value or "example." in value:
        raise ValueError("Enter your real TURN DNS hostname, without a scheme or port.")
    return value


def shared_secret(value):
    if not re.fullmatch(r"[a-fA-F0-9]{64}", value):
        raise ValueError("Use a shared secret generated locally with: openssl rand -hex 32")
    return value


def relay_config(host, public_ip, local_ip, secret, tls, tls_port=5349):
    host = hostname(host)
    public = ipaddress.IPv4Address(public_ip)
    local = ipaddress.IPv4Address(local_ip)
    if not public.is_global or local.is_loopback or local.is_unspecified:
        raise ValueError("A globally routable public IPv4 address and a valid local interface address are required.")
    lines = ["listening-port=3478", "listening-ip="+str(local), "relay-ip="+str(local),
             "external-ip="+str(public)+("/"+str(local) if public != local else ""),
             "realm="+host, "server-name="+host, "fingerprint", "use-auth-secret",
             "static-auth-secret="+shared_secret(secret), "min-port=49160", "max-port=49200",
             "user-quota=12", "total-quota=200", "no-multicast-peers", "no-cli", "no-tcp-relay",
             "no-dtls", "log-file=stdout", "simple-log", "pidfile=/run/cda-turn/turnserver.pid"]
    # Prevent authenticated users from relaying into the host's private network.
    for address in ["0.0.0.0-0.255.255.255", "10.0.0.0-10.255.255.255", "100.64.0.0-100.127.255.255",
                    "127.0.0.0-127.255.255.255", "169.254.0.0-169.254.255.255",
                    "172.16.0.0-172.31.255.255", "192.168.0.0-192.168.255.255",
                    "224.0.0.0-255.255.255.255", "::1", "fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
                    "fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff"]:
        lines.append("denied-peer-ip="+address)
    lines += ["tls-listening-port="+str(tls_port), "cert=/etc/cda-turn/fullchain.pem", "pkey=/etc/cda-turn/privkey.pem"] if tls else ["no-tls"]
    return "\n".join(lines)+"\n"


def app_values(host, secret, tls, tls_port=5349):
    host = hostname(host)
    urls = [f"turn:{host}:3478?transport=udp", f"turn:{host}:3478?transport=tcp"]
    if tls:
        urls.append(f"turns:{host}:{tls_port}?transport=tcp")
    return {"RTC_ICE_SERVERS": '[{"urls":"stun:stun.l.google.com:19302"}]',
            "RTC_TURN_URLS": ",".join(urls), "RTC_TURN_SECRET": shared_secret(secret), "RTC_TURN_TTL_SECONDS": "3600"}


def update_env(original, values):
    lines = [line for line in original.splitlines() if not re.match(r"^\s*(?:export\s+)?(?:"+"|".join(values)+r")\s*=", line)]
    return "\n".join(lines+[key+"="+value for key, value in values.items()])+"\n"


def atomic_write(path, text, mode=0o600, group=0):
    fd, temporary = tempfile.mkstemp(prefix=".cda-turn-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(text)
        os.chmod(temporary, mode)
        os.chown(temporary, 0, group)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    choice = parser.add_mutually_exclusive_group(required=True)
    choice.add_argument("--relay", action="store_true", help="Install configuration on a dedicated coturn host.")
    choice.add_argument("--app", action="store_true", help="Update /etc/cda-connect/backend.env, preserving a private backup.")
    args = parser.parse_args()
    if not hasattr(os, "geteuid") or os.geteuid() != 0:
        parser.error("Run on Ubuntu using sudo python3 deploy/setup-turn.py --relay or --app.")
    import pwd
    os.umask(0o077)
    host = hostname(input("TURN hostname (DNS-only, pointing to your public relay IP): "))
    secret = shared_secret(getpass.getpass("Shared secret (64 hex characters; hidden): "))
    tls = input("Enable TURN TLS using a trusted certificate? [y/N]: ").strip().lower() == "y"
    tls_port = int(input("TLS port (5349, or 443 on a dedicated relay VM with that port free) [5349]: ").strip() or "5349") if tls else 5349
    if not 1 <= tls_port <= 65535 or tls_port == 3478:
        raise ValueError("TLS port must be 1-65535 and different from 3478.")
    if args.app:
        target = pathlib.Path("/etc/cda-connect/backend.env")
        if target.is_symlink() or not target.is_file():
            raise ValueError("Expected an existing regular /etc/cda-connect/backend.env file.")
        original = target.read_text()
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        backup = target.with_name("backend.env.before-turn-"+stamp)
        atomic_write(backup, original)
        values = app_values(host, secret, tls, tls_port)
        values["RTC_RELAY_ONLY"] = "true" if input("Force all calls through TURN for initial testing? [y/N]: ").strip().lower() == "y" else "false"
        atomic_write(target, update_env(original, values))
        print("App TURN configuration saved; private backup:", backup)
        print("Deploy CDA Connect or restart cda-api and cda-worker after the updated code is installed.")
        return
    binary = shutil.which("turnserver")
    if not binary:
        raise ValueError("Install coturn first: sudo apt-get update && sudo apt-get install -y coturn")
    target = pathlib.Path("/etc/cda-turn/turnserver.conf")
    unit = pathlib.Path("/etc/systemd/system/cda-turn.service")
    if target.exists() or unit.exists():
        raise ValueError("A CDA TURN installation already exists. Review it manually; no secrets were rotated.")
    if subprocess.run(["systemctl", "is-active", "--quiet", "coturn"]).returncode == 0:
        raise ValueError("Default coturn is active. On a NEW dedicated TURN VM, stop it with sudo systemctl disable --now coturn before continuing.")
    public_ip = input("Relay public IPv4 address: ").strip()
    local_ip = input("Relay local interface IPv4 (ip -4 addr; same as public IP if no NAT): ").strip()
    text = relay_config(host, public_ip, local_ip, secret, tls, tls_port)
    certificate = key = None
    if tls:
        certificate = pathlib.Path(input("Trusted TLS fullchain certificate path: ").strip())
        key = pathlib.Path(input("TLS private key path: ").strip())
        if not certificate.is_file() or not key.is_file():
            raise ValueError("Certificate and key files must already exist locally.")
        subprocess.run(["openssl", "x509", "-in", str(certificate), "-noout", "-checkhost", host], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["openssl", "x509", "-in", str(certificate), "-noout", "-checkend", "86400"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    user = pwd.getpwnam("turnserver")
    target.parent.mkdir(mode=0o750, exist_ok=True)
    os.chown(target.parent, 0, user.pw_gid)
    if tls:
        for source, name in [(certificate, "fullchain.pem"), (key, "privkey.pem")]:
            destination = target.parent / name
            shutil.copyfile(source, destination)
            os.chmod(destination, 0o640)
            os.chown(destination, 0, user.pw_gid)
    atomic_write(target, text, 0o640, user.pw_gid)
    atomic_write(unit, "[Unit]\nDescription=CDA Connect TURN relay\nAfter=network-online.target\nWants=network-online.target\n[Service]\nUser=turnserver\nGroup=turnserver\nAmbientCapabilities=CAP_NET_BIND_SERVICE\nCapabilityBoundingSet=CAP_NET_BIND_SERVICE\nRuntimeDirectory=cda-turn\nExecStart="+binary+" -c /etc/cda-turn/turnserver.conf\nRestart=on-failure\nRestartSec=3\nNoNewPrivileges=true\nPrivateTmp=true\nProtectHome=true\nProtectSystem=strict\n[Install]\nWantedBy=multi-user.target\n", 0o644)
    subprocess.run(["systemctl", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "enable", "--now", "cda-turn"], check=True)
    subprocess.run(["systemctl", "is-active", "--quiet", "cda-turn"], check=True)
    print("TURN service started. External reachability has NOT been verified.")
    print("Allow TCP/UDP 3478, UDP 49160-49200", f"and TCP {tls_port}." if tls else ".")
    print("If behind NAT, forward those ports to the relay local IP without changing relay port numbers.")
    print("Certificates were copied; after renewal, refresh the copies and restart cda-turn.")


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        raise SystemExit(str(error))
    except (OSError, subprocess.CalledProcessError, KeyError):
        raise SystemExit("TURN setup did not complete. Check prerequisites and inputs; real secrets were not printed.")
