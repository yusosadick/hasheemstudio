#!/usr/bin/env python3
"""Configure only Studio email presentation/redirects; existing SMTP credentials stay untouched."""
import os, stat, tempfile
from pathlib import Path
p=Path('/etc/hasheemstudio/local.env')
assert not p.is_symlink() and stat.S_IMODE(p.stat().st_mode)==0o600
assert stat.S_IMODE(p.parent.stat().st_mode)==0o700
lines=p.read_text().splitlines();env=dict(l.split('=',1) for l in lines if '=' in l and not l.startswith('#'))
assert env.get('SITE_URL')=='https://hasheemstudio.com'
assert env.get('API_EXTERNAL_URL')=='https://supabase.hasheemstudio.com/auth/v1'
updates={'ENABLE_EMAIL_AUTOCONFIRM':'false','ADDITIONAL_REDIRECT_URLS':'https://hasheemstudio.com/auth/callback,https://hasheemstudio.com/reset-password'}
for key,name in {'CONFIRMATION':'confirm-signup','RECOVERY':'reset-password','EMAIL_CHANGE':'change-email','INVITE':'invite','MAGIC_LINK':'magic-link','REAUTHENTICATION':'reauthentication'}.items():
 updates['MAILER_TEMPLATES_'+key]='https://hasheemstudio.com/auth-email-templates/'+name+'.html'
result=[l for l in lines if l.split('=',1)[0] not in updates]+[k+'='+v for k,v in updates.items()]
fd,name=tempfile.mkstemp(prefix='.email-config-',dir=p.parent)
try:
 os.fchmod(fd,0o600)
 with os.fdopen(fd,'w') as f:f.write('\n'.join(result)+'\n');f.flush();os.fsync(f.fileno())
 os.replace(name,p)
finally:
 if os.path.exists(name):os.unlink(name)
print('Studio email configuration updated; protected mode 0600; SMTP/Google credentials unchanged')
