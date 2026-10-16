#!/usr/bin/env python3
"""Configure the private FastAPI adapter without displaying or tracking credentials."""
import argparse
import getpass
import os
from pathlib import Path
import secrets
from urllib.parse import urlparse

def values(path):
    result = {}
    if path.exists():
        for line in path.read_text().splitlines():
            key, separator, value = line.partition('=')
            if separator and not key.lstrip().startswith('#'):
                result[key.strip()] = value.strip().strip('"').strip("'")
    return result

def save(path, updates):
    lines = path.read_text().splitlines() if path.exists() else []
    lines = [line for line in lines if line.split('=', 1)[0].strip() not in updates]
    text = '\n'.join(lines + [key+'='+value for key, value in updates.items()])+'\n'
    temporary = path.with_suffix('.next')
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        output.write(text)
    os.chmod(temporary, 0o600)
    temporary.replace(path)

def configure(root, defaults=False):
    backend, ai = root/'backend.env', root/'ai.env'
    current, provider = values(backend), values(ai)
    secret = current.get('AI_SERVICE_API_KEY') or provider.get('AI_SERVICE_API_KEY') or secrets.token_hex(32)
    if len(secret) < 32 or any(char in secret for char in '\r\n'):
        raise ValueError('AI service key must have at least 32 characters')
    provider['AI_SERVICE_API_KEY'] = secret
    if not defaults:
        provider['AI_PROVIDER_BASE_URL'] = input('OpenAI-compatible HTTPS base URL [https://api.openai.com/v1]: ').strip() or 'https://api.openai.com/v1'
        provider['AI_PROVIDER_MODEL'] = input('Model identifier (blank to keep source-only answers): ').strip()
        provider['AI_PROVIDER_API_KEY'] = getpass.getpass('Provider API key (blank to retain existing): ').strip() or provider.get('AI_PROVIDER_API_KEY', '')
        url = urlparse(provider['AI_PROVIDER_BASE_URL'])
        if url.scheme != 'https' or not url.hostname or url.username or url.password:
            raise ValueError('Use an HTTPS base URL without credentials')
    if any('\n' in value or '\r' in value for value in provider.values()):
        raise ValueError('Configuration cannot contain newlines')
    save(ai, provider)
    # Preserve explicitly configured legacy adapters during unattended upgrades.
    target = current.get('AI_SERVICE_URL') if defaults else None
    save(backend, {'AI_SERVICE_URL': target or 'http://127.0.0.1:8001/answer', 'AI_SERVICE_API_KEY': secret})

if __name__ == '__main__':
    parser = argparse.ArgumentParser();parser.add_argument('--defaults', action='store_true');args = parser.parse_args()
    configure(Path('/etc/cda-connect'), args.defaults)
    print('AI configuration saved. Restart cda-ai and cda-api to apply it.')
