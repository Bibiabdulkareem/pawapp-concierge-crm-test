/* Accountant month report v2: paid-only accounting register; source-sheet period for undated imports. */
(function(){
"use strict";
const E=id=>document.getElementById(id);
const F=()=>window.PawFinanceCore;
const money=n=>F().format(n==null?0n:n);
const fmt=n=>money(n)+" د.ك";
const number=n=>Number(n||0);
const code=id=>"PAW-"+String(id).padStart(4,"0");
const sourceName=c=>c.source==="pet_information_form"?"Pet Information":"Concierge";
const affiliation=()=>window.PawProviderAffiliations;
const clinicOf=id=>affiliation()?.clinicFor(id)||"";
const clinicDoctors=()=>affiliation()?.doctors||[];
const clinicReportGroups=s=>s.groups.filter(g=>!!clinicOf(g.id));
const clinicReportLines=s=>clinicReportGroups(s).flatMap(g=>g.lines);
const monthEnd=m=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0)).toISOString().slice(0,10);
const isSheetOctober=c=>String(c.service_date||"")==="" && ["466","467","468","469"].includes(String(c.id)) && c.intake_details?.importSource==="DrMichael_staff_sheet_Oct2026";
let report=null,sequence=0,approving=false,approval=null;
function role(){return window.PAWAPP_AUTH?.access?.role||document.body.dataset.pawRole||"";}
function accountant(){return ["admin","accountant"].includes(role());}
function include(l,m){
 const c=l.raw||{},id=String(l.caseId);
 if(l.cancelled||id==="418"||l.total<=0n||!l.isPaid||!["pawapp","provider"].includes(l.route))return false;
 if(c.service_date && String(c.service_date).slice(0,7)===m)return true;
 return m==="2026-10" && isSheetOctober(c);
}
function tally(snap,settlements,month){
 const cats=new Map((snap.providers||[]).map(p=>[String(p.id),p.name]));
 const services=new Set((snap.services||[]).map(x=>String(x.provider_id)+"|"+String(x.id)));
 const paid=F().allLines(snap.cases||[]).filter(l=>include(l,month));
 const groups=new Map(),reviews=[];
 for(const l of paid){
   const c=l.raw||{},id=l.providerId||"missing";
   if(!groups.has(id))groups.set(id,{id,name:cats.get(id)||"مقدم خدمة غير محدد",lines:[],review:false});
   const g=groups.get(id);g.lines.push(l);
   if(id==="missing"){g.review=true;reviews.push([code(l.caseId),l.client,g.name,"مقدم الخدمة غير محدد"]); }
   if(l.issues.length){g.review=true;reviews.push([code(l.caseId),l.client,g.name,"مراجعة مالية: "+l.issues.join(", ")]);}
   if(l.component==="main"&&c.provider_id&&(!c.service_id||!services.has(String(c.provider_id)+"|"+String(c.service_id)))){
     g.review=true;reviews.push([code(l.caseId),l.client,g.name,"الخدمة غير مربوطة بمقدم الخدمة"]);
   }
   if(!c.service_date){reviews.push([code(l.caseId),l.client,g.name,"شهر المحاسبة أكتوبر من شيت د. ميشيل؛ تاريخ تنفيذ الخدمة غير معروف"]); }
 }
 const approved=(settlements||[]).filter(x=>x.period_from<=monthEnd(month)&&x.period_to>=month+"-01");
 for(const g of groups.values()){
   g.summary=F().summarize(g.lines);
   g.approved=approved.filter(x=>String(x.provider_id)===g.id);
 }
 const ordered=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"ar"));
 return {month,paid,groups:ordered,totals:F().summarize(paid),reviews,approved,cats,snap};
}
function settlementLabel(g){
 const outstanding=g.summary.ours+g.summary.theirs;
 if(outstanding>0n)return "تسوية مفتوحة";
 if(g.approved.length)return "إقفال الشهر معتمد";
 if(g.lines.some(l=>l.isPaid))return "مقفلة — تم دفع حصص الجهة بالكامل";
 return "لا توجد مستحقات";
}
function card(name,value){return '<div class="card stat" style="min-width:0"><span>'+name+'</span><b style="font-size:clamp(14px,2vw,20px)">'+value+'</b></div>';}
function renderView(s){
 const sum=s.totals;
 const clinicBox=E("pawAccountClinicGroup");
 if(clinicBox){
   const clinic=affiliation(), clinicGroups=clinicReportGroups(s);
   const clinicTotal=F().summarize(clinicReportLines(s));
   const groupById=new Map(clinicGroups.map(g=>[g.id,g]));
   if(!clinic){clinicBox.style.display="none";}
   else{
     const metric=(label,amount)=>'<div><span>'+label+'</span><b>'+fmt(amount)+'</b></div>';
     const docRows=clinic.doctors.map(d=>{
       const g=groupById.get(d.id),v=g?.summary;
       return '<tr><td>'+d.name+'</td><td>'+(v?.caseCount||0)+'</td><td>'+fmt(v?.provider||0n)+'</td><td>'+fmt(v?.providerPaid||0n)+'</td><td>'+fmt(v?.theirs||0n)+'</td></tr>';
     }).join("");
     clinicBox.style.display="";
     clinicBox.innerHTML='<h3>عيادة مينا عبدالله — الدكاترة التابعون لها</h3>'+
       '<p class="hint">د. دنيال، د. مايكل، د. بهاء. هذه مبالغ مجمعة للتوضيح، داخلة أصلًا في إجمالي التقرير وليست مستحقات إضافية.</p>'+
       '<div class="paw-clinic-summary">'+metric('حصة الدكاترة',clinicTotal.provider)+metric('المحوّل للدكاترة',clinicTotal.providerPaid)+metric('المتبقي للدكاترة',clinicTotal.theirs)+metric('حصة PawApp',clinicTotal.paw)+metric('لـ PawApp على الدكاترة',clinicTotal.ours)+'</div>'+
       '<div style="overflow-x:auto"><table style="min-width:570px"><thead><tr><th>الدكتور</th><th>العمليات المدفوعة</th><th>حصته</th><th>المدفوع له</th><th>المتبقي له</th></tr></thead><tbody>'+docRows+'</tbody></table></div>';
   }
 }
 E("pawAccountStatus").textContent="شهر "+s.month+" | عمليات مسددة فقط، Concierge وPet Information معاً. العمليات الأربع بلا تاريخ مدرجة في أكتوبر وفق شيت د. ميشيل، مع بقاء تاريخ خدمتها غير معروف.";
 E("pawAccountCards").innerHTML=[
 card("العمليات المدفوعة",sum.caseCount),card("إجمالي الخدمات",fmt(sum.total)),
 card("حصة باو أب",fmt(sum.paw)),card("حصة مقدمي الخدمات",fmt(sum.provider)),
 card("تحصيل العملاء المسجل",fmt(sum.paid)),card("تم دفعه لمقدمي الخدمات",fmt(sum.providerPaid)),
 card("لنا على الجهات",fmt(sum.ours)),card("للجهات علينا",fmt(sum.theirs))].join("");
 E("pawAccountStats").textContent="هذا تقرير محاسبي للعمليات المدفوعة فقط. الطلبات بلا سعر أو بلا دفع، ومنها عبدالله عند سندباد، موجودة بالمتابعات لكنها غير محتسبة. لا يجوز اعتبار السجلات غير المتحققة تحصيلاً بنكياً.";
 const tbody=E("pawAccountCompanies");tbody.replaceChildren();
 for(const g of s.groups){
  const tr=document.createElement("tr");
  for(const v of [g.name,g.summary.caseCount,money(g.summary.total),money(g.summary.paw),money(g.summary.provider),money(g.summary.providerPaid),money(g.summary.commissionReceived),money(g.summary.ours),money(g.summary.theirs)]){
   const td=document.createElement("td");td.textContent=String(v);tr.appendChild(td);
  }
  const nameCell=tr.firstElementChild;
  const clinic=clinicOf(g.id);
  if(nameCell&&clinic){
    const tag=document.createElement("span");tag.className="paw-clinic-label";tag.textContent=clinic;
    nameCell.appendChild(tag);
  }
  let td=document.createElement("td");td.textContent=settlementLabel(g)+(g.review?" • مراجعة بيانات الخدمة":"");tr.appendChild(td);
  td=document.createElement("td");
  const due=g.summary.ours+g.summary.theirs;
  if(accountant()&&!g.review&&g.id!=="missing"&&due>0n&&!g.approved.length){
    for(const [direction,amount] of [["pawapp_to_provider",g.summary.theirs],["provider_to_pawapp",g.summary.ours]]){
      if(amount<=0n)continue;
      const b=document.createElement("button");b.type="button";b.className="btn primary";b.style.margin="2px";b.textContent="اعتماد "+fmt(amount);
      b.addEventListener("click",()=>openApproval(g,direction,amount));td.appendChild(b);
    }
  }
  if(g.id!=="missing"){
    const btn=document.createElement("button");btn.type="button";btn.className="btn soft";btn.style.margin="2px";btn.textContent="تفاصيل";
    btn.addEventListener("click",()=>window.pawOpenMonthlyProvider?.(g.id,s.month,"all"));td.appendChild(btn);
  }
  tr.appendChild(td);tbody.appendChild(tr);
 }
 const review=E("pawAccountReview");review.replaceChildren();
 if(!s.reviews.length){review.textContent="لا توجد ملاحظات على العمليات المدفوعة في هذا الشهر.";return;}
 const wrap=document.createElement("div");wrap.style.overflowX="auto";
 const table=document.createElement("table");table.style.minWidth="640px";
 const header=document.createElement("tr");
 for(const t of ["العملية","العميل","الجهة","الملاحظة"]){const th=document.createElement("th");th.textContent=t;header.appendChild(th);}
 const thead=document.createElement("thead");thead.appendChild(header);table.appendChild(thead);
 const body=document.createElement("tbody");
 for(const item of s.reviews){const tr=document.createElement("tr");for(const value of item){const td=document.createElement("td");td.textContent=String(value);tr.appendChild(td);}body.appendChild(tr);}
 table.appendChild(body);wrap.appendChild(table);review.appendChild(wrap);
}
async function fresh(){
 const client=window.PAWAPP_AUTH?.client;
 if(!client||!F())throw Error("سجلي الدخول أولاً ثم حدّثي الصفحة.");
 const [a,b]=await Promise.all([client.rpc("test_finance_snapshot"),client.from("test_provider_period_settlements").select("id,provider_id,period_from,period_to,direction,status,amount,paid_at,method,reference")]);
 if(a.error)throw Error(a.error.message);
 if(b.error)throw Error(b.error.message);
 return [a.data,b.data||[]];
}
async function show(){
 const month=E("pawAccountMonth")?.value||"";
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return;
 const n=++sequence;
 E("pawAccountExport").disabled=true;
 E("pawAccountStatus").textContent="جاري احتساب العمليات المدفوعة وتسويات جميع الجهات...";
 try{
   const [snap,periods]=await fresh();
   if(n!==sequence)return;
   report=tally(snap,periods,month);
   renderView(report);E("pawAccountExport").disabled=false;
 }catch(err){
   if(n!==sequence)return;
   report=null;
   E("pawAccountStatus").textContent="تعذر فتح تقرير الشهر: "+String(err.message||err);
   E("pawAccountCompanies").replaceChildren();E("pawAccountCards").replaceChildren();
 }
}
window.pawAccountantRender=show;
function safe(v){if(typeof v==="number")return v;const s=String(v??"");return /^\s*[=+@-]/.test(s)?"'"+s:s;}
function excelSheet(rows){return XLSX.utils.aoa_to_sheet(rows.map(row=>row.map(safe)));}
window.pawAccountantExportExcel=function(){
 const s=report;
 if(!s||s.month!==E("pawAccountMonth").value)return alert("اعرضي الشهر أولاً");
 if(!window.XLSX)return alert("مكتبة تصدير Excel غير متاحة");
 const nums=g=>[g.summary.caseCount,...["total","paw","provider","paid","providerPaid","commissionReceived","ours","theirs"].map(k=>number(money(g.summary[k])))];
 const head=["الجهة","العيادة التابعة لها","عدد العمليات المدفوعة","إجمالي الخدمات (د.ك)","حصة باو أب (د.ك)","حصة مقدم الخدمة (د.ك)","تحصيل العملاء المسجل (د.ك)","المحوّل لمقدم الخدمة (د.ك)","عمولة محصلة من الجهة (د.ك)","لباو أب على الشركة (د.ك)","للشركة على باو أب (د.ك)","حالة الاعتماد"];
 const summary=[["تقرير محاسب PawApp",s.month],["عمليات مسددة فقط. الحالات المكررة والتجريبية والملغاة غير محتسبة. السجلات بلا تاريخ خدمة مُدرجة حسب فترة الشيت المعلنة."],head,...s.groups.map(g=>[g.name,clinicOf(g.id)||"—",...nums(g),settlementLabel(g)+(g.review?" • مراجعة بيانات الخدمة":"")]),["الإجمالي","",...nums({summary:s.totals}),""]];
 const details=[["العملية","شهر المحاسبة","تاريخ الخدمة الفعلي","مصدر العملية","مقدم الخدمة","العيادة التابعة لها","العميل","رقم الهاتف","الخدمة","المكون","الإجمالي د.ك","حصة باو أب د.ك","حصة الجهة د.ك","سداد العميل المسجل د.ك","استلم من العميل","المدفوع لمقدم الخدمة د.ك","عمولة محصلة د.ك","لنا على الجهة د.ك","للجهة علينا د.ك","ملاحظة"],
 ...s.paid.map(l=>{
   const c=l.raw||{};
   return [code(l.caseId),s.month,c.service_date||"غير معروف — شهر المحاسبة من شيت د. ميشيل",sourceName(c),s.cats.get(l.providerId)||"غير محدد",clinicOf(l.providerId)||"—",l.client,l.phone,l.service,l.component,...["total","paw","provider","paid"].map(k=>number(money(l[k]))),l.route==="pawapp"?"باو أب":"الجهة",...["providerPaid","commissionReceived","ours","theirs"].map(k=>number(money(l[k]))),c.service_date?"":"التاريخ الفعلي غير معروف، ليس تاريخ 31 أكتوبر"]})
 ];
 const checks=[["العملية","العميل","الجهة","ملاحظة"],...s.reviews];
 const approvals=[["الجهة","العيادة التابعة لها","الاتجاه","من","إلى","المبلغ د.ك","المرجع","تاريخ الدفع","حالة الاعتماد"],...s.approved.map(x=>[s.cats.get(String(x.provider_id))||"غير محدد",clinicOf(x.provider_id)||"—",x.direction,x.period_from,x.period_to,number(x.amount),x.reference,x.paid_at,x.status])];
 const clinicGroups=clinicReportGroups(s);
 const clinicById=new Map(clinicGroups.map(g=>[g.id,g]));
 const emptySummary=F().summarize([]);
 const clinicSummary=F().summarize(clinicReportLines(s));
 const clinicNums=g=>[g.caseCount,...["total","paw","provider","paid","providerPaid","commissionReceived","ours","theirs"].map(k=>number(money(g[k])))];
 const clinicSheet=[
  ["عيادة مينا عبدالله","ملخص الدكاترة التابعين لها",s.month],
  ["الأرقام تجميع توضيحي من نفس عمليات الأطباء بالملخص الرئيسي. لا تضاف مرة ثانية للإجمالي العام."],
  ["الدكتور","العيادة","العمليات المسددة","الإجمالي د.ك","حصة PawApp د.ك","حصة الدكتور د.ك","تحصيل العملاء د.ك","المدفوع للدكتور د.ك","العمولة المحصلة د.ك","لـ PawApp د.ك","للدكتور د.ك"],
  ...clinicDoctors().map(d=>[d.name,affiliation()?.clinic||"عيادة مينا عبدالله",...clinicNums(clinicById.get(d.id)?.summary||emptySummary)]),
  ["إجمالي العيادة (ضمن الإجمالي العام)","",...clinicNums(clinicSummary)]
 ];
 const wb=XLSX.utils.book_new();
 for(const [name,rows] of [["ملخص الشركات",summary],["ملخص عيادة مينا عبدالله",clinicSheet],["العمليات المدفوعة",details],["مراجعة المحاسب",checks],["التسويات المعتمدة",approvals]]){
    const ws=excelSheet(rows);ws["!cols"]=Array.from({length:Math.max(...rows.map(r=>r.length))},()=>({wch:24}));XLSX.utils.book_append_sheet(wb,ws,name);
 }
 XLSX.writeFile(wb,"PawApp-Accounting-"+s.month+".xlsx",{compression:true});
};
function openApproval(g,direction,amount){
 if(!accountant()||g.review||amount<=0n||!report)return;
 approval={provider:g.id,direction,amount,month:report.month,from:report.month+"-01",to:monthEnd(report.month)};
 E("pawAccountingSettleTitle").textContent=(direction==="pawapp_to_provider"?"تحويل باو أب إلى ":"تحصيل باو أب من ")+(clinicOf(g.id)?clinicOf(g.id)+" (عن "+g.name+")":g.name)+" — "+fmt(amount);
 E("pawAccountingSettleHelp").textContent="اعتمدي التسوية فقط بعد التأكد أن المبلغ دُفع أو حُصّل فعلاً. رقم المرجع اختياري؛ إذا ما عندج رقم، تُسجّل التسوية كتأكيد داخلي من حساب المحاسب، وليس كإيصال بنكي.";
 E("pawAccountingSettleRef").value="";E("pawAccountingSettleDate").value="";E("pawAccountingSettleMethod").value="";
 E("pawAccountingSettleModal").classList.add("show");
}
window.pawAccountantCloseSettlement=function(){if(approving)return;approval=null;E("pawAccountingSettleModal").classList.remove("show");};
window.pawAccountantConfirmSettlement=async function(){
 if(!approval||approving||!accountant())return;
 const p=approval,method=E("pawAccountingSettleMethod").value,reference=E("pawAccountingSettleRef").value.trim()||"بدون مرجع خارجي - تسوية مؤكدة داخل النظام",date=E("pawAccountingSettleDate").value;
 const today=new Date(Date.now()+3*3600000).toISOString().slice(0,10);
 if(!method||!date||date>today)return alert("سجلي طريقة التسوية وتاريخ الدفع أو توثيق التسوية السابقة.");
 if(!confirm("هل تؤكدين أن المبلغ "+fmt(p.amount)+" دُفع أو حُصّل فعلاً؟\n"+(reference.startsWith("بدون مرجع خارجي")?"بدون رقم تحويل خارجي؛ سيتم حفظ تأكيد المحاسب داخلياً.":"مرجع: "+reference)))return;
 approving=true;E("pawAccountingSettleSave").disabled=true;
 try{
  const [data,periods]=await fresh(),now=tally(data,periods,p.month),g=now.groups.find(g=>g.id===p.provider);
  if(!g||g.review||g.approved.some(x=>x.direction===p.direction))throw Error("تحتاج الجهة مراجعة أو أن التسوية معتمدة مسبقاً.");
  const curr=p.direction==="pawapp_to_provider"?g.summary.theirs:g.summary.ours;
  if(curr!==p.amount)throw Error("تغير المبلغ؛ أعيدي فتح التقرير.");
  const res=await window.PAWAPP_AUTH.client.rpc("test_confirm_provider_period_settlement",{p_provider:p.provider,p_from:p.from,p_to:p.to,p_direction:p.direction,p_method:method,p_reference:reference,p_paid_at:date,p_expected:number(money(p.amount))});
  if(res.error)throw Error(res.error.message);
  E("pawAccountingSettleModal").classList.remove("show");approval=null;await show();alert("تم اعتماد التسوية بنجاح.");
 }catch(e){alert("لم تعتمد التسوية: "+String(e.message||e));}
 finally{approving=false;E("pawAccountingSettleSave").disabled=false;}
};
})();