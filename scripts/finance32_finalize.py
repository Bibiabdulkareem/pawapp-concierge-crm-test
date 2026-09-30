"""Finish TEST finance integration and enforce exact asynchronous browser assertions."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
u=(ROOT/'finance-ui.js').read_text()
if '/* settlement refresh 3.2 */' not in u:
 old="window.pawFinanceOpen=function(caseId,component='main'){const l=findLine(caseId,component);"
 new="window.pawFinanceOpen=function(caseId,component='main'){if(saving)return;const l=findLine(caseId,component);"
 assert u.count(old)==1,'Unexpected finance opener'
 u=u.replace(old,new)
 old="closeModal('financeActionModal');activeAction=null;await refresh();toast("
 new="await refresh();closeModal('financeActionModal');activeAction=null;toast("
 assert u.count(old)==1,'Unexpected settlement save handler'
 u=u.replace(old,new)
 u='/* settlement refresh 3.2 */\n'+u
 (ROOT/'finance-ui.js').write_text(u)
p=ROOT/'tests/finance_browser.py';t=p.read_text()
if 'def save_payment(page):' not in t:
 t='import re\n'+t
 marker='def run(browser_type,name,url,role='
 ix=t.index(marker)
 helper="def save_payment(page):\n page.click('#financeActionSave')\n expect(page.locator('#financeActionModal')).not_to_have_class(re.compile(r'\\bshow\\b'))\n expect(page.locator('#financeActionSave')).to_be_enabled()\n\n"
 t=t[:ix]+helper+t[ix:]
 ix=t.index(marker);t=t[:ix]+t[ix:].replace("page.click('#financeActionSave')",'save_payment(page)')
 t=re.sub(r"\.to_contain_text\('([0-9]+\.[0-9]{3})'\)",lambda m: ".to_have_text(re.compile(r'^"+re.escape(m[1])+r"\s'))",t)
 t=t.replace('.to_contain_text(value)',".to_have_text(re.compile(r'^'+re.escape(value)+r'\\s'))")
 t=t.replace("page.evaluate(\"showPage('followups');completeAppointmentFollowup('1')\");page.wait_for_timeout(200)","page.evaluate(\"showPage('followups')\");page.evaluate(\"completeAppointmentFollowup('1')\")")
 p.write_text(t)
print('Prepared settlement refresh guard and exact currency assertions.')
