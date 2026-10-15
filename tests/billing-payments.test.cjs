/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS VM harness tests the server modules without live providers. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

function fixture(options = {}) {
  const now = Math.floor(Date.now()/1000);
  const metadata = { ...options.metadata };
  const calls = [];
  const subscription = { id:'sub_fixture',plan_id:'plan_current',status:'active',paid_count:1,
    current_start:now-100,current_end:now+2500000,notes:{clerk_user_id:'user_fixture'},...options.subscription };
  const clerk = { users: {
    getUser: async () => ({ privateMetadata:metadata,primaryEmailAddress:{emailAddress:'test@example.com'} }),
    updateUserMetadata: async (id,data) => { Object.assign(metadata,data.privateMetadata); calls.push({type:'metadata',data}); },
  }};
  const cache = {};
  const mockFetch = async (url,init={}) => {
    calls.push({type:'fetch',url,body:init.body&&JSON.parse(init.body),method:init.method||'GET'});
    if(url.endsWith('/cancel')) return {ok:!options.cancelFailure,json:async()=>subscription};
    if(url.includes('/v1/subscriptions/')) return {ok:true,json:async()=>subscription};
    if(url.endsWith('/webhook/billing-update')) return {ok:!options.backendFailure,status:options.backendFailure?401:200,
      json:async()=>({success:true,ignored:!!options.ignored})};
    if(url.includes('/v1/plans/'))return{ok:true,json:async()=>({period:'monthly',interval:1,item:{currency:'INR',amount:79900}})};
    if(url.endsWith('/v1/subscriptions'))return{ok:true,json:async()=>({id:'sub_new'})};
    throw Error('Unexpected network call: '+url);
  };
  function load(path) {
    if(cache[path])return cache[path];
    const exports={};cache[path]=exports;
    const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const context={exports,Buffer,AbortSignal,URL,console:{error:()=>{}},process:{env:{
      AXON_API_URL:'https://backend.example',AXON_SIGNUP_SECRET:'test_signup',RAZORPAY_KEY_ID:'test_key',
      RAZORPAY_KEY_SECRET:'test_secret',RAZORPAY_PLAN_ID:'plan_current',RAZORPAY_WEBHOOK_SECRET:'test_webhook'}},fetch:mockFetch,
      require(name){
        if(name==='next/server')return{NextResponse:{json:(body,opts)=>({body,status:opts?.status||200})}};
        if(name==='@clerk/nextjs/server')return{auth:async()=>({userId:options.signedOut?null:'user_fixture'}),clerkClient:async()=>clerk};
        if(name==='@/lib/axon')return load('lib/axon.ts');
        if(name==='@/lib/razorpay')return load('lib/razorpay.ts');
        if(name==='@/lib/plans')return load('lib/plans.ts');
        return require(name);
      }};
    vm.runInNewContext(source,context,{filename:path});return exports;
  }
  const post=async(body={})=>load('app/webhook/razorpay-verify/route.ts').POST({json:async()=>body});
  return {post,load,calls,metadata,subscription,now};
}

test('signed checkout forwards trusted billing dates and upgrades only after n8n succeeds',async()=>{
  const f=fixture();const signature=crypto.createHmac('sha256','test_secret').update('pay_fixture|sub_fixture').digest('hex');
  const result=await f.post({razorpay_subscription_id:'sub_fixture',razorpay_payment_id:'pay_fixture',razorpay_signature:signature});
  assert.equal(result.body.success,true);
  const index=f.calls.findIndex(c=>c.url?.endsWith('/webhook/billing-update'));
  assert.equal(f.calls[index].body.period_start,f.subscription.current_start);
  assert.equal(f.calls[index].body.period_end,f.subscription.current_end);
  assert.equal(f.calls[index].body.request_limit,5000);
  assert.equal(typeof f.calls[index].body.occurred_at,'number');
  assert(f.calls.findIndex(c=>c.data?.privateMetadata.axonPlan==='pro')>index);
});
test('n8n rejection retains pending subscription and never marks account Pro',async()=>{
  const f=fixture({backendFailure:true});const result=await f.post({subscriptionId:'sub_fixture'});
  assert.equal(result.status,503);assert.equal(result.body.code,'BILLING_SYNC_PENDING');
  assert.equal(f.metadata.axonPlan,undefined);assert.equal(f.metadata.razorpayPendingSubscriptionId,'sub_fixture');
});
test('activation retry uses saved subscription without creating a payment',async()=>{
  const f=fixture({metadata:{razorpayPendingSubscriptionId:'sub_fixture'}});const result=await f.post();
  assert.equal(result.body.success,true);assert.equal(f.metadata.razorpaySubscriptionId,'sub_fixture');
  assert(!f.calls.some(c=>c.method==='POST'&&c.url?.includes('api.razorpay.com')));
});
test('reject another user subscription without changing billing',async()=>{
  const f=fixture({subscription:{notes:{clerk_user_id:'someone_else'}}});const result=await f.post({subscriptionId:'sub_fixture'});
  assert.equal(result.status,403);assert(!f.calls.some(c=>c.url?.endsWith('/webhook/billing-update')));
});
test('invalid signature cannot activate an owned subscription',async()=>{
  const f=fixture();const result=await f.post({razorpay_subscription_id:'sub_fixture',razorpay_payment_id:'pay_fixture',razorpay_signature:'0'.repeat(64)});
  assert.equal(result.status,400);assert.equal(result.body.code,'SIGNATURE_INVALID');assert.equal(f.metadata.axonPlan,undefined);
});
for(const [label,subscription] of [['unpaid',{paid_count:0}],['inactive',{status:'authenticated'}],['missing dates',{current_start:null,current_end:null}],['legacy plan',{plan_id:'plan_legacy'}]]){
  test(label+' never grants new Pro quota',async()=>{
    const f=fixture({subscription});const result=await f.post({subscriptionId:'sub_fixture'});
    assert.equal(result.status,503);assert.equal(f.metadata.axonPlan,undefined);
  });
}
test('ignored backend update is pending, not a false success',async()=>{
  const f=fixture({ignored:true});const result=await f.post({subscriptionId:'sub_fixture'});
  assert.equal(result.status,202);assert.equal(result.body.success,undefined);assert.equal(f.metadata.axonPlan,undefined);
});
test('existing paid subscription prevents another checkout',async()=>{
  const f=fixture({metadata:{razorpayPendingSubscriptionId:'sub_fixture'}});
  const result=await f.load('app/webhook/razorpay-subscribe/route.ts').POST();
  assert.equal(result.status,409);assert.equal(result.body.code,'SUBSCRIPTION_EXISTS');
  assert(!f.calls.some(c=>c.method==='POST'&&c.url?.includes('api.razorpay.com')));
});
test('missing recovery ID asks for subscription reference without charging',async()=>{
  const f=fixture();const result=await f.post();assert.equal(result.status,400);assert.equal(result.body.code,'SUBSCRIPTION_REQUIRED');
  assert.equal(f.calls.length,0);
});

