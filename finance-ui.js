/* settlement refresh 3.2 */
/* integrated finance 3.1 */
/* TEST-only finance integration. The legacy layout remains; monetary reads/writes use finance v3 RPCs. */
window.PawFinanceInstall=async function(){
'use strict';
if(window.__pawFinanceInstalled)return;
if(!window.PAWAPP_AUTH?.client||!window.PawFinanceCore)throw Error('Finance dependencies missing');
window.__pawFinanceInstalled=true;
const F=window.PawFinanceCore,el=id=>document.getElementById(id),v=id=>el(id)?.value??'',set=(id,value)=>{if(el(id))el(id).textContent=String(value)},html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=(ar,en)=>window.PawI18n?.t(ar,en)??ar;
const cash=x=>F.format(x)+' '+t('د.ك','DK'),num=x=>Number(F.format(x)),caseCode=id=>'PAW-'+String(id).padStart(4,'0');
const mayWrite=()=>['admin','operations'].includes(window.PAWAPP_AUTH?.access?.role);
const maySettle=()=>['admin','operations','accountant'].includes(window.PAWAPP_AUTH?.access?.role);
const NO_EXTERNAL_REFERENCE='بدون مرجع خارجي - تسوية مؤكدة داخل النظام';
const mayActOnLine=l=>mayWrite()||(maySettle()&&['provider_paid','commission_received'].includes(l?.action));
let snapshot=null,model=null,loading=null,selectedProvider=null,activeAction=null,saving=false,editorRevision=null;
let periodSettlements=[];
let recordedPayments=null;
async function loadRecordedPayments(){
 try{
  const client=window.PAWAPP_AUTH.client, rows=[],size=500;
  for(let offset=0;;offset+=size){
   const q=await client.from('test_client_payments').select('id,case_id,component,amount,paid_at').order('id').range(offset,offset+size-1);
   if(q.error)throw q.error;
   rows.push(...(q.data||[]));
   if((q.data||[]).length<size)break;
  }
  recordedPayments=rows;
 }catch(e){recordedPayments=null;console.warn('Payment-date ledger unavailable',e?.message||e);}
}

async function loadPeriodSettlements(){const q=await window.PAWAPP_AUTH.client.from('test_provider_period_settlements').select('id,provider_id,period_from,period_to,direction,amount,paid_at,method,reference,approved_at');if(q.error){console.warn('Settlement records unavailable',q.error.message);periodSettlements=[];}else periodSettlements=q.data||[];}

const requests=new Map();
let septemberReviewRows=[];
async function loadSeptemberReviews(){
  const result=await window.PAWAPP_AUTH.client.from('test_referral_import_review')
    .select('source_key,source_row,source_data')
    .eq('sheet_name','Sep - 2026')
    .eq('review_status','employee_followup_financials_pending')
    .order('source_row');
  if(result.error){console.warn('September reviews:',result.error.message);septemberReviewRows=[];return;}
  septemberReviewRows=result.data||[];
}
function renderSeptemberReviews(){
  const finance=el('followupFinanceList');
  if(!finance)return;
  let box=el('septemberFinanceReviews');
  if(!box){box=document.createElement('section');box.id='septemberFinanceReviews';finance.before(box);}
  box.innerHTML=false&&septemberReviewRows.length?
    '<h3>استكمال البيانات المالية — '+septemberReviewRows.length+' عمليات</h3>'+
    septemberReviewRows.map(r=>{
      const v=r.source_data?.values||[];
      const identity=v[0]&&String(v[0]).trim().toUpperCase()!=='N/A'?v[0]:(v[1]||'عميل غير مسجل');
      const original=(label,value)=>'<span>'+label+': <b>'+html(value==null||value===''?'غير مسجل':value)+' '+t('د.ك','DK')+'</b></span>';
      return '<div class="card provider"><h3>'+html(identity)+'</h3>'+
      '<div class="hint">'+html(v[6]||'مقدم خدمة غير مسجل')+' • '+html(v[4]||'نوع غير مسجل')+
      (v[11]?' • '+html(v[11]):'')+'</div>'+
      '<div class="hint">سبتمبر 2026 • صف الإكسل: '+r.source_row+'</div>'+
      '<div class="hint">المبالغ المسجلة سابقاً: '+original('الإجمالي',v[10])+' | '+original('PawApp',v[8])+' | '+original('مقدم الخدمة',v[9])+'</div>'+
      '<div class="actions"><button class="btn primary" onclick="pawReviewSeptember('+r.source_row+')"><!--paw-i18n-->استكمال البيانات المالية</button></div></div>';
    }).join(''):'';
}
window.pawCloseSeptemberReview=function(){const modal=el('septemberReviewModal');if(modal)modal.style.display='none';};
window.pawReviewSeptember=function(row){
  const r=septemberReviewRows.find(x=>x.source_row===row);if(!r)return;
  const v=r.source_data?.values||[],saved=r.source_data?.financial_review||{};
  let modal=el('septemberReviewModal');
  if(!modal){document.body.insertAdjacentHTML('beforeend','<div id="septemberReviewModal" class="modalBg"><div class="modal"><div class="modalHead"><h3><!--paw-i18n-->استكمال البيانات المالية</h3><button class="close" onclick="pawCloseSeptemberReview()">×</button></div><div id="septemberReviewBody"></div></div></div>');modal=el('septemberReviewModal');}
  const field=(key,label,source)=>'<div class="field"><label>'+html(t(label))+'</label><input type="number" min="0" step="0.001" id="sep_'+key+'" value="'+html(saved[key]??'')+'" placeholder="'+html(source==null?'غير مسجل':'المصدر: '+source)+'"></div>';
  el('septemberReviewBody').innerHTML='<div class="hint"><b>سبتمبر 2026 — صف الإكسل '+row+'</b></div>'+
    '<div class="hint">العميل: '+html(v[0]||'غير مسجل')+' | الهاتف: '+html(v[1]||'غير مسجل')+' | تاريخ الخدمة: '+html(v[11]||'غير مسجل')+' | الخدمة: '+html(v[6]||'غير محددة')+'</div>'+
    '<div class="grid2" style="margin-top:12px">'+field('total','إجمالي العميل',v[10])+field('paw','حصة PawApp',v[8])+field('provider','حصة مقدم الخدمة',v[9])+field('collected','المبلغ المحصل لـ PawApp',null)+'</div>'+
    '<div class="field" style="margin-top:12px"><label><!--paw-i18n-->جهة استلام دفعة العميل</label><select id="sep_recipient"><option value=""><!--paw-i18n-->اختاري</option><option value="pawapp">PawApp</option><option value="provider"><!--paw-i18n-->مقدم الخدمة</option></select></div>'+
    '<div class="field" style="margin-top:12px"><label><!--paw-i18n-->ملاحظات وإثبات التحصيل</label><textarea id="sep_note" rows="2">'+html(saved.note||'')+'</textarea></div>'+
    '<div class="hint"><!--paw-i18n-->المبالغ المصدرية للرجوع فقط؛ لا يتم افتراض أي قيمة أو اعتمادها تلقائياً.</div>'+
    '<button class="btn primary" style="width:100%;margin-top:12px" onclick="pawSaveSeptemberReview('+row+')"><!--paw-i18n-->حفظ واعتماد وإقفال المتابعة</button>';
  el('sep_recipient').value=saved.recipient||'';
  modal.style.display='flex';
};
window.pawSaveSeptemberReview=async function(row){
  if(!mayWrite()){alert('الحفظ للأدمن والعمليات فقط');return;}
  const r=septemberReviewRows.find(x=>x.source_row===row);if(!r)return;
  const value=k=>el('sep_'+k)?.value.trim()||'';
  const keys=['total','paw','provider','collected'],values={};
  for(const k of keys){values[k]=value(k);if(values[k]!==''&&(!Number.isFinite(Number(values[k]))||Number(values[k])<0)){alert('راجعي المبلغ');return;}}
  if(['total','paw','provider'].every(k=>values[k]!=='')&&Math.abs(Number(values.total)-Number(values.paw)-Number(values.provider))>0.001){alert('الإجمالي لا يساوي مجموع حصة PawApp ومقدم الخدمة');return;}
  values.recipient=value('recipient');values.note=value('note');
  const complete=keys.every(k=>values[k]!=='')&&values.recipient!=='';
  if(!complete){alert('أكملي جميع المبالغ وجهة استلام دفعة العميل قبل الاعتماد والإقفال.');return;}
  if(!confirm('هل تؤكدين اعتماد البيانات المصححة وإقفال متابعة الصف '+row+'؟\\nالإجمالي: '+values.total+' د.ك\\nPawApp: '+values.paw+' د.ك\\nمقدم الخدمة: '+values.provider+' د.ك\\nالمحصّل لـ PawApp: '+values.collected+' د.ك\\nجهة الدفع: '+values.recipient+'\\nسيتم حفظ التصحيح مع بقاء المصدر الأصلي.'))return;
  values.updated_at=new Date().toISOString();
  values.approved=complete;
  const next={...r.source_data,financial_review:values};
  const nextStatus='financial_review_completed_pending_accounting';
  const {data,error}=await window.PAWAPP_AUTH.client.from('test_referral_import_review')
    .update({source_data:next,review_status:nextStatus})
    .eq('source_key',r.source_key).eq('review_status','employee_followup_financials_pending')
    .select('source_key');
  if(error){alert('تعذر الحفظ: '+error.message);return;}
  if(!data?.length){alert('لم يتم تحديث المتابعة. أعيدي تحميل الصفحة للتحقق من حالتها.');return;}
  r.source_data=next;
  septemberReviewRows=septemberReviewRows.filter(x=>x.source_key!==r.source_key);
  el('septemberReviewModal').style.display='none';
  await refresh();
  toast('تم اعتماد العملية وترحيلها للحسابات وتحديث التقارير تلقائياً');
};
const notes={transport_payment_unknown:'ناقص تأكيد سداد النقل وجهة الاستلام',payment_route_missing:'ناقص تحديد من استلم دفعة العميل',direct_provider_and_payout:'مسجل دفع مباشر للشركة ومعه تحويل للشركة؛ راجعي التسجيلين',duplicate_commission_route:'مسجل استلام كامل لدى PawApp ومعه استلام عمولة من الشركة',client_overpaid:'الدفعات تتجاوز إجمالي الخدمة',provider_overpaid:'التحويلات تتجاوز حصة الشركة',commission_overpaid:'المستلم يتجاوز عمولة PawApp',paid_flag_mismatch:'حالة السداد لا تطابق سجل الدفعات',price_split_mismatch:'تقسيم السعر يحتاج مراجعة',invalid_price:'السعر أو النسبة غير صحيح',unpriced_service:'أكملي السعر',provider_missing:'اختاري مقدم الخدمة',cancelled_case_requires_review:'عملية ملغاة؛ راجعي أثرها المالي قبل إصدار التقرير'};
const review=l=>l.issues.map(i=>t(notes[i]||i)).join(' — ');
// Archive only previously imported Jul/Aug/Sep 2026 cases that are paid and closed.
 // Never exempt new/backdated cases without the exact import marker.
const archivedHistorical=l=>{
  const c=(snapshot?.cases||[]).find(x=>String(x.id)===String(l.caseId))||l.raw||{};
  const tag=/\[BULK_IMPORT:2026:(?:7|8|9):ROW:\d+\]/;
  return tag.test(String(c.notes||'')) &&
    String(c.workflow_status||'').toLowerCase()==='closed' &&
    (c.client_paid===true||String(c.client_paid).toLowerCase()==='true');
};
const actionable=l=>!archivedHistorical(l)&&Boolean(l.action||l.issues.length);
function requestFor(key,payload){const signature=JSON.stringify(payload);const old=requests.get(key);if(old?.signature===signature)return old.id;const id=crypto.randomUUID();requests.set(key,{id,signature});return id;}
async function rpc(name,args={}){if(!name.startsWith('test_finance_'))throw Error('TEST finance calls only');const {data,error}=await window.PAWAPP_AUTH.client.rpc(name,args);if(error)throw Error(error.message||'تعذر حفظ العملية');return data;}
function message(error){const text=String(error?.message||error);const rules=[['Case changed','الحالة تعدلت من جهاز آخر. أغلقيها وافتحيها من جديد قبل الحفظ.'],['Paid service price/provider','الخدمة فيها دفعات مسجلة؛ لا نغيّر سعرها أو مقدمها بدون تصحيح موثق.'],['Paid transport price/provider','النقل فيه دفعات مسجلة؛ لا نغيّر سعره أو الشركة بدون تصحيح موثق.'],['Cannot change received payment','المبلغ مسجل كمستلم. لا يمكن تحويله إلى غير مدفوع بدون تصحيح موثق.'],['Cannot change a paid transaction recipient','لا يمكن تغيير مستلم دفعة مسجلة بدون مراجعة.'],['Cannot clear recorded commission','العمولة مستلمة ومسجلة؛ لا يمكن مسح استلامها.'],['Choose payment recipient','اختاري جهة استلام دفعة العميل.'],['No permission','ما عندج صلاحية لتعديل الحسابات.'],['Invalid amount','المبلغ غير صحيح أو أكبر من المتبقي.']];return rules.find(r=>text.includes(r[0]))?.[1]||text;}
function hydrate(){if(!snapshot)return;db.staff=snapshot.employees||[];db.providers=(snapshot.providers||[]).map(p=>({...p,type:p.provider_type,feeType:p.default_fee_type||'percent',feeValue:Number(p.default_fee_value||0),services:(snapshot.services||[]).filter(s=>String(s.provider_id)===String(p.id)).map(s=>s.name)}));db.cases=snapshot.cases.map(c=>({...c,providerId:c.provider_id,service:c.service_name,amount:Number(c.total_amount),staff:db.staff.find(e=>String(e.id)===String(c.employee_id))?.name||'',providerPaid:Number(c.main_provider_paid||0),clientPaidAmount:Number(c.main_paid_recorded||0),schedule:[]}));db.followups=snapshot.followups||[];}
async function refresh(){const previous=loading;const job=(async()=>{if(previous){try{await previous}catch(e){}}const next=await rpc('test_finance_snapshot');const projected=F.project(next);await loadSeptemberReviews();await loadPeriodSettlements();await loadRecordedPayments();await loadMonthlyTargets();await epLoadTargets();snapshot=next;model=projected;hydrate();render();return next;})();loading=job;try{return await job}finally{if(loading===job)loading=null}}
const legacyFollowups=window.renderAutomaticFollowups,legacyCases=window.renderCases,legacyOpen=window.openCaseDetails,legacyShowPage=window.showPage,legacyNewCase=window.openNewCase;
function linesFor(id){return model?.lines.filter(l=>l.caseId===String(id))||[]}
function findLine(id,component){return linesFor(id).find(l=>l.component===component)}
function providerName(id){return snapshot?.providers.find(p=>String(p.id)===String(id))?.name||'غير محدد'}
function pawClinicOf(id){return window.PawProviderAffiliations?.clinicFor(id)||''}
function pawClinicTag(id){const clinic=pawClinicOf(id);return clinic?'<span class="paw-clinic-label">تابع لعيادة '+html(clinic.replace('عيادة ',''))+'</span>':'';}
function actionLabel(l){if(l.unknown)return t('تأكيد سداد النقل');if(l.action==='client_paid')return t(l.isPaid?'تحديد جهة استلام الدفعة':'تحصيل من العميل');if(l.action==='provider_paid')return t('دفع مستحق الشركة');if(l.action==='commission_received')return t('تحصيل حصة PawApp');return t('مراجعة التسجيل');}
function detail(l){if(l.unknown)return t('سعر النقل ','Transport price: ')+cash(l.total)+t(' — لم تُحدد حالة سداده بعد',' — payment not confirmed');if(l.action==='client_paid')return l.isPaid?t('العميل دافع؛ المطلوب فقط تحديد جهة الاستلام'):t('متبقي على العميل ','Customer balance: ')+cash(l.unpaid);if(l.action==='provider_paid')return t('للشركة عندنا ','Due to provider: ')+cash(l.theirs);if(l.action==='commission_received')return t('لنا عند الشركة ','Due from provider: ')+cash(l.ours);return review(l)||t('مكتمل ماليًا');}
function actionButton(l){if(!mayActOnLine(l))return '';return '<button class="btn primary" type="button" onclick="pawFinanceOpen(\''+l.caseId+'\',\''+l.component+'\')">'+html(actionLabel(l))+'</button>';}
function metric(label,id,value,hint=''){return '<div class="card stat"><span>'+html(t(label))+'</span><b id="'+id+'">'+html(value)+'</b>'+(hint?'<small class="hint">'+html(t(hint))+'</small>':'')+'</div>';}
function summaryCards(s,prefix){return metric('إجمالي الخدمات شامل النقل',prefix+'Total',cash(s.total))+metric('حصة PawApp المحسوبة',prefix+'Share',cash(s.paw),'الحصة لا تتغير عند تحصيلها')+metric('حصص مقدمي الخدمات',prefix+'ProviderShare',cash(s.provider))+metric('حصة PawApp المحصّلة',prefix+'Collected',cash(s.pawCollected))+metric('المدفوع من العملاء',prefix+'Paid',cash(s.paid))+metric('غير المدفوع من العملاء',prefix+'Unpaid',cash(s.unpaid),s.unknownCount?'بالإضافة إلى '+s.unknownCount+' خدمة نقل لم يتأكد سدادها':'')+metric('لنا عند الشركات',prefix+'Ours',cash(s.ours))+metric('للشركات عندنا',prefix+'Theirs',cash(s.theirs));}

/* Home analytics V2: read-only projection of the existing finance model. */
/* TEST monthly Concierge target: shared per calendar month; read-only finance projection. */
let targetMonth='',targetRows=null,targetError=false,targetSaving=false;
async function loadMonthlyTargets(){
 try{
  const q=await window.PAWAPP_AUTH.client.from('test_monthly_targets').select('month,amount').order('month');
  if(q.error)throw q.error;
  targetRows=new Map((q.data||[]).map(r=>[String(r.month).slice(0,7),F.minor(r.amount)]));targetError=false;
 }catch(e){targetRows=null;targetError=true;console.warn('Monthly target unavailable',e?.message||e);}
}
function monthlyTargetStats(lines,month,today,goal){
 const [y,m]=month.split('-').map(Number);
 const last=new Date(Date.UTC(y,m,0)).getUTCDate(),end=month+'-'+String(last).padStart(2,'0');
 const complete=new Set(['appointment_completed','payment_completed','closed']);
 const rows=lines.filter(l=>!l.cancelled&&l.date>=month+'-01'&&l.date<=end&&l.date<=today&&complete.has(l.raw?.workflow_status)&&l.total>0n&&!l.issues.some(x=>['invalid_price','price_split_mismatch'].includes(x)));
 const earned=rows.reduce((sum,l)=>sum+l.paw,0n);
 const collected=rows.reduce((sum,l)=>sum+l.pawCollected,0n);
 const remaining=goal>earned?goal-earned:0n;
 const days=today<month+'-01'?last:today>end?0:last-Number(today.slice(8,10))+1;
 const percent=Number(earned*1000n/goal)/10;
 return {earned,collected,remaining,days,percent,daily:days>0?(remaining+BigInt(days)-1n)/BigInt(days):null};
}
function renderMonthlyTarget(){
 const host=el('dashboard');if(!host||!model)return;
 let panel=el('pawMonthlyTarget');
 if(!panel){panel=document.createElement('section');panel.id='pawMonthlyTarget';panel.className='card';panel.style.cssText='margin:0 0 16px;padding:clamp(12px,2vw,22px);min-width:0';const title=host.querySelector('.title');if(!title)return;title.after(panel);}
 const today=localDate();if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth))targetMonth=today.slice(0,7);
 const canEdit=window.PAWAPP_AUTH?.access?.role==='admin';
 const heading='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><h2 style="margin:0">'+html(t('الهدف الشهري للكونسيرج','Concierge monthly target'))+'</h2><label class="hint">'+html(t('الشهر','Month'))+' <input type="month" id="pawTargetMonth" value="'+html(targetMonth)+'" min="2000-01" max="2099-12" style="max-width:155px"></label></div>';
 if(targetError||!targetRows){panel.innerHTML=heading+'<p class="hint">'+html(t('تعذر تحميل الأهداف الشهرية. حدّثي الصفحة للمحاولة مرة أخرى.','Monthly targets unavailable. Refresh to retry.'))+'</p>';el('pawTargetMonth').onchange=e=>{targetMonth=e.target.value;renderMonthlyTarget()};return;}
 const configured=targetRows.has(targetMonth),goal=targetRows.get(targetMonth)??10000000n;
 const x=monthlyTargetStats(model.lines,targetMonth,today,goal);
 const pct=Math.min(100,x.percent);
 const cell=(ar,en,value)=>'<div style="background:#f3f6fa;padding:12px;border-radius:10px;min-width:0"><div class="hint">'+html(t(ar,en))+'</div><b style="display:block;font-size:clamp(15px,2vw,22px);overflow-wrap:anywhere;margin-top:5px">'+html(value)+'</b></div>';
 panel.innerHTML=heading+
 '<div style="display:flex;justify-content:space-between;align-items:end;gap:10px;flex-wrap:wrap;margin-top:12px"><div><div class="hint">'+html(t('حصة PawApp للخدمات المكتملة','PawApp share of completed services'))+'</div><b style="font-size:clamp(22px,3vw,32px);color:#0c3b78">'+html(cash(x.earned))+'</b><span class="hint"> / '+html(cash(goal))+'</span></div><b style="font-size:22px;color:#166534">'+x.percent.toFixed(1)+'%</b></div>'+
 '<div role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'" style="height:12px;background:#e5edf8;border-radius:9px;overflow:hidden;margin:12px 0"><div style="height:100%;width:'+pct+'%;background:#16834f;border-radius:9px"></div></div>'+
 '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">'+cell('المتبقي للهدف','Remaining to target',cash(x.remaining))+cell('الأيام المتاحة (تشمل اليوم)','Days available (including today)',String(x.days))+cell('المطلوب يومياً','Required daily',x.daily===null?'—':cash(x.daily))+cell('الحصة المحصلة حسب السجلات','Collected share per records',cash(x.collected))+'</div>'+
 '<p class="hint">'+html(t('حسب تاريخ الخدمة المكتملة، يشمل حصة النقل، ويستبعد الملغاة والمستقبلية والأخطاء السعرية. لا يمثل صافي الربح أو التحصيل البنكي. لا يتأثر بفلاتر التحليل المالي أدناه.','By completed service date; includes transport share and excludes cancelled, future and pricing-error items. Not net profit or bank receipts. Independent of the analytics filters below.'))+'</p>'+
 '<p class="hint">'+html(configured?t('الهدف محفوظ لهذا الشهر.','Saved target for this month.'):t('الهدف الافتراضي لهذا الشهر: 10,000 د.ك.','Default target for this month: 10,000 DK.'))+'</p>'+
 (canEdit?'<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap"><label class="hint" style="flex:1;min-width:130px">'+html(t('تعديل هدف الشهر','Edit monthly target'))+'<input id="pawTargetAmount" type="number" min="0.001" max="999999999.999" step="0.001" value="'+F.format(goal)+'" style="display:block;width:100%;box-sizing:border-box"></label><button id="pawTargetSave" class="btn primary" type="button"'+(targetSaving?' disabled':'')+'>'+html(t('حفظ الهدف','Save target'))+'</button></div><div id="pawTargetMessage" class="hint" role="status"></div>':'');
 el('pawTargetMonth').onchange=e=>{targetMonth=e.target.value;renderMonthlyTarget()};
 if(el('pawTargetSave'))el('pawTargetSave').onclick=async()=>{
  if(targetSaving||window.PAWAPP_AUTH?.access?.role!=='admin')return;
  const month=targetMonth,raw=v('pawTargetAmount');let amount;
  try{if(!/^\d+(?:\.\d{1,3})?$/.test(raw))throw Error();amount=F.minor(raw);if(amount<=0n||amount>999999999999n)throw Error();}catch(e){set('pawTargetMessage',t('أدخلي هدفاً صحيحاً أكبر من صفر وبحد أقصى ثلاث منازل عشرية.','Enter a positive target with at most three decimal places.'));return;}
  targetSaving=true;el('pawTargetSave').disabled=true;
  try{const q=await window.PAWAPP_AUTH.client.from('test_monthly_targets').upsert({month:month+'-01',amount:F.format(amount),updated_at:new Date().toISOString()},{onConflict:'month'});if(q.error)throw q.error;await loadMonthlyTargets();renderMonthlyTarget();if(targetMonth===month)set('pawTargetMessage',t('تم حفظ الهدف لهذا الشهر.','Monthly target saved.'));}catch(e){set('pawTargetMessage',t('تعذر حفظ الهدف.','Unable to save target.'));}finally{targetSaving=false;if(el('pawTargetSave'))el('pawTargetSave').disabled=false;}
 };
}

