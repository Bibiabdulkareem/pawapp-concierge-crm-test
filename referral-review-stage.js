(function(){
'use strict';
window.pawStageReferralReview=async function(){
const status=document.getElementById('importStatus');
const button=document.getElementById('importCommit');
const file=document.getElementById('importFile')?.files?.[0];
if(!file){status.textContent='اختاري ملف الإكسل';return;}
if(!window.XLSX){status.textContent='مكتبة Excel غير جاهزة';return;}
if(!window.PAWAPP_AUTH?.client){status.textContent='سجلي الدخول أولاً';return;}
button.disabled=true;
try{
const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
const ws=wb.Sheets[wb.SheetNames.includes('Customers')?'Customers':wb.SheetNames[0]];
const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false}).filter(row=>row.some(x=>String(x).trim()));
const headers=data.shift();
if(!headers||headers[0]!=='اسم العميل'||headers[6]!=='اسم مقدم الخدمة'){throw Error('اختاري ملف العملاء النهائي');}
const rows=data.map((values,i)=>({sheet_name:'Final Review TEST Customers',source_row:i+2,source_data:Object.fromEntries(headers.map((h,j)=>[String(h),String(values[j]??'')]))}));
if(!rows.length||rows.length>100)throw Error('عدد الصفوف غير متوقع');
if(!confirm('حفظ '+rows.length+' إحالة للمراجعة في TEST دون تعديل الحالات أو التسويات؟')){button.disabled=false;return;}
status.textContent='جاري حفظ الإحالات للمراجعة...';
const result=await window.PAWAPP_AUTH.client.rpc('test_stage_referral_review',{p_rows:rows});
if(result.error)throw result.error;
status.textContent='تم حفظ '+result.data.added+' إحالة للمراجعة؛ موجودة مسبقاً '+result.data.already_staged+'. لم تتغير الحالات أو التسويات.';
}catch(error){status.textContent='خطأ الحفظ: '+error.message;button.disabled=false;}
};
document.addEventListener('click',function(event){
const button=event.target.closest('#importCommit');
if(!button||button.disabled||button.textContent.trim()!=='حفظ الإحالات للمراجعة في TEST')return;
event.stopImmediatePropagation();
window.pawStageReferralReview();
},true);
})();