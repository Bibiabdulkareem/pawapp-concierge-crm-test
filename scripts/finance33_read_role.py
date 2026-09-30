"""Permit only the side-effect-free TEST snapshot RPC through the legacy read-only UI guard."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
a=ROOT/'app.js';s=a.read_text()
if 'isFinanceSnapshotRead' not in s:
 old="      if (document.body && ['read_only','accountant'].includes(document.body.dataset.pawRole) && !['GET','HEAD'].includes(method)) {"
 new="      const isFinanceSnapshotRead = method === 'POST' && /\\/rest\\/v1\\/rpc\\/test_finance_snapshot(?:[?#]|$)/.test(url);\n      if (document.body && ['read_only','accountant'].includes(document.body.dataset.pawRole) && !['GET','HEAD'].includes(method) && !isFinanceSnapshotRead) {"
 assert s.count(old)==1,'Unexpected read-only fetch guard'
 a.write_text(s.replace(old,new))
p=ROOT/'tests/finance_browser.py';t=p.read_text()
if "fetch('/mock/'+name" in t:
 t=t.replace("u.path.startswith('/mock/')", "u.path.startswith('/rest/v1/rpc/')")
 t=t.replace("fetch('/mock/'+name", "fetch('/rest/v1/rpc/'+name")
 t=t.replace("  assert not any(n=='test_finance_action' for n,_ in f.calls)", "  assert not any(n=='test_finance_action' for n,_ in f.calls)\n  denied=page.evaluate(\"fetch('/rest/v1/rpc/test_finance_action',{method:'POST',body:'{}'}).then(r=>r.status)\")\n  assert denied==403, 'Read-only finance write was not blocked'")
 p.write_text(t)
print('Read-only snapshot and write-denial paths included in browser coverage.')
