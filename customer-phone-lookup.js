(function(){
    'use strict';
    function lookupPhone(value){
      const cleaned=String(value??'').normalize('NFKC')
        .replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660))
        .replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0))
        .replace(/[\s().-]/g,'');
      if(/^[1-9]\d{7}$/.test(cleaned))return '+965'+cleaned;
      if(/^965[1-9]\d{7}$/.test(cleaned))return '+'+cleaned;
      const international=cleaned.replace(/^00/,'+');
      if(!/^\+[1-9]\d{7,14}$/.test(international))return '';
      return international.startsWith('+965')&&!/^\+965[1-9]\d{7}$/.test(international)?'':international;
    }
    function customerCandidates(rows){
      const groups=new Map();
      for(const row of [...rows].sort((a,b)=>Number(b.id)-Number(a.id))){
        const phone=lookupPhone(row.client_phone);
        const name=String(row.client_name??'').normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
        const key=row.customer_id?'id:'+row.customer_id:phone&&name?phone+'|'+name:'case:'+row.id;
        if(!groups.has(key))groups.set(key,{row,count:0});
        groups.get(key).count++;
      }
      return [...groups.values()];
    }
    function byBookingPhone(phone){
      return db.cases.filter(c=>lookupPhone(c.client_phone)===phone);
    }
    function hasMultipleCandidates(value){
      const phone=lookupPhone(value);
      return !!phone&&customerCandidates(byBookingPhone(phone)).length>1;
    }
    function candidateButtons(candidates){
      return candidates.map(({row,count})=>
        '<button type="button" class="btn soft" style="margin:6px 0 0 6px" onclick="selectExistingCustomer('+Number(row.id)+')">'+
        esc(row.client_name||'اسم غير مسجل')+' · '+count+' من العمليات المطابقة</button>'
      ).join('');
    }
    window.smartNewCustomerHint=function(){
      const box=document.getElementById('smartExistingCustomerHint');
      if(!box)return;
      const value=document.getElementById('cPhone')?.value||'';
      const phone=lookupPhone(value);
      box.style.display=value.trim()?'block':'none';
      if(!phone){
        box.textContent=value.trim()?'أكملي رقم التلفون للبحث عن العميل.':'';
        return;
      }
      const candidates=customerCandidates(byBookingPhone(phone));
      if(!candidates.length){
        box.textContent='ما لقينا عملية سابقة بهالرقم. تقدرين تكمّلين بيانات العميل.';
        return;
      }
      const message=candidates.length>1
        ?'في أكثر من اسم أو سجل بهالرقم. اختاري العميل الصحيح. الحيوانات السابقة تحتاج تأكيد هويتها.'
        :'لقينا سجل سابق. اختاريه لتعبئة بيانات العميل.';
      box.innerHTML='<div class="hint">'+message+'</div>'+candidateButtons(candidates);
    };
    const searchByName=window.searchExistingCustomer;
    window.searchExistingCustomer=function(){
      const q=String(document.getElementById('existingCustomerSearch')?.value||'').trim();
      const out=document.getElementById('existingCustomerResults');
      if(!out)return;
      if(!q){out.textContent='اكتبي رقم التلفون أو اسم العميل.';return;}
      const phone=lookupPhone(q);
      if(!phone)return searchByName();
      const found=byBookingPhone(phone);
      out.innerHTML=found.length?candidateButtons(customerCandidates(found).slice(0,10)):'<div class="hint">ما لقينا سجل مطابق.</div>';
    };
    window.selectExistingCustomer=function(id){
      const x=db.cases.find(v=>Number(v.id)===Number(id));if(!x)return;
      const name=document.getElementById('cClient'),phone=document.getElementById('cPhone');
      if(name)name.value=x.client_name||'';
      if(phone){
        phone.value=x.client_phone||'';
        phone.dispatchEvent(new Event('input',{bubbles:true}));
      }
      const location=document.getElementById('cLocation');if(location)location.value=x.location||'';
      const box=document.getElementById('existingCustomerResults');
      if(box)box.innerHTML='<div class="status paid">تمت تعبئة بيانات العميل من العملية السابقة. راجعي التفاصيل ثم كمّلي الحيوان والخدمة.</div>';
      window.smartNewCustomerHint();
    };


    const phone=document.getElementById('cPhone');
    const name=document.getElementById('cClient');
    const hint=document.getElementById('smartExistingCustomerHint');
    const lookup=document.getElementById('existingCustomerSearch');
    if(!phone||!name||!hint)return;
    const phoneField=phone.closest('.field');
    const nameField=name.closest('.field');
    const customerCard=nameField.closest('.card');
    const lookupCard=lookup?.closest('.card');
    nameField.before(phoneField,hint);
    if(lookupCard)customerCard.after(lookupCard);
    phoneField.classList.add('full');
    phone.type='tel';
    phone.autocomplete='tel';
    phone.setAttribute('aria-describedby',hint.id);
    phoneField.querySelector('label')?.setAttribute('for',phone.id);

    let pickerLocked=false;
    function protectSharedNumber(){
      const picker=document.getElementById('pawPetBookingSelect');
      if(!picker)return;
      if(hasMultipleCandidates(phone.value)){
        if(!pickerLocked&&picker.disabled)return;
        pickerLocked=true;
        picker.value='';
        picker.disabled=true;
        const petName=document.getElementById('pawPetBookingName');
        if(petName)petName.disabled=false;
      }else if(pickerLocked){
        pickerLocked=false;
        picker.disabled=false;
      }
    }
    phone.addEventListener('input',protectSharedNumber);
    const openNewCase=window.openNewCase;
    window.openNewCase=function(...args){
      const result=openNewCase.apply(this,args);
      phone.dispatchEvent(new Event('input',{bubbles:true}));
      phone.focus();
      return result;
    };
})();
