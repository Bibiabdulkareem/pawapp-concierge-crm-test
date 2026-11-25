/* TEST-only: one language preference for the whole UI; no database writes. */
(function(){
'use strict';
const dict=window.PawI18nDictionary||{};
const has=k=>Object.prototype.hasOwnProperty.call(dict,k);
const prefix='pawapp.test.ui-language.';
const safeGet=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
const safeSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const supported=x=>x==='ar'||x==='en';
let account='',lang=safeGet(prefix+'guest')==='en'?'en':'ar';
const originals=new WeakMap(),attributes=new WeakMap();
function t(ar,en){return lang==='en'?(en!==undefined?en:has(ar)?dict[ar]:ar):ar;}
function workflow(status){
 const labels={new_request:'New — جديد',client_contacted:'Client Contacted — تم التواصل مع العميل',provider_confirmed:'Doctor / Provider Confirmed — تم تأكيد الطبيب / مقدم الخدمة',doctor_confirmed:'Doctor / Provider Confirmed — تم تأكيد الطبيب / مقدم الخدمة',appointment_completed:'Appointment Completed — تم الموعد / الخدمة',payment_completed:'Payment Completed — اكتمل الدفع والتسويات',closed:'Closed — مغلقة',cancelled:'Cancelled — ملغاة'};
 return t(labels[status]||labels.new_request);
}
function translated(raw){
 const key=raw.trim();
 return has(key)?raw.replace(key,dict[key]):raw;
}
function staticLabels(){
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_COMMENT);
 let marker;
 while((marker=walker.nextNode())){
  if(marker.nodeValue!=='paw-i18n')continue;
  const node=marker.nextSibling;if(!node||node.nodeType!==3)continue;
  let entry=originals.get(node);
  if(!entry){if(!has(node.nodeValue.trim()))continue;entry={ar:node.nodeValue,last:node.nodeValue};originals.set(node,entry);}
  // Never replace content modified by another module or a user.
  if(node.nodeValue!==entry.last&&node.nodeValue!==entry.ar)continue;
  const next=lang==='en'?translated(entry.ar):entry.ar;
  if(node.nodeValue!==next)node.nodeValue=next;entry.last=next;
 }
 for(const el of document.querySelectorAll('[data-paw-i18n-attrs]')){
  let memo=attributes.get(el);if(!memo){memo={};attributes.set(el,memo);}
  for(const attr of el.dataset.pawI18nAttrs.split(',')){
   const current=el.getAttribute(attr);if(current===null)continue;
   let entry=memo[attr];if(!entry){if(!has(current.trim()))continue;entry=memo[attr]={ar:current,last:current};}
   if(current!==entry.last&&current!==entry.ar)continue;
   const next=lang==='en'?translated(entry.ar):entry.ar;
   if(current!==next)el.setAttribute(attr,next);entry.last=next;
  }
 }
}
function update(){
 document.documentElement.lang=lang;document.documentElement.dir=lang==='en'?'ltr':'rtl';
 if(document.body)staticLabels();
 for(const select of document.querySelectorAll('[data-paw-language]'))select.value=lang;
}
function announce(){
 update();document.dispatchEvent(new CustomEvent('paw-language-change',{detail:{language:lang}}));
}
function setLanguage(next){
 if(!supported(next))return;
 lang=next;safeSet(prefix+(account||'guest'),next);safeSet(prefix+'guest',next);announce();
}
function activateUser(id){
 if(!id)return;account=String(id);
 const saved=safeGet(prefix+account);
 if(supported(saved))lang=saved;else safeSet(prefix+account,lang);
 announce();
}
let pending=false;
function watchMarkedLabels(){
 if(!document.body||typeof MutationObserver==='undefined')return;
 const observer=new MutationObserver(records=>{
  if(lang!=='en'||pending)return;
  const hasMarker=n=>n.nodeType===8&&n.nodeValue==='paw-i18n'||n.nodeType===1&&(
   n.hasAttribute('data-paw-i18n-attrs')||n.querySelector('[data-paw-i18n-attrs]')||
   (()=>{const w=document.createTreeWalker(n,NodeFilter.SHOW_COMMENT);let c;while(c=w.nextNode())if(c.nodeValue==='paw-i18n')return true;return false;})()
  );
  if(!records.some(r=>Array.from(r.addedNodes).some(hasMarker)))return;
  pending=true;requestAnimationFrame(()=>{pending=false;update();});
 });
 observer.observe(document.body,{childList:true,subtree:true});
}
function bind(){
 for(const select of document.querySelectorAll('[data-paw-language]'))select.addEventListener('change',()=>setLanguage(select.value));
 update();watchMarkedLabels();
}
window.PawI18n=Object.freeze({get language(){return lang;},t,workflow,setLanguage,activateUser,refreshStatic:update});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
