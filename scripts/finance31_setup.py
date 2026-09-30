"""Apply the reviewed v3.1 integration patch. CI commits only these four TEST assets after tests pass."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
u=(ROOT/'finance-ui.js').read_text()
if '/* integrated finance 3.1 */' not in u:
 def replace(a,b):
  global u
  if u.count(a)!=1:raise RuntimeError('Unexpected finance UI version: '+a[:60])
  u=u.replace(a,b)
 replace("async function refresh(){if(loading)return loading;loading=(async()=>{const next=await rpc('test_finance_snapshot');const projected=F.project(next);snapshot=next;model=projected;hydrate();render();return next;})();try{return await loading}finally{loading=null}}", "async function refresh(){const previous=loading;const job=(async()=>{if(previous){try{await previous}catch(e){}}const next=await rpc('test_finance_snapshot');const projected=F.project(next);snapshot=next;model=projected;hydrate();render();return next;})();loading=job;try{return await job}finally{if(loading===job)loading=null}}")
 replace("const legacyFollowups=window.renderAutomaticFollowups,legacyCases=window.renderCases,legacyOpen=window.openCaseDetails,legacyShowPage=window.showPage;", "const legacyFollowups=window.renderAutomaticFollowups,legacyCases=window.renderCases,legacyOpen=window.openCaseDetails,legacyShowPage=window.showPage,legacyNewCase=window.openNewCase;")
 replace("commission_received:v('ePawappCollected')==='yes'", "...(v('ePawappCollected')==='yes'?{commission_received:true}:{})")
 extra='<div class="field"><label>الاتجاه</label><select id="eFinTransportDirection"><option value="">اختاري</option><option value="pickup">Pickup</option><option value="dropoff">Drop-off</option><option value="both">Pickup + Drop-off</option></select></div><div class="field"><label>الوقت</label><input id="eFinTransportAt" type="datetime-local"></div><div class="field"><label>مكان الاستلام</label><input id="eFinPickup"></div><div class="field"><label>مكان التوصيل</label><input id="eFinDropoff"></div>'
 replace('</div><div id="financeEditTransportStatus"',extra+'</div><div id="financeEditTransportStatus"')
 replace("transport_fee_value:v('eFinTransportFeeValue')||'0'});", "transport_fee_value:v('eFinTransportFeeValue')||'0',transport_direction:v('eFinTransportDirection')||null,transport_at:iso(v('eFinTransportAt')),pickup_location:v('eFinPickup')||null,dropoff_location:v('eFinDropoff')||null});")
 replace("function localDate(){", "function localInput(value){if(!value)return '';const d=new Date(value);return Number.isFinite(d.getTime())?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16):'';}\nfunction localDate(){")
 replace("eFinTransportFeeValue:c.transport_fee_value??c.transport_pawapp_amount??0}", "eFinTransportFeeValue:c.transport_fee_value??c.transport_pawapp_amount??0,eFinTransportDirection:c.transport_direction||'',eFinTransportAt:localInput(c.transport_at),eFinPickup:c.pickup_location||'',eFinDropoff:c.dropoff_location||''}")
 replace("window.openSettlement=id=>", "const oldFocusedEditor=window.openCaseWorkflow;\nwindow.openCaseWorkflow=function(id,mode){if(mode==='finance'){const pending=linesFor(id).find(actionable);if(pending){window.pawFinanceOpen(id,pending.component);return;}}oldFocusedEditor(id,mode);};\nwindow.openNewCase=function(){legacyNewCase();for(const[k,value]of Object.entries({cFinTransportFeeType:'fixed',cFinTransportPaid:'no',cFinTransportRecipient:''})){if(el(k))el(k).value=value;}window.calcCase();};\nwindow.openSettlement=id=>")
 replace("window.showPage=async function(id){await legacyShowPage(id);", "window.showPage=async function(id){if(id==='admin'&&!window.pawIsAdmin()){toast('Admin only');return;}await legacyShowPage(id);")
 start=u.index('function renderCases(){');end=u.index('\nfunction render(){',start)
 u=u[:start]+(ROOT/'scripts/case-table31.js').read_text().rstrip()+u[end:]
 u='/* integrated finance 3.1 */\n'+u
 c=(ROOT/'finance-core.js').read_text()
 for old,new in [("['Case ID','Component','Company'","['Case ID','Date','Component','Company'"),("padStart(4,'0'),l.component,providerName","padStart(4,'0'),l.date,l.component,providerName"),("rows.push(['TOTAL','','','','','','','',","rows.push(['TOTAL','','','','','','','','',")]:
  if c.count(old)!=1:raise RuntimeError('Unexpected finance core version')
  c=c.replace(old,new)
 a=(ROOT/'auth.js').read_text()
 if a.count("script.src = 'app.js';")!=1:raise RuntimeError('Unexpected auth loader')
 a=a.replace("script.src = 'app.js';","script.src = 'finance-entry.js?v=3.1';")
 i=(ROOT/'index.html').read_text()
 if i.count('<script src="auth.js"></script>')!=1:raise RuntimeError('Unexpected index loader')
 i=i.replace('<script src="auth.js"></script>','<script src="auth.js?v=finance31"></script>')
 for name,text in [('finance-ui.js',u),('finance-core.js',c),('auth.js',a),('index.html',i)]:
  (ROOT/name).write_text(text)
 print('Prepared TEST finance 3.1 assets.')
else:print('TEST finance 3.1 already applied; no changes.')
