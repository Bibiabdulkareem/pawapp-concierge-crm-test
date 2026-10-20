/* settlement refresh 3.2 */
/* integrated finance 3.1 */
/* TEST-only finance integration. The legacy layout remains; monetary reads/writes use finance v3 RPCs. */
window.PawFinanceInstall=async function(){
'use strict';
if(window.__pawFinanceInstalled)return;
if(!window.PAWAPP_AUTH?.client||!window.PawFinanceCore)throw Error('Finance dependencies missing');
window.__pawFinanceInstalled=true;
const F=window.PawFinanceCore,el=id=>document.getElementById(id),v=id=>el(id)?.value??'',set=(id,value)=>{if(el(id))el(id).textContent=String(value)},html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=x=>F.format(x)+' د.ك',num=x=>Number(F.format(x)),caseCode=id=>'PAW-'+String(id).padStart(4,'0');
const mayWrite=()=>['admin','operations'].includes(window.PAWAPP_AUTH?.access?.role);
let snapshot=null,model=null,loading=null,selectedProvider=null,activeAction=null,saving=false,editorRevision=null;
let periodSettlements=[];
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
      const original=(label,value)=>'<span>'+label+': <b>'+html(value==null||value===''?'غير مسجل':value)+' د.ك</b></span>';
      return '<div class="card provider"><h3>'+html(identity)+'</h3>'+
      '<div class="hint">'+html(v[6]||'مقدم خدمة غير مسجل')+' • '+html(v[4]||'نوع غير مسجل')+
      (v[11]?' • '+html(v[11]):'')+'</div>'+
      '<div class="hint">سبتمبر 2026 • صف الإكسل: '+r.source_row+'</div>'+
      '<div class="hint">المبالغ المسجلة سابقاً: '+original('الإجمالي',v[10])+' | '+original('PawApp',v[8])+' | '+original('مقدم الخدمة',v[9])+'</div>'+
      '<div class="actions"><button class="btn primary" onclick="pawReviewSeptember('+r.source_row+')">استكمال البيانات المالية</button></div></div>';
    }).join(''):'';
}
window.pawCloseSeptemberReview=function(){const modal=el('septemberReviewModal');if(modal)modal.style.display='none';};
window.pawReviewSeptember=function(row){
  const r=septemberReviewRows.find(x=>x.source_row===row);if(!r)return;
  const v=r.source_data?.values||[],saved=r.source_data?.financial_review||{};
  let modal=el('septemberReviewModal');
  if(!modal){document.body.insertAdjacentHTML('beforeend','<div id="septemberReviewModal" class="modalBg"><div class="modal"><div class="modalHead"><h3>استكمال البيانات المالية</h3><button class="close" onclick="pawCloseSeptemberReview()">×</button></div><div id="septemberReviewBody"></div></div></div>');modal=el('septemberReviewModal');}
  const field=(key,label,source)=>'<div class="field"><label>'+label+'</label><input type="number" min="0" step="0.001" id="sep_'+key+'" value="'+html(saved[key]??'')+'" placeholder="'+html(source==null?'غير مسجل':'المصدر: '+source)+'"></div>';
  el('septemberReviewBody').innerHTML='<div class="hint"><b>سبتمبر 2026 — صف الإكسل '+row+'</b></div>'+
    '<div class="hint">العميل: '+html(v[0]||'غير مسجل')+' | الهاتف: '+html(v[1]||'غير مسجل')+' | تاريخ الخدمة: '+html(v[11]||'غير مسجل')+' | الخدمة: '+html(v[6]||'غير محددة')+'</div>'+
    '<div class="grid2" style="margin-top:12px">'+field('total','إجمالي العميل',v[10])+field('paw','حصة PawApp',v[8])+field('provider','حصة مقدم الخدمة',v[9])+field('collected','المبلغ المحصل لـ PawApp',null)+'</div>'+
    '<div class="field" style="margin-top:12px"><label>جهة استلام دفعة العميل</label><select id="sep_recipient"><option value="">اختاري</option><option value="pawapp">PawApp</option><option value="provider">مقدم الخدمة</option></select></div>'+
    '<div class="field" style="margin-top:12px"><label>ملاحظات وإثبات التحصيل</label><textarea id="sep_note" rows="2">'+html(saved.note||'')+'</textarea></div>'+
    '<div class="hint">المبالغ المصدرية للرجوع فقط؛ لا يتم افتراض أي قيمة أو اعتمادها تلقائياً.</div>'+
    '<button class="btn primary" style="width:100%;margin-top:12px" onclick="pawSaveSeptemberReview('+row+')">حفظ واعتماد وإقفال المتابعة</button>';
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
const review=l=>l.issues.map(i=>notes[i]||i).join(' — ');
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
async function refresh(){const previous=loading;const job=(async()=>{if(previous){try{await previous}catch(e){}}const next=await rpc('test_finance_snapshot');const projected=F.project(next);await loadSeptemberReviews();await loadPeriodSettlements();snapshot=next;model=projected;hydrate();render();return next;})();loading=job;try{return await job}finally{if(loading===job)loading=null}}
const legacyFollowups=window.renderAutomaticFollowups,legacyCases=window.renderCases,legacyOpen=window.openCaseDetails,legacyShowPage=window.showPage,legacyNewCase=window.openNewCase;
function linesFor(id){return model?.lines.filter(l=>l.caseId===String(id))||[]}
function findLine(id,component){return linesFor(id).find(l=>l.component===component)}
function providerName(id){return snapshot?.providers.find(p=>String(p.id)===String(id))?.name||'غير محدد'}
function actionLabel(l){if(l.unknown)return 'تأكيد سداد النقل';if(l.action==='client_paid')return l.isPaid?'تحديد جهة استلام الدفعة':'تحصيل من العميل';if(l.action==='provider_paid')return 'دفع مستحق الشركة';if(l.action==='commission_received')return 'تحصيل حصة PawApp';return 'مراجعة التسجيل';}
function detail(l){if(l.unknown)return 'سعر النقل '+cash(l.total)+' — لم تُحدد حالة سداده بعد';if(l.action==='client_paid')return l.isPaid?'العميل دافع؛ المطلوب فقط تحديد جهة الاستلام':'متبقي على العميل '+cash(l.unpaid);if(l.action==='provider_paid')return 'للشركة عندنا '+cash(l.theirs);if(l.action==='commission_received')return 'لنا عند الشركة '+cash(l.ours);return review(l)||'مكتمل ماليًا';}
function actionButton(l){if(!mayWrite())return '';return '<button class="btn primary" type="button" onclick="pawFinanceOpen(\''+l.caseId+'\',\''+l.component+'\')">'+html(actionLabel(l))+'</button>';}
function metric(label,id,value,hint=''){return '<div class="card stat"><span>'+html(label)+'</span><b id="'+id+'">'+html(value)+'</b>'+(hint?'<small class="hint">'+html(hint)+'</small>':'')+'</div>';}
function summaryCards(s,prefix){return metric('إجمالي الخدمات شامل النقل',prefix+'Total',cash(s.total))+metric('حصة PawApp المحسوبة',prefix+'Share',cash(s.paw),'الحصة لا تتغير عند تحصيلها')+metric('حصص مقدمي الخدمات',prefix+'ProviderShare',cash(s.provider))+metric('حصة PawApp المحصّلة',prefix+'Collected',cash(s.pawCollected))+metric('المدفوع من العملاء',prefix+'Paid',cash(s.paid))+metric('غير المدفوع من العملاء',prefix+'Unpaid',cash(s.unpaid),s.unknownCount?'بالإضافة إلى '+s.unknownCount+' خدمة نقل لم يتأكد سدادها':'')+metric('لنا عند الشركات',prefix+'Ours',cash(s.ours))+metric('للشركات عندنا',prefix+'Theirs',cash(s.theirs));}
function renderDashboard(){if(!model)return;const s=model.summary;set('kOps',s.caseCount);set('kCustomers',s.customerCount);set('kProviders',model.providers.length);
const identified=new Set(),unidentified=new Set();
for(const c of snapshot.cases||[]){
 const k=F.customerKey(c);
 if(k.startsWith('case:'))unidentified.add(k);else identified.add(k);
}
let customerAudit=el('pawCustomerCountAudit');
if(!customerAudit){customerAudit=document.createElement('div');customerAudit.id='pawCustomerCountAudit';customerAudit.className='hint';customerAudit.style.cssText='margin:8px 0;padding:10px;border:1px solid #dbe2ed;border-radius:12px';const customerCard=el('kCustomers')?.closest('.card');if(customerCard)customerCard.appendChild(customerAudit);}
if(customerAudit)customerAudit.textContent='عملاء برقم/معرّف مميز: '+identified.size+' | عمليات بلا رقم أو معرّف: '+unidentified.size+' (تحتاج مطابقة، ليست بالضرورة عملاء جدد). العدد المعروض يشملها مؤقتاً.';set('kClientPaidTotal',cash(s.paid));set('kClientUnpaidTotal',cash(s.unpaid));set('kOursFromProviders',cash(s.ours));set('kOweProviders',cash(s.theirs));
let settlementsDashboard=el('pawSettlementsDashboard');
if(!settlementsDashboard){settlementsDashboard=document.createElement('section');settlementsDashboard.id='pawSettlementsDashboard';settlementsDashboard.className='card';el('dashboard')?.appendChild(settlementsDashboard);}
const settledTotal=periodSettlements.reduce((a,x)=>a+Number(x.amount||0),0);
if(settlementsDashboard)settlementsDashboard.innerHTML='<h3>تسويات الشركات — TEST</h3><div class="miniGrid"><div class="mini"><span>تسويات معتمدة</span><b>'+periodSettlements.length+'</b></div><div class="mini"><span>إجمالي التحويلات المعتمدة</span><b>'+settledTotal.toFixed(3)+' د.ك</b></div><div class="mini"><span>Pending للشركات على PawApp</span><b>'+cash(s.theirs)+'</b></div><div class="mini"><span>Pending لـ PawApp على الشركات</span><b>'+cash(s.ours)+'</b></div></div><div class="hint">الأرصدة الحالية من سجل المالية نفسه؛ التحويلات المعتمدة لا تُضاف مرة ثانية للإيرادات.</div>';
let statsBox=el('pawDashboardStats');
if(!statsBox){statsBox=document.createElement('div');statsBox.id='pawDashboardStats';statsBox.className='card';statsBox.style.margin='10px 0';el('dashboard')?.appendChild(statsBox);}
const uniqueServices=new Set((snapshot.cases||[]).map(c=>String(c.service_name||c.requested_service||'').trim().toLowerCase()).filter(Boolean));
const registeredServices=(snapshot.services||[]).length;
const unknownDates=(snapshot.cases||[]).filter(c=>!c.service_date).length;
const outOfPeriod=(snapshot.cases||[]).filter(c=>c.service_date&&(c.service_date<'2026-07-01'||c.service_date>'2026-09-30')).length;
if(statsBox)statsBox.innerHTML='<b>إحصائيات جميع العمليات — بدون فلتر تاريخ</b><div class="miniGrid"><div class="mini"><span>العمليات</span><b>'+s.caseCount+'</b></div><div class="mini"><span>الشركات / الفريلانسر</span><b>'+model.providers.length+'</b></div><div class="mini"><span>أنواع الخدمات المنفذة</span><b>'+uniqueServices.size+'</b></div><div class="mini"><span>الخدمات المسجلة بالكتالوج</span><b>'+registeredServices+'</b></div></div><div class="hint">عملاء معروفون: '+identified.size+' | حالات بلا هوية: '+unidentified.size+' | عمليات بلا تاريخ خدمة: '+unknownDates+' | عمليات مؤرخة خارج يوليو–سبتمبر 2026: '+outOfPeriod+'</div>';
let box=el('financeDashboardCards');if(!box){box=document.createElement('div');box.id='financeDashboardCards';box.className='cards';box.style.cssText='margin-top:10px;grid-template-columns:repeat(2,minmax(0,1fr))';const old=el('kClientPaidTotal')?.closest('.cards');if(old)old.replaceWith(box);else el('dashboard')?.appendChild(box);}box.innerHTML=summaryCards(s,'finDash');
let issueBreakdown=el('pawIssueBreakdown');
if(!issueBreakdown){issueBreakdown=document.createElement('div');issueBreakdown.id='pawIssueBreakdown';issueBreakdown.className='card';issueBreakdown.style.margin='10px 0';el('dashboard')?.appendChild(issueBreakdown);}
const issueNames={provider_missing:'مقدم الخدمة غير محدد',payment_route_missing:'جهة دفع العميل غير محددة',price_split_mismatch:'اختلاف تقسيم السعر',invalid_price:'سعر أو عمولة غير صالح',transport_payment_unknown:'تحصيل النقل غير مؤكد',unpriced_service:'خدمة بدون سعر',commission_overpaid:'عمولة محصلة أكثر من المستحق',client_overpaid:'سداد عميل أكثر من الإجمالي',provider_overpaid:'تحويل لمقدم الخدمة أكبر من حصته',duplicate_commission_route:'عمولة مكررة حسب جهة الدفع',direct_provider_and_payout:'تحويل مزدوج محتمل',paid_flag_mismatch:'اختلاف حالة الدفع',cancelled_case_requires_review:'عملية ملغاة تحتاج مراجعة'};
const issueCounts=new Map();
for(const line of model.lines||[])for(const issue of line.issues||[])issueCounts.set(issue,(issueCounts.get(issue)||0)+1);
if(issueBreakdown)issueBreakdown.innerHTML='<b>تفاصيل البنود المالية التي تحتاج مراجعة</b>'+(issueCounts.size?'<div class="hint">'+[...issueCounts].sort((a,b)=>b[1]-a[1]).map(([key,n])=>html(issueNames[key]||key)+': '+n).join(' | ')+'</div>':'<div class="hint">لا توجد تنبيهات مالية.</div>')+'<div class="hint">هذه تنبيهات تدقيق، وليست متابعات موظفين. لا تُغلق تلقائياً دون تصحيح البيانات المصدرية.</div>';
let status=el('financeStatus');if(!status){status=document.createElement('div');status.id='financeStatus';status.className='card';status.style.marginTop='10px';box.after(status);}status.innerHTML='<b>حسابات TEST — شامل الخدمة والنقل</b><div class="hint">'+(s.issueCount?html(s.issueCount+' بند يحتاج تأكيدًا أو مراجعة قبل إصدار التقرير. الأرقام لا تفترض أن النقل مدفوع.'): 'تمت مطابقة إجمالي الأسعار مع مجموع حصة PawApp وحصص الشركات.')+'</div>';
const recent=el('dashboardRecentCards');if(recent)recent.innerHTML=snapshot.cases.slice().reverse().slice(0,3).map(c=>{const lines=linesFor(c.id),sum=F.summarize(lines),pending=lines.some(actionable);return '<div class="card provider"><h3>'+html(c.client_name)+'</h3><p>'+caseCode(c.id)+'</p><div class="hint">'+html(c.service_name||c.requested_service||'')+'</div><div class="miniGrid"><div class="mini"><span>الإجمالي شامل النقل</span><b>'+cash(sum.total)+'</b></div><div class="mini"><span>حصة PawApp</span><b>'+cash(sum.paw)+'</b></div></div><div class="hint">'+(pending?lines.filter(actionable).map(l=>html((l.component==='transport'?'النقل: ':'الخدمة: ')+detail(l))).join('<br>'):'لا يوجد إجراء مالي متبقٍ')+'</div><div class="actions"><button class="btn soft" onclick="openCaseDetails(\''+c.id+'\')">فتح العملية</button></div></div>';}).join('');
}
function renderProviders(){if(!model)return;const q=v('providerSearch').toLowerCase();el('providerList').innerHTML=model.providers.filter(p=>p.name.toLowerCase().includes(q)).map(p=>{const s=p.summary;return '<div class="card provider"><h3>'+html(p.name)+'</h3><div class="miniGrid"><div class="mini"><span>العمليات</span><b>'+s.caseCount+'</b></div><div class="mini"><span>العملاء</span><b>'+s.customerCount+'</b></div><div class="mini"><span>الخدمات مع النقل</span><b>'+s.lineCount+'</b></div></div><div class="miniGrid"><div class="mini"><span>لنا عندهم</span><b>'+cash(s.ours)+'</b></div><div class="mini"><span>لهم عندنا</span><b>'+cash(s.theirs)+'</b></div><div class="mini"><span>حصة الشركة</span><b>'+cash(s.provider)+'</b></div></div>'+(p.lines.some(l=>l.issues.length&&!(l.date>='2026-07-01'&&l.date<'2026-10-01'))?'<div class="hint">'+p.lines.filter(l=>l.issues.length&&!(l.date>='2026-07-01'&&l.date<'2026-10-01')).length+' بند يحتاج مراجعة أو تأكيد.</div>':'')+'<div class="actions"><button class="btn primary" onclick="openProviderCRM(\''+p.id+'\')">التفاصيل والتقرير</button>'+(mayWrite()?'<button class="btn soft" onclick="openServiceManager(\''+p.id+'\')">الخدمات</button>':'')+'</div></div>';}).join('')||'<div class="card">لا توجد شركات</div>';}
function renderProviderSettlementPeriod(){
 const host=el('pawProviderSettlementPeriod');if(!host||!model||!selectedProvider)return;
 const p=model.providers.find(x=>String(x.id)===String(selectedProvider));if(!p)return;
 const from=v('pawSettlementFrom'),to=v('pawSettlementTo');
 if(!from||!to){host.innerHTML='<p class="hint">اختاري تاريخ البداية والنهاية لعرض تسويات هذه الشركة. ما تم اختيار أي شهر تلقائياً.</p>';return;}
 if(from>to){host.innerHTML='<p class="hint">تاريخ البداية لازم يكون قبل تاريخ النهاية.</p>';return;}
 const lines=p.lines.filter(l=>(!from||l.date>=from)&&(!to||l.date<=to));
 const sum=F.summarize(lines);
 const cases=(snapshot?.cases||[]).filter(c=>lines.some(l=>l.caseId===String(c.id)));
 const historical=from>='2026-07-01'&&to<'2026-10-01';
 const pending=historical?[]:lines.filter(l=>l.ours>0n||l.theirs>0n);
 const unresolved=historical?[]:lines.filter(l=>l.issues.length);
 const settled=historical?lines:lines.filter(l=>l.isPaid&&l.ours===0n&&l.theirs===0n&&!l.issues.length);
 const approved=periodSettlements.filter(x=>String(x.provider_id)===String(selectedProvider)&&(!from||x.period_to>=from)&&(!to||x.period_from<=to));
 const settlementCards=['pawapp_to_provider','provider_to_pawapp'].map(dir=>{
   const title=dir==='pawapp_to_provider'?'مستحق للشركة على PawApp':'مستحق لـ PawApp على الشركة';
   const rows=approved.filter(x=>x.direction===dir);
   const amount=rows.reduce((a,x)=>a+Number(x.amount||0),0);
   const due=historical?0n:dir==='pawapp_to_provider'?sum.theirs:sum.ours;
   const relevant=lines.filter(l=>l.isPaid&&l.route===(dir==='pawapp_to_provider'?'pawapp':'provider'));
   const unknown=relevant.some(l=>l.issues.length);
   const label=historical?'تمت التسوية — مقفل خارج النظام':rows.length&&due===0n?'Settled — تمت التسوية':due>0n?'Pending — مستحقات غير مدفوعة':lines.length&&unresolved.length?'تحتاج مراجعة — بيانات مالية ناقصة':lines.length?'غير معتمد — لا يوجد مبلغ متبقٍ مسجل':'لا توجد عمليات في الفترة';
   const canApprove=['admin','accountant'].includes(window.PAWAPP_AUTH?.access?.role)&&from&&to&&from<=to&&due>0n&&!unknown&&!rows.length&&!historical;
   const canReconcile=!historical&&['admin','accountant'].includes(window.PAWAPP_AUTH?.access?.role)&&due===0n&&rows.length===0&&lines.length>0&&unresolved.length===0&&lines.every(l=>l.isPaid&&l.component==='main'&&l.total>0n);
   return '<div class="mini"><span>'+title+'</span><b>'+label+'</b><div class="hint">المعتمد: '+amount.toFixed(3)+' د.ك • المتبقي: '+cash(due)+'</div>'+
     (canApprove?'<button class="btn primary" onclick="pawConfirmPeriodSettlement(\''+dir+'\')">تمت التسوية — تأكيد الدفع/التحصيل</button>':'')+
     (canReconcile?'<button class="btn" onclick="pawConfirmZeroSettlement(\''+dir+'\')">اعتماد تسوية سابقة موثقة</button>':'')+
     (unknown?'<div class="hint">يلزم مراجعة البنود قبل الاعتماد</div>':'')+'</div>';
 }).join('');
 const status=historical?'تمت التسوية — مقفل خارج النظام':unresolved.length?'تحتاج مراجعة':pending.length?'Pending — بانتظار التسوية':'لا توجد مستحقات معلقة';
 host.innerHTML='<div class="hint">إجمالي الفترة وحصص الطرفين تظهر دائماً، حتى لو المتبقي صفر. حالة الإقفال لا تثبت التحويل وحدها.</div>'+
 '<div class="miniGrid"><div class="mini"><span>عمليات الفترة</span><b>'+sum.caseCount+'</b></div>'+
 '<div class="mini"><span>إجمالي العمليات</span><b>'+cash(sum.total)+'</b></div>'+
 '<div class="mini"><span>حصة PawApp</span><b>'+cash(sum.paw)+'</b></div>'+
 '<div class="mini"><span>حصة الشركة</span><b>'+cash(sum.provider)+'</b></div>'+
 '<div class="mini"><span>المحصّل من العمولة</span><b>'+cash(sum.pawCollected)+'</b></div>'+
 '<div class="mini"><span>المحوّل للشركة</span><b>'+cash(sum.providerPaid)+'</b></div>'+
 '<div class="mini"><span>المتبقي على الشركة</span><b>'+cash(historical?0n:sum.ours)+'</b></div>'+
 '<div class="mini"><span>المتبقي على PawApp</span><b>'+cash(historical?0n:sum.theirs)+'</b></div></div>'+
 '<div class="miniGrid">'+settlementCards+'</div>'+ 
 '<button class="btn" onclick="pawPrintProviderReport()">طباعة تقرير رسمي بالشعار / حفظ PDF</button><p><b>التسوية: '+html(status)+'</b> • عمليات مستوفية: '+(historical?lines.length:settled.length)+' • بنود تحتاج مراجعة: '+(historical?0:unresolved.length)+'</p>'+
 '<div class="hint">'+(historical?'الفترة مقفلة خارج النظام؛ بيانات التحويلات الفعلية تظهر أعلاه كما هي ويمكن توثيقها بشكل مستقل.':'البنود الناقصة تحتاج مراجعة قبل اعتماد تسوية جديدة.')+'</div>';
}
window.pawProviderSettlementPeriodChanged=renderProviderSettlementPeriod;
window.pawConfirmPeriodSettlement=async function(direction){
 if(!['admin','accountant'].includes(window.PAWAPP_AUTH?.access?.role))return alert('صلاحية المحاسبة أو الإدارة فقط');
 const from=v('pawSettlementFrom'),to=v('pawSettlementTo');
 const p=model?.providers.find(x=>String(x.id)===String(selectedProvider));
 if(!p||!from||!to||from>to)return alert('حددي تاريخ البداية والنهاية');
 if(from<'2026-10-01')return alert('يوليو وأغسطس وسبتمبر مقفلة؛ تسجيل التسويات الجديدة يبدأ من أكتوبر.');
 const rows=p.lines.filter(l=>l.date>=from&&l.date<=to);
 const due=direction==='pawapp_to_provider'?F.summarize(rows).theirs:F.summarize(rows).ours;
 if(due<=0n)return alert('لا توجد مستحقات مفتوحة لهذا الاتجاه');
 const method=prompt('طريقة التحويل الفعلي (تحويل بنكي / KNET / كاش):','تحويل بنكي');
 if(!method?.trim())return;
 const reference=prompt('رقم مرجع التحويل أو ملاحظة الإثبات:','');
 if(reference===null)return;
 const paidAt=prompt('تاريخ التحويل الفعلي YYYY-MM-DD:',new Date().toISOString().slice(0,10));
 if(!paidAt||!/^\\d{4}-\\d{2}-\\d{2}$/.test(paidAt))return alert('تاريخ غير صحيح');
 if(!confirm('هل تؤكدين أن المبلغ '+cash(due)+' تم تحويله بالكامل فعلياً؟ سيُسجل في العمليات والمالية والتقارير.'))return;
 try{
  const result=await window.PAWAPP_AUTH.client.rpc('test_confirm_provider_period_settlement',{
    p_provider:selectedProvider,p_from:from,p_to:to,p_direction:direction,
    p_method:method.trim(),p_reference:reference,p_paid_at:paidAt,p_expected:Number(F.format(due))
  });
  if(result.error)throw result.error;
  await refresh();
  if(el('pawSettlementFrom'))el('pawSettlementFrom').value=from;
  if(el('pawSettlementTo'))el('pawSettlementTo').value=to;
  renderProviderSettlementPeriod();
  toast('تم اعتماد التسوية وتحديث الحسابات');
 }catch(e){alert('تعذر اعتماد التسوية: '+e.message)}
};

window.pawConfirmZeroSettlement=async function(direction){
 if(!['admin','accountant'].includes(window.PAWAPP_AUTH?.access?.role))return alert('للمحاسبة والإدارة فقط');
 const from=v('pawSettlementFrom'),to=v('pawSettlementTo');
 if(!from||!to||from>to)return alert('اختاري الفترة');
 const ref=prompt('أدخلي مرجع إثبات التسوية السابقة (إيصال أو مرجع تحويل):','');
 if(!ref?.trim())return;
 const date=prompt('تاريخ التسوية الفعلي YYYY-MM-DD:','');
 if(!date||!/^\\d{4}-\\d{2}-\\d{2}$/.test(date))return alert('تاريخ غير صحيح');
 if(!confirm('هل راجعتي إثبات الدفع الفعلي؟ سيُعتمد الإقفال برصيد صفر بدون تسجيل تحويل جديد.'))return;
 try{
 const q=await window.PAWAPP_AUTH.client.rpc('test_confirm_zero_balance_period',{p_provider:selectedProvider,p_from:from,p_to:to,p_direction:direction,p_reference:ref.trim(),p_paid_at:date});
 if(q.error)throw q.error;
 await refresh();el('pawSettlementFrom').value=from;el('pawSettlementTo').value=to;renderProviderSettlementPeriod();
 toast('تم اعتماد التسوية السابقة دون احتساب مبلغ جديد');
 }catch(e){alert('لم تُعتمد التسوية: '+e.message);}
};
function renderProvider(){if(!selectedProvider||!model)return;
const savedFrom=v('pawSettlementFrom'),savedTo=v('pawSettlementTo');const p=model.providers.find(x=>String(x.id)===String(selectedProvider));if(!p)return;const s=p.summary;set('providerDetailName',p.name);set('providerDetailType','الخدمة الأساسية والنقل — كل مبلغ محسوب مرة واحدة');set('pdClients',s.customerCount);set('pdOps',s.caseCount);const pendingCases=new Set(p.lines.filter(actionable).map(l=>l.caseId));set('pdPending',pendingCases.size);set('pdComplete',s.caseCount-pendingCases.size);set('pdSales',cash(s.total));set('pdPaw',cash(s.paw));set('pdOurs',cash(s.ours));set('pdTheirs',cash(s.theirs));
let extra=el('financeProviderCards');if(!extra){extra=document.createElement('div');extra.id='financeProviderCards';extra.className='cards';extra.style.cssText='grid-template-columns:repeat(2,minmax(0,1fr));margin-top:10px';el('pdSales').closest('.cards').after(extra);}extra.innerHTML=metric('حصة الشركة','finProviderShare',cash(s.provider))+metric('حُوّل للشركة','finProviderPaid',cash(s.providerPaid))+metric('المحصّل من العمولة','finProviderCollected',cash(s.pawCollected))+metric('بنود تحتاج مراجعة','finProviderIssues',p.lines.filter(l=>l.issues.length&&!(l.date>='2026-07-01'&&l.date<'2026-10-01')).length);
let period=el('pawProviderSettlementSection');
if(!period){period=document.createElement('section');period.id='pawProviderSettlementSection';period.className='card';period.style.margin='12px 0';el('pdServices').before(period);}
period.innerHTML='<h3>تسويات الشركة حسب الفترة — TEST</h3><div class="grid2"><div class="field"><label>من تاريخ</label><input id="pawSettlementFrom" type="date" onchange="pawProviderSettlementPeriodChanged()"></div><div class="field"><label>إلى تاريخ</label><input id="pawSettlementTo" type="date" onchange="pawProviderSettlementPeriodChanged()"></div></div><div id="pawProviderSettlementPeriod"></div>';
if(savedFrom)el('pawSettlementFrom').value=savedFrom;if(savedTo)el('pawSettlementTo').value=savedTo;
renderProviderSettlementPeriod();
const counts=new Map();p.lines.forEach(l=>counts.set(l.service,(counts.get(l.service)||0)+1));el('pdServices').innerHTML=[...counts].map(([name,n])=>'<div class="kpi-line"><span>'+html(name)+'</span><b>'+n+'</b></div>').join('');
el('pdClientList').innerHTML=p.lines.map(l=>'<div class="card provider"><h3>'+html(l.client)+'</h3><div class="hint">'+caseCode(l.caseId)+' • '+html(l.service)+'</div><div class="miniGrid"><div class="mini"><span>السعر</span><b>'+cash(l.total)+'</b></div><div class="mini"><span>PawApp</span><b>'+cash(l.paw)+'</b></div><div class="mini"><span>الشركة</span><b>'+cash(l.provider)+'</b></div></div><p>'+html(detail(l))+'</p><div class="actions">'+(actionable(l)?actionButton(l):'')+'<button class="btn soft" onclick="openCaseDetails(\''+l.caseId+'\')">العملية</button></div></div>').join('')||'<div class="card">لا توجد عمليات</div>';el('pdExportBtn').onclick=()=>window.exportProviderFullReport(p.id);
}
function renderFollowups(){if(!model)return;
 const pendingBookings=(snapshot?.cases||[]).filter(c=>c.source==='booking_form_test'&&c.workflow_status!=='closed'&&c.workflow_status!=='cancelled'&&(!c.provider_id||Number(c.total_amount||0)<=0||!c.service_name));
 const followupBox=el('followupFinanceList');
 if(followupBox){
  let area=el('pawBookingIntakeReview');
  if(!area){area=document.createElement('section');area.id='pawBookingIntakeReview';followupBox.before(area);}
  area.innerHTML=pendingBookings.length?'<h3>طلبات النموذج — استكمال مباشر من المتابعة</h3>'+pendingBookings.map(c=>{
   const missing=[!c.provider_id?'مقدم الخدمة':null,!c.service_name?'الخدمة':null,Number(c.total_amount||0)<=0?'السعر والعمولة':null].filter(Boolean);
   return '<div class="card"><b>'+html(c.client_name||'عميل')+' — '+caseCode(c.id)+'</b><div class="hint">المطلوب: '+html(missing.join('، '))+'</div><button class="btn primary" onclick="pawBookingReview('+Number(c.id)+')">استكمال الطلب وحساب العمولة</button></div>';
  }).join(''):'';
 }
 if(legacyFollowups)legacyFollowups();renderSeptemberReviews();const lines=model.lines.filter(l=>actionable(l)&&!(l.date>='2026-07-01'&&l.date<'2026-10-01'));const box=el('followupFinanceList');if(box)box.innerHTML=lines.map(l=>'<div class="card provider"><div style="display:flex;justify-content:space-between;gap:10px"><h3>'+html(l.client)+'</h3><span class="status unpaid">'+(l.issues.length?'تأكيد / مراجعة':'مستحقات')+'</span></div><div class="hint">'+caseCode(l.caseId)+' • '+html(providerName(l.providerId))+' • '+(l.component==='transport'?'النقل':'الخدمة')+'</div><h3>'+html(actionLabel(l))+'</h3><div class="hint">'+html(detail(l))+'</div><div class="actions">'+actionButton(l)+'</div></div>').join('')||'<div class="card"><b class="green">تمام ✓</b><div class="hint">لا توجد مستحقات أو بيانات مالية معلقة.</div></div>';
set('fuFinance',new Set(lines.map(l=>l.caseId)).size);const pending=new Set(lines.map(l=>l.caseId));for(const id of ['followupAppointmentList','followupMissingList'])el(id)?.querySelectorAll('[onclick]').forEach(b=>{const m=b.getAttribute('onclick')?.match(/\('([^']+)'/);if(m)pending.add(m[1])});set('followupNavBadge',pending.size);if(el('followupNavBadge'))el('followupNavBadge').style.display=pending.size?'inline-block':'none';set('kNeedsFollowup',pending.size);
}
function isArchivedHistoricalCaseForTable(c){return String(c.workflow_status)==='closed'&&c.client_paid===true&&/\[BULK_IMPORT:2026:(?:7|8|9):ROW:\d+\]/.test(String(c.notes||''));}
function renderCases(){
 if(!model)return;
 const q=v('caseSearch').toLowerCase(),pf=v('caseProviderFilter')||'all',sf=v('caseStatusFilter')||'all';
 const rows=snapshot.cases.slice().reverse().filter(c=>{
  const ls=linesFor(c.id),s=F.summarize(ls);
  if(q&&![caseCode(c.id),c.client_name,c.client_phone,...ls.map(l=>providerName(l.providerId)),...ls.map(l=>l.service),c.pet_type,c.breed,db.staff.find(e=>String(e.id)===String(c.employee_id))?.name].join(' ').toLowerCase().includes(q))return false;
  if(pf!=='all'&&!ls.some(l=>l.providerId===pf))return false;
  if(sf==='client_paid'&&(s.unpaid>0n||s.unknownCount))return false;
  if(sf==='client_unpaid'&&s.unpaid===0n&&!s.unknownCount)return false;
  if(sf==='vendor_unpaid'&&s.theirs===0n)return false;
  if(sf==='vendor_paid'&&s.theirs>0n)return false;
  return true;
 });
 const yesNo=x=>x===true?'نعم':x===false?'لا':'—';
 el('caseRows').innerHTML=rows.map(c=>{
  const ls=linesFor(c.id),s=F.summarize(ls),employee=db.staff.find(e=>String(e.id)===String(c.employee_id));
  const clientTasks=isArchivedHistoricalCaseForTable(c)?[]:ls.filter(l=>l.action==='client_paid'||l.unknown);
  const partnerTasks=isArchivedHistoricalCaseForTable(c)?[]:ls.filter(l=>l.action==='provider_paid'||l.action==='commission_received'||(!l.action&&l.issues.length));
  const paidText=s.unknownCount?'نقل غير مؤكد':s.unpaid>0n?'غير مدفوع':'تم السداد';
  const button='<button class="btn soft" onclick="openCaseDetails(\''+c.id+'\')">فتح العملية</button>';
  return '<tr><td>'+caseCode(c.id)+'</td><td>'+html(c.client_name)+'</td><td>'+html(c.pet_type||'—')+'</td><td>'+html(c.breed||'—')+'</td><td>'+yesNo(c.vaccinated)+'</td><td>'+yesNo(c.microchipped)+'</td><td>'+ls.map(l=>html(providerName(l.providerId))).join('<br>')+'</td><td>'+ls.map(l=>html(l.service)).join('<br>')+'</td>'+['total','paw','provider'].map(k=>'<td>'+cash(s[k])+'</td>').join('')+'<td><span class="status '+(s.unpaid>0n||s.unknownCount?'unpaid':'paid')+'">'+paidText+'</span></td><td>'+html(c.client_due_date||'—')+'</td><td>لنا: '+cash(s.ours)+'<br>علينا: '+cash(s.theirs)+(s.issueCount?'<br><span class="hint">يحتاج مراجعة</span>':'')+'</td><td>'+html(employee?.name||'—')+'<br>'+html(typeof sourceLabel==='function'?sourceLabel(c.source):c.source||'')+'</td><td><span class="hint">'+html(c.workflow_status||'new_request')+'</span><br>'+button+'</td><td>'+clientTasks.map(l=>'<div class="hint">'+html(l.service)+'</div>'+actionButton(l)).join('')+'</td><td>'+partnerTasks.map(l=>'<div class="hint">'+html(l.service)+'</div>'+actionButton(l)).join('')+'</td></tr>';
 }).join('')||'<tr><td colspan="18">لا توجد عمليات</td></tr>';
}
function render(){if(!snapshot)return;hydrate();renderDashboard();renderProviders();renderProvider();renderCases();renderFollowups();}
function dialog(){if(el('financeActionModal'))return;document.body.insertAdjacentHTML('beforeend','<div id="financeActionModal" class="modalBg"><div class="modal"><div class="modalHead"><h3 id="financeActionTitle"></h3><button class="close" onclick="closeModal(\'financeActionModal\')">×</button></div><div id="financeActionBody"></div><div id="financeActionError" class="hint" style="color:#b42318;margin:10px 0" role="alert"></div><button id="financeActionSave" class="btn primary" style="width:100%" onclick="pawFinanceSaveAction()">حفظ وتحديث الحسابات</button></div></div>');}
window.pawBookingReview=function(id){
 if(!mayWrite())return alert('هذه العملية تتطلب صلاحية التعديل');
 if(typeof window.openCaseDetails==='function'){
  window.openCaseDetails(id);
  document.getElementById('completeCaseModal')?.classList.add('show');
 }else alert('تعذر فتح استكمال العملية');
};
window.pawFinanceOpen=function(caseId,component='main'){if(saving)return;const l=findLine(caseId,component);if(!l)return;if(!mayWrite()){alert('مشاهدة فقط');return}dialog();activeAction={caseId:String(caseId),component,revision:l.revision,requestId:crypto.randomUUID(),line:l};set('financeActionTitle',actionLabel(l));set('financeActionError','');let body='<div class="card" style="box-shadow:none"><b>'+html(detail(l))+'</b><div class="hint">'+caseCode(caseId)+' • '+html(providerName(l.providerId))+' • '+(component==='transport'?'النقل':'الخدمة')+'</div></div>';const reviewOnly=!l.action;el('financeActionSave').style.display=reviewOnly?'none':'';if(l.unknown)body+='<div class="field"><label>هل العميل دفع قيمة النقل؟</label><select id="finConfirmPaid"><option value="">اختاري</option><option value="yes">نعم، تم استلامه</option><option value="no">لا، لم يدفع النقل</option></select></div>';
if(l.action==='client_paid'||l.unknown)body+='<div class="field"><label>جهة استلام دفعة العميل</label><select id="finRecipient" onchange="pawFinanceTransportRouteChanged()"><option value="">اختاري جهة الاستلام</option><option value="pawapp">PawApp</option><option value="provider">'+html(providerName(l.providerId))+' مباشرة</option></select></div>';
if(l.component==='transport'&&(l.action==='client_paid'||l.unknown))body+='<div id="finTransportCloseout" class="field" style="display:none"><label id="finTransportCloseoutLabel">إغلاق تسوية النقل بنفس الحفظ؟</label><select id="finTransportCloseoutValue"><option value="no">لا، خلّها بالمتابعة</option><option value="yes">نعم، تمت التسوية</option></select><div class="hint" id="finTransportCloseoutHint">إذا اخترتي نعم، يسجل النظام الطرف الثاني تلقائيًا بنفس عملية الحفظ.</div></div>';
if(l.action==='provider_paid'||l.action==='commission_received')body+='<div class="field"><label>المبلغ المستلم / المحوّل (د.ك)</label><input id="finAmount" type="number" min="0.001" step="0.001" value="'+F.format(l.action==='provider_paid'?l.theirs:l.ours)+'"></div>';
if(!reviewOnly)body+='<div class="grid2"><div class="field"><label>تاريخ الدفع الفعلي</label><input id="finDate" type="date" value="'+localDate()+'"></div><div class="field"><label>طريقة الدفع</label><select id="finMethod"><option>KNET</option><option>تحويل بنكي</option><option>كاش</option><option>رابط دفع</option></select></div></div><div class="field"><label>رقم المرجع / التحويل (اختياري)</label><input id="finReference"></div>';
if(l.issues.length&&!l.unknown)body+='<div class="hint">'+html(review(l))+'</div>';if(reviewOnly)body+='<p>لا تسجلي دفعة إضافية لإخفاء الملاحظة. نراجع التسجيلات المتعارضة أولًا بدون حذفها.</p>';el('financeActionBody').innerHTML=body;el('financeActionModal').classList.add('show');};
function localInput(value){if(!value)return '';const d=new Date(value);return Number.isFinite(d.getTime())?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16):'';}
function localDate(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
window.pawFinanceTransportRouteChanged=function(){if(!activeAction||activeAction.component!=='transport')return;const wrap=el('finTransportCloseout'),label=el('finTransportCloseoutLabel'),hint=el('finTransportCloseoutHint'),recipient=v('finRecipient');if(!wrap)return;wrap.style.display=recipient?'block':'none';if(recipient==='pawapp'){if(label)label.textContent='هل تم دفع مستحق شركة النقل أيضًا؟';if(hint)hint.textContent='نعم = يسجل دفع حصة شركة النقل تلقائيًا بنفس الحفظ. لا = تبقى كمستحق بالمتابعة.';}else if(recipient==='provider'){if(label)label.textContent='هل تم تحصيل حصة PawApp من شركة النقل أيضًا؟';if(hint)hint.textContent='نعم = يسجل تحصيل حصة PawApp تلقائيًا بنفس الحفظ. لا = تبقى كتحصيل مطلوب بالمتابعة.';}};
window.pawFinanceSaveAction=async function(){if(saving||!activeAction||!mayWrite())return;const a=activeAction,l=a.line;let action=l.action;try{if(l.unknown){if(!v('finConfirmPaid'))throw Error('اختاري هل النقل مدفوع.');action=v('finConfirmPaid')==='no'?'confirm_transport_unpaid':'client_paid';}const data={date:v('finDate')||localDate(),method:v('finMethod'),reference:v('finReference')};if(action==='client_paid'){if(!v('finRecipient'))throw Error('اختاري جهة استلام دفعة العميل.');data.recipient=v('finRecipient');}if(['provider_paid','commission_received'].includes(action)){data.amount=F.format(F.minor(v('finAmount')));if(F.minor(data.amount)<=0n)throw Error('أدخلي مبلغًا أكبر من صفر.');}const closeTransport=l.component==='transport'&&action==='client_paid'&&v('finTransportCloseoutValue')==='yes';const recipient=data.recipient;saving=true;el('financeActionSave').disabled=true;await rpc('test_finance_action',{p_case_id:Number(a.caseId),p_component:a.component,p_action:action,p_request_id:a.requestId,p_data:data,p_revision:a.revision});await refresh();if(closeTransport){const next=findLine(a.caseId,'transport');const nextAction=recipient==='pawapp'?'provider_paid':'commission_received';if(next&&next.action===nextAction){const amount=nextAction==='provider_paid'?next.theirs:next.ours;if(amount>0n){await rpc('test_finance_action',{p_case_id:Number(a.caseId),p_component:'transport',p_action:nextAction,p_request_id:crypto.randomUUID(),p_data:{date:data.date,method:data.method,reference:data.reference,amount:F.format(amount)},p_revision:next.revision});await refresh();}}}const nextStep=findLine(a.caseId,a.component);const shouldContinue=!closeTransport&&nextStep&&nextStep.action&&nextStep.action!==action;if(shouldContinue){closeModal('financeActionModal');activeAction=null;toast('تم حفظ الخطوة الأولى • باقي '+actionLabel(nextStep));setTimeout(()=>window.pawFinanceOpen(a.caseId,a.component),80);return;}closeModal('financeActionModal');activeAction=null;toast(closeTransport?'تم تسجيل سداد النقل وتسوية الطرفين بنفس العملية ✓':'تم الحفظ وتحديث حسابات الخدمة والنقل');}catch(e){set('financeActionError',message(e));}finally{saving=false;el('financeActionSave').disabled=false}};
function optionSelect(id,label,values,extra=''){return '<div class="field"><label>'+label+'</label><select id="'+id+'" '+extra+'>'+values.map(([value,name])=>'<option value="'+html(value)+'">'+html(name)+'</option>').join('')+'</select></div>'}
function setup(){const financeGrid=el('cTransportAddon')?.querySelector('.grid2');if(financeGrid&&!el('cFinTransportFeeType')){const d=document.createElement('div');d.className='field';d.innerHTML='<label>طريقة حصة PawApp من النقل</label><select id="cFinTransportFeeType" onchange="calcTransportAddon()"><option value="fixed">مبلغ ثابت من إجمالي النقل</option><option value="percent">نسبة من إجمالي النقل %</option></select>';financeGrid.prepend(d);financeGrid.insertAdjacentHTML('beforeend',optionSelect('cFinTransportPaid','العميل دفع النقل؟',[['no','لا'],['yes','نعم']])+optionSelect('cFinTransportRecipient','دفع النقل لمن؟',[['','اختاري عند الدفع'],['pawapp','PawApp'],['provider','شركة النقل مباشرة']]));}
if(!el('financeGrandTotal'))el('calcTotal')?.closest('.calc')?.insertAdjacentHTML('afterend','<div class="card" style="box-shadow:none;margin-top:10px"><span>الإجمالي شامل النقل: </span><b id="financeGrandTotal"></b></div>');
if(!el('financeEditTransport'))el('editServiceSection')?.insertAdjacentHTML('beforeend','<div id="financeEditTransport" class="field full"><div class="section"><h2>النقل الإضافي وحسابه المستقل</h2></div><div class="grid2">'+optionSelect('eFinTransportProvider','شركة النقل',[['','بدون نقل']])+ '<div class="field"><label>إجمالي سعر النقل (د.ك)</label><input id="eFinTransportTotal" type="number" min="0" step="0.001"></div>'+optionSelect('eFinTransportFeeType','طريقة حصة PawApp',[['fixed','مبلغ ثابت من إجمالي النقل'],['percent','نسبة %']])+'<div class="field"><label>حصة PawApp / النسبة</label><input id="eFinTransportFeeValue" type="number" min="0" step="0.001"></div><div class="field"><label>الاتجاه</label><select id="eFinTransportDirection"><option value="">اختاري</option><option value="pickup">Pickup</option><option value="dropoff">Drop-off</option><option value="both">Pickup + Drop-off</option></select></div><div class="field"><label>الوقت</label><input id="eFinTransportAt" type="datetime-local"></div><div class="field"><label>مكان الاستلام</label><input id="eFinPickup"></div><div class="field"><label>مكان التوصيل</label><input id="eFinDropoff"></div></div><div id="financeEditTransportStatus" class="hint"></div></div>');
}
function pricing(){const q=F.quote(v('cAmount')||0,v('cFeeType'),v('cCommission')||0,v('cFeeType')==='fixed'?'provider_base':'customer_total');set('calcTotal',cash(q.total));set('calcPaw',cash(q.paw));set('calcDue',cash(q.provider));set('calcRemain',cash(q.provider));let total=q.total;if(v('cTransportNeeded')==='yes')total+=F.minor(v('cTransportTotal')||0);set('financeGrandTotal',cash(total));return q;}
window.calcCase=function(){try{pricing()}catch(e){set('calcTotal','راجعي السعر / النسبة');set('calcPaw','—');set('calcDue','—');set('financeGrandTotal','—')}};
window.calcTransportAddon=function(){try{const q=F.quote(v('cTransportTotal')||0,v('cFinTransportFeeType')||'fixed',v('cTransportPaw')||0);if(el('cTransportProviderAmount'))el('cTransportProviderAmount').value=F.format(q.provider);set('calcTransportTotal',cash(q.total));set('calcTransportPaw',cash(q.paw));set('calcTransportProvider',cash(q.provider));window.calcCase()}catch(e){set('calcTransportProvider','راجعي السعر / النسبة')}};
window.calcEditCase=function(){try{const q=F.quote(v('eTotalAmount')||0,v('eFeeType'),v('eFeeValue')||0);el('eProviderAmount').value=F.format(q.provider);set('eFeeValueLabel',v('eFeeType')==='fixed'?'حصة PawApp من الإجمالي (د.ك)':'نسبة PawApp %')}catch(e){el('eProviderAmount').value='سعر غير صحيح'}};
const tri=x=>x==='yes'?true:x==='no'?false:null,iso=x=>x?new Date(x).toISOString():null;
function basics(prefix){const source={client_phone:prefix==='c'?'Phone':'Phone',employee_id:prefix==='c'?'Staff':'Employee',provider_id:'Provider',location:'Location',pet_type:'PetType',breed:'Breed',pet_age:'PetAge',reason:'Reason'};const patch={};for(const[key,suffix]of Object.entries(source))patch[key]=v(prefix+suffix).trim()||null;for(const[key,suffix]of Object.entries({pet_friendly:'PetFriendly',vaccinated:'Vaccinated',microchipped:'Microchipped',has_pet_id:'HasPetId'}))patch[key]=tri(v(prefix+suffix));patch.service_name=v(prefix+'Service')||null;patch.appointment_at=iso(v(prefix+'AppointmentAt'));return patch;}
async function saveAtomic(key,caseId,patch,payments,revision){if(!mayWrite())throw Error('No permission');const payload={p_case_id:caseId,p_patch:patch,p_payments:payments,p_revision:revision};payload.p_request_id=requestFor(key,payload);const result=await rpc('test_finance_save',payload);requests.delete(key);return result;}
window.saveCase=async function(){if(saving)return;try{const patch=basics('c');patch.client_name=v('cClient').trim();if(!patch.client_name||!patch.employee_id||!patch.provider_id||!patch.service_name||!patch.pet_type)throw Error('أكملي العميل والحيوان والموظف ومقدم الخدمة والخدمة.');const q=pricing();if(q.total===0n)throw Error('أدخلي سعر الخدمة.');Object.assign(patch,{total_amount:F.format(q.total),fee_type:v('cFeeType'),fee_value:v('cCommission')||'0',service_date:v('cDate')||localDate(),payment_method:v('cPayMethod'),notes:v('cNotes')||null,client_payment_note:v('cPaymentNote')||null,client_due_date:v('cClientDueDate')||null,source:v('cSource')||'manual_test',requested_service:patch.service_name});const payments={main:{paid:v('cClientPaid')==='paid',recipient:v('cPaidTo')}};if(payments.main.paid&&!payments.main.recipient)throw Error('اختاري جهة استلام دفعة العميل.');if(v('cTransportNeeded')==='yes'){const tq=F.quote(v('cTransportTotal'),v('cFinTransportFeeType')||'fixed',v('cTransportPaw')||'0');if(!v('cTransportProvider')||!v('cTransportDirection')||tq.total===0n)throw Error('أكملي شركة النقل والاتجاه والسعر.');Object.assign(patch,{transport_provider_id:v('cTransportProvider'),transport_total_amount:F.format(tq.total),transport_fee_type:v('cFinTransportFeeType')||'fixed',transport_fee_value:v('cTransportPaw')||'0',transport_direction:v('cTransportDirection'),transport_at:iso(v('cTransportAt')),pickup_location:v('cPickupLocation')||null,dropoff_location:v('cDropoffLocation')||null});payments.transport={paid:v('cFinTransportPaid')==='yes',recipient:v('cFinTransportRecipient')};if(payments.transport.paid&&!payments.transport.recipient)throw Error('اختاري جهة استلام مبلغ النقل.');}saving=true;await saveAtomic('newcase',null,patch,payments,null);await refresh();showPage('cases');toast('تم حفظ الخدمة والنقل والحسابات معًا');}catch(e){alert(message(e))}finally{saving=false}};
window.saveCaseDetails=async function(){if(saving)return;const id=v('editCaseId'),c=snapshot?.cases.find(x=>String(x.id)===id);if(!c)return;try{const patch=basics('e');Object.assign(patch,{total_amount:v('eTotalAmount')||'0',fee_type:v('eFeeType'),fee_value:v('eFeeValue')||'0',payment_method:v('ePaymentMethod'),client_due_date:v('eClientDueDate')||null});F.quote(patch.total_amount,patch.fee_type,patch.fee_value);const payments={main:{paid:v('eClientPaid')==='paid',recipient:v('ePaidTo'),...(v('ePawappCollected')==='yes'?{commission_received:true}:{})}};if(payments.main.paid&&!payments.main.recipient)throw Error('اختاري جهة استلام دفعة العميل.');const tp=v('eFinTransportProvider');if(tp){F.quote(v('eFinTransportTotal')||'0',v('eFinTransportFeeType'),v('eFinTransportFeeValue')||'0');Object.assign(patch,{transport_provider_id:tp,transport_total_amount:v('eFinTransportTotal')||'0',transport_fee_type:v('eFinTransportFeeType'),transport_fee_value:v('eFinTransportFeeValue')||'0',transport_direction:v('eFinTransportDirection')||null,transport_at:iso(v('eFinTransportAt')),pickup_location:v('eFinPickup')||null,dropoff_location:v('eFinDropoff')||null});}else if(c.transport_provider_id){Object.assign(patch,{transport_provider_id:null,transport_total_amount:'0',transport_fee_type:'fixed',transport_fee_value:'0'});}saving=true;await saveAtomic('edit-'+id,Number(id),patch,payments,editorRevision);closeModal('completeCaseModal');await refresh();toast('تم الحفظ وتحديث الحسابات');}catch(e){alert(message(e))}finally{saving=false}};
window.openCaseDetails=function(id){hydrate();legacyOpen(id);const c=snapshot?.cases.find(x=>String(x.id)===String(id));if(!c)return;editorRevision=c.finance_revision||0;const tp=el('eFinTransportProvider');if(tp){tp.innerHTML='<option value="">بدون نقل</option>'+snapshot.providers.map(p=>'<option value="'+p.id+'">'+html(p.name)+'</option>').join('');tp.value=c.transport_provider_id||'';}for(const[k,value]of Object.entries({eFinTransportTotal:c.transport_total_amount||0,eFinTransportFeeType:c.transport_fee_type||'fixed',eFinTransportFeeValue:c.transport_fee_value??c.transport_pawapp_amount??0,eFinTransportDirection:c.transport_direction||'',eFinTransportAt:localInput(c.transport_at),eFinPickup:c.pickup_location||'',eFinDropoff:c.dropoff_location||''}))if(el(k))el(k).value=value;const tl=findLine(id,'transport');if(el('financeEditTransportStatus'))el('financeEditTransportStatus').innerHTML=tl?html(detail(tl))+'<div class="actions">'+(actionable(tl)?actionButton(tl):'')+'</div>':'';
const ls=linesFor(id),pending=ls.filter(actionable);if(!pending.length)set('workflowTaskLabel','لا توجد مستحقات مالية ناقصة');else set('workflowTaskLabel',pending.map(l=>(l.component==='transport'?'النقل: ':'الخدمة: ')+detail(l)).join(' • '));if(c.appointment_at&&el('eAppointmentAt')){const d=new Date(c.appointment_at);el('eAppointmentAt').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
};
const oldFocusedEditor=window.openCaseWorkflow;
window.openCaseWorkflow=function(id,mode){if(mode==='finance'){const pending=linesFor(id).find(actionable);if(pending){window.pawFinanceOpen(id,pending.component);return;}}oldFocusedEditor(id,mode);};
window.openNewCase=function(){legacyNewCase();for(const[k,value]of Object.entries({cFinTransportFeeType:'fixed',cFinTransportPaid:'no',cFinTransportRecipient:''})){if(el(k))el(k).value=value;}window.calcCase();};
window.openSettlement=id=>window.pawFinanceOpen(id,'main');window.openClientPayment=id=>window.pawFinanceOpen(id,'main');window.saveSettlement=()=>{alert('افتحي المستحق من زر الدفع المخصص.');};window.saveClientPayment=window.saveSettlement;
window.exportProviderFullReport=function(id){
 const p=model.providers.find(x=>String(x.id)===String(id));if(!p)return;
 const from=v('pawSettlementFrom'),to=v('pawSettlementTo');
 const lines=p.lines.filter(l=>(!from||l.date>=from)&&(!to||l.date<=to));
  const report=F.csv(lines,p.name);
 const bom=report.startsWith('\ufeff')?'\ufeff':'';
 const plain=bom?report.slice(1):report;
 const rows=plain.trimEnd().split(/\r?\n/);
 const columns=['حالة الفترة','مرجع العملية','ملاحظة التسوية'];
 const historical=from>='2026-07-01'&&to<'2026-10-01';
 const header=rows.shift()+','+columns.map(csvCell).join(',');
 const body=rows.map((row,i)=>{
  if(i>=lines.length)return row+','+['','',''].map(csvCell).join(',');
  const l=lines[i];
  const status=historical?'مقفل تاريخياً':l.issues.length?'تحتاج مراجعة':l.ours>0n?'مستحق لـ PawApp على الشركة':l.theirs>0n?'مستحق للشركة على PawApp':l.isPaid?'لا توجد مستحقات':'العميل لم يسدد';
  return row+','+[status,caseCode(l.caseId),historical?'إقفال تاريخي، ليس إثبات تحويل':'تراجع مع سجل التسويات'].map(csvCell).join(',');
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
 const reportLines=p.lines.filter(l=>(!from||l.date>=from)&&(!to||l.date<=to));
 const historical=from>='2026-07-01'&&to<'2026-10-01';
 const reportRows=reportLines.map(l=>{
  const status=historical?'مقفل تاريخياً':l.issues.length?'تحتاج مراجعة':l.ours>0n?'الشركة مطالبة لـ PawApp':l.theirs>0n?'PawApp مطالبة للشركة':l.isPaid?'لا توجد مستحقات':'العميل لم يسدد';
  const route=l.route==='pawapp'?'PawApp':l.route==='provider'?'الشركة':'غير محدد';
  return '<tr>'+[caseCode(l.caseId),l.date,l.client,l.phone,l.service,providerName(l.providerId),cash(l.total),cash(l.paw),cash(l.provider),cash(l.paid),route,historical?'إقفال تاريخي':cash(l.providerPaid),historical?'إقفال تاريخي':cash(l.commissionReceived),cash(l.ours),cash(l.theirs),status].map(x=>'<td>'+safe(x)+'</td>').join('')+'</tr>';
 }).join('');
 const detailTable='<h2>تفاصيل العمليات والمطالبات</h2><table class="reportDetails"><thead><tr>'+['العملية','التاريخ','العميل','الهاتف','الخدمة','الشركة','الإجمالي','حصة PawApp','حصة الشركة','دفع العميل','استلم العميل لدى','دُفع للشركة','حُصّلت العمولة','للـ PawApp على الشركة','للشركة على PawApp','الحالة'].map(x=>'<th>'+safe(x)+'</th>').join('')+'</tr></thead><tbody>'+reportRows+'</tbody></table>';
 w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>PawApp - '+safe(p.name)+'</title><style>body{font:15px Arial,sans-serif;color:#142b49;margin:32px}header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #163e76;padding-bottom:18px;margin-bottom:20px}header img{width:76px;height:76px;object-fit:contain}h1{font-size:24px;margin:0}.miniGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}.mini{border:1px solid #dce4ed;border-radius:9px;padding:12px}.mini span{display:block;color:#687c91}.mini b{display:block;margin-top:7px}button{display:none}.reportDetails{width:100%;border-collapse:collapse;font-size:10px;direction:rtl}.reportDetails th,.reportDetails td{border:1px solid #dce4ed;padding:5px;text-align:right}.reportDetails th{background:#eaf0f7}.hint{color:#687c91;margin:12px 0}@media print{body{margin:15mm}}</style></head><body><header>'+(logo?'<img src="'+logo+'" alt="PawApp">':'')+'<div><h1>PawApp Concierge</h1><strong>تقرير تسويات الشركة — '+safe(p.name)+'</strong><p>'+safe(from)+' — '+safe(to)+'</p></div></header>'+section.innerHTML+detailTable+'<p class="hint">تقرير من نظام TEST — ليس إيصال تحويل بنكي</p></body></html>');
 w.document.close();w.focus();setTimeout(()=>w.print(),500);
};
window.exportProviderReport=window.exportProviderFullReport;
function csvCell(value){let s=String(value??'');if(/^[\\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name.replace(/[\\/]/g,'-');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
window.downloadTestBackup=async function(){try{const data=await rpc('test_finance_backup');download(JSON.stringify(data,null,2),'pawapp-test-finance-backup-'+localDate()+'.json','application/json');toast('تم تجهيز نسخة TEST الاحتياطية');}catch(e){alert(message(e))}};
window.renderDashboard=renderDashboard;window.renderProviders=renderProviders;window.renderCases=renderCases;window.renderAutomaticFollowups=renderFollowups;window.loadData=refresh;window.renderAll=function(){render();};
window.openProviderCRM=function(id){selectedProvider=id;if(el('pawSettlementFrom'))el('pawSettlementFrom').value='';if(el('pawSettlementTo'))el('pawSettlementTo').value='';legacyShowPage('providerdetail');renderProvider();};window.providerCases=window.openProviderCRM;
window.showPage=async function(id){if(id==='admin'&&!window.pawIsAdmin()){toast('Admin only');return;}await legacyShowPage(id);if(id==='dashboard')renderDashboard();if(id==='providers')renderProviders();if(id==='cases')renderCases();if(id==='followups')renderFollowups();};
setup();await refresh();if(typeof fillProviders==='function')fillProviders();if(typeof fillStaff==='function')fillStaff();window.PAW_FINANCE_READY=true;window.PAW_FINANCE_VERSION='finance-v3';
};
