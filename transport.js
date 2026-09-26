
(function(){
  const SB='https://fccvnotgsmxirhztveai.supabase.co';
  const KEY='sb_publishable__bDEEO_UuUc2AZmCNMhQHg_qzjmoSnL';

  async function rest(path, options={}){
    const r=await fetch(SB+'/rest/v1/'+path,{
      ...options,
      headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',...(options.headers||{})}
    });
    if(!r.ok) throw new Error(await r.text());
    if(r.status===204) return null;
    return r.json();
  }

  function escT(v){
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function statusLabel(v){
    return {scheduled:'مجدول',picked_up:'تم الاستلام',at_destination:'تم الوصول',returning:'راجع',delivered:'تم التسليم',cancelled:'ملغي'}[v]||v||'مجدول';
  }

  function ensureUI(){
    if(document.getElementById('caseTransportBox')) return true;
    const modal=document.querySelector('#completeCaseModal .modal');
    if(!modal) return false;
    const saveBtn=Array.from(modal.querySelectorAll('button')).find(b=>b.textContent.includes('حفظ كل التعديلات'));
    if(!saveBtn) return false;
    const box=document.createElement('div');
    box.id='caseTransportBox';
    box.innerHTML=
      '<div class="section"><h2>Pickup / Drop-off</h2></div>'+
      '<div class="card" style="box-shadow:none">'+
        '<div class="grid2">'+
          '<div class="field"><label>نوع المشوار</label><select id="transportDirection"><option value="pickup">Pickup</option><option value="dropoff">Drop-off</option><option value="both">Pickup + Drop-off</option></select></div>'+
          '<div class="field"><label>التاريخ والوقت</label><input id="transportAt" type="datetime-local"></div>'+
        '</div>'+
        '<div class="grid2" style="margin-top:8px">'+
          '<div class="field"><label>مكان الاستلام</label><input id="transportPickupLocation" placeholder="المنطقة / العنوان"></div>'+
          '<div class="field"><label>مكان التوصيل</label><input id="transportDropoffLocation" placeholder="العيادة / البيت / الموقع"></div>'+
        '</div>'+
        '<div class="field" style="margin-top:8px"><label>ملاحظات</label><textarea id="transportNotes" rows="2"></textarea></div>'+
        '<button class="btn soft" style="width:100%;margin-top:9px" type="button" onclick="addTransportJob()">+ إضافة مشوار</button>'+
        '<div id="transportHistory" style="margin-top:8px"></div>'+
      '</div>';
    saveBtn.parentNode.insertBefore(box,saveBtn);
    return true;
  }

  window.loadTransportJobs=async function(caseId){
    if(!ensureUI()) return;
    const box=document.getElementById('transportHistory');
    try{
      const rows=await rest('test_transport_jobs?case_id=eq.'+encodeURIComponent(caseId)+'&select=*&order=pickup_at.desc');
      box.innerHTML=rows.length?rows.map(x=>{
        const d=new Date(x.pickup_at);
        const when=Number.isFinite(d.getTime())?d.toLocaleString('ar-KW',{dateStyle:'medium',timeStyle:'short'}):String(x.pickup_at||'');
        const dir=x.direction==='pickup'?'Pickup':x.direction==='dropoff'?'Drop-off':'Pickup + Drop-off';
        return '<div class="card" style="box-shadow:none;margin-top:7px">'+
          '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>'+escT(dir)+'</b><span class="status">'+escT(statusLabel(x.status))+'</span></div>'+
          '<div class="hint">'+escT(when)+'</div>'+
          (x.pickup_location?'<div class="hint">من: '+escT(x.pickup_location)+'</div>':'')+
          (x.dropoff_location?'<div class="hint">إلى: '+escT(x.dropoff_location)+'</div>':'')+
          (x.notes?'<div class="hint">ملاحظة: '+escT(x.notes)+'</div>':'')+
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'+
            '<button class="btn soft" onclick="setTransportStatus(\''+x.id+'\',\'picked_up\')">تم الاستلام</button>'+
            '<button class="btn soft" onclick="setTransportStatus(\''+x.id+'\',\'at_destination\')">وصل</button>'+
            '<button class="btn soft" onclick="setTransportStatus(\''+x.id+'\',\'returning\')">راجع</button>'+
            '<button class="btn soft" onclick="setTransportStatus(\''+x.id+'\',\'delivered\')">تم التسليم</button>'+
            '<button class="btn danger" onclick="setTransportStatus(\''+x.id+'\',\'cancelled\')">إلغاء</button>'+
          '</div>'+
        '</div>';
      }).join(''):'<div class="hint">ما في مشوار مسجل على هالحالة.</div>';
    }catch(e){
      console.error(e);
      box.innerHTML='<div class="hint">تعذر تحميل المشاوير.</div>';
    }
  };

  window.addTransportJob=async function(){
    const caseId=document.getElementById('editCaseId')?.value;
    const at=document.getElementById('transportAt')?.value;
    if(!caseId||!at){alert('اختاري تاريخ ووقت المشوار');return}
    const payload={
      case_id:Number(caseId),
      direction:document.getElementById('transportDirection')?.value||'both',
      pickup_at:new Date(at).toISOString(),
      pickup_location:document.getElementById('transportPickupLocation')?.value.trim()||null,
      dropoff_location:document.getElementById('transportDropoffLocation')?.value.trim()||null,
      notes:document.getElementById('transportNotes')?.value.trim()||null,
      status:'scheduled'
    };
    try{
      await rest('test_transport_jobs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});
      await loadTransportJobs(caseId);
      if(window.toast) toast('تمت إضافة المشوار');
    }catch(e){console.error(e);alert('تعذر حفظ المشوار')}
  };

  window.setTransportStatus=async function(id,status){
    try{
      await rest('test_transport_jobs?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,updated_at:new Date().toISOString()})});
      const caseId=document.getElementById('editCaseId')?.value;
      if(caseId) await loadTransportJobs(caseId);
      if(window.toast) toast('تم تحديث حالة المشوار');
    }catch(e){console.error(e);alert('تعذر تحديث حالة المشوار')}
  };

  function hook(){
    if(typeof window.openCaseDetails!=='function') return false;
    if(window.__transportHooked) return true;
    window.__transportHooked=true;
    const old=window.openCaseDetails;
    window.openCaseDetails=function(id){
      old(id);
      setTimeout(()=>{ensureUI();loadTransportJobs(id)},0);
    };
    return true;
  }

  if(!hook()){
    const timer=setInterval(()=>{if(hook())clearInterval(timer)},250);
    setTimeout(()=>clearInterval(timer),15000);
  }
})();
