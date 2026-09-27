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
    'installment_schedule':'test_installment_schedule',
    'followups':'test_followups',
    'activity_log':'test_activity_log'
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
          <td>${esc(c.service||c.requested_service||'—')}${transportDashboardHtml(c)}</td>
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
      const reminders=db.cases
        .filter(c=>clientRem(c)>0.0001&&c.client_due_date)
        .sort((a,b)=>String(a.client_due_date).localeCompare(String(b.client_due_date)));
      const dueSection=document.getElementById('clientDueSection');
      const remEl=document.getElementById('clientDueReminders');
      if(dueSection) dueSection.style.display=reminders.length?'block':'none';
      if(remEl){
        remEl.innerHTML=reminders.map(c=>{
          const overdue=String(c.client_due_date)<today;
          return '<div class="card provider"><h3>'+esc(c.client_name)+'</h3><p>PAW-'+String(c.id).padStart(4,'0')+'</p><div class="miniGrid"><div class="mini"><span>المبلغ المتبقي</span><b>'+money(clientRem(c))+'</b></div><div class="mini"><span>موعد السداد</span><b>'+c.client_due_date+'</b></div><div class="mini"><span>الحالة</span><b class="'+(overdue?'red':'blue')+'">'+(overdue?'متأخر':'قادم')+'</b></div></div><div class="actions"><button class="btn soft" onclick="openCaseDetails(\''+c.id+'\')">فتح الحالة</button></div></div>';
        }).join('');
      }

      const pf=document.getElementById('dashboardProviderFilter')?.value||'all';
      const vf=document.getElementById('dashboardVendorStatusFilter')?.value||'all';
      let ph='';
      db.providers.forEach(pr=>{
        if(pf!=='all'&&pr.id!==pf)return;
        const cs=db.cases.filter(x=>x.providerId===pr.id);
        if(!cs.length)return;
        let totalDue=0,totalPaid=0,totalRemain=0;
        cs.forEach(x=>{
          totalDue+=due(x);
          totalPaid+=Number(x.providerPaid||0);
          totalRemain+=rem(x);
        });
        const fullyPaid=totalDue>0 && totalRemain<=0.0001;
        if(vf==='paid'&&!fullyPaid)return;
        if(vf==='unpaid'&&fullyPaid)return;
        ph+='<div class="card provider"><h3>'+esc(pr.name)+'</h3><div class="miniGrid"><div class="mini"><span>العمليات</span><b>'+cs.length+'</b></div><div class="mini"><span>إجمالي المستحق</span><b>'+money(totalDue)+'</b></div><div class="mini"><span>تم دفعه</span><b class="green">'+money(totalPaid)+'</b></div></div><div class="miniGrid"><div class="mini"><span>المتبقي</span><b class="'+(totalRemain>0?'red':'green')+'">'+money(totalRemain)+'</b></div><div class="mini"><span>حالة الحساب</span><b>'+(fullyPaid?'مسدد':'عليه مستحق')+'</b></div><div class="mini"><span>الجهة</span><b>'+esc(pr.name)+'</b></div></div><div class="actions"><button class="btn soft" onclick="providerCases(\''+pr.id+'\')">التفاصيل</button><button class="btn soft" onclick="exportProviderReport(\''+pr.id+'\')">تقرير CSV</button></div></div>';
      });
      document.getElementById('dashboardProviders').innerHTML=ph||'<div class="card">ما في نتائج على الفلتر الحالي.</div>';

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
      const src=document.getElementById('cSource'); if(src) src.value='manual_test';
      const qs=document.getElementById('existingCustomerSearch'); if(qs) qs.value='';
      const qr=document.getElementById('existingCustomerResults'); if(qr) qr.innerHTML='';
    };

    function normalizePetType(v){
      const s=String(v||'').trim().toLowerCase();
      const map={
        cat:'قط',dog:'كلب',bird:'طائر',rabbit:'أرنب',other:'أخرى',
        'قطة':'قط','قطه':'قط','كلاب':'كلب','طيور':'طائر','ارنب':'أرنب','أرنب':'أرنب',
        'قط':'قط','كلب':'كلب','طائر':'طائر','أخرى':'أخرى'
      };
      return map[s]||v||'';
    }

    window.searchExistingCustomer = function(){
      const q=(document.getElementById('existingCustomerSearch').value||'').trim().toLowerCase();
      const out=document.getElementById('existingCustomerResults');
      if(!q){out.innerHTML='<div class="hint">اكتبي رقم التلفون أو اسم العميل.</div>';return}
      const seen=new Set();
      const matches=[];
      db.cases.slice().reverse().forEach(x=>{
        const key=(x.client_phone||'')+'|'+(x.client_name||'')+'|'+(x.pet_type||'')+'|'+(x.breed||'');
        const hay=[x.client_phone,x.client_name,'PAW-'+String(x.id).padStart(4,'0')].join(' ').toLowerCase();
        if(hay.includes(q)&&!seen.has(key)){seen.add(key);matches.push(x)}
      });
      out.innerHTML=matches.length?matches.slice(0,8).map(x=>{
        const pet=[x.pet_type||'غير محدد',x.breed||''].filter(Boolean).join(' - ');
        return '<button type="button" class="card" style="width:100%;text-align:right;box-shadow:none;margin-bottom:7px;cursor:pointer" onclick="selectExistingCustomer(\''+x.id+'\')"><b>'+esc(x.client_name)+'</b><div class="hint">'+esc(x.client_phone||'بدون رقم')+' • '+esc(pet)+'</div></button>';
      }).join(''):'<div class="hint">ما لقيت عميل سابق. كملي كعميل جديد.</div>';
    };

    window.selectExistingCustomer = function(id){
      const x=db.cases.find(v=>String(v.id)===String(id)); if(!x)return;
      const tri=v=>v===true?'yes':v===false?'no':'';
      document.getElementById('cClient').value=x.client_name||'';
      document.getElementById('cPhone').value=x.client_phone||'';
      document.getElementById('cLocation').value=x.location||'';
      document.getElementById('cPetType').value=normalizePetType(x.pet_type);
      document.getElementById('cBreed').value=x.breed||'';
      document.getElementById('cPetAge').value=x.pet_age||'';
      document.getElementById('cPetFriendly').value=tri(x.pet_friendly);
      document.getElementById('cVaccinated').value=tri(x.vaccinated);
      document.getElementById('cMicrochipped').value=tri(x.microchipped);
      document.getElementById('cHasPetId').value=tri(x.has_pet_id);
      document.getElementById('cReason').value='';
      document.getElementById('existingCustomerResults').innerHTML='<div class="status paid">تم تحميل بيانات العميل والحيوان</div>';
      const src=document.getElementById('cSource'); if(src) src.value='manual_test';
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
      const missing=[];
      if(!client) missing.push('اسم العميل');
      if(!petType) missing.push('نوع الحيوان');
      if(!employeeId) missing.push('الموظف المسؤول');
      if(!providerId) missing.push('الشركة / الفريلانسر');
      if(!service) missing.push('الخدمة');
      if(base<=0) missing.push('السعر');
      if(missing.length){
        alert('باقي تكملين: '+missing.join('، '));
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
            preferred_date:document.getElementById('cDate').value||new Date().toISOString().slice(0,10),
            ...transportPayload('c',service)
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

    
    function isTransportServiceName(name){
      const s=String(name||'').toLowerCase().replace(/[_-]/g,' ');
      const keys=['taxi','تاكسي','pickup','pick up','باك اب','باك أب','بك اب','dropoff','drop off','دروب اوف','دروب أوف','نقل','توصيل'];
      return keys.some(k=>s.includes(k));
    }

    window.toggleTransportFields = function(prefix){
      const service=document.getElementById(prefix+'Service')?.value||'';
      const wrap=document.getElementById(prefix+'TransportFields');
      if(!wrap) return;
      const show=isTransportServiceName(service);
      wrap.style.display=show?'block':'none';
      if(!show){
        ['TransportDirection','TransportAt','PickupLocation','DropoffLocation'].forEach(sfx=>{
          const el=document.getElementById(prefix+sfx);
          if(el) el.value='';
        });
      }
    };

    function transportPayload(prefix,service){
      if(!isTransportServiceName(service)){
        return {transport_direction:null,transport_at:null,pickup_location:null,dropoff_location:null};
      }
      const at=document.getElementById(prefix+'TransportAt')?.value||'';
      return {
        transport_direction:document.getElementById(prefix+'TransportDirection')?.value||null,
        transport_at:at?new Date(at).toISOString():null,
        pickup_location:document.getElementById(prefix+'PickupLocation')?.value.trim()||null,
        dropoff_location:document.getElementById(prefix+'DropoffLocation')?.value.trim()||null
      };
    }

    function transportDashboardHtml(row){
      const service=row.service||row.requested_service||'';
      if(!isTransportServiceName(service)) return '';
      const bits=[];
      if(row.transport_at){
        const d=new Date(row.transport_at);
        if(Number.isFinite(d.getTime())) bits.push('⏰ '+d.toLocaleString('ar-KW',{dateStyle:'short',timeStyle:'short'}));
      }
      if(row.pickup_location) bits.push('استلام: '+esc(row.pickup_location));
      if(row.dropoff_location) bits.push('توصيل: '+esc(row.dropoff_location));
      return bits.length?'<div class="hint" style="margin-top:4px;line-height:1.5">'+bits.join('<br>')+'</div>':'';
    }

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
      toggleTransportFields('e');
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
      document.getElementById('ePetType').value=normalizePetType(c.pet_type);
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
      document.getElementById('eTransportDirection').value=c.transport_direction||'';
      document.getElementById('eTransportAt').value=c.transport_at?new Date(c.transport_at).toISOString().slice(0,16):'';
      document.getElementById('ePickupLocation').value=c.pickup_location||'';
      document.getElementById('eDropoffLocation').value=c.dropoff_location||'';
      toggleTransportFields('e');

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
            client_due_date:paidNow?null:(document.getElementById('eClientDueDate').value||null),
            ...transportPayload('e',service)
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

    window.exportProviderReport = function(id){
      const p=byProvider(id),rows=db.cases.filter(c=>c.providerId===id);
      if(!rows.length){alert('ما في عمليات لهذه الشركة / الفريلانسر');return}
      let totalDue=0,totalPaid=0,totalRemain=0;
      let csv='Case ID,Date,Client,Phone,Service,Client Total KD,PawApp KD,Company/Freelancer Due KD,Paid KD,Remaining KD,Client Payment Status,Staff,Source\n';
      rows.forEach(c=>{
        totalDue+=due(c); totalPaid+=Number(c.providerPaid||0); totalRemain+=rem(c);
        const clientStatus=(clientRem(c)<=0.0001&&Number(c.total_amount||0)>0)?'Paid':'Unpaid';
        csv+=[c.id,c.service_date,c.client_name,c.client_phone||'',c.service||c.requested_service||'',Number(c.total_amount||0).toFixed(3),paw(c).toFixed(3),due(c).toFixed(3),Number(c.providerPaid||0).toFixed(3),rem(c).toFixed(3),clientStatus,c.staff||'',sourceLabel(c.source)].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')+'\n';
      });
      csv+='\nSUMMARY,,,,,,,'+totalDue.toFixed(3)+','+totalPaid.toFixed(3)+','+totalRemain.toFixed(3)+'\n';
      const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;
      a.download=('PawApp-'+p.name+'-report.csv').replace(/\s+/g,'-');
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    };


    const ATTACHMENT_API='https://fccvnotgsmxirhztveai.supabase.co/functions/v1/test-case-attachments';

    function attachmentTypeLabel(v){
      return {
        client_invoice:'فاتورة العميل',
        client_receipt:'إيصال دفع العميل',
        vendor_invoice:'فاتورة الشركة / الفريلانسر',
        vendor_receipt:'إيصال دفع الشركة / الفريلانسر',
        other:'مرفق آخر'
      }[v]||'مرفق';
    }

    function ensureAttachmentUI(){
      if(document.getElementById('caseAttachmentsBox')) return;
      const modal=document.querySelector('#completeCaseModal .modal');
      const saveBtn=modal&&Array.from(modal.querySelectorAll('button')).find(b=>b.textContent.includes('حفظ كل التعديلات'));
      if(!modal||!saveBtn) return;

      const box=document.createElement('div');
      box.id='caseAttachmentsBox';
      box.innerHTML=
        '<div class="section"><h2>الفواتير والمرفقات</h2></div>'+
        '<div class="card" style="box-shadow:none">'+
          '<div id="attachmentLock">'+
            '<div class="grid2">'+
              '<div class="field"><label>PIN المرفقات</label><input id="attachmentPin" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div>'+
              '<div class="field" style="justify-content:flex-end"><button class="btn soft" type="button" onclick="unlockCaseAttachments()">فتح المرفقات</button></div>'+
            '</div>'+
          '</div>'+
          '<div id="attachmentControls" style="display:none">'+
            '<div class="grid2">'+
              '<div class="field"><label>نوع المرفق</label><select id="caseAttachmentType">'+
                '<option value="client_invoice">فاتورة العميل</option>'+
                '<option value="client_receipt">إيصال دفع العميل</option>'+
                '<option value="vendor_invoice">فاتورة الشركة / الفريلانسر</option>'+
                '<option value="vendor_receipt">إيصال دفع الشركة / الفريلانسر</option>'+
                '<option value="other">مرفق آخر</option>'+
              '</select></div>'+
              '<div class="field"><label>اختيار الملف</label><input id="caseAttachmentFile" type="file" accept="image/*,.pdf"></div>'+
            '</div>'+
            '<button class="btn soft" style="width:100%;margin-top:10px" type="button" onclick="uploadCaseAttachment()">+ رفع المرفق</button>'+
            '<div id="caseAttachmentList" style="margin-top:10px"></div>'+
            '<div class="hint">يدعم الصور وPDF حتى 10MB. الملفات خاصة في نسخة TEST.</div>'+
          '</div>'+
        '</div>';
      saveBtn.parentNode.insertBefore(box,saveBtn);

      const saved=sessionStorage.getItem('pawapp_attachment_pin');
      if(saved){
        document.getElementById('attachmentPin').value=saved;
        document.getElementById('attachmentLock').style.display='none';
        document.getElementById('attachmentControls').style.display='block';
      }
    }

    async function attachmentJson(payload){
      const r=await fetch(ATTACHMENT_API,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||'تعذر تنفيذ الطلب');
      return data;
    }

    window.unlockCaseAttachments=async function(){
      ensureAttachmentUI();
      const pin=document.getElementById('attachmentPin').value.trim();
      if(!pin){alert('اكتبي PIN المرفقات');return}
      const id=document.getElementById('editCaseId').value;
      try{
        await attachmentJson({action:'list',case_id:Number(id),pin});
        sessionStorage.setItem('pawapp_attachment_pin',pin);
        document.getElementById('attachmentLock').style.display='none';
        document.getElementById('attachmentControls').style.display='block';
        await loadCaseAttachments(id);
      }catch(e){
        alert(e.message||'PIN غير صحيح');
      }
    };

    window.loadCaseAttachments=async function(id){
      ensureAttachmentUI();
      const pin=sessionStorage.getItem('pawapp_attachment_pin');
      const list=document.getElementById('caseAttachmentList');
      if(!list) return;
      if(!pin){
        list.innerHTML='';
        document.getElementById('attachmentLock').style.display='block';
        document.getElementById('attachmentControls').style.display='none';
        return;
      }
      list.innerHTML='<div class="hint">جاري تحميل المرفقات...</div>';
      try{
        const data=await attachmentJson({action:'list',case_id:Number(id),pin});
        const rows=data.attachments||[];
        list.innerHTML=rows.length?rows.map(a=>
          '<div class="card" style="box-shadow:none;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
            '<div style="flex:1;min-width:180px"><b>'+esc(attachmentTypeLabel(a.attachment_type))+'</b><div class="hint">'+esc(a.file_name||'ملف')+'</div></div>'+
            (a.signed_url?'<a class="btn soft" style="text-decoration:none" target="_blank" rel="noopener" href="'+a.signed_url+'">فتح</a>':'')+
            '<button class="btn danger" type="button" onclick="deleteCaseAttachment(\''+a.id+'\')">حذف</button>'+
          '</div>'
        ).join(''):'<div class="hint">ما في فواتير أو مرفقات على هذه الحالة للحين.</div>';
      }catch(e){
        sessionStorage.removeItem('pawapp_attachment_pin');
        document.getElementById('attachmentLock').style.display='block';
        document.getElementById('attachmentControls').style.display='none';
        list.innerHTML='';
        alert(e.message||'تعذر تحميل المرفقات');
      }
    };

    window.uploadCaseAttachment=async function(){
      const id=document.getElementById('editCaseId').value;
      const pin=sessionStorage.getItem('pawapp_attachment_pin');
      const file=document.getElementById('caseAttachmentFile').files[0];
      const type=document.getElementById('caseAttachmentType').value;
      if(!pin){alert('افتحي المرفقات بالـPIN أول');return}
      if(!file){alert('اختاري صورة أو PDF');return}
      const fd=new FormData();
      fd.append('pin',pin);
      fd.append('case_id',id);
      fd.append('attachment_type',type);
      fd.append('file',file);
      try{
        const r=await fetch(ATTACHMENT_API,{method:'POST',body:fd});
        const data=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(data.error||'تعذر رفع الملف');
        document.getElementById('caseAttachmentFile').value='';
        await loadCaseAttachments(id);
        toast('تم رفع المرفق');
      }catch(e){
        alert(e.message||'تعذر رفع المرفق');
      }
    };

    window.deleteCaseAttachment=async function(attachmentId){
      if(!confirm('حذف هذا المرفق؟')) return;
      const id=document.getElementById('editCaseId').value;
      const pin=sessionStorage.getItem('pawapp_attachment_pin');
      try{
        await attachmentJson({action:'delete',id:attachmentId,pin});
        await loadCaseAttachments(id);
        toast('تم حذف المرفق');
      }catch(e){
        alert(e.message||'تعذر حذف المرفق');
      }
    };

    const originalOpenCaseDetailsForAttachments=window.openCaseDetails;
    window.openCaseDetails=function(id){
      originalOpenCaseDetailsForAttachments(id);
      ensureAttachmentUI();
      const saved=sessionStorage.getItem('pawapp_attachment_pin');
      if(saved){
        document.getElementById('attachmentLock').style.display='none';
        document.getElementById('attachmentControls').style.display='block';
        loadCaseAttachments(id);
      }else{
        document.getElementById('attachmentLock').style.display='block';
        document.getElementById('attachmentControls').style.display='none';
      }
    };

    
    window.renderCRM = function(){
      const q=(document.getElementById('crmSearch')?.value||'').trim().toLowerCase();
      const groups=new Map();
      db.cases.slice().reverse().forEach(x=>{
        const phone=(x.client_phone||'').replace(/\s+/g,'');
        const key=phone||('name:'+String(x.client_name||'').toLowerCase());
        if(!groups.has(key)) groups.set(key,{name:x.client_name||'بدون اسم',phone:x.client_phone||'',location:x.location||'',cases:[],pets:new Map()});
        const g=groups.get(key);
        g.cases.push(x);
        const pkey=[x.pet_type||'',x.breed||'',x.pet_age||''].join('|');
        if(!g.pets.has(pkey)) g.pets.set(pkey,{
          pet_type:x.pet_type||'غير محدد',
          breed:x.breed||'',
          pet_age:x.pet_age||'',
          vaccinated:x.vaccinated,
          microchipped:x.microchipped,
          has_pet_id:x.has_pet_id
        });
      });
      const all=[...groups.values()];
      const filtered=all.filter(g=>{
        const hay=[g.name,g.phone,g.location,...g.cases.map(x=>'PAW-'+String(x.id).padStart(4,'0'))].join(' ').toLowerCase();
        return !q||hay.includes(q);
      });
      const customerCount=document.getElementById('crmCustomerCount');
      const petCount=document.getElementById('crmPetCount');
      const caseCount=document.getElementById('crmCaseCount');
      if(customerCount) customerCount.textContent=String(all.length);
      if(petCount) petCount.textContent=String(all.reduce((n,g)=>n+g.pets.size,0));
      if(caseCount) caseCount.textContent=String(db.cases.length);
      const out=document.getElementById('crmCustomerList');
      if(!out) return;
      out.innerHTML=filtered.length?filtered.map((g,idx)=>{
        const pets=[...g.pets.values()];
        const petHtml=pets.map(p=>'<span class="status" style="margin:3px 3px 0 0">'+esc([p.pet_type,p.breed].filter(Boolean).join(' - '))+'</span>').join('');
        const last=g.cases[0];
        return '<div class="card" style="box-shadow:none">'+
          '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">'+
            '<div><b style="font-size:16px">'+esc(g.name)+'</b><div class="hint">'+esc(g.phone||'بدون رقم')+(g.location?' • '+esc(g.location):'')+'</div></div>'+
            '<div class="status paid">'+g.cases.length+' عملية</div>'+
          '</div>'+
          '<div style="margin-top:8px">'+(petHtml||'<span class="hint">لا توجد بيانات حيوان كاملة</span>')+'</div>'+
          '<div class="hint" style="margin-top:8px">آخر خدمة: '+esc((last&& (last.service||last.requested_service))||'غير محدد')+'</div>'+
          '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px">'+
            '<button class="btn soft" type="button" onclick="crmLoadCustomer(\''+String(last?.id||'')+'\')">خدمة جديدة</button>'+
            '<button class="btn soft" type="button" onclick="crmOpenHistory(\''+encodeURIComponent(g.phone||g.name)+'\')">سجل العميل</button>'+
          '</div>'+
        '</div>';
      }).join(''):'<div class="card"><div class="hint">ما لقينا عميل مطابق.</div></div>';
    };

    window.crmLoadCustomer = function(caseId){
      const x=db.cases.find(v=>String(v.id)===String(caseId)); if(!x)return;
      openNewCase();
      const tri=v=>v===true?'yes':v===false?'no':'';
      document.getElementById('cClient').value=x.client_name||'';
      document.getElementById('cPhone').value=x.client_phone||'';
      document.getElementById('cLocation').value=x.location||'';
      document.getElementById('cPetType').value=normalizePetType(x.pet_type);
      document.getElementById('cBreed').value=x.breed||'';
      document.getElementById('cPetAge').value=x.pet_age||'';
      document.getElementById('cPetFriendly').value=tri(x.pet_friendly);
      document.getElementById('cVaccinated').value=tri(x.vaccinated);
      document.getElementById('cMicrochipped').value=tri(x.microchipped);
      document.getElementById('cHasPetId').value=tri(x.has_pet_id);
      const box=document.getElementById('existingCustomerResults');
      if(box) box.innerHTML='<div class="status paid">تم تحميل ملف العميل والحيوان</div>';
    };

    window.crmOpenHistory = function(key){
      const decoded=decodeURIComponent(key);
      showPage('cases');
      const search=document.getElementById('caseSearch');
      if(search){search.value=decoded;renderCases();}
    };

    const originalShowPageCRM=window.showPage;
    window.showPage=function(id){
      originalShowPageCRM(id);
      if(id==='crm') renderCRM();
    };


    function followupStatusLabel(v){
      return {pending:'قيد المتابعة',done:'تم التواصل',no_answer:'ما رد',confirmed:'تم التأكيد',cancelled:'ألغى'}[v]||v||'قيد المتابعة';
    }

    window.renderFollowups = function(){
      const list=document.getElementById('followupList');
      const urgentList=document.getElementById('followupUrgentList');
      const historyList=document.getElementById('followupHistoryList');
      if(!list) return;

      const rows=(db.followups||[]).slice().sort((a,b)=>new Date(a.followup_at)-new Date(b.followup_at));
      const openRows=rows.filter(f=>!(f.status==='done'||f.status==='cancelled'));
      const doneRows=rows.filter(f=>f.status==='done'||f.status==='cancelled').sort((a,b)=>new Date(b.completed_at||b.followup_at)-new Date(a.completed_at||a.followup_at));

      const now=new Date();
      const localDate=d=>{
        const x=new Date(d);
        const y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,'0'),day=String(x.getDate()).padStart(2,'0');
        return y+'-'+m+'-'+day;
      };
      const today=localDate(now);
      let nToday=0,nLate=0,nUpcoming=0;

      openRows.forEach(f=>{
        const d=localDate(f.followup_at);
        if(d===today) nToday++;
        else if(d<today) nLate++;
        else nUpcoming++;
      });

      document.getElementById('followToday').textContent=String(nToday);
      document.getElementById('followLate').textContent=String(nLate);
      document.getElementById('followUpcoming').textContent=String(nUpcoming);

      const card=f=>{
        const ca=db.cases.find(x=>String(x.id)===String(f.case_id))||{};
        const emp=db.employees.find(x=>x.id===f.employee_id);
        const dt=new Date(f.followup_at);
        const d=Number.isFinite(dt.getTime())?dt.toLocaleString('ar-KW',{dateStyle:'medium',timeStyle:'short'}):String(f.followup_at||'');
        const isOpen=!(f.status==='done'||f.status==='cancelled');
        return '<div class="card" style="box-shadow:none">'+
          '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">'+
            '<div><b>'+esc(ca.client_name||'عميل')+'</b><div class="hint">PAW-'+String(ca.id||f.case_id).padStart(4,'0')+' • '+esc(ca.client_phone||'بدون رقم')+'</div></div>'+
            '<span class="status '+(f.status==='done'?'paid':'')+'">'+esc(followupStatusLabel(f.status))+'</span>'+
          '</div>'+
          '<div style="margin-top:8px"><b>الموعد:</b> '+esc(d)+'</div>'+
          (f.reason?'<div class="hint">السبب: '+esc(f.reason)+'</div>':'')+
          (f.notes?'<div class="hint">ملاحظة: '+esc(f.notes)+'</div>':'')+
          '<div class="hint">الموظف: '+esc(emp?.name||ca.staff||'غير محدد')+'</div>'+
          (isOpen?'<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px">'+
            '<button class="btn soft" onclick="setFollowupStatus(\''+f.id+'\',\'done\')">✓ تم / خلص الموضوع</button>'+
            '<button class="btn soft" onclick="openCaseDetails(\''+String(ca.id||f.case_id)+'\')">فتح الحالة</button>'+
            '<button class="btn soft" onclick="setFollowupStatus(\''+f.id+'\',\'no_answer\')">ما رد</button>'+
            '<button class="btn soft" onclick="setFollowupStatus(\''+f.id+'\',\'confirmed\')">تم التأكيد</button>'+
            '<button class="btn danger" onclick="setFollowupStatus(\''+f.id+'\',\'cancelled\')">ألغى</button>'+
          '</div>':'')+
        '</div>';
      };

      const urgent=openRows.filter(f=>{
        const t=new Date(f.followup_at).getTime();
        return Number.isFinite(t)&&t<=Date.now()+15*60*1000;
      });

      if(urgentList) urgentList.innerHTML=urgent.length?urgent.map(card).join(''):'<div class="card"><div class="hint">ما في متابعة تحتاج تدخل الحين.</div></div>';
      list.innerHTML=openRows.length?openRows.map(card).join(''):'<div class="card"><div class="hint">ما في متابعات مفتوحة للحين.</div></div>';
      if(historyList) historyList.innerHTML=doneRows.length?doneRows.map(card).join(''):'<div class="card"><div class="hint">ما في متابعات منتهية للحين.</div></div>';
    };

    window.setFollowupStatus = async function(id,status){
      try{
        await api('followups?id=eq.'+encodeURIComponent(id),{
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify({status,completed_at:(status==='done'||status==='cancelled')?new Date().toISOString():null})
        });
        await loadData();
        renderFollowups();
        toast('تم تحديث المتابعة');
      }catch(e){console.error(e);alert('تعذر تحديث المتابعة')}
    };

    window.addCaseFollowup = async function(){
      const caseId=document.getElementById('editCaseId').value;
      const at=document.getElementById('caseFollowupAt')?.value;
      const reason=document.getElementById('caseFollowupReason')?.value.trim()||null;
      const notes=document.getElementById('caseFollowupNotes')?.value.trim()||null;
      const row=db.cases.find(x=>String(x.id)===String(caseId));
      const btn=document.querySelector('#caseFollowupBox button[onclick="addCaseFollowup()"]');
      if(!at){alert('اختاري تاريخ ووقت المتابعة');return}
      try{
        if(btn){btn.disabled=true;btn.textContent='جاري الحفظ...';}
        const saved=await api('followups',{
          method:'POST',
          headers:{Prefer:'return=representation'},
          body:JSON.stringify({
            case_id:Number(caseId),
            employee_id:row?.employeeId||row?.employee_id||null,
            followup_at:new Date(at).toISOString(),
            reason,
            notes,
            status:'pending'
          })
        });
        if(!saved||!saved[0]||!saved[0].id) throw new Error('لم يتم تأكيد حفظ المتابعة');
        db.followups=Array.isArray(db.followups)?db.followups:[];
        db.followups.push(saved[0]);
        if(document.getElementById('caseFollowupAt')) document.getElementById('caseFollowupAt').value='';
        if(document.getElementById('caseFollowupReason')) document.getElementById('caseFollowupReason').value='';
        if(document.getElementById('caseFollowupNotes')) document.getElementById('caseFollowupNotes').value='';
        loadCaseFollowups(caseId);
        renderFollowups();
        checkFollowupAlerts(false);
        toast('تم حفظ المتابعة بنجاح');
        try{ await loadData(); }catch(e){ console.warn('refresh after followup save failed',e); }
      }catch(e){
        console.error(e);
        alert('تعذر حفظ المتابعة. ما راح نعتبرها محفوظة إلا إذا أكد النظام الحفظ.');
      }finally{
        if(btn){btn.disabled=false;btn.textContent='+ إضافة متابعة';}
      }
    };

    window.loadCaseFollowups = function(caseId){
      const box=document.getElementById('caseFollowupHistory');
      if(!box) return;
      const rows=(db.followups||[]).filter(f=>String(f.case_id)===String(caseId)).sort((a,b)=>String(b.followup_at||'').localeCompare(String(a.followup_at||'')));
      box.innerHTML=rows.length?rows.map(f=>'<div class="card" style="box-shadow:none;margin-top:7px"><b>'+esc(followupStatusLabel(f.status))+'</b><div class="hint">'+esc(String(f.followup_at||'').replace('T',' ').slice(0,16))+(f.reason?' • '+esc(f.reason):'')+'</div></div>').join(''):'<div class="hint">ما في متابعة مسجلة على هالحالة.</div>';
    };

    function ensureFollowupUI(){
      if(document.getElementById('caseFollowupBox')) return;
      const modal=document.querySelector('#completeCaseModal .modal');
      const saveBtn=modal&&Array.from(modal.querySelectorAll('button')).find(b=>b.textContent.includes('حفظ كل التعديلات'));
      if(!modal||!saveBtn) return;
      const box=document.createElement('div');
      box.id='caseFollowupBox';
      box.innerHTML=
        '<div class="section"><h2>المتابعة</h2></div>'+
        '<div class="card" style="box-shadow:none">'+
          '<div class="grid2">'+
            '<div class="field"><label>تاريخ ووقت المتابعة</label><input id="caseFollowupAt" type="datetime-local"></div>'+
            '<div class="field"><label>سبب المتابعة</label><input id="caseFollowupReason" placeholder="مثال: تأكيد الموعد"></div>'+
          '</div>'+
          '<div class="field" style="margin-top:8px"><label>ملاحظة</label><textarea id="caseFollowupNotes" rows="2"></textarea></div>'+
          '<button class="btn soft" style="width:100%;margin-top:9px" type="button" onclick="addCaseFollowup()">+ إضافة متابعة</button>'+
          '<div id="caseFollowupHistory" style="margin-top:8px"></div>'+
        '</div>';
      saveBtn.parentNode.insertBefore(box,saveBtn);
    }

    const originalOpenCaseDetailsForFollowups=window.openCaseDetails;
    window.openCaseDetails=function(id){
      originalOpenCaseDetailsForFollowups(id);
      ensureFollowupUI();
      loadCaseFollowups(id);
    };

    const prevShowPageFollowups=window.showPage;
    window.showPage=async function(id){
      prevShowPageFollowups(id);
      if(id==='followups'){
        try{
          db.followups=await api('followups?select=*&order=followup_at.asc');
        }catch(e){
          console.error('followups refresh failed',e);
          db.followups=db.followups||[];
        }
        renderFollowups();
        checkFollowupAlerts(false);
      }
    };


    const originalLoadDataForFollowups=window.loadData;
    window.loadData=async function(){
      await originalLoadDataForFollowups();
      try{
        db.followups=await api('followups?select=*');
        if(document.getElementById('followupList')) renderFollowups();
      }catch(e){console.error('followups load failed',e);db.followups=[]}
    };


    const followupAlerted=new Set();

    function playFollowupBeep(){
      try{
        const AC=window.AudioContext||window.webkitAudioContext;
        if(!AC) return;
        const ctx=new AC(),osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type='sine'; osc.frequency.value=880;
        gain.gain.setValueAtTime(0.0001,ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18,ctx.currentTime+0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.35);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime+0.38);
      }catch(e){console.warn('beep unavailable',e)}
    }

    window.enableBrowserFollowupNotifications=async function(){
      if(!('Notification' in window)){alert('هذا المتصفح ما يدعم إشعارات المتصفح');return}
      try{
        const p=await Notification.requestPermission();
        if(p==='granted'){toast('تم تفعيل تنبيه المتصفح');checkFollowupAlerts(true)}
        else alert('لازم تسمحين بالإشعارات من المتصفح');
      }catch(e){console.error(e);alert('تعذر تفعيل الإشعارات')}
    };

    function checkFollowupAlerts(force){
      const rows=(db.followups||[]).filter(f=>!(f.status==='done'||f.status==='cancelled'));
      const now=Date.now();
      const dueSoon=rows.filter(f=>{
        const t=new Date(f.followup_at).getTime();
        return Number.isFinite(t) && t<=now+15*60*1000;
      });

      const badge=document.getElementById('followupNavBadge');
      const banner=document.getElementById('followupAlertBanner');
      const txt=document.getElementById('followupAlertText');

      // Red badge = ANY open follow-up, even if its time is later.
      if(badge){
        badge.textContent=String(rows.length);
        badge.style.display=rows.length?'inline-block':'none';
      }

      // Red banner + sound/browser notification = due within 15 minutes or overdue.
      if(banner){
        banner.style.display=dueSoon.length?'block':'none';
        if(txt) txt.textContent=dueSoon.length===1
          ? 'متابعة واحدة موعدها خلال 15 دقيقة أو متأخرة'
          : 'عندك '+dueSoon.length+' متابعات موعدها خلال 15 دقيقة أو متأخرة';
      }

      dueSoon.forEach(f=>{
        if(!force && followupAlerted.has(f.id)) return;
        followupAlerted.add(f.id);
        const ca=db.cases.find(x=>String(x.id)===String(f.case_id))||{};
        const title='PawApp متابعة';
        const body=(ca.client_name||'عميل')+' • '+(f.reason||'موعد متابعة');
        if(document.visibilityState==='visible') playFollowupBeep();
        if('Notification' in window && Notification.permission==='granted'){
          try{ new Notification(title,{body,tag:'followup-'+f.id,renotify:false}); }catch(e){}
        }
      });

      if(document.getElementById('followupList')) renderFollowups();
    }

    document.addEventListener('click',function onceAudio(){
      try{playFollowupBeep()}catch(e){}
      document.removeEventListener('click',onceAudio);
    },{once:true});

    async function refreshFollowupsFromServer(){
      try{
        const fresh=await api('followups?select=*&order=followup_at.asc');
        db.followups=Array.isArray(fresh)?fresh:[];
        checkFollowupAlerts(false);
      }catch(e){console.error('followup polling failed',e);}
    }

    setInterval(refreshFollowupsFromServer,20000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkFollowupAlerts(false)});

    const previousLoadDataForAlerts=window.loadData;
    window.loadData=async function(){
      await previousLoadDataForAlerts();
      checkFollowupAlerts(false);
    };


    function activityLabel(action,details){
      const d=details||{};
      if(action==='case_created') return 'تم إنشاء الحالة';
      if(action==='client_payment_added') return 'تم تسجيل دفعة من العميل';
      if(action==='vendor_payment_added') return 'تم تسجيل دفعة للشركة / الفريلانسر';
      if(action==='attachment_added') return 'تم رفع مرفق';
      if(action==='followup_added') return 'تمت إضافة متابعة';
      if(action==='case_updated'){
        const parts=[];
        if(d.service_from!==undefined||d.service_to!==undefined) parts.push('تم تغيير الخدمة');
        if(d.total_from!==undefined||d.total_to!==undefined) parts.push('تم تعديل السعر');
        if(d.provider_changed) parts.push('تم تغيير الشركة / الفريلانسر');
        if(d.client_paid_from!==undefined||d.client_paid_to!==undefined) parts.push('تم تحديث حالة سداد العميل');
        if(d.due_date_from!==undefined||d.due_date_to!==undefined) parts.push('تم تعديل موعد السداد');
        if(d.transport_updated) parts.push('تم تعديل بيانات النقل');
        return parts.length?parts.join(' • '):'تم تعديل بيانات الحالة';
      }
      return 'تم تحديث الحالة';
    }

    function activityDetailsHtml(action,details){
      const d=details||{};
      const lines=[];
      if(action==='case_updated'){
        if(d.service_from!==undefined||d.service_to!==undefined) lines.push('الخدمة: '+esc(d.service_from||'—')+' ← '+esc(d.service_to||'—'));
        if(d.total_from!==undefined||d.total_to!==undefined) lines.push('السعر: '+Number(d.total_from||0).toFixed(3)+' ← '+Number(d.total_to||0).toFixed(3)+' د.ك');
        if(d.due_date_from!==undefined||d.due_date_to!==undefined) lines.push('موعد السداد: '+esc(d.due_date_from||'—')+' ← '+esc(d.due_date_to||'—'));
      }else if(action==='client_payment_added'){
        if(d.amount!==undefined) lines.push('المبلغ: '+Number(d.amount||0).toFixed(3)+' د.ك');
        if(d.method) lines.push('الطريقة: '+esc(d.method));
      }else if(action==='vendor_payment_added'){
        if(d.amount!==undefined) lines.push('المبلغ: '+Number(d.amount||0).toFixed(3)+' د.ك');
        if(d.method) lines.push('الطريقة: '+esc(d.method));
      }else if(action==='attachment_added'){
        if(d.file_name) lines.push(esc(d.file_name));
      }else if(action==='followup_added'){
        if(d.reason) lines.push('السبب: '+esc(d.reason));
      }
      return lines.length?'<div class="hint" style="margin-top:3px">'+lines.join('<br>')+'</div>':'';
    }

    function ensureActivityLogUI(){
      if(document.getElementById('caseActivityBox')) return;
      const modal=document.querySelector('#completeCaseModal .modal');
      const saveBtn=modal&&Array.from(modal.querySelectorAll('button')).find(b=>b.textContent.includes('حفظ كل التعديلات'));
      if(!modal||!saveBtn) return;
      const box=document.createElement('div');
      box.id='caseActivityBox';
      box.innerHTML=
        '<div class="section"><h2>سجل النشاط</h2></div>'+
        '<div class="card" style="box-shadow:none">'+
          '<div class="hint">كل التعديلات المهمة على الحالة تنحفظ تلقائيًا.</div>'+
          '<div id="caseActivityList" style="margin-top:8px"></div>'+
        '</div>';
      saveBtn.parentNode.insertBefore(box,saveBtn);
    }

    window.loadCaseActivityLog = async function(caseId){
      ensureActivityLogUI();
      const list=document.getElementById('caseActivityList');
      if(!list) return;
      list.innerHTML='<div class="hint">جاري تحميل السجل...</div>';
      try{
        const rows=await api('activity_log?case_id=eq.'+encodeURIComponent(caseId)+'&select=*&order=created_at.desc&limit=30');
        const staffList=db.staff||db.employees||[];
        list.innerHTML=(rows||[]).length?(rows||[]).map(r=>{
          const emp=staffList.find(e=>String(e.id)===String(r.employee_id));
          const dt=new Date(r.created_at);
          const when=Number.isFinite(dt.getTime())?dt.toLocaleString('ar-KW',{dateStyle:'medium',timeStyle:'short'}):String(r.created_at||'');
          return '<div style="padding:9px 0;border-bottom:1px solid #edf2f7">'+
            '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">'+
              '<b>'+esc(activityLabel(r.action,r.details))+'</b>'+
              '<span class="hint">'+esc(when)+'</span>'+
            '</div>'+
            '<div class="hint">'+esc(emp?.name||'النظام')+'</div>'+
            activityDetailsHtml(r.action,r.details)+
          '</div>';
        }).join(''):'<div class="hint">ما في نشاط مسجل على هالحالة للحين.</div>';
      }catch(e){
        console.error(e);
        list.innerHTML='<div class="hint">تعذر تحميل سجل النشاط.</div>';
      }
    };

    const originalOpenCaseDetailsForActivity=window.openCaseDetails;
    window.openCaseDetails=function(id){
      originalOpenCaseDetailsForActivity(id);
      ensureActivityLogUI();
      loadCaseActivityLog(id);
    };

(async()=>{
      try{
        await loadData();
      }catch(e){
        console.error('initial test load failed',e);
      }
      renderAll();
      checkFollowupAlerts(false);
    })();
  };
  document.head.appendChild(script);
})();