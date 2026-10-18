(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits=s=>String(s||'').replace(/\D/g,'').replace(/^00965/,'965').replace(/^965(?=\d{8}$)/,'');
let pets=[],links=[],loaded=false,loading=false;
const client=()=>window.PAWAPP_AUTH?.client;
function roleOK(){return ['admin','operations'].includes(document.body.dataset.pawRole)}
async function load(){
 if(loading||!client())return;
 loading=true;
 try{
  const [a,b]=await Promise.all([client().from('test_pet_registry').select('*').order('created_at',{ascending:false}),client().from('test_pet_case_links').select('case_id,pet_id')]);
  if(a.error)throw a.error;if(b.error)throw b.error;
  pets=a.data||[];links=b.data||[];loaded=true;draw();
 }catch(e){if($('pawPetRegistryStatus'))$('pawPetRegistryStatus').textContent='تعذر تحميل السجل: '+e.message;}
 finally{loading=false;}
}
function draw(){
 const root=$('pawPetRegistryPanel');if(!root)return;
 const linked=new Set(links.map(x=>x.pet_id));
 const linkedCases=new Set(links.map(x=>String(x.case_id)));
 const unlinked=pets.filter(p=>!linked.has(p.id)).length;
 const stat=$('pawPetRegistryStatus');
 if(stat)stat.textContent='حيوانات مسجلة بهوية مستقلة: '+pets.length+' | حيوانات مرتبطة بحجز: '+linked.size+' | ملفات بدون حجز: '+unlinked+'. العدد التقديري 201 ليس العدد المؤكد.';
 const list=$('pawPetRegistryList');
 if(list)list.innerHTML=pets.slice(0,35).map(p=>'<div style="padding:7px;border-bottom:1px solid #e5e9f0">'+esc(p.pet_name)+' — '+esc(p.pet_type||'نوع غير مسجل')+' — '+esc(p.customer_phone)+' <span class="hint">'+(linked.has(p.id)?'مرتبط بحجز':'بانتظار ربط حجز')+'</span></div>').join('')||'<div class="hint">ما تم توثيق أي حيوان بهوية مستقلة حتى الآن. البيانات القديمة باقية كما هي.</div>';
 const c=$('pawPetCaseId');if(c){const keep=c.value;c.innerHTML='<option value="">اختاري العملية</option>';window.pawPetCases?.forEach(x=>{if(linkedCases.has(String(x.id)))return;const o=document.createElement('option');o.value=x.id;o.textContent='PAW-'+String(x.id).padStart(4,'0')+' — '+(x.client_name||'بدون اسم')+' — '+(x.client_phone||'بدون رقم');c.appendChild(o)});c.value=keep;}
 const p=$('pawPetExisting');if(p){const keep=p.value;p.innerHTML='<option value="">اختاري الحيوان المسجل</option>'+pets.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.pet_name)+' — '+esc(x.customer_phone)+'</option>').join('');p.value=keep;}
}
function ensure(){
 if($('pawPetRegistryPanel'))return;
 const crm=$('crmCustomerList');if(!crm)return;
 const panel=document.createElement('section');panel.id='pawPetRegistryPanel';panel.className='card';panel.style.margin='12px 0';
 panel.innerHTML='<h3>سجل الحيوانات المؤكد — TEST</h3><div class="hint" id="pawPetRegistryStatus">جارٍ تحميل الحيوانات الموثقة...</div><div class="hint">كل حيوان له ملف مستقل. لا ندمج حيوانين متشابهين ولا نحوّل بيانات قديمة إلى حيوانات مؤكدة تلقائياً.</div><div id="pawPetRegistryList"></div><div id="pawPetEditor" style="margin-top:12px"><h4>توثيق حيوان جديد</h4><div class="grid2"><div class="field"><label>رقم هاتف العميل</label><input id="pawPetPhone" inputmode="tel" placeholder="رقم العميل"></div><div class="field"><label>اسم الحيوان</label><input id="pawPetName" placeholder="اسم الحيوان"></div><div class="field"><label>نوع الحيوان</label><input id="pawPetType" placeholder="Dog / Cat"></div><div class="field"><label>السلالة</label><input id="pawPetBreed" placeholder="اختياري"></div></div><button class="btn primary" id="pawPetAdd">تسجيل حيوان بهوية مستقلة</button><h4>ربط حيوان مسجل بعملية قديمة</h4><div class="grid2"><div class="field"><label>الحيوان</label><select id="pawPetExisting"></select></div><div class="field"><label>العملية</label><select id="pawPetCaseId"></select></div></div><button class="btn" id="pawPetLink">ربط الحيوان بالعملية</button></div>';
 crm.before(panel);
 $('pawPetAdd').onclick=async()=>{
  if(!roleOK())return alert('الصلاحية للأدمن والعمليات');
  const phone=digits($('pawPetPhone').value),name=$('pawPetName').value.trim(),type=$('pawPetType').value.trim(),breed=$('pawPetBreed').value.trim();
  if(phone.length!==8||!name||!type)return alert('أدخلي رقم كويتي صحيح واسم الحيوان ونوعه');
  if(pets.some(p=>digits(p.customer_phone)===phone&&p.pet_name.trim().toLowerCase()===name.toLowerCase()))return alert('هذا الحيوان مسجل مسبقاً لنفس الرقم، اختاريه من القائمة');
  const {error}=await client().from('test_pet_registry').insert({customer_phone:phone,pet_name:name,pet_type:type,breed:breed||null});
  if(error)return alert(error.message);
  $('pawPetName').value='';await load();
 };
 $('pawPetLink').onclick=async()=>{
  if(!roleOK())return alert('الصلاحية للأدمن والعمليات');
  const id=Number($('pawPetCaseId').value),pet=pets.find(p=>p.id===$('pawPetExisting').value);
  const c=window.pawPetCases?.find(x=>Number(x.id)===id);
  if(!pet||!c)return alert('اختاري الحيوان والعملية');
  if(!c.client_phone||digits(c.client_phone)!==digits(pet.customer_phone))return alert('رقم عميل العملية لا يطابق صاحب الحيوان. لا يمكن الربط.');
  if(links.some(x=>Number(x.case_id)===id))return alert('هذه العملية مرتبطة بحيوان بالفعل');
  const {error}=await client().from('test_pet_case_links').insert({case_id:id,pet_id:pet.id});
  if(error)return alert(error.message);
  await load();
 };
}
window.pawPetRegistryRefresh=load;
document.addEventListener('DOMContentLoaded',()=>{
 const check=()=>{if($('crmCustomerList')){ensure();if(!loaded)load();}};
 check();new MutationObserver(check).observe(document.body,{childList:true,subtree:false});
});
})();