function renderHomeAnalytics(){
 const host=el('dashboard');if(!host||!model)return;
 let panel=el('pawHomeAnalytics');
 if(!panel){
  panel=document.createElement('section');panel.id='pawHomeAnalytics';panel.className='card';
  panel.style.cssText='margin:0 0 20px;padding:clamp(12px,2vw,24px);min-width:0;max-width:100%;overflow:hidden';
  const title=host.querySelector('.title');if(!title)return;title.after(panel);
  panel.innerHTML='<style>#pawHomeAnalytics .ha-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin:12px 0}#pawHomeAnalytics .ha-controls label{display:grid;gap:4px;font-size:12px;flex:1;min-width:115px}#pawHomeAnalytics select,#pawHomeAnalytics input{width:100%;min-width:0;padding:8px;border:1px solid #dbe2ed;border-radius:8px;background:white;color:#10233d}#pawHomeAnalytics .ha-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}#pawHomeAnalytics .ha-kpi{background:#f4f7fb;border-radius:12px;padding:12px;min-width:0}#pawHomeAnalytics .ha-kpi b{display:block;font-size:19px;margin-top:8px;overflow-wrap:anywhere}#pawHomeAnalytics .ha-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}:is(#pawHomeAnalytics,#pawHomeSources) .ha-block{border:1px solid #e3e9f0;border-radius:12px;padding:12px;min-width:0}#pawHomeAnalytics .ha-bar{height:8px;background:#e5edf8;border-radius:8px;overflow:hidden;margin:5px 0 12px}#pawHomeAnalytics .ha-bar i{display:block;height:100%;background:#0c3b78;border-radius:8px}#pawHomeAnalytics .ha-chart{display:flex;gap:8px;overflow-x:auto;align-items:end;padding:12px 0;direction:ltr}#pawHomeAnalytics .ha-col{flex:1 0 48px;text-align:center;font-size:10px;min-width:48px}#pawHomeAnalytics .ha-bars{height:110px;display:flex;align-items:end;justify-content:center;gap:3px}#pawHomeAnalytics .ha-bars i{width:14px;display:block;border-radius:4px 4px 0 0;background:#0c3b78}#pawHomeAnalytics .ha-bars i+ i{background:#16834f}@media(max-width:650px){#pawHomeAnalytics .ha-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#pawHomeAnalytics .ha-grid{grid-template-columns:1fr}}#dashboard{max-width:1500px;margin-inline:auto;min-width:0}#pawHomeAnalytics .ha-controls{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;background:#f5f7fa;padding:12px;border-radius:12px}#pawHomeAnalytics .ha-controls label{min-width:0}#pawHomeAnalytics .ha-controls input,#pawHomeAnalytics .ha-controls select{min-height:42px;font-size:14px;box-sizing:border-box}#pawHomeAnalytics .ha-kpis{gap:12px}#pawHomeAnalytics .ha-kpi{border-top:4px solid #64748b;padding:14px}#pawHomeAnalytics .ha-kpi b{font-size:clamp(15px,1.65vw,25px);font-variant-numeric:tabular-nums}#pawHomeAnalytics .ha-kpi[data-tone=total]{background:#eff6ff;border-color:#3267ae;color:#24538a}#pawHomeAnalytics .ha-kpi[data-tone=paw]{background:#eaf2ff;border-color:#0c3b78;color:#0c3b78}#pawHomeAnalytics .ha-kpi[data-tone=collected]{background:#edf9f2;border-color:#16834f;color:#166534}#pawHomeAnalytics .ha-kpi[data-tone=remain]{background:#fff9db;border-color:#e0b400;color:#715b00}:is(#pawHomeAnalytics,#pawHomeSources) .ha-block{padding:16px;min-width:0}:is(#pawHomeAnalytics,#pawHomeSources) .ha-block h3{font-size:15px;line-height:1.5}#pawHomeAnalytics .ha-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}#pawHomeAnalytics .ha-chart{max-width:100%;scrollbar-width:thin;overscroll-behavior-inline:contain}#pawHomeAnalytics .ha-col{flex:1 0 65px;font-variant-numeric:tabular-nums;font-size:11px}#pawHomeAnalytics .ha-bars{height:155px}#pawHomeAnalytics .ha-bars i{background:#0c3b78;width:18px}#pawHomeAnalytics .ha-bars i+i{background:#83cba5}#pawHomeAnalytics .ha-rank{border-top:4px solid var(--rank)}#pawHomeAnalytics .ha-rank .ha-bar i{background:var(--rank)}#pawHomeAnalytics .ha-rank .ha-bar{height:9px;margin-bottom:14px}#pawHomeAnalytics .ha-rank summary,#pawHomeAnalytics .ha-comparison summary,#pawHomeDetails summary{cursor:pointer;font-weight:700;padding:6px 0;line-height:1.6}#pawHomeAnalytics .ha-rank details{border-top:1px solid #e3e9f0;margin-top:8px;padding-top:6px}#pawHomeAnalytics .ha-rank .ha-rank-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:13px}#pawHomeAnalytics .ha-rank .ha-rank-row span{min-width:0;overflow-wrap:anywhere}#pawHomeAnalytics .ha-rank .ha-rank-row b{white-space:nowrap;font-size:12px}#pawHomeDetails>.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}#pawHomeDetails>.card{margin-top:10px}#dashboard>.cards .card{min-width:0;overflow-wrap:anywhere}@media(max-width:1050px){#pawHomeAnalytics .ha-controls{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:650px){#pawHomeAnalytics .ha-controls{grid-template-columns:repeat(2,minmax(0,1fr));padding:8px;gap:8px}#pawHomeAnalytics .ha-grid{grid-template-columns:minmax(0,1fr);gap:10px}#pawHomeAnalytics .ha-kpis,#pawHomeDetails>.cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#pawHomeAnalytics .ha-kpi{padding:10px}:is(#pawHomeAnalytics,#pawHomeSources) .ha-block{padding:12px}#pawHomeAnalytics .ha-bars{height:125px}#pawHomeAnalytics .ha-col{flex-basis:58px}#pawHomeAnalytics .ha-controls input[type=date]{font-size:12px}#dashboard>.cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media(max-width:360px){#pawHomeAnalytics .ha-controls{grid-template-columns:minmax(0,1fr)}#pawHomeAnalytics .ha-kpi b{font-size:14px}}:is(#pawHomeAnalytics,#pawHomeSources) .ha-source-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);align-items:center;gap:20px;padding:16px 0}:is(#pawHomeAnalytics,#pawHomeSources) .ha-donut{width:min(230px,100%);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;margin:auto}:is(#pawHomeAnalytics,#pawHomeSources) .ha-donut>div{width:68%;aspect-ratio:1;background:white;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center}:is(#pawHomeAnalytics,#pawHomeSources) .ha-donut b{font-size:32px;color:#0c3b78}:is(#pawHomeAnalytics,#pawHomeSources) .ha-legend>div{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #e3e9f0;font-size:13px}:is(#pawHomeAnalytics,#pawHomeSources) .ha-legend i,:is(#pawHomeAnalytics,#pawHomeSources) .ha-source-dot{display:inline-block;width:12px;height:12px;border-radius:3px;flex:none;margin-inline-end:4px}:is(#pawHomeAnalytics,#pawHomeSources) .ha-legend span{flex:1;overflow-wrap:anywhere}:is(#pawHomeAnalytics,#pawHomeSources) .ha-legend b{white-space:nowrap}:is(#pawHomeAnalytics,#pawHomeSources) .ha-source-table{overflow-x:auto;max-width:100%;margin-top:12px}:is(#pawHomeAnalytics,#pawHomeSources) .ha-source-table table{min-width:560px}:is(#pawHomeAnalytics,#pawHomeSources) .ha-source-table th,:is(#pawHomeAnalytics,#pawHomeSources) .ha-source-table td{text-align:start} @media(max-width:650px){:is(#pawHomeAnalytics,#pawHomeSources) .ha-source-layout{grid-template-columns:minmax(0,1fr);gap:12px}:is(#pawHomeAnalytics,#pawHomeSources) .ha-donut{width:185px}}</style><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 id="haTitle" style="margin:0;font-size:20px"></h2></div><div class="ha-controls"><label><span id="haPeriodLabel"></span><select id="haPeriod"></select></label><label><span id="haFromLabel"></span><input id="haFrom" type="date"></label><label><span id="haToLabel"></span><input id="haTo" type="date"></label><label><span id="haProviderLabel"></span><select id="haProvider"></select></label><label><span id="haServiceLabel"></span><select id="haService"></select></label><label><span id="haGroupLabel"></span><select id="haGroup"></select></label></div><div id="haResults"></div>';
  panel.dataset.lang=window.PawI18n?.language||'ar';
  el('haPeriod').innerHTML='<option value="month"><!--paw-i18n-->هذا الشهر</option><option value="today"><!--paw-i18n-->اليوم</option><option value="week"><!--paw-i18n-->آخر 7 أيام</option><option value="year"><!--paw-i18n-->هذه السنة</option><option value="all"><!--paw-i18n-->كل الفترات</option><option value="custom"><!--paw-i18n-->مخصص</option>';
  el('haGroup').innerHTML='<option value="day">Daily</option><option value="month">Monthly</option><option value="year">Yearly</option>';
  el('haPeriod').value='all';el('haGroup').value='month';

  for(const id of ['haPeriod','haFrom','haTo','haProvider','haService','haGroup'])el(id).onchange=()=>{if(id==='haFrom'||id==='haTo')el('haPeriod').value='custom';renderHomeAnalytics()};
 }
 const en=(window.PawI18n?.language||'ar')==='en',tr=(a,b)=>en?b:a;
 panel.dataset.lang=en?'en':'ar';
 panel.dir=en?'ltr':'rtl';set('haTitle',tr('التحليل المالي','Financial analytics'));
 for(const [id,a,b] of [['haPeriodLabel','الفترة','Period'],['haFromLabel','من','From'],['haToLabel','إلى','To'],['haProviderLabel','مقدم الخدمة','Provider'],['haServiceLabel','الخدمة','Service'],['haGroupLabel','عرض المخطط','Chart grouping']])set(id,tr(a,b));
 const period=el('haPeriod').value||'all',group=el('haGroup').value||'month',provider=el('haProvider').value;
 const options=(id,items,current)=>{el(id).innerHTML=items.map(([v,a,b])=>'<option value="'+html(v)+'">'+html(tr(a,b))+'</option>').join('');el(id).value=current;};
 options('haPeriod',[['month','هذا الشهر','This month'],['today','اليوم','Today'],['week','آخر 7 أيام','Last 7 days'],['year','هذه السنة','This year'],['all','كل الفترات','All time'],['custom','مخصص','Custom']],period);
 options('haGroup',[['day','يومي','Daily'],['month','شهري','Monthly'],['year','سنوي','Yearly']],group);
 options('haProvider',[['','الكل','All providers'],...model.providers.map(p=>[String(p.id),p.name,p.name])],provider||'');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=k=>today.find(p=>p.type===k).value;const now=part('year')+'-'+part('month')+'-'+part('day');
 const prior=new Date(now+'T12:00:00Z');prior.setUTCDate(prior.getUTCDate()-6);
 if(period!=='custom'){el('haTo').value=period==='all'?'':now;el('haFrom').value=period==='all'?'':period==='today'?now:period==='week'?prior.toISOString().slice(0,10):period==='year'?now.slice(0,4)+'-01-01':now.slice(0,7)+'-01';}
 const from=el('haFrom').value,to=el('haTo').value,selected=el('haProvider').value;
 if(from&&to&&from>to){set('haResults',tr('تاريخ البداية بعد النهاية','Start date is after end date'));set('pawHomeSources',tr('تاريخ البداية بعد النهاية','Start date is after end date'));return;}
 const eligible=model.lines.filter(l=>!l.cancelled&&(!selected||l.providerId===selected));
 const serviceKey=l=>String(l.service||'').trim().toLowerCase();
 const serviceNames=new Map();for(const l of eligible){if(serviceKey(l)&&!serviceNames.has(serviceKey(l)))serviceNames.set(serviceKey(l),String(l.service).trim());}
 const chosen=el('haService').value||'';
 options('haService',[['','الكل','All services'],...[...serviceNames].sort((a,b)=>a[1].localeCompare(b[1])).map(([k,n])=>[k,n,n])],serviceNames.has(chosen)?chosen:'');
 const service=el('haService').value;
 const active=eligible.filter(l=>!service||serviceKey(l)===service);
 const rows=active.filter(l=>(!from||l.date&&l.date>=from)&&(!to||l.date&&l.date<=to));
 const sum=F.summarize(rows),money=x=>F.format(x)+' '+tr('د.ك','DK'),remain=sum.paw>sum.pawCollected?sum.paw-sum.pawCollected:0n;
 const kpi=(a,b,x,tone)=>'<div class="ha-kpi" data-tone="'+tone+'"><span class="hint">'+html(tr(a,b))+'</span><b>'+html(money(x))+'</b></div>';
 let out='<div class="ha-kpis">'+kpi('قيمة العمليات','Service value',sum.total,'total')+kpi('عمولات PawApp المستحقة','Earned PawApp fees',sum.paw,'paw')+kpi('العمولات المحصلة حسب السجلات','Collected fees per records',sum.pawCollected,'collected')+kpi('عمولات غير محصلة','Uncollected fees',remain,'remain')+'</div>';
 out+='<div class="ha-block" style="margin-top:12px"><h3>'+html(tr('مصدر بيانات سداد العملاء','Customer payment evidence'))+'</h3><div class="ha-kpis">'+kpi('دفعات مسجلة في السجل','Recorded payment entries',sum.recordedPaid,'collected')+kpi('مسددة حسب الحالة التاريخية فقط','Paid by historical status only',sum.legacyPaid,'remain')+'</div><p class="hint">'+html(tr('المبالغ حسب تاريخ الخدمة المختار. حالة السداد التاريخية ليست قيد دفعة أو إثباتاً بنكياً. لا تُجمع هذه المؤشرات مرة أخرى مع المدفوع من العملاء.','Amounts follow the selected service dates. Historical paid status is not a payment entry or bank evidence. Do not add these indicators again to total customer payments.'))+'</p></div>';
 if(from&&to){
  const start=new Date(from+'T12:00:00Z'),end=new Date(to+'T12:00:00Z'),days=Math.round((end-start)/86400000)+1;
  const prevEnd=new Date(start.getTime()-86400000).toISOString().slice(0,10),prevStart=new Date(start.getTime()-days*86400000).toISOString().slice(0,10);
  const prev=F.summarize(active.filter(l=>l.date&&l.date>=prevStart&&l.date<=prevEnd));
  const change=(a,b)=>b===0n?tr('لا توجد قاعدة مقارنة','No comparison baseline'):((Number(a-b)/Number(b)*100)>=0?'+':'')+(Number(a-b)/Number(b)*100).toFixed(1)+'%';
  out+='<details class="ha-block ha-comparison" style="margin-top:12px"><summary>'+html(tr('مقارنة بالفترة السابقة المماثلة','Previous equal-length period'))+'</summary><p class="hint">'+html(prevStart+' — '+prevEnd)+'</p><div class="ha-kpis">'+[['قيمة العمليات','Service value','total'],['عمولات PawApp','PawApp fees','paw'],['العمولات المحصلة','Collected fees','pawCollected']].map(([a,b,k])=>'<div class="ha-kpi"><span class="hint">'+html(tr(a,b))+'</span><b>'+html(change(sum[k],prev[k]))+'</b><small>'+html(tr('سابقاً: ','Previously: ')+money(prev[k]))+'</small></div>').join('')+'</div></details>';
 }
 const groups=new Map();for(const l of rows){if(!l.date)continue;const key=l.date.slice(0,group==='year'?4:group==='month'?7:10);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(l);}
 const points=[...groups].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,ls])=>[key,F.summarize(ls)]);const max=points.reduce((m,[,x])=>Math.max(m,Number(x.paw),Number(x.pawCollected)),1);
 out+='<div class="ha-block" style="margin-top:12px"><h3 style="margin:0">'+html(tr('حركة عمولات PawApp','PawApp fee trend'))+'</h3><div class="hint">'+html(tr('أزرق: مستحقة • أخضر: محصلة حالياً حسب تاريخ الخدمة','Blue: earned • Green: currently collected, grouped by service date'))+'</div><div class="ha-chart">'+points.map(([key,x])=>'<div class="ha-col"><div class="ha-bars"><i title="'+html(money(x.paw))+'" style="height:'+Number(x.paw)/max*100+'%"></i><i title="'+html(money(x.pawCollected))+'" style="height:'+Number(x.pawCollected)/max*100+'%"></i></div><div>'+html(key)+'</div><div>'+html(F.format(x.paw))+'</div><div style="color:#16834f">'+html(F.format(x.pawCollected))+'</div></div>').join('')+'</div>'+(points.length?'':'<p class="hint">'+html(tr('لا توجد عمليات مؤرخة في الفترة','No dated services in period'))+'</p>')+'</div>';


 // Dated ledger: actual payment rows, not a reconstruction of historic flags.
 out+='<div class="ha-block" style="margin-top:12px"><h3>'+html(tr('مدفوعات العملاء حسب تاريخ الدفع المسجل','Recorded client payments by payment date'))+'</h3><p class="hint">'+html(tr('سجل الدفعات فقط. الفلتر حسب تاريخ الدفع، وليس تاريخ الخدمة. لا يشمل العمليات القديمة المسجلة كمدفوعة دون قيد دفعة، ولا يمثل صافي ربح أو تحصيل PawApp البنكي.','Payment ledger only. Filtered by recorded payment date, not service date. Historic paid flags without a payment row are excluded. Not net profit or PawApp bank receipts.'))+'</p>';
 if(recordedPayments===null)out+='<p class="hint">'+html(tr('تعذر تحميل سجل الدفعات؛ لم يتم افتراض أن قيمته صفر.','Payment ledger unavailable; no zero value is assumed.'))+'</p>';
 else {
  try{
   const allowed=new Set(active.map(l=>l.caseId+':'+l.component));
   const matches=recordedPayments.filter(p=>allowed.has(String(p.case_id)+':'+p.component));
   const dated=matches.filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(String(p.paid_at||'')));
   const selectedPayments=dated.filter(p=>(!from||p.paid_at>=from)&&(!to||p.paid_at<=to));
   const amounts=new Map();let total=0n;
   for(const p of selectedPayments){const amount=F.minor(p.amount),key=p.paid_at.slice(0,group==='year'?4:group==='month'?7:10);total+=amount;amounts.set(key,(amounts.get(key)||0n)+amount);}
   const chart=[...amounts].sort((a,b)=>a[0].localeCompare(b[0])),peak=chart.reduce((m,[,v])=>Math.max(m,Number(v)),1);
   out+='<div class="ha-kpis" style="grid-template-columns:repeat(auto-fit,minmax(125px,1fr))">'+kpi('الدفعات المسجلة','Recorded payments',total,'collected')+'<div class="ha-kpi"><span class="hint">'+html(tr('عدد قيود الدفعات','Payment records'))+'</span><b>'+selectedPayments.length+'</b></div></div>';
   out+='<div class="ha-chart">'+chart.map(([key,v])=>'<div class="ha-col"><div class="ha-bars"><i title="'+html(money(v))+'" style="height:'+Number(v)/peak*100+'%;background:#83cba5"></i></div><div>'+html(key)+'</div><div>'+html(F.format(v))+'</div></div>').join('')+'</div>';
   if(!chart.length)out+='<p class="hint">'+html(tr('لا توجد دفعات مؤرخة في الفترة المختارة.','No dated payment records in this period.'))+'</p>';
   out+='<p class="hint">'+html(tr('قيود بلا تاريخ ضمن الخدمات المطابقة: ','Undated payment rows for matching services: '))+(matches.length-dated.length)+'</p>';
  }catch(e){out+='<p class="hint">'+html(tr('توجد مبالغ تحتاج مراجعة؛ لم يتم عرض إجمالي غير مؤكد.','Payment amounts require review; no unverified total is shown.'))+'</p>';}
 }
 out+='</div>';

 // Source analytics count distinct cases, never service/transport lines twice.
 const sourceOf=l=>{
  const raw=String(l.raw?.source||'').trim().toLowerCase().replace(/[\s_-]+/g,'');
  const names={tiktok:['TikTok','TikTok'],instagram:['Instagram','Instagram'],whatsapp:['WhatsApp','WhatsApp'],snapchat:['Snapchat','Snapchat'],facebook:['Facebook','Facebook'],referral:['توصية','Referral'],existingcustomer:['عميل سابق','Existing customer'],google:['Google','Google'],historicalexcel:['مستورد من Excel — غير محدد','Excel import — unknown'],bookingform:['نموذج حجز — قناة غير محددة','Booking form — channel unknown'],petinfo:['نموذج بيانات — قناة غير محددة','Pet form — channel unknown'], 'استشارههاتفيه':['استشارة هاتفية','Phone consultation']};
  return {key:names[raw]?raw:'unknown',label:names[raw]?tr(...names[raw]):tr('غير محدد','Unknown')};
 };
 const analyticsPhone=l=>F.validPhone(l.phone);
 const sourceGroups=new Map(),allCases=new Set(),knownPhones=new Set();
 for(const l of rows){const src=sourceOf(l);if(!sourceGroups.has(src.key))sourceGroups.set(src.key,{...src,lines:[],cases:new Set(),phones:new Set()});const g=sourceGroups.get(src.key);g.lines.push(l);g.cases.add(l.caseId);allCases.add(l.caseId);const phone=analyticsPhone(l);if(phone){g.phones.add(phone);knownPhones.add(phone);}}
 const sources=[...sourceGroups.values()].sort((a,b)=>b.cases.size-a.cases.size);
 const palette={tiktok:'#0c3b78',instagram:'#b5a0e5',whatsapp:'#83cba5',snapchat:'#f8d449',facebook:'#80b5ed',referral:'#f4b084',existingcustomer:'#7acdc8',google:'#e9a8c5',historicalexcel:'#cbd5e1',bookingform:'#a9c7f5',petinfo:'#c5dda0','استشارههاتفيه':'#f4b084',unknown:'#b5a0e5'};
 let pos=0;const slices=sources.map(g=>{const a=pos;pos+=100*g.cases.size/(allCases.size||1);return (palette[g.key]||'#a7b0bc')+' '+a+'% '+pos+'%';});
 const gradient=slices.length?'conic-gradient('+slices.join(',')+')':'#e3e9f0';
 let sourceHtml='<div class="ha-block" style="margin-top:16px"><h3 style="margin:0 0 8px">'+html(tr('من وين تجينا الطلبات؟','Where requests come from'))+'</h3><div class="hint">'+html(tr('حسب المصدر المسجل لكل عملية غير ملغاة','By recorded source of each non-cancelled case'))+'</div><div class="ha-source-layout"><div class="ha-donut" role="img" aria-label="'+html(tr('توزيع مصادر العمليات','Case source distribution'))+'" style="background:'+gradient+'"><div><b>'+allCases.size+'</b><small>'+html(tr('عملية','Cases'))+'</small></div></div><div class="ha-legend">'+sources.map(g=>'<div><i style="background:'+palette[g.key]+'"></i><span>'+html(g.label)+'</span><b>'+g.cases.size+' · '+(100*g.cases.size/(allCases.size||1)).toFixed(1)+'%</b></div>').join('')+'<p class="hint">'+knownPhones.size+' '+html(tr('رقم هاتف مختلف ضمن الفترة (عدد تقريبي للعملاء)','distinct normalized phone numbers in period (customer proxy)'))+'</p></div></div></div>';
 sourceHtml+='<div class="ha-block" style="margin-top:12px"><h3 style="margin:0 0 6px">'+html(tr('السوشال ميديا ومصادر الطلبات','Social media & request sources'))+'</h3><div class="hint">'+html(tr('النتائج حسب المصدر المسجل؛ ليست قياساً للوصول أو الحملات الممولة','Recorded sources only; not ad reach or paid campaign attribution'))+'</div><div class="ha-source-table"><table><thead><tr>'+[['المصدر','Source'],['العمليات','Cases'],['أرقام مختلفة','Distinct phones'],['قيمة العمليات','Service value'],['عمولات PawApp','PawApp fees']].map(([a,b])=>'<th>'+html(tr(a,b))+'</th>').join('')+'</tr></thead><tbody>'+sources.map(g=>{const x=F.summarize(g.lines);return '<tr><td><span class="ha-source-dot" style="background:'+palette[g.key]+'"></span>'+html(g.label)+'</td><td>'+g.cases.size+'</td><td>'+g.phones.size+'</td><td>'+html(money(x.total))+'</td><td>'+html(money(x.paw))+'</td></tr>';}).join('')+'</tbody></table></div><p class="hint">'+html(tr('قد يظهر نفس رقم الهاتف في أكثر من مصدر. لا يتم جمع أعداد الهواتف عبر المصادر.','A phone may appear in multiple sources; do not add source phone counts.'))+'</p></div>';
 let sourcePanel=el('pawHomeSources');if(!sourcePanel){sourcePanel=document.createElement('section');sourcePanel.id='pawHomeSources';sourcePanel.className='card';sourcePanel.style.cssText='margin:16px 0;min-width:0;padding:clamp(12px,2vw,24px)';host.appendChild(sourcePanel);}
 sourcePanel.dir=panel.dir;sourcePanel.innerHTML='<h2 style="margin:0;font-size:20px">'+html(tr('مصادر الطلبات والسوشال ميديا','Request sources & social media'))+'</h2><p class="hint">'+html(tr('حسب فلاتر التحليل المالي أعلاه','Using the financial analytics filters above'))+'</p>'+sourceHtml;
 function rank(keyFn,nameFn,metric){const m=new Map();for(const l of rows){const k=keyFn(l);if(!k)continue;if(!m.has(k))m.set(k,{name:nameFn(l),lines:[]});m.get(k).lines.push(l);}return [...m.values()].map(x=>({...x,s:F.summarize(x.lines)})).sort((a,b)=>a.s[metric]>b.s[metric]?-1:a.s[metric]<b.s[metric]?1:0).filter(x=>x.s[metric]>0n).slice(0,10);}
 function ranking(a,b,items,metric,tone){const max=Number(items[0]?.s[metric]||1n);const row=(x,i)=>'<div class="ha-rank-row"><span>'+String(i+1)+'. '+html(x.name)+'</span><b>'+html(money(x.s[metric]))+'</b></div><div class="hint">'+x.s.caseCount+' '+html(tr('عمليات','cases'))+'</div><div class="ha-bar"><i style="width:'+Number(x.s[metric])/max*100+'%"></i></div>';return '<div class="ha-block ha-rank" style="--rank:'+tone+'"><h3 style="margin:0 0 12px">'+html(tr(a,b))+'</h3>'+(items.slice(0,3).map(row).join('')||'<p class="hint">'+html(tr('لا توجد بيانات','No data'))+'</p>')+(items.length>3?'<details><summary>'+html(tr('عرض بقية الترتيب','Show more'))+'</summary>'+items.slice(3).map((x,i)=>row(x,i+3)).join('')+'</details>':'')+'</div>';}
 const providerKey=l=>pawClinicOf(l.providerId)||l.providerId,providerLabel=l=>pawClinicOf(l.providerId)?tr('عيادة مينا عبدالله','Mina Abdullah Clinic'):providerName(l.providerId);
 out+='<div class="ha-grid">'+ranking('أعلى الشركات حسب عمولة PawApp','Top providers by PawApp fees',rank(providerKey,providerLabel,'paw'),'paw','#80b5ed')+ranking('أكثر العملاء إنفاقاً (حسب الهاتف)','Top customers by actual payments (phone grouped)',rank(l=>analyticsPhone(l),l=>l.client||tr('عميل','Customer'),'paid'),'paid','#83cba5')+ranking('أعلى الشركات حسب قيمة العمليات','Top providers by service value',rank(providerKey,providerLabel,'total'),'total','#b5a0e5')+ranking('أعلى الخدمات حسب عمولات PawApp','Top services by PawApp fees',rank(serviceKey,l=>String(l.service||'').trim(),'paw'),'paw','#f8d449')+'</div>';
 out+='<p class="hint">'+html(tr('الأرقام حسب تاريخ الخدمة وليست تاريخ التحصيل البنكي. المستحقات والتسويات الحالية أدناه دون تغيير. لا تشمل العمولات المصاريف أو صافي الربح. عمليات بلا تاريخ: ','Figures use service date, not bank collection date. Existing balances and settlements below are unchanged. Fees exclude expenses and are not net profit. Undated cases: '))+new Set(active.filter(l=>!l.date).map(l=>l.caseId)).size+'</p>';
 const open=[...el('haResults').querySelectorAll('details')].map(d=>d.open);el('haResults').innerHTML=out;[...el('haResults').querySelectorAll('details')].forEach((d,i)=>{if(open[i])d.open=true;});
}

