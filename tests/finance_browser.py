"""Browser integration with an in-memory RPC fixture. No real financial records are touched."""
import copy,csv,functools,http.server,io,json,os,pathlib,threading
from decimal import Decimal,ROUND_HALF_UP
from urllib.parse import urlparse,parse_qs
from playwright.sync_api import sync_playwright,expect
ROOT=pathlib.Path(__file__).resolve().parents[1]
Q=lambda x:str(Decimal(str(x)).quantize(Decimal('.001'),rounding=ROUND_HALF_UP))
def priced(c,pre=''):
 t=Decimal(c[pre+'total_amount']);fee=Decimal(str(c.get(pre+'fee_value') or 0));pw=fee if c.get(pre+'fee_type','fixed')=='fixed' else t*fee/100
 c[pre+'pawapp_amount']=Q(pw);c[pre+'provider_amount']=Q(t-Decimal(Q(pw)))
class Fixture:
 def __init__(self,role='admin'):
  self.role=role;self.calls=[];self.seen={};self.access={'email':'qa@example.invalid','role':role,'is_active':True,'employee_id':'e1','auth_user_id':'qa-user'}
  common={'client_name':'QA Customer','client_phone':'55550000','location':'QA Address','pet_type':'cat','breed':'QA','pet_age':'2','employee_id':'e1','provider_id':'p1','service_name':'Exam','source':'manual_test','service_date':'2026-09-30','created_at':'2026-09-30T10:00:00Z','workflow_status':'provider_confirmed','appointment_at':'2026-09-30T10:00:00Z','finance_revision':0,'pawapp_received_from_provider':'0','main_paid_recorded':'0','main_provider_paid':'0','transport_provider_id':None,'transport_total_amount':'0','transport_pawapp_amount':'0','transport_provider_amount':'0','transport_fee_type':'fixed','transport_fee_value':None,'transport_client_paid':None,'transport_client_paid_to':None,'transport_pawapp_received_from_provider':'0','transport_paid_recorded':'0','transport_provider_paid':'0'}
  a={**common,'id':1,'total_amount':'100','fee_type':'percent','fee_value':'10','client_paid':True,'client_paid_to':'pawapp','main_paid_recorded':'100','transport_provider_id':'p2','transport_total_amount':'10','transport_pawapp_amount':'2','transport_provider_amount':'8','transport_fee_value':'2','transport_direction':'both','pickup_location':'Home','dropoff_location':'Clinic','transport_at':'2026-10-02T09:00:00Z'}
  b={**common,'id':2,'total_amount':'25','fee_type':'fixed','fee_value':'5','client_paid':False,'client_paid_to':None,'workflow_status':'new_request','appointment_at':None}
  priced(a);priced(b)
  self.state={'version':'finance-v3','as_of':'2026-09-30T20:00:00Z','cases':[a,b],'providers':[{'id':'p1','name':'QA Clinic','provider_type':'company','category':'veterinary','default_fee_type':'fixed','default_fee_value':'5'},{'id':'p2','name':'QA Taxi','provider_type':'company','category':'services','default_fee_type':'percent','default_fee_value':'10'}],'services':[{'id':'s1','provider_id':'p1','name':'Exam'},{'id':'s2','provider_id':'p2','name':'Transport'}],'employees':[{'id':'e1','name':'QA Operator'}],'followups':[]}
 def rpc(self,name,args):
  self.calls.append((name,copy.deepcopy(args)))
  if name=='test_finance_snapshot':return copy.deepcopy(self.state)
  if name=='test_finance_backup':return {'data':copy.deepcopy(self.state)}
  assert self.role in ['admin','operations'],'No permission'
  rid=args['p_request_id']
  if rid in self.seen:return self.seen[rid]
  if name=='test_finance_save':
   if args['p_case_id'] is None:
    c=copy.deepcopy(self.state['cases'][1]);c.update({'id':max(x['id'] for x in self.state['cases'])+1,'client_paid':False,'client_paid_to':None,'main_paid_recorded':'0','main_provider_paid':'0','workflow_status':'new_request','finance_revision':0});self.state['cases'].append(c)
   else:c=next(x for x in self.state['cases'] if x['id']==args['p_case_id'])
   if args.get('p_revision') is not None:assert c['finance_revision']==args['p_revision'],'Case changed'
   c.update(args['p_patch']);priced(c)
   if c['transport_provider_id']:priced(c,'transport_')
   for comp,payment in args.get('p_payments',{}).items():
    pre='' if comp=='main' else 'transport_'
    if payment.get('paid'):
     c[pre+'client_paid']=True;c[pre+'client_paid_to']=payment['recipient'];c[comp+'_paid_recorded']=c[pre+'total_amount']
    elif payment.get('paid') is False:c[pre+'client_paid']=False
   c['finance_revision']+=1
  elif name=='test_finance_action':
   c=next(x for x in self.state['cases'] if x['id']==args['p_case_id']);assert c['finance_revision']==args['p_revision'],'Case changed'
   pre='' if args['p_component']=='main' else 'transport_';comp=args['p_component'];action=args['p_action'];data=args['p_data']
   if action=='confirm_transport_unpaid':c['transport_client_paid']=False
   if action=='client_paid':c[pre+'client_paid']=True;c[pre+'client_paid_to']=data['recipient'];c[comp+'_paid_recorded']=c[pre+'total_amount']
   if action=='provider_paid':c[comp+'_provider_paid']=Q(Decimal(c[comp+'_provider_paid'])+Decimal(data['amount']))
   if action=='commission_received':c[pre+'pawapp_received_from_provider']=Q(Decimal(c[pre+'pawapp_received_from_provider'])+Decimal(data['amount']))
   c['finance_revision']+=1
  else:raise AssertionError('Unexpected RPC '+name)
  out={'case_id':c['id'],'revision':c['finance_revision'],'duplicate':False};self.seen[rid]=out;return out
 def route(self,route):
  request=route.request;u=urlparse(request.url)
  if u.netloc=='qa-fixture.invalid' or u.netloc.startswith('127.0.0.1'):
   if u.path.startswith('/mock/'):
    try:result={'data':self.rpc(u.path.split('/')[-1],request.post_data_json or {}),'error':None}
    except Exception as e:result={'data':None,'error':{'message':str(e)}}
    route.fulfill(json=result,headers={'Access-Control-Allow-Origin':'*'});return
   target=ROOT/u.path.lstrip('/')
   if target.exists():route.fulfill(path=str(target),content_type='application/javascript' if target.suffix=='.js' else 'text/html',headers={'Access-Control-Allow-Origin':'*'})
   else:route.fulfill(status=404,body='Missing fixture file')
   return
  if 'supabase-js' in u.path:
   code="""window.supabase={createClient(){const access=ACCESS;const auth={getSession:async()=>({data:{session:{user:{id:'qa-user',email:access.email}}}}),onAuthStateChange(){},signOut:async()=>({}),updateUser:async()=>({})};return{auth,from(name){const q={select(){return q},eq(){return q},order(){return q},limit(){return q},ilike(){return q},maybeSingle:async()=>({data:access,error:null}),then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return q},rpc:async(name,args={})=>fetch('/mock/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)}).then(r=>r.json())};}};""".replace('ACCESS',json.dumps(self.access))
   route.fulfill(body=code,content_type='application/javascript');return
  if '/pop-up-concierge-operation@' in request.url:
   route.fulfill(path=str(ROOT/'tests/base-app.js'),content_type='application/javascript');return
  if '/rest/v1/' in u.path:
   table=u.path.split('/rest/v1/')[-1];assert table.startswith('test_'),('LIVE request forbidden',request.url);table=table[5:]
   if request.method=='PATCH':
    assert table in ['cases','followups'];cid=int(parse_qs(u.query).get('id',['eq.0'])[0].split('.')[-1]);c=next(x for x in self.state['cases'] if x['id']==cid);c.update(request.post_data_json);c['finance_revision']+=1;route.fulfill(status=204);return
   assert request.method=='GET',('Unexpected legacy write',request.url)
   value=self.state.get(table,[])
   if table in ['client_payments','settlements']:
    value=[]
    for c in self.state['cases']:
     key='main_paid_recorded' if table=='client_payments' else 'main_provider_paid'
     if Decimal(c[key])>0:value.append({'case_id':c['id'],'amount':c[key]})
   route.fulfill(json=value);return
  route.fulfill(status=200,body='',content_type='text/plain')
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass

