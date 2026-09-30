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
  const clientTasks=ls.filter(l=>l.action==='client_paid'||l.unknown);
  const partnerTasks=ls.filter(l=>l.action==='provider_paid'||l.action==='commission_received'||(!l.action&&l.issues.length));
  const paidText=s.unknownCount?'نقل غير مؤكد':s.unpaid>0n?'غير مدفوع':'تم السداد';
  const button='<button class="btn soft" onclick="openCaseDetails(\''+c.id+'\')">فتح العملية</button>';
  return '<tr><td>'+caseCode(c.id)+'</td><td>'+html(c.client_name)+'</td><td>'+html(c.pet_type||'—')+'</td><td>'+html(c.breed||'—')+'</td><td>'+yesNo(c.vaccinated)+'</td><td>'+yesNo(c.microchipped)+'</td><td>'+ls.map(l=>html(providerName(l.providerId))).join('<br>')+'</td><td>'+ls.map(l=>html(l.service)).join('<br>')+'</td>'+['total','paw','provider'].map(k=>'<td>'+cash(s[k])+'</td>').join('')+'<td><span class="status '+(s.unpaid>0n||s.unknownCount?'unpaid':'paid')+'">'+paidText+'</span></td><td>'+html(c.client_due_date||'—')+'</td><td>لنا: '+cash(s.ours)+'<br>علينا: '+cash(s.theirs)+(s.issueCount?'<br><span class="hint">يحتاج مراجعة</span>':'')+'</td><td>'+html(employee?.name||'—')+'<br>'+html(typeof sourceLabel==='function'?sourceLabel(c.source):c.source||'')+'</td><td><span class="hint">'+html(c.workflow_status||'new_request')+'</span><br>'+button+'</td><td>'+clientTasks.map(l=>'<div class="hint">'+html(l.service)+'</div>'+actionButton(l)).join('')+'</td><td>'+partnerTasks.map(l=>'<div class="hint">'+html(l.service)+'</div>'+actionButton(l)).join('')+'</td></tr>';
 }).join('')||'<tr><td colspan="18">لا توجد عمليات</td></tr>';
}
