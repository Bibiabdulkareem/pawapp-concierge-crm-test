(function(){
'use strict';
const API='https://fccvnotgsmxirhztveai.supabase.co/rest/v1/';
const KEY='sb_publishable__bDEEO_UuUc2AZmCNMhQHg_qzjmoSnL';
const svcHeaders=['نوع مقدم الخدمة','اسم مقدم الخدمة','رقم تلفون مقدم الخدمة','اسم الخدمة','سعر الخدمة'];
const caseHeaders=['اسم العميل','رقم العميل','المنطقة','اسم الحيوان','نوع الحيوان','العمر','اسم مقدم الخدمة','اسم الخدمة','تاريخ العملية','الوقت','المصدر','إجمالي العميل','مستحق مقدم الخدمة','عمولة PawApp','العميل سدد','مقدم الخدمة استلم','PawApp حصلت العمولة'];
let parsed=[],mode='services';
const $=id=>document.getElementById(id);
function role(){return window.PAWAPP_AUTH?.access?.role||document.body?.dataset?.pawRole||''}
function status(s){if($('importStatus'))$('importStatus').textContent=s}
function csv(rows){return '\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')}
function parse(text){let rows=[],row=[],cell='',quoted=false; text=text.replace(/^\ufeff/,'');for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell.trim());cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell=''}else cell+=c}row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows}
function clean(v){return String(v||'').trim()}
function number(v){if(!clean(v))return null;const n=Number(clean(v));return Number.isFinite(n)&&n>=0?n:null}
function normalize(s){return clean(s).toLocaleLowerCase().replace(/\s+/g,' ')}
async function req(path,options={}){const token=window.PAWAPP_AUTH?.session?.access_token;if(!token)throw Error('سجلي الدخول أولاً');const response=await fetch(API+path,{...options,headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation',...(options.headers||{})}});const raw=await response.text();if(!response.ok)throw Error(raw.slice(0,250));return raw?JSON.parse(raw):[]}
window.pawImportMode=function(m){mode=m;parsed=[];$('importFile').value='';$('importPreview').innerHTML='';$('importCommit').disabled=true;status(m==='services'?'نموذج الخدمات: Excel أو CSV':'نموذج العملاء: Excel أو CSV، المعاينة فقط');}
window.pawDownloadTemplate=function(){if(!window.XLSX){status('Excel library not loaded. Refresh page.');return}const cols=mode==='services'?svcHeaders:caseHeaders;const ws=XLSX.utils.aoa_to_sheet([cols,...Array.from({length:100},()=>cols.map(()=>''))]);ws['!cols']=cols.map((x,i)=>({wch:i<3?27:21}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,mode==='services'?'Services':'Customers');XLSX.writeFile(wb,mode==='services'?'PawApp_Services_Template.xlsx':'PawApp_Customers_Template.xlsx')};
window.pawPreviewImport=async function(){if(!['admin','operations'].includes(role())){status('الصلاحية للأدمن والعمليات فقط');return}const file=$('importFile').files?.[0];if(!file){status('اختاري ملف Excel أو CSV');return}let rows;try{if(/\.xlsx?$/i.test(file.name)){if(!window.XLSX)throw Error('Excel library unavailable');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:'',raw:false}).filter(r=>r.some(v=>clean(v)))}else if(/\.csv$/i.test(file.name)){rows=parse(await file.text())}else throw Error('صيغة غير مدعومة')}catch(e){status('تعذر فتح الملف: '+e.message);return}const expected=mode==='services'?svcHeaders:caseHeaders;const head=rows.shift()||[];if(expected.some((h,i)=>h!==clean(head[i]))){status('العناوين لا تطابق القالب. نزّلي النموذج من النظام.');return}parsed=rows.map((r,i)=>({line:i+2,values:r,valid:mode==='services'?!!clean(r[0])&&!!clean(r[1])&&!!clean(r[3])&&(clean(r[4])===''||number(r[4])!==null):!!clean(r[0])&&!!clean(r[1])}));const valid=parsed.filter(x=>x.valid).length;$('importPreview').textContent='الصفوف: '+parsed.length+' | صالحة: '+valid+' | تحتاج مراجعة: '+(parsed.length-valid);$('importCommit').disabled=mode!=='services'||valid!==parsed.length||!valid;status(mode==='services'?'راجعي العدد ثم اعتمدي استيراد الخدمات':'استيراد العملاء قيد التطوير؛ المعاينة فقط')};
window.pawCommitServicesImport=async function(){if(!['admin','operations'].includes(role())||mode!=='services'||!parsed.length||parsed.some(r=>!r.valid))return;if(!confirm('استيراد '+parsed.length+' خدمة ومقدم خدمة إلى TEST؟'))return;$('importCommit').disabled=true;let createdProviders=0,createdServices=0,skipped=0;try{const providers=await req('test_providers?select=id,name,provider_type,phone');const services=await req('test_services?select=id,provider_id,name');for(const item of parsed){const r=item.values;const type=/freelancer|فريلانسر|طبيب|دكتور/i.test(r[0])?'freelancer':'company';let p=providers.find(x=>normalize(x.name)===normalize(r[1]));if(!p){const saved=await req('test_providers',{method:'POST',body:JSON.stringify({name:clean(r[1]),provider_type:type,phone:clean(r[2])||null})});p=saved[0];providers.push(p);createdProviders++}if(services.some(x=>x.provider_id===p.id&&normalize(x.name)===normalize(r[3]))){skipped++;continue}const saved=await req('test_services',{method:'POST',body:JSON.stringify({provider_id:p.id,name:clean(r[3]),default_provider_price:number(r[4])})});services.push(saved[0]);createdServices++}status('تم في TEST: '+createdProviders+' مقدم خدمة جديد، '+createdServices+' خدمة، '+skipped+' مكرر. حدّثي الصفحة لرؤية البيانات.')}catch(e){status('توقف الاستيراد: '+e.message+' — أُضيف '+createdProviders+' مقدم و'+createdServices+' خدمة قبل التوقف. راجعي البيانات قبل الإعادة.')}};

/* Historical customer import: explicit review, no assumed payment confirmation. */
const historicalHeaders=['Customer name','Phone number ','Location ','Pet name ','Pet type ','Age ','Dr name','Dr number ','pawApp fees','Doctor - clinic payment','Total payment ','Date','Time call','Source ','Pet Stantus','Pet Profile Status'];
function digits(v){return clean(v).replace(/[^0-9]/g,'').replace(/^965(?=[0-9]{8}$)/,'')}
function isMissing(v){return !clean(v)||/^(null|none|n\/a|-|—)$/i.test(clean(v))}
function money(v){if(isMissing(v))return null;const n=Number(clean(v).replace(/,/g,''));return Number.isFinite(n)&&n>=0?Math.round(n*1000)/1000:null}
function historicalDate(v,monthHint){const s=clean(v);let y,m,d;if(/^\d{4}-\d{2}-\d{2}$/.test(s)){[y,m,d]=s.split('-').map(Number)}else{const p=s.split(/[.\/\-]/).map(Number);if(p.length!==3||p.some(x=>!Number.isInteger(x)))return null;y=p[2];if(y<100)y+=2000;if(p[0]>12){d=p[0];m=p[1]}else if(p[1]>12){m=p[0];d=p[1]}else if(monthHint&&p[0]===monthHint){m=p[0];d=p[1]}else if(monthHint&&p[1]===monthHint){d=p[0];m=p[1]}else return null}const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()+1===m&&date.getUTCDate()===d?String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'):null}
function rowToCase(r,sourceMode,monthHint){let name,phone,location,petName,petType,age,provider,service,date,source,total,providerAmount,fee,paid,providerPaid,pawPaid,extra;
if(sourceMode==='historical'){[name,phone,location,petName,petType,age,provider,,fee,providerAmount,total,date,,source,...extra]=r;service='';paid=providerPaid=pawPaid='';}
else{[name,phone,location,petName,petType,age,provider,service,date,,source,total,providerAmount,fee,paid,providerPaid,pawPaid]=r;extra=[]}
const missing=[];if(isMissing(name))missing.push('اسم العميل');if(digits(phone).length<8)missing.push('رقم تلفون صالح');if(isMissing(petType))missing.push('نوع الحيوان');if(isMissing(provider))missing.push('مقدم الخدمة');if(isMissing(service))missing.push('الخدمة');if(isMissing(location))missing.push('المنطقة');
const iso=historicalDate(date,monthHint);if(!iso)missing.push('تاريخ العملية غير واضح');
const t=money(total),p=money(providerAmount),f=money(fee);if(t===null)missing.push('إجمالي العميل');if(p===null)missing.push('مستحق مقدم الخدمة');if(f===null)missing.push('عمولة PawApp');
const mismatch=t!==null&&p!==null&&f!==null&&Math.abs(t-p-f)>0.001;if(mismatch)missing.push('اختلاف الحسابات');
return {name:clean(name),phone:digits(phone),location:isMissing(location)?null:clean(location),petType:isMissing(petType)?null:clean(petType),age:isMissing(age)?null:clean(age),provider:isMissing(provider)?null:clean(provider),service:isMissing(service)?null:clean(service),date:iso,source:isMissing(source)?'historical_excel':clean(source),total:t,providerAmount:p,fee:f,petName:isMissing(petName)?null:clean(petName),paid,providerPaid,pawPaid,missing,mismatch,rawDate:clean(date),extra}}
let customerRows=[],customerMode='template',customerMonth=null;
window.pawSetImportMonth=function(v){customerMonth=v?Number(v):null};
window.pawPreviewCustomers=async function(){
if(!['admin','operations'].includes(role())){status('الصلاحية للأدمن والعمليات فقط');return}
const file=$('importFile')?.files?.[0];if(!file){status('اختاري ملف Excel أو CSV');return}
let rows;try{if(/\.xlsx?$/i.test(file.name)){if(!window.XLSX)throw Error('Excel library unavailable');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:'',raw:false}).filter(r=>r.some(v=>clean(v)))}else if(/\.csv$/i.test(file.name))rows=parse(await file.text());else throw Error('صيغة غير مدعومة')}catch(e){status('فشل فتح الملف: '+e.message);return}
const header=rows.shift()||[];customerMode=normalize(header[0])==='customer name'?'historical':'template';
const expected=customerMode==='historical'?historicalHeaders:caseHeaders;
if(expected.some((x,i)=>normalize(x)!==normalize(header[i]))){status('العناوين غير مطابقة لنموذج العملاء أو ملف Paw app data');return}
customerRows=rows.map((r,i)=>({line:i+2,data:rowToCase(r,customerMode,customerMonth)}));
const bad=customerRows.filter(x=>!x.data.date||!x.data.name||x.data.phone.length<8);
const review=customerRows.filter(x=>x.data.missing.length);
const duplicates=new Set(),seen=new Set();customerRows.forEach(x=>{const k=x.data.phone+'|'+x.data.date+'|'+x.data.provider+'|'+x.data.total+'|'+x.data.fee+'|'+normalize(x.data.petName);if(seen.has(k))duplicates.add(k);seen.add(k)});
$('importPreview').textContent='صفوف '+customerRows.length+' | مراجعة '+review.length+' | تواريخ/هوية تمنع الرفع '+bad.length+' | تكرارات محتملة '+duplicates.size+'\n'+customerRows.slice(0,30).map(x=>'صف '+x.line+' — '+x.data.name+' — '+(x.data.date||'تاريخ غير واضح')+' — '+(x.data.missing.join('، ')||'مكتمل')).join('\n');
$('importPreview').style.whiteSpace='pre-wrap';$('importCommit').disabled=!customerRows.length||!!bad.length||!!duplicates.size;
status(bad.length?'أصلحي التواريخ والأسماء والأرقام أولاً':duplicates.size?'راجعي الصفوف المكررة أولاً':'جاهز للاستيراد إلى TEST؛ الصفوف الناقصة ستنشئ متابعات');
};
window.pawCommitImport=async function(){
if(mode==='services')return window.pawCommitServicesImport();
if(!['admin','operations'].includes(role())||!customerRows.length||$('importCommit').disabled)return;
if(!confirm('استيراد '+customerRows.length+' عملية إلى TEST وإنشاء متابعات للنواقص؟'))return;
$('importCommit').disabled=true;
let created=0,followups=0,skipped=0;
try{
const existing=await req('test_cases?select=id,client_phone,service_date,provider_id,total_amount,notes&limit=10000');
const providers=await req('test_providers?select=id,name,provider_type,phone&limit=10000');
const services=await req('test_services?select=id,provider_id,name&limit=10000');
for(const row of customerRows){
const d=row.data;
const marker='[BULK_IMPORT:'+d.phone+':'+d.date+':'+normalize(d.provider)+':'+d.total+':'+d.fee+':'+normalize(d.petName)+']';
if(existing.some(x=>String(x.notes||'').includes(marker))){skipped++;continue}
let p=providers.find(x=>normalize(x.name)===normalize(d.provider));
if(!p&&d.provider){
const saved=await req('test_providers',{method:'POST',body:JSON.stringify({name:d.provider,provider_type:'freelancer'})});
p=saved[0];providers.push(p);
}
// A doctor/provider name is not a service. Only register a catalog service when explicitly supplied.
let svc=null;
if(p&&d.service){
svc=services.find(x=>x.provider_id===p.id&&normalize(x.name)===normalize(d.service));
if(!svc){
const saved=await req('test_services',{method:'POST',body:JSON.stringify({provider_id:p.id,name:d.service,default_provider_price:d.providerAmount})});
svc=saved[0];services.push(svc);
}
}
const notes=[marker,'بيانات تاريخية من Excel','تاريخ المصدر: '+d.rawDate,d.petName?'اسم الحيوان: '+d.petName:'',d.missing.length?'تحتاج مراجعة: '+d.missing.join('، '):'', 'السداد: غير مؤكد حتى تتم مراجعته'].filter(Boolean).join(' | ');
const payload={client_name:d.name,client_phone:d.phone,location:d.location,pet_type:d.petType,pet_age:d.age,provider_id:p?.id||null,service_id:svc?.id||null,service_name:d.service||null,service_date:d.date,source:d.source,total_amount:d.total,provider_amount:d.providerAmount,pawapp_amount:d.fee,client_paid:null,workflow_status:d.missing.length?'new_request':'appointment_completed',notes};
const saved=await req('test_cases',{method:'POST',body:JSON.stringify(payload)});
const item=saved[0];
if(d.missing.length){
try{
await req('test_followups',{method:'POST',body:JSON.stringify({case_id:item.id,followup_at:new Date(Date.now()+86400000).toISOString(),reason:'استكمال بيانات الاستيراد',notes:d.missing.join('، '),status:'pending'})});
followups++;
}catch(followError){
try{await req('test_cases?id=eq.'+encodeURIComponent(item.id),{method:'DELETE',headers:{Prefer:'return=minimal'}})}
catch(rollbackError){throw Error('تعذر إنشاء المتابعة وتعذر التراجع عن العملية '+item.id+'. يلزم تدخل يدوي: '+followError.message)}
throw Error('فشل إنشاء المتابعة؛ تم التراجع عن العملية '+item.id+': '+followError.message);
}
}
created++;existing.push(item);
}
status('TEST: أضيف '+created+' عملية، '+followups+' متابعة، تخطينا '+skipped+' مكرر. حدّثي الصفحة للتقارير.');
}catch(e){status('توقف الاستيراد بعد '+created+' عملية و'+followups+' متابعة: '+e.message+' — راجعي النتائج قبل الإعادة')}
};
const oldPreview=window.pawPreviewImport;
window.pawPreviewImport=function(){if(mode==='cases')return window.pawPreviewCustomers();return oldPreview()};
const oldMode=window.pawImportMode;
window.pawImportMode=function(m){oldMode(m);customerRows=[];if($('importCommit'))$('importCommit').textContent=m==='cases'?'اعتماد استيراد العملاء إلى TEST':'اعتماد استيراد الخدمات إلى TEST'};

})();