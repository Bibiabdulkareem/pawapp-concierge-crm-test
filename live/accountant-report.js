/* PawApp LIVE – month-first accountant report. Read from the same finance-v3 snapshot as partner balances. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const kd=v=>(window.PawFinanceCore?.format(v??0n)||'0.000')+' د.ك';
const number=v=>Number(v||0);
const rowId=id=>'PAW-'+String(id).padStart(4,'0');
const labelSource=c=>c?.source==='pet_information_form'?'Pet Information':'Concierge';
const monthRange=m=>{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m))throw Error('اختاري شهر صحيح');
  const y=Number(m.slice(0,4)),mo=Number(m.slice(5));
  return {from:m+'-01',to:new Date(Date.UTC(y,mo,0)).toISOString().slice(0,10)};
};
const role=()=>window.PAWAPP_AUTH?.access?.role||document.body.dataset.pawRole||'';
const canApprove=()=>['accountant','admin'].includes(role());
let latest=null,request=0,busy=false,pending=null;
function reason(c,l,services){
 const notes=[];
 if(!c?.provider_id && l.component==='main' && l.total>0n)notes.push('مقدم الخدمة غير محدد');
 if(l.component==='main' && l.isPaid && c?.provider_id && (!c.service_id || !services.has(String(c.provider_id)+'|'+String(c.service_id))))notes.push('الخدمة غير مربوطة بمقدمها');
 if(l.component==='main' && l.isPaid && l.total>0n && number(c?.main_paid_recorded)===0)notes.push('مدفوع بحسب الحالة بدون قيد تحصيل مستقل');
 if(l.issues?.length)notes.push('مراجعة مالية: '+l.issues.join(', '));
 return [...new Set(notes)];
}
function compute(snapshot,periodSettlements,month){
 const F=window.PawFinanceCore,{from,to}=monthRange(month);
 const catalog=new Set((snapshot.services||[]).map(x=>String(x.provider_id)+'|'+String(x.id)));
 const pmap=new Map((snapshot.providers||[]).map(x=>[String(x.id),x.name]));
 const all=F.allLines(snapshot.cases||[]);
 const excluded=all.filter(l=>l.date>=from&&l.date<=to&&(l.cancelled || l.caseId==='418'));
 const lines=all.filter(l=>l.date>=from&&l.date<=to&&!l.cancelled&&l.caseId!=='418');
 const groups=new Map(),reviews=[];
 for(const l of lines){
   const c=l.raw||{};
   const id=l.providerId||'missing';
   if(!groups.has(id))groups.set(id,{id,name:pmap.get(id)||'مقدم خدمة غير محدد',lines:[],issues:new Set(),blocked:false});
   const g=groups.get(id);g.lines.push(l);
   const issues=reason(c,l,catalog);
   if(issues.length){
     g.blocked=true;
     issues.forEach(i=>{g.issues.add(i);reviews.push({caseId:l.caseId,client:l.client,date:l.date,provider:g.name,source:labelSource(c),issue:i,amount:F.format(l.total)});});
   }
   if(l.total<=0n)g.blocked=true;
 }
 for(const l of excluded){
   const type=l.caseId==='418'?'عملية تجريبية مستبعدة من الحسابات':'عملية ملغاة / مسترجعة مستبعدة من الإجمالي';
   reviews.push({caseId:l.caseId,client:l.client,date:l.date,provider:pmap.get(l.providerId)||'',source:labelSource(l.raw),issue:type,amount:F.format(l.raw?.total_amount??0)});
   const g=groups.get(l.providerId);
   if(g){g.blocked=true;g.hasCancelled=true;} // The server refuses month-wide settlement when a cancelled case is present.
 }
 const undated=(snapshot.cases||[]).filter(c=>!c.service_date&&(
   (month==='2026-10' && (String(c.notes||'').includes('DRMICHAEL_SHEET_2026_10')||String(c.intake_details?.importSource||'').includes('Oct2026'))) ||
   (String(c.notes||'').includes('BULK_IMPORT:2026:'+Number(month.slice(5))+':'))
 ));
 for(const c of undated)reviews.push({caseId:String(c.id),client:c.client_name,date:'—',provider:pmap.get(String(c.provider_id))||'غير محدد',source:labelSource(c),issue:'تاريخ الخدمة ناقص — غير داخل في إجمالي الشهر',amount:String(c.total_amount??0)});
 const approved=(periodSettlements||[]).filter(x=>x.period_from<=to&&x.period_to>=from);
 // Review possible double entries from the same pet-owner/form before a provider is paid twice.
 const byOwner=new Map();
 for(const l of lines){
   if(l.component!=='main'||l.raw?.source!=='pet_information_form')continue;
   const c=l.raw||{},civil=String(c.intake_details?.civil_id||'').trim();
   if(!civil||!c.provider_id||!c.service_date||l.total<=0n)continue;
   const key=[civil,c.provider_id,c.service_date,F.format(l.total)].join('|');
   if(!byOwner.has(key))byOwner.set(key,[]);
   byOwner.get(key).push(l);
 }
 for(const entries of byOwner.values()){
   if(entries.length<2)continue;
   const codes=entries.map(l=>rowId(l.caseId)).join(' / ');
   for(const l of entries){
     const providerId=l.providerId, g=groups.get(providerId);
     if(g){g.blocked=true;g.issues.add('احتمال تكرار — راجعي الفاتورتين');}
     reviews.push({caseId:l.caseId,client:l.client,date:l.date,
       provider:pmap.get(providerId)||'غير محدد',source:labelSource(l.raw),
       issue:'حالتان بنفس صاحب الحيوان والدكتور والتاريخ والمبلغ ('+codes+'). تأكدي أن كل حالة خدمة مختلفة قبل اعتماد تسوية إضافية.',
       amount:F.format(l.total)});
   }
 }
 for(const g of groups.values()){
   g.summary=F.summarize(g.lines);
   g.approved=approved.filter(x=>String(x.provider_id)===g.id);
   g.flaggedNoReceipt=g.lines.filter(l=>l.component==='main'&&l.isPaid&&l.total>0n&&number(l.raw?.main_paid_recorded)===0).length;
   g.pending= g.summary.ours>0n||g.summary.theirs>0n;
   g.noClose=Boolean(g.hasCancelled)||g.lines.some(l=>l.isPaid&&l.issues.length); // Unpaid follow-ups do not block settling already-paid cases.
   g.zeroCloseBlocked=g.blocked||g.lines.some(l=>l.total<=0n||l.issues.length||!l.isPaid||l.component!=='main');
 }
 const totals=F.summarize(lines);
 return {snapshot,month,from,to,lines,groups:[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'ar')),reviews,undated,excluded,totals,periodSettlements:approved};
}
async function load(){
 const c=window.PAWAPP_AUTH?.client;
 if(!c||!window.PawFinanceCore)throw Error('البيانات المالية غير جاهزة. سجلي الدخول أو حدّثي الصفحة.');
 const [s,p]=await Promise.all([
   c.rpc('test_finance_snapshot'),
   c.from('test_provider_period_settlements').select('id,provider_id,period_from,period_to,direction,status,amount,paid_at,method,reference,approved_at')
 ]);
 if(s.error)throw Error(s.error.message);
 if(p.error)throw Error('تعذر قراءة سجل التسويات: '+p.error.message);
 return {snapshot:s.data,periodSettlements:p.data||[]};
}
function stat(title,value){return '<div class="card stat" style="min-width:0"><span>'+esc(title)+'</span><b style="font-size:clamp(14px,2vw,20px)">'+esc(value)+'</b></div>';}
function groupStatus(g,dir){
 const due=dir==='pawapp_to_provider'?g.summary.theirs:g.summary.ours;
 const approved=g.approved.some(x=>x.direction===dir);
 if(g.blocked)return 'تحتاج مراجعة';
 if(due>0n)return 'مستحق مفتوح';
 if(approved)return 'الشهر معتمد';
 if(g.lines.some(l=>l.isPaid))return 'لا يوجد متبقٍ — الاعتماد منفصل';
 return 'بانتظار العميل';
}
function action(g,dir){
 const due=dir==='pawapp_to_provider'?g.summary.theirs:g.summary.ours;
 const approved=g.approved.some(x=>x.direction===dir);
 if(!canApprove()||g.id==='missing'||(due>0n?g.noClose:g.zeroCloseBlocked)||approved)return '';
 const route=dir==='pawapp_to_provider'?'pawapp':'provider';
 const relevant=g.lines.some(l=>l.isPaid&&l.route===route&&l.total>0n);
 if(!relevant)return '';
 if(due<=0n && g.lines.some(l=>l.component==='transport'))return '';
 return '<button type="button" class="btn '+(due>0n?'primary':'soft')+'" data-account-provider="'+esc(g.id)+'" data-account-direction="'+dir+'" style="white-space:normal;margin:2px">'+
  (due>0n?'تأكيد دفع / تحصيل '+kd(due):'اعتماد إقفال سابق')+'</button>';
}
function renderView(s){
 const F=window.PawFinanceCore;
 const paidCases=new Set(s.lines.filter(l=>l.isPaid).map(l=>l.caseId)).size;
 const missingReceipts=s.lines.filter(l=>l.component==='main'&&l.isPaid&&l.total>0n&&number(l.raw?.main_paid_recorded)===0).length;
 $('pawAccountStatus').textContent='شهر '+s.month+' | يشمل Concierge وPet Information تلقائياً — كل الجهات في تقرير واحد. الأرقام من LIVE، وليست إثباتاً بنكياً مستقلاً.';
 $('pawAccountCards').innerHTML=[
  stat('العمليات المحتسبة',s.totals.caseCount),
  stat('إجمالي الخدمات',kd(s.totals.total)),
  stat('حصة باو أب',kd(s.totals.paw)),
  stat('حصة مقدمي الخدمات',kd(s.totals.provider)),
  stat('العملاء دفعوا (مسجل)',kd(s.totals.paid)),
  stat('دُفع لمقدمي الخدمات',kd(s.totals.providerPaid)),
  stat('لنا على الجهات',kd(s.totals.ours)),
  stat('للجهات علينا',kd(s.totals.theirs))
 ].join('');
 $('pawAccountStats').textContent='مدفوع من العملاء: '+paidCases+' عملية | بدون قيد تحصيل منفصل: '+missingReceipts+' | بنود مراجعة: '+s.reviews.length+' | عمليات بلا تاريخ مرجّح لهذا الشهر: '+s.undated.length;
 const tbody=$('pawAccountCompanies');tbody.replaceChildren();
 for(const g of s.groups){
   const tr=document.createElement('tr');
   const cells=[
    g.name,g.summary.caseCount,
    F.format(g.summary.total),F.format(g.summary.paw),F.format(g.summary.provider),
    F.format(g.summary.providerPaid),F.format(g.summary.commissionReceived),
    F.format(g.summary.ours),F.format(g.summary.theirs)
   ];
   for(const v of cells){const td=document.createElement('td');td.textContent=String(v);tr.appendChild(td);}
   const status=document.createElement('td');
   status.textContent=g.blocked?'تحتاج مراجعة':g.pending?'مستحقات مفتوحة':g.approved.length?'شهر معتمد':'لا متبقي / إقفال غير معتمد';
   tr.appendChild(status);
   const buttons=document.createElement('td');
   buttons.innerHTML=action(g,'pawapp_to_provider')+action(g,'provider_to_pawapp');
   if(g.id!=='missing'){
     const detail=document.createElement('button');detail.type='button';detail.className='btn soft';
     detail.textContent='تفاصيل';detail.dataset.accountDetails=g.id;buttons.appendChild(detail);
   }
   tr.appendChild(buttons);tbody.appendChild(tr);
 }
 const review=$('pawAccountReview');review.replaceChildren();
 if(!s.reviews.length){review.textContent='ما في بنود مراجعة ضمن هذا الشهر.';}
 else {
  const t=document.createElement('table');t.style.minWidth='600px';
  t.innerHTML='<thead><tr><th>العملية</th><th>العميل</th><th>الشركة</th><th>الملاحظة</th></tr></thead>';
  const body=document.createElement('tbody');
  for(const x of s.reviews){
   const tr=document.createElement('tr');
   [rowId(x.caseId),x.client,x.provider,x.issue].forEach(v=>{const td=document.createElement('td');td.textContent=String(v??'');tr.appendChild(td);});
   body.appendChild(tr);
  }
  t.appendChild(body);const wrap=document.createElement('div');wrap.style.overflowX='auto';wrap.appendChild(t);review.appendChild(wrap);
 }
 $('pawAccountExport').disabled=false;
}
async function render(){
 const month=$('pawAccountMonth')?.value;if(!month)return;
 const token=++request; $('pawAccountExport').disabled=true;
 $('pawAccountStatus').textContent='جاري تحميل التقرير المالي ومطابقة جميع الشركات من LIVE...';
 try{
  const data=await load();
  if(token!==request)return;
  latest=compute(data.snapshot,data.periodSettlements,month);
  renderView(latest);
 }catch(e){if(token!==request)return;latest=null;$('pawAccountStatus').textContent='تعذر تحميل تقرير المحاسب: '+String(e.message||e);$('pawAccountCompanies').replaceChildren();$('pawAccountCards').replaceChildren();}
}
window.pawAccountantRender=render;
function excelSafe(v){
 if(typeof v==='number')return v;
 const s=String(v??'');
 return /^[\s]*[=+@-]/.test(s)?"'"+s:s;
}
function workbookSheet(rows){return XLSX.utils.aoa_to_sheet(rows.map(r=>r.map(excelSafe)));}
window.pawAccountantExportExcel=function(){
 const s=latest;if(!s || $('pawAccountMonth').value!==s.month)return alert('اضغطي عرض التقرير أولاً');
 if(!window.XLSX)return alert('مكتبة Excel غير متاحة الآن');
 const F=window.PawFinanceCore;
 const groupRows=[['PawApp Concierge — monthly accountant settlement','Month: '+s.month],
 ['This workbook includes ALL sources. Service-date basis. Excludes cancelled cases and PAW-0418 test.'],
 ['Provider','Cases','Service total KWD','PawApp share KWD','Provider share KWD','Received from clients (registered) KWD','Provider paid KWD','Commission received from provider KWD','Due to PawApp KWD','Due to provider KWD','Status','Period approved'],
 ...s.groups.map(g=>[g.name,g.summary.caseCount,Number(F.format(g.summary.total)),Number(F.format(g.summary.paw)),Number(F.format(g.summary.provider)),Number(F.format(g.summary.paid)),Number(F.format(g.summary.providerPaid)),Number(F.format(g.summary.commissionReceived)),Number(F.format(g.summary.ours)),Number(F.format(g.summary.theirs)),g.blocked?'Review':g.pending?'Pending':'No balance',g.approved.length?'Yes':'No']),
 ['TOTAL',s.totals.caseCount,Number(F.format(s.totals.total)),Number(F.format(s.totals.paw)),Number(F.format(s.totals.provider)),Number(F.format(s.totals.paid)),Number(F.format(s.totals.providerPaid)),Number(F.format(s.totals.commissionReceived)),Number(F.format(s.totals.ours)),Number(F.format(s.totals.theirs))]];
 const pmap=new Map((s.snapshot.providers||[]).map(p=>[String(p.id),p.name]));
 const detailRows=[['Case ID','Service date','Source','Provider','Client','Phone','Service','Component','Total KWD','PawApp share KWD','Provider share KWD','Customer paid (registered) KWD','Receipt ledger KWD','Client payment recipient','Paid to provider KWD','Commission collected KWD','Due to PawApp KWD','Due to provider KWD','Review flags'],
 ...s.lines.map(l=>[rowId(l.caseId),l.date,labelSource(l.raw),pmap.get(l.providerId)||'Unassigned',l.client,l.phone,l.service,l.component,Number(F.format(l.total)),Number(F.format(l.paw)),Number(F.format(l.provider)),Number(F.format(l.paid)),number(l.raw?.[l.component==='main'?'main_paid_recorded':'transport_paid_recorded']),l.route,Number(F.format(l.providerPaid)),Number(F.format(l.commissionReceived)),Number(F.format(l.ours)),Number(F.format(l.theirs)),reason(l.raw,l,new Set((s.snapshot.services||[]).map(x=>String(x.provider_id)+'|'+String(x.id)))).join(' / ')])];
 const reviews=[['Case ID','Client','Service date','Provider','Source','Review reason','Amount KWD'],
 ...s.reviews.map(x=>[rowId(x.caseId),x.client,x.date,x.provider,x.source,x.issue,number(x.amount)])];
 const approvals=[['Provider','Direction','Period from','Period to','Amount KWD','Reference','Method','Payment date','Status'],
 ...s.periodSettlements.map(x=>[pmap.get(String(x.provider_id))||x.provider_id,x.direction,x.period_from,x.period_to,number(x.amount),x.reference,x.method,x.paid_at,x.status])];
 const wb=XLSX.utils.book_new();
 for(const [name,rows] of [['ملخص الشركات',groupRows],['تفاصيل العمليات',detailRows],['تحتاج مراجعة',reviews],['التسويات المعتمدة',approvals]]){
  const sheet=workbookSheet(rows);
  sheet['!cols']=rows[0].map((_,i)=>({wch:Math.min(46,Math.max(16,i===0?27:22))}));
  XLSX.utils.book_append_sheet(wb,sheet,name);
 }
 XLSX.writeFile(wb,'PawApp-Accounting-'+s.month+'.xlsx',{compression:true});
};
function openApproval(id,direction){
 const s=latest;if(!s||!canApprove())return alert('الاعتماد للمحاسب أو الإدارة فقط');
 const g=s.groups.find(x=>x.id===id);
 if(!g||(g.summary[direction==='pawapp_to_provider'?'theirs':'ours']>0n?g.noClose:g.zeroCloseBlocked)||g.approved.some(x=>x.direction===direction))return alert('هذه الجهة تحتاج مراجعة أو تسويتها معتمدة مسبقاً.');
 const amount=direction==='pawapp_to_provider'?g.summary.theirs:g.summary.ours;
 const route=direction==='pawapp_to_provider'?'pawapp':'provider';
 if(!g.lines.some(l=>l.isPaid&&l.route===route&&l.total>0n))return alert('لا توجد عملية مستحقة بهذا الاتجاه');
 pending={id,direction,amount,month:s.month,from:s.from,to:s.to,name:g.name};
 $('pawAccountingSettleTitle').textContent=amount>0n?
  (direction==='pawapp_to_provider'?'تأكيد تحويل من باو أب إلى ':'تأكيد تحصيل باو أب من ')+g.name+' — '+kd(amount):
  'اعتماد إقفال سابق: '+g.name+' — دون تسجيل تحويل جديد';
 $('pawAccountingSettleMethod').value='';
 $('pawAccountingSettleRef').value='';
 $('pawAccountingSettleDate').value='';
 $('pawAccountingSettleHelp').textContent=amount>0n?'اعتمدي فقط بعد تحويل/تحصيل المبلغ فعلياً. يلزم تاريخ العملية الحقيقي ومرجع التحويل.':'الإقفال يؤكد سداداً سابقاً، ولا يخصم مبلغاً جديداً. أدخلي مرجع وتاريخ إثبات التسوية السابقة.';
 $('pawAccountingSettleModal').classList.add('show');
}
window.pawAccountantCloseSettlement=function(){if(busy)return;$('pawAccountingSettleModal').classList.remove('show');pending=null;};
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;return !Number.isNaN(new Date(s+'T00:00:00Z').valueOf())&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
window.pawAccountantConfirmSettlement=async function(){
 if(busy||!pending||!canApprove())return;
 const p=pending,method=$('pawAccountingSettleMethod').value,reference=$('pawAccountingSettleRef').value.trim(),paidAt=$('pawAccountingSettleDate').value;
 if(p.amount>0n&&!method)return alert('اختاري طريقة الدفع / التحصيل');
 if(!reference)return alert('أدخلي مرجع التحويل أو إثبات التسوية');
 const today=new Date();const kuwait=new Date(today.getTime()+3*3600000).toISOString().slice(0,10);
 if(!validDate(paidAt)||paidAt>kuwait)return alert('اختاري تاريخ السداد الحقيقي الصحيح، ولا تختاري تاريخاً مستقبلياً');
 if(!confirm((p.amount>0n?'هل تؤكدين أن المبلغ '+kd(p.amount)+' تم دفعه/تحصيله فعلياً؟':'هل راجعتي إثبات التسوية السابقة لاعتماد الإقفال؟')+'\nالجهة: '+p.name+'\nالمرجع: '+reference+'\nالتاريخ: '+paidAt))return;
 busy=true;$('pawAccountingSettleSave').disabled=true;
 try{
   const fresh=await load(),now=compute(fresh.snapshot,fresh.periodSettlements,p.month);
   const g=now.groups.find(x=>x.id===p.id);
   if(!g||(p.amount>0n?g.noClose:g.zeroCloseBlocked)||g.approved.some(x=>x.direction===p.direction))throw Error('تغيّرت حالة الجهة أو توجد تسوية معتمدة. حدّثي التقرير.');
   const current=p.direction==='pawapp_to_provider'?g.summary.theirs:g.summary.ours;
   if(current!==p.amount)throw Error('تغير المبلغ منذ فتح النافذة. حدّثي التقرير أولاً.');
   let result;
   if(p.amount>0n){
     result=await window.PAWAPP_AUTH.client.rpc('test_confirm_provider_period_settlement',{
       p_provider:p.id,p_from:p.from,p_to:p.to,p_direction:p.direction,
       p_method:method,p_reference:reference,p_paid_at:paidAt,
       p_expected:Number(window.PawFinanceCore.format(p.amount))
     });
   }else{
     result=await window.PAWAPP_AUTH.client.rpc('test_confirm_zero_balance_period',{
       p_provider:p.id,p_from:p.from,p_to:p.to,p_direction:p.direction,
       p_reference:reference,p_paid_at:paidAt
     });
   }
   if(result.error)throw Error(result.error.message);
   $('pawAccountingSettleModal').classList.remove('show');
   pending=null;await render();
   if(typeof window.pawFinanceRefresh==='function')await window.pawFinanceRefresh();
   alert('تم اعتماد التسوية وتحديث التقرير. لا توجد دفعة مكررة.');
 }catch(e){alert('لم تُعتمد التسوية: '+String(e.message||e));}
 finally{busy=false;$('pawAccountingSettleSave').disabled=false;}
};
document.addEventListener('click',e=>{
 const detail=e.target.closest('[data-account-details]');
 if(detail&&latest){
  const g=latest.groups.find(x=>x.id===detail.dataset.accountDetails);
  if(g&&typeof window.pawOpenMonthlyProvider==='function')window.pawOpenMonthlyProvider(g.id,latest.month,'all');
  return;
 }
 const approve=e.target.closest('[data-account-provider][data-account-direction]');
 if(approve)openApproval(approve.dataset.accountProvider,approve.dataset.accountDirection);
});
})();
