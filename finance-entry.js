/* Isolated TEST boot sequence for the new Supabase environment. */
(async function(){
  'use strict';
  if(window.__pawFinanceBoot)return;
  window.__pawFinanceBoot=true;
  const base=new URL('.',document.currentScript.src);
  const t=(ar,en)=>window.PawI18n?.t(ar,en)??ar;
  const overlay=document.createElement('div');
  overlay.id='financeBootStatus';
  overlay.setAttribute('role','status');
  overlay.style.cssText='position:fixed;inset:0;z-index:20000;background:#f7f9fc;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;direction:rtl;font:600 18px system-ui';
  overlay.dir=window.PawI18n?.language==='en'?'ltr':'rtl';overlay.textContent=t('جاري تحميل حسابات TEST…');
  document.body.appendChild(overlay);
  async function script(path){
    await new Promise((resolve,reject)=>{
      const node=document.createElement('script');
      node.src=new URL(path,base).href;
      node.async=false;
      node.onload=resolve;
      node.onerror=()=>reject(new Error('تعذر تحميل ملف النظام: '+path.split('?')[0]));
      document.body.appendChild(node);
    });
  }
  try{
    if(!window.PAWAPP_AUTH?.client)throw new Error('سجلي الدخول أولًا.');
    await script('finance-core.js?v=3.24-'+Date.now());
    await script('accountant-format-hotfix.js?v=20261104-1');
    await script('finance-ui.js?v=3.24-'+Date.now());
    try{await script('paw-assistant.js?v=20261127-launcher3');}catch(e){console.warn('Optional dashboard assistant unavailable',e);}
    await script('app.js?v=3.24-'+Date.now());
    const start=Date.now();
    while(typeof window.renderAdminAccess!=='function'||typeof window.downloadTestBackup!=='function'){
      if(Date.now()-start>20000)throw new Error('تأخر تحميل النظام. أعيدي المحاولة.');
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    try{await script('social-platforms.js?v=3');}catch(e){console.warn('Optional platform insights unavailable',e);}
    try{await script('marketing-ui.js?v=20261126-meta-ads');}catch(e){console.warn('Optional marketing module unavailable',e);}
    await window.loadData();
    await window.PawFinanceInstall();
    await script('customer-phone-lookup.js?v=20261125-i18n3');
    window.PAW_FINANCE_VERSION='3.4';
    overlay.remove();
    // Keep new form submissions reflected in staff counts without reloading during active editing.
    let testRefreshBusy=false;
    async function refreshTestIntake(){
      if(document.visibilityState!=='visible'||!window.PAW_FINANCE_READY||testRefreshBusy)return;
      if(document.querySelector('.modalBg.show'))return;
      testRefreshBusy=true;
      try{
        await window.loadData();
        if(typeof window.pawFinanceRefresh==='function')await window.pawFinanceRefresh();
      }catch(error){console.warn('TEST dashboard refresh unavailable',error);}
      finally{testRefreshBusy=false;}
    }
    document.addEventListener('visibilitychange',function(){
      if(document.visibilityState==='visible')refreshTestIntake();
    });
    setInterval(refreshTestIntake,60000);
  }catch(error){
    console.error('TEST finance initialization failed',error);
    overlay.textContent=t('تعذر فتح الحسابات المحدثة.')+' '+String(error?.message||'');
    const button=document.createElement('button');
    button.className='btn primary';
    button.textContent=t('إعادة تحميل TEST');
    button.style.margin='16px';
    button.onclick=()=>location.reload();
    overlay.appendChild(button);
    window.PAW_FINANCE_BOOT_ERROR=String(error?.message||error);
  }
})();
