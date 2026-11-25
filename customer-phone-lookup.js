(function(){
  'use strict';

  const search=document.getElementById('existingCustomerSearch');
  const results=document.getElementById('existingCustomerResults');
  if(!search||!results)return;

  const label=search.closest('.field')?.querySelector('label');
  if(label){
    label.textContent='ابحثي ببداية رقم التلفون أو الاسم، أو باسم المنطقة';
    label.htmlFor=search.id;
  }
  search.placeholder='مثال: 98، Bi، السالمية';

  function normalizeText(value){
    return String(value??'').normalize('NFKC').toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g,'')
      .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
      .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  }
  function normalizeDigits(value){
    return String(value??'').normalize('NFKC')
      .replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660))
      .replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0));
  }
  function phoneDigits(value){
    return normalizeDigits(value).replace(/[^0-9]/g,'').replace(/^00/,'');
  }
  function localPhone(digits){
    return /^965\d{8}$/.test(digits)?digits.slice(3):digits;
  }
  function phoneMatches(value,query,international){
    const digits=phoneDigits(value);
    const local=localPhone(digits);
    if(international){
      const full=/^\d{8}$/.test(digits)?'965'+digits:digits;
      return full.startsWith(query);
    }
    return local.startsWith(query);
  }
  function areaWords(value){
    return normalizeText(value).split(' ').filter(Boolean).map(word=>word.replace(/^ال(?=.{2})/,''));
  }
  function areaMatches(value,query){
    const words=areaWords(value);
    return query.length>0&&words.some((_,start)=>query.every((word,index)=>words[start+index]===word));
  }
  function areasFor(row){
    return [row.intake_details?.staff_listed_area,row.location].filter(Boolean);
  }

  window.searchExistingCustomer=function(){
    const input=normalizeDigits(search.value).trim();
    if(!input){
      results.textContent='اكتبي بداية الرقم أو الاسم، أو اسم المنطقة.';
      return;
    }
    const compact=input.replace(/[\s().-]/g,'');
    const numeric=/^\+?\d+$/.test(compact);
    const query=numeric?phoneDigits(input):normalizeText(input);
    if(!query){
      results.textContent='اكتبي بداية الرقم أو الاسم، أو اسم المنطقة.';
      return;
    }
    const international=/^(\+|00)/.test(compact)||/^965\d{8}$/.test(compact);
    const areaQuery=numeric?[]:areaWords(query);
    const matches=[];
    const seen=new Set();
    for(const row of db.cases.slice().reverse()){
      if(row.workflow_status==='cancelled')continue;
      const name=normalizeText(row.client_name);
      const areas=areasFor(row);
      const matchedPhone=numeric
        ?[row.client_phone,row.intake_details?.staff_listed_phone].find(value=>phoneMatches(value,query,international))
        :null;
      const matchedArea=numeric?null:areas.find(area=>areaMatches(area,areaQuery));
      if(numeric?!matchedPhone:!name.startsWith(query)&&!matchedArea)continue;
      const phone=localPhone(phoneDigits(row.client_phone||row.intake_details?.staff_listed_phone));
      const key=row.customer_id?'id:'+row.customer_id:phone&&name?phone+'|'+name:'case:'+row.id;
      if(seen.has(key))continue;
      seen.add(key);
      matches.push({row,matchedPhone,matchedArea});
    }
    results.innerHTML=matches.length?matches.map(({row,matchedPhone,matchedArea})=>{
      const details=[matchedPhone||row.client_phone||row.intake_details?.staff_listed_phone||'بدون رقم',matchedArea||areasFor(row)[0]].filter(Boolean);
      return '<button type="button" class="card" style="width:100%;text-align:right;box-shadow:none;margin-bottom:7px" onclick="selectExistingCustomer('+Number(row.id)+')">'+
        '<b>'+esc(row.client_name||'اسم غير مسجل')+'</b><div class="hint">'+esc(details.join(' • '))+'</div></button>';
    }).join(''):'<div class="hint">ما لقينا عميل مطابق.</div>';
  };
})();
