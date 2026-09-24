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
  document.head.appendChild(script);
})();