def run(browser_type,name,url,role='admin',mobile=False):
 f=Fixture(role);kwargs={'headless':True}
 if name=='chromium' and os.path.exists('/usr/bin/chromium'):kwargs['executable_path']='/usr/bin/chromium'
 browser=browser_type.launch(**kwargs);ctx=browser.new_context(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 900},timezone_id='Asia/Kuwait',accept_downloads=True)
 ctx.route('**/*',f.route);page=ctx.new_page();errors=[];alerts=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:(alerts.append(d.message),d.accept()));page.set_default_timeout(6000)
 if os.environ.get('CI'):page.goto(url)
 else:
  page.evaluate("if(!crypto.randomUUID)crypto.randomUUID=()=> '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));")
  page.evaluate("for(const name of ['localStorage','sessionStorage']){const store={};Object.defineProperty(window,name,{value:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]},configurable:true});}")
  page.set_content((ROOT/'index.html').read_text().replace('<head>','<head><base href="https://qa-fixture.invalid/">'),wait_until='domcontentloaded')
 page.wait_for_function('window.PAW_FINANCE_READY === true || window.PAW_FINANCE_BOOT_ERROR',timeout=25000)
 assert not page.evaluate('window.PAW_FINANCE_BOOT_ERROR'),page.evaluate('window.PAW_FINANCE_BOOT_ERROR')
 for key,value in [('Total','135.000'),('Share','17.000'),('ProviderShare','118.000')]:expect(page.locator('#finDash'+key)).to_contain_text(value)
 assert page.locator('#kCustomers').inner_text()=='1'
 if role not in ['admin','operations']:
  page.evaluate("showPage('followups')");assert page.locator('#followupFinanceList .btn.primary').count()==0
  page.evaluate("pawFinanceOpen('1','main')");assert page.locator('#financeActionModal').count()==0
  assert not any(n=='test_finance_action' for n,_ in f.calls)
 else:
  page.evaluate("showPage('followups');pawFinanceOpen('1','transport')")
  page.select_option('#finConfirmPaid','yes');page.select_option('#finRecipient','provider');page.click('#financeActionSave')
  expect(page.locator('#finDashOurs')).to_contain_text('2.000')
  page.evaluate("pawFinanceOpen('1','main')");page.click('#financeActionSave');expect(page.locator('#finDashTheirs')).to_contain_text('0.000')
  page.evaluate("pawFinanceOpen('1','transport')");page.click('#financeActionSave');expect(page.locator('#finDashOurs')).to_contain_text('0.000')
  page.evaluate("pawFinanceOpen('2','main')");page.select_option('#finRecipient','pawapp');page.click('#financeActionSave');expect(page.locator('#finDashTheirs')).to_contain_text('20.000')
  page.evaluate("pawFinanceOpen('2','main')");page.click('#financeActionSave');expect(page.locator('#finDashTheirs')).to_contain_text('0.000')
  page.evaluate("openProviderCRM('p2')");expect(page.locator('#pdSales')).to_contain_text('10.000');expect(page.locator('#finProviderShare')).to_contain_text('8.000')
  with page.expect_download() as dl:page.click('#pdExportBtn')
  rows=list(csv.reader(io.StringIO(pathlib.Path(dl.value.path()).read_text(encoding='utf-8-sig'))))
  assert all(len(r)==len(rows[0]) for r in rows),rows
  assert 'Date' in rows[0] and rows[-1][-1]=='CHECKED',rows
  assert rows[-1][rows[0].index('Total KD')]=='10.000'
  page.evaluate("showPage('followups');completeAppointmentFollowup('1')");page.wait_for_timeout(200)
  assert page.locator('#followupAppointmentList button').count()==0
  page.evaluate("openCaseDetails('1')");assert page.input_value('#eFinPickup')=='Home';assert page.input_value('#eFinTransportAt')=='2026-10-02T12:00'
  page.evaluate("closeModal('completeCaseModal');openNewCase()")
  page.fill('#cClient','QA New');page.fill('#cPhone','55550001');page.select_option('#cPetType',index=1);page.select_option('#cStaff','e1');page.select_option('#cProvider','p1');page.select_option('#cService','Exam');page.fill('#cLocation','New place');page.fill('#cAmount','20');page.select_option('#cFeeType','fixed');page.fill('#cCommission','5')
  page.select_option('#cTransportNeeded','yes');page.select_option('#cTransportProvider','p2');page.select_option('#cTransportDirection','both');page.fill('#cTransportTotal','10');page.select_option('#cFinTransportFeeType','percent');page.fill('#cTransportPaw','10');page.fill('#cPickupLocation','New Home');page.fill('#cDropoffLocation','New Clinic')
  page.evaluate('calcCase();calcTransportAddon()');expect(page.locator('#financeGrandTotal')).to_contain_text('35.000')
  page.evaluate('saveCase()');page.wait_for_function("document.getElementById('kOps').textContent==='3'")
  expect(page.locator('#finDashTotal')).to_contain_text('170.000');expect(page.locator('#finDashShare')).to_contain_text('23.000');assert page.locator('#kCustomers').inner_text()=='2'
  page.evaluate("showPage('dashboard')");page.wait_for_timeout(1800)
  (ROOT/'tests/results').mkdir(exist_ok=True);page.screenshot(path=str(ROOT/'tests/results'/(f'{name}-{role}-'+('mobile.png' if mobile else 'desktop.png'))))
 assert not errors,errors
 browser.close();return {'browser':name,'role':role,'mobile':mobile,'status':'PASS','rpc_calls':len(f.calls)}
if __name__=='__main__':
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_address[1]}/index.html';out=[]
 with sync_playwright() as p:
  for name in os.environ.get('BROWSERS','chromium').split(','):
   for role,mobile in [('admin',True),('operations',False),('accountant',True),('read_only',False)]:out.append(run(getattr(p,name),name,url,role,mobile));print(out[-1],flush=True)
 server.shutdown();(ROOT/'tests/results').mkdir(exist_ok=True);(ROOT/'tests/results/browser-results.json').write_text(json.dumps(out,indent=2))
