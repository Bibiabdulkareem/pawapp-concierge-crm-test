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
    'activity_log':'test_activity_log',
    'case_attachments':'test_case_attachments'
  };

  window.fetch = function(input, init){
    let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    const method = String((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();

    if (url && url.indexOf('/rest/v1/') !== -1) {
      const isFinanceSnapshotRead = method === 'POST' && /\/rest\/v1\/rpc\/test_finance_snapshot(?:[?#]|$)/.test(url);
      if (document.body && ['read_only','accountant'].includes(document.body.dataset.pawRole) && !['GET','HEAD'].includes(method) && !isFinanceSnapshotRead) {
        return Promise.resolve(new Response(JSON.stringify({message:'Read only access'}), {
          status:403,
          headers:{'Content-Type':'application/json'}
        }));
      }

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
        const hay=['PAW-'+String(c.id).padStart(4,'0'),c.client_name,c.client_phone,c.staff,pr.name,c.service,c.pet_type,c.breed,sourceLabel(c.source),workflowLabel(c.workflow_status)].join(' ').toLowerCase();
        const clientPaid=clientRem(c)<=0.0001 && Number(c.total_amount||0)>0;
        const vendorPaid=rem(c)<=0.0001 && Number(c.provider_amount||0)>0;
        let companyStatus='بانتظار دفع العميل',companyStatusClass='pending';
        if(clientPaid&&c.client_paid_to==='provider'){
          if(v2CollectFromProvider(c)>0.0001){companyStatus='استلمت من العميل • حصة PawApp مستحقة';companyStatusClass='pending';}
          else{companyStatus='استلمت من العميل • مكتمل';companyStatusClass='paid';}
        }else if(clientPaid&&c.client_paid_to==='pawapp'){
          if(v2PayProvider(c)>0.0001){companyStatus='مستحق للشركة';companyStatusClass='pending';}
          else{companyStatus='تم تحويل مستحق الشركة';companyStatusClass='paid';}
        }else if(clientPaid&&!c.client_paid_to){companyStatus='حددي دفع لمن';companyStatusClass='unpaid';}
        if(q&&!hay.includes(q))return;
        if(pf!=='all'&&c.providerId!==pf)return;
        if(sf==='client_unpaid'&&clientPaid)return;
        if(sf==='client_paid'&&!clientPaid)return;
        const providerOutstanding=clientPaid&&c.client_paid_to==='pawapp'&&v2PayProvider(c)>0.0001;
        if(sf==='vendor_unpaid'&&!providerOutstanding)return;
        if(sf==='vendor_paid'&&providerOutstanding)return;
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
          <td><span class="status ${companyStatusClass}">${companyStatus}</span></td>
          <td>${esc(c.staff||'—')}<br><span class="status partial" style="margin-top:4px">${esc(sourceLabel(c.source))}</span></td>
          <td><span class="status partial" style="display:inline-block;margin-bottom:5px">${esc(workflowLabel(c.workflow_status))}</span><br><button class="btn ${missing?'yellow':'soft'}" style="padding:7px" onclick="openCaseDetails('${c.id}')">${missing?'استكمال البيانات':'تعديل البيانات'}</button></td>
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
            appointment_at:document.getElementById('cAppointmentAt')?.value?new Date(document.getElementById('cAppointmentAt').value).toISOString():null,
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

    async function attachmentAuthHeaders(){
      const token=window.PAWAPP_AUTH?.session?.access_token;
      if(!token) throw new Error('لازم تسجيل الدخول');
      return {Authorization:'Bearer '+token};
    }

    function canEditAttachments(){
      const role=window.PAWAPP_AUTH?.access?.role||'';
      return role==='admin'||role==='operations';
    }

    function ensureAttachmentUI(){
      if(document.getElementById('caseAttachmentsBox')) return;
      const modal=document.querySelector('#completeCaseModal .modal');
      const saveBtn=modal&&Array.from(modal.querySelectorAll('button')).find(b=>b.textContent.includes('حفظ كل التعديلات'));
      if(!modal||!saveBtn) return;
      const writable=canEditAttachments();
      const box=document.createElement('div');
      box.id='caseAttachmentsBox';
      box.innerHTML=
        '<div class="section"><h2>الفواتير والمرفقات</h2></div>'+
        '<div class="card" style="box-shadow:none">'+
          (writable?'<div class="grid2">'+
            '<div class="field"><label>نوع المرفق</label><select id="caseAttachmentType">'+
              '<option value="client_invoice">فاتورة العميل</option>'+
              '<option value="client_receipt">إيصال دفع العميل</option>'+
              '<option value="vendor_invoice">فاتورة الشركة / الفريلانسر</option>'+
              '<option value="vendor_receipt">إيصال دفع الشركة / الفريلانسر</option>'+
              '<option value="other">مرفق آخر</option>'+
            '</select></div>'+
            '<div class="field"><label>اختيار الملف</label><input id="caseAttachmentFile" type="file" accept="image/*,.pdf"></div>'+
          '</div>'+
          '<button class="btn soft" style="width:100%;margin-top:10px" type="button" onclick="uploadCaseAttachment()">+ رفع المرفق</button>':'')+
          '<div id="caseAttachmentList" style="margin-top:10px"></div>'+
          '<div class="hint">الصور وPDF حتى 10MB • الوصول حسب حساب الموظف وصلاحيته.</div>'+
        '</div>';
      saveBtn.parentNode.insertBefore(box,saveBtn);
    }

    async function attachmentJson(payload){
      const headers=await attachmentAuthHeaders();
      headers['Content-Type']='application/json';
      const r=await fetch(ATTACHMENT_API,{method:'POST',headers,body:JSON.stringify(payload)});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||'تعذر تنفيذ الطلب');
      return data;
    }

    window.loadCaseAttachments=async function(id){
      ensureAttachmentUI();
      const list=document.getElementById('caseAttachmentList');
      if(!list) return;
      list.innerHTML='<div class="hint">جاري تحميل المرفقات...</div>';
      try{
        const data=await attachmentJson({action:'list',case_id:Number(id)});
        const rows=data.attachments||[];
        list.innerHTML=rows.length?rows.map(x=>
          '<div class="card" style="box-shadow:none;margin-top:7px">'+
            '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">'+
              '<div><b>'+esc(attachmentTypeLabel(x.attachment_type))+'</b><div class="hint">'+esc(x.file_name||'ملف')+'</div></div>'+
              '<div style="display:flex;gap:6px">'+
                (x.signed_url?'<a class="btn soft" href="'+esc(x.signed_url)+'" target="_blank" rel="noopener">فتح</a>':'')+
                (canEditAttachments()?'<button class="btn danger" type="button" onclick="deleteCaseAttachment(\''+x.id+'\')">حذف</button>':'')+
              '</div>'+
            '</div>'+
          '</div>').join(''):'<div class="hint">ما في مرفقات على هالحالة.</div>';
      }catch(e){list.innerHTML='<div class="hint">'+esc(e.message||'تعذر تحميل المرفقات')+'</div>';}
    };

    window.uploadCaseAttachment=async function(){
      if(!canEditAttachments()){alert('ما عندج صلاحية رفع مرفقات');return}
      const id=document.getElementById('editCaseId').value;
      const file=document.getElementById('caseAttachmentFile')?.files[0];
      const type=document.getElementById('caseAttachmentType')?.value||'other';
      if(!file){alert('اختاري صورة أو PDF');return}
      const fd=new FormData();
      fd.append('case_id',id); fd.append('attachment_type',type); fd.append('file',file);
      try{
        const headers=await attachmentAuthHeaders();
        const rr=await fetch(ATTACHMENT_API,{method:'POST',headers,body:fd});
        const data=await rr.json().catch(()=>({}));
        if(!rr.ok) throw new Error(data.error||'تعذر رفع الملف');
        document.getElementById('caseAttachmentFile').value='';
        await loadCaseAttachments(id);
        toast('تم رفع المرفق');
      }catch(e){alert(e.message||'تعذر رفع المرفق')}
    };

    window.deleteCaseAttachment=async function(attachmentId){
      if(!canEditAttachments()){alert('ما عندج صلاحية حذف المرفقات');return}
      if(!confirm('حذف هذا المرفق؟')) return;
      const id=document.getElementById('editCaseId').value;
      try{
        await attachmentJson({action:'delete',id:attachmentId});
        await loadCaseAttachments(id);
        toast('تم حذف المرفق');
      }catch(e){alert(e.message||'تعذر حذف المرفق')}
    };

    const originalOpenCaseDetailsForAttachments=window.openCaseDetails;
    window.openCaseDetails=function(id){
      originalOpenCaseDetailsForAttachments(id);
      ensureAttachmentUI();
      loadCaseAttachments(id);
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
        const emp=(db.staff||[]).find(x=>x.id===f.employee_id);
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
      if(badge && !document.getElementById('followupFinanceList')){
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



    /* payment-destination-v2 */
    function v2ClientPaid(c){
      return !!c.client_paid || (clientRem(c)<=0.0001 && Number(c.total_amount||0)>0);
    }
    function v2CollectFromProvider(c){
      if(!v2ClientPaid(c) || c.client_paid_to!=='provider') return 0;
      return Math.max(0,Number(c.pawapp_amount||0)-Number(c.pawapp_received_from_provider||0));
    }
    function v2PayProvider(c){
      if(!v2ClientPaid(c) || c.client_paid_to!=='pawapp') return 0;
      return Math.max(0,Number(c.provider_amount||0)-Number(c.providerPaid||0));
    }
    function v2Route(c){
      if(!v2ClientPaid(c)) return 'لم يسدد';
      if(c.client_paid_to==='pawapp') return 'دفع لـ PawApp';
      if(c.client_paid_to==='provider') return 'دفع للشركة / الفريلانسر';
      return 'تم السداد - حددي دفع لمن';
    }
    window.toggleNewPaymentFields=function(){
      const paid=document.getElementById('cClientPaid')&&document.getElementById('cClientPaid').value==='paid';
      const a=document.getElementById('cPaidToWrap'),b=document.getElementById('cDueDateWrap');
      if(a)a.style.display=paid?'flex':'none';
      if(b)b.style.display=paid?'none':'flex';
      if(paid&&document.getElementById('cClientDueDate'))document.getElementById('cClientDueDate').value='';
    };
    window.toggleEditPaymentFields=function(){
      const paid=document.getElementById('eClientPaid')&&document.getElementById('eClientPaid').value==='paid';
      const route=document.getElementById('ePaidTo')?document.getElementById('ePaidTo').value:'';
      const a=document.getElementById('ePaidToWrap'),b=document.getElementById('eDueDateWrap'),d=document.getElementById('ePawappCollectedWrap');
      if(a)a.style.display=paid?'flex':'none';
      if(b)b.style.display=paid?'none':'flex';
      if(d)d.style.display=(paid&&route==='provider')?'flex':'none';
      if(paid&&document.getElementById('eClientDueDate'))document.getElementById('eClientDueDate').value='';
      const id=document.getElementById('editCaseId')?document.getElementById('editCaseId').value:'';
      const row=db.cases.find(function(x){return String(x.id)===String(id)});
      const s=document.getElementById('eFinancialSummary');
      if(s&&row){
        if(!paid){
          s.innerHTML='<b class="red">المعلق فقط: تحصيل من العميل</b><div class="hint">متبقي على العميل '+money(clientRem(row))+'</div>';
        }else if(!route){
          s.innerHTML='<b class="red">العميل مسدد ✓ لكن ناقص تحديد جهة الدفع</b><div class="hint">اختاري فوق: دفع لـ PawApp أو دفع للشركة / العيادة مباشرة.</div>';
        }else if(route==='provider'){
          const left=Math.max(0,Number(row.pawapp_amount||0)-(document.getElementById('ePawappCollected').value==='yes'?Number(row.pawapp_amount||0):Number(row.pawapp_received_from_provider||0)));
          s.innerHTML=left>0
            ?'<b class="red">العميل مسدد ✓ — المعلق فقط: تحصيل حصة PawApp من الشركة</b><div class="hint">المبلغ المطلوب تحصيله '+money(left)+' • بعد التحصيل اختاري "نعم" في: تم استلام حصة PawApp من الشركة؟</div>'
            :'<b class="green">العميل مسدد ✓ وحصة PawApp مستلمة ✓</b><div class="hint">لا يوجد تحصيل مالي ناقص من الشركة.</div>';
        }else{
          const left=v2PayProvider(row);
          s.innerHTML=left>0
            ?'<b class="red">العميل مسدد لـ PawApp ✓ — المعلق فقط: دفع مستحق الشركة</b><div class="hint">المبلغ المطلوب دفعه للشركة '+money(left)+'</div>'
            :'<b class="green">العميل مسدد ✓ وتمت تسوية مستحق الشركة ✓</b><div class="hint">لا يوجد سداد مالي ناقص.</div>';
        }
      }
    };
    window.toggleEditDueDate=window.toggleEditPaymentFields;

    const v2OpenCase=window.openCaseDetails;
    window.openCaseDetails=function(id){
      v2OpenCase(id);
      const row=db.cases.find(function(x){return String(x.id)===String(id)});
      if(!row)return;
      const paid=v2ClientPaid(row);
      if(document.getElementById('eClientPaid'))document.getElementById('eClientPaid').value=paid?'paid':'unpaid';
      if(document.getElementById('ePaidTo'))document.getElementById('ePaidTo').value=row.client_paid_to||'';
      if(document.getElementById('ePawappCollected'))document.getElementById('ePawappCollected').value=(Number(row.pawapp_amount||0)>0&&Number(row.pawapp_received_from_provider||0)>=Number(row.pawapp_amount||0)-0.0001)?'yes':'no';
      window.toggleEditPaymentFields();
    };

    const v2OpenNewCase=window.openNewCase;
    window.openNewCase=function(){
      v2OpenNewCase();
      if(document.getElementById('cClientPaid'))document.getElementById('cClientPaid').value='unpaid';
      if(document.getElementById('cPaidTo'))document.getElementById('cPaidTo').value='pawapp';
      if(document.getElementById('cClientDueDate'))document.getElementById('cClientDueDate').value='';
      window.toggleNewPaymentFields();
    };

    window.saveCase=async function(){
      const client=document.getElementById('cClient').value.trim();
      const employeeId=document.getElementById('cStaff').value;
      const providerId=document.getElementById('cProvider').value;
      const service=document.getElementById('cService').value;
      const petType=document.getElementById('cPetType').value;
      const base=Number(document.getElementById('cAmount').value||0);
      const feeType=document.getElementById('cFeeType').value;
      const feeValue=Number(document.getElementById('cCommission').value||0);
      const paidNow=document.getElementById('cClientPaid').value==='paid';
      const paidTo=paidNow?(document.getElementById('cPaidTo').value||'pawapp'):null;
      const missing=[];
      if(!client)missing.push('اسم العميل');
      if(!petType)missing.push('نوع الحيوان');
      if(!employeeId)missing.push('الموظف المسؤول');
      if(!providerId)missing.push('الشركة / الفريلانسر');
      if(!service)missing.push('الخدمة');
      if(base<=0)missing.push('السعر');
      if(missing.length){alert('باقي تكملين: '+missing.join('، '));return}
      const total=feeType==='fixed'?base+feeValue:base;
      const pw=feeType==='fixed'?feeValue:total*feeValue/100;
      const providerAmount=Math.max(0,total-pw);
      const tri=function(v){return v==='yes'?true:v==='no'?false:null};
      try{
        const inserted=await api('cases',{
          method:'POST',headers:{Prefer:'return=representation'},
          body:JSON.stringify({
            service_date:document.getElementById('cDate').value||new Date().toISOString().slice(0,10),
            client_name:client,client_phone:document.getElementById('cPhone').value.trim(),
            employee_id:employeeId,provider_id:providerId,service_name:service,
            fee_type:feeType,fee_value:feeValue,total_amount:total,pawapp_amount:pw,provider_amount:providerAmount,
            client_paid:paidNow,client_paid_to:paidTo,pawapp_received_from_provider:0,
            payment_method:document.getElementById('cPayMethod').value,
            client_payment_plan:paidNow?'full':'later',
            client_due_date:paidNow?null:(document.getElementById('cClientDueDate').value||null),
            client_payment_note:document.getElementById('cPaymentNote').value.trim()||null,
            notes:document.getElementById('cNotes').value.trim()||null,
            source:document.getElementById('cSource')?document.getElementById('cSource').value:'manual_test',
            workflow_status:'new_request',requested_service:service,
            location:document.getElementById('cLocation').value.trim()||null,
            pet_type:petType,breed:document.getElementById('cBreed').value.trim()||null,
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
        if(paidNow&&paidTo==='pawapp'){
          await api('client_payments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
            case_id:inserted[0].id,amount:total,
            paid_at:document.getElementById('cDate').value||new Date().toISOString().slice(0,10),
            method:document.getElementById('cPayMethod').value,
            note:document.getElementById('cPaymentNote').value.trim()||null
          })});
        }
        await loadData();showPage('cases');toast('تم حفظ العملية');
      }catch(e){console.error(e);alert('تعذر حفظ العملية')}
    };

    window.saveCaseDetails=async function(){
      const id=document.getElementById('editCaseId').value;
      const row=db.cases.find(function(x){return String(x.id)===String(id)});if(!row)return;
      const tri=function(v){return v==='yes'?true:v==='no'?false:null};
      const providerId=document.getElementById('eProvider').value||null;
      const service=document.getElementById('eService').value||null;
      const total=Number(document.getElementById('eTotalAmount').value||0);
      const feeType=document.getElementById('eFeeType').value;
      const feeValue=Number(document.getElementById('eFeeValue').value||0);
      const pawAmount=feeType==='fixed'?feeValue:total*feeValue/100;
      const providerAmount=Math.max(0,total-pawAmount);
      const paidNow=document.getElementById('eClientPaid').value==='paid';
      const paidTo=paidNow?(document.getElementById('ePaidTo').value||'pawapp'):null;
      const collected=(paidNow&&paidTo==='provider'&&document.getElementById('ePawappCollected').value==='yes')?pawAmount:0;
      const existingPaid=clientPaidAmt(row);
      try{
        await api('cases?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({
          client_phone:document.getElementById('ePhone').value.trim(),
          employee_id:document.getElementById('eEmployee')?.value||null,
          location:document.getElementById('eLocation').value.trim()||null,
          pet_type:document.getElementById('ePetType').value||null,
          breed:document.getElementById('eBreed').value.trim()||null,
          pet_age:document.getElementById('ePetAge').value.trim()||null,
          pet_friendly:tri(document.getElementById('ePetFriendly').value),
          vaccinated:tri(document.getElementById('eVaccinated').value),
          microchipped:tri(document.getElementById('eMicrochipped').value),
          has_pet_id:tri(document.getElementById('eHasPetId').value),
          reason:document.getElementById('eReason').value.trim()||null,
          provider_id:providerId,service_name:service,requested_service:row.requested_service||service,
          fee_type:feeType,fee_value:feeValue,total_amount:total,pawapp_amount:pawAmount,provider_amount:providerAmount,
          payment_method:document.getElementById('ePaymentMethod').value,
          client_paid:paidNow,client_paid_to:paidTo,pawapp_received_from_provider:collected,
          client_payment_plan:paidNow?'full':'later',
          client_due_date:paidNow?null:(document.getElementById('eClientDueDate').value||null),
          appointment_at:document.getElementById('eAppointmentAt')?.value?new Date(document.getElementById('eAppointmentAt').value).toISOString():null,
          ...transportPayload('e',service)
        })});
        if(paidNow&&paidTo==='pawapp'&&total>0&&existingPaid<total-0.0001){
          await api('client_payments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
            case_id:Number(id),amount:total-existingPaid,paid_at:new Date().toISOString().slice(0,10),
            method:document.getElementById('ePaymentMethod').value,note:'تسديد كامل من شاشة الحالة'
          })});
        }
        closeModal('completeCaseModal');await loadData();toast('تم حفظ بيانات الحالة');
      }catch(e){console.error(e);alert('تعذر حفظ البيانات')}
    };

    function providerActivity(pr){
      const mainCases=db.cases.filter(function(c){return c.providerId===pr.id});
      const transportCases=db.cases.filter(function(c){return c.transport_provider_id===pr.id && Number(c.transport_total_amount||0)>0});
      const allCases=[];
      mainCases.forEach(function(c){allCases.push({case:c,role:'main'})});
      transportCases.forEach(function(c){allCases.push({case:c,role:'transport'})});

      const clientMap=new Map();
      allCases.forEach(function(x){
        const c=x.case;
        const key=String(c.client_phone||c.client_name||c.id).toLowerCase();
        if(!clientMap.has(key)) clientMap.set(key,{name:c.client_name||'عميل',phone:c.client_phone||'',cases:[]});
        clientMap.get(key).cases.push(x);
      });

      let sales=0,pawTotal=0,ours=0,theirs=0,attention=0,complete=0;
      const serviceCounts={};
      allCases.forEach(function(x){
        const c=x.case;
        if(x.role==='main'){
          sales+=Number(c.total_amount||0);
          pawTotal+=Number(c.pawapp_amount||0);
          ours+=v2CollectFromProvider(c);
          theirs+=v2PayProvider(c);
          const s=c.service||c.requested_service||'غير محدد';
          serviceCounts[s]=(serviceCounts[s]||0)+1;
        }else{
          sales+=Number(c.transport_total_amount||0);
          pawTotal+=Number(c.transport_pawapp_amount||0);
          const s='Pickup / Drop-off';
          serviceCounts[s]=(serviceCounts[s]||0)+1;
        }
        const needs=!v2ClientPaid(c) || (v2ClientPaid(c)&&!c.client_paid_to) ||
          (x.role==='main' && (v2CollectFromProvider(c)>0.0001 || v2PayProvider(c)>0.0001));
        if(needs) attention++; else complete++;
      });

      return {
        mainCases:mainCases,transportCases:transportCases,allCases:allCases,
        clients:[...clientMap.values()],operations:allCases.length,
        sales:sales,pawTotal:pawTotal,ours:ours,theirs:theirs,
        attention:attention,complete:complete,serviceCounts:serviceCounts
      };
    }

    function financialDashboardTotals(){
      let clientPaidTotal=0,clientUnpaidTotal=0,ours=0,theirs=0,pawTotal=0;
      db.cases.forEach(function(c){
        clientPaidTotal+=clientPaidAmt(c);
        clientUnpaidTotal+=clientRem(c);
        pawTotal+=Number(c.pawapp_amount||0)+Number(c.transport_pawapp_amount||0);
        // Same source of truth used by Follow-up:
        // client paid provider -> PawApp share still collectible from provider.
        // client paid PawApp -> provider share still payable by PawApp.
        ours+=v2CollectFromProvider(c);
        theirs+=v2PayProvider(c);
      });
      return {clientPaidTotal:clientPaidTotal,clientUnpaidTotal:clientUnpaidTotal,ours:ours,theirs:theirs,pawTotal:pawTotal};
    }

    window.renderDashboard=function(){
      const customerKeys=new Set();
      const ft=financialDashboardTotals();
      let clientPaidTotal=ft.clientPaidTotal,clientUnpaidTotal=ft.clientUnpaidTotal,ours=ft.ours,theirs=ft.theirs,pawTotal=ft.pawTotal,needs=0;
      db.cases.forEach(function(c){
        customerKeys.add(String(c.client_phone||c.client_name||c.id).toLowerCase());
        if(financialFollowupItems(c).length || missingFollowupItems(c).length || appointmentFollowupItems(c).length) needs++;
      });

      const set=function(id,val){const e=document.getElementById(id);if(e)e.textContent=val};
      set('kOps',String(db.cases.length));
      set('kCustomers',String(customerKeys.size));
      set('kProviders',String(db.providers.length));
      set('kNeedsFollowup',String(needs));
      set('kClientPaidTotal',money(clientPaidTotal));
      set('kClientUnpaidTotal',money(clientUnpaidTotal));
      set('kOursFromProviders',money(ours));
      set('kOweProviders',money(theirs));

      let recent='';
      db.cases.slice().reverse().slice(0,3).forEach(function(c){
        const pr=byProvider(c.providerId);
        const tp=c.transport_provider_id?byProvider(c.transport_provider_id):null;
        const needsAttention=!v2ClientPaid(c) || !c.client_paid_to || v2CollectFromProvider(c)>0.0001 || v2PayProvider(c)>0.0001;
        let transport='';
        if(tp&&Number(c.transport_total_amount||0)>0){
          const tdir=c.transport_direction==='pickup'?'Pickup':c.transport_direction==='dropoff'?'Drop-off':c.transport_direction==='both'?'Pickup + Drop-off':'Pickup / Drop-off';
          transport='<div class="hint" style="margin-top:5px">+ '+esc(tdir)+' • '+esc(tp.name)+' • '+money(c.transport_total_amount)+'</div>';
        }
        recent+='<div class="card provider">'+
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3 style="margin:0">'+esc(c.client_name)+'</h3>'+(needsAttention?'<span class="status unpaid">● تحتاج متابعة</span>':'<span class="status paid">مكتملة</span>')+'</div>'+
          '<p>PAW-'+String(c.id).padStart(4,'0')+'</p>'+
          '<div><b>'+esc(c.service||c.requested_service||'—')+'</b><div class="hint">'+esc(pr.name)+'</div>'+transport+'</div>'+
          '<div class="actions"><button class="btn soft" onclick="openCaseWorkflow(\''+c.id+'\',\'missing\')">فتح المطلوب فقط</button></div></div>';
      });
      const box=document.getElementById('dashboardRecentCards');
      if(box)box.innerHTML=recent||'<div class="card">لا توجد عمليات.</div>';
    };

    window.renderProviders=function(){
      const q=(document.getElementById('providerSearch')?.value||'').toLowerCase();
      let h='';
      db.providers.filter(function(p){return !q||p.name.toLowerCase().includes(q)}).forEach(function(p){
        const a=providerActivity(p);
        const typ=p.type==='freelancer'?'فريلانسر':(p.category==='veterinary'?'عيادة / شركة بيطرية':'شركة خدمات');
        const names=a.clients.slice(0,5).map(function(x){return esc(x.name)}).join(' • ');
        h+='<div class="card provider">'+
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3 style="margin:0">'+esc(p.name)+'</h3>'+(a.attention?'<span class="status unpaid">● '+a.attention+' تحتاج متابعة</span>':'<span class="status paid">مستقرة</span>')+'</div>'+
          '<p>'+typ+'</p>'+
          '<div class="miniGrid"><div class="mini"><span>العملاء</span><b>'+a.clients.length+'</b></div><div class="mini"><span>العمليات</span><b>'+a.operations+'</b></div><div class="mini"><span>الخدمات</span><b>'+Object.keys(a.serviceCounts).length+'</b></div></div>'+
          '<div class="miniGrid"><div class="mini"><span>لنا عندهم</span><b>'+money(a.ours)+'</b></div><div class="mini"><span>لهم عندنا</span><b>'+money(a.theirs)+'</b></div><div class="mini"><span>الصافي</span><b>'+money(Math.abs(a.ours-a.theirs))+'</b></div></div>'+
          (a.clients.length?'<div class="hint" style="margin-top:9px"><b>العملاء:</b> '+names+(a.clients.length>5?' +'+(a.clients.length-5):'')+'</div>':'')+
          '<div class="actions"><button class="btn primary" onclick="openProviderCRM(\''+p.id+'\')">التفاصيل والتحليل</button><button class="btn soft" onclick="openServiceManager(\''+p.id+'\')">الخدمات</button></div>'+
          '</div>';
      });
      const list=document.getElementById('providerList');
      if(list)list.innerHTML=h||'<div class="card">لا توجد نتائج</div>';
    };

    window.openProviderCRM=function(id){
      const p=db.providers.find(function(x){return x.id===id});if(!p)return;
      const a=providerActivity(p);
      showPage('providerdetail');
      const set=function(id,val){const e=document.getElementById(id);if(e)e.textContent=val};
      set('providerDetailName',p.name);
      set('providerDetailType',p.type==='freelancer'?'فريلانسر':'شركة / عيادة');
      set('pdClients',String(a.clients.length));
      set('pdOps',String(a.operations));
      set('pdComplete',String(a.complete));
      set('pdPending',String(a.attention));
      set('pdSales',money(a.sales));
      set('pdPaw',money(a.pawTotal));
      set('pdOurs',money(a.ours));
      set('pdTheirs',money(a.theirs));

      const services=Object.entries(a.serviceCounts).sort(function(x,y){return y[1]-x[1]});
      const sb=document.getElementById('pdServices');
      if(sb)sb.innerHTML=services.length?services.map(function(x){
        return '<div class="kpi-line"><span>'+esc(x[0])+'</span><b>'+x[1]+' عملية</b></div>';
      }).join(''):'ما في خدمات مسجلة.';

      let clientsHtml='';
      a.clients.forEach(function(cl){
        const pending=cl.cases.filter(function(x){
          const c=x.case;
          return !v2ClientPaid(c) || !c.client_paid_to || (x.role==='main'&&(v2CollectFromProvider(c)>0.0001||v2PayProvider(c)>0.0001));
        }).length;
        clientsHtml+='<div class="card provider">'+
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3 style="margin:0">'+esc(cl.name)+'</h3>'+(pending?'<span class="status unpaid">● '+pending+' غير مكتملة</span>':'<span class="status paid">مكتملة</span>')+'</div>'+
          '<p>'+esc(cl.phone||'بدون رقم')+' • '+cl.cases.length+' عملية</p>'+
          cl.cases.map(function(x){
            const c=x.case;
            const label=x.role==='transport'?'Pickup / Drop-off':(c.service||c.requested_service||'خدمة');
            const amount=x.role==='transport'?Number(c.transport_total_amount||0):Number(c.total_amount||0);
            return '<div class="kpi-line"><span>'+esc(label)+' • PAW-'+String(c.id).padStart(4,'0')+'</span><b>'+money(amount)+'</b></div>';
          }).join('')+
          '</div>';
      });
      const cb=document.getElementById('pdClientList');
      if(cb)cb.innerHTML=clientsHtml||'<div class="card">ما في عملاء مسجلين.</div>';

      const btn=document.getElementById('pdExportBtn');
      if(btn)btn.onclick=function(){exportProviderFullReport(id)};
    };

    window.providerCases=function(id){openProviderCRM(id)};

    window.exportProviderFullReport=function(id){
      const p=db.providers.find(function(x){return x.id===id});if(!p)return;
      const a=providerActivity(p);
      if(!a.operations){alert('ما في عمليات لهذه الجهة');return}
      let csv='Case ID,Date,Client,Phone,Role,Service,Amount KD,PawApp KD,Payment Status,Needs Followup\n';
      a.allCases.forEach(function(x){
        const c=x.case;
        const role=x.role==='transport'?'Transport':'Main';
        const service=x.role==='transport'?'Pickup / Drop-off':(c.service||c.requested_service||'');
        const amount=x.role==='transport'?Number(c.transport_total_amount||0):Number(c.total_amount||0);
        const pawAmt=x.role==='transport'?Number(c.transport_pawapp_amount||0):Number(c.pawapp_amount||0);
        const needs=!v2ClientPaid(c)||!c.client_paid_to||(x.role==='main'&&(v2CollectFromProvider(c)>0.0001||v2PayProvider(c)>0.0001));
        const vals=[c.id,c.service_date||'',c.client_name||'',c.client_phone||'',role,service,amount.toFixed(3),pawAmt.toFixed(3),v2Route(c),needs?'Yes':'No'];
        csv+=vals.map(function(v){return '"'+String(v).replace(/"/g,'""')+'"'}).join(',')+'\n';
      });
      const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
      const url=URL.createObjectURL(blob),aEl=document.createElement('a');
      aEl.href=url;aEl.download=('PawApp-'+p.name+'-full-report.csv').replace(/\s+/g,'-');
      document.body.appendChild(aEl);aEl.click();document.body.removeChild(aEl);setTimeout(function(){URL.revokeObjectURL(url)},1000);
    };


    window.toggleTransportAddon=function(){
      const yes=document.getElementById('cTransportNeeded')&&document.getElementById('cTransportNeeded').value==='yes';
      const box=document.getElementById('cTransportAddon');
      if(box) box.style.display=yes?'block':'none';
      const sel=document.getElementById('cTransportProvider');
      if(sel){
        const keep=sel.value;
        sel.innerHTML='<option value="">اختاري شركة التوصيل / الفريلانسر</option>';
        db.providers.forEach(function(p){sel.innerHTML+='<option value="'+p.id+'">'+esc(p.name)+'</option>'});
        if([...sel.options].some(function(o){return o.value===keep})) sel.value=keep;
      }
      if(!yes){
        ['cTransportDirection','cTransportProvider','cTransportTotal','cTransportPaw','cTransportAt','cPickupLocation','cDropoffLocation'].forEach(function(id){const e=document.getElementById(id);if(e)e.value=''});
        if(document.getElementById('cTransportProviderAmount'))document.getElementById('cTransportProviderAmount').value='';
        ['calcTransportTotal','calcTransportPaw','calcTransportProvider'].forEach(function(id){const e=document.getElementById(id);if(e)e.textContent=money(0)});
      }
    };

    window.calcTransportAddon=function(){
      const total=Number(document.getElementById('cTransportTotal')?.value||0);
      const pawShare=Number(document.getElementById('cTransportPaw')?.value||0);
      const providerShare=Math.max(0,total-pawShare);
      if(document.getElementById('cTransportProviderAmount'))document.getElementById('cTransportProviderAmount').value=providerShare.toFixed(3);
      if(document.getElementById('calcTransportTotal'))document.getElementById('calcTransportTotal').textContent=money(total);
      if(document.getElementById('calcTransportPaw'))document.getElementById('calcTransportPaw').textContent=money(pawShare);
      if(document.getElementById('calcTransportProvider'))document.getElementById('calcTransportProvider').textContent=money(providerShare);
    };

    const transportOpenNew=window.openNewCase;
    window.openNewCase=function(){
      transportOpenNew();
      if(document.getElementById('cTransportNeeded'))document.getElementById('cTransportNeeded').value='no';
      window.toggleTransportAddon();
    };

    const saveCaseBeforeTransport=window.saveCase;
    window.saveCase=async function(){
      const transportNeeded=document.getElementById('cTransportNeeded')?.value==='yes';
      if(transportNeeded){
        const tp=document.getElementById('cTransportProvider')?.value||'';
        const dir=document.getElementById('cTransportDirection')?.value||'';
        const total=Number(document.getElementById('cTransportTotal')?.value||0);
        const pawShare=Number(document.getElementById('cTransportPaw')?.value||0);
        const miss=[];
        if(!dir)miss.push('نوع Pickup / Drop-off');
        if(!tp)miss.push('شركة التوصيل');
        if(total<=0)miss.push('سعر النقل');
        if(pawShare<0||pawShare>total)miss.push('حصة PawApp من النقل');
        if(miss.length){alert('باقي تكملين بالنقل: '+miss.join('، '));return}
      }
      const beforeRows=db.cases.length;
      await saveCaseBeforeTransport();
      if(!transportNeeded) return;
      await loadData();
      const newest=db.cases.slice().sort(function(a,b){return Number(b.id)-Number(a.id)})[0];
      if(!newest || db.cases.length<=beforeRows) return;
      const total=Number(document.getElementById('cTransportTotal')?.value||0);
      const pawShare=Number(document.getElementById('cTransportPaw')?.value||0);
      const at=document.getElementById('cTransportAt')?.value||'';
      try{
        await api('cases?id=eq.'+encodeURIComponent(newest.id),{
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify({
            transport_direction:document.getElementById('cTransportDirection')?.value||null,
            transport_provider_id:document.getElementById('cTransportProvider')?.value||null,
            transport_total_amount:total,
            transport_pawapp_amount:pawShare,
            transport_provider_amount:Math.max(0,total-pawShare),
            transport_at:at?new Date(at).toISOString():null,
            pickup_location:document.getElementById('cPickupLocation')?.value.trim()||null,
            dropoff_location:document.getElementById('cDropoffLocation')?.value.trim()||null
          })
        });
        await loadData();
      }catch(e){console.error(e);alert('تم حفظ العملية لكن تعذر حفظ بيانات Pickup / Drop-off')}
    };

    
    const WORKFLOW_META={
      new_request:{label:'New — جديد',next:'التواصل مع العميل'},
      client_contacted:{label:'Client Contacted — تم التواصل مع العميل',next:'تأكيد الطبيب / مقدم الخدمة'},
      provider_confirmed:{label:'Doctor / Provider Confirmed — تم تأكيد الطبيب / مقدم الخدمة',next:'متابعة الموعد وإتمام الخدمة'},
      appointment_completed:{label:'Appointment Completed — تم الموعد / الخدمة',next:'إكمال الدفع والتسويات'},
      payment_completed:{label:'Payment Completed — اكتمل الدفع والتسويات',next:'مراجعة الحالة ثم إغلاقها'},
      closed:{label:'Closed — مغلقة',next:'لا يوجد إجراء مطلوب'},
      cancelled:{label:'Cancelled — ملغاة',next:'لا يوجد إجراء مطلوب'}
    };

    function workflowLabel(status){
      return (WORKFLOW_META[status]||WORKFLOW_META.new_request).label;
    }

    function workflowState(c){
      const status=c.workflow_status||'new_request';
      if(status==='cancelled') return {stage:workflowLabel(status),task:'الحالة ملغاة',focus:'complete'};
      if(status==='closed') return {stage:workflowLabel(status),task:'لا يوجد إجراء مطلوب',focus:'complete'};

      const missing=missingFollowupItems(c);
      if(missing.length){
        return {stage:workflowLabel(status),task:'استكمال: '+missing[0],focus:'missing'};
      }

      if(status==='new_request'){
        return {stage:workflowLabel(status),task:'التواصل مع العميل ثم تغيير المرحلة إلى Client Contacted',focus:'all'};
      }
      if(status==='client_contacted'){
        return {stage:workflowLabel(status),task:'تأكيد الطبيب / مقدم الخدمة ثم تغيير المرحلة إلى Provider Confirmed',focus:'all'};
      }

      const appointments=appointmentFollowupItems(c);
      if(status==='provider_confirmed' && appointments.length){
        return {stage:workflowLabel(status),task:appointments[0].label+' • '+formatFollowupDate(appointments[0].at),focus:'appointment'};
      }
      if(status==='provider_confirmed'){
        return {stage:workflowLabel(status),task:'بعد تنفيذ الموعد / الخدمة غيّري المرحلة إلى Appointment Completed',focus:'appointment'};
      }

      const financial=financialFollowupItems(c);
      if(status==='appointment_completed' && financial.length){
        return {stage:workflowLabel(status),task:financial[0].label+' — '+financial[0].detail,focus:'finance'};
      }
      if(status==='appointment_completed'){
        return {stage:workflowLabel(status),task:'الدفع والتسويات مكتملة — لا توجد معلومات مالية ناقصة',focus:'finance'};
      }
      if(status==='payment_completed'){
        return {stage:workflowLabel(status),task:'راجعي الحالة ثم غيّري المرحلة إلى Closed',focus:'all'};
      }

      return {stage:workflowLabel(status),task:(WORKFLOW_META[status]||WORKFLOW_META.new_request).next,focus:'all'};
    }

    window.saveWorkflowStatus=async function(){
      const caseId=document.getElementById('editCaseId')?.value||'';
      const select=document.getElementById('eWorkflowStatus');
      const status=select?.value||'new_request';
      const row=db.cases.find(function(x){return String(x.id)===String(caseId)});
      if(!caseId||!row) return;
      if(row.workflow_status===status){
        focusCaseEditor(row,'all');
        return;
      }
      try{
        await api('cases?id=eq.'+encodeURIComponent(caseId),{
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify({workflow_status:status})
        });
        row.workflow_status=status;
        focusCaseEditor(row,'all');
        if(window.renderAutomaticFollowups) window.renderAutomaticFollowups();
        if(window.renderCases) window.renderCases();
        toast('تم تحديث مرحلة الحالة');
      }catch(e){
        console.error(e);
        alert('تعذر تحديث مرحلة الحالة');
        select.value=row.workflow_status||'new_request';
      }
    };

    function populateEditEmployees(selectedId){
      const sel=document.getElementById('eEmployee');
      if(!sel) return;
      sel.innerHTML='<option value="">اختاري الموظف المسؤول</option>';
      (db.staff||[]).forEach(function(emp){
        sel.innerHTML+='<option value="'+emp.id+'">'+esc(emp.name)+'</option>';
      });
      sel.value=selectedId||'';
    }

    function setEditSectionVisible(id,show){
      const el=document.getElementById(id);
      if(el) el.style.display=show?'':'none';
    }

    window.showAllCaseEditSections=function(){
      ['editClientSectionTitle','editClientSection','editServiceSectionTitle','editServiceSection','editPaymentSectionTitle','editPaymentSection','caseAttachmentsBox','caseFollowupBox'].forEach(function(id){
        setEditSectionVisible(id,true);
      });
      const btn=document.getElementById('workflowShowAllBtn');
      if(btn) btn.style.display='none';
    };

    function focusCaseEditor(c,mode){
      const state=workflowState(c);
      const stage=document.getElementById('workflowStageLabel');
      const task=document.getElementById('workflowTaskLabel');
      const workflowSelect=document.getElementById('eWorkflowStatus');
      if(stage) stage.textContent=state.stage;
      if(task) task.textContent=state.task;
      if(workflowSelect) workflowSelect.value=c.workflow_status||'new_request';

      window.showAllCaseEditSections();
      if(!mode || mode==='all' || state.focus==='complete') return;

      const ids=['editClientSectionTitle','editClientSection','editServiceSectionTitle','editServiceSection','editPaymentSectionTitle','editPaymentSection','caseAttachmentsBox','caseFollowupBox'];
      ids.forEach(function(id){setEditSectionVisible(id,false)});
      const showAll=document.getElementById('workflowShowAllBtn');
      if(showAll) showAll.style.display='block';

      if(mode==='missing'){
        const first=missingFollowupItems(c)[0]||'';
        if(first.includes('الموظف')||first.includes('نوع الحيوان')||first.includes('الموقع')){
          setEditSectionVisible('editClientSectionTitle',true);
          setEditSectionVisible('editClientSection',true);
        }else{
          setEditSectionVisible('editServiceSectionTitle',true);
          setEditSectionVisible('editServiceSection',true);
        }
      }else if(mode==='finance'){
        setEditSectionVisible('editPaymentSectionTitle',true);
        setEditSectionVisible('editPaymentSection',true);
        setEditSectionVisible('caseAttachmentsBox',true);
      }else if(mode==='appointment'){
        setEditSectionVisible('editPaymentSectionTitle',true);
        setEditSectionVisible('editPaymentSection',true);
        setEditSectionVisible('caseFollowupBox',true);
      }
    }

    window.openCaseWorkflow=function(id,mode){
      window.openCaseDetails(id);
      const row=db.cases.find(function(x){return String(x.id)===String(id)});
      if(row) focusCaseEditor(row,mode||workflowState(row).focus);
    };

function financialFollowupItems(c){
      const items=[];
      const paid=v2ClientPaid(c);
      if(!paid && clientRem(c)>0.0001){
        items.push({kind:'client',label:'تحصيل من العميل',detail:'متبقي على العميل '+money(clientRem(c)),action:'edit'});
      }else if(paid && !c.client_paid_to){
        items.push({kind:'route',label:'تحديد جهة الدفع',detail:'العميل دفع، حددي دفع لـ PawApp أو للشركة',action:'edit'});
      }else if(c.client_paid_to==='pawapp' && v2PayProvider(c)>0.0001){
        items.push({kind:'provider_due',label:'دفع مستحق الشركة',detail:'للشركة عندنا '+money(v2PayProvider(c)),action:'settle'});
      }else if(c.client_paid_to==='provider' && v2CollectFromProvider(c)>0.0001){
        items.push({kind:'paw_due',label:'تحصيل حصة PawApp',detail:'لنا عند الشركة '+money(v2CollectFromProvider(c)),action:'edit'});
      }
      return items;
    }

    function missingFollowupItems(c){
      const items=[];
      if(!c.providerId) items.push('اختيار الشركة / الفريلانسر');
      if(!(c.service||c.requested_service)) items.push('اختيار الخدمة');
      if(Number(c.total_amount||0)<=0) items.push('إدخال السعر');
      if(!c.employee_id && !c.staff) items.push('تحديد الموظف المسؤول');
      if(!c.pet_type) items.push('نوع الحيوان');
      if(!c.location) items.push('الموقع / المنطقة');
      if(c.transport_provider_id && Number(c.transport_total_amount||0)>0){
        if(!c.pickup_location) items.push('موقع الاستلام Pickup');
        if(!c.dropoff_location) items.push('موقع التوصيل Drop-off');
      }
      return items;
    }

    function appointmentFollowupItems(c){
      const status=c.workflow_status||'new_request';
      // Once the service/appointment is completed, the appointment reminder is finished
      // and must disappear from Follow-up. Financial items continue separately.
      if(status==='appointment_completed'||status==='payment_completed'||status==='closed'||status==='cancelled'){
        return [];
      }
      const out=[];
      const completedAt=c.appointment_followed_up_at?new Date(c.appointment_followed_up_at):null;
      const reminderAt=c.appointment_reminder_at?new Date(c.appointment_reminder_at):null;

      if(reminderAt && Number.isFinite(reminderAt.getTime()) && (!completedAt || reminderAt>completedAt)){
        out.push({at:reminderAt,type:'snoozed',label:'تذكير مؤجل'});
      }else if(!completedAt){
        if(c.appointment_at){
          const d=new Date(c.appointment_at);
          if(Number.isFinite(d.getTime()) && d.getTime()>=Date.now()-24*60*60*1000){
            out.push({at:d,type:'appointment',label:'موعد العميل'});
          }
        }else if(c.source==='booking_form_test' && c.preferred_date){
          const d=new Date(String(c.preferred_date)+'T12:00:00');
          if(Number.isFinite(d.getTime()) && d.getTime()>=Date.now()-24*60*60*1000){
            out.push({at:d,type:'preferred',label:'موعد مفضل من النموذج'});
          }
        }
      }

      (db.followups||[]).filter(function(f){
        return String(f.case_id)===String(c.id) && !(f.status==='done'||f.status==='cancelled');
      }).forEach(function(f){
        const d=new Date(f.followup_at);
        if(Number.isFinite(d.getTime())) out.push({at:d,type:'manual',label:f.reason||'متابعة'});
      });
      return out.sort(function(a,b){return a.at-b.at});
    }

    function formatFollowupDate(d){
      try{
        return d.toLocaleString('ar-KW',{dateStyle:'medium',timeStyle:'short'});
      }catch(e){return String(d)}
    }

    function followupCaseHeader(c,badge){
      const pr=byProvider(c.providerId);
      return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'+
        '<div><h3 style="margin:0">'+esc(c.client_name||'عميل')+'</h3>'+
        '<div class="hint">PAW-'+String(c.id).padStart(4,'0')+' • '+esc(pr.name)+'</div></div>'+
        badge+'</div>';
    }


    function missingTaskKey(label){
      if(label==='اختيار الشركة / الفريلانسر') return 'provider';
      if(label==='اختيار الخدمة') return 'service';
      if(label==='إدخال السعر') return 'price';
      if(label==='تحديد الموظف المسؤول') return 'employee';
      if(label==='نوع الحيوان') return 'pet_type';
      if(label==='الموقع / المنطقة') return 'location';
      if(label==='موقع الاستلام Pickup') return 'pickup_location';
      if(label==='موقع التوصيل Drop-off') return 'dropoff_location';
      return '';
    }

    window.openMissingTask=function(caseId){
      const row=db.cases.find(function(x){return String(x.id)===String(caseId)});
      if(!row) return;

      const label=missingFollowupItems(row)[0]||'';
      const key=missingTaskKey(label);
      if(!key){
        window.openCaseWorkflow(caseId,'missing');
        return;
      }

      const idEl=document.getElementById('missingTaskCaseId');
      const keyEl=document.getElementById('missingTaskKey');
      const labelEl=document.getElementById('missingTaskLabel');
      const field=document.getElementById('missingTaskField');
      if(idEl) idEl.value=caseId;
      if(keyEl) keyEl.value=key;
      if(labelEl) labelEl.textContent=label;
      if(!field) return;

      let html='';
      if(key==='provider'){
        html='<div class="field"><label>الشركة / الفريلانسر</label><select id="missingTaskValue"><option value="">اختاري</option>'+
          db.providers.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join('')+
          '</select></div>';
      }else if(key==='service'){
        const pr=byProvider(row.providerId);
        html='<div class="field"><label>الخدمة</label><select id="missingTaskValue"><option value="">اختاري</option>'+
          (pr.services||[]).map(function(s){return '<option value="'+esc(s)+'">'+esc(s)+'</option>'}).join('')+
          '</select></div>';
      }else if(key==='price'){
        html='<div class="field"><label>إجمالي ما يدفعه العميل (د.ك)</label><input id="missingTaskValue" type="number" min="0" step="0.001" inputmode="decimal"></div>';
      }else if(key==='employee'){
        html='<div class="field"><label>الموظف المسؤول</label><select id="missingTaskValue"><option value="">اختاري</option>'+
          (db.staff||[]).map(function(e){return '<option value="'+e.id+'">'+esc(e.name)+'</option>'}).join('')+
          '</select></div>';
      }else if(key==='pet_type'){
        html='<div class="field"><label>نوع الحيوان</label><select id="missingTaskValue"><option value="">اختاري</option><option>كلب</option><option>قط</option><option>طائر</option><option>أرنب</option><option>أخرى</option></select></div>';
      }else{
        const title=key==='location'?'المنطقة / الموقع':key==='pickup_location'?'مكان الاستلام':'مكان التوصيل';
        html='<div class="field"><label>'+title+'</label><input id="missingTaskValue"></div>';
      }

      field.innerHTML=html;
      const modal=document.getElementById('missingTaskModal');
      if(modal) modal.classList.add('show');
    };

    window.saveMissingTask=async function(){
      const caseId=document.getElementById('missingTaskCaseId')?.value||'';
      const key=document.getElementById('missingTaskKey')?.value||'';
      const valueEl=document.getElementById('missingTaskValue');
      const raw=valueEl?String(valueEl.value||'').trim():'';
      const row=db.cases.find(function(x){return String(x.id)===String(caseId)});
      if(!caseId||!key||!row) return;
      if(!raw || (key==='price' && Number(raw)<=0)){
        alert('كمّلي المعلومة المطلوبة أول');
        return;
      }

      const patch={};
      if(key==='provider') patch.provider_id=raw;
      else if(key==='service') { patch.service_name=raw; patch.requested_service=row.requested_service||raw; }
      else if(key==='employee') patch.employee_id=raw;
      else if(key==='pet_type') patch.pet_type=raw;
      else if(key==='location') patch.location=raw;
      else if(key==='pickup_location') patch.pickup_location=raw;
      else if(key==='dropoff_location') patch.dropoff_location=raw;
      else if(key==='price'){
        const total=Number(raw);
        const feeType=row.fee_type||'percent';
        const feeValue=Number(row.fee_value||0);
        const pawAmount=feeType==='fixed'?feeValue:total*feeValue/100;
        patch.total_amount=total;
        patch.pawapp_amount=pawAmount;
        patch.provider_amount=Math.max(0,total-pawAmount);
      }

      try{
        await api('cases?id=eq.'+encodeURIComponent(caseId),{
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify(patch)
        });
        closeModal('missingTaskModal');
        await loadData();
        if(window.renderAutomaticFollowups) window.renderAutomaticFollowups();

        const fresh=db.cases.find(function(x){return String(x.id)===String(caseId)});
        const next=fresh?missingFollowupItems(fresh):[];
        if(next.length){
          toast('تم الحفظ • باقي '+next[0]);
          setTimeout(function(){window.openMissingTask(caseId)},150);
        }else{
          toast('تم استكمال البيانات الأساسية ✓');
        }
      }catch(e){
        console.error(e);
        alert('تعذر حفظ المعلومة');
      }
    };

    window.renderAutomaticFollowups=function(){
      const financeBox=document.getElementById('followupFinanceList');
      const appointmentBox=document.getElementById('followupAppointmentList');
      const missingBox=document.getElementById('followupMissingList');
      if(!financeBox||!appointmentBox||!missingBox) return;

      const financeRows=[],appointmentRows=[],missingRows=[];
      db.cases.slice().reverse().forEach(function(c){
        const financial=financialFollowupItems(c);
        if(financial.length) financeRows.push({c:c,items:financial});
        const appointments=appointmentFollowupItems(c);
        if(appointments.length) appointmentRows.push({c:c,items:appointments});
        const missing=missingFollowupItems(c);
        if(missing.length) missingRows.push({c:c,items:missing});
      });

      appointmentRows.sort(function(a,b){
        return a.items[0].at-b.items[0].at;
      });

      const set=function(id,v){const e=document.getElementById(id);if(e)e.textContent=String(v)};
      set('fuFinance',financeRows.length);
      set('fuAppointments',appointmentRows.length);
      set('fuMissing',missingRows.length);
      const navIds=new Set();
      financeRows.concat(appointmentRows,missingRows).forEach(function(x){navIds.add(String(x.c.id))});
      const navBadge=document.getElementById('followupNavBadge');
      if(navBadge){
        navBadge.textContent=String(navIds.size);
        navBadge.style.display=navIds.size?'inline-block':'none';
      }

      financeBox.innerHTML=financeRows.length?financeRows.map(function(x){
        const c=x.c,item=x.items[0];
        let action='';
        if(item.action==='settle'){
          action='<button class="btn primary" onclick="openSettlement(\''+c.id+'\')">تسجيل دفع للشركة</button>'+
                 '<button class="btn soft" onclick="openCaseWorkflow(\''+c.id+'\',\'finance\')">فتح المطلوب فقط</button>';
        }else{
          action='<button class="btn primary" onclick="openCaseWorkflow(\''+c.id+'\',\'finance\')">'+esc(item.label)+'</button>';
        }
        return '<div class="card provider">'+followupCaseHeader(c,'<span class="status unpaid">أولوية مالية</span>')+
          '<div style="margin-top:10px"><b>'+esc(item.label)+'</b><div class="hint">'+esc(item.detail)+'</div></div>'+
          '<div class="actions">'+action+'</div></div>';
      }).join(''):'<div class="card"><b class="green">تمام ✓</b><div class="hint">ما في مستحقات تحتاج إجراء حاليًا.</div></div>';

      appointmentBox.innerHTML=appointmentRows.length?appointmentRows.map(function(x){
        const c=x.c,item=x.items[0],now=Date.now();
        const overdue=item.at.getTime()<now;
        const soon=item.at.getTime()<=now+24*60*60*1000;
        const badge=overdue?'<span class="status unpaid">متأخر</span>':soon?'<span class="status partial">خلال 24 ساعة</span>':'<span class="status paid">قادم</span>';
        return '<div class="card provider">'+followupCaseHeader(c,badge)+
          '<div style="margin-top:10px"><b>'+esc(item.label)+'</b><div class="hint">'+esc(formatFollowupDate(item.at))+'</div></div>'+
          '<div class="actions">'+
            '<button class="btn primary" onclick="completeAppointmentFollowup(\''+c.id+'\')">✓ تمت الخدمة / الموعد</button>'+
            '<button class="btn soft" onclick="openAppointmentReminder(\''+c.id+'\')">تأجيل التذكير</button>'+
            '<button class="btn soft" onclick="openCaseDetails(\''+c.id+'\')">فتح العملية</button>'+
          '</div></div>';
      }).join(''):'<div class="card"><div class="hint">ما في مواعيد أو ريميندر قادمة.</div></div>';

      missingBox.innerHTML=missingRows.length?missingRows.map(function(x){
        const c=x.c;
        return '<div class="card provider">'+followupCaseHeader(c,'<span class="status partial">بيانات ناقصة</span>')+
          '<div style="margin-top:10px">'+x.items.map(function(r){return '<div class="kpi-line"><span>'+esc(r)+'</span></div>'}).join('')+'</div>'+
          '<div class="actions"><button class="btn primary" onclick="openMissingTask(\''+c.id+'\')">استكمال المطلوب</button><button class="btn soft" onclick="openCaseDetails(\''+c.id+'\')">فتح العملية</button></div></div>';
      }).join(''):'<div class="card"><b class="green">تمام ✓</b><div class="hint">ما في بيانات أساسية ناقصة.</div></div>';
    };


    window.completeAppointmentFollowup=async function(caseId){
      const row=db.cases.find(function(x){return String(x.id)===String(caseId)});
      if(!row) return;
      const appointmentAt=row.appointment_at?new Date(row.appointment_at):null;
      const appointmentFinished=appointmentAt && Number.isFinite(appointmentAt.getTime()) && appointmentAt.getTime()<=Date.now();
      const patch={
        appointment_followed_up_at:new Date().toISOString(),
        appointment_reminder_at:null
      };

      // زر "تمت متابعة الموعد" يعني أن الموعد/الخدمة تمت فعلياً.
      // لذلك ننقل الحالة مباشرة إلى Appointment Completed مهما كانت المرحلة القديمة،
      // لأن بعض الحالات القديمة ما زالت محفوظة كـ New رغم وجود موعد منتهي.
      patch.workflow_status='appointment_completed';

      try{
        await api('cases?id=eq.'+encodeURIComponent(caseId),{
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify(patch)
        });
        row.appointment_followed_up_at=patch.appointment_followed_up_at;
        row.appointment_reminder_at=null;
        if(patch.workflow_status) row.workflow_status=patch.workflow_status;
        await loadData();
        window.renderAutomaticFollowups();
        if(window.renderCases) window.renderCases();
        toast('تمت الخدمة / الموعد وانتقلت الحالة تلقائيًا');
      }catch(e){
        console.error(e);
        alert('تعذر تحديث متابعة الموعد');
      }
    };

    window.openAppointmentReminder=function(caseId){
      const id=document.getElementById('appointmentReminderCaseId');
      const at=document.getElementById('appointmentReminderAt');
      if(id) id.value=caseId;
      if(at){
        const d=new Date(Date.now()+24*60*60*1000);
        const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
        at.value=local;
      }
      const modal=document.getElementById('appointmentReminderModal');
      if(modal) modal.classList.add('show');
    };

    window.saveAppointmentReminder=async function(){
      const caseId=document.getElementById('appointmentReminderCaseId')?.value;
      const raw=document.getElementById('appointmentReminderAt')?.value;
      if(!caseId||!raw){alert('اختاري تاريخ ووقت التذكير');return}
      try{
        await api('cases?id=eq.'+encodeURIComponent(caseId),{
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify({
            appointment_reminder_at:new Date(raw).toISOString(),
            appointment_followed_up_at:null
          })
        });
        closeModal('appointmentReminderModal');
        await loadData();
        window.renderAutomaticFollowups();
        toast('تم تأجيل التذكير');
      }catch(e){
        console.error(e);
        alert('تعذر حفظ التذكير');
      }
    };

    const openCaseBeforeAppointment=window.openCaseDetails;
    window.openCaseDetails=function(id){
      openCaseBeforeAppointment(id);
      const row=db.cases.find(function(x){return String(x.id)===String(id)});
      const el=document.getElementById('eAppointmentAt');
      if(el&&row){
        el.value=row.appointment_at?new Date(row.appointment_at).toISOString().slice(0,16):'';
      }
      if(row){
        populateEditEmployees(row.employee_id||row.employeeId||'');
        focusCaseEditor(row,'all');
      }
    };

    const newCaseBeforeAppointment=window.openNewCase;
    window.openNewCase=function(){
      newCaseBeforeAppointment();
      const el=document.getElementById('cAppointmentAt');
      if(el)el.value='';
    };

    const showPageBeforeAutoFollowup=window.showPage;
    window.showPage=async function(id){
      await showPageBeforeAutoFollowup(id);
      if(id==='followups') window.renderAutomaticFollowups();
    };

    const loadDataBeforeAutoFollowup=window.loadData;
    window.loadData=async function(){
      await loadDataBeforeAutoFollowup();
      if(document.getElementById('followupFinanceList')) window.renderAutomaticFollowups();
      if(typeof window.renderDashboard==='function' && document.getElementById('kOursFromProviders')) window.renderDashboard();
    };

    const saveCaseDetailsBeforeAutoFollowup=window.saveCaseDetails;
    window.saveCaseDetails=async function(){
      await saveCaseDetailsBeforeAutoFollowup();
      if(document.getElementById('followupFinanceList')) window.renderAutomaticFollowups();
      if(typeof window.renderDashboard==='function') window.renderDashboard();
    };


    window.downloadTestBackup=async function(ev){
      const status=document.getElementById('testBackupStatus');
      const btn=ev&&ev.currentTarget?ev.currentTarget:null;
      if(status) status.textContent='جاري تجهيز النسخة...';
      if(btn) btn.disabled=true;
      try{
        const [cases,providers,services,employees,followups,payments,settlements,attachments,activity]=await Promise.all([
          api('cases?select=*'),
          api('providers?select=*'),
          api('services?select=*'),
          api('employees?select=*'),
          api('followups?select=*'),
          api('client_payments?select=*'),
          api('settlements?select=*'),
          api('case_attachments?select=*').catch(function(){return []}),
          api('activity_log?select=*')
        ]);
        const payload={
          backup_type:'pawapp_concierge_test',
          created_at:new Date().toISOString(),
          version:1,
          counts:{
            cases:cases.length,
            providers:providers.length,
            services:services.length,
            employees:employees.length,
            followups:followups.length,
            client_payments:payments.length,
            settlements:settlements.length,
            attachments:attachments.length,
            activity_log:activity.length
          },
          data:{
            test_cases:cases,
            test_providers:providers,
            test_services:services,
            test_employees:employees,
            test_followups:followups,
            test_client_payments:payments,
            test_settlements:settlements,
            test_case_attachments:attachments,
            test_activity_log:activity
          }
        };
        const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        const stamp=new Date().toISOString().replace(/[:.]/g,'-');
        a.href=url;
        a.download='pawapp-test-backup-'+stamp+'.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function(){URL.revokeObjectURL(url)},1000);
        if(status) status.textContent='تم تجهيز النسخة الاحتياطية • '+cases.length+' عملية';
        toast('تم تحميل النسخة الاحتياطية');
      }catch(e){
        console.error('backup download failed',e);
        if(status) status.textContent='تعذر تجهيز النسخة الاحتياطية';
        alert('تعذر تجهيز النسخة الاحتياطية');
      }finally{
        if(btn) btn.disabled=false;
      }
    };


    window.renderAdminAccess=async function(){
      const box=document.getElementById('adminAccessList');
      const employeeSelect=document.getElementById('adminEmployeeSelect');
      const client=window.PAWAPP_AUTH&&window.PAWAPP_AUTH.client;

      let rows=[];
      try{
        if(client){
          const empRes=await client.from('test_employees').select('id,name').order('name',{ascending:true});
          if(!empRes.error && Array.isArray(empRes.data)) rows=empRes.data;
        }
      }catch(e){console.warn('admin employees load failed',e)}

      if(!rows.length && Array.isArray(db.staff)) rows=db.staff;

      if(employeeSelect){
        employeeSelect.innerHTML='<option value="">اختاري الموظف</option>'+
          rows.map(function(e){
            return '<option value="'+e.id+'">'+esc(e.name||'موظف')+'</option>';
          }).join('');
      }

      if(!box) return;

      let accessRows=[];
      try{
        if(client){
          const res=await client.from('test_employee_access')
            .select('employee_id,email,role,is_active,auth_user_id,updated_at')
            .order('updated_at',{ascending:false});
          if(!res.error) accessRows=Array.isArray(res.data)?res.data:[];
        }
      }catch(e){console.warn('admin access list failed',e)}

      box.innerHTML=rows.length?rows.map(function(e){
        const a=accessRows.find(function(x){return String(x.employee_id)===String(e.id)});
        const roleLabel=a?(a.role==='admin'?'Admin':a.role==='accountant'?'Accountant - محاسب':a.role==='read_only'?'Read only':'Operations'):'—';
        const state=a?(a.is_active?(a.auth_user_id?'مفعّل':'جاهز للتفعيل'):'موقوف'):'بدون حساب';
        const cls=a&&a.is_active?(a.auth_user_id?'paid':'partial'):'unpaid';
        return '<div class="card" style="box-shadow:none;margin-bottom:8px">'+
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center">'+
            '<div><b>'+esc(e.name||'موظف')+'</b>'+
              '<div class="hint">'+esc(a&&a.email?a.email:'ما في إيميل')+' • '+esc(roleLabel)+'</div></div>'+
            '<span class="status '+cls+'">'+esc(state)+'</span>'+
          '</div>'+
        '</div>';
      }).join(''):'<div class="hint">تعذر تحميل أسماء الموظفين. جربي Refresh.</div>';
    };

    const showPageBeforeAdmin=window.showPage;
    window.showPage=async function(id){
      if(id==='admin' && !(window.pawIsAdmin&&window.pawIsAdmin())){
        toast('هذه الصفحة للـ Admin فقط');
        return;
      }
      await showPageBeforeAdmin(id);
      if(id==='admin') window.renderAdminAccess();
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