function renderDashboard(){if(!model)return;const s=model.summary;try{renderHomeAnalytics()}catch(e){console.warn('Home analytics unavailable',e);}try{renderMonthlyTarget()}catch(e){console.warn('Monthly target unavailable',e);}set('kOps',s.caseCount);set('kCustomers',new Set((snapshot.cases||[]).filter(c=>c.workflow_status!=='cancelled').map(c=>F.validPhone(c.client_phone)).filter(Boolean)).size);set('kProviders',model.providers.length);
const identified=new Set(),unidentified=new Set();
for(const c of snapshot.cases||[]){
 if(c.workflow_status==='cancelled')continue;
 const p=F.validPhone(c.client_phone);
 if(p)identified.add(p);else unidentified.add(String(c.id));
}
let customerAudit=el('pawCustomerCountAudit');
if(!customerAudit){customerAudit=document.createElement('div');customerAudit.id='pawCustomerCountAudit';customerAudit.className='hint';customerAudit.style.cssText='margin:8px 0;padding:10px;border:1px solid #dbe2ed;border-radius:12px';const customerCard=el('kCustomers')?.closest('.card');if(customerCard)customerCard.appendChild(customerAudit);}
if(customerAudit){const grid=el('kCustomers')?.closest('.cards');if(grid&&customerAudit.previousElementSibling!==grid)grid.after(customerAudit);customerAudit.textContent=t('عملاء بأرقام صالحة مختلفة: ','Customers with distinct valid phones: ')+identified.size+t(' | عمليات بلا رقم صالح: ',' | Bookings without a valid phone: ')+unidentified.size+t(' (للمراجعة، غير داخلة في عدد العملاء).',' (excluded from the customer count; review required).');}set('kClientPaidTotal',cash(s.paid));set('kClientUnpaidTotal',cash(s.unpaid));set('kOursFromProviders',cash(s.ours));set('kOweProviders',cash(s.theirs));
let settlementsDashboard=el('pawSettlementsDashboard');
if(!settlementsDashboard){settlementsDashboard=document.createElement('section');settlementsDashboard.id='pawSettlementsDashboard';settlementsDashboard.className='card';el('dashboard')?.appendChild(settlementsDashboard);}
const settledTotal=periodSettlements.reduce((a,x)=>a+Number(x.amount||0),0);
if(settlementsDashboard)settlementsDashboard.innerHTML='<h3><!--paw-i18n-->تسويات الشركات — TEST</h3><div class="miniGrid"><div class="mini"><span><!--paw-i18n-->تسويات معتمدة</span><b>'+periodSettlements.length+'</b></div><div class="mini"><span><!--paw-i18n-->إجمالي التحويلات المعتمدة</span><b>'+settledTotal.toFixed(3)+' '+t('د.ك','DK')+'</b></div><div class="mini"><span><!--paw-i18n-->Pending للشركات على PawApp</span><b>'+cash(s.theirs)+'</b></div><div class="mini"><span><!--paw-i18n-->Pending لـ PawApp على الشركات</span><b>'+cash(s.ours)+'</b></div></div><div class="hint"><!--paw-i18n-->الأرصدة الحالية من سجل المالية نفسه؛ التحويلات المعتمدة لا تُضاف مرة ثانية للإيرادات.</div>';
let statsBox=el('pawDashboardStats');
if(!statsBox){statsBox=document.createElement('div');statsBox.id='pawDashboardStats';statsBox.className='card';statsBox.style.margin='10px 0';el('dashboard')?.appendChild(statsBox);}
const uniqueServices=new Set((snapshot.cases||[]).map(c=>String(c.service_name||c.requested_service||'').trim().toLowerCase()).filter(Boolean));
const registeredServices=(snapshot.services||[]).length;
const unknownDates=(snapshot.cases||[]).filter(c=>!c.service_date).length;
const outOfPeriod=(snapshot.cases||[]).filter(c=>c.service_date&&(c.service_date<'2026-07-01'||c.service_date>'2026-09-30')).length;
if(statsBox)statsBox.innerHTML='<b><!--paw-i18n-->إحصائيات جميع العمليات — بدون فلتر تاريخ</b><div class="miniGrid"><div class="mini"><span><!--paw-i18n-->العمليات</span><b>'+s.caseCount+'</b></div><div class="mini"><span><!--paw-i18n-->الشركات / الفريلانسر</span><b>'+model.providers.length+'</b></div><div class="mini"><span><!--paw-i18n-->أنواع الخدمات المنفذة</span><b>'+uniqueServices.size+'</b></div><div class="mini"><span><!--paw-i18n-->الخدمات المسجلة بالكتالوج</span><b>'+registeredServices+'</b></div></div><div class="hint">'+html(t('عملاء معروفون: ','Identified customers: '))+identified.size+html(t(' | حالات بلا هوية: ',' | Unidentified bookings: '))+unidentified.size+html(t(' | عمليات بلا تاريخ خدمة: ',' | Bookings without a service date: '))+unknownDates+html(t(' | عمليات مؤرخة خارج يوليو–سبتمبر 2026: ',' | Bookings dated outside July–September 2026: '))+outOfPeriod+'</div>';
let box=el('financeDashboardCards');if(!box){box=document.createElement('div');box.id='financeDashboardCards';box.className='cards';box.style.cssText='margin-top:10px;grid-template-columns:repeat(2,minmax(0,1fr))';const old=el('kClientPaidTotal')?.closest('.cards');if(old)old.replaceWith(box);else el('dashboard')?.appendChild(box);}box.innerHTML=summaryCards(s,'finDash');
let issueBreakdown=el('pawIssueBreakdown');
if(!issueBreakdown){issueBreakdown=document.createElement('div');issueBreakdown.id='pawIssueBreakdown';issueBreakdown.className='card';issueBreakdown.style.margin='10px 0';el('dashboard')?.appendChild(issueBreakdown);}
const issueNames={provider_missing:'مقدم الخدمة غير محدد',payment_route_missing:'جهة دفع العميل غير محددة',price_split_mismatch:'اختلاف تقسيم السعر',invalid_price:'سعر أو عمولة غير صالح',transport_payment_unknown:'تحصيل النقل غير مؤكد',unpriced_service:'خدمة بدون سعر',commission_overpaid:'عمولة محصلة أكثر من المستحق',client_overpaid:'سداد عميل أكثر من الإجمالي',provider_overpaid:'تحويل لمقدم الخدمة أكبر من حصته',duplicate_commission_route:'عمولة مكررة حسب جهة الدفع',direct_provider_and_payout:'تحويل مزدوج محتمل',paid_flag_mismatch:'اختلاف حالة الدفع',cancelled_case_requires_review:'عملية ملغاة تحتاج مراجعة'};
const issueNamesEn={"provider_missing":"Provider not specified","payment_route_missing":"Customer payment recipient not specified","price_split_mismatch":"Price allocation mismatch","invalid_price":"Invalid price or fee","transport_payment_unknown":"Transport payment unconfirmed","unpriced_service":"Service without a price","commission_overpaid":"Collected fee exceeds amount due","client_overpaid":"Customer payment exceeds total","provider_overpaid":"Provider transfer exceeds share","duplicate_commission_route":"Duplicate commission payment route","direct_provider_and_payout":"Potential duplicate transfer","paid_flag_mismatch":"Payment status mismatch","cancelled_case_requires_review":"Cancelled booking requires review"};
const issueCounts=new Map();
for(const line of model.lines||[])for(const issue of line.issues||[])issueCounts.set(issue,(issueCounts.get(issue)||0)+1);
if(issueBreakdown)issueBreakdown.innerHTML='<b><!--paw-i18n-->تفاصيل البنود المالية التي تحتاج مراجعة</b>'+(issueCounts.size?'<div class="hint">'+[...issueCounts].sort((a,b)=>b[1]-a[1]).map(([key,n])=>html(t(issueNames[key]||key,issueNamesEn[key]||key))+': '+n).join(' | ')+'</div>':'<div class="hint"><!--paw-i18n-->لا توجد تنبيهات مالية.</div>')+'<div class="hint"><!--paw-i18n-->هذه تنبيهات تدقيق، وليست متابعات موظفين. لا تُغلق تلقائياً دون تصحيح البيانات المصدرية.</div>';
let status=el('financeStatus');if(!status){status=document.createElement('div');status.id='financeStatus';status.className='card';status.style.marginTop='10px';box.after(status);}status.innerHTML='<b><!--paw-i18n-->حسابات TEST — شامل الخدمة والنقل</b><div class="hint">'+(s.issueCount?html(s.issueCount+t(' بند يحتاج تأكيدًا أو مراجعة قبل إصدار التقرير. الأرقام لا تفترض أن النقل مدفوع.',' item(s) require confirmation or review before reporting. Figures do not assume transport has been paid.')):html(t('تمت مطابقة إجمالي الأسعار مع مجموع حصة PawApp وحصص الشركات.','Total prices match the combined PawApp and provider shares.')))+'</div>';
const recent=el('dashboardRecentCards');if(recent)recent.innerHTML=snapshot.cases.slice().reverse().slice(0,3).map(c=>{const lines=linesFor(c.id),sum=F.summarize(lines),pending=lines.some(actionable);return '<div class="card provider"><h3>'+html(c.client_name)+'</h3><p>'+caseCode(c.id)+'</p><div class="hint">'+html(c.service_name||c.requested_service||'')+'</div><div class="miniGrid"><div class="mini"><span><!--paw-i18n-->الإجمالي شامل النقل</span><b>'+cash(sum.total)+'</b></div><div class="mini"><span><!--paw-i18n-->حصة PawApp</span><b>'+cash(sum.paw)+'</b></div></div><div class="hint">'+(pending?lines.filter(actionable).map(l=>html((l.component==='transport'?'النقل: ':'الخدمة: ')+detail(l))).join('<br>'):'لا يوجد إجراء مالي متبقٍ')+'</div><div class="actions"><button class="btn soft" onclick="openCaseDetails(\''+c.id+'\')"><!--paw-i18n-->فتح العملية</button></div></div>';}).join('');
try{renderHomeEmployeeOverview();}catch(e){console.warn('Home employee overview unavailable',e);}orderHomeSections();
}

let homeStaffMonth='';
function renderHomeEmployeeOverview(){
 const host=el('dashboard');let panel=el('pawHomeEmployees');
 if(!host||!epAdmin()||!snapshot||!model){panel?.remove();return;}
 if(!panel){panel=document.createElement('section');panel.id='pawHomeEmployees';panel.className='card';panel.style.cssText='margin:16px 0;min-width:0;padding:clamp(12px,2vw,24px)';host.appendChild(panel);}
 const today=localDate(),current=today.slice(0,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(homeStaffMonth)||homeStaffMonth>current)homeStaffMonth=current;
 const month=homeStaffMonth,end=srEnd(month),to=end<today?end:today,stats=epMetrics(snapshot,model,month+'-01',to,today);
 const groups=stats.groups.filter(g=>g.id!=='unassigned'||g.total||g.followPending||g.followDone);
 const kpi=(a,b,x,bg)=>'<div style="padding:12px;border-radius:12px;background:'+bg+';min-width:0"><small class="hint">'+html(t(a,b))+'</small><b style="display:block;margin-top:5px;font-size:clamp(16px,2vw,23px);overflow-wrap:anywhere">'+html(x)+'</b></div>';
 const rows=groups.map(g=>{const goal=epTargetRows?.get(g.id+'|'+month),pct=goal>0n?epGoalStats(g.fee,goal).percent:null;
 const cell=(a,b,x)=>'<div><small class="hint">'+html(t(a,b))+'</small><b style="display:block;margin-top:4px">'+html(x)+'</b></div>';
 return '<div class="phe-row"><div><b>'+html(g.name||t('غير معيّن','Unassigned'))+'</b><div class="hint">'+html(t('مكتملة','Completed'))+': '+g.completed+' / '+g.total+'</div></div>'+cell('حصة PawApp','PawApp share',cash(g.fee))+cell('الهدف الشهري','Monthly target',goal>0n?cash(goal):'—')+'<div><small class="hint">'+html(t('تحقيق الهدف','Target achievement'))+' · '+(pct===null?'—':pct.toFixed(1)+'%')+'</small><div style="height:8px;border-radius:8px;background:#e5edf5;margin-top:5px;overflow:hidden"><div style="height:100%;background:#16834f;width:'+(pct===null?0:Math.max(0,Math.min(100,pct)))+'%"></div></div></div>'+cell('متابعات متأخرة','Overdue follow-ups',g.followOverdue)+'</div>';}).join('');
 panel.innerHTML='<style>#pawHomeEmployees .phe-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}#pawHomeEmployees .phe-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;align-items:center;border:1px solid #e3e9f0;border-radius:12px;padding:12px;margin-top:8px}#pawHomeEmployees .phe-row>*{min-width:0;overflow-wrap:anywhere}@media(max-width:700px){#pawHomeEmployees .phe-grid,#pawHomeEmployees .phe-row{grid-template-columns:repeat(2,minmax(0,1fr))}#pawHomeEmployees .phe-row>div:first-child{grid-column:1/-1}}</style><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><h2 style="margin:0;font-size:20px">'+html(t('تحليل أداء الموظفات','Employee performance analytics'))+'</h2><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="hint">'+html(t('الشهر','Month'))+' <input id="pheMonth" type="month" min="2000-01" max="'+current+'" value="'+month+'" style="max-width:155px"></label><button id="pheOpen" type="button" class="btn soft">'+html(t('عرض التفاصيل','View details'))+'</button></div></div><p class="hint">'+html(t('حسب تاريخ الخدمة · الأهداف الشهرية الفردية · للإدارة فقط','By service date · Individual monthly targets · Admin only'))+'</p><div class="phe-grid">'+kpi('إجمالي العمليات','Total cases',stats.team.total,'#edf2ff')+kpi('المكتملة','Completed',stats.team.completed,'#e8f6ed')+kpi('حصة PawApp المكتسبة','Earned PawApp share',cash(stats.team.fee),'#f0eafa')+kpi('متابعات متأخرة','Overdue follow-ups',stats.team.followOverdue,'#fff5dc')+'</div>'+(!epTargetRows?'<p class="hint">'+html(t('الأهداف الفردية غير متاحة حالياً.','Individual targets currently unavailable.'))+'</p>':'')+(rows||'<p class="hint">'+html(t('لا توجد بيانات للفترة.','No data for this period.'))+'</p>');
 el('pheMonth').onchange=e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)&&e.target.value>='2000-01'&&e.target.value<=current){homeStaffMonth=e.target.value;renderHomeEmployeeOverview();}else e.target.value=month;};
 el('pheOpen').onclick=()=>{epTab='performance';window.showPage('admin');};
}
function orderHomeSections(){
 const host=el('dashboard');if(!host)return;
 for(const id of ['pawHomeSources','pawMarketingShortcut','pawHomeEmployees']){const node=el(id);if(node?.parentElement===host)host.appendChild(node);}
}

function renderProviders(){if(!model)return;const q=v('providerSearch').toLowerCase();el('providerList').innerHTML=model.providers.filter(p=>p.name.toLowerCase().includes(q)).map(p=>{const s=p.summary;return '<div class="card provider"><h3>'+html(p.name)+pawClinicTag(p.id)+'</h3><div class="miniGrid"><div class="mini"><span><!--paw-i18n-->العمليات</span><b>'+s.caseCount+'</b></div><div class="mini"><span><!--paw-i18n-->العملاء</span><b>'+s.customerCount+'</b></div><div class="mini"><span><!--paw-i18n-->الخدمات مع النقل</span><b>'+s.lineCount+'</b></div></div><div class="miniGrid"><div class="mini"><span><!--paw-i18n-->لنا عندهم</span><b>'+cash(s.ours)+'</b></div><div class="mini"><span><!--paw-i18n-->لهم عندنا</span><b>'+cash(s.theirs)+'</b></div><div class="mini"><span><!--paw-i18n-->حصة الشركة</span><b>'+cash(s.provider)+'</b></div></div>'+(p.lines.some(l=>l.issues.length&&!(l.date>='2026-07-01'&&l.date<'2026-10-01'))?'<div class="hint">'+p.lines.filter(l=>l.issues.length&&!(l.date>='2026-07-01'&&l.date<'2026-10-01')).length+' بند يحتاج مراجعة أو تأكيد.</div>':'')+'<div class="actions"><button class="btn primary" onclick="openProviderCRM(\''+p.id+'\')"><!--paw-i18n-->التفاصيل والتقرير</button>'+(mayWrite()?'<button class="btn soft" onclick="openServiceManager(\''+p.id+'\')"><!--paw-i18n-->الخدمات</button>':'')+'</div></div>';}).join('')||'<div class="card"><!--paw-i18n-->لا توجد شركات</div>';}
function pawSettlementSource(){return v('pawProviderSettlementSource')||'all'}
function pawSourceMatchesLine(l){
 const source=(snapshot?.cases||[]).find(c=>String(c.id)===String(l.caseId))?.source;
 const filter=pawSettlementSource();
 return filter==='all'||(filter==='pet_information_form'?source==='pet_information_form':source!=='pet_information_form');
}
function renderProviderSettlementPeriod(){
 const host=el('pawProviderSettlementPeriod');if(!host||!model||!selectedProvider)return;
 const p=model.providers.find(x=>String(x.id)===String(selectedProvider));if(!p)return;
 const from=v('pawSettlementFrom'),to=v('pawSettlementTo');
 if(!from||!to){host.innerHTML='<p class="hint"><!--paw-i18n-->اختاري تاريخ البداية والنهاية لعرض تسويات هذه الشركة. ما تم اختيار أي شهر تلقائياً.</p>';return;}
 if(from>to){host.innerHTML='<p class="hint"><!--paw-i18n-->تاريخ البداية لازم يكون قبل تاريخ النهاية.</p>';return;}
 const lines=p.lines.filter(l=>(!from||l.date>=from)&&(!to||l.date<=to)&&pawSourceMatchesLine(l));
 const sum=F.summarize(lines);
 const cases=(snapshot?.cases||[]).filter(c=>lines.some(l=>l.caseId===String(c.id)));
 const historical=from>='2026-07-01'&&to<'2026-10-01';
 const pending=historical?[]:lines.filter(l=>l.ours>0n||l.theirs>0n);
 const unresolved=historical?[]:lines.filter(l=>l.issues.length);
 const unlinkedServices=historical?[]:lines.filter(l=>{
    if(!l.isPaid||l.component!=='main')return false;
    const c=(snapshot?.cases||[]).find(c=>String(c.id)===l.caseId);
    return !c?.service_id||!(snapshot?.services||[]).some(s=>String(s.id)===String(c.service_id)&&String(s.provider_id)===l.providerId);
 });
 const settled=historical?lines:lines.filter(l=>l.isPaid&&l.ours===0n&&l.theirs===0n&&!l.issues.length);
 const approved=pawSettlementSource()==='all'?periodSettlements.filter(x=>String(x.provider_id)===String(selectedProvider)&&(!from||x.period_to>=from)&&(!to||x.period_from<=to)):[];
 const settlementCards=['pawapp_to_provider','provider_to_pawapp'].map(dir=>{
   const title=dir==='pawapp_to_provider'?'مستحق للشركة على PawApp':'مستحق لـ PawApp على الشركة';
   const rows=approved.filter(x=>x.direction===dir);
   const amount=rows.reduce((a,x)=>a+Number(x.amount||0),0);
   const due=historical?0n:dir==='pawapp_to_provider'?sum.theirs:sum.ours;
   const relevant=lines.filter(l=>l.isPaid&&l.route===(dir==='pawapp_to_provider'?'pawapp':'provider'));
   const unknown=relevant.some(l=>l.issues.length)||unlinkedServices.some(l=>relevant.includes(l));
   const label=historical?'إقفال تاريخي — ليس اعتماد تحويل':rows.length&&due===0n?'تسوية معتمدة وموثقة':due>0n?'مستحقات مفتوحة — لم تتم التسوية':relevant.length?'مقفلة مالياً — تم تسجيل سداد الحصص بالكامل':lines.length&&unresolved.length?'تحتاج مراجعة البيانات':'لا يوجد مبلغ مستحق بهذا الاتجاه';
   const canApprove=['admin','operations','accountant'].includes(window.PAWAPP_AUTH?.access?.role)&&from&&to&&from<=to&&due>0n&&!unknown&&!rows.length&&!historical&&pawSettlementSource()==='all';
   const canReconcile=pawSettlementSource()==='all'&&!historical&&['admin','operations','accountant'].includes(window.PAWAPP_AUTH?.access?.role)&&due===0n&&rows.length===0&&relevant.length>0&&unresolved.length===0&&relevant.every(l=>l.isPaid&&l.component==='main'&&l.total>0n);
   return '<div class="mini"><span>'+title+'</span><b>'+label+'</b><div class="hint">المعتمد: '+amount.toFixed(3)+' '+t('د.ك','DK')+t(' • المتبقي: ',' • Outstanding: ')+cash(due)+'</div>'+
     (canApprove?'<button class="btn primary" onclick="pawConfirmPeriodSettlement(\''+dir+'\')"><!--paw-i18n-->تمت التسوية — تأكيد الدفع/التحصيل</button>':'')+
     (canReconcile?'<button class="btn" onclick="pawConfirmZeroSettlement(\''+dir+'\')"><!--paw-i18n-->اعتماد تسوية سابقة موثقة</button>':'')+
     (unknown?'<div class="hint"><!--paw-i18n-->يلزم مراجعة البنود قبل الاعتماد</div>':'')+'</div>';
 }).join('');
 const status=historical?'إقفال تاريخي — لا يثبت اعتماد تحويل':pending.length?'مستحقات مفتوحة — بانتظار التسوية':approved.length?'توجد تسوية معتمدة ولا مستحقات معلقة':lines.some(l=>l.isPaid)?'مقفلة مالياً — جميع حصص مقدمي الخدمة مسددة بالسجل':unresolved.length?'تحتاج مراجعة البيانات':'لا توجد مستحقات معلقة';
 host.innerHTML='<div class="hint">'+(pawSettlementSource()==='all'?'كل مصادر الشركة':'المصدر المختار فقط؛ لتسوية كل عملية استخدمي زر المستحق في تفاصيلها، واعتماد الفترة الشامل معطّل حتى لا تختلط المصادر')+'</div><div class="hint">إجمالي الفترة وحصص الطرفين تظهر دائماً، حتى لو المتبقي صفر. حالة الإقفال لا تثبت التحويل وحدها.</div>'+
 '<div class="miniGrid"><div class="mini"><span>عمليات الفترة</span><b>'+sum.caseCount+'</b></div>'+
 '<div class="mini"><span>إجمالي العمليات</span><b>'+cash(sum.total)+'</b></div>'+
 '<div class="mini"><span><!--paw-i18n-->حصة PawApp</span><b>'+cash(sum.paw)+'</b></div>'+
 '<div class="mini"><span><!--paw-i18n-->حصة الشركة</span><b>'+cash(sum.provider)+'</b></div>'+
 '<div class="mini"><span>المحصّل من العمولة</span><b>'+cash(sum.pawCollected)+'</b></div>'+
 '<div class="mini"><span><!--paw-i18n-->المحوّل للشركة</span><b>'+cash(sum.providerPaid)+'</b></div>'+
 '<div class="mini"><span>المتبقي على الشركة</span><b>'+cash(historical?0n:sum.ours)+'</b></div>'+
 '<div class="mini"><span>المتبقي على PawApp</span><b>'+cash(historical?0n:sum.theirs)+'</b></div></div>'+
 '<div class="miniGrid">'+settlementCards+'</div>'+
 (unlinkedServices.length?'<p class="hint" style="font-weight:700;color:#9e5220">يوجد '+unlinkedServices.length+' دفعة مؤكدة لكن الخدمة الفعلية ناقصة. المبلغ يبقى ظاهرًا كمستحق، ولا تُعتمد تسوية مجمعة قبل استكمال الخدمة.</p>':'')+
 '<div style="overflow-x:auto;margin:12px 0"><b>تفاصيل العمليات لهذا المصدر والفترة</b><table style="min-width:620px;width:100%"><thead><tr><th>رقم الحالة</th><th><!--paw-i18n-->العميل</th><th>الخدمة المطلوبة / الفعلية</th><th>إجمالي د.ك</th><th><!--paw-i18n-->حصة PawApp</th><th><!--paw-i18n-->حصة الشركة</th><th>المتبقي للشركة</th><th><!--paw-i18n-->الحالة</th></tr></thead><tbody>'+lines.map(l=>{
   const c=(snapshot?.cases||[]).find(c=>String(c.id)===l.caseId);
   const noService=l.component==='main'&&(!c?.service_id||!(snapshot?.services||[]).some(s=>String(s.id)===String(c.service_id)&&String(s.provider_id)===l.providerId));
   const requested=Array.isArray(c?.intake_details?.requested_services)?c.intake_details.requested_services.join('، '):'';
   const serviceText=(c?.service_name||'الخدمة الفعلية غير مربوطة')+(requested?' | الطلب: '+requested:'');
   return '<tr><td><button class="btn soft" type="button" onclick="openCaseDetails(\''+l.caseId+'\')">'+caseCode(l.caseId)+'</button></td><td>'+html(l.client)+'</td><td>'+html(serviceText)+(noService&&c?.source==='pet_information_form'&&mayWrite()?'<div><button class="btn soft" type="button" onclick="pawBookingReview(\''+l.caseId+'\')">ربط الخدمة</button></div>':'')+'</td><td>'+cash(l.total)+'</td><td>'+cash(l.paw)+'</td><td>'+cash(l.provider)+'</td><td>'+cash(l.theirs)+'</td><td>'+html(!l.isPaid?'بانتظار دفع العميل':noService?'مدفوع — الخدمة تحتاج ربط':l.theirs>0n?'مدفوع — تسوية مفتوحة':'لا يوجد متبقٍ')+'</td></tr>';
 }).join('')+'</tbody></table></div>'+
 '<button class="btn" onclick="pawPrintProviderReport()">طباعة تقرير رسمي بالشعار / حفظ PDF</button><p><b>التسوية: '+html(status)+'</b> • عمليات مستوفية: '+(historical?lines.length:settled.length)+' • بنود تحتاج مراجعة: '+(historical?0:unresolved.length)+'</p>'+
 '<div class="hint">'+(historical?'الفترة مقفلة خارج النظام؛ بيانات التحويلات الفعلية تظهر أعلاه كما هي ويمكن توثيقها بشكل مستقل.':'البنود الناقصة تحتاج مراجعة قبل اعتماد تسوية جديدة.')+'</div>';
}
window.pawProviderSettlementPeriodChanged=renderProviderSettlementPeriod;
let periodSettlementBusy=false;
window.pawConfirmPeriodSettlement=async function(direction){
 if(pawSettlementSource()!=='all')return alert('التسوية المجمعة لا تفصل المصادر؛ اعتمدي تسوية كل عملية من تفاصيلها حتى لا تختلط طلبات Pet Information بباقي أكتوبر.');
 if(periodSettlementBusy)return;
 if(!['admin','operations','accountant'].includes(window.PAWAPP_AUTH?.access?.role))return alert('صلاحية الإدارة أو العمليات أو المحاسبة فقط');
 if(!['pawapp_to_provider','provider_to_pawapp'].includes(direction))return alert('اتجاه التسوية غير صحيح');
 const from=v('pawSettlementFrom'),to=v('pawSettlementTo'),provider=selectedProvider;
 if(!provider||!from||!to||from>to)return alert('حددي تاريخ البداية والنهاية');
 if(from<'2026-10-01')return alert('يوليو وأغسطس وسبتمبر مقفلة؛ تسجيل التسويات الجديدة يبدأ من أكتوبر.');
 periodSettlementBusy=true;
 try{
  // Always fetch fresh server data before displaying a payable amount.
  await refresh();
  const p=model?.providers.find(x=>String(x.id)===String(provider));
  if(!p)throw Error('الشركة غير موجودة');
  const rows=p.lines.filter(l=>l.date>=from&&l.date<=to);
  const relevant=rows.filter(l=>l.isPaid&&l.route===(direction==='pawapp_to_provider'?'pawapp':'provider'));
  const missingService=relevant.some(l=>l.component==='main'&&!(snapshot?.services||[]).some(s=>String(s.provider_id)===l.providerId&&String(s.id)===String(l.raw.service_id||'')));
  if(missingService)return alert('توجد دفعة مؤكدة تحتاج ربط الخدمة الفعلية قبل اعتماد التسوية. افتحي تفاصيل الحالة.');
  const due=direction==='pawapp_to_provider'?F.summarize(rows).theirs:F.summarize(rows).ours;
  if(due<=0n)return alert('هذه التسوية مسجلة أو لا توجد مستحقات مفتوحة. لن يتم تسجيل دفع مكرر.');
  if(relevant.some(l=>l.issues.length))return alert('توجد بيانات مالية تحتاج مراجعة قبل التسوية.');
  const existing=periodSettlements.some(x=>String(x.provider_id)===String(provider)&&x.direction===direction&&x.period_from<=to&&x.period_to>=from);
  if(existing)return alert('توجد تسوية معتمدة متداخلة مع هذه الفترة. راجعيها قبل أي اعتماد إضافي.');
  // No settlement may be approved based on customer payment alone.
  const methodInput=prompt('طريقة التحويل الفعلي (مثلاً تحويل بنكي أو KNET):','');
  if(methodInput===null)return;
  const method=methodInput.trim();
  if(!method)return alert('طريقة التحويل الفعلي مطلوبة لاعتماد التسوية.');
  const referenceInput=prompt('رقم إيصال أو مرجع التحويل (اختياري، اتركيه فارغاً إذا ما عندج رقم):','');
  if(referenceInput===null)return;
  const reference=referenceInput.trim()||NO_EXTERNAL_REFERENCE;
  const dateInput=prompt('تاريخ التحويل الفعلي YYYY-MM-DD:','');
  if(dateInput===null)return;
  const paidAt=dateInput.trim();
  const parsed=new Date(paidAt+'T00:00:00');
  const validDate=/^\d{4}-\d{2}-\d{2}$/.test(paidAt) && !Number.isNaN(parsed.getTime())
    && [parsed.getFullYear(),String(parsed.getMonth()+1).padStart(2,'0'),String(parsed.getDate()).padStart(2,'0')].join('-')===paidAt;
  if(!validDate)return alert('تاريخ التحويل غير صحيح. اكتبيه بصيغة YYYY-MM-DD.');
  if(paidAt>localDate())return alert('لا يمكن اعتماد تحويل بتاريخ مستقبلي.');
  if(!confirm('هل تؤكدين أن التسوية تمت فعلياً بقيمة '+cash(due)+'؟\nالطريقة: '+method+'\nالتوثيق: '+reference+'\nالتاريخ: '+paidAt+'\nبدون مرجع خارجي سيظهر تأكيد داخلي باسم مستخدم النظام.'))return;
  const result=await window.PAWAPP_AUTH.client.rpc('test_confirm_provider_period_settlement',{
    p_provider:provider,p_from:from,p_to:to,p_direction:direction,
    p_method:method,p_reference:reference,p_paid_at:paidAt,p_expected:Number(F.format(due))
  });
  if(result.error)throw result.error;
  await refresh();
  if(el('pawSettlementFrom'))el('pawSettlementFrom').value=from;
  if(el('pawSettlementTo'))el('pawSettlementTo').value=to;
  renderProviderSettlementPeriod();
  toast('تم اعتماد التسوية وتحديث الحسابات');
 }catch(e){alert('تعذر اعتماد التسوية: '+e.message)}
 finally{periodSettlementBusy=false;}
};

