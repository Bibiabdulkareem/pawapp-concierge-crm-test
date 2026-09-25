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
      const sf=document.getElementById('caseStatusFilter')?.value||'all';
      const pf=document.getElementById('caseProviderFilter')?.value||'all';
      let h='';
      db.cases.slice().reverse().forEach(c=>{
        const pr=byProvider(c.providerId);
        const hay=['PAW-'+String(c.id).padStart(4,'0'),c.client_name,c.client_phone,c.staff,pr.name,c.service,c.pet_type,c.breed,sourceLabel(c.source)].join(' ').toLowerCase();
        const clientPaid=clientRem(c)<=0.0001 && Number(c.total_amount||0)>0;
        const vendorPaid=rem(c)<=0.0001 && Number(c.provider_amount||0)>0;
        if(q&&!hay.includes(q))return;
        if(pf!=='all'&&c.providerId!==pf)return;
        if(sf==='client_unpaid'&&clientPaid)return;
        if(sf==='client_paid'&&!clientPaid)return;
        if(sf==='vendor_unpaid'&&vendorPaid)return;
        if(sf==='vendor_paid'&&!vendorPaid)return;
        const yesNo=v=>v===true?'نعم':v===false?'لا':'—';
        const missing=!c.providerId||!c.service||Number(c.total_amount||0)<=0||!c.pet_type||!c.location;
        const dueTxt=!clientPaid&&c.client_due_date?c.client_due_date:'—';
        h+=`<tr>
          <td>PAW-${String(c.id).padStart(4,'0')}</td>
          <td>${esc(c.client_name)}</td>
          <td>${esc(c.pet_type||'—')}</td>
          <td>${esc(c.breed||'—')}</td>
          <td>${yesNo(c.vaccinated)}</td>
          <td>${yesNo(c.microchipped)}</td>
          <td>${esc(pr.name)}</td>
          <td>${esc(c.service||c.requested_service||'—')}</td>
          <td>${money(c.amount)}</td>
          <td>${money(paw(c))}</td>
          <td>${money(due(c))}</td>
          <td><span class="status ${clientPaid?'paid':'unpaid'}">${clientPaid?'تم السداد بالكامل':'لم يسدد'}</span></td>
          <td>${dueTxt}</td>
          <td><span class="status ${vendorPaid?'paid':'pending'}">${vendorPaid?'تم الدفع':'لم يتم الدفع'}</span></td>
          <td>${esc(c.staff||'—')}<br><span class="status partial" style="margin-top:4px">${esc(sourceLabel(c.source))}</span></td>
          <td><button class="btn ${missing?'yellow':'soft'}" style="padding:7px" onclick="openCaseDetails('${c.id}')">${missing?'استكمال البيانات':'تعديل البيانات'}</button></td>
          <td><button class="btn soft" style="padding:7px" onclick="openCaseDetails('${c.id}')">${clientPaid?'بيانات السداد':'تحديث السداد'}</button></td>
          <td><button class="btn soft" style="padding:7px" onclick="${Number(c.provider_amount||0)>0?'openSettlement(\''+c.id+'\')':'openCaseDetails(\''+c.id+'\')'}">${Number(c.provider_amount||0)<=0?'أكمل السعر':(vendorPaid?'تم الدفع':'تسجيل دفع')}</button></td>
        </tr>`;
      });
      document.getElementById('caseRows').innerHTML=h||'<tr><td colspan="18">لا توجد عمليات</td></tr>';
    };

    const originalRenderDashboard = window.renderDashboard;
    window.renderDashboard = function(){
      originalRenderDashboard();
      const upcoming=document.getElementById('upcomingInstallments');
      if(upcoming) upcoming.innerHTML='';
      const today=new Date().toISOString().slice(0,10);
      const reminders=db.cases.filter(c=>clientRem(c)>0.0001&&c.client_due_date).sort((a,b)=>String(a.client_due_date).localeCompare(String(b.client_due_date)));
      const remEl=document.getElementById('clientDueReminders');
      if(remEl){
        remEl.innerHTML=reminders.length?reminders.map(c=>{
          const overdue=String(c.client_due_date)<today;
          return '<div class="card provider"><h3>'+esc(c.client_name)+'</h3><p>PAW-'+String(c.id).padStart(4,'0')+'</p><div class="miniGrid"><div class="mini"><span>المبلغ</span><b>'+money(clientRem(c))+'</b></div><div class="mini"><span>موعد السداد</span><b>'+c.client_due_date+'</b></div><div class="mini"><span>الحالة</span><b class="'+(overdue?'red':'blue')+'">'+(overdue?'متأخر':'قادم')+'</b></div></div><div class="actions"><button class="btn soft" onclick="openCaseDetails(\''+c.id+'\')">فتح الحالة</button></div></div>';
        }).join(''):'<div class="card">ما في مواعيد سداد مسجلة.</div>';
      }
      let h='';
      db.cases.slice().reverse().slice(0,6).forEach(c=>{
        const pr=byProvider(c.providerId);
        const clientPaid=clientRem(c)<=0.0001 && Number(c.total_amount||0)>0;
        const vacc=c.vaccinated===true?'نعم':c.vaccinated===false?'لا':'—';
        h+=`<tr>
          <td>PAW-${String(c.id).padStart(4,'0')}</td>
          <td>${esc(c.client_name)}</td>
          <td>${esc(c.pet_type||'—')}${c.breed?'<br><span class="hint">'+esc(c.breed)+'</span>':''}</td>
          <td>${vacc}</td>
          <td>${esc(pr.name)}</td>
          <td>${esc(c.service||c.requested_service||'—')}</td>
          <td>${money(c.amount)}</td>
          <td>${money(paw(c))}</td>
          <td>${money(due(c))}</td>
          <td><span class="status ${clientPaid?'paid':'unpaid'}">${clientPaid?'تم السداد':'لم يسدد'}</span></td>
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

    window.editProviderChanged = function(){
      const pid=document.getElementById('eProvider').value;
      const p=db.providers.find(x=>x.id===pid);
      const s=document.getElementById('eService');
      s.innerHTML='<option value="">اختاري الخدمة</option>';
      if(p){
        p.services.forEach(x=>s.innerHTML+='<option>'+esc(x)+'</option>');
        document.getElementById('eFeeType').value=p.feeType||'percent';
        document.getElementById('eFeeValue').value=Number(p.feeValue||0);
      }
      calcEditCase();
    };

    window.calcEditCase = function(){
      const total=Number(document.getElementById('eTotalAmount').value||0);
      const feeType=document.getElementById('eFeeType').value;
      const feeValue=Number(document.getElementById('eFeeValue').value||0);
      const pawAmount=feeType==='fixed'?feeValue:total*feeValue/100;
      const providerAmount=Math.max(0,total-pawAmount);
      document.getElementById('eProviderAmount').value=providerAmount.toFixed(3);
      document.getElementById('eFeeValueLabel').textContent=feeType==='fixed'?'حصة PawApp (د.ك)':'نسبة PawApp %';
    };

    window.toggleEditDueDate = function(){
      const paid=document.getElementById('eClientPaid').value==='paid';
      document.getElementById('eDueDateWrap').style.display=paid?'none':'flex';
      if(paid) document.getElementById('eClientDueDate').value='';
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

      const ps=document.getElementById('eProvider');
      ps.innerHTML='<option value="">اختاري الشركة / الفريلانسر</option>';
      db.providers.forEach(p=>ps.innerHTML+='<option value="'+p.id+'">'+esc(p.name)+'</option>');
      ps.value=c.providerId||'';
      editProviderChanged();
      if(c.service) document.getElementById('eService').value=c.service;

      document.getElementById('eTotalAmount').value=Number(c.total_amount||0).toFixed(3);
      document.getElementById('eFeeType').value=c.fee_type||'percent';
      document.getElementById('eFeeValue').value=Number(c.fee_value||0);
      calcEditCase();

      const paid=clientRem(c)<=0.0001 && Number(c.total_amount||0)>0;
      document.getElementById('eClientPaid').value=paid?'paid':'unpaid';
      document.getElementById('eClientDueDate').value=c.client_due_date||'';
      document.getElementById('ePaymentMethod').value=c.payment_method||'KNET';
      toggleEditDueDate();
      document.getElementById('completeCaseModal').classList.add('show');
    };

    window.saveCaseDetails = async function(){
      const id=document.getElementById('editCaseId').value;
      const row=db.cases.find(x=>String(x.id)===String(id)); if(!row)return;
      const tri=v=>v==='yes'?true:v==='no'?false:null;
      const providerId=document.getElementById('eProvider').value||null;
      const service=document.getElementById('eService').value||null;
      const total=Number(document.getElementById('eTotalAmount').value||0);
      const feeType=document.getElementById('eFeeType').value;
      const feeValue=Number(document.getElementById('eFeeValue').value||0);
      const pawAmount=feeType==='fixed'?feeValue:total*feeValue/100;
      const providerAmount=Math.max(0,total-pawAmount);
      const paidNow=document.getElementById('eClientPaid').value==='paid';
      const existingPaid=clientPaidAmt(row);
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
            reason:document.getElementById('eReason').value.trim()||null,
            provider_id:providerId,
            service_name:service,
            requested_service:row.requested_service||service,
            fee_type:feeType,
            fee_value:feeValue,
            total_amount:total,
            pawapp_amount:pawAmount,
            provider_amount:providerAmount,
            payment_method:document.getElementById('ePaymentMethod').value,
            client_paid:paidNow,
            client_payment_plan:paidNow?'full':'later',
            client_due_date:paidNow?null:(document.getElementById('eClientDueDate').value||null)
          })
        });

        if(paidNow && total>0 && existingPaid<total-0.0001){
          await api('client_payments',{
            method:'POST',
            headers:{Prefer:'return=minimal'},
            body:JSON.stringify({
              case_id:Number(id),
              amount:total-existingPaid,
              paid_at:new Date().toISOString().slice(0,10),
              method:document.getElementById('ePaymentMethod').value,
              note:'تسديد كامل من شاشة الحالة'
            })
          });
        }
        closeModal('completeCaseModal');
        await loadData();
        toast('تم حفظ بيانات الحالة');
      }catch(e){console.error(e);alert('تعذر حفظ البيانات')}
    };

    renderAll();
  };
  document.head.appendChild(script);
})();