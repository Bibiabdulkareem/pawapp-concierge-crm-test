/* TEST-only boot sequence. Never changes the Live repository or selects Live finance tables. */
(async function(){
  'use strict';
  if(window.__pawFinanceBoot)return;
  window.__pawFinanceBoot=true;
  const base=new URL('.',document.currentScript.src);
  const overlay=document.createElement('div');
  overlay.id='financeBootStatus';
  overlay.setAttribute('role','status');
  overlay.style.cssText='position:fixed;inset:0;z-index:20000;background:#f7f9fc;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;direction:rtl;font:600 18px system-ui';
  overlay.textContent='جاري تحميل حسابات TEST…';
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
    await script('finance-core.js?v=3.1');
    await script('finance-ui.js?v=3.1');
    await script('app.js?v=3.1');
    const start=Date.now();
    while(typeof window.renderAdminAccess!=='function'||typeof window.downloadTestBackup!=='function'){
      if(Date.now()-start>20000)throw new Error('تأخر تحميل النظام. أعيدي المحاولة.');
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    await window.loadData();
    await window.PawFinanceInstall();
    window.PAW_FINANCE_VERSION='3.1';
    overlay.remove();
  }catch(error){
    console.error('TEST finance initialization failed',error);
    overlay.textContent='تعذر فتح الحسابات المحدثة. '+String(error?.message||'');
    const button=document.createElement('button');
    button.className='btn primary';
    button.textContent='إعادة تحميل TEST';
    button.style.margin='16px';
    button.onclick=()=>location.reload();
    overlay.appendChild(button);
    window.PAW_FINANCE_BOOT_ERROR=String(error?.message||error);
  }
})();
