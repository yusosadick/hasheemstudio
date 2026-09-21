#!/usr/bin/env python3
"""Value-match current Studio credentials without disclosing matches or credential values."""
import base64,json,os,re,subprocess,urllib.parse
from pathlib import Path
root=Path(__file__).resolve().parents[2]
p=Path('/etc/hasheemstudio/local.env')
env=dict(l.split('=',1) for l in p.read_text().splitlines() if '=' in l and not l.startswith('#'))
values=[v for k,v in env.items() if re.search(r'PASSWORD|SECRET|TOKEN|SERVICE_ROLE|GOOGLE_CLIENT_ID|SMTP_PASS|RESEND.*KEY|SNIPPE_API_KEY',k) and len(v)>=8]
patterns=set()
for v in values:
 for x in [v,urllib.parse.quote(v,safe=''),base64.b64encode(v.encode()).decode()]:patterns.add(x.encode())
count=0;hits=[]
def check(label,data):
 global count
 count+=1
 if any(v in data for v in patterns):hits.append(label)
paths=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=root).decode().split('\0')
for name in paths:
 f=root/name
 if f.is_file():check('repository',f.read_bytes())
for sub in ['apps/web/dist','tmp']:
 for f in (root/sub).rglob('*'):
  if f.is_file() and (sub!='tmp' or f.suffix in ['.log','.json']):check('bundle' if sub.endswith('dist') else 'task_log',f.read_bytes())
check('diff',subprocess.check_output(['git','diff','HEAD'],cwd=root))
check('process_arguments',subprocess.check_output(['ps','ax','-o','args=']))
for name in ['hasheemstudio-auth','hasheemstudio-api']:
 r=subprocess.run(['docker','logs','--tail','1000',name],capture_output=True);check('service_log',r.stdout+r.stderr)
result={'passed':not hits,'surfacesChecked':count,'matchedSurfaceCategories':sorted(set(hits)),'scope':'Known current protected Studio credential values and URL/base64 forms; working tree/diff, bundle, task logs, process arguments and bounded Auth/API log tails. Not a universal history scan.','protectedEnvMode':oct(p.stat().st_mode&0o777),'protectedDirectoryMode':oct(p.parent.stat().st_mode&0o777),'handoffAbsent':not Path.home().joinpath('.hasheemstudio_bw_session').exists(),'bwSessionAbsent':not bool(os.environ.get('BW_SESSION'))}
(root/'docs/evidence/studio-product-secret-scan.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result));raise SystemExit(0 if result['passed'] else 1)
