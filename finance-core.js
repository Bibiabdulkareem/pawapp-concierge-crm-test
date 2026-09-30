/* TEST finance v3: one exact calculation path for dashboard, partners and CSV. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PawFinanceCore=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
function decimal(value){
 const s=String(value==null?'0':value).trim();const m=/^\+?(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
 if(!m||s.length>60)throw Error('Invalid non-negative amount');
 const exponent=Number(m[3]||0);if(Math.abs(exponent)>12)throw Error('Amount out of range');
 let n=BigInt(m[1]+(m[2]||''));let scale=(m[2]||'').length-exponent;
 if(scale<0){n*=10n**BigInt(-scale);scale=0;}return[n,10n**BigInt(scale)];
}
const rounded=(n,d)=>(n*2n+d)/(d*2n);
function minor(v){const [n,d]=decimal(v);const x=rounded(n*1000n,d);if(x>999999999999n)throw Error('Amount out of range');return x;}
function format(x){if(x==null)return '\u2014';const negative=x<0n;const n=negative?-x:x;return(negative?'-':'')+String(n/1000n)+'.'+String(n%1000n).padStart(3,'0');}
const left=(a,b)=>a>b?a-b:0n;
function quote(amount,type,fee,basis){
 let total=minor(amount),paw;
 if(type==='fixed'){paw=minor(fee);if(basis==='provider_base')total+=paw;}
 else if(type==='percent'){if(basis==='provider_base')throw Error('Percent uses customer total');const[n,d]=decimal(fee);if(n>100n*d)throw Error('Percentage exceeds 100');paw=rounded(total*n,100n*d);}
 else throw Error('Invalid fee type');
 if(total>999999999999n||paw>total)throw Error('Fee exceeds total');return{total,paw,provider:total-paw};
}
function phone(v){let s=String(v||'').normalize('NFKC').replace(/[\u0660-\u0669]/g,d=>String(d.charCodeAt(0)-0x0660)).replace(/[\u06f0-\u06f9]/g,d=>String(d.charCodeAt(0)-0x06f0)).replace(/[^\d+]/g,'').replace(/^\+/,'').replace(/^00/,'');if(s.length===8)s='965'+s;return s;}
function customerKey(c){return c.customer_id?'id:'+c.customer_id:phone(c.client_phone)?'phone:'+phone(c.client_phone):'case:'+c.id;}
const keys=['total','paw','provider','paid','unpaid','providerPaid','commissionReceived','ours','theirs','pawCollected'];
function line(c,component){
 const t=component==='transport',pre=t?'transport_':'',issues=[];if(c.workflow_status==='cancelled')issues.push('cancelled_case_requires_review');
 const total=minor(c[pre+'total_amount']),paw=minor(c[pre+'pawapp_amount']),provider=minor(c[pre+'provider_amount']);
 const type=t?(c.transport_fee_type||'fixed'):(c.fee_type||'percent');
 const fee=t?(c.transport_fee_value??c.transport_pawapp_amount??0):(c.fee_value??0);
 let calculated;try{calculated=quote(c[pre+'total_amount'],type,fee);}catch(e){issues.push('invalid_price');}
 if(calculated&&(calculated.paw!==paw||calculated.provider!==provider))issues.push('price_split_mismatch');
 if(paw+provider!==total)issues.push('price_split_mismatch');if(total===0n)issues.push('unpriced_service');
 const recorded=minor(c[t?'transport_paid_recorded':'main_paid_recorded']);
 const providerPaid=minor(c[t?'transport_provider_paid':'main_provider_paid']);
 const commissionReceived=minor(c[pre+'pawapp_received_from_provider']);
 const flag=c[pre+'client_paid'],route=c[pre+'client_paid_to']||'';
 const unknown=t&&flag==null&&recorded===0n;
 const paid=recorded>0n?recorded:flag===true?total:0n;
 const isPaid=total>0n&&paid>=total;
 if(unknown)issues.push('transport_payment_unknown');
 if(paid>total)issues.push('client_overpaid');
 if(providerPaid>provider)issues.push('provider_overpaid');
 if(commissionReceived>paw)issues.push('commission_overpaid');
 if(flag===true&&paid<total)issues.push('paid_flag_mismatch');
 if(route==='provider'&&providerPaid>0n)issues.push('direct_provider_and_payout');
 if(route==='pawapp'&&commissionReceived>0n)issues.push('duplicate_commission_route');
 if(!c[t?'transport_provider_id':'provider_id'])issues.push('provider_missing');
 if(isPaid&&!['pawapp','provider'].includes(route))issues.push('payment_route_missing');
 const ours=isPaid&&route==='provider'?left(paw,commissionReceived):0n;
 const theirs=isPaid&&route==='pawapp'?left(provider,providerPaid):0n;
 const pawCollected=isPaid?(route==='pawapp'?paw:route==='provider'?commissionReceived:0n):0n;
 let action=null;
 if(unknown)action='confirm_transport';else if(total>0n&&!isPaid)action='client_paid';else if(isPaid&&!route)action='client_paid';else if(theirs>0n)action='provider_paid';else if(ours>0n)action='commission_received';
 return{caseId:String(c.id),component,providerId:String(c[t?'transport_provider_id':'provider_id']||''),customerKey:customerKey(c),client:c.client_name||'',phone:c.client_phone||'',date:c.service_date||'',service:t?'Pickup / Drop-off':c.service_name||c.requested_service||'',feeType:type,feeValue:String(fee),route,total,paw,provider,paid,unpaid:unknown?null:left(total,paid),providerPaid,commissionReceived,ours,theirs,pawCollected,isPaid,unknown,action,issues:[...new Set(issues)],revision:c.finance_revision||0,raw:c};
}
function allLines(cases){const seen=new Set();const out=[];for(const c of cases){if(seen.has(String(c.id)))throw Error('Duplicate case; refusing double counting');seen.add(String(c.id));out.push(line(c,'main'));if(minor(c.transport_total_amount)>0n||c.transport_provider_id)out.push(line(c,'transport'));}return out;}
function summarize(lines){const amounts=Object.fromEntries(keys.map(k=>[k,0n]));for(const l of lines)for(const k of keys)amounts[k]+=l[k]??0n;return{...amounts,caseCount:new Set(lines.map(l=>l.caseId)).size,customerCount:new Set(lines.map(l=>l.customerKey)).size,lineCount:lines.length,unknownCount:lines.filter(l=>l.unknown).length,issueCount:lines.filter(l=>l.issues.length).length,ready:lines.every(l=>!l.issues.length)};}
function project(snapshot){const lines=allLines(snapshot.cases||[]);return{lines,summary:summarize(lines),providers:(snapshot.providers||[]).map(p=>({...p,lines:lines.filter(l=>l.providerId===String(p.id)),summary:summarize(lines.filter(l=>l.providerId===String(p.id)))}))};}
function cell(v){let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csv(lines,providerName){const s=summarize(lines);const header=['Case ID','Component','Company','Client','Phone','Service','Fee type','Fee value','Total KD','PawApp share KD','Provider share KD','Client paid KD','Client unpaid KD','Paid to','Paid to provider KD','Commission received KD','Due to PawApp KD','Due to provider KD','Review'];const rows=lines.map(l=>['PAW-'+l.caseId.padStart(4,'0'),l.component,providerName,l.client,l.phone,l.service,l.feeType,l.feeValue,...['total','paw','provider','paid','unpaid'].map(k=>format(l[k])),l.route||'Unknown',...['providerPaid','commissionReceived','ours','theirs'].map(k=>format(l[k])),l.issues.join(';')]);rows.push(['TOTAL','','','','','','','',...['total','paw','provider','paid'].map(k=>format(s[k])),s.unknownCount?'Unknown + '+format(s.unpaid):format(s.unpaid),'',...['providerPaid','commissionReceived','ours','theirs'].map(k=>format(s[k])),s.ready?'CHECKED':'REVIEW REQUIRED']);return '\ufeff'+[header,...rows].map(r=>r.map(cell).join(',')).join('\r\n');}
return{minor,format,quote,phone,customerKey,line,allLines,summarize,project,csv};
});
