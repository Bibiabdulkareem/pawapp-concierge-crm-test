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
        const hay=['PAW-'+String(c.id).padStart(4,'0'),c.client_name,c.client_phone,c.staff,pr.name,c.service].join(' ').toLowerCase();
        if(q&&!hay.includes(q))return;
        if(pf!=='all'&&c.providerId!==pf)return;
        const clientPaid=clientRem(c)<=0.0001;
        const providerPaid=rem(c)<=0.0001;
        h+=`<tr>
          <td>PAW-${String(c.id).padStart(4,'0')}</td>
          <td>${esc(c.client_name)}</td>
          <td>${esc(pr.name)}</td>
          <td>${esc(c.service)}</td>
          <td>${money(c.amount)}</td>
          <td>${money(paw(c))}</td>
          <td>${money(due(c))}</td>
          <td><span class="status ${clientPaid?'paid':'unpaid'}">${clientPaid?'تم الدفع':'لم يتم الدفع'}</span></td>
          <td><span class="status ${providerPaid?'paid':'pending'}">${providerPaid?'تم الدفع للمقدم':'لم يتم الدفع للمقدم'}</span></td>
          <td>${esc(c.staff)}</td>
          <td><button class="btn soft" style="padding:7px" onclick="openClientPayment('${c.id}')">${clientPaid?'عرض':'تسجيل دفع'}</button></td>
          <td><button class="btn soft" style="padding:7px" onclick="openSettlement('${c.id}')">${providerPaid?'عرض':'دفع للمقدم'}</button></td>
        </tr>`;
      });
      document.getElementById('caseRows').innerHTML=h||'<tr><td colspan="12">لا توجد عمليات</td></tr>';
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
        h+=`<tr>
          <td>PAW-${String(c.id).padStart(4,'0')}</td>
          <td>${esc(c.client_name)}</td>
          <td>${esc(pr.name)}</td>
          <td>${esc(c.service)}</td>
          <td>${money(c.amount)}</td>
          <td>${money(paw(c))}</td>
          <td>${money(due(c))}</td>
          <td><span class="status ${clientPaid?'paid':'unpaid'}">${clientPaid?'تم الدفع':'لم يتم الدفع'}</span></td>
        </tr>`;
      });
      document.getElementById('recent').innerHTML=h||'<tr><td colspan="8">لا توجد عمليات</td></tr>';
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

    renderAll();
  };
  document.head.appendChild(script);
})();