window.pawConfirmZeroSettlement=async function(direction){
 if(pawSettlementSource()!=='all')return alert('اعتماد إقفال الفترة عام وليس حسب المصدر. استخدمي مراجعة كل عملية أولاً.');
 if(!['admin','operations','accountant'].includes(window.PAWAPP_AUTH?.access?.role))return alert('للإدارة والعمليات والمحاسبة فقط');
 const from=v('pawSettlementFrom'),to=v('pawSettlementTo');
 if(!from||!to||from>to)return alert('اختاري الفترة');
 const ref=prompt('مرجع التسوية السابقة (اختياري؛ يمكن تركه فارغاً):','');
 if(ref===null)return;
 const date=prompt('تاريخ التسوية الفعلي YYYY-MM-DD:','');
 if(!date||!/^\\d{4}-\\d{2}-\\d{2}$/.test(date))return alert('تاريخ غير صحيح');
 if(!confirm('هل راجعتي إثبات الدفع الفعلي؟ سيُعتمد الإقفال برصيد صفر بدون تسجيل تحويل جديد.'))return;
 try{
 const q=await window.PAWAPP_AUTH.client.rpc('test_confirm_zero_balance_period',{p_provider:selectedProvider,p_from:from,p_to:to,p_direction:direction,p_reference:ref.trim()||NO_EXTERNAL_REFERENCE,p_paid_at:date});
 if(q.error)throw q.error;
 await refresh();el('pawSettlementFrom').value=from;el('pawSettlementTo').value=to;renderProviderSettlementPeriod();
 toast('تم اعتماد التسوية السابقة دون احتساب مبلغ جديد');
 }catch(e){alert('لم تُعتمد التسوية: '+e.message);}
};
function renderProvider(){if(!selectedProvider||!model)return;
const savedFrom=v('pawSettlementFrom'),savedTo=v('pawSettlementTo'),savedSource=v('pawProviderSettlementSource')||'all';const p=model.providers.find(x=>String(x.id)===String(selectedProvider));if(!p)return;const s=p.summary;set('providerDetailName',p.name+(pawClinicOf(p.id)?' — '+pawClinicOf(p.id):''));set('providerDetailType','الخدمة الأساسية والنقل — كل مبلغ محسوب مرة واحدة');set('pdClients',s.customerCount);set('pdOps',s.caseCount);const pendingCases=new Set(p.lines.filter(actionable).map(l=>l.caseId));set('pdPending',pendingCases.size);set('pdComplete',s.caseCount-pendingCases.size);set('pdSales',cash(s.total));set('pdPaw',cash(s.paw));set('pdOurs',cash(s.ours));set('pdTheirs',cash(s.theirs));
let extra=el('financeProviderCards');if(!extra){extra=document.createElement('div');extra.id='financeProviderCards';extra.className='cards';extra.style.cssText='grid-template-columns:repeat(2,minmax(0,1fr));margin-top:10px';el('pdSales').closest('.cards').after(extra);}extra.innerHTML=metric('حصة الشركة','finProviderShare',cash(s.provider))+metric('حُوّل للشركة','finProviderPaid',cash(s.providerPaid))+metric('المحصّل من العمولة','finProviderCollected',cash(s.pawCollected))+metric('بنود تحتاج مراجعة','finProviderIssues',p.lines.filter(l=>l.issues.length&&!(l.date>='2026-07-01'&&l.date<'2026-10-01')).length);
let period=el('pawProviderSettlementSection');
if(!period){period=document.createElement('section');period.id='pawProviderSettlementSection';period.className='card';period.style.margin='12px 0';el('pdServices').before(period);}
period.innerHTML='<h3>تسويات الشركة حسب الفترة — TEST</h3><div class="field" style="margin:10px 0"><label><!--paw-i18n-->المصدر</label><select id="pawProviderSettlementSource" onchange="renderProviderSettlementPeriod();renderProviderSourceCases()"><option value="all">جميع عمليات الشركة</option><option value="pet_information_form"><!--paw-i18n-->Pet Information فقط</option><option value="other">باقي عمليات الكونسيرج فقط</option></select></div><div class="grid2"><div class="field"><label>من تاريخ</label><input id="pawSettlementFrom" type="date" onchange="pawProviderSettlementPeriodChanged()"></div><div class="field"><label>إلى تاريخ</label><input id="pawSettlementTo" type="date" onchange="pawProviderSettlementPeriodChanged()"></div></div><div id="pawProviderSettlementPeriod"></div>';
if(savedFrom)el('pawSettlementFrom').value=savedFrom;if(savedTo)el('pawSettlementTo').value=savedTo;if(el('pawProviderSettlementSource'))el('pawProviderSettlementSource').value=savedSource;
renderProviderSettlementPeriod();
const counts=new Map();p.lines.forEach(l=>counts.set(l.service,(counts.get(l.service)||0)+1));el('pdServices').innerHTML=[...counts].map(([name,n])=>'<div class="kpi-line"><span>'+html(name)+'</span><b>'+n+'</b></div>').join('');
el('pdClientList').innerHTML=p.lines.filter(pawSourceMatchesLine).map(l=>'<div class="card provider"><h3>'+html(l.client)+'</h3><div class="hint">'+caseCode(l.caseId)+' • '+html(t(l.service))+'</div><div class="miniGrid"><div class="mini"><span>السعر</span><b>'+cash(l.total)+'</b></div><div class="mini"><span>PawApp</span><b>'+cash(l.paw)+'</b></div><div class="mini"><span><!--paw-i18n-->الشركة</span><b>'+cash(l.provider)+'</b></div></div><p>'+html(detail(l))+'</p><div class="actions">'+(actionable(l)?actionButton(l):'')+'<button class="btn soft" onclick="openCaseDetails(\''+l.caseId+'\')"><!--paw-i18n-->العملية</button></div></div>').join('')||'<div class="card"><!--paw-i18n-->لا توجد عمليات</div>';el('pdExportBtn').onclick=()=>window.exportProviderFullReport(p.id);
}
window.renderProviderSourceCases=function(){if(selectedProvider)renderProvider()};
// Secondary intake archive: derived from the TEST finance snapshot, NOT the
// employee follow-up/debt queue. A form remains discoverable until its core
// client, pet, provider, service, and pricing fields are actually complete.
let formArchiveRows=[];
function incompleteFormIssues(c){
 const issues=[];
 if(!['booking_form','booking_form_test','pet_information_form'].includes(c.source)
    ||String(c.workflow_status||'').toLowerCase()==='cancelled')return issues;
 const name=String(c.client_name||'').trim();
 const phone=String(c.client_phone||'').replace(/[^0-9]/g,'');
 if(!name||/^(unknown|غير معروف|بدون اسم|n[/]a|null)$/i.test(name))issues.push('اسم العميل');
 if(phone.length<8)issues.push('رقم الهاتف');
 if(!String(c.pet_type||'').trim())issues.push('نوع الحيوان');
 if(!c.provider_id)issues.push('العيادة / الطبيب');
 const serviceLinked=!!c.service_id&&(snapshot?.services||[]).some(x=>
   String(x.id)===String(c.service_id)&&String(x.provider_id)===String(c.provider_id));
 if(!serviceLinked)issues.push('الخدمة الفعلية');
 if(!(Number(c.total_amount||0)>0))issues.push('السعر والعمولة');
 return issues;
}
function renderIncompleteFormArchiveList(){
 const host=el('followupIntakeList');
 if(!host)return;
 const term=String(el('followupIntakeSearch')?.value||'').trim().toLocaleLowerCase();
 const digits=term.replace(/[^0-9]/g,'');
 const matching=formArchiveRows.filter(({c})=>{
   if(!term)return true;
   const words=[
     c.client_name,c.client_phone,c.pet_name,c.pet_type,c.requested_service,c.service_name,
     c.intake_details?.staff_listed_name,c.intake_details?.staff_listed_phone,
     'PAW-'+String(c.id).padStart(4,'0'),String(c.id)
   ].filter(Boolean).join(' ').toLocaleLowerCase();
   return words.includes(term)||(digits.length>=4&&String(c.client_phone||'').replace(/[^0-9]/g,'').includes(digits));
 });
 const found=el('followupIntakeFound');
 if(found)found.textContent='المعروض: '+matching.length+' من '+formArchiveRows.length+' طلب';
 host.innerHTML=matching.length?matching.map(({c,issues})=>{
   const id=Number(c.id);
   const request=String(c.requested_service||c.service_name||'الخدمة المطلوبة غير محددة');
   const isPaid=c.client_paid===true;
   const status=isPaid?'العميل مسدّد — استكمال بيانات فقط':'نموذج يحتاج استكمال';
   return '<div class="card provider" style="min-width:0">'+
     '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap">'+
       '<h3 style="margin:0">'+html(c.client_name||'عميل بدون اسم')+'</h3>'+
       '<span class="status partial">'+status+'</span></div>'+
     '<div class="hint">'+caseCode(c.id)+' • '+html(c.client_phone||'بدون رقم')+
       ' • '+html(c.source==='pet_information_form'?'Pet Information':'Concierge Booking')+'</div>'+
     '<div class="hint" style="margin-top:6px">'+html(request)+'</div>'+
     '<div class="hint" style="margin-top:6px"><b>الناقص:</b> '+html(issues.join('، '))+'</div>'+
     '<div class="actions" style="flex-wrap:wrap">'+
       '<button type="button" class="btn primary" onclick="pawOpenArchivedForm('+id+')">استكمال بيانات العميل</button>'+
       '<button type="button" class="btn soft" onclick="openCaseDetails('+id+')">عرض العملية</button>'+
     '</div></div>';
 }).join(''):'<div class="card"><div class="hint">'+(formArchiveRows.length?'ما في عميل مطابق للبحث.':'لا توجد نماذج ناقصة حالياً.')+'</div></div>';
}
window.pawSearchIncompleteFormArchive=renderIncompleteFormArchiveList;
window.pawOpenIncompleteForms=function(){
 const section=el('followupIntakeDetails');
 if(!section)return;
 section.open=true;
 renderIncompleteFormArchiveList();
 section.scrollIntoView({behavior:'smooth',block:'start'});
};
window.pawOpenArchivedForm=function(id){
 const record=formArchiveRows.find(r=>String(r.c.id)===String(id));
 if(!record)return alert('الحالة لم تعد ضمن قائمة الاستكمال. حدّثي الصفحة.');
 if(typeof window.pawBookingReview==='function')window.pawBookingReview(id);
 else window.openCaseDetails(id);
};
function renderIncompleteFormArchive(){
 formArchiveRows=(snapshot?.cases||[]).map(c=>({c,issues:incompleteFormIssues(c)}))
   .filter(x=>x.issues.length>0)
   .sort((a,b)=>Number(b.c.id)-Number(a.c.id));
 set('fuIntake',formArchiveRows.length);
 set('fuIntakeSummary',formArchiveRows.length);
 renderIncompleteFormArchiveList();
}

function paymentReminder(l,today=localDate()){
 if(l.cancelled||l.component!=='main'||l.isPaid||!(l.unpaid>0n)||!l.raw?.client_due_date)return null;
 const date=String(l.raw.client_due_date).slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 return {date,state:date<today?'overdue':date===today?'today':'upcoming'};
}
function paymentReminderText(l){
 const r=paymentReminder(l);if(!r)return '';
 const label=r.state==='overdue'?t('دفعة متأخرة','Overdue payment'):r.state==='today'?t('دفعة مستحقة اليوم','Payment due today'):t('دفعة قادمة','Upcoming payment');
 return '<div style="margin-top:8px"><span class="status '+(r.state==='upcoming'?'partial':'unpaid')+'">'+html(label)+'</span> <b>'+html(r.date)+'</b><div class="hint">'+html(t('المتبقي: ','Outstanding: '))+cash(l.unpaid)+'</div></div>';
}
function renderFollowups(){
 if(!model)return;
 // The legacy intake renderer owns the collapsed bottom section. Do not inject
 // booking intake cards before the urgent financial queue.
 const staleIntake=el('pawBookingIntakeReview');
 if(staleIntake)staleIntake.remove();
 const pendingBookings=(snapshot?.cases||[]).filter(c=>
   ['booking_form_test','booking_form','pet_information_form'].includes(c.source)
   &&c.workflow_status!=='closed'&&c.workflow_status!=='cancelled'
   &&intakeMissing(c).length>0);
 // Price/receipt exists: treat missing service/provider data as an important
 // operational correction. Unpriced form submissions belong ONLY in the
 // collapsed, bottom "طلبات النماذج" section.
 const importantBookings=pendingBookings.filter(c=>
   Number(c.total_amount||0)>0 || c.client_paid===true);
 if(legacyFollowups)legacyFollowups();
 renderIncompleteFormArchive();
 renderSeptemberReviews();

 const financialReviewIssues=new Set([
   'payment_route_missing','direct_provider_and_payout','duplicate_commission_route',
   'client_overpaid','provider_overpaid','commission_overpaid','paid_flag_mismatch',
   'price_split_mismatch','invalid_price','unpriced_service','transport_payment_unknown'
 ]);
 const lines=model.lines.filter(l=>
   !pendingBookings.some(c=>String(c.id)===l.caseId)
   &&actionable(l)&&!(l.date>='2026-07-01'&&l.date<'2026-10-01')
   &&(l.action==='client_paid'||(l.date>='2026-10-01'
     &&l.issues.some(issue=>financialReviewIssues.has(issue))))
 );
 const criticalCards=importantBookings.map(c=>{
   const missing=intakeMissing(c);
   return '<div class="card provider" style="border:1px solid #e8b960">'+
     '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">'+
       '<h3 style="margin:0">'+html(c.client_name||'عميل')+'</h3>'+
       '<span class="status unpaid">بيانات مالية تحتاج تصحيح</span></div>'+
     '<div class="hint">'+caseCode(c.id)+' • '+html(c.client_phone||'')+
       ' • '+html(c.requested_service||c.service_name||'الخدمة غير محددة')+'</div>'+
     '<div class="hint">السعر المسجل: '+cash(Number(c.total_amount||0))+
       ' • المطلوب: '+html(missing.join('، '))+'</div>'+
     '<div class="actions"><button class="btn primary" type="button" onclick="pawBookingReview('+Number(c.id)+')">استكمال بيانات العملية</button></div></div>';
 }).join('');
 const orderedLines=lines.slice().sort((a,b)=>{const rank=l=>({overdue:0,today:1,upcoming:3}[paymentReminder(l)?.state]??2);return rank(a)-rank(b)||(paymentReminder(a)?.date||'').localeCompare(paymentReminder(b)?.date||'');});
 const actionCards=orderedLines.map(l=>
   '<div class="card provider">'+
     '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">'+
       '<h3 style="margin:0">'+html(l.client)+'</h3>'+
       '<span class="status unpaid">' +t(l.issues.length?'تأكيد / مراجعة':'مستحقات')+'</span></div>'+
     '<div class="hint">'+caseCode(l.caseId)+' • '+html(providerName(l.providerId))+
       ' • ' +t(l.component==='transport'?'النقل':'الخدمة')+'</div>'+
     '<h3>'+html(actionLabel(l))+'</h3>'+
     '<div class="hint">'+html(detail(l))+'</div>'+paymentReminderText(l)+
     '<div class="actions">'+(
       l.issues.includes('unpriced_service')
         ?'<button class="btn primary" onclick="pawBookingReview(\''+l.caseId+'\')"><!--paw-i18n-->استكمال السعر في العملية</button>'
         :(String(l.caseId)==='384'&&l.action==='client_paid'
           ?'<button class="btn soft" onclick="openCaseDetails(\''+l.caseId+'\')">مراجعة الاسترجاع 47 د.ك — لا تسجلي تحصيل</button>'
           :actionButton(l))
     )+'</div></div>'
 ).join('');
 const box=el('followupFinanceList');
 if(box)box.innerHTML=(criticalCards+actionCards)||
   '<div class="card"><b class="green"><!--paw-i18n-->تمام ✓</b><div class="hint"><!--paw-i18n-->لا توجد إجراءات مالية مطلوبة حالياً. مستحقات الشركات تظهر في لوحة التسويات.</div></div>';
 const importantIds=new Set([...importantBookings.map(c=>String(c.id)),...lines.map(l=>l.caseId)]);
 set('fuFinance',importantIds.size);
 // Badge counts only work requiring immediate attention; form-only intake is separate.
 const pending=new Set(importantIds);
 for(const id of ['followupAppointmentList','followupMissingList']){
   el(id)?.querySelectorAll('[onclick]').forEach(b=>{
     const m=b.getAttribute('onclick')?.match(/\('([^']+)'/);
     if(m)pending.add(m[1]);
   });
 }
 set('followupNavBadge',pending.size);
 if(el('followupNavBadge'))el('followupNavBadge').style.display=pending.size?'inline-block':'none';
 set('kNeedsFollowup',pending.size);
}
function isArchivedHistoricalCaseForTable(c){return String(c.workflow_status)==='closed'&&c.client_paid===true&&/\[BULK_IMPORT:2026:(?:7|8|9):ROW:\d+\]/.test(String(c.notes||''));}
function renderCases(){
 if(!model)return;
 const q=v('caseSearch').toLowerCase(),pf=v('caseProviderFilter')||'all',sf=v('caseStatusFilter')||'all',origin=v('caseSourceFilter')||'all';
 const rows=snapshot.cases.slice().reverse().filter(c=>{
  const ls=linesFor(c.id),s=F.summarize(ls);
  if(origin==='booking'&&!['booking_form','booking_form_test'].includes(c.source))return false;
  if(origin==='pet_information_form'&&c.source!=='pet_information_form')return false;
  if(origin==='other'&&['booking_form','booking_form_test','pet_information_form'].includes(c.source))return false;
  if(q&&![caseCode(c.id),c.client_name,c.client_phone,...ls.map(l=>providerName(l.providerId)),...ls.map(l=>l.service),c.pet_type,c.breed,c.requested_service,c.service_name,typeof sourceLabel==='function'?sourceLabel(c.source):c.source,db.staff.find(e=>String(e.id)===String(c.employee_id))?.name].join(' ').toLowerCase().includes(q))return false;
  if(pf!=='all'&&!ls.some(l=>l.providerId===pf))return false;
  if(sf==='client_paid'&&(s.unpaid>0n||s.unknownCount))return false;
  if(sf==='client_unpaid'&&s.unpaid===0n&&!s.unknownCount)return false;
  if(sf==='vendor_unpaid'&&s.theirs===0n)return false;
  if(sf==='vendor_paid'&&s.theirs>0n)return false;
  return true;
 });
 const yesNo=x=>x===true?t('نعم'):x===false?t('لا'):'—';
 el('caseRows').innerHTML=rows.map(c=>{
  const ls=linesFor(c.id),s=F.summarize(ls),employee=db.staff.find(e=>String(e.id)===String(c.employee_id));
  const clientTasks=isArchivedHistoricalCaseForTable(c)?[]:ls.filter(l=>l.action==='client_paid'||l.unknown);
  const partnerTasks=isArchivedHistoricalCaseForTable(c)?[]:ls.filter(l=>l.action==='provider_paid'||l.action==='commission_received'||(!l.action&&l.issues.length));
  const isUnpricedIntake=['booking_form','pet_information_form'].includes(c.source)&&Number(c.total_amount||0)<=0;
  const paidText=s.unpaid>0n&&s.paid>0n&&!isUnpricedIntake?t('مدفوع جزئياً','Partially paid'):t(isUnpricedIntake?'السعر غير محدد':s.unknownCount?'نقل غير مؤكد':s.unpaid>0n?'غير مدفوع':'تم السداد');
  const button='<button class="btn soft" onclick="openCaseDetails(\''+c.id+'\')"><!--paw-i18n-->فتح العملية</button>';
  return '<tr><td>'+caseCode(c.id)+'</td><td>'+html(c.client_name)+'</td><td>'+html(t(c.pet_type||'—'))+'</td><td>'+html(c.breed||'—')+'</td><td>'+yesNo(c.vaccinated)+'</td><td>'+yesNo(c.microchipped)+'</td><td>'+ls.map(l=>html(providerName(l.providerId))).join('<br>')+'</td><td>'+ls.map(l=>html(t(l.service))).join('<br>')+'</td>'+['total','paw','provider'].map(k=>'<td>'+cash(s[k])+'</td>').join('')+'<td><span class="status '+(isUnpricedIntake?'partial':s.unpaid>0n||s.unknownCount?'unpaid':'paid')+'">'+paidText+'</span></td><td>'+html(c.client_due_date||'—')+'</td><td>'+t('لنا: ','Due to us: ')+cash(s.ours)+'<br>'+t('علينا: ','Due from us: ')+''+cash(s.theirs)+(s.issueCount?'<br><span class="hint"><!--paw-i18n-->يحتاج مراجعة</span>':'')+'</td><td>'+html(employee?.name||'—')+'<br>'+html(t(typeof sourceLabel==='function'?sourceLabel(c.source):c.source||''))+'</td><td><span class="hint">'+html(window.PawI18n?.workflow(c.workflow_status)||c.workflow_status||'new_request')+'</span><br>'+button+'</td><td>'+clientTasks.map(l=>'<div class="hint">'+html(t(l.service))+'</div>'+actionButton(l)).join('')+'</td><td>'+partnerTasks.map(l=>'<div class="hint">'+html(t(l.service))+'</div>'+actionButton(l)).join('')+'</td></tr>';
 }).join('')||'<tr><td colspan="18"><!--paw-i18n-->لا توجد عمليات</td></tr>';
}

