export function createWorkflow(){
 const processed=new Set();const reporting=new Map();let sequence=0;
 return {
  event(scenario){return {eventId:`demo-event-${++sequence}`,orderId:`demo-order-${sequence}`,customerId:scenario==='missing'?'':'demo-customer',occurredAt:scenario==='timestamp'?'invalid-date':new Date().toISOString()};},
  run(event){
   const entries=[{stage:'Source',status:'received',message:'Fictional website event received by the simulated ingestion step.'}];
   if(!event.customerId||!Number.isFinite(Date.parse(event.occurredAt))){const missing=!event.customerId;entries.push({stage:'Validation',status:'held',message:missing?'CUSTOMER_REFERENCE_MISSING — held for correction; reporting tables unchanged.':'INVALID_TIMESTAMP — held for correction; reporting tables unchanged.'});return {state:'held',entries};}
   if(processed.has(event.eventId)){entries.push({stage:'Deduplication',status:'skipped',message:'EVENT_ALREADY_PROCESSED — replay skipped; no duplicate record added.'});return {state:'skipped',entries};}
   entries.push({stage:'Validation',status:'passed',message:'Required fields and timestamp passed validation.'});
   processed.add(event.eventId);reporting.set(event.orderId,{...event});
   entries.push({stage:'Warehouse',status:'loaded',message:'Simulated MERGE applied the record by its order key.'},{stage:'Transform',status:'ready',message:'Simulated reporting model is ready for Power BI. No dashboard refresh is performed.'});
   return {state:'ready',entries};
  },
  fix(event){return {...event,customerId:event.customerId||'demo-customer',occurredAt:Number.isFinite(Date.parse(event.occurredAt))?event.occurredAt:new Date().toISOString()};},
  reset(){processed.clear();reporting.clear();sequence=0;},
  get size(){return reporting.size;}
 };
}
