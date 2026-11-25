/* TEST-only marketing analytics: no external calls, no writes, no secrets. */
function sourceKey(v){
 const k=String(v||'').trim().toLowerCase().replace(/[\s_-]+/g,'');
 const aliases={tiktok:'tiktok',instagram:'instagram',facebook:'facebook',whatsapp:'whatsapp',snapchat:'snapchat',google:'google',referral:'referral',existingcustomer:'existing',historicalexcel:'excel',bookingform:'form',bookingformtest:'form',petinfo:'form',petinformationform:'form','استشارههاتفيه':'phone','استشارةهاتفية':'phone'};
 return Object.prototype.hasOwnProperty.call(aliases,k)?aliases[k]:'unknown';
}
function summarizeMarketing(cases,lines,normalize,filters={}){
 const rows=cases.filter(c=>c.workflow_status!=='cancelled'&&(!filters.from||c.service_date&&c.service_date>=filters.from)&&(!filters.to||c.service_date&&c.service_date<=filters.to)&&(!filters.source||sourceKey(c.source)===filters.source));
 const ids=new Map(rows.map(c=>[String(c.id),sourceKey(c.source)])), groups=new Map(),phones=new Set();
 for(const c of rows){
  const key=sourceKey(c.source);
  if(!groups.has(key))groups.set(key,{key,cases:0,phones:new Set(),total:0n,fee:0n,collected:0n});
  const g=groups.get(key),p=normalize(c.client_phone);
  g.cases++;if(p){g.phones.add(p);phones.add(p);}
 }
 for(const l of lines){
  const key=ids.get(String(l.caseId));if(!key||l.cancelled)continue;
  const g=groups.get(key);g.total+=l.total??0n;g.fee+=l.paw??0n;g.collected+=l.pawCollected??0n;
 }
 const ordered=[...groups.values()].sort((a,b)=>b.cases-a.cases||a.key.localeCompare(b.key));
 return {cases:rows.length,phones:phones.size,total:ordered.reduce((a,g)=>a+g.total,0n),fee:ordered.reduce((a,g)=>a+g.fee,0n),collected:ordered.reduce((a,g)=>a+g.collected,0n),groups:ordered};
}
(function marketingUI(){
'use strict';
const F=window.PawFinanceCore;
if(!F||!F.validPhone)return;
const labels={tiktok:['TikTok','TikTok','#7186a6'],instagram:['Instagram','Instagram','#b5a0e5'],facebook:['Facebook','Facebook','#80b5ed'],whatsapp:['WhatsApp','WhatsApp','#83cba5'],snapchat:['Snapchat','Snapchat','#f8d449'],google:['Google','Google','#e9a8c5'],referral:['توصية','Referral','#f4b084'],existing:['عميل سابق','Existing customer','#7acdc8'],excel:['Excel — مصدر غير محدد','Excel — unknown source','#cbd5e1'],form:['نموذج — القناة غير محددة','Form — channel unknown','#a9c7f5'],phone:['استشارة هاتفية','Phone consultation','#c5dda0'],unknown:['غير محدد','Unknown','#a1aab9']};
let data=null,model=null,lang=window.PawI18n?.language||'ar',tab='analytics',from='',to='',source='',inboxSearch='',root;
const tr=(a,b)=>lang==='ar'?a:b;
const name=k=>labels[k]?.[lang==='ar'?0:1]||tr('غير محدد','Unknown');
const money=x=>F.format(x)+' '+tr('د.ك','KWD');
function el(tag,txt,cls,parent){const n=document.createElement(tag);if(txt!==undefined)n.textContent=String(txt);if(cls)n.className=cls;if(parent)parent.appendChild(n);return n;}
function btn(parent,txt,action,primary=false){const b=el('button',txt,'btn '+(primary?'primary':'soft'),parent);b.type='button';b.onclick=action;return b;}
function section(parent,title,desc){const n=el('section',undefined,'card pm-card',parent);el('h3',title,'',n);if(desc)el('p',desc,'hint',n);return n;}
function metric(parent,label,value,hint){const n=el('div',undefined,'pm-metric',parent);el('small',label,'hint',n);el('strong',value,'',n);if(hint)el('small',hint,'hint',n);}
function ensure(){
 if(root)return;
 const home=document.getElementById('dashboard');if(!home)return;
 root=el('section',undefined,'page');root.id='marketing';home.after(root);
 const style=el('style',undefined,'',root);style.textContent='#marketing{max-width:1500px;margin:auto;min-width:0}#marketing .pm-card{margin:12px 0;min-width:0}#marketing h3{margin:0 0 9px}#marketing .pm-metrics,#marketing .pm-platforms{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}#marketing .pm-metric{border:1px solid #dde6f1;border-radius:12px;background:#f4f8fd;padding:12px;min-width:0;border-top:4px solid #80b5ed}#marketing .pm-metric strong{display:block;font-size:clamp(15px,2vw,23px);overflow-wrap:anywhere;margin:6px 0;color:#0c3b78}#marketing .pm-metric:nth-child(3n+2){border-top-color:#83cba5}#marketing .pm-metric:nth-child(3n){border-top-color:#f8d449}#marketing .pm-tabs,#marketing .pm-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin:10px 0}#marketing .pm-filters label{flex:1;min-width:120px;display:grid;gap:4px}#marketing .pm-filters input,#marketing .pm-filters select,#marketing .pm-search{max-width:100%;width:100%;box-sizing:border-box;border:1px solid #dbe2ed;padding:10px;border-radius:9px;background:white;color:#10233d}#marketing .pm-chart{display:grid;grid-template-columns:minmax(120px,220px) minmax(0,1fr);gap:16px;align-items:center}#marketing .pm-donut{width:100%;aspect-ratio:1;border-radius:50%;display:grid;place-items:center}#marketing .pm-donut-center{width:65%;aspect-ratio:1;background:white;border-radius:50%;display:grid;place-content:center;text-align:center;color:#0c3b78}#marketing .pm-legend{display:grid;gap:8px}#marketing .pm-legend-line{display:flex;align-items:center;gap:8px;font-size:13px}#marketing .pm-dot{display:inline-block;width:12px;height:12px;border-radius:4px;flex:none}#marketing .pm-legend-line strong{margin-inline-start:auto}#marketing .pm-table{overflow-x:auto;max-width:100%}#marketing .pm-table table{width:100%;min-width:620px;border-collapse:collapse}#marketing .pm-table td,#marketing .pm-table th{padding:10px;text-align:start;border-bottom:1px solid #e1e8f0;white-space:nowrap}#marketing .pm-platform{border:1px solid #e1e8f0;border-radius:10px;padding:12px;border-top:4px solid var(--pm-color)}#marketing .pm-platform small{display:block;margin-top:6px}#marketing .pm-message{padding:12px;border-bottom:1px solid #e1e8f0;overflow-wrap:anywhere}@media(max-width:760px){#marketing .pm-metrics,#marketing .pm-platforms{grid-template-columns:repeat(2,minmax(0,1fr))}#marketing .pm-chart{grid-template-columns:1fr}#marketing .pm-donut{max-width:180px;margin:auto}#marketing .pm-filters label{min-width:110px}}';
 const body=el('div',undefined,'',root);body.id='pmBody';
 const shortcut=el('div',undefined,'card');shortcut.id='pawMarketingShortcut';shortcut.style.cssText='margin:10px 0;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;border-inline-start:4px solid #f8d449';
 const text=el('div',undefined,'',shortcut);const label=el('b',tr('التسويق ومصادر العملاء','Marketing & customer sources'),'',text);const desc=el('div',tr('تحليل الطلبات وسجل التواصل — الربط الخارجي مؤجل','Request analytics and message history — external connection pending'),'hint',text);
 const open=btn(shortcut,tr('فتح التسويق','Open marketing'),()=>window.showPage('marketing'),true);
 document.addEventListener('paw-language-change',()=>{lang=window.PawI18n?.language||'ar';label.textContent=tr('التسويق ومصادر العملاء','Marketing & customer sources');desc.textContent=tr('تحليل الطلبات وسجل التواصل — الربط الخارجي مؤجل','Request analytics and message history — external connection pending');open.textContent=tr('فتح التسويق','Open marketing');if(root?.classList.contains('active'))render();});
 const title=home.querySelector('.title');if(title)title.after(shortcut);else home.prepend(shortcut);
}
function platforms(parent){
 const p=section(parent,tr('حالة المنصات','Platform status'),tr('لم يتم تفعيل اتصال الكونسيرج بالمنصات بعد. لا تُعرض بيانات خارجية على أنها بيانات حقيقية.','External platform connections are not active in Concierge. No external metrics are fabricated.'));
 const g=el('div',undefined,'pm-platforms',p);
 for(const k of ['whatsapp','instagram','facebook','tiktok','snapchat']){
  const tile=el('div',undefined,'pm-platform',g);tile.style.setProperty('--pm-color',labels[k][2]);el('b',name(k),'',tile);el('small',tr('بانتظار الربط','Awaiting connection'),'hint',tile);
 }
}
function render(){
 lang=window.PawI18n?.language||'ar';
 ensure();if(!root||!data||!model)return;
 const body=document.getElementById('pmBody');body.replaceChildren();root.dir=lang==='ar'?'rtl':'ltr';root.lang=lang;
 const title=el('div',undefined,'title',body),heading=el('div',undefined,'',title);
 el('h1',tr('التسويق والتواصل','Marketing & Inbox'),'',heading);el('p','PawApp Concierge — TEST','hint',heading);
 const actions=el('div',undefined,'pm-tabs',title);btn(actions,tr('English','العربية'),()=>window.PawI18n?.setLanguage(lang==='ar'?'en':'ar'));btn(actions,tr('الرئيسية','Home'),()=>window.showPage('dashboard'));
 const tabs=el('div',undefined,'pm-tabs',body);btn(tabs,tr('تحليل التسويق','Marketing analytics'),()=>{tab='analytics';render()},tab==='analytics');btn(tabs,tr('سجل التواصل','Inbox'),()=>{tab='inbox';render()},tab==='inbox');
 platforms(body);
 if(tab==='inbox'){
  const box=section(body,tr('آخر رسائل الواتساب المحفوظة','Saved WhatsApp message history'),tr('يعرض آخر رسالة محفوظة في سجل العملية فقط، وليس صندوق محادثات متصلاً أو سجلاً كاملاً. لا يمكن إرسال أو الرد قبل توصيل المنصة.','Shows the last saved message on a case only, not a connected inbox or full conversation history. Sending and replying are not enabled.'));
  const field=el('input',undefined,'pm-search',box);field.type='search';field.placeholder=tr('بحث بالاسم أو الرقم أو العملية','Search name, phone or case');field.value=inboxSearch;
  const list=el('div',undefined,'',box);
  function drawMessages(){list.replaceChildren();const q=inboxSearch.toLowerCase().trim(), rows=(data.cases||[]).filter(c=>String(c.whatsapp_last_message||'').trim()).filter(c=>!q||[c.client_name,c.client_phone,'PAW-'+String(c.id).padStart(4,'0')].some(x=>String(x||'').toLowerCase().includes(q))).sort((a,b)=>String(b.whatsapp_last_message_at||'').localeCompare(String(a.whatsapp_last_message_at||'')));
   if(!rows.length)el('p',tr('لا توجد رسائل محفوظة مطابقة في TEST.','No matching saved messages in TEST.'),'hint',list);
   for(const c of rows.slice(0,100)){const n=el('article',undefined,'pm-message',list);el('b',c.client_name||tr('بدون اسم','Unnamed'),'',n);el('div',[c.client_phone,'PAW-'+String(c.id).padStart(4,'0'),c.whatsapp_last_message_at||tr('بدون تاريخ','Undated')].filter(Boolean).join(' • '),'hint',n);el('p',c.whatsapp_last_message,'',n);btn(n,tr('فتح العملية','Open case'),()=>window.crmJumpToCase(c.id));}
   if(rows.length>100)el('p',tr('أول 100 نتيجة فقط — استخدمي البحث.','First 100 results only — use search.'),'hint',list);
  }
  field.oninput=()=>{inboxSearch=field.value;drawMessages()};drawMessages();return;
 }
 const b=section(body,tr('أداء مصادر الطلبات المسجلة','Recorded request source performance'),tr('الفترة حسب تاريخ الخدمة. الطلبات الملغاة مستبعدة. المصدر المسجل ليس إثباتاً أن إعلاناً مدفوعاً جلب العميل.','Service-date filter. Cancelled cases excluded. Recorded source is not proof of paid-ad attribution.'));
 const filters=el('div',undefined,'pm-filters',b);
 function date(label,value,change){const wrap=el('label',label,'',filters),input=el('input',undefined,'',wrap);input.type='date';input.value=value;input.onchange=()=>{change(input.value);render()};}
 date(tr('من','From'),from,v=>from=v);date(tr('إلى','To'),to,v=>to=v);
 const wrap=el('label',tr('المصدر','Source'),'',filters),sel=el('select',undefined,'',wrap);
 let op=el('option',tr('كل المصادر','All sources'),'',sel);op.value='';
 for(const k of Object.keys(labels)){op=el('option',name(k),'',sel);op.value=k;}sel.value=source;sel.onchange=()=>{source=sel.value;render()};
 btn(filters,tr('إعادة ضبط','Reset'),()=>{from='';to='';source='';render()});
 if(from&&to&&from>to){el('p',tr('تاريخ البداية بعد النهاية.','Start date is after end date.'),'hint',b);return;}
 const stats=summarizeMarketing(data.cases||[],model.lines||[],F.validPhone,{from,to,source});
 const metrics=el('div',undefined,'pm-metrics',b);
 metric(metrics,tr('العمليات','Cases'),stats.cases);metric(metrics,tr('أرقام العملاء المختلفة','Distinct customer phones'),stats.phones);metric(metrics,tr('قيمة الخدمات والنقل','Service & transport value'),money(stats.total));metric(metrics,tr('عمولات PawApp المستحقة','Earned PawApp fees'),money(stats.fee));
 const chart=el('div',undefined,'pm-chart',b),donut=el('div',undefined,'pm-donut',chart),center=el('div',undefined,'pm-donut-center',donut);el('strong',stats.cases,'',center);el('small',tr('عملية','Cases'),'hint',center);
 let pos=0;donut.style.background=stats.cases?'conic-gradient('+stats.groups.map(g=>{const a=pos;pos+=100*g.cases/stats.cases;return labels[g.key][2]+' '+a+'% '+pos+'%';}).join(',')+')':'#e3e9f0';
 const legend=el('div',undefined,'pm-legend',chart);
 for(const g of stats.groups){const row=el('div',undefined,'pm-legend-line',legend),dot=el('i',undefined,'pm-dot',row);dot.style.background=labels[g.key][2];el('span',name(g.key),'',row);el('strong',g.cases+' · '+(100*g.cases/stats.cases).toFixed(1)+'%','',row);}
 const tableBox=el('div',undefined,'pm-table',b),table=el('table',undefined,'',tableBox),head=el('thead',undefined,'',table),hr=el('tr',undefined,'',head);
 for(const label of [tr('المصدر','Source'),tr('العمليات','Cases'),tr('أرقام مختلفة','Distinct phones'),tr('قيمة الخدمات','Service value'),tr('عمولات مستحقة','Earned fees'),tr('عمولات محصلة','Collected fees')])el('th',label,'',hr);
 const tbody=el('tbody',undefined,'',table);for(const g of stats.groups){const row=el('tr',undefined,'',tbody);for(const v of [name(g.key),g.cases,g.phones.size,money(g.total),money(g.fee),money(g.collected)])el('td',v,'',row);}
 if(!stats.cases)el('p',tr('لا توجد نتائج للفترة المختارة.','No results for the selected period.'),'hint',b);
 el('p',tr('قد يظهر الرقم نفسه في عدة مصادر؛ لا تُجمع الأعداد المختلفة عبر المصادر. العمولات ليست صافي الربح.','The same phone can occur in multiple sources; distinct counts are not additive. Fees are not net profit.'),'hint',b);
 const ads=section(body,tr('إحصائيات الحملات المدفوعة','Paid campaign metrics'),tr('ستُعرض بعد تفعيل واجهات الإعلانات والتحقق من الإسناد. — تعني أن البيانات غير متاحة، وليس صفراً.','Available after ad API connections and verified attribution. A dash means unavailable, not zero.'));
 const ag=el('div',undefined,'pm-metrics',ads);
 for(const label of [tr('الوصول','Reach'),tr('الظهور','Impressions'),tr('التفاعل','Engagement'),tr('النقرات','Clicks'),tr('الإنفاق الإعلاني','Ad spend'),tr('العملاء المحتملون','Leads'),tr('الحجوزات المنسوبة للإعلانات','Attributed bookings'),tr('العائد الإعلاني','ROAS')])metric(ag,label,'—');
}
window.PawMarketingRender=function(snapshot,financeModel){data=snapshot;model=financeModel;ensure();if(root?.classList.contains('active'))render();};
window.PawMarketingOpen=function(){render();};
ensure();
})();
