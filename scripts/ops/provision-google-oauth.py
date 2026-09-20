#!/usr/bin/env python3
"""Provision only Hasheem Studio Google OAuth; never emit credentials or CLI payloads."""
import json
import os
from pathlib import Path
import re
import shlex
import stat
import subprocess
import tempfile

CLI = Path.home() / '.local/share/bitwarden-cli-2026.8/node_modules/.bin/bw'
HANDOFF = Path.home() / '.hasheemstudio_bw_session'
TARGET = Path('/etc/hasheemstudio/local.env')
ITEM = 'hasheemstudio-google-oauth'


def protected(path, directory=False):
    info = path.lstat()
    correct_type = stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
    if not correct_type or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError('protected_storage_required')


def update_env(text, values):
    lines = [line for line in text.splitlines()
             if line.partition('=')[0].strip().removeprefix('export ').strip() not in values]
    return '\n'.join(lines + [key + '=' + value for key, value in values.items()]) + '\n'


def credentials(item):
    if item.get('name') != ITEM:
        raise ValueError('exact_item_name_required')
    if not item.get('organizationId'):
        raise ValueError('organization_item_required')
    login = item.get('login') or {}
    fields = item.get('fields') or []
    # Read only this authorized item, and require unambiguous Google credential shapes.
    values = [login.get('username'), login.get('password'), item.get('notes')]
    values += [field.get('value') for field in fields]
    blob = '\n'.join(str(v) for v in values if v)
    clients = set(re.findall(r'(?<![A-Za-z0-9_-])[A-Za-z0-9_-]+\.apps\.googleusercontent\.com', blob))
    secrets = set(re.findall(r'GOCSPX-[A-Za-z0-9_-]+', blob))
    if len(clients) != 1:
        raise ValueError('GOOGLE_CLIENT_ID_missing_or_ambiguous')
    if len(secrets) != 1:
        raise ValueError('GOOGLE_SECRET_missing_or_ambiguous')
    return {'GOOGLE_ENABLED': 'true', 'GOOGLE_CLIENT_ID': clients.pop(), 'GOOGLE_SECRET': secrets.pop()}


def main():
    env = dict(os.environ)
    env.pop('BW_SESSION', None)
    evidence = {'item': ITEM, 'credentialsPrinted': False}
    error = None
    temporary = None
    used_session = False

    def run(args):
        return subprocess.run([str(CLI), *args], env=env, capture_output=True, timeout=60)

    try:
        if run(['--version']).stdout.decode().strip() != '2026.8.0':
            raise ValueError('compatible_cli_required')
        protected(HANDOFF)
        protected(TARGET.parent, True)
        protected(TARGET)
        session = HANDOFF.read_text().strip()
        if session.startswith(('export BW_SESSION=', 'BW_SESSION=')):
            words = shlex.split(session)
            if words[0] == 'export':
                words = words[1:]
            if len(words) != 1 or not words[0].startswith('BW_SESSION='):
                raise ValueError('invalid_handoff_format')
            session = words[0].split('=', 1)[1]
        if not re.fullmatch(r'[A-Za-z0-9_+/-]{16,8190}={0,2}', session):
            raise ValueError('invalid_handoff_format')
        env['BW_SESSION'] = session
        used_session = True
        response = run(['get', 'item', ITEM])
        if response.returncode:
            raise ValueError('named_item_retrieval_failed')
        item = json.loads(response.stdout)
        evidence['itemNameMatched'] = item.get('name') == ITEM
        evidence['organizationAssigned'] = bool(item.get('organizationId'))
        values = credentials(item)
        updated = update_env(TARGET.read_text(), values)
        fd, temporary = tempfile.mkstemp(prefix='.google-provision-', dir=TARGET.parent)
        with os.fdopen(fd, 'w') as output:
            output.write(updated)
            output.flush()
            os.fsync(output.fileno())
        protected(TARGET)
        os.replace(temporary, TARGET)
        temporary = None
        directory_fd = os.open(TARGET.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
        evidence.update({'provisioned': True, 'keysPresent': list(values), 'storage': str(TARGET), 'mode': oct(stat.S_IMODE(TARGET.stat().st_mode))})
    except Exception as exc:
        allowed = {'protected_storage_required', 'exact_item_name_required', 'organization_item_required', 'GOOGLE_CLIENT_ID_missing_or_ambiguous', 'GOOGLE_SECRET_missing_or_ambiguous', 'compatible_cli_required', 'invalid_handoff_format', 'named_item_retrieval_failed'}
        error = str(exc) if isinstance(exc, ValueError) and str(exc) in allowed else 'provision_failed_redacted'
        evidence.update({'provisioned': False, 'error': error})
    finally:
        if temporary:
            Path(temporary).unlink(missing_ok=True)
        if used_session:
            try:
                evidence['vaultLocked'] = run(['lock']).returncode == 0
            except Exception:
                evidence['vaultLocked'] = False
        env.pop('BW_SESSION', None)
        os.environ.pop('BW_SESSION', None)
        HANDOFF.unlink(missing_ok=True)
        evidence['sessionEnvironmentCleared'] = 'BW_SESSION' not in env
        evidence['handoffRemoved'] = not HANDOFF.exists()
    print(json.dumps(evidence))
    return 1 if error or evidence.get('vaultLocked') is not True else 0


if __name__ == '__main__':
    raise SystemExit(main())