async function webhook(f,event,valid=true) {
  const raw=JSON.stringify({event,created_at:f.now,payload:{subscription:{entity:{id:'sub_fixture',notes:{clerk_user_id:'user_fixture'}}}}});
  const signature=valid?crypto.createHmac('sha256','test_webhook').update(raw).digest('hex'):'invalid';
  return f.load('app/webhook/razorpay/route.ts').POST({text:async()=>raw,headers:{get:()=>signature}});
}
test('signed renewal syncs billing dates and saves the recoverable subscription',async()=>{
  const f=fixture();const result=await webhook(f,'subscription.charged');assert.equal(result.status,200);
  assert.equal(f.metadata.razorpaySubscriptionId,'sub_fixture');
  assert.equal(f.calls.find(c=>c.url?.endsWith('/webhook/billing-update')).body.period_start,f.subscription.current_start);
});
test('delayed cancellation uses current active provider state',async()=>{
  const f=fixture();await webhook(f,'subscription.cancelled');
  assert.equal(f.calls.find(c=>c.url?.endsWith('/webhook/billing-update')).body.plan,'pro');
});
test('cancellation of a different subscription cannot downgrade the current one',async()=>{
  const f=fixture({metadata:{razorpaySubscriptionId:'sub_newer'},subscription:{status:'cancelled'}});await webhook(f,'subscription.cancelled');
  assert(!f.calls.some(c=>c.url?.endsWith('/webhook/billing-update')));
});
test('unsigned webhook makes no provider or backend requests',async()=>{
  const f=fixture();const result=await webhook(f,'subscription.charged',false);assert.equal(result.status,401);assert.equal(f.calls.length,0);
});

const cancel = (f, body={subscriptionId:'sub_fixture',confirmed:true}) => f.load('app/webhook/razorpay-cancel/route.ts').POST({json:async()=>body});
test('cancellation requires sign-in and explicit confirmation',async()=>{
  const signedOut=fixture({signedOut:true});assert.equal((await cancel(signedOut)).status,401);assert.equal(signedOut.calls.length,0);
  const f=fixture();assert.equal((await cancel(f,{subscriptionId:'sub_fixture'})).status,400);assert.equal(f.calls.length,0);
});
test('cancel renewal uses end-of-cycle and preserves paid entitlement',async()=>{
  const f=fixture({metadata:{axonPlan:'pro',razorpaySubscriptionId:'sub_fixture'}});const result=await cancel(f);
  assert.equal(result.body.success,true);assert.equal(result.body.effectiveAt,f.subscription.current_end);
  const request=f.calls.find(c=>c.url?.endsWith('/cancel'));assert.equal(request.method,'POST');assert.equal(request.body.cancel_at_cycle_end,true);
  assert.equal(f.metadata.axonPlan,'pro');assert(!f.calls.some(c=>c.url?.endsWith('/webhook/billing-update')));
});
test('another user cannot cancel a subscription',async()=>{
  const f=fixture({subscription:{notes:{clerk_user_id:'someone_else'}}});const result=await cancel(f);assert.equal(result.status,403);
  assert(!f.calls.some(c=>c.url?.endsWith('/cancel')));
});
test('scheduled cancellation repeated does not send another cancellation',async()=>{
  const f=fixture();await cancel(f);await cancel(f);assert.equal(f.calls.filter(c=>c.url?.endsWith('/cancel')).length,1);
});
test('provider failure never reports cancellation success',async()=>{
  const f=fixture({cancelFailure:true});const result=await cancel(f);assert.equal(result.status,503);assert.equal(f.metadata.razorpayCancellation,undefined);
});
test('legacy paid subscriptions can also stop renewal',async()=>{
  const f=fixture({subscription:{plan_id:'plan_legacy'}});assert.equal((await cancel(f)).body.success,true);
});
test('already cancelled subscription returns without another provider mutation',async()=>{
  const f=fixture({subscription:{status:'cancelled'}});const result=await cancel(f);assert.equal(result.body.alreadyCancelled,true);assert(!f.calls.some(c=>c.url?.endsWith('/cancel')));
});
test('scheduled cancellation remains visible after a page reload',async()=>{
  const f=fixture({metadata:{razorpaySubscriptionId:'sub_fixture'}});await cancel(f);
  const result=await f.load('app/webhook/subscription/route.ts').GET({url:'https://axon.example/webhook/subscription'});
  assert.equal(result.body.subscription.cancellationScheduled,true);assert.equal(result.body.subscription.canCancel,false);
});