// Smart Calendar — read-only projection of the same TEST finance snapshot.
const calKinds={booking:['الحجوزات','Bookings','#326bd7'],completed:['الخدمات المكتملة','Completed services','#168349'],transport:['النقل','Transport','#8754c0'],followup:['المتابعات','Follow-ups','#b48109'],payment:['الدفعات المستحقة','Payments due','#c63d4c']};
const calFinished=new Set(['appointment_completed','payment_completed','closed']);
function calStamp(value){
 if(!value)return null;const raw=String(value);
 if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){const d=new Date(raw+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===raw?{day:raw,time:''}:null;}
 const d=new Date(raw);if(!Number.isFinite(d.getTime()))return null;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return {day:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute};
}
function calDate(day){return day.slice(8,10)+'/'+day.slice(5,7)+'/'+day.slice(0,4);}
function calShift(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function calWeek(day){const d=new Date(day+'T12:00:00Z');return calShift(day,-d.getUTCDay());}
function calMonthShift(day,n){const d=new Date(day.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10);}
function calBuild(snap,fin,today){
 const events=[],seen=new Set(),byId=new Map((snap?.cases||[]).map(c=>[String(c.id),c]));
 const add=(c,kind,at,id,extra={})=>{const stamp=calStamp(at);if(!stamp||seen.has(id))return;seen.add(id);events.push({id,caseId:String(c.id),kind,day:stamp.day,time:stamp.time,employeeId:String(c.employee_id||''),providerId:String(c.provider_id||''),client:c.client_name||'',service:c.service_name||c.requested_service||'',...extra});};
 for(const c of byId.values()){
  if(c.workflow_status==='cancelled')continue;
  const done=calFinished.has(c.workflow_status);
  // A service date is not an appointment time; preserve that distinction.
  if(done){add(c,'completed',c.appointment_at||c.service_date,'complete:'+c.id);}
  else if(c.appointment_at){add(c,'booking',c.appointment_at,'booking:'+c.id,{confirmed:c.workflow_status==='provider_confirmed'});}
  else if(c.preferred_date){add(c,'booking',c.preferred_date,'preferred:'+c.id,{preferred:true});}
  else if(c.service_date){add(c,'booking',c.service_date,'service:'+c.id,{dateOnly:true});}
  if(c.transport_at&&c.transport_provider_id)add(c,'transport',c.transport_at,'transport:'+c.id,{providerId:String(c.transport_provider_id),direction:c.transport_direction||'',completed:done});
  if(!done&&c.appointment_reminder_at){const at=new Date(c.appointment_reminder_at),followed=c.appointment_followed_up_at?new Date(c.appointment_followed_up_at):null;if(!followed||at>followed)add(c,'followup',c.appointment_reminder_at,'reminder:'+c.id,{reminder:true});}
 }
 for(const f of snap?.followups||[]){const c=byId.get(String(f.case_id));if(!c||['cancelled','closed'].includes(c.workflow_status)||['done','cancelled'].includes(f.status))continue;add(c,'followup',f.followup_at,'followup:'+f.id,{employeeId:String(f.employee_id||c.employee_id||''),reason:f.reason||''});}
 for(const l of fin?.lines||[]){const c=byId.get(String(l.caseId));if(!c||c.workflow_status==='cancelled')continue;const due=paymentReminder(l,today);if(due)add(c,'payment',due.date,'payment:'+l.caseId,{amount:l.unpaid,overdue:due.state==='overdue'});}
 return events.sort((a,b)=>a.day.localeCompare(b.day)||a.time.localeCompare(b.time)||a.id.localeCompare(b.id));
}
let calSelected='',calView='month',calEmployee='all',calProvider='all',calType='all',calWholeMonth=true;
function calInitialDay(events,today){
 const dated=events.map(e=>e.day).sort();
 const current=dated.filter(day=>day.slice(0,7)===today.slice(0,7));
 if(current.length)return today;
 return dated.at(-1)||today;
}
function calFiltered(events,employee,provider,kind){return events.filter(e=>(employee==='all'||e.employeeId===employee)&&(provider==='all'||e.providerId===provider)&&(kind==='all'||e.kind===kind));}
function calRange(day,view){if(view==='day')return [day];if(view==='week'){const start=calWeek(day);return Array.from({length:7},(_,i)=>calShift(start,i));}const start=day.slice(0,7)+'-01',next=calMonthShift(start,1),days=[];for(let d=start;d<next;d=calShift(d,1))days.push(d);return days;}
function calInstall(){
 if(el('smartcalendar'))return;
 const main=document.querySelector('main'),nav=document.querySelector('.bottom .nav[data-p="followups"]');if(!main||!nav)return;
 const page=document.createElement('section');page.id='smartcalendar';page.className='page';main.appendChild(page);
 const btn=document.createElement('button');btn.type='button';btn.className='nav';btn.dataset.p='smartcalendar';btn.id='pawCalendarNav';btn.innerHTML='<b aria-hidden="true">▦</b><span></span>';btn.onclick=()=>window.showPage('smartcalendar');nav.after(btn);
 const style=document.createElement('style');style.id='pawCalendarStyle';style.textContent=
 '#smartcalendar{color:#17345e} .cal-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}.cal-head h1{margin:0;color:#143875}.cal-head p{margin:5px 0;color:#65758b;font-size:12px}.cal-btn{font:inherit;cursor:pointer;border:1px solid #dce5f2;background:white;color:#183e79;border-radius:10px;padding:9px 12px;font-weight:700}.cal-btn.active{background:#15396f;color:white;border-color:#15396f}.cal-tools{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.cal-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}.cal-filters label{display:grid;gap:5px;color:#526785;font-size:12px;min-width:0}.cal-filters select{width:100%;min-width:0}.cal-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);gap:12px;align-items:start}.cal-panel{border:1px solid #e0e7f0;border-radius:15px;padding:12px;background:white;min-width:0}.cal-month-head{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-bottom:10px}.cal-month-head h2{font-size:16px;margin:0}.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.cal-weekday{text-align:center;font-size:11px;color:#5e708a;padding:5px 0;overflow:hidden}.cal-day{min-width:0;min-height:70px;padding:5px;border:1px solid #e5ebf3;background:#fff;border-radius:9px;color:#193866;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;font:inherit}.cal-day.today{border:1px solid #e5ba38}.cal-day.selected{background:#e8efff;border:2px solid #315ec0}.cal-dots{display:flex;flex-wrap:wrap;gap:3px;justify-content:center}.cal-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}.cal-count{font-size:10px;color:#586e89}.cal-legend{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#536785}.cal-legend span{display:flex;gap:4px;align-items:center}.cal-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin:10px 0}.cal-summary button{min-width:0;border:1px solid #e1e7ef;background:white;border-radius:12px;padding:10px;text-align:start;cursor:pointer;color:#17345e;font:inherit}.cal-summary button.active{box-shadow:inset 0 0 0 2px #254c9d}.cal-summary small{display:block;font-size:11px;overflow-wrap:anywhere}.cal-summary b{font-size:21px}.cal-event{display:flex;align-items:flex-start;gap:9px;padding:10px 0;border-bottom:1px solid #e6ebf3}.cal-event:last-child{border:0}.cal-mark{width:4px;min-height:40px;align-self:stretch;border-radius:4px;flex:none}.cal-info{flex:1;min-width:0;overflow-wrap:anywhere}.cal-info b{font-size:14px;color:#18376b}.cal-info small{display:block;line-height:1.5;color:#5f738a}.cal-event .cal-btn{font-size:11px;padding:7px}.cal-empty{padding:20px 4px;text-align:center;color:#66788e}.cal-group{margin:10px 0 3px;font-weight:700;color:#18376b;font-size:13px}.cal-overdue{color:#a72e40;font-weight:700}.cal-period{font-size:12px;color:#566c85}.cal-panel h2{margin:0 0 8px;font-size:16px}.cal-list{max-height:650px;overflow:auto}.cal-nav-label{white-space:normal} @media(max-width:800px){.cal-layout{grid-template-columns:1fr}.cal-list{max-height:none}.cal-day{min-height:47px;padding:4px 1px}.cal-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.cal-summary button{padding:7px}.cal-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.cal-filters label:last-child{grid-column:span 2}.cal-panel{padding:9px}.cal-head h1{font-size:20px}.cal-btn{padding:7px 9px;font-size:12px}}';
 style.textContent += '@media(min-width:900px){.bottom:has(#pawCalendarNav){display:flex;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;gap:3px}.bottom:has(#pawCalendarNav) .nav{flex:1 0 78px;min-width:78px}}';
 document.head.appendChild(style);
}
function renderCalendar(){
 const nav=el('pawCalendarNav');if(nav)nav.querySelector('span').textContent=t('التقويم','Calendar');
 const root=el('smartcalendar');if(!root||!root.classList.contains('active')||!snapshot||!model)return;
 const today=localDate();
 const kinds=Object.keys(calKinds),events=calBuild(snapshot,model,today);if(!calSelected)calSelected=calInitialDay(events,today);
 const latest=events.at(-1)?.day||'',base=calFiltered(events,calEmployee,calProvider,'all'),filtered=calFiltered(base,'all','all',calType);
 const days=calRange(calSelected,calView),period=new Set(days),periodEvents=base.filter(e=>period.has(e.day));
 const display=calView==='month'&&!calWholeMonth?filtered.filter(e=>e.day===calSelected):filtered.filter(e=>period.has(e.day));
 const kindLabel=k=>t(calKinds[k][0],calKinds[k][1]),labelDay=d=>calDate(d);
 const options=(rows,current,allLabel)=>'<option value="all">'+html(allLabel)+'</option>'+rows.map(x=>'<option value="'+html(x.id)+'" '+(String(x.id)===current?'selected':'')+'>'+html(x.name)+'</option>').join('');
 const navLabel=calView==='month'?new Intl.DateTimeFormat(window.PawI18n?.language==='en'?'en-GB':'ar-KW',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(calSelected.slice(0,7)+'-01T12:00:00Z')):labelDay(days[0])+(days.length>1?' – '+labelDay(days[days.length-1]):'');
 const h=(action,text,active=false)=>'<button type="button" class="cal-btn'+(active?' active':'')+'" data-cal-action="'+action+'" '+(active?'aria-pressed="true"':'')+'>'+html(text)+'</button>';
 const stats=kinds.map(k=>'<button type="button" class="'+(calType===k?'active':'')+'" data-cal-kind="'+k+'"><small><span class="cal-dot" style="background:'+calKinds[k][2]+'"></span> '+html(kindLabel(k))+'</small><b style="color:'+calKinds[k][2]+'">'+periodEvents.filter(e=>e.kind===k).length+'</b></button>').join('');
 const weekNames=[t('أحد','Sun'),t('اثنين','Mon'),t('ثلاثاء','Tue'),t('أربعاء','Wed'),t('خميس','Thu'),t('جمعة','Fri'),t('سبت','Sat')];
 const blanks=calView==='month'?new Date(days[0]+'T12:00:00Z').getUTCDay():0;
 const grid=calView==='day'?'<div class="cal-period">'+html(labelDay(calSelected))+'</div>':'<div class="cal-grid">'+weekNames.map(x=>'<div class="cal-weekday">'+html(x)+'</div>').join('')+'<span></span>'.repeat(blanks)+days.map(d=>{const ev=filtered.filter(e=>e.day===d),dots=[...new Set(ev.map(e=>e.kind))];return '<button type="button" class="cal-day'+(d===today?' today':'')+(d===calSelected?' selected':'')+'" data-cal-day="'+d+'" aria-label="'+html(labelDay(d)+' · '+ev.length)+'" aria-pressed="'+(d===calSelected)+'"><b>'+Number(d.slice(-2))+'</b><span class="cal-dots">'+dots.map(k=>'<span class="cal-dot" style="background:'+calKinds[k][2]+'"></span>').join('')+'</span>'+(ev.length?'<span class="cal-count">'+ev.length+'</span>':'')+'</button>';}).join('')+'</div>';
 const eventHtml=e=>{
 const provider=(snapshot.providers||[]).find(p=>String(p.id)===e.providerId)?.name||t('غير محدد','Unspecified');
 const employee=(snapshot.employees||[]).find(p=>String(p.id)===e.employeeId)?.name||t('غير محدد','Unassigned');
 const desc=e.kind==='payment'?cash(e.amount)+(e.overdue?' · '+t('متأخرة','Overdue'):''):e.kind==='followup'?(e.reason||t('تذكير بالموعد','Appointment reminder')):e.kind==='transport'?(e.direction==='pickup'?t('استلام','Pickup'):e.direction==='dropoff'?t('توصيل','Drop-off'):e.direction==='both'?t('استلام وتوصيل','Pickup & drop-off'):t('نقل','Transport')):e.preferred?t('موعد مفضل غير مؤكد','Preferred date, unconfirmed'):e.dateOnly?t('تاريخ خدمة بلا وقت','Service date, no time'):e.kind==='booking'?(e.confirmed?t('موعد مؤكد','Confirmed appointment'):t('موعد مسجل','Recorded appointment')):t('خدمة مكتملة','Service completed');
 return '<div class="cal-event"><span class="cal-mark" style="background:'+calKinds[e.kind][2]+'"></span><div class="cal-info"><b>'+html(e.client||t('بدون اسم','Unnamed'))+'</b><small>'+html(kindLabel(e.kind)+' · '+(e.time||t('بدون وقت محدد','No time specified')))+'</small><small>'+html([e.service,provider,employee,caseCode(e.caseId)].filter(Boolean).join(' · '))+'</small><small class="'+(e.overdue?'cal-overdue':'')+'">'+html(desc)+'</small></div><button class="cal-btn" type="button" data-cal-case="'+html(e.caseId)+'" data-cal-event="'+html(e.kind)+'">'+html(e.kind==='payment'&&mayWrite()?t('الدفعة','Payment'):t('فتح','Open'))+'</button></div>';
 };
 let last='',agenda='';for(const e of display){if(e.day!==last&&(calView!=='month'||calWholeMonth)){last=e.day;agenda+='<div class="cal-group">'+html(labelDay(e.day))+'</div>';}agenda+=eventHtml(e);}
 const overdue=filtered.filter(e=>e.kind==='payment'&&e.overdue);
 const monthCounts=new Map();for(const e of events){const month=e.day.slice(0,7);monthCounts.set(month,(monthCounts.get(month)||0)+1);}
 const months=[...new Set([today.slice(0,7),calSelected.slice(0,7),...monthCounts.keys()])].sort().reverse();
 const monthPicker='<label class="cal-period">'+html(t('انتقلي إلى شهر','Jump to month'))+' <select id="calMonthPicker" style="width:auto;max-width:100%">'+months.map(m=>'<option value="'+m+'" '+(m===calSelected.slice(0,7)?'selected':'')+'>'+m.slice(5)+'/'+m.slice(0,4)+' · '+(monthCounts.get(m)||0)+'</option>').join('')+'</select></label>';
 const monthEmpty=!monthCounts.get(today.slice(0,7));
 const note=monthEmpty&&latest?'<div class="cal-panel" style="margin-bottom:10px;background:#fffaf0;color:#785817">'+html(t('لا توجد أحداث مسجلة في الشهر الحالي ضمن TEST. آخر تاريخ فيه بيانات: ','No events recorded in the current TEST month. Latest recorded date: ')+labelDay(latest)+t(' — يمكنك عرض الأشهر السابقة.',' — earlier months are available.'))+'</div>':'';
 const summary='<div class="cal-period" style="margin:8px 0">'+html(t('أحداث الفترة: ','Events in period: ')+periodEvents.length+' · '+t('بعد الفلترة: ','Filtered: ')+filtered.filter(e=>period.has(e.day)).length)+'</div>';
 root.innerHTML='<div class="cal-head"><div><h1>'+html(t('التقويم الذكي','Smart Calendar'))+'</h1><p>'+html(t('الحجوزات والمتابعات والدفعات · توقيت الكويت','Bookings, follow-ups & payments · Kuwait time'))+'</p></div><div class="cal-tools">'+h('today',t('اليوم','Today'))+(latest?h('latest',t('آخر بيانات','Latest data')):'')+h('refresh',t('تحديث','Refresh'))+'</div></div>'+note+'<div class="cal-tools" style="margin:8px 0">'+monthPicker+'</div>'+summary+'<div class="cal-summary">'+stats+'</div><div class="cal-filters"><label>'+html(t('الموظفة','Employee'))+'<select id="calEmployee">'+options(snapshot.employees||[],calEmployee,t('كل الموظفين','All staff'))+'</select></label><label>'+html(t('مقدم الخدمة','Provider'))+'<select id="calProvider">'+options(snapshot.providers||[],calProvider,t('كل مقدمي الخدمات','All providers'))+'</select></label><label>'+html(t('نوع الموعد','Event type'))+'<select id="calType"><option value="all">'+html(t('الكل','All'))+'</option>'+kinds.map(k=>'<option value="'+k+'" '+(calType===k?'selected':'')+'>'+html(kindLabel(k))+'</option>').join('')+'</select></label></div><div class="cal-layout"><div class="cal-panel"><div class="cal-month-head">'+h('prev',t('السابق','Prev'))+'<h2>'+html(navLabel)+'</h2>'+h('next',t('التالي','Next'))+'</div><div class="cal-tools" style="margin-bottom:10px">'+h('month',t('شهري','Month'),calView==='month')+h('week',t('أسبوعي','Week'),calView==='week')+h('day',t('يومي','Day'),calView==='day')+'</div>'+grid+'<div class="cal-legend">'+kinds.map(k=>'<span><i class="cal-dot" style="background:'+calKinds[k][2]+'"></i>'+html(kindLabel(k))+'</span>').join('')+'</div></div><div class="cal-panel"><h2>'+html(calView==='month'?(calWholeMonth?t('جدول الشهر','Month agenda'):t('جدول يوم ','Agenda for ')+labelDay(calSelected)):t('جدول الفترة','Period agenda'))+'</h2>'+(calView==='month'?'<div class="cal-tools" style="margin:6px 0">'+h('whole',t('كل الشهر','Whole month'),calWholeMonth)+h('selected',t('اليوم المحدد','Selected day'),!calWholeMonth)+'</div>':'')+'<div class="cal-list">'+(agenda||'<div class="cal-empty">'+html(t('لا توجد مواعيد مسجلة في هذه الفترة.','No recorded events in this period.'))+'</div>')+'</div></div></div>'+(overdue.length?'<details class="cal-panel" style="margin-top:12px"><summary class="cal-overdue">'+html(t('دفعات متأخرة من جميع الفترات','Overdue payments across all periods')+' ('+overdue.length+')')+'</summary>'+overdue.map(e=>'<div class="cal-group">'+html(labelDay(e.day))+'</div>'+eventHtml(e)).join('')+'</details>':'');
 el('calMonthPicker').onchange=e=>{calSelected=e.target.value+'-01';calView='month';calWholeMonth=true;renderCalendar();};
 for(const [id,fn] of [['calEmployee',x=>calEmployee=x],['calProvider',x=>calProvider=x],['calType',x=>calType=x]]){el(id).onchange=e=>{fn(e.target.value);renderCalendar();};}
 root.querySelectorAll('[data-cal-action]').forEach(b=>b.onclick=async()=>{const a=b.dataset.calAction;if(a==='today'){calSelected=localDate();calWholeMonth=false;}else if(a==='latest'){calSelected=latest||localDate();calView='month';calWholeMonth=true;calEmployee='all';calProvider='all';calType='all';}else if(a==='whole')calWholeMonth=true;else if(a==='selected')calWholeMonth=false;else if(a==='prev'||a==='next'){const n=a==='next'?1:-1;calSelected=calView==='month'?calMonthShift(calSelected,n):calShift(calSelected,n*(calView==='week'?7:1));if(calView==='month')calWholeMonth=true;}else if(a==='refresh'){try{b.disabled=true;await refresh();}catch(e){toast(t('تعذر تحديث التقويم','Calendar refresh failed'));}finally{b.disabled=false;}return;}else {calView=a;if(a==='month')calWholeMonth=true;}renderCalendar();});
 root.querySelectorAll('[data-cal-day]').forEach(b=>b.onclick=()=>{calSelected=b.dataset.calDay;calWholeMonth=false;renderCalendar();});
 root.querySelectorAll('[data-cal-kind]').forEach(b=>b.onclick=()=>{calType=calType===b.dataset.calKind?'all':b.dataset.calKind;renderCalendar();});
 root.querySelectorAll('[data-cal-case]').forEach(b=>b.onclick=()=>{if(b.dataset.calEvent==='payment'&&mayWrite())window.pawFinanceOpen(b.dataset.calCase,'main');else window.openCaseDetails(b.dataset.calCase);});
}


// TEST employee performance: attributed to the assigned employee, not the payment actor.
let epTargetRows=null,epTargetMonth='',epTargetSaving=false,epTargetMessage='';
async function epLoadTargets(){
 epTargetRows=null;if(!epAdmin())return;
 try{const q=await window.PAWAPP_AUTH.client.from('test_employee_monthly_targets').select('employee_id,month,amount');if(q.error)throw q.error;
 epTargetRows=new Map((q.data||[]).map(r=>[String(r.employee_id)+'|'+String(r.month).slice(0,7),F.minor(r.amount)]));
 }catch(e){console.warn('Employee targets unavailable',e);}
}
function epGoalStats(earned,goal){return {remaining:goal>earned?goal-earned:0n,percent:goal>0n?Number(earned*1000n/goal)/10:null};}
function epTargetPanel(snap,fin,month,today){
 if(!epTargetRows||!targetRows)return '<div class="ep-panel"><h2>'+html(t('الأهداف الشهرية','Monthly targets'))+'</h2><p>'+html(t('تعذر تحميل الأهداف. اضغطي تحديث.','Targets unavailable. Refresh to retry.'))+'</p></div>';
 const stats=epMetrics(snap,fin,month+'-01',calShift(calMonthShift(month+'-01',1),-1),today);
 const goal=targetRows.get(month)??10000000n,company=monthlyTargetStats(fin.lines,month,today,goal);
 const employees=stats.groups.filter(g=>g.id!=='unassigned');
 const assigned=employees.reduce((sum,g)=>sum+(epTargetRows.get(g.id+'|'+month)??0n),0n);
 const unassigned=stats.groups.find(g=>g.id==='unassigned')?.fee??0n;
 const val=x=>html(cash(x)),percent=x=>x===null?'—':x.toFixed(1)+'%';
 const bar=x=>'<div class="ep-track"><div class="ep-fill" style="background:#26a469;width:'+Math.max(0,Math.min(100,x??0))+'%"></div></div>';
 return '<div class="ep-panel" style="margin:12px 0"><div class="ep-head"><h2>'+html(t('الأهداف الشهرية للموظفات','Employee monthly targets'))+'</h2><label>'+html(t('شهر الهدف','Target month'))+' <input id="epTargetMonth" type="month" value="'+html(month)+'"></label></div>'+
 '<div class="ep-grid">'+[[t('هدف الشركة','Company target'),goal],[t('المحقق للشركة','Company earned'),company.earned],[t('مجموع أهداف الموظفات','Allocated targets'),assigned],[assigned>goal?t('تجاوز توزيع الهدف','Overallocated'):t('هدف لم يوزع','Unallocated target'),assigned>goal?assigned-goal:goal-assigned]].map(([label,n])=>'<div class="ep-kpi" style="background:#edf2ff;color:#244b9b"><small>'+html(label)+'</small><strong>'+val(n)+'</strong></div>').join('')+'</div>'+
 '<p class="ep-note">'+html(t('نسبة هدف الشركة: ','Company achievement: ')+percent(company.percent)+' · '+t('حصة عمليات غير معيّنة: ','Unassigned case share: '))+val(unassigned)+'</p>'+bar(company.percent)+
 '<p class="ep-note">'+html(t('الأهداف مستقلة لكل موظفة ولكل شهر. لا يُنسب الإيراد غير المعيّن لأي موظفة.','Targets are individual and monthly. Unassigned revenue is not credited to any employee.'))+'</p>'+
 '<div class="ep-tablewrap"><table class="ep-table"><thead><tr>'+[t('الموظفة','Employee'),t('الهدف','Target'),t('المحقق','Earned'),t('المتبقي','Remaining'),t('النسبة','Achievement'),t('حفظ','Save')].map(x=>'<th>'+html(x)+'</th>').join('')+'</tr></thead><tbody>'+
 employees.map(g=>{const v=epTargetRows.get(g.id+'|'+month),x=epGoalStats(g.fee,v??0n);return '<tr><td>'+html(g.name)+'</td><td><input type="number" min="0" max="999999999.999" step="0.001" data-ep-goal="'+html(g.id)+'" value="'+(v===undefined?'':F.format(v))+'" placeholder="'+html(t('غير محدد','Not set'))+'" style="width:115px"></td><td>'+val(g.fee)+'</td><td>'+(v>0n?val(x.remaining):'—')+'</td><td>'+percent(x.percent)+bar(x.percent)+'</td><td><button type="button" data-ep-save-goal="'+html(g.id)+'">'+html(t('حفظ','Save'))+'</button></td></tr>';}).join('')+'</tbody></table></div><p id="epTargetMessage" class="ep-note">'+html(epTargetMessage)+'</p></div>';
}
async function epSaveGoal(id,month,raw){
 if(!epAdmin()||epTargetSaving)return;
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!/^\d{1,9}(\.\d{1,3})?$/.test(raw)||!(snapshot.employees||[]).some(e=>String(e.id)===id)){el('epTargetMessage').textContent=t('أدخلي مبلغاً صالحاً (حتى 3 منازل عشرية).','Enter a valid amount (up to 3 decimals).');return;}
 epTargetSaving=true;try{const q=await window.PAWAPP_AUTH.client.from('test_employee_monthly_targets').upsert({employee_id:id,month:month+'-01',amount:raw,updated_at:new Date().toISOString()},{onConflict:'employee_id,month'});if(q.error)throw q.error;await epLoadTargets();epTargetMessage=t('تم حفظ الهدف.','Target saved.');renderEmployeePerformance();}catch(e){el('epTargetMessage').textContent=t('تعذر حفظ الهدف.','Could not save target.');}finally{epTargetSaving=false;}
}
const epDone=new Set(['appointment_completed','payment_completed','closed']);
const epPalette=['#326bd7','#26a469','#e5b62c','#8754c0','#d45c8b','#438ca2'];
let epTab='performance',epMode='month',epFrom='',epTo='',epEmployee='all',epProfile='';
const epAdmin=()=>window.PAWAPP_AUTH?.access?.role==='admin'&&window.pawIsAdmin?.()===true;
function epDate(value){return calStamp(value)?.day||'';}
function epBetween(day,from,to){return !!day&&(!from||day>=from)&&(!to||day<=to);}
function epPeriod(mode,today,latest=''){
 const day=mode==='latest'?(latest||today):today;
 if(mode==='all')return ['',''];
 if(mode==='day')return [day,day];
 if(mode==='week')return [calWeek(day),calShift(calWeek(day),6)];
 return [day.slice(0,7)+'-01',calShift(calMonthShift(day,1),-1)];
}
function epMetrics(snap,fin,from,to,today){
 const cases=snap?.cases||[],staff=snap?.employees||[],byCase=new Map(cases.map(c=>[String(c.id),c]));
 const staffById=new Map(staff.map(e=>[String(e.id),e]));
 const key=c=>staffById.has(String(c?.employee_id))?String(c.employee_id):'unassigned';
 const newGroup=(id,name)=>({id,name,total:0,completed:0,pending:0,cancelled:0,customers:new Set(),fresh:new Set(),returning:new Set(),unknownPhone:0,fee:0n,collected:0n,outstanding:0n,review:0,followDone:0,followPending:0,followOverdue:0,undated:0});
 const groups=new Map(staff.map(e=>[String(e.id),newGroup(String(e.id),e.name)]));
 groups.set('unassigned',newGroup('unassigned',''));
 const team=newGroup('all','');
 const first=new Map(),unknownFirst=new Set(),included=new Map(),reviewed=new Set();
 for(const c of cases){
  if(c.workflow_status==='cancelled')continue;
  const p=F.validPhone(c.client_phone),day=epDate(c.service_date);
  if(p&&!day)unknownFirst.add(p);
  if(p&&day&&(!first.has(p)||day<first.get(p)))first.set(p,day);
 }
 function forGroups(id,fn){fn(team);fn(groups.get(id)||groups.get('unassigned'));}
 for(const c of cases){
  const id=key(c),day=epDate(c.service_date);
  if(!day){forGroups(id,g=>g.undated++);if(from||to)continue;}
  else if(!epBetween(day,from,to))continue;
  included.set(String(c.id),c);
  const cancelled=c.workflow_status==='cancelled',done=epDone.has(c.workflow_status);
  forGroups(id,g=>{
   g.total++;if(cancelled){g.cancelled++;return;}if(done)g.completed++;else g.pending++;
   const p=F.validPhone(c.client_phone);if(!p){g.unknownPhone++;return;}
   g.customers.add(p);
   if(unknownFirst.has(p)||!first.has(p)||!day)return;
   if(first.get(p)<day)g.returning.add(p);
   if(epBetween(first.get(p),from,to)&&first.get(p)===day)g.fresh.add(p);
  });
 }
 for(const l of fin?.lines||[]){
  const c=included.get(String(l.caseId));if(!c||l.cancelled||c.workflow_status==='cancelled')continue;
  const id=key(c);
  if(l.unknown||l.issues?.length){if(!reviewed.has(String(c.id))){reviewed.add(String(c.id));forGroups(id,g=>g.review++);}}
  if(l.unpaid!=null&&l.unpaid>0n)forGroups(id,g=>g.outstanding+=l.unpaid);
  if(!epDone.has(c.workflow_status)||!l.date||l.date>today||!(l.total>0n)||l.issues?.some(x=>['invalid_price','price_split_mismatch'].includes(x)))continue;
  forGroups(id,g=>{g.fee+=l.paw;g.collected+=l.pawCollected;});
 }
 // Follow-up attribution uses the explicitly assigned follow-up employee, or the case owner.
 for(const f of snap?.followups||[]){
  const c=byCase.get(String(f.case_id)),day=epDate(f.followup_at);
  if(!c||c.workflow_status==='cancelled'||f.status==='cancelled'||!day||!epBetween(day,from,to))continue;
  if(f.status!=='done'&&c.workflow_status==='closed')continue;
  const id=staffById.has(String(f.employee_id))?String(f.employee_id):key(c);
  forGroups(id,g=>{if(f.status==='done')g.followDone++;else{g.followPending++;if(day<today||(day===today&&Number.isFinite(Date.parse(f.followup_at))&&Date.parse(f.followup_at)<Date.now()))g.followOverdue++;}});
 }
 // A customer who is new in this period is counted once, not also as returning.
 for(const g of [team,...groups.values()])for(const p of g.fresh)g.returning.delete(p);
 return {team,groups:[...groups.values()].sort((a,b)=>b.completed-a.completed||b.total-a.total||String(a.name).localeCompare(String(b.name)))};
}
function epInstall(){
 const host=el('admin');if(!host)return;
 let tabs=el('pawEmployeeTabs');if(!tabs){tabs=document.createElement('div');tabs.id='pawEmployeeTabs';tabs.className='ep-tabs';host.prepend(tabs);}
 let pane=el('pawEmployeePerformance');if(!pane){pane=document.createElement('section');pane.id='pawEmployeePerformance';pane.hidden=true;tabs.after(pane);}
 if(el('pawEmployeeStyle'))return;
 const style=document.createElement('style');style.id='pawEmployeeStyle';style.textContent=
 '#admin.ep-performance> :not(#pawEmployeeTabs):not(#pawEmployeePerformance){display:none!important}#pawEmployeePerformance[hidden],#pawEmployeeTabs[hidden]{display:none!important}.ep-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.ep-button{border:1px solid #dce5f2;background:white;color:#17396d;border-radius:10px;padding:9px 14px;font:inherit;font-weight:700;cursor:pointer}.ep-button.active{background:#17396d;color:white;border-color:#17396d}#pawEmployeePerformance{min-width:0;color:#17345e}.ep-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin:14px 0}.ep-head h1{color:#15396f;margin:0}.ep-head p{font-size:12px;color:#61728b;margin:5px 0}.ep-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin:12px 0}.ep-filters label{display:grid;gap:5px;font-size:12px;color:#526785;flex:1;min-width:120px}.ep-filters input,.ep-filters select{width:100%;min-width:0;box-sizing:border-box}.ep-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.ep-kpi{border-radius:13px;padding:14px;min-width:0;overflow-wrap:anywhere}.ep-kpi small{display:block;font-size:12px;line-height:1.4}.ep-kpi strong{display:block;font-size:clamp(19px,3vw,29px);margin-top:7px}.ep-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:12px;margin:12px 0;align-items:start}.ep-panel{background:#fff;border:1px solid #e0e7f0;border-radius:15px;padding:16px;min-width:0}.ep-panel h2{font-size:17px;margin:0 0 12px}.ep-bars{display:grid;gap:12px}.ep-barbtn{display:block;width:100%;text-align:start;border:0;background:none;color:#17345e;font:inherit;cursor:pointer;padding:4px 0}.ep-barlabel{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:5px;font-size:13px}.ep-track{height:10px;background:#edf1f6;border-radius:20px;overflow:hidden}.ep-fill{height:100%;border-radius:20px}.ep-detail-head{display:flex;align-items:center;gap:10px;margin:0 0 12px}.ep-avatar{border-radius:50%;width:42px;height:42px;display:grid;place-items:center;font-weight:800;background:#e6edff;color:#3159a5;flex:none}.ep-detail-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid #edf0f5;font-size:13px}.ep-detail-row span{color:#5e708a}.ep-detail-row b{text-align:end;overflow-wrap:anywhere}.ep-tablewrap{overflow-x:auto}.ep-table{width:100%;border-collapse:collapse;min-width:700px}.ep-table th,.ep-table td{padding:10px;text-align:start;white-space:nowrap;border-bottom:1px solid #e5ebf3;font-size:12px}.ep-table th{color:#526785}.ep-table button{font:inherit;border:0;background:none;color:#2459af;font-weight:700;cursor:pointer;padding:0}.ep-note{font-size:12px;line-height:1.6;color:#61728b}.ep-empty{padding:18px;text-align:center;color:#61728b}.ep-progress{margin-top:12px}.ep-error{color:#a42c39}.ep-table tr.selected{background:#f0f5ff}@media(max-width:850px){.ep-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ep-layout{grid-template-columns:1fr}.ep-panel{padding:12px}.ep-kpi{padding:10px}.ep-filters label{min-width:110px}.ep-head h1{font-size:20px}}';
 document.head.appendChild(style);
}
function renderEmployeePerformance(){
 epInstall();const host=el('admin'),tabs=el('pawEmployeeTabs'),pane=el('pawEmployeePerformance');if(!host||!tabs||!pane)return;
 if(!epAdmin()){tabs.hidden=true;pane.hidden=true;pane.replaceChildren();host.classList.remove('ep-performance');epTab='performance';return;}
 tabs.hidden=false;
 tabs.innerHTML='<button type="button" data-ep-tab="settings" class="ep-button '+(epTab==='settings'?'active':'')+'">'+html(t('إعدادات الإدارة','Administration settings'))+'</button><button type="button" data-ep-tab="performance" class="ep-button '+(epTab==='performance'?'active':'')+'">'+html(t('أداء الموظفات','Employee Performance'))+'</button>';
 tabs.querySelectorAll('[data-ep-tab]').forEach(b=>b.onclick=()=>{epTab=b.dataset.epTab;renderEmployeePerformance();});
 host.classList.toggle('ep-performance',epTab==='performance');pane.hidden=epTab!=='performance';
 if(pane.hidden||!host.classList.contains('active')||!snapshot||!model){pane.replaceChildren();return;}
 const today=localDate(),dates=(snapshot.cases||[]).map(c=>epDate(c.service_date)).filter(Boolean).sort(),latest=dates.at(-1)||'';
 if(!epFrom&&!epTo&&epMode!=='all'&&epMode!=='custom'){epMode=dates.some(d=>d.slice(0,7)===today.slice(0,7))?'month':latest?'latest':'month';[epFrom,epTo]=epPeriod(epMode,today,latest);}
 if(!epTargetMonth)epTargetMonth=(epFrom||today).slice(0,7);
 const stats=epMetrics(snapshot,model,epFrom,epTo,today),groups=stats.groups;
 if(epEmployee!=='all'&&!groups.some(g=>g.id===epEmployee))epEmployee='all';
 const scope=epEmployee==='all'?stats.team:groups.find(g=>g.id===epEmployee),rows=groups.filter(g=>(epEmployee==='all'||g.id===epEmployee)&&(g.id!=='unassigned'||g.total||g.followDone||g.followPending||g.undated));
 const name=g=>g.id==='unassigned'?t('غير معيّن','Unassigned'):g.name||t('بدون اسم','Unnamed');
 if(!rows.some(g=>g.id===epProfile))epProfile=rows.find(g=>g.total||g.followDone||g.followPending)?.id||rows[0]?.id||'';
 const profile=rows.find(g=>g.id===epProfile);
 const pct=g=>g.total?Math.round(g.completed/g.total*100):0;
 const kpi=(label,value,bg,color)=>'<div class="ep-kpi" style="background:'+bg+';color:'+color+'"><small>'+html(label)+'</small><strong>'+html(value)+'</strong></div>';
 const item=(label,value)=>'<div class="ep-detail-row"><span>'+html(label)+'</span><b>'+html(value)+'</b></div>';
 const dateLabel=d=>d?calDate(d):'—';
 const max=Math.max(1,...rows.map(g=>g.completed));
 const chart=rows.map((g,i)=>'<button type="button" class="ep-barbtn" data-ep-profile="'+html(g.id)+'"><div class="ep-barlabel"><span>'+html(name(g))+'</span><b>'+g.completed+' '+html(t('عملية','cases'))+'</b></div><div class="ep-track"><div class="ep-fill" style="width:'+(g.completed/max*100)+'%;background:'+epPalette[i%epPalette.length]+'"></div></div></button>').join('');
 const detail=profile?'<div class="ep-detail-head"><div class="ep-avatar">'+html(name(profile).slice(0,1))+'</div><div><b>'+html(name(profile))+'</b><div class="ep-note">'+html(t('ملف الأداء للفترة المحددة','Performance for selected period'))+'</div></div></div>'+
 item(t('العملاء المختلفون (هاتف موحّد)','Distinct customers (normalized phone)'),profile.customers.size)+
 item(t('إجمالي العمليات','Total cases'),profile.total)+item(t('العمليات المكتملة','Completed cases'),profile.completed)+item(t('قيد التنفيذ','In progress'),profile.pending)+item(t('العمليات الملغاة','Cancelled cases'),profile.cancelled)+
 item(t('المتابعات المنجزة','Completed follow-ups'),profile.followDone)+item(t('المتابعات المتأخرة','Overdue follow-ups'),profile.followOverdue)+item(t('المتابعات المعلقة (تشمل المتأخرة)','Pending follow-ups (incl. overdue)'),profile.followPending)+
 item(t('حصة PawApp من العمليات المكتملة','PawApp share from completed cases'),cash(profile.fee))+item(t('حصة PawApp المحصّلة','Collected PawApp share'),cash(profile.collected))+item(t('المبالغ المتبقية على العملاء','Outstanding client balances'),cash(profile.outstanding))+
 item(t('عملاء جدد حسب أول خدمة مسجلة','New customers by first recorded service'),profile.fresh.size)+item(t('عملاء متكررون','Returning customers'),profile.returning.size)+item(t('عمليات بدون رقم صالح','Cases without valid phone'),profile.unknownPhone)+item(t('عمليات تحتاج مراجعة مالية','Cases requiring finance review'),profile.review)+
 '<div class="ep-progress"><div class="ep-barlabel"><b>'+html(t('نسبة إنجاز العمليات','Completion rate'))+'</b><b style="color:#16834b">'+(profile.total?pct(profile)+'%':'—')+'</b></div><div class="ep-track"><div class="ep-fill" style="background:#26a469;width:'+pct(profile)+'%"></div></div></div>':'<div class="ep-empty">'+html(t('لا توجد بيانات موظفات في هذه الفترة.','No staff data for this period.'))+'</div>';
 const modes=[['day',t('اليوم','Today')],['week',t('هذا الأسبوع','This week')],['month',t('هذا الشهر','This month')],['latest',t('آخر شهر فيه بيانات','Latest recorded month')],['all',t('كل الفترات','All time')],['custom',t('فترة مخصصة','Custom period')]];
 const opts=(items,selected)=>items.map(([v,n])=>'<option value="'+html(v)+'" '+(v===selected?'selected':'')+'>'+html(n)+'</option>').join('');
 pane.innerHTML='<div class="ep-head"><div><h1>'+html(t('أداء الموظفات','Employee Performance'))+'</h1><p>'+html(t('للإدارة فقط · بيانات TEST · توقيت الكويت','Admin only · TEST data · Kuwait time'))+'</p></div><button type="button" class="ep-button" id="epRefresh">'+html(t('تحديث','Refresh'))+'</button></div>'+
 '<div class="ep-filters"><label>'+html(t('الفترة','Period'))+'<select id="epMode">'+opts(modes,epMode)+'</select></label><label>'+html(t('من','From'))+'<input type="date" id="epFrom" value="'+html(epFrom)+'"></label><label>'+html(t('إلى','To'))+'<input type="date" id="epTo" value="'+html(epTo)+'"></label><label>'+html(t('الموظفة','Employee'))+'<select id="epEmployee">'+opts([['all',t('جميع الموظفات','All staff')],...groups.map(g=>[g.id,name(g)])],epEmployee)+'</select></label></div>'+
 '<p class="ep-note" id="epStatus">'+html((epFrom||epTo)?dateLabel(epFrom)+' – '+dateLabel(epTo):t('كل الفترات، بما فيها العمليات غير المؤرخة','All periods, including undated cases'))+' · '+html(t('تاريخ الخدمة أساس الفترة؛ حالة العملية الحالية هي المستخدمة.','Service date defines period; current case status is used.'))+'</p>'+
 '<div class="ep-grid">'+kpi(t('إجمالي العمليات','Total cases'),scope.total,'#edf2ff','#244b9b')+kpi(t('العمليات المكتملة','Completed cases'),scope.completed,'#e8f6ed','#198249')+kpi(t('قيد التنفيذ','In progress'),scope.pending,'#fff5dc','#9a7317')+kpi(t('حصة PawApp المكتسبة','Earned PawApp share'),cash(scope.fee),'#f0eafa','#7951af')+'</div>'+
 epTargetPanel(snapshot,model,epTargetMonth,today)+
 '<div class="ep-layout"><div class="ep-panel"><h2>'+html(t('مقارنة إنجاز العمليات','Completed cases comparison'))+'</h2><div class="ep-bars">'+(chart||'<div class="ep-empty">'+html(t('لا توجد عمليات','No cases'))+'</div>')+'</div><p class="ep-note">'+html(t('اضغطي على اسم الموظفة لعرض التفاصيل.','Select an employee to view details.'))+'</p></div><div class="ep-panel" id="epProfile"><h2>'+html(t('ملف أداء الموظفة','Employee profile'))+'</h2>'+detail+'</div></div>'+
 '<div class="ep-panel"><h2>'+html(t('ملخص الفريق','Team summary'))+'</h2><div class="ep-tablewrap"><table class="ep-table"><thead><tr>'+[t('الموظفة','Employee'),t('العمليات','Cases'),t('مكتملة','Completed'),t('معلقة','Pending'),t('ملغاة','Cancelled'),t('الإنجاز','Completion'),t('حصة PawApp','PawApp share'),t('المحصّلة','Collected'),t('متابعات متأخرة','Overdue follow-ups')].map(x=>'<th>'+html(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(g=>'<tr class="'+(g.id===epProfile?'selected':'')+'"><td><button type="button" data-ep-profile="'+html(g.id)+'">'+html(name(g))+'</button></td><td>'+g.total+'</td><td>'+g.completed+'</td><td>'+g.pending+'</td><td>'+g.cancelled+'</td><td>'+(g.total?pct(g)+'%':'—')+'</td><td>'+html(cash(g.fee))+'</td><td>'+html(cash(g.collected))+'</td><td>'+g.followOverdue+'</td></tr>').join('')+'</tbody></table></div></div>'+
 '<p class="ep-note">'+html(t('الإنجاز = المكتملة ÷ جميع العمليات بما فيها الملغاة. الحصة المكتسبة والمحصّلة من العمليات المكتملة ذات التسعير الصالح، وفق نموذج الحسابات الحالي؛ ليست صافي الربح أو إثبات تحصيل الموظفة بنفسها. العملاء محسوبون بالهاتف الصالح وقد يشتركون بين الموظفات. سرعة الإنجاز تحتاج سجل تواريخ المراحل.','Completion = completed ÷ all cases including cancelled. Earned and collected share uses completed, valid-priced cases and the existing finance model; not net profit or proof of who collected. Customers are deduplicated by valid phone and may overlap across staff. Completion speed requires stage timestamps.'))+' '+html(t('عمليات غير مؤرخة: ','Undated cases: ')+scope.undated+' · '+t('تحتاج مراجعة مالية: ','Finance review: ')+scope.review)+'</p>';
 if(el('epTargetMonth'))el('epTargetMonth').onchange=e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)){epTargetMonth=e.target.value;epTargetMessage='';renderEmployeePerformance();}};
 pane.querySelectorAll('[data-ep-save-goal]').forEach(b=>b.onclick=()=>{const id=b.dataset.epSaveGoal,input=[...pane.querySelectorAll('[data-ep-goal]')].find(x=>x.dataset.epGoal===id);if(input)epSaveGoal(id,epTargetMonth,input.value.trim());});
 const bind=()=>{el('epFrom').value=epFrom;el('epTo').value=epTo;};
 el('epMode').onchange=e=>{epMode=e.target.value;if(epMode!=='custom')[epFrom,epTo]=epPeriod(epMode,today,latest);renderEmployeePerformance();};
 for(const id of ['epFrom','epTo'])el(id).onchange=()=>{const from=el('epFrom').value,to=el('epTo').value;if(from&&to&&from>to){el('epStatus').textContent=t('تاريخ البداية يجب أن يسبق النهاية.','Start date must not follow end date.');el('epStatus').className='ep-note ep-error';bind();return;}epMode='custom';epFrom=from;epTo=to;renderEmployeePerformance();};
 el('epEmployee').onchange=e=>{epEmployee=e.target.value;epProfile='';renderEmployeePerformance();};
 el('epRefresh').onclick=async()=>{try{await refresh();}catch(e){toast(t('تعذر تحديث الأداء','Could not refresh performance'));}};
 pane.querySelectorAll('[data-ep-profile]').forEach(b=>b.onclick=()=>{epProfile=b.dataset.epProfile;renderEmployeePerformance();el('epProfile')?.scrollIntoView({block:'nearest',behavior:'smooth'});});
}

