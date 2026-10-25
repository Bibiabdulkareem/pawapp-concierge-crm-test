(function(){
'use strict';
const fields=['اسم العميل','رقم العميل','نوع الخدمة أو مقدم الخدمة','نوع الحيوان','المبلغ المدفوع','دفع حق منو','اسم مقدم الخدمة','اسم الخدمة','تاريخ العملية','المنطقة','العمر','ملاحظات'];
const norm=x=>String(x==null?'':x).trim();
const get=(obj,...keys)=>{for(const k of keys){if(norm(obj[k]))return norm(obj[k]);}return '';};
const payment=x=>{const s=norm(x).toLowerCase();if(['pawapp','paw app','باو أب','باواب','باو اب','الشركة باو أب'].includes(s))return 'pawapp';if(['provider','partner','الشركة','العيادة','مقدم الخدمة','الدكتور'].includes(s))return 'provider';return '';};
function validate(obj){
 const issues=[];
 if(!get(obj,'اسم العميل','رقم العميل'))issues.push('اسم العميل أو رقم التلفون');
 if(!get(obj,'نوع الخدمة أو مقدم الخدمة','اسم مقدم الخدمة','اسم الخدمة','نوع الخدمة','اسم الدكتور'))issues.push('نوع الخدمة أو مقدم الخدمة/الدكتور');
 if(!get(obj,'نوع الحيوان'))issues.push('نوع الحيوان');
 const amount=get(obj,'المبلغ المدفوع','المبلغ الذي دفعه العميل','إجمالي العميل');
 if(!amount)issues.push('المبلغ المدفوع');
 else if(!/^\\d+(?:[.,]\\d{1,3})?$/.test(amount)||Number(amount.replace(',','.'))<0)issues.push('المبلغ المدفوع غير صحيح');
 const recipient=get(obj,'دفع حق منو','جهة استلام الدفع','العميل دفع لمن','العميل سدد لمن');
 if(!recipient)issues.push('دفع حق منو (باو أب أو الشركة)');
 else if(!payment(recipient))issues.push('جهة الدفع غير معروفة (باو أب أو الشركة)');
 return issues;
}
window.pawDownloadTemplate=function(){
 if(!window.XLSX){alert('انتظري تحميل مكتبة Excel ثم حاولي مرة ثانية');return;}
 const sheet=XLSX.utils.aoa_to_sheet([fields]);
 sheet['!cols']=fields.map(h=>({wch:Math.max(19,h.length+5)}));
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,sheet,'Customers');
 const help=XLSX.utils.aoa_to_sheet([
 ['تعليمات استيراد PawApp Concierge TEST'],
 ['اسم العميل أو رقم التلفون: واحد منهما يكفي'],
 ['نوع الخدمة أو اسم مقدم الخدمة/الدكتور: واحد منها يكفي'],
 ['نوع الحيوان: إلزامي'],
 ['المبلغ المدفوع: إلزامي، ويُقبل 0'],
 ['دفع حق منو: اكتبي باو أب أو الشركة فقط'],
 ['الحقول الأخرى اختيارية وتتحول النواقص إلى متابعة الموظفة'],
 ['المعاينة لا تستورد ولا تغيّر التسويات']
 ]);help['!cols']=[{wch:78}];XLSX.utils.book_append_sheet(wb,help,'Instructions');
 XLSX.writeFile(wb,'PawApp_Concierge_Import_Template.xlsx');
};
window.pawPreviewWithFeedback=async function(){
 const st=document.getElementById('importStatus'),pv=document.getElementById('importPreview'),btn=document.getElementById('importCommit'),file=document.getElementById('importFile')?.files?.[0];
 btn.disabled=true;btn.textContent='استيراد (غير متاح قبل اكتمال الأساسيات)';pv.textContent='';
 if(!file){st.textContent='اختاري ملف الإكسل أولاً';return;}
 try{
  if(!window.XLSX)throw Error('مكتبة Excel غير جاهزة');
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
  const ws=wb.Sheets[wb.SheetNames.includes('Customers')?'Customers':wb.SheetNames[0]];
  if(!ws)throw Error('الملف لا يحتوي على بيانات');
  const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,blankrows:true});
  const headerIndex=matrix.findIndex(row=>row.some(c=>norm(c)==='اسم العميل'||norm(c)==='رقم العميل'));
  if(headerIndex<0)throw Error('عناوين الأعمدة غير معروفة. حمّلي نموذج النظام واستخدميه');
  const headers=matrix[headerIndex].map(norm);
  const items=[],problems=[];let valid=0;
  for(let i=headerIndex+1;i<matrix.length;i++){
   const row=matrix[i];if(!row||!row.some(v=>norm(v)))continue;
   const obj=Object.fromEntries(headers.map((h,j)=>[h,norm(row[j])]));
   const missing=validate(obj);
   if(missing.length){problems.push({row:i+1,missing});items.push('❌ الصف '+(i+1)+': '+missing.join('، '));}
   else{valid++;items.push('✓ الصف '+(i+1)+': الأساسيات مكتملة');}
  }
  if(!valid&&!problems.length)throw Error('الملف خالٍ من العمليات');
  pv.style.whiteSpace='pre-wrap';pv.textContent='الإجمالي: '+(valid+problems.length)+' | مكتمل: '+valid+' | يحتاج تعديل: '+problems.length+'\\n\\n'+items.join('\\n');
  if(problems.length){st.textContent='الاستيراد ممنوع: عدّلي البيانات الأساسية الموضحة لكل صف، ثم ارفعي الملف مرة ثانية.';return;}
  st.textContent='الأساسيات مكتملة في جميع الصفوف. المعاينة فقط؛ الحفظ للمراجعة في TEST ولا ينشئ تسويات.';
  // Preserve existing safe staging action only for the original historical format.
  if(headers[0]==='اسم العميل'&&headers[6]==='اسم مقدم الخدمة'&&headers.includes('العميل سدد')){
   btn.textContent='حفظ الإحالات للمراجعة في TEST';btn.disabled=false;
  }else{
   st.textContent+=' نموذج النظام الجديد جاهز للمعاينة، لكن استيراده إلى الحالات يحتاج ربط التنفيذ قبل تفعيل الزر.';
  }
 }catch(e){st.textContent='خطأ المعاينة: '+e.message;}
};
})();