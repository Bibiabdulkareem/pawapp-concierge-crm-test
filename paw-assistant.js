/* TEST only. Read-only dashboard assistant using the Smart Reports adapter. */
window.PawDashboardAssistant=function(api){
'use strict';
if(!api.allowed()||document.getElementById('pawAssistantLaunch'))return;
const t=(ar,en)=>window.PawI18n?.t(ar,en)??ar;
const e=id=>document.getElementById(id);
const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n;};
const questions=[
 ['summary','ملخص الشهر','Monthly summary'],['earned','كم حصة PawApp؟','Earned PawApp share'],
 ['collected','كم تم تحصيله؟','Collected share'],['target','كم باقي على الهدف؟','Monthly target'],
 ['provider','أعلى مقدم خدمة','Top provider'],['staff','أداء الموظفات','Employee performance'],
 ['customers','العملاء الجدد والمتكررون','New and returning customers'],['review','شنو يحتاج متابعة؟','What needs review?']
];
const css=make('style');css.textContent=
 '#pawAssistantLaunch{position:fixed;right:18px;bottom:86px;width:74px;height:66px;z-index:44;border:0;background:none;cursor:pointer;padding:0;filter:drop-shadow(0 4px 5px #17345e25)}#pawAssistantLaunch[hidden]{display:none!important}#pawAssistantLaunch svg{display:block;width:100%;height:100%}'+
 '#pawAssistantDialog{width:min(650px,100%);max-width:100%;max-height:90dvh;margin:auto;border:0;border-radius:20px;padding:0;background:#f4f7fb;color:#10233d;box-shadow:0 15px 45px #082b5940}#pawAssistantDialog::backdrop{background:#082b5966}#pawAssistantDialog .pa-head{display:flex;align-items:center;gap:12px;background:#0c3b78;color:white;padding:16px}#pawAssistantDialog h2{flex:1;margin:0;font-size:18px}#pawAssistantDialog .pa-close{border:0;background:#ffffff22;color:white;border-radius:10px;width:42px;height:42px;font-size:24px;cursor:pointer}'+
 '#pawAssistantDialog .pa-main{padding:18px;display:grid;gap:12px}#pawAssistantDialog .pa-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}#pawAssistantDialog .pa-grid button{background:white;border:1px solid #d9e2ec;border-radius:12px;padding:12px;text-align:start;color:#0c3b78;font-weight:650;cursor:pointer}#pawAssistantDialog .pa-grid button[aria-pressed=true]{background:#e9f1ff;border-color:#0c3b78}#pawAssistantDialog .pa-result{background:white;border:1px solid #e3e9f0;border-radius:14px;padding:15px;white-space:pre-line;line-height:1.7;overflow-wrap:anywhere}#pawAssistantDialog label,#pawAssistantDialog form{display:flex;gap:8px;align-items:center}#pawAssistantDialog input{min-width:0;background:white;color:#10233d;border:1px solid #d9e2ec;border-radius:10px;padding:10px}#pawAssistantDialog form input{flex:1;width:0}#pawAssistantDialog .pa-note{font-size:12px;color:#6f8094;margin:0;line-height:1.55}'+
 '@media(min-width:900px){#pawAssistantLaunch{right:28px;bottom:22px;width:86px;height:76px}}@media(max-width:600px){#pawAssistantDialog{inset:0;margin:0;width:100%;height:100dvh;max-height:100dvh;border-radius:0}#pawAssistantDialog .pa-main{padding:14px;padding-bottom:max(20px,env(safe-area-inset-bottom))}#pawAssistantDialog .pa-head{padding-top:max(14px,env(safe-area-inset-top))}#pawAssistantDialog .pa-grid button{font-size:13px}}';
document.head.append(css);
const launch=make('button');launch.id='pawAssistantLaunch';launch.type='button';launch.hidden=true;
// Interim brand-colour paw icon; replace with approved transparent mascot asset.
launch.innerHTML='<svg viewBox="0 0 90 76" aria-hidden="true"><path d="M9 59C9 29 25 10 45 10s36 19 36 49v9H9z" fill="#ffd400" stroke="#0c3b78" stroke-width="3"/><g fill="#0c3b78"><ellipse cx="28" cy="32" rx="6" ry="8" transform="rotate(-24 28 32)"/><ellipse cx="40" cy="24" rx="6" ry="8"/><ellipse cx="53" cy="24" rx="6" ry="8"/><ellipse cx="65" cy="32" rx="6" ry="8" transform="rotate(24 65 32)"/><path d="M34 45q0-9 11-12 11 3 11 12 0 7-11 4-11 3-11-4"/></g><path d="M3 68h84" stroke="#0c3b78" stroke-width="4" stroke-linecap="round"/></svg>';
const dlg=make('dialog');dlg.id='pawAssistantDialog';dlg.setAttribute('aria-labelledby','paTitle');
document.body.append(launch,dlg);
let month='',selected='',answer='',serial=0;
function visible(){launch.hidden=!(api.allowed()&&window.PAW_FINANCE_READY&&e('dashboard')?.classList.contains('active')&&!dlg.open&&!document.querySelector('.modalBg.show'));if(!api.allowed()&&dlg.open)dlg.close();}
function response(key,r){
 const money=api.cash,none=t('لا توجد بيانات مؤهلة لهذه الفترة.','No eligible data for this period.');
 const top=r.providers[0],period=r.from+' — '+r.to;
 let lines=[];
 switch(key){
 case 'summary':lines=[t('العمليات: ','Cases: ')+r.stats.total,t('المكتملة: ','Completed: ')+r.stats.completed,t('قيمة الخدمات المكتملة: ','Completed service value: ')+money(r.total.total),t('حصة PawApp المكتسبة: ','Earned share: ')+money(r.total.paw),t('المحصّلة: ','Collected: ')+money(r.total.pawCollected)];break;
 case 'earned':lines=[t('حصة PawApp المكتسبة: ','Earned PawApp share: ')+money(r.total.paw),t('ليست صافي الربح.','This is not net profit.')];break;
 case 'collected':lines=[t('المحصّل حسب نموذج النظام: ','Collected per system model: ')+money(r.total.pawCollected),t('الحصة المتبقية: ','Remaining share: ')+money(r.remaining)];if(r.excess)lines.push(t('المحصّل يتجاوز المكتسب؛ يلزم مراجعة.','Collected exceeds earned; review needed.'));break;
 case 'target':lines=r.target?[t('الهدف: ','Target: ')+money(r.goal),t('المتبقي: ','Remaining: ')+money(r.target.remaining),t('نسبة الإنجاز: ','Achievement: ')+r.target.percent.toFixed(1)+'%']: [t('بيانات الهدف غير متاحة.','Target unavailable.')];break;
 case 'provider':lines=top&&top.paw>0n?[top.name||t('غير محدد','Unspecified'),t('الحصة المكتسبة: ','Earned share: ')+money(top.paw),t('العمليات المكتملة: ','Completed cases: ')+top.cases.size]:[none];break;
 case 'staff':lines=r.staff.length?r.staff.map(g=>(g.name||t('غير معيّن','Unassigned'))+' · '+g.completed+' '+t('مكتملة','completed')+' · '+money(g.fee)+' · '+g.followOverdue+' '+t('متابعة متأخرة','overdue')+(r.employeeGoalsAvailable&&g.goal>0n?' · '+api.goalPercent(g.fee,g.goal).toFixed(1)+'% '+t('من الهدف','of target'):'')):[none];break;
 case 'customers':lines=[t('عملاء جدد حسب أول خدمة مسجلة: ','New recorded customers: ')+r.stats.fresh.size,t('عملاء متكررون: ','Returning customers: ')+r.stats.returning.size,t('عمليات دون رقم صالح: ','Cases without valid phone: ')+r.stats.unknownPhone];break;
 case 'review':lines=[t('عمليات تحتاج مراجعة مالية: ','Cases requiring finance review: ')+r.issues,t('عمليات غير مؤرخة (كل النظام): ','Undated cases (all data): ')+r.undated,t('حصة غير محصلة: ','Uncollected share: ')+money(r.remaining)];break;
 default:return t('اختاري أحد الأسئلة المتاحة.','Choose one of the available questions.');
 }
 return [period,...lines].join('\n');
}
function classify(q){
 q=q.trim().toLowerCase().replace(/[\u064b-\u065f]/g,'');
 if(/target|goal|هدف|تارغت|تارقت/.test(q))return 'target';
 if(/employee|staff|موظف/.test(q))return 'staff';
 if(/top provider|provider|clinic|عياد|شرك|مقدم خدمة/.test(q))return 'provider';
 if(/customer|client|عميل|عملاء|زبون/.test(q))return 'customers';
 if(/review|follow.up|overdue|متابع|مراجعة/.test(q))return 'review';
 if(/collect|تحصيل|محصل|استلم/.test(q))return 'collected';
 if(/earn|share|حصة|حصه|عمول|ربح/.test(q))return 'earned';
 if(/summary|overview|ملخص|تقرير/.test(q))return 'summary';
 return '';
}
function mark(){dlg.querySelectorAll('[data-pa-key]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.paKey===selected)));}
async function ask(key){
 if(!api.allowed()||!dlg.open)return;
 selected=key;mark();const ticket=++serial;
 e('paResult').textContent=t('جاري تحديث بيانات TEST…','Refreshing TEST data…');
 try{await api.refresh();if(ticket!==serial||!dlg.open||!api.allowed())return;answer=response(key,api.report(month));}
 catch(err){if(ticket!==serial||!dlg.open||!api.allowed())return;answer=t('تعذر تحديث البيانات؛ لا يمكن عرض رقم موثوق الآن.','Refresh failed; no reliable figure can be shown now.');}
 e('paResult').textContent=answer;
}
function draw(){
 launch.setAttribute('aria-label',t('مساعد PawApp','PawApp assistant'));launch.title=t('مساعد PawApp','PawApp assistant');
 if(!dlg.open)return;
 dlg.dir=document.documentElement.dir||'rtl';
 const header=make('header','pa-head'),title=make('h2','',''+t('مساعد PawApp','PawApp assistant'));title.id='paTitle';
 const close=make('button','pa-close','×');close.type='button';close.setAttribute('aria-label',t('إغلاق','Close'));close.onclick=()=>dlg.close();header.append(title,close);
 const body=make('div','pa-main'),intro=make('p','',t('شنو تبين تعرفين عن أداء PawApp؟','What would you like to know about PawApp?'));intro.style.margin='0';
 const label=make('label','',t('شهر التقرير','Report month')),period=make('input');period.type='month';period.min='2000-01';period.max=api.today().slice(0,7);period.value=month;label.append(period);
 period.onchange=()=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(period.value)&&period.value>=period.min&&period.value<=period.max){month=period.value;if(selected)ask(selected);}else period.value=month;};
 const grid=make('div','pa-grid');
 for(const [key,ar,en] of questions){const b=make('button','',t(ar,en));b.type='button';b.dataset.paKey=key;b.onclick=()=>ask(key);grid.append(b);}
 const form=make('form'),input=make('input');input.type='text';input.maxLength=160;input.placeholder=t('اكتبي سؤالاً عن المؤشرات…','Ask about report metrics…');input.setAttribute('aria-label',input.placeholder);
 const send=make('button','btn primary',t('اسأل','Ask'));send.type='submit';form.append(input,send);
 form.onsubmit=event=>{event.preventDefault();const key=classify(input.value);if(key){ask(key);}else{serial++;selected='';mark();answer=t('حالياً أقدر أجاوب عن المؤشرات الموجودة في القائمة فقط.','Currently I can answer the listed report questions only.');e('paResult').textContent=answer;}};
 const result=make('div','pa-result',answer||t('اختاري سؤالاً لعرض النتيجة من TEST.','Choose a question to view the TEST result.'));result.id='paResult';result.setAttribute('role','status');result.setAttribute('aria-live','polite');
 const note=make('p','pa-note',t('TEST · أسئلة تحليلية محددة للقراءة فقط. الأرقام حسب تاريخ الخدمة وليست صافي ربح أو إثباتاً بنكياً.','TEST · Supported analytics questions, read-only. Figures use service date, not net profit or bank evidence.'));
 body.append(intro,label,grid,form,result,note);dlg.replaceChildren(header,body);mark();
}
launch.onclick=()=>{if(!api.allowed()||!window.PAW_FINANCE_READY)return;month=api.today().slice(0,7);selected='';answer='';dlg.showModal();draw();visible();dlg.querySelector('.pa-close').focus();};
dlg.addEventListener('close',()=>{serial++;selected='';answer='';dlg.replaceChildren();visible();if(!launch.hidden)launch.focus();});
document.addEventListener('paw-language-change',()=>{serial++;answer='';draw();if(dlg.open&&selected)ask(selected);});
const observer=new MutationObserver(visible);observer.observe(e('dashboard'),{attributes:true,attributeFilter:['class']});observer.observe(document.body,{attributes:true,attributeFilter:['data-paw-role']});document.querySelectorAll('.modalBg').forEach(n=>observer.observe(n,{attributes:true,attributeFilter:['class']}));
draw();visible();
};
