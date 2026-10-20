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
function rowFingerprint(row){const data=JSON.stringify(row.values||[]);let h1=2166136261,h2=5381;for(let i=0;i<data.length;i++){const c=data.charCodeAt(i);h1=Math.imul(h1^c,16777619);h2=(Math.imul(h2,33)^c)>>>0;}return (h1>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0')}
function newCaseMarker(row){return '[BULK_IMPORT:NEW:'+rowFingerprint(row)+':ROW:'+row.line+']'}

async function req(path,options={}){const token=window.PAWAPP_AUTH?.session?.access_token;if(!token)throw Error('سجلي الدخول أولاً');const response=await fetch(API+path,{...options,headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation',...(options.headers||{})}});const raw=await response.text();if(!response.ok)throw Error(raw.slice(0,250));return raw?JSON.parse(raw):[]}
window.pawImportMode=function(m){mode=m;parsed=[];$('importFile').value='';$('importPreview').innerHTML='';$('importCommit').disabled=true;status(m==='services'?'نموذج الخدمات: Excel أو CSV':'نموذج العملاء: Excel أو CSV، المعاينة فقط');}
window.pawDownloadTemplate=function(){if(!window.XLSX){status('Excel library not loaded. Refresh page.');return}const cols=mode==='services'?svcHeaders:caseHeaders;const ws=XLSX.utils.aoa_to_sheet([cols,...Array.from({length:100},()=>cols.map(()=>''))]);ws['!cols']=cols.map((x,i)=>({wch:i<3?27:21}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,mode==='services'?'Services':'Customers');XLSX.writeFile(wb,mode==='services'?'PawApp_Services_Template.xlsx':'PawApp_Customers_Template.xlsx')};
window.pawPreviewImport=async function(){if(!['admin','operations'].includes(role())){status('الصلاحية للأدمن والعمليات فقط');return}const file=$('importFile').files?.[0];if(!file){status('اختاري ملف Excel أو CSV');return}let rows;try{if(/\.xlsx?$/i.test(file.name)){if(!window.XLSX)throw Error('Excel library unavailable');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:'',raw:false}).filter(r=>r.some(v=>clean(v)))}else if(/\.csv$/i.test(file.name)){rows=parse(await file.text())}else throw Error('صيغة غير مدعومة')}catch(e){status('تعذر فتح الملف: '+e.message);return}const expected=mode==='services'?svcHeaders:caseHeaders;const head=rows.shift()||[];if(expected.some((h,i)=>h!==clean(head[i]))){status('العناوين لا تطابق القالب. نزّلي النموذج من النظام.');return}parsed=rows.map((r,i)=>({line:i+2,values:r,valid:mode==='services'?!!clean(r[0])&&!!clean(r[1])&&!!clean(r[3])&&(clean(r[4])===''||number(r[4])!==null):!!clean(r[0])&&!!clean(r[1])}));const valid=parsed.filter(x=>x.valid).length;$('importPreview').textContent='الصفوف: '+parsed.length+' | صالحة: '+valid+' | تحتاج مراجعة: '+(parsed.length-valid);$('importCommit').disabled=mode!=='services'||valid!==parsed.length||!valid;status(mode==='services'?'راجعي العدد ثم اعتمدي استيراد الخدمات':'استيراد العملاء قيد التطوير؛ المعاينة فقط')};
window.pawCommitServicesImport=async function(){if(!['admin','operations'].includes(role())||mode!=='services'||!parsed.length||parsed.some(r=>!r.valid))return;if(!confirm('استيراد '+parsed.length+' خدمة ومقدم خدمة إلى TEST؟'))return;$('importCommit').disabled=true;let createdProviders=0,createdServices=0,skipped=0;try{const providers=await req('test_providers?select=id,name,provider_type,phone');const services=await req('test_services?select=id,provider_id,name');for(const item of parsed){const r=item.values;const type=/freelancer|فريلانسر|طبيب|دكتور/i.test(r[0])?'freelancer':'company';let p=providers.find(x=>normalize(x.name)===normalize(r[1]));if(!p){const saved=await req('test_providers',{method:'POST',body:JSON.stringify({name:clean(r[1]),provider_type:type,phone:clean(r[2])||null})});p=saved[0];providers.push(p);createdProviders++}if(services.some(x=>x.provider_id===p.id&&normalize(x.name)===normalize(r[3]))){skipped++;continue}const saved=await req('test_services',{method:'POST',body:JSON.stringify({provider_id:p.id,name:clean(r[3]),default_provider_price:number(r[4])})});services.push(saved[0]);createdServices++}if(typeof window.loadData==='function')await window.loadData();status('تم في TEST: '+createdProviders+' مقدم خدمة جديد، '+createdServices+' خدمة، '+skipped+' مكرر. تم تحديث المؤشرات.')}catch(e){status('توقف الاستيراد: '+e.message+' — أُضيف '+createdProviders+' مقدم و'+createdServices+' خدمة قبل التوقف. راجعي البيانات قبل الإعادة.')}};

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
const actualDate=historicalDate(date,monthHint);const iso=actualDate;if(!actualDate)missing.push('تاريخ العملية غير واضح؛ لا يُستخدم تاريخ تقديري');
const t=money(total),p=money(providerAmount),f=money(fee);if(t===null)missing.push('إجمالي العميل');if(p===null)missing.push('مستحق مقدم الخدمة');if(f===null)missing.push('عمولة PawApp');
const extraAmount=t!==null&&p!==null&&f!==null?Math.round((t-p-f)*1000)/1000:0;const mismatch=extraAmount<0;if(mismatch)missing.push('اختلاف الحسابات: الحصص أكبر من الإجمالي');if(extraAmount>0)missing.push('رسوم إضافية غير مصنفة: يلزم تأكيد تصنيفها قبل الاستيراد');
return {name:clean(name),phone:digits(phone),location:isMissing(location)?null:clean(location),petType:isMissing(petType)?null:clean(petType),age:isMissing(age)?null:clean(age),provider:isMissing(provider)?null:clean(provider),service:isMissing(service)?null:clean(service),date:iso,source:isMissing(source)?'historical_excel':clean(source),total:t,providerAmount:p,fee:f,petName:isMissing(petName)?null:clean(petName),paid,providerPaid,pawPaid,extraAmount,missing,mismatch,rawDate:clean(date),extra}}
let customerRows=[],customerMode='template',customerMonth=null,fileImportIdentity='';
window.pawSetImportMonth=function(v){customerMonth=v?Number(v):null};
window.pawPreviewCustomers=async function(){
if(!['admin','operations'].includes(role())){status('الصلاحية للأدمن والعمليات فقط');return}
const file=$('importFile')?.files?.[0];if(!file){status('اختاري ملف Excel أو CSV');return}
let rows;try{if(/\.xlsx?$/i.test(file.name)){if(!window.XLSX)throw Error('Excel library unavailable');const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:'',raw:false}).filter(r=>r.some(v=>clean(v)))}else if(/\.csv$/i.test(file.name))rows=parse(await file.text());else throw Error('صيغة غير مدعومة')}catch(e){status('فشل فتح الملف: '+e.message);return}
const header=rows.shift()||[];fileImportIdentity=String(file.name||'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,90);customerMode=normalize(header[0])==='customer name'?'historical':'template';mode='cases';if($('importCommit'))$('importCommit').textContent='اعتماد استيراد العملاء إلى TEST';if(customerMode==='historical'&&!customerMonth){status('اختاري شهر الملف التاريخي أولاً (مثلاً يوليو) ثم أعيدي المعاينة');$('importCommit').disabled=true;return}
const expected=customerMode==='historical'?historicalHeaders:caseHeaders;
if(expected.some((x,i)=>normalize(x)!==normalize(header[i]))){status('العناوين غير مطابقة لنموذج العملاء أو ملف Paw app data');return}
customerRows=rows.map((r,i)=>({line:i+2,values:r,data:rowToCase(r,customerMode,customerMonth)})).filter(x=>customerMode!=='historical'||(x.values.slice(0,12).some(v=>!isMissing(v))&&!/^total\s*[:=]?$/i.test(clean(x.values[0]))));
const bad=customerRows.filter(x=>!x.data.date||x.data.total===null||x.data.fee===null||x.data.mismatch||!x.data.provider||!x.data.service||!x.data.phone||!x.data.name);
let existingCases=[];try{existingCases=await req('test_cases?select=id,client_name,client_phone,service_date,total_amount,notes&limit=10000')}catch(e){status('تعذر فحص عمليات TEST: '+e.message);$('importCommit').disabled=true;return}

const review=customerRows.filter(x=>x.data.missing.length);
const existingRows=new Set();
for(const x of customerRows){const marker=customerMode==='historical'?'[BULK_IMPORT:2026:'+String(customerMonth||0)+':ROW:'+x.line+']':newCaseMarker(x);if(existingCases.some(e=>String(e.notes||'').includes(marker)||(normalize(e.client_name)===normalize(x.data.name)&&digits(e.client_phone)===x.data.phone&&e.service_date===x.data.date&&Number(e.total_amount)===Number(x.data.total))))existingRows.add(x.line)}
const duplicates=new Set();
const seenRows=new Set();for(const x of customerRows){const key=[x.data.phone,x.data.name,x.data.date,x.data.provider,x.data.total].map(normalize).join('|');if(seenRows.has(key))duplicates.add(x.line);seenRows.add(key)}
$('importPreview').textContent='صفوف '+customerRows.length+' | مراجعة '+review.length+' | تواريخ/هوية تمنع الرفع '+bad.length+' | موجودة مسبقاً في TEST '+existingRows.size+' | تكرارات داخل الملف '+duplicates.size+' | جديدة متوقعة '+(customerRows.length-existingRows.size)+'\n'+customerRows.slice(0,30).map(x=>'صف '+x.line+' — '+x.data.name+' — '+(x.data.date||'تاريخ غير واضح')+' — '+(x.data.missing.join('، ')||'مكتمل')).join('\n');
$('importPreview').style.whiteSpace='pre-wrap';$('importCommit').disabled=!customerRows.length||!!bad.length||!!duplicates.size||!!review.length;
status(bad.length?'الملف فيه بيانات أساسية أو مالية ناقصة: لا يمكن الاستيراد':duplicates.size?'راجعي الصفوف المكررة أولاً':review.length?'هناك '+review.length+' صف يحتاج مراجعة، لن نعتمد بيانات ناقصة أو سداداً مفترضاً':'فحص بيانات الملف اكتمل؛ راجعي التسويات المالية قبل الاعتماد.');
};
window.pawCommitImport=async function(){
if(mode==='services')return window.pawCommitServicesImport();
if(!['admin','operations'].includes(role())||!customerRows.length||$('importCommit').disabled)return;
if(customerMode==='historical'){status('استيراد ملفات يوليو–سبتمبر التاريخية مقفل لحماية الحالات المدفوعة والمقفلة؛ لا تعيدي استيرادها. استخدمي نموذج العمليات الجديدة فقط.');return;}const readiness=await window.PAWAPP_AUTH.client.rpc('test_import_october_ready');if(readiness.error||readiness.data!==true){status('الاستيراد المالي موقوف مؤقتاً: يلزم إكمال ربط الدفعات والتسويات قبل اعتماد أكتوبر. لم تُضف أي عملية.');return;}if(!confirm('استيراد العمليات التي اجتازت مراجعة الدفع والمبالغ إلى TEST؟'))return;
$('importCommit').disabled=true;
let created=0,followups=0,skipped=0,failed=[];
try{
const existing=await req('test_cases?select=id,client_name,client_phone,service_date,provider_id,total_amount,notes&limit=10000');
const providers=await req('test_providers?select=id,name,provider_type,phone&limit=10000');
const services=await req('test_services?select=id,provider_id,name&limit=10000');
for(const row of customerRows){
status('TEST: معالجة '+(created+skipped)+' من '+customerRows.length+' صف');
try{
const d=row.data;
const marker=newCaseMarker(row);
if(existing.some(x=>String(x.notes||'').includes(marker))){skipped++;continue}
if(existing.some(x=>normalize(x.client_name)===normalize(d.name)&&digits(x.client_phone)===d.phone&&x.service_date===d.date&&Number(x.total_amount)===Number(d.total))){skipped++;continue}
let p=providers.find(x=>normalize(x.name)===normalize(d.provider));
if(d.missing.length||d.mismatch||!d.date||d.total===null||d.fee===null||!d.service||!d.phone||!d.name||!d.provider){throw Error('الصف غير مكتمل ولا يُنشأ مقدم خدمة');}
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
const clientIsPaid=/^(نعم|yes|paid|true|1)$/i.test(clean(d.paid));const doctorIsPaid=/^(نعم|yes|paid|true|1)$/i.test(clean(d.providerPaid));const pawIsPaid=/^(نعم|yes|paid|true|1)$/i.test(clean(d.pawPaid));const notes=['شهر المصدر: '+(customerMonth||'غير محدد'),'دفع العميل لشركة باو أب: '+(clientIsPaid?'نعم':'لا'),'الدكتور استلم: '+(doctorIsPaid?'نعم':'لا'),'باو أب حصلت عمولتها: '+(pawIsPaid?'نعم':'لا'),d.petName?'اسم الحيوان: '+d.petName:''].filter(Boolean).join(' | ');
if(d.missing.length||d.mismatch||!d.date||d.total===null||d.fee===null||!p||!d.service||!d.phone){throw Error('بيانات أساسية/مالية ناقصة أو مقدم خدمة غير معروف');}
const payload={client_name:d.name,client_phone:d.phone,location:d.location,pet_type:d.petType,pet_age:d.age,provider_id:p.id,service_name:d.service,service_date:d.date,source:d.source,total_amount:d.total,pawapp_amount:d.fee,client_paid:clientIsPaid,client_paid_to:clientIsPaid?'pawapp':null,workflow_status:clientIsPaid?'closed':'new',notes};
const result=await window.PAWAPP_AUTH.client.rpc('test_import_october_case',{p_case:{...payload,provider_amount:d.providerAmount,provider_paid:doctorIsPaid},p_marker:marker});
if(result.error)throw Error(result.error.message);
const saved=[{id:result.data.id,...payload}];
if(!result.data.inserted){skipped++;continue;}
const item=saved[0];
if(false&&d.missing.length){
try{
await req('test_followups',{method:'POST',body:JSON.stringify({case_id:item.id,followup_at:new Date(Date.now()+86400000).toISOString(),reason:'استكمال بيانات الاستيراد',notes:d.missing.join('، '),status:'pending'})});
followups++;
}catch(followError){
// Never delete a successfully imported case when followup creation fails.
// Keep the row marker and surface the outstanding followup explicitly.
failed.push('متابعة صف '+row.line+' (عملية '+item.id+'): '+String(followError.message||followError).slice(0,150));
}
}
created++;existing.push(item);
}catch(rowError){
failed.push('صف '+row.line+': '+String(rowError.message||rowError).slice(0,180));
}
}
if(created>0){if(typeof window.loadData==='function')await window.loadData();if(typeof window.renderCRM==='function')window.renderCRM();if(typeof window.renderReports==='function')window.renderReports();}
status('TEST: أضيف '+created+' عملية، '+followups+' متابعة، تخطينا '+skipped+' مكرر، تعذر '+failed.length+' صف. '+(failed.length?'الأخطاء: '+failed.slice(0,8).join(' | ')+(failed.length>8?' | وغيرها '+(failed.length-8):''):'حدّثي الصفحة للتقارير.'));
}catch(e){status('توقف الاستيراد بعد '+created+' عملية و'+followups+' متابعة: '+e.message+' — راجعي النتائج قبل الإعادة')}
finally{if($('importCommit'))$('importCommit').disabled=failed.length>0}
};
const oldPreview=window.pawPreviewImport;
window.pawPreviewImport=function(){if(mode==='cases')return window.pawPreviewCustomers();const file=$('importFile')?.files?.[0];if(file&&/July|PawApp|TEST Import/i.test(file.name))return window.pawPreviewCustomers();return oldPreview()};
const oldMode=window.pawImportMode;
window.pawImportMode=function(m){oldMode(m);customerRows=[];if($('importCommit'))$('importCommit').textContent=m==='cases'?'اعتماد استيراد العملاء إلى TEST':'اعتماد استيراد الخدمات إلى TEST'};

})();