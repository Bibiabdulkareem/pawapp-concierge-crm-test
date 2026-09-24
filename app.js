(function(){
  'use strict';
  const originalFetch = window.fetch.bind(window);
  const tableMap = {
    'employees':'test_employees',
    'providers':'test_providers',
    'services':'test_services',
    'cases':'test_cases',
    'settlements':'test_settlements',
    'client_payments':'test_client_payments',
    'installment_schedule':'test_installment_schedule'
  };

  window.fetch = function(input, init){
    let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (url && url.indexOf('/rest/v1/') !== -1) {
      for (const [from,to] of Object.entries(tableMap)) {
        url = url.replace('/rest/v1/' + from, '/rest/v1/' + to);
      }
      if (typeof input === 'string') return originalFetch(url, init);
      input = new Request(url, input);
    }
    return originalFetch(input, init);
  };

  const badge = document.createElement('div');
  badge.textContent = 'TEST MODE';
  badge.style.cssText = 'position:fixed;top:8px;left:8px;z-index:9999;background:#fff3cd;color:#7a5a00;border:1px solid #f1d77a;border-radius:999px;padding:6px 10px;font:700 11px -apple-system,BlinkMacSystemFont,Segoe UI,Tahoma,Arial,sans-serif;box-shadow:0 2px 8px #0001';
  document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(badge));

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/gh/Bibiabdulkareem/pop-up-concierge-operation@d2919c2b088c0c17f5ff06339f6a3e5a5c0c4434/app.js';
  script.onload = function(){
    window.renderCases = function(){
      const q=(document.getElementById('caseSearch').value||'').toLowerCase();
      const pf=document.getElementById('caseProviderFilter')?.value||'all';
      let h='';
      db.cases.slice().reverse().forEach(c=>{
        const pr=byProvider(c.providerId);
        const hay=['PAW-'+String(c.id).padStart(4,'0'),c.client_name,c.client_phone,c.staff,pr.name,c.service,c.pet_type,c.breed,sourceLabel(c.source)].join(' ').toLowerCase();
        if(q&&!hay.includes(q))return;
        if(pf!=='all'&&c.providerId!==pf)return;
        const clientPaid=clientRem(c)<=0.0001;
        const providerPaid=rem(c)<=0.0001;
        const yesNo=v=>v===true?'نعم':v===false?'لا':'—';
        const missing=!c.pet_type||!c.breed||c.vaccinated===null||c.vaccinated===undefined||!c.location;
        h+=`<tr>
          <td>PAW-${String(c.id).padStart(4,'0')}</td>
          <td>${esc(c.client_name)}</td>
          <td>${esc(c.pet_type||'—')}</td>
          <td>${esc(c.breed||'—')}</td>
          <td>${yesNo(c.vaccinated)}</td>
          <td>${yesNo(c.microchipped)}</td>
          <td>${esc(pr.name)}</td>
          <td>${esc(c.service)}</td>
          <td>${money(c.amount)}</td>
          <td>${money(paw(c))}</td>
          <td>${money(due(c))}</td>
          <td><span class="status ${clientPaid?'paid':'unpaid'}">${clientPaid?'تم الدفع':'لم يتم الدفع'}</span></td>
          <td><span class="status ${providerPaid?'paid':'pending'}">${providerPaid?'تم الدفع للمقدم':'لم يتم الدفع للمقدم'}</span></td>
          <td>${esc(c.staff||'—')}<br><span class="status partial" style="margin-top:4px">${esc(sourceLabel(c.source))}</span></td>
          <td><button class="btn ${missing?'yellow':'soft'}" style="padding:7px" onclick="openCaseDetails('${c.id}')">${missing?'استكمال البيانات':'عرض / تعديل'}</button></td>
          <td><button class="btn soft" style="padding:7px" onclick="openClientPayment('${c.id}')">${clientPaid?'عرض':'تسجيل دفع'}</button></td>
          <td><button class="btn soft" style="padding:7px" onclick="openSettlement('${c.id}')">${providerPaid?'عرض':'دفع للمقدم'}</button></td>
        </tr>`;
      });
      document.getElementById('caseRows').innerHTML=h||'<tr><td colspan="17">لا توجد عمليات</td></tr>';
    };

    const originalRenderDashboard = window.renderDashboard;
    window.renderDashboard = function(){
      originalRenderDashboard();
      const upcoming=document.getElementById('upcomingInstallments');
      if(upcoming) upcoming.innerHTML='';
      let h='';
      db.cases.slice().reverse().slice(0,6).forEach(c=>{
        const pr=byProvider(c.providerId);
        const clientPaid=clientRem(c)<=0.0001;
        const vacc=c.vaccinated===true?'نعم':c.vaccinated===false?'لا':'—';
        h+=`<tr>
          <td>PAW-${String(c.id).padStart(4,'0')}</td>
          <td>${esc(c.client_name)}</td>
          <td>${esc(c.pet_type||'—')}${c.breed?'<br><span class="hint">'+esc(c.breed)+'</span>':''}</td>
          <td>${vacc}</td>
          <td>${esc(pr.name)}</td>
          <td>${esc(c.service)}</td>
          <td>${money(c.amount)}</td>
          <td>${money(paw(c))}</td>
          <td>${money(due(c))}</td>
          <td><span class="status ${clientPaid?'paid':'unpaid'}">${clientPaid?'تم الدفع':'لم يتم الدفع'}</span></td>
        </tr>`;
      });
      document.getElementById('recent').innerHTML=h||'<tr><td colspan="10">لا توجد عمليات</td></tr>';
    };

    window.togglePaymentPlan = function(){
      const p=document.getElementById('cPaymentPlan'); if(p) p.value='full';
      const iw=document.getElementById('installmentsWrap'); if(iw) iw.style.display='none';
      const isw=document.getElementById('installmentScheduleWrap'); if(isw) isw.style.display='none';
      const ir=document.getElementById('installmentRows'); if(ir) ir.innerHTML='';
      const paid=document.getElementById('cClientPaid'); if(paid) paid.disabled=false;
    };

    window.renderProviders = function(){
      const q=(document.getElementById('providerSearch').value||'').toLowerCase();
      let h='';
      db.providers.filter(p=>!q||p.name.toLowerCase().includes(q)).forEach(p=>{
        const cs=db.cases.filter(c=>c.providerId===p.id);
        let sales=0,r=0; cs.forEach(x=>{sales+=x.amount;r+=rem(x)});
        const typ=p.type==='freelancer'?'Freelancer':(p.category==='veterinary'?'Company - Veterinary':'Company - Services');
        const feeTxt=p.feeType==='fixed'?money(p.feeValue)+' ثابت':p.feeValue+'%';
        const services=p.services.length?p.services.map(x=>'<span class="status partial" style="margin:3px">'+esc(x)+'</span>').join(''):'<span class="hint">ما في خدمات مضافة</span>';
        h+='<div class="card provider"><h3>'+esc(p.name)+'</h3><p>'+typ+' • '+feeTxt+'</p><div style="margin-top:8px">'+services+'</div><div class="miniGrid"><div class="mini"><span>العمليات</span><b>'+cs.length+'</b></div><div class="mini"><span>الإجمالي</span><b>'+money(sales)+'</b></div><div class="mini"><span>متبقي</span><b>'+money(r)+'</b></div></div><div class="actions"><button class="btn primary" onclick="openServiceManager(\''+p.id+'\')">إدارة الخدمات</button><button class="btn soft" onclick="providerCases(\''+p.id+'\')">العمليات</button><button class="btn danger" onclick="deleteProvider(\''+p.id+'\')">حذف</button></div></div>';
      });
      document.getElementById('providerList').innerHTML=h||'<div class="card">لا توجد نتائج</div>';
    };

    window.openServiceManager = async function(providerId){
      const p=db.providers.find(x=>x.id===providerId); if(!p)return;
      document.getElementById('serviceProviderId').value=providerId;
      document.getElementById('serviceModalTitle').textContent='خدمات '+p.name;
      document.getElementById('serviceName').value='';
      const rows=await api('services?select=*&provider_id=eq.'+encodeURIComponent(providerId)+'&order=created_at.asc');
      document.getElementById('serviceList').innerHTML=(rows||[]).map(s=>'<div class="card" style="box-shadow:none;margin-bottom:8px;display:flex;align-items:center;gap:8px"><b style="flex:1">'+esc(s.name)+'</b><button class="btn danger" onclick="deleteProviderService(\''+s.id+'\',\''+providerId+'\')">حذف</button></div>').join('')||'<div class="card" style="box-shadow:none">ما في خدمات مضافة.</div>';
      document.getElementById('serviceModal').classList.add('show');
    };

    window.addProviderService = async function(){
      const providerId=document.getElementById('serviceProviderId').value;
      const name=document.getElementById('serviceName').value.trim();
      if(!providerId||!name){alert('اكتبي اسم الخدمة');return}
      try{
        await api('services',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({provider_id:providerId,name})});
        await loadData();
        await openServiceManager(providerId);
        toast('تمت إضافة الخدمة');
      }catch(e){console.error(e);alert('تعذر إضافة الخدمة أو الخدمة موجودة من قبل')}
    };

    window.deleteProviderService = async function(serviceId,providerId){
      if(!confirm('حذف الخدمة؟'))return;
      try{
        await api('services?id=eq.'+encodeURIComponent(serviceId),{method:'DELETE'});
        await loadData();
        await openServiceManager(providerId);
      }catch(e){console.error(e);alert('تعذر حذف الخدمة')}
    };

    window.saveProvider = async function(){
      const name=document.getElementById('pName').value.trim();
      if(!name){alert('اكتبي اسم مقدم الخدمة');return}
      try{
        await api('providers',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
          name:name,
          provider_type:document.getElementById('pType').value,
          category:document.getElementById('pType').value==='company'?document.getElementById('pCategory').value:null,
          phone:document.getElementById('pPhone').value.trim(),
          default_fee_type:document.getElementById('pFeeType').value,
          default_fee_value:Number(document.getElementById('pCommission').value||0)
        })});
        document.getElementById('pName').value='';
        document.getElementById('pPhone').value='';
        closeModal('providerModal');
        await loadData();
        toast('تمت إضافة مقدم الخدمة — الحين أضيفي خدماته');
      }catch(e){console.error(e);alert('تعذر إضافة مقدم الخدمة')}
    };

    window.openNewCase = function(){
      showPage('newcase');
      fillProviders();
      fillStaff();
      document.getElementById('cDate').value=new Date().toISOString().slice(0,10);
      ['cClient','cPhone','cLocation','cBreed','cPetAge','cReason','cAmount','cNotes','cPaymentNote'].forEach(id=>{const e=document.getElementById(id); if(e)e.value=''});
      ['cPetType','cPetFriendly','cVaccinated','cMicrochipped','cHasPetId'].forEach(id=>{const e=document.getElementById(id); if(e)e.value=''});
      document.getElementById('cClientPaid').value='unpaid';
      const src=document.getElementById('cSource'); if(src) src.value='whatsapp_quick';
    };

    window.saveCase = async function(){
      const client=document.getElementById('cClient').value.trim();
      const employeeId=document.getElementById('cStaff').value;
      const providerId=document.getElementById('cProvider').value;
      const service=document.getElementById('cService').value;
      const petType=document.getElementById('cPetType').value;
      const base=Number(document.getElementById('cAmount').value||0);
      const feeType=document.getElementById('cFeeType').value;
      const feeValue=Number(document.getElementById('cCommission').value||0);
      if(!client||!employeeId||!providerId||!service||!petType||base<=0){
        alert('كملي اسم العميل، نوع الحيوان، الموظف، مقدم الخدمة، الخدمة والمبلغ.');
        return;
      }
      const total=feeType==='fixed'?base+feeValue:base;
      const pw=feeType==='fixed'?feeValue:total*feeValue/100;
      const providerAmount=total-pw;
      const tri=v=>v==='yes'?true:v==='no'?false:null;
      try{
        const inserted=await api('cases',{
          method:'POST',
          headers:{Prefer:'return=representation'},
          body:JSON.stringify({
            service_date:document.getElementById('cDate').value||new Date().toISOString().slice(0,10),
            client_name:client,
            client_phone:document.getElementById('cPhone').value.trim(),
            employee_id:employeeId,
            provider_id:providerId,
            service_name:service,
            fee_type:feeType,
            fee_value:feeValue,
            total_amount:total,
            pawapp_amount:pw,
            provider_amount:providerAmount,
            client_paid:false,
            payment_method:document.getElementById('cPayMethod').value,
            client_payment_plan:'full',
            client_payment_note:document.getElementById('cPaymentNote').value.trim()||null,
            notes:document.getElementById('cNotes').value.trim()||null,
            source:document.getElementById('cSource')?.value||'manual_test',
            workflow_status:'new_request',
            requested_service:service,
            location:document.getElementById('cLocation').value.trim()||null,
            pet_type:petType,
            breed:document.getElementById('cBreed').value.trim()||null,
            pet_age:document.getElementById('cPetAge').value.trim()||null,
            pet_friendly:tri(document.getElementById('cPetFriendly').value),
            reason:document.getElementById('cReason').value.trim()||null,
            vaccinated:tri(document.getElementById('cVaccinated').value),
            microchipped:tri(document.getElementById('cMicrochipped').value),
            has_pet_id:tri(document.getElementById('cHasPetId').value),
            preferred_date:document.getElementById('cDate').value||new Date().toISOString().slice(0,10)
          })
        });
        if(document.getElementById('cClientPaid').value==='paid'){
          await api('client_payments',{
            method:'POST',
            headers:{Prefer:'return=minimal'},
            body:JSON.stringify({
              case_id:inserted[0].id,
              amount:total,
              paid_at:document.getElementById('cDate').value||new Date().toISOString().slice(0,10),
              method:document.getElementById('cPayMethod').value,
              note:document.getElementById('cPaymentNote').value.trim()||null
            })
          });
          await api('cases?id=eq.'+encodeURIComponent(inserted[0].id),{
            method:'PATCH',
            headers:{Prefer:'return=minimal'},
            body:JSON.stringify({client_paid:true})
          });
        }
        await loadData();
        showPage('cases');
        toast('تم حفظ العميل والحيوان والعملية');
      }catch(e){
        console.error(e);
        alert('تعذر حفظ العملية');
      }
    };

    window.sourceLabel = function(src){
      const map={
        booking_form_test:'فورم واتساب',
        whatsapp_quick:'واتساب سريع',
        phone_call:'مكالمة',
        manual_test:'إدخال داخلي',
        instagram:'Instagram',
        referral:'تحويل / توصية'
      };
      return map[src]||'غير محدد';
    };

    window.openCaseDetails = function(id){
      const c=db.cases.find(x=>String(x.id)===String(id)); if(!c)return;
      const tri=v=>v===true?'yes':v===false?'no':'';
      document.getElementById('editCaseId').value=id;
      document.getElementById('ePhone').value=c.client_phone||'';
      document.getElementById('eLocation').value=c.location||'';
      document.getElementById('ePetType').value=c.pet_type||'';
      document.getElementById('eBreed').value=c.breed||'';
      document.getElementById('ePetAge').value=c.pet_age||'';
      document.getElementById('ePetFriendly').value=tri(c.pet_friendly);
      document.getElementById('eVaccinated').value=tri(c.vaccinated);
      document.getElementById('eMicrochipped').value=tri(c.microchipped);
      document.getElementById('eHasPetId').value=tri(c.has_pet_id);
      document.getElementById('eReason').value=c.reason||'';
      document.getElementById('completeCaseModal').classList.add('show');
    };

    window.saveCaseDetails = async function(){
      const id=document.getElementById('editCaseId').value;
      const tri=v=>v==='yes'?true:v==='no'?false:null;
      try{
        await api('cases?id=eq.'+encodeURIComponent(id),{
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify({
            client_phone:document.getElementById('ePhone').value.trim(),
            location:document.getElementById('eLocation').value.trim()||null,
            pet_type:document.getElementById('ePetType').value||null,
            breed:document.getElementById('eBreed').value.trim()||null,
            pet_age:document.getElementById('ePetAge').value.trim()||null,
            pet_friendly:tri(document.getElementById('ePetFriendly').value),
            vaccinated:tri(document.getElementById('eVaccinated').value),
            microchipped:tri(document.getElementById('eMicrochipped').value),
            has_pet_id:tri(document.getElementById('eHasPetId').value),
            reason:document.getElementById('eReason').value.trim()||null
          })
        });
        closeModal('completeCaseModal');
        await loadData();
        toast('تم استكمال بيانات العميل');
      }catch(e){console.error(e);alert('تعذر حفظ البيانات')}
    };

    renderAll();
  };
  document.head.appendChild(script);
})();