window.pawEmployeePerformanceOpen=async function(){
 if(!epAdmin())return;
 epTab='performance';
 if(!el('admin')?.classList.contains('active'))await window.showPage('admin');
 else renderEmployeePerformance();
};

/* TEST Smart Reports — independent management report, no accounting writes. */
let srTab='accounting',srMonth='',srLast=null;
const srAllowed=()=>['admin','accountant'].includes(window.PAWAPP_AUTH?.access?.role);
function srEnd(m){return calShift(calMonthShift(m+'-01',1),-1);}
function srBuild(snap,fin,month,today,goals,employeeGoals){
 const from=month+'-01',end=srEnd(month),to=end<today?end:today;
 const done=new Set(['appointment_completed','payment_completed','closed']);
 const inRange=l=>l.date>=from&&l.date<=to;
 const rows=fin.lines.filter(l=>inRange(l)&&!l.cancelled&&done.has(l.raw?.workflow_status)&&l.total>0n&&!l.issues.some(x=>['invalid_price','price_split_mismatch'].includes(x)));
 const total=F.summarize(rows),stats=epMetrics(snap,fin,from,to,today);
 const goal=goals?(goals.get(month)??10000000n):null,target=goal!==null?monthlyTargetStats(fin.lines,month,today,goal):null;
 const prevMonth=calMonthShift(from,-1).slice(0,7),prevEnd=srEnd(prevMonth),prevTo=to===end?prevEnd:calShift(prevMonth+'-01',Math.min(Number(today.slice(8,10)),Number(prevEnd.slice(8,10)))-1);
 const prior=monthlyTargetStats(fin.lines,prevMonth,prevTo,1n).earned;
 const growth=from<=today&&prior>0n?Number((total.paw-prior)*1000n/prior)/10:null;
 const trend=Array.from({length:6},(_,i)=>{const m=calMonthShift(from,i-5).slice(0,7),x=monthlyTargetStats(fin.lines,m,today,1n);return{month:m,earned:x.earned,collected:x.collected};});
 const providers=new Map((snap.providers||[]).map(p=>[String(p.id),p.name])),prov=new Map(),services=new Map();
 for(const l of rows){const id=l.providerId||'missing';if(!prov.has(id))prov.set(id,{id,name:providers.get(id)||'',cases:new Set(),total:0n,paw:0n,collected:0n});const g=prov.get(id);g.cases.add(l.caseId);g.total+=l.total;g.paw+=l.paw;g.collected+=l.pawCollected;}
 for(const l of fin.lines){if(l.component!=='main'||l.cancelled||!inRange(l))continue;const name=String(l.service||l.raw?.service_name||'').trim(),key=name.toLowerCase();if(!services.has(key))services.set(key,{name,cases:new Set(),completed:0});const g=services.get(key);g.cases.add(l.caseId);if(done.has(l.raw?.workflow_status))g.completed++;}
 const staff=stats.groups.filter(g=>g.id!=='unassigned'||g.total||g.followPending||g.followDone).map(g=>({...g,goal:employeeGoals&&g.id!=='unassigned'?employeeGoals.get(g.id+'|'+month)??null:null}));
 const issues=new Set(fin.lines.filter(l=>inRange(l)&&!l.cancelled&&l.issues.length).map(l=>l.caseId)).size,undated=(snap.cases||[]).filter(c=>!epDate(c.service_date)&&c.workflow_status!=='cancelled').length;
 return{month,from,to,end,prevMonth,prevTo,total,stats:stats.team,goal,target,prior,growth,trend,providers:[...prov.values()].sort((a,b)=>a.paw>b.paw?-1:a.paw<b.paw?1:0),services:[...services.values()].sort((a,b)=>b.cases.size-a.cases.size),staff,issues,undated,unassigned:staff.find(g=>g.id==='unassigned'),excess:total.pawCollected>total.paw,remaining:total.paw>total.pawCollected?total.paw-total.pawCollected:0n,employeeGoalsAvailable:!!employeeGoals};
}
function srTables(r){
 const unit=t('د.ك','DK'),amt=(a,b)=>t(a,b)+' ('+unit+')';
 const staffHead=[t('الموظفة','Employee'),t('العمليات','Cases'),t('المكتملة','Completed'),amt('الحصة','Earned share'),amt('المحصلة','Collected share'),t('متابعات متأخرة','Overdue follow-ups')];
 if(r.employeeGoalsAvailable)staffHead.push(amt('الهدف','Target'),t('نسبة الهدف','Target achievement'));
 const staff=r.staff.map(g=>{const a=[g.name||t('غير معيّن','Unassigned'),g.total,g.completed,g.fee,g.collected,g.followOverdue];if(r.employeeGoalsAvailable)a.push(g.goal,g.goal>0n?epGoalStats(g.fee,g.goal).percent/100:null);return a;});
 return [{name:t('المقارنة الشهرية','Monthly comparison'),header:[t('الشهر','Month'),amt('الحصة المكتسبة','Earned share'),amt('المحصلة','Collected share')],rows:r.trend.map(x=>[x.month,x.earned,x.collected])},
 {name:t('مقدمو الخدمة','Providers'),header:[t('مقدم الخدمة','Provider'),t('عمليات مكتملة','Completed cases'),amt('قيمة الخدمات','Service value'),amt('حصة PawApp','Earned share'),amt('المحصلة','Collected')],rows:r.providers.map(g=>[g.name||t('غير محدد','Unspecified'),g.cases.size,g.total,g.paw,g.collected])},
 {name:t('الخدمات الأكثر طلباً','Most requested services'),header:[t('الخدمة','Service'),t('طلبات غير ملغاة','Non-cancelled cases'),t('المكتملة','Completed')],rows:r.services.map(g=>[g.name||t('غير محددة','Unspecified'),g.cases.size,g.completed])},
 {name:t('أداء الموظفات','Employee performance'),header:staffHead,rows:staff,pctCols:r.employeeGoalsAvailable?[7]:[]}];
}
function srSummary(r){
 return [[t('الفترة من','Period from'),calDate(r.from)],[t('حتى','Through'),calDate(r.to)],[t('إجمالي قيمة الخدمات المكتملة','Completed service value'),r.total.total],[t('حصة PawApp المكتسبة','Earned PawApp share'),r.total.paw],[t('حصة PawApp المحصّلة','Collected PawApp share'),r.total.pawCollected],[t('الحصة المتبقية','Remaining share'),r.remaining],[t('الهدف الشهري','Monthly target'),r.goal],[t('نسبة الهدف','Target achievement'),r.target?r.target.percent/100:null,'pct'],[t('المتبقي للهدف','Target gap'),r.target?.remaining??null],[t('إجمالي العمليات','Cases'),r.stats.total],[t('مكتملة','Completed'),r.stats.completed],[t('قيد التنفيذ','In progress'),r.stats.pending],[t('ملغاة','Cancelled'),r.stats.cancelled],[t('عملاء جدد حسب أول خدمة مسجلة','New recorded customers'),r.stats.fresh.size],[t('عملاء متكررون','Returning customers'),r.stats.returning.size],[t('عمليات بدون هاتف صالح','Cases without valid phone'),r.stats.unknownPhone],[t('النمو مقابل الفترة السابقة المماثلة','Growth vs comparable prior period'),r.growth==null?null:r.growth/100,'pct'],[t('عمليات تحتاج مراجعة مالية','Cases requiring finance review'),r.issues],[t('عمليات غير مؤرخة (كل النظام)','Undated cases (all data)'),r.undated],[t('حصة عمليات غير معيّنة','Unassigned earned share'),r.unassigned?.fee??0n]];
}
function srMethod(){return t('تقرير إداري وليس دفتر تسويات أو صافي ربح. تاريخ الخدمة والحالة الحالية أساس الحساب. الحصة المكتسبة من العمليات المكتملة ذات التسعير الصالح. المحصّل وفق نموذج النظام وقد يشمل سجلات تاريخية وليس إثباتاً بنكياً. العمليات غير المؤرخة مستبعدة من الشهر. قد تتداخل أعداد مقدمي الخدمة بسبب النقل. العملاء حسب الهاتف الموحّد وأول خدمة مسجلة.','Management view, not a settlement ledger or net profit. Service date and current status define the period. Earned share uses completed, valid-priced lines. Collection follows the existing model and may include historical flags, not bank evidence. Undated cases are excluded. Provider counts may overlap due to transport. Customers use normalized phone and earliest recorded service.');}
function srInsights(r){
 const x=[],fmt=cash;
 if(r.growth!==null)x.push(t('تغير الحصة مقارنة بالفترة السابقة المماثلة: ','Share change vs comparable prior period: ')+r.growth.toFixed(1)+'%');
 if(r.target)x.push(r.target.remaining>0n?t('المبلغ اللازم لتحقيق الهدف: ','Remaining to reach goal: ')+fmt(r.target.remaining):t('تم تحقيق الهدف الشهري.','Monthly goal reached.'));
 if(r.remaining>0n)x.push(t('حصة مكتسبة غير محصلة وفق النموذج: ','Earned share not collected per model: ')+fmt(r.remaining));
 if(r.unassigned?.total)x.push(t('عمليات غير معيّنة لموظفة: ','Unassigned cases: ')+r.unassigned.total);
 if(r.issues)x.push(t('عمليات تحتاج مراجعة مالية: ','Cases requiring finance review: ')+r.issues);
 if(r.excess)x.push(t('المحصّل يتجاوز الحصة المكتسبة؛ يلزم مراجعة.','Collected exceeds earned share; review needed.'));
 return x.length?x:[t('لا توجد مؤشرات إضافية.','No additional insights.')];
}
function srDisplay(v,pct=false){return v==null?'—':typeof v==='bigint'?cash(v):pct?(v*100).toFixed(1)+'%':String(v);}
function srReportHtml(r){
 const kpi=(name,v,bg,color)=>'<div class="sr-kpi" style="background:'+bg+';color:'+color+'"><span>'+html(name)+'</span><strong>'+html(srDisplay(v))+'</strong></div>';
 const block=(name,b)=>'<section class="sr-block"><h2>'+html(name)+'</h2>'+b+'</section>';
 const item=(name,v,p)=>'<div class="sr-item"><span>'+html(name)+'</span><b>'+html(srDisplay(v,p))+'</b></div>';
 const max=r.trend.reduce((m,x)=>x.earned>m?x.earned:m,1n);
 const chart='<div class="sr-chart">'+r.trend.map(x=>'<div class="sr-col"><span>'+html(F.format(x.earned))+'</span><div class="sr-barbox"><div class="sr-bar" style="height:'+Math.max(0,Number(x.earned*100n/max))+'%"></div></div><small>'+html(x.month)+'</small></div>').join('')+'</div>';
 const tables=srTables(r).slice(1).map(x=>block(x.name,'<div class="sr-scroll"><table><thead><tr>'+x.header.map(y=>'<th>'+html(y)+'</th>').join('')+'</tr></thead><tbody>'+x.rows.map(row=>'<tr>'+row.map((v,i)=>'<td>'+html(srDisplay(v,x.pctCols?.includes(i)))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>')).join('');
 const summary=srSummary(r);
 return '<div class="sr-title"><h1>PawApp | '+html(t('التقرير التنفيذي الذكي','Executive Smart Report'))+'</h1><p>'+html(t('TEST · تاريخ الخدمة · توقيت الكويت','TEST · service date · Kuwait time')+' · '+calDate(r.from)+' – '+calDate(r.to))+'</p></div>'+
 '<div class="sr-grid">'+kpi(summary[2][0],r.total.total,'#edf2ff','#244b9b')+kpi(summary[3][0],r.total.paw,'#e8f6ed','#198249')+kpi(summary[4][0],r.total.pawCollected,'#f0eafa','#7951af')+kpi(summary[5][0],r.remaining,'#fff5dc','#9a7317')+'</div>'+
 block(t('الهدف الشهري','Monthly goal'),r.target?'<div class="sr-target"><strong>'+html(r.target.percent.toFixed(1)+'%')+'</strong><span>'+html(cash(r.total.paw)+' / '+cash(r.goal))+'</span></div><div class="sr-track"><div style="width:'+Math.min(100,Math.max(0,r.target.percent))+'%"></div></div>'+item(t('المتبقي للهدف','Target gap'),r.target.remaining):html(t('تعذر تحميل الهدف الشهري','Monthly goal unavailable')))+
 block(t('مقارنة الأشهر الستة — الحصة المكتسبة','Six-month comparison — earned share'),chart+'<p class="sr-note">'+html(t('الشهر الجاري حتى اليوم؛ النمو يقارن نفس عدد الأيام من الشهر السابق عندما يكون الشهر غير مكتمل.','Current month through today; growth compares matching elapsed days when the month is incomplete.'))+'</p>')+
 '<div class="sr-two">'+block(t('ملخص العمليات والعملاء','Operations & customers'),summary.slice(9,17).map(x=>item(x[0],x[1],x[2]==='pct')).join(''))+block(t('ملاحظات ذكية','Smart insights'),'<ul class="sr-insights">'+srInsights(r).map(x=>'<li>'+html(x)+'</li>').join('')+'</ul>')+'</div>'+
 tables+(!r.employeeGoalsAvailable?'<p class="sr-note">'+html(t('الأهداف الفردية متاحة للإدارة فقط؛ المحاسب يرى أداء الموظفات والحصص.','Individual targets are admin-only; the accountant sees employee performance and shares.'))+'</p>':'')+
 '<p class="sr-note">'+html(srMethod()+' '+t('عمليات غير مؤرخة (كل النظام): ','Undated cases (all data): ')+r.undated)+'</p>';
}
const srCss='.sr-tabs,.sr-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0}.sr-btn{padding:10px 14px;border-radius:10px;border:1px solid #dce5f2;background:#fff;color:#17396d;font:inherit;font-weight:700;cursor:pointer}.sr-btn.active{background:#17396d;color:white;border-color:#17396d}.sr-title h1{color:#15396f;margin:10px 0 4px;font-size:23px}.sr-title p,.sr-note{font-size:12px;line-height:1.7;color:#53667e}.sr-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.sr-kpi{padding:14px;border-radius:12px;min-width:0;overflow-wrap:anywhere}.sr-kpi span{display:block;font-size:12px}.sr-kpi strong{display:block;font-size:clamp(17px,2.5vw,26px);margin-top:7px}.sr-block{border:1px solid #e0e7f0;background:white;border-radius:14px;padding:14px;margin:12px 0;min-width:0}.sr-block h2{font-size:16px;color:#15396f;margin:0 0 10px}.sr-target,.sr-item{display:flex;justify-content:space-between;align-items:center;gap:12px}.sr-target strong{font-size:25px;color:#198249}.sr-track{height:10px;border-radius:12px;background:#e9eef4;overflow:hidden;margin:10px 0}.sr-track div{height:100%;background:#26a469;border-radius:12px}.sr-chart{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;direction:ltr;text-align:center}.sr-col{min-width:0;font-size:10px;overflow-wrap:anywhere}.sr-barbox{height:110px;display:flex;align-items:flex-end;justify-content:center;background:#f4f7fc;border-radius:6px;margin:4px 0}.sr-bar{width:65%;background:#3159a5;border-radius:5px 5px 0 0}.sr-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.sr-item{padding:7px 0;border-bottom:1px solid #edf0f5;font-size:13px}.sr-insights{padding-inline-start:20px;font-size:13px;line-height:1.7}.sr-insights li{margin:8px 0}.sr-scroll{overflow-x:auto}.sr-scroll table{width:100%;border-collapse:collapse;min-width:480px}.sr-scroll td,.sr-scroll th{padding:8px;border-bottom:1px solid #e5ebf3;font-size:12px;text-align:start;white-space:nowrap}.sr-scroll th{color:#53667e;background:#f4f7fb}#reports.sr-show> :not(#pawSmartTabs):not(#pawSmartReport){display:none!important}#pawSmartReport[hidden],#pawSmartTabs[hidden]{display:none!important}@media(max-width:780px){.sr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sr-two{grid-template-columns:1fr}.sr-block{padding:10px}.sr-kpi{padding:10px}}';
function srInstall(){
 const host=el('reports');if(!host)return;
 if(!el('pawSmartTabs')){const tabs=document.createElement('div');tabs.id='pawSmartTabs';tabs.className='sr-tabs';host.prepend(tabs);}
 if(!el('pawSmartReport')){const pane=document.createElement('section');pane.id='pawSmartReport';pane.hidden=true;el('pawSmartTabs').after(pane);}
 if(!el('pawSmartStyle')){const style=document.createElement('style');style.id='pawSmartStyle';style.textContent=srCss;document.head.appendChild(style);}
}
function srExportData(r){
 const conv=v=>v==null?'':typeof v==='bigint'?Number(F.format(v)):v;
 const rows=srSummary(r),summary={name:t('الملخص','Summary'),rows:[[t('المؤشر','Metric'),t('القيمة (د.ك للمبالغ)','Value (DK for amounts)')],...rows.map(x=>[x[0],conv(x[1])]),[t('المنهجية','Method'),srMethod()]],pctCells:rows.flatMap((x,i)=>x[2]==='pct'?[{r:i+1,c:1}]:[])};
 const tables=srTables(r).map(x=>({name:x.name,rows:[x.header,...x.rows.map(row=>row.map(conv))],pctCells:x.rows.flatMap((row,i)=>(x.pctCols||[]).map(c=>({r:i+1,c})))}));
 return [summary,...tables];
}
function srExportExcel(){
 if(!srAllowed()||!srLast)return;
 if(!window.XLSX){toast(t('مكتبة Excel غير متاحة.','Excel library unavailable.'));return;}
 const X=window.XLSX,wb=X.utils.book_new();
 for(const sheet of srExportData(srLast)){const ws=X.utils.aoa_to_sheet(sheet.rows);for(const c of sheet.pctCells){const key=X.utils.encode_cell(c);if(ws[key]?.t==='n')ws[key].z='0.0%';}ws['!cols']=sheet.rows[0].map((_,i)=>({wch:i===0?40:22}));X.utils.book_append_sheet(wb,ws,sheet.name.slice(0,31));}
 X.writeFile(wb,'PawApp-Executive-TEST-'+srLast.month+'.xlsx');
}
function srPrint(){
 if(!srAllowed()||!srLast)return;
 const w=window.open('','_blank');if(!w){toast(t('اسمحي بفتح نافذة الطباعة.','Allow the print window to open.'));return;}
 const lang=window.PawI18n?.language==='en'?'en':'ar';
 w.document.open();w.document.write('<!doctype html><html lang="'+lang+'" dir="'+(lang==='en'?'ltr':'rtl')+'"><head><meta charset="utf-8"><title>PawApp Executive TEST '+html(srLast.month)+'</title><style>'+srCss+' body{font:13px Arial,sans-serif;color:#17345e;margin:16px} .sr-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.sr-scroll{overflow:visible}.sr-scroll table{min-width:0}.sr-scroll td,.sr-scroll th{white-space:normal}.sr-block{break-inside:auto}.sr-kpi,tr,.sr-chart{break-inside:avoid} @page{size:A4;margin:12mm}@media print{body{margin:0}.sr-print-button{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><button class="sr-btn sr-print-button" onclick="window.print()">'+html(t('طباعة / حفظ PDF','Print / Save as PDF'))+'</button>'+srReportHtml(srLast)+'</body></html>');w.document.close();w.focus();
}
function renderSmartReports(){
 srInstall();const host=el('reports'),tabs=el('pawSmartTabs'),pane=el('pawSmartReport');if(!host||!tabs||!pane)return;
 if(!srAllowed()){tabs.hidden=true;pane.hidden=true;pane.replaceChildren();host.classList.remove('sr-show');srLast=null;srTab='accounting';return;}
 tabs.hidden=false;tabs.innerHTML='<button type="button" data-sr-tab="accounting" class="sr-btn '+(srTab==='accounting'?'active':'')+'">'+html(t('تقرير المحاسب','Accountant report'))+'</button><button type="button" data-sr-tab="smart" class="sr-btn '+(srTab==='smart'?'active':'')+'">'+html(t('التقارير الذكية','Smart Reports'))+'</button>';
 tabs.querySelectorAll('[data-sr-tab]').forEach(b=>b.onclick=()=>{srTab=b.dataset.srTab;renderSmartReports();});
 host.classList.toggle('sr-show',srTab==='smart');pane.hidden=srTab!=='smart';
 if(pane.hidden||!host.classList.contains('active')||!snapshot||!model){pane.replaceChildren();srLast=null;return;}
 const today=localDate();
 if(!srMonth){const dates=(snapshot.cases||[]).map(c=>epDate(c.service_date)).filter(d=>d&&d<=today).sort();srMonth=dates.some(d=>d.slice(0,7)===today.slice(0,7))?today.slice(0,7):(dates.at(-1)||today).slice(0,7);}
 srLast=srBuild(snapshot,model,srMonth,today,targetError?null:targetRows,epAdmin()?epTargetRows:null);
 pane.innerHTML='<div class="sr-controls"><label>'+html(t('الشهر','Month'))+' <input id="srMonth" type="month" min="2000-01" max="'+today.slice(0,7)+'" value="'+html(srMonth)+'"></label><button id="srRefresh" type="button" class="sr-btn">'+html(t('تحديث','Refresh'))+'</button><button id="srExcel" type="button" class="sr-btn active">'+html(t('تصدير Excel','Export Excel'))+'</button><button id="srPdf" type="button" class="sr-btn">'+html(t('طباعة / حفظ PDF','Print / Save PDF'))+'</button></div>'+srReportHtml(srLast);
 el('srMonth').onchange=e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)&&e.target.value<=today.slice(0,7)){srMonth=e.target.value;renderSmartReports();}else e.target.value=srMonth;};
 el('srRefresh').onclick=async()=>{try{await refresh();}catch(e){toast(t('تعذر تحديث التقرير','Unable to refresh report'));}};
 el('srExcel').onclick=srExportExcel;el('srPdf').onclick=srPrint;
}

function render(){if(!snapshot)return;hydrate();renderDashboard();renderProviders();renderProvider();renderCases();renderFollowups();try{renderCalendar();}catch(e){console.warn('Calendar rendering unavailable',e);}try{renderEmployeePerformance();}catch(e){console.warn('Employee performance unavailable',e);}try{renderSmartReports();}catch(e){console.warn('Smart reports unavailable',e);}if(el('crm')?.classList.contains('active')&&typeof window.renderCRM==='function')window.renderCRM();try{window.PawMarketingRender?.(snapshot,model);}catch(e){console.warn('Marketing render unavailable',e);}}
function dialog(){if(el('financeActionModal'))return;document.body.insertAdjacentHTML('beforeend','<div id="financeActionModal" class="modalBg"><div class="modal"><div class="modalHead"><h3 id="financeActionTitle"></h3><button class="close" onclick="closeModal(\'financeActionModal\')">×</button></div><div id="financeActionBody"></div><div id="financeActionError" class="hint" style="color:#b42318;margin:10px 0" role="alert"></div><button id="financeActionSave" class="btn primary" style="width:100%" onclick="pawFinanceSaveAction()"><!--paw-i18n-->حفظ وتحديث الحسابات</button></div></div>');}
// Form intake is a separate, deliberately minimal flow: do not resubmit
// the entire case and accidentally overwrite information from customer forms.
let intakeId=null,intakeBusy=false,intakeRequestId=null;
const intakeCases=new Set(['booking_form','booking_form_test','pet_information_form']);
const intakeCase=()=>snapshot?.cases.find(c=>String(c.id)===String(intakeId));
function intakeInput(id){return el('pawIntake'+id);}
function intakeVal(id){return String(intakeInput(id)?.value??'').trim();}
function intakeMissing(c){
 if(c.source==='pet_information_form'&&c.client_paid===true&&c.client_paid_to==='pawapp'&&Number(c.total_amount||0)>0){
   // Payment is confirmed: intake is over. Incomplete provider/service data
   // remains visible in settlement review, never silently treated as settled.
   return [];
 }
 const service=(snapshot?.services||[]).find(s=>String(s.provider_id)===String(c.provider_id)&&String(s.id)===String(c.service_id)&&s.name===c.service_name);
 const isPetInfo=c.source==='pet_information_form';
 // Appointment staff work under the existing shared Firebase login. A CRM
 // employee assignment is not required to close Pet Information intake.
 // Do not confuse customer payment closure with partner settlement.
 return [
   !isPetInfo&&!c.employee_id?'الموظف المسؤول':null,
   !c.provider_id?'الشركة / الفريلانسر':null,
   !service?'الخدمة الفعلية':null,
   Number(c.total_amount||0)<=0?'السعر والعمولة':null,
   isPetInfo&&Number(c.total_amount||0)>0&&(!c.client_paid||c.client_paid_to!=='pawapp')?'تأكيد وصول الدفع إلى PawApp من لوحة المواعيد':null
 ].filter(Boolean);
}
function ensureIntakeModal(){
 if(el('pawQuickIntakeModal'))return;
 const m=document.createElement('div');m.id='pawQuickIntakeModal';m.className='modalBg';
 m.innerHTML='<div class="modal" style="max-height:88vh;overflow-y:auto;overscroll-behavior:contain">'+
 '<div class="modalHead"><h3>استكمال الطلب — البيانات الناقصة فقط</h3><button class="close" type="button" onclick="closeModal(\'pawQuickIntakeModal\')">×</button></div>'+
 '<div id="pawIntakeSummary" class="card" style="box-shadow:none;margin-bottom:12px"></div>'+
 '<div id="pawIntakeMissing" class="hint" style="margin:8px 0"></div>'+
 '<div class="grid2">'+
 '<div class="field"><label><!--paw-i18n-->الموظف المسؤول</label><select id="pawIntakeEmployee"></select></div>'+
 '<div class="field"><label><!--paw-i18n-->الشركة / الفريلانسر</label><select id="pawIntakeProvider" onchange="pawIntakeProviderChanged()"></select></div>'+
 '<div class="field full"><label>الخدمة الفعلية لدى الشركة</label><select id="pawIntakeService" onchange="pawIntakeServiceChanged()"></select><div id="pawIntakeServiceHint" class="hint"></div><input id="pawIntakeNewService" placeholder="اسم الخدمة الجديدة" style="display:none;margin-top:8px"></div>'+
 '<div class="field"><label>إجمالي سعر الخدمة على العميل (د.ك)</label><input id="pawIntakePrice" type="number" min="0.001" step="0.001" inputmode="decimal" oninput="pawIntakeRecalculate()"></div>'+
 '<div class="field"><label><!--paw-i18n-->طريقة حصة PawApp</label><select id="pawIntakeFeeType" onchange="pawIntakeRecalculate()"><option value="percent"><!--paw-i18n-->نسبة %</option><option value="fixed">مبلغ ثابت من الإجمالي</option></select></div>'+
 '<div class="field"><label id="pawIntakeFeeLabel"><!--paw-i18n-->نسبة PawApp %</label><input id="pawIntakeFee" type="number" min="0" step="0.001" inputmode="decimal" oninput="pawIntakeRecalculate()"></div>'+
 '<div class="field full"><div id="pawIntakeQuote" class="hint"></div></div>'+
 '<div class="field"><label><!--paw-i18n-->العميل دفع؟</label><select id="pawIntakePaid" onchange="pawIntakePaidChanged()"><option value="no">لا، لم يدفع</option><option value="yes">نعم، دفع كامل المبلغ</option></select></div>'+
 '<div class="field" id="pawIntakeAmountWrap" style="display:none"><label>المبلغ اللي دفعه العميل (د.ك)</label><input id="pawIntakePaidAmount" type="number" min="0.001" step="0.001" inputmode="decimal"></div>'+
 '<div class="field" id="pawIntakeRecipientWrap" style="display:none"><label><!--paw-i18n-->العميل دفع لمن؟</label><select id="pawIntakeRecipient"><option value=""><!--paw-i18n-->اختاري جهة الاستلام</option><option value="pawapp">PawApp</option><option value="provider">الشركة / الفريلانسر مباشرة</option></select></div>'+
 '<div class="field" id="pawIntakeMethodWrap" style="display:none"><label><!--paw-i18n-->طريقة الدفع</label><select id="pawIntakeMethod"><option>KNET</option><option value="رابط دفع"><!--paw-i18n-->رابط دفع</option><option value="كاش"><!--paw-i18n-->كاش</option><option value="تحويل بنكي"><!--paw-i18n-->تحويل بنكي</option><option>دفع للعيادة مباشرة</option></select></div>'+
 '<div class="field" id="pawIntakeDueWrap"><label>موعد متابعة الدفع (اختياري)</label><input id="pawIntakeDueDate" type="date"></div>'+
 '</div><div id="pawIntakeError" role="alert" style="color:#a4262c;margin:10px 0"></div>'+
 '<button id="pawIntakeSaveBtn" type="button" class="btn primary" style="width:100%;margin-top:12px" onclick="pawIntakeSave()">حفظ البيانات الناقصة وتحديث الحسابات</button>'+
 '<button type="button" class="btn soft" style="width:100%;margin-top:8px" onclick="pawIntakeShowFullCase()">عرض باقي بيانات الحالة</button></div>';
 document.body.appendChild(m);
}
function intakeOptions(list,selected){
 const s=selected==null?'':String(selected);
 return list.map(([value,label])=>'<option value="'+html(value)+'"'+(String(value)===s?' selected':'')+'>'+html(label)+'</option>').join('');
}
window.pawIntakeProviderChanged=function(){
 const c=intakeCase(),p=(snapshot?.providers||[]).find(x=>String(x.id)===intakeVal('Provider'));
 const services=(snapshot?.services||[]).filter(x=>String(x.provider_id)===String(p?.id));
 const previous=intakeVal('Service');
 const desired=c&&String(c.provider_id)===String(p?.id)?(services.find(s=>s.name===c.service_name)?.id||''):previous;
 intakeInput('Service').innerHTML=intakeOptions([['','اختاري الخدمة'],...services.map(s=>[s.id,s.name]),['__new__','+ إضافة خدمة جديدة لهذه الشركة']],desired);
 if(desired&&!services.some(s=>String(s.id)===desired))intakeInput('Service').value='';
 intakeInput('Service').disabled=!p;
 intakeInput('ServiceHint').textContent=!p?'اختاري الشركة أولاً حتى تظهر خدماتها':!services.length?'لا توجد خدمات للشركة حالياً؛ اختاري إضافة خدمة جديدة.':'اختاري من خدمات الشركة المسجلة';
 if(p && (String(c?.provider_id)!==String(p.id)||(Number(c?.total_amount||0)<=0&&Number(c?.fee_value||0)===0))){
   intakeInput('FeeType').value=p.default_fee_type||'percent';
   intakeInput('Fee').value=String(p.default_fee_value||0);
 }
 window.pawIntakeServiceChanged();
 window.pawIntakeRecalculate();
};
window.pawIntakeServiceChanged=function(){
 intakeInput('NewService').style.display=intakeVal('Service')==='__new__'?'':'none';
};
window.pawIntakeRecalculate=function(){
 try{
   const quote=F.quote(intakeVal('Price')||'0',intakeVal('FeeType')||'percent',intakeVal('Fee')||'0');
   intakeInput('Quote').textContent='حصة PawApp: '+F.format(quote.paw)+' د.ك | مستحق الشركة: '+F.format(quote.provider)+' د.ك';
   intakeInput('FeeLabel').textContent=intakeVal('FeeType')==='fixed'?'حصة PawApp (د.ك)':'نسبة PawApp %';
   if(intakeVal('Paid')==='yes' && !intakeInput('PaidAmount').dataset.edited)intakeInput('PaidAmount').value=F.format(quote.total);
   intakeInput('Error').textContent='';
 }catch(e){
   intakeInput('Quote').textContent='راجعي السعر والعمولة';
   intakeInput('Error').textContent=String(e?.message||e);
 }
};
window.pawIntakePaidChanged=function(){
 const paid=intakeVal('Paid')==='yes';
 for(const id of ['AmountWrap','RecipientWrap','MethodWrap'])intakeInput(id).style.display=paid?'':'none';
 intakeInput('DueWrap').style.display=paid?'none':'';
 if(paid)window.pawIntakeRecalculate();
};
window.pawIntakeShowFullCase=function(){
 const id=intakeId;closeModal('pawQuickIntakeModal');if(id!=null)window.openCaseDetails(id);
};
window.pawBookingReview=function(id){
 if(!mayWrite())return alert('هذه العملية تتطلب صلاحية التعديل');
 const c=snapshot?.cases.find(x=>String(x.id)===String(id));
 if(!c)return alert('لم يتم العثور على الحالة. حدّثي الصفحة.');
 if(!intakeCases.has(c.source)){window.openCaseDetails(id);return;}
 intakeId=String(id);intakeRequestId=crypto.randomUUID();ensureIntakeModal();
 const details=c.intake_details||{},requested=(details.requested_services||[]);
 intakeInput('Summary').innerHTML='<b>'+html(c.client_name||'العميل')+' — '+caseCode(c.id)+'</b>'+
 '<div class="hint">'+html(c.client_phone||'')+' • '+html(typeof sourceLabel==='function'?sourceLabel(c.source):c.source)+'</div>'+
 '<div class="hint">الطلب من العميل: '+html(c.requested_service||'غير محدد')+'</div>'+
 (requested.length?'<div class="hint">الخدمات المختارة: '+html(requested.join('، '))+'</div>':'');
 intakeInput('Missing').textContent='المطلوب استكماله: '+(intakeMissing(c).join('، ')||'تأكيد البيانات المالية فقط');
 intakeInput('Employee').innerHTML=intakeOptions([['','اختاري الموظف'],...(snapshot.employees||[]).map(e=>[e.id,e.name])],c.employee_id||window.PAWAPP_AUTH?.access?.employee_id||'');
 intakeInput('Provider').innerHTML=intakeOptions([['','اختاري الشركة / الفريلانسر'],...(snapshot.providers||[]).map(p=>[p.id,p.name])],c.provider_id||'');
 intakeInput('Price').value=Number(c.total_amount||0)>0?F.format(F.minor(c.total_amount)):'';
 intakeInput('FeeType').value=c.fee_type||'percent';
 intakeInput('Fee').value=String(c.fee_value||0);
 intakeInput('Paid').value=c.client_paid?'yes':'no';
 intakeInput('PaidAmount').value=c.client_paid?F.format(F.minor(c.total_amount||0)):'';
 delete intakeInput('PaidAmount').dataset.edited;
 intakeInput('PaidAmount').oninput=()=>{intakeInput('PaidAmount').dataset.edited='1'};
 intakeInput('Recipient').value=c.client_paid_to||'';
 intakeInput('Method').value=c.payment_method||'KNET';
 intakeInput('DueDate').value=c.client_due_date||'';
 intakeInput('Error').textContent='';
 window.pawIntakeProviderChanged();
 window.pawIntakePaidChanged();
 el('pawQuickIntakeModal').classList.add('show');
};
window.pawIntakeSave=async function(){
 if(intakeBusy||!mayWrite())return;
 const c=intakeCase();if(!c)return;
 const error=intakeInput('Error'),btn=intakeInput('SaveBtn');
 try{
  const provider=intakeVal('Provider'),serviceChoice=intakeVal('Service'),employee=intakeVal('Employee');
  if(!employee||!provider||!serviceChoice)throw Error('اختاري الموظف والشركة والخدمة أولاً.');
  const q=F.quote(intakeVal('Price'),intakeVal('FeeType'),intakeVal('Fee')||'0');
  if(q.total<=0n)throw Error('أدخلي سعر الخدمة أكبر من صفر.');
  const paid=intakeVal('Paid')==='yes',recipient=intakeVal('Recipient');
  if(paid&&!recipient)throw Error('اختاري العميل دفع لمن: PawApp أو الشركة.');
  if(paid && F.minor(intakeVal('PaidAmount'))!==q.total)throw Error('المبلغ المدفوع لازم يساوي إجمالي الخدمة عند اختيار سداد كامل. لا تسجلي دفعة جزئية كأنها مدفوعة بالكامل.');
  if(c.client_paid&&!paid)throw Error('لا يمكن تغيير دفعة عميل مسجلة إلى غير مدفوع.');
  if(serviceChoice==='__new__'&&!intakeVal('NewService'))throw Error('اكتبي اسم الخدمة الجديدة.');
  intakeBusy=true;btn.disabled=true;btn.textContent='جاري حفظ البيانات...';error.textContent='';
  let service=(snapshot.services||[]).find(s=>String(s.id)===serviceChoice);
  if(serviceChoice==='__new__'){
    const name=intakeVal('NewService');
    // Query the current catalog, not only the cached snapshot: a previous
    // interrupted save may already have added this service.
    const catalog=await window.PAWAPP_AUTH.client.from('test_services').select('id,name,provider_id').eq('provider_id',provider);
    if(catalog.error)throw Error('تعذر تحميل خدمات الشركة: '+catalog.error.message);
    service=(catalog.data||[]).find(s=>String(s.name).trim().toLowerCase()===name.toLowerCase());
    if(!service){
      const saved=await window.PAWAPP_AUTH.client.from('test_services').insert({provider_id:provider,name}).select('id,name,provider_id').single();
      if(saved.error)throw Error('تعذر إضافة الخدمة إلى كتالوج الشركة: '+saved.error.message);
      service=saved.data;
    }
  }
  if(!service||String(service.provider_id)!==provider)throw Error('الخدمة لا تتبع الشركة المختارة. أعيدي الاختيار.');
  const patch={provider_id:provider,service_id:service.id,service_name:service.name,employee_id:employee,
    total_amount:F.format(q.total),fee_type:intakeVal('FeeType'),fee_value:intakeVal('Fee')||'0',
    client_due_date:paid?null:(intakeVal('DueDate')||null)};
  if(paid)patch.payment_method=intakeVal('Method')||'KNET';
  const payments={main:{paid,recipient:paid?recipient:null}};
  const {error:rpcError}=await window.PAWAPP_AUTH.client.rpc('test_finance_save',{
    p_request_id:intakeRequestId,p_case_id:Number(intakeId),p_patch:patch,p_payments:payments,p_revision:c.finance_revision||0});
  if(rpcError)throw rpcError;
  closeModal('pawQuickIntakeModal');
  await refresh();
  intakeId=null;intakeRequestId=null;
  toast('تم تحديث الخدمة والسعر والحسابات ✓');
 }catch(e){error.textContent=message(e);}
 finally{intakeBusy=false;btn.disabled=false;btn.textContent='حفظ البيانات الناقصة وتحديث الحسابات';}
};
window.pawFinanceOpen=function(caseId,component='main'){if(saving)return;const l=findLine(caseId,component);if(!l)return;if(!mayActOnLine(l)){alert('مشاهدة فقط');return}dialog();activeAction={caseId:String(caseId),component,revision:l.revision,requestId:crypto.randomUUID(),line:l};set('financeActionTitle',actionLabel(l));set('financeActionError','');let body='<div class="card" style="box-shadow:none"><b>'+html(detail(l))+'</b><div class="hint">'+caseCode(caseId)+' • '+html(providerName(l.providerId))+' • ' +t(component==='transport'?'النقل':'الخدمة')+'</div></div>';const reviewOnly=!l.action;el('financeActionSave').style.display=reviewOnly?'none':'';if(l.unknown)body+='<div class="field"><label><!--paw-i18n-->هل العميل دفع قيمة النقل؟</label><select id="finConfirmPaid"><option value=""><!--paw-i18n-->اختاري</option><option value="yes"><!--paw-i18n-->نعم، تم استلامه</option><option value="no"><!--paw-i18n-->لا، لم يدفع النقل</option></select></div>';
if(l.action==='client_paid'||l.unknown)body+='<div class="field"><label><!--paw-i18n-->جهة استلام دفعة العميل</label><select id="finRecipient" onchange="pawFinanceTransportRouteChanged()"><option value=""><!--paw-i18n-->اختاري جهة الاستلام</option><option value="pawapp">PawApp</option><option value="provider">'+html(providerName(l.providerId))+' مباشرة</option></select></div>';
if(l.component==='main'&&l.action==='client_paid'&&!l.isPaid&&l.unpaid>0n){
 body+='<div class="card" style="box-shadow:none"><div>'+html(t('إجمالي الخدمة','Service total'))+': <b>'+cash(l.total)+'</b></div><div>'+html(t('المدفوع سابقاً','Previously paid'))+': <b>'+cash(l.paid)+'</b></div><div>'+html(t('المتبقي','Outstanding'))+': <b>'+cash(l.unpaid)+'</b></div></div>'+
 '<div class="field"><label>'+html(t('طريقة السداد','Payment option'))+'</label><select id="finClientMode" onchange="pawClientPaymentPreview()"><option value="full">'+html(t('دفع كامل المتبقي','Pay full balance'))+'</option><option value="partial">'+html(t('دفعة جزئية','Partial payment'))+'</option></select></div>'+
 '<div id="finPartialFields" style="display:none"><div class="field"><label>'+html(t('المبلغ المستلم الآن','Amount received now'))+'</label><input id="finClientAmount" type="number" min="0.001" step="0.001" max="'+F.format(l.unpaid)+'" oninput="pawClientPaymentPreview()"></div><div class="field"><label>'+html(t('تاريخ الدفعة القادمة / التذكير','Next payment / reminder date'))+'</label><input id="finNextDue" type="date" min="'+localDate()+'" value="'+html(l.raw?.client_due_date>=localDate()?l.raw.client_due_date:'')+'"></div><p class="hint" id="finRemainingPreview"></p></div>';
}
if(l.component==='transport'&&(l.action==='client_paid'||l.unknown))body+='<div id="finTransportCloseout" class="field" style="display:none"><label id="finTransportCloseoutLabel"><!--paw-i18n-->إغلاق تسوية النقل بنفس الحفظ؟</label><select id="finTransportCloseoutValue"><option value="no"><!--paw-i18n-->لا، خلّها بالمتابعة</option><option value="yes"><!--paw-i18n-->نعم، تمت التسوية</option></select><div class="hint" id="finTransportCloseoutHint"><!--paw-i18n-->إذا اخترتي نعم، يسجل النظام الطرف الثاني تلقائيًا بنفس عملية الحفظ.</div></div>';
if(l.action==='provider_paid'||l.action==='commission_received')body+='<div class="field"><label><!--paw-i18n-->المبلغ المستلم / المحوّل (د.ك)</label><input id="finAmount" type="number" min="0.001" step="0.001" value="'+F.format(l.action==='provider_paid'?l.theirs:l.ours)+'"></div>';
if(!reviewOnly)body+='<div class="grid2"><div class="field"><label><!--paw-i18n-->تاريخ السداد الفعلي (أو تاريخ توثيق تسوية سابقة)</label><input id="finDate" type="date" value="'+localDate()+'"></div><div class="field"><label><!--paw-i18n-->طريقة الدفع</label><select id="finMethod"><option value=""><!--paw-i18n-->اختاري طريقة التسوية</option><option>KNET</option><option value="تحويل بنكي"><!--paw-i18n-->تحويل بنكي</option><option value="كاش"><!--paw-i18n-->كاش</option><option value="رابط دفع"><!--paw-i18n-->رابط دفع</option><option value="تسوية سابقة - تأكيد المحاسب"><!--paw-i18n-->تسوية سابقة - تأكيد المحاسب</option></select></div></div><div class="field"><label><!--paw-i18n-->رقم المرجع / التحويل (اختياري)</label><input id="finReference" placeholder="اتركيه فارغاً إذا ما عندج رقم" data-paw-i18n-attrs="placeholder"></div><p class="hint"><!--paw-i18n-->بدون رقم مرجع خارجي، نسجّل اعتماداً داخلياً مع حساب الموظف. للتسويات السابقة اختاري «تسوية سابقة - تأكيد المحاسب».</p>';
if(l.issues.length&&!l.unknown)body+='<div class="hint">'+html(review(l))+'</div>';if(reviewOnly)body+='<p><!--paw-i18n-->لا تسجلي دفعة إضافية لإخفاء الملاحظة. نراجع التسجيلات المتعارضة أولًا بدون حذفها.</p>';el('financeActionBody').innerHTML=body;
if(l.route&&['pawapp','provider'].includes(l.route)&&el('finRecipient')){el('finRecipient').value=l.route;if(l.paid>0n)el('finRecipient').disabled=true;}
el('financeActionModal').classList.add('show');};
window.pawClientPaymentPreview=function(){
 const l=activeAction?.line,wrap=el('finPartialFields');if(!l||!wrap)return;
 const partial=v('finClientMode')==='partial';wrap.style.display=partial?'block':'none';
 if(!partial)return;
 try{const a=F.minor(v('finClientAmount'));set('finRemainingPreview',a>0n&&a<l.unpaid?t('المتبقي بعد الدفعة: ','Balance after payment: ')+cash(l.unpaid-a):t('أدخلي مبلغاً أقل من كامل المتبقي.','Enter an amount below the full balance.'));}catch(e){set('finRemainingPreview',t('أدخلي مبلغاً صحيحاً.','Enter a valid amount.'));}
};
function localInput(value){const stamp=calStamp(value);return stamp&&stamp.time?stamp.day+'T'+stamp.time:'';}
function localDate(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuwait',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-')}
window.pawFinanceTransportRouteChanged=function(){if(!activeAction||activeAction.component!=='transport')return;const wrap=el('finTransportCloseout'),label=el('finTransportCloseoutLabel'),hint=el('finTransportCloseoutHint'),recipient=v('finRecipient');if(!wrap)return;wrap.style.display=recipient?'block':'none';if(recipient==='pawapp'){if(label)label.textContent='هل تم دفع مستحق شركة النقل أيضًا؟';if(hint)hint.textContent='نعم = يسجل دفع حصة شركة النقل تلقائيًا بنفس الحفظ. لا = تبقى كمستحق بالمتابعة.';}else if(recipient==='provider'){if(label)label.textContent='هل تم تحصيل حصة PawApp من شركة النقل أيضًا؟';if(hint)hint.textContent='نعم = يسجل تحصيل حصة PawApp تلقائيًا بنفس الحفظ. لا = تبقى كتحصيل مطلوب بالمتابعة.';}};
window.pawFinanceSaveAction=async function(){if(saving||!activeAction||!mayActOnLine(activeAction.line))return;const a=activeAction,l=a.line;let action=l.action;try{if(l.unknown){if(!v('finConfirmPaid'))throw Error('اختاري هل النقل مدفوع.');action=v('finConfirmPaid')==='no'?'confirm_transport_unpaid':'client_paid';}const data={date:v('finDate')||localDate(),method:v('finMethod'),reference:v('finReference')};if(action==='client_paid'){if(!v('finRecipient'))throw Error('اختاري جهة استلام دفعة العميل.');data.recipient=v('finRecipient');
if(l.component==='main'&&!l.isPaid&&l.unpaid>0n){
 if(!data.method)throw Error(t('اختاري طريقة الدفع.','Choose payment method.'));
 if(v('finClientMode')==='partial'){
  const amount=F.minor(v('finClientAmount'));if(amount<=0n||amount>=l.unpaid)throw Error(t('أدخلي مبلغاً أكبر من صفر وأقل من المتبقي.','Enter an amount greater than zero and below the outstanding balance.'));
  if(!v('finNextDue')||v('finNextDue')<localDate())throw Error(t('حددي تاريخ الدفعة القادمة.','Choose the next payment date.'));
  data.amount=F.format(amount);data.next_due_date=v('finNextDue');
 }else data.amount=F.format(l.unpaid);
}
}if(['provider_paid','commission_received'].includes(action)){data.amount=F.format(F.minor(v('finAmount')));if(F.minor(data.amount)<=0n)throw Error('أدخلي مبلغًا أكبر من صفر.');}const closeTransport=l.component==='transport'&&action==='client_paid'&&v('finTransportCloseoutValue')==='yes';if(['provider_paid','commission_received'].includes(action)||closeTransport){if(!String(data.method||'').trim())throw Error('اختاري طريقة التسوية.');if(!String(data.reference||'').trim())data.reference=NO_EXTERNAL_REFERENCE;if(!confirm('هل تؤكدين أن التسوية تمت فعلاً، وليس مجرد سداد العميل؟\nالمبلغ: '+(data.amount||'تسوية النقل')+' د.ك\nالتوثيق: '+data.reference))return;}const recipient=data.recipient;saving=true;el('financeActionSave').disabled=true;await rpc('test_finance_action',{p_case_id:Number(a.caseId),p_component:a.component,p_action:action,p_request_id:a.requestId,p_data:data,p_revision:a.revision});await refresh();if(closeTransport){const next=findLine(a.caseId,'transport');const nextAction=recipient==='pawapp'?'provider_paid':'commission_received';if(next&&next.action===nextAction){const amount=nextAction==='provider_paid'?next.theirs:next.ours;if(amount>0n){await rpc('test_finance_action',{p_case_id:Number(a.caseId),p_component:'transport',p_action:nextAction,p_request_id:crypto.randomUUID(),p_data:{date:data.date,method:data.method,reference:data.reference,amount:F.format(amount)},p_revision:next.revision});await refresh();}}}const nextStep=findLine(a.caseId,a.component);const shouldContinue=!closeTransport&&nextStep&&nextStep.action&&nextStep.action!==action;if(shouldContinue){closeModal('financeActionModal');activeAction=null;toast('تم حفظ الخطوة الأولى • باقي '+actionLabel(nextStep));setTimeout(()=>window.pawFinanceOpen(a.caseId,a.component),80);return;}closeModal('financeActionModal');activeAction=null;toast(data.next_due_date?t('تم حفظ الدفعة الجزئية وتذكير الدفعة القادمة','Partial payment saved and next payment reminder set'):closeTransport?t('تم تسجيل سداد النقل وتسوية الطرفين بنفس العملية ✓','Transport payment and settlement recorded ✓'):t('تم الحفظ وتحديث حسابات الخدمة والنقل','Payment saved and accounts updated'));}catch(e){set('financeActionError',t(message(e)));}finally{saving=false;el('financeActionSave').disabled=false}};
function optionSelect(id,label,values,extra=''){return '<div class="field"><label><!--paw-i18n-->'+html(label)+'</label><select id="'+id+'" '+extra+'>'+values.map(([value,name])=>'<option value="'+html(value)+'"><!--paw-i18n-->'+html(name)+'</option>').join('')+'</select></div>'}
function setup(){const financeGrid=el('cTransportAddon')?.querySelector('.grid2');if(financeGrid&&!el('cFinTransportFeeType')){const d=document.createElement('div');d.className='field';d.innerHTML='<label><!--paw-i18n-->طريقة حصة PawApp من النقل</label><select id="cFinTransportFeeType" onchange="calcTransportAddon()"><option value="fixed"><!--paw-i18n-->مبلغ ثابت من إجمالي النقل</option><option value="percent"><!--paw-i18n-->نسبة من إجمالي النقل %</option></select>';financeGrid.prepend(d);financeGrid.insertAdjacentHTML('beforeend',optionSelect('cFinTransportPaid','العميل دفع النقل؟',[['no','لا'],['yes','نعم']])+optionSelect('cFinTransportRecipient','دفع النقل لمن؟',[['','اختاري عند الدفع'],['pawapp','PawApp'],['provider','شركة النقل مباشرة']]));}
if(!el('financeGrandTotal'))el('calcTotal')?.closest('.calc')?.insertAdjacentHTML('afterend','<div class="card" style="box-shadow:none;margin-top:10px"><span><!--paw-i18n-->الإجمالي شامل النقل: </span><b id="financeGrandTotal"></b></div>');
if(!el('financeEditTransport'))el('editServiceSection')?.insertAdjacentHTML('beforeend','<div id="financeEditTransport" class="field full"><div class="section"><h2><!--paw-i18n-->النقل الإضافي وحسابه المستقل</h2></div><div class="grid2">'+optionSelect('eFinTransportProvider','شركة النقل',[['','بدون نقل']])+ '<div class="field"><label><!--paw-i18n-->إجمالي سعر النقل (د.ك)</label><input id="eFinTransportTotal" type="number" min="0" step="0.001"></div>'+optionSelect('eFinTransportFeeType','طريقة حصة PawApp',[['fixed','مبلغ ثابت من إجمالي النقل'],['percent','نسبة %']])+'<div class="field"><label><!--paw-i18n-->حصة PawApp / النسبة</label><input id="eFinTransportFeeValue" type="number" min="0" step="0.001"></div><div class="field"><label><!--paw-i18n-->الاتجاه</label><select id="eFinTransportDirection"><option value=""><!--paw-i18n-->اختاري</option><option value="pickup">Pickup</option><option value="dropoff">Drop-off</option><option value="both">Pickup + Drop-off</option></select></div><div class="field"><label>الوقت</label><input id="eFinTransportAt" type="datetime-local"></div><div class="field"><label><!--paw-i18n-->مكان الاستلام</label><input id="eFinPickup"></div><div class="field"><label><!--paw-i18n-->مكان التوصيل</label><input id="eFinDropoff"></div></div><div id="financeEditTransportStatus" class="hint"></div></div>');
}
function pricing(){const q=F.quote(v('cAmount')||0,v('cFeeType'),v('cCommission')||0,v('cFeeType')==='fixed'?'provider_base':'customer_total');set('calcTotal',cash(q.total));set('calcPaw',cash(q.paw));set('calcDue',cash(q.provider));set('calcRemain',cash(q.provider));let total=q.total;if(v('cTransportNeeded')==='yes')total+=F.minor(v('cTransportTotal')||0);set('financeGrandTotal',cash(total));return q;}
window.calcCase=function(){try{pricing()}catch(e){set('calcTotal','راجعي السعر / النسبة');set('calcPaw','—');set('calcDue','—');set('financeGrandTotal','—')}};
window.calcTransportAddon=function(){try{const q=F.quote(v('cTransportTotal')||0,v('cFinTransportFeeType')||'fixed',v('cTransportPaw')||0);if(el('cTransportProviderAmount'))el('cTransportProviderAmount').value=F.format(q.provider);set('calcTransportTotal',cash(q.total));set('calcTransportPaw',cash(q.paw));set('calcTransportProvider',cash(q.provider));window.calcCase()}catch(e){set('calcTransportProvider','راجعي السعر / النسبة')}};
window.calcEditCase=function(){try{const q=F.quote(v('eTotalAmount')||0,v('eFeeType'),v('eFeeValue')||0);el('eProviderAmount').value=F.format(q.provider);set('eFeeValueLabel',v('eFeeType')==='fixed'?'حصة PawApp من الإجمالي (د.ك)':'نسبة PawApp %')}catch(e){el('eProviderAmount').value='سعر غير صحيح'}};
const tri=x=>x==='yes'?true:x==='no'?false:null,iso=x=>x?new Date(x+'+03:00').toISOString():null;
function bookingServiceId(services,provider,name,previous,required){
 const candidates=(services||[]).filter(x=>String(x.provider_id)===String(provider)&&String(x.name)===String(name));
 if(previous&&String(previous.provider_id)===String(provider)&&String(previous.service_name)===String(name)){
  const old=candidates.find(x=>String(x.id)===String(previous.service_id));
  if(old)return old.id;
  if(candidates.length===1)return candidates[0].id;
  if(!candidates.length)return previous.service_id||null;
 }
 if(candidates.length===1)return candidates[0].id;
 if(!required&&!name)return null;
 throw Error(t('اختاري خدمة صحيحة من خدمات مقدم الخدمة.','Choose a valid service belonging to the provider.'));
}
async function linkSavedPet(fn,id){
 if(typeof fn!=='function')return;
 try{await fn(id);}catch(e){alert(t('تم حفظ الحجز، لكن ربط الحيوان يحتاج مراجعة: ','Booking saved, but pet linking needs review: ')+message(e));}
}
function basics(prefix){const source={client_phone:prefix==='c'?'Phone':'Phone',employee_id:prefix==='c'?'Staff':'Employee',provider_id:'Provider',location:'Location',pet_type:'PetType',breed:'Breed',pet_age:'PetAge',reason:'Reason'};const patch={};for(const[key,suffix]of Object.entries(source))patch[key]=v(prefix+suffix).trim()||null;for(const[key,suffix]of Object.entries({pet_friendly:'PetFriendly',vaccinated:'Vaccinated',microchipped:'Microchipped',has_pet_id:'HasPetId'}))patch[key]=tri(v(prefix+suffix));patch.service_name=v(prefix+'Service')||null;patch.appointment_at=iso(v(prefix+'AppointmentAt'));return patch;}
async function saveAtomic(key,caseId,patch,payments,revision){if(!mayWrite())throw Error('No permission');const payload={p_case_id:caseId,p_patch:patch,p_payments:payments,p_revision:revision};payload.p_request_id=requestFor(key,payload);const result=await rpc('test_finance_save',payload);requests.delete(key);return result;}
window.saveCase=async function(){if(saving)return;try{const patch=basics('c');patch.client_name=v('cClient').trim();if(!patch.client_name||!patch.employee_id||!patch.provider_id||!patch.service_name||!patch.pet_type)throw Error('أكملي العميل والحيوان والموظف ومقدم الخدمة والخدمة.');patch.service_id=bookingServiceId(snapshot?.services,patch.provider_id,patch.service_name,null,true);const q=pricing();if(q.total===0n)throw Error('أدخلي سعر الخدمة.');Object.assign(patch,{total_amount:F.format(q.total),fee_type:v('cFeeType'),fee_value:v('cCommission')||'0',service_date:v('cDate')||localDate(),payment_method:v('cPayMethod'),notes:v('cNotes')||null,client_payment_note:v('cPaymentNote')||null,client_due_date:v('cClientDueDate')||null,source:v('cSource')||'manual_test',requested_service:patch.service_name});const payments={main:{paid:v('cClientPaid')==='paid',recipient:v('cPaidTo')}};if(payments.main.paid&&!payments.main.recipient)throw Error('اختاري جهة استلام دفعة العميل.');if(v('cTransportNeeded')==='yes'){const tq=F.quote(v('cTransportTotal'),v('cFinTransportFeeType')||'fixed',v('cTransportPaw')||'0');if(!v('cTransportProvider')||!v('cTransportDirection')||tq.total===0n)throw Error('أكملي شركة النقل والاتجاه والسعر.');Object.assign(patch,{transport_provider_id:v('cTransportProvider'),transport_total_amount:F.format(tq.total),transport_fee_type:v('cFinTransportFeeType')||'fixed',transport_fee_value:v('cTransportPaw')||'0',transport_direction:v('cTransportDirection'),transport_at:iso(v('cTransportAt')),pickup_location:v('cPickupLocation')||null,dropoff_location:v('cDropoffLocation')||null});payments.transport={paid:v('cFinTransportPaid')==='yes',recipient:v('cFinTransportRecipient')};if(payments.transport.paid&&!payments.transport.recipient)throw Error('اختاري جهة استلام مبلغ النقل.');}saving=true;const result=await saveAtomic('newcase',null,patch,payments,null);if(result?.case_id)await linkSavedPet(window.pawPetLinkNewCase,result.case_id);await refresh();showPage('cases');toast('تم حفظ الخدمة والنقل والحسابات معًا');}catch(e){alert(message(e))}finally{saving=false}};
window.saveCaseDetails=async function(){if(saving)return;const id=v('editCaseId'),c=snapshot?.cases.find(x=>String(x.id)===id);if(!c)return;try{const patch=basics('e');patch.service_id=bookingServiceId(snapshot?.services,patch.provider_id,patch.service_name,c,false);const editedName=v('eClientName').trim();if(editedName)patch.client_name=editedName;Object.assign(patch,{total_amount:v('eTotalAmount')||'0',fee_type:v('eFeeType'),fee_value:v('eFeeValue')||'0',payment_method:v('ePaymentMethod'),client_due_date:v('eClientDueDate')||null});F.quote(patch.total_amount,patch.fee_type,patch.fee_value);const payments={main:{paid:v('eClientPaid')==='paid',recipient:v('ePaidTo'),...(v('ePawappCollected')==='yes'?{commission_received:true}:{})}};if(payments.main.paid&&!payments.main.recipient)throw Error('اختاري جهة استلام دفعة العميل.');const tp=v('eFinTransportProvider');if(tp){F.quote(v('eFinTransportTotal')||'0',v('eFinTransportFeeType'),v('eFinTransportFeeValue')||'0');Object.assign(patch,{transport_provider_id:tp,transport_total_amount:v('eFinTransportTotal')||'0',transport_fee_type:v('eFinTransportFeeType'),transport_fee_value:v('eFinTransportFeeValue')||'0',transport_direction:v('eFinTransportDirection')||null,transport_at:iso(v('eFinTransportAt')),pickup_location:v('eFinPickup')||null,dropoff_location:v('eFinDropoff')||null});}else if(c.transport_provider_id){Object.assign(patch,{transport_provider_id:null,transport_total_amount:'0',transport_fee_type:'fixed',transport_fee_value:'0'});}saving=true;await saveAtomic('edit-'+id,Number(id),patch,payments,editorRevision);window.pawPetCases=db.cases;await linkSavedPet(window.pawPetConfirmCase,Number(id));closeModal('completeCaseModal');await refresh();toast('تم الحفظ وتحديث الحسابات');}catch(e){alert(message(e))}finally{saving=false}};
window.openCaseDetails=function(id){hydrate();legacyOpen(id);const c=snapshot?.cases.find(x=>String(x.id)===String(id));if(!c)return;editorRevision=c.finance_revision||0;const tp=el('eFinTransportProvider');if(tp){tp.innerHTML='<option value=""><!--paw-i18n-->بدون نقل</option>'+snapshot.providers.map(p=>'<option value="'+p.id+'">'+html(p.name)+'</option>').join('');tp.value=c.transport_provider_id||'';}for(const[k,value]of Object.entries({eFinTransportTotal:c.transport_total_amount||0,eFinTransportFeeType:c.transport_fee_type||'fixed',eFinTransportFeeValue:c.transport_fee_value??c.transport_pawapp_amount??0,eFinTransportDirection:c.transport_direction||'',eFinTransportAt:localInput(c.transport_at),eFinPickup:c.pickup_location||'',eFinDropoff:c.dropoff_location||''}))if(el(k))el(k).value=value;const tl=findLine(id,'transport');if(el('financeEditTransportStatus'))el('financeEditTransportStatus').innerHTML=tl?html(detail(tl))+'<div class="actions">'+(actionable(tl)?actionButton(tl):'')+'</div>':'';
window.pawPetCases=db.cases;window.pawPetPrefillCase?.(id);const ls=linesFor(id),pending=ls.filter(actionable);if(!pending.length)set('workflowTaskLabel','لا توجد مستحقات مالية ناقصة');else set('workflowTaskLabel',pending.map(l=>(l.component==='transport'?'النقل: ':'الخدمة: ')+detail(l)).join(' • '));if(el('eAppointmentAt'))el('eAppointmentAt').value=localInput(c.appointment_at);
};
const oldFocusedEditor=window.openCaseWorkflow;
window.openCaseWorkflow=function(id,mode){if(mode==='finance'){const pending=linesFor(id).find(actionable);if(pending){window.pawFinanceOpen(id,pending.component);return;}}oldFocusedEditor(id,mode);};
window.openNewCase=function(){legacyNewCase();for(const[k,value]of Object.entries({cFinTransportFeeType:'fixed',cFinTransportPaid:'no',cFinTransportRecipient:''})){if(el(k))el(k).value=value;}window.calcCase();};
window.openSettlement=id=>window.pawFinanceOpen(id,'main');window.openClientPayment=id=>window.pawFinanceOpen(id,'main');window.saveSettlement=()=>{alert('افتحي المستحق من زر الدفع المخصص.');};window.saveClientPayment=window.saveSettlement;
window.exportProviderFullReport=function(id){
 const p=model.providers.find(x=>String(x.id)===String(id));if(!p)return;
 const from=v('pawSettlementFrom'),to=v('pawSettlementTo');
 const lines=p.lines.filter(l=>(!from||l.date>=from)&&(!to||l.date<=to)&&pawSourceMatchesLine(l));
  const report=F.csv(lines,p.name);
 const bom=report.startsWith('\ufeff')?'\ufeff':'';
 const plain=bom?report.slice(1):report;
 const rows=plain.trimEnd().split(/\r?\n/);
 const columns=['حالة الفترة','مرجع العملية','اعتماد التسوية','ملاحظة التسوية'];
 const historical=from>='2026-07-01'&&to<'2026-10-01';
 const header=rows.shift()+','+columns.map(csvCell).join(',');
 const body=rows.map((row,i)=>{
  if(i>=lines.length)return row+','+['','','',''].map(csvCell).join(',');
  const l=lines[i];
  const status=historical?'مقفل تاريخياً':l.issues.length?'تحتاج مراجعة':l.ours>0n?'مستحق لـ PawApp على الشركة':l.theirs>0n?'مستحق للشركة على PawApp':l.isPaid?'لا توجد مستحقات':'العميل لم يسدد';
  const approvedLine=periodSettlements.some(x=>String(x.provider_id)===String(p.id)&&x.period_from<=l.date&&x.period_to>=l.date);
  return row+','+[status,caseCode(l.caseId),historical?'إقفال تاريخي':approvedLine?'تسوية معتمدة للفترة — غير منسوبة للعملية':'غير معتمدة',historical?'إقفال تاريخي، ليس إثبات تحويل':approvedLine?'اعتماد على مستوى الفترة، وليس إثبات اعتماد كل عملية':'السداد المسجل لا يعني اعتماد تسوية'].map(csvCell).join(',');
 });
 download(bom+[header,...body].join('\r\n')+'\r\n','PawApp-'+p.name+'-operations.csv','text/csv;charset=utf-8');
};
window.pawPrintProviderReport=function(){
 const p=model?.providers.find(x=>String(x.id)===String(selectedProvider));
 const section=el('pawProviderSettlementPeriod');
 if(!p||!section)return alert('اختاري الشركة والفترة أولاً');
 const logo=document.querySelector('img.logo')?.src||'';
 const from=v('pawSettlementFrom'),to=v('pawSettlementTo');
 const w=window.open('','_blank');
 if(!w)return alert('اسمحي بفتح نافذة التقرير للطباعة');
 const safe=x=>html(x);
 const reportLines=p.lines.filter(l=>(!from||l.date>=from)&&(!to||l.date<=to)&&pawSourceMatchesLine(l));
 const historical=from>='2026-07-01'&&to<'2026-10-01';
 const reportRows=reportLines.map(l=>{
  const status=historical?'إقفال تاريخي':l.issues.length?'تحتاج مراجعة':l.ours>0n?'الشركة مطالبة لـ PawApp':l.theirs>0n?'PawApp مطالبة للشركة':l.isPaid?'سداد مسجل — الاعتماد منفصل':'العميل لم يسدد';
  const route=l.route==='pawapp'?'PawApp':l.route==='provider'?'الشركة':'غير محدد';
  const approval=historical?'إقفال تاريخي':periodSettlements.some(x=>String(x.provider_id)===String(p.id)&&x.period_from<=l.date&&x.period_to>=l.date)?'تسوية معتمدة للفترة — غير منسوبة للعملية':'غير معتمدة';
  return '<tr>'+[caseCode(l.caseId),l.date,l.client,l.phone,l.service,providerName(l.providerId),cash(l.total),cash(l.paw),cash(l.provider),cash(l.paid),route,historical?'إقفال تاريخي':cash(l.providerPaid),historical?'إقفال تاريخي':cash(l.commissionReceived),cash(l.ours),cash(l.theirs),status,approval].map(x=>'<td>'+safe(x)+'</td>').join('')+'</tr>';
 }).join('');
 const detailTable='<h2>تفاصيل العمليات والمطالبات</h2><table class="reportDetails"><thead><tr>'+['العملية','التاريخ','العميل','الهاتف','الخدمة','الشركة','الإجمالي','حصة PawApp','حصة الشركة','دفع العميل','استلم العميل لدى','دُفع للشركة','حُصّلت العمولة','للـ PawApp على الشركة','للشركة على PawApp','الحالة','اعتماد التسوية'].map(x=>'<th>'+safe(x)+'</th>').join('')+'</tr></thead><tbody>'+reportRows+'</tbody></table>';
 w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>PawApp - '+safe(p.name)+'</title><style>body{font:15px Arial,sans-serif;color:#142b49;margin:32px}header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #163e76;padding-bottom:18px;margin-bottom:20px}header img{width:76px;height:76px;object-fit:contain}h1{font-size:24px;margin:0}.miniGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}.mini{border:1px solid #dce4ed;border-radius:9px;padding:12px}.mini span{display:block;color:#687c91}.mini b{display:block;margin-top:7px}button{display:none}.reportDetails{width:100%;border-collapse:collapse;font-size:10px;direction:rtl}.reportDetails th,.reportDetails td{border:1px solid #dce4ed;padding:5px;text-align:right}.reportDetails th{background:#eaf0f7}.hint{color:#687c91;margin:12px 0}@media print{body{margin:15mm}}</style></head><body><header>'+(logo?'<img src="'+logo+'" alt="PawApp">':'')+'<div><h1>PawApp Concierge</h1><strong>تقرير تسويات الشركة — '+safe(p.name)+'</strong><p>'+safe(from)+' — '+safe(to)+'</p></div></header>'+section.innerHTML+detailTable+'<p class="hint">تقرير من نظام TEST — ليس إيصال تحويل بنكي</p></body></html>');
 w.document.close();w.focus();setTimeout(()=>w.print(),500);
};
window.exportProviderReport=window.exportProviderFullReport;
function csvCell(value){let s=String(value??'');if(/^[\\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name.replace(/[\\/]/g,'-');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
window.downloadTestBackup=async function(){try{const data=await rpc('test_finance_backup');download(JSON.stringify(data,null,2),'pawapp-test-finance-backup-'+localDate()+'.json','application/json');toast('تم تجهيز نسخة TEST الاحتياطية');}catch(e){alert(message(e))}};
document.addEventListener('paw-language-change',()=>{try{if(model&&!document.querySelector('.modalBg.show')&&!el('newcase')?.classList.contains('active'))render();else {renderHomeAnalytics();renderMonthlyTarget();}for(const id of ['calcTotal','calcPaw','calcDue','calcRemain','calcTransportTotal','calcTransportPaw','calcTransportProvider','financeGrandTotal']){const node=el(id);if(node&&/^\s*[\d,.]+\s*(?:د\.ك|DK|KWD)\s*$/.test(node.textContent))node.textContent=node.textContent.replace(/(?:د\.ك|DK|KWD)\s*$/,t('د.ك','DK'));}}catch(e){console.warn('Language refresh',e);}});
window.renderDashboard=renderDashboard;window.renderProviders=renderProviders;window.renderCases=renderCases;window.renderAutomaticFollowups=renderFollowups;window.loadData=refresh;window.renderAll=function(){render();};
window.pawFinanceRefresh=refresh;
window.openProviderCRM=async function(id){
 selectedProvider=id;
 if(el('pawSettlementFrom'))el('pawSettlementFrom').value='';
 if(el('pawSettlementTo'))el('pawSettlementTo').value='';
 legacyShowPage('providerdetail');
 // Avoid stale partner balances after staff payments recorded in appointment dashboard.
 try{await refresh();}catch(e){alert('تعذر تحديث حسابات الشركة: '+String(e?.message||e));return;}
 renderProvider();
};window.providerCases=window.openProviderCRM;
window.showPage=async function(id){if(id==='admin'&&!window.pawIsAdmin()){toast('Admin only');return;}await legacyShowPage(id);
 if(['dashboard','providers','followups','cases','providerdetail','marketing','smartcalendar','admin','reports'].includes(id)){
   try{await refresh();}catch(e){console.warn('Finance snapshot refresh failed',e);toast('تعذر تحديث الحسابات — جربي تحديث الصفحة');}
 }
 if(id==='reports')renderSmartReports();if(id==='admin')renderEmployeePerformance();if(id==='dashboard')renderDashboard();if(id==='providers')renderProviders();if(id==='cases')renderCases();if(id==='followups')renderFollowups();
};
setup();calInstall();epInstall();srInstall();await refresh();if(typeof fillProviders==='function')fillProviders();if(typeof fillStaff==='function')fillStaff();window.PAW_FINANCE_READY=true;window.PAW_FINANCE_VERSION='finance-v3';
try {
 window.PawDashboardAssistant?.({
  allowed:()=>srAllowed()&&!!window.PAWAPP_AUTH?.session,
  today:localDate,cash,refresh,
  goalPercent:(earned,goal)=>epGoalStats(earned,goal).percent,
  report:month=>{
   const today=localDate();
   if(!srAllowed()||!window.PAWAPP_AUTH?.session||!snapshot||!model||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<'2000-01'||month>today.slice(0,7))throw Error('Report unavailable');
   return srBuild(snapshot,model,month,today,targetError?null:targetRows,epAdmin()?epTargetRows:null);
  }
 });
}catch(e){console.warn('TEST dashboard assistant unavailable',e);}

};
