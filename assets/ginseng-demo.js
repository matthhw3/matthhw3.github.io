import {createWorkflow, sampleHistory, nextBatch, sourceNames} from './ginseng-engine.js';
import {report} from './ginseng-report.js';
const $=id=>document.getElementById(id),root=document.querySelector('.gc');
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(cents/100);
const number=value=>value.toLocaleString('en-US');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let workflow,batch,ran=false,refunded=false,ledger=[];
const tabs=[...root.querySelectorAll('[data-gc-view]')];
function view(name,focus=false){
 for(const tab of tabs){const active=tab.dataset.gcView===name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$(tab.getAttribute('aria-controls')).hidden=!active;if(active&&focus)tab.focus({preventScroll:true});}
}
tabs.forEach((tab,index)=>{
 tab.addEventListener('click',()=>view(tab.dataset.gcView));
 tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();view(tabs[next].dataset.gcView,true);});
});
root.querySelectorAll('[data-gc-go]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.gcGo,true)));
const sources={
 shopify:{title:'Merchandise orders',file:'GET /orders.json',description:'Trim and standardize SKUs, join the product catalog, and retain the latest refund total for each order. Designs and sizes remain available for merchandise reporting.',fields:['id → source + order_id','sku → product + size','refund_total → refunded_cents'],payload:()=>JSON.stringify(batch[0],null,2)},
 ticketing:{title:'Event ticket sales',file:'ticket_sales_2026-11-07.csv',description:'Map booking IDs and ticket counts into the same order model as merchandise. Ticket revenue stays separate by source, while dates and campaign tags make combined reporting possible.',fields:['booking_id → source + order_id','ticket_count → quantity','utm_campaign → campaign'],payload:()=>['booking_id,created_at,ticket_count,refund_total,utm_campaign','T1083,2026-11-07T23:30:00Z,3,0,release_night'].join('\n')},
 instagram:{title:'Story links → website activity',file:'website_utm_daily.json',description:'Tagged Instagram story links carry a campaign name to the website. Aggregate link clicks and sessions by date and campaign, then match captured campaign tags on orders. This is an illustrative attribution model.',fields:['utm_campaign → campaign','session_date → reporting_date','sessions → tracked visits'],payload:()=>JSON.stringify(batch.find(row=>row.source==='instagram'),null,2)}
};
function source(name){const item=sources[name];root.querySelectorAll('[data-gc-source]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gcSource===name)));$('gc-source-title').textContent=item.title;$('gc-source-file').textContent=item.file;$('gc-payload').textContent=item.payload();$('gc-source-description').textContent=item.description;$('gc-mapping-fields').replaceChildren(...item.fields.map(text=>{const span=document.createElement('code');span.textContent=text;return span;}));}
root.querySelectorAll('[data-gc-source]').forEach(b=>b.addEventListener('click',()=>source(b.dataset.gcSource)));
root.querySelectorAll('[data-source-shortcut]').forEach(b=>b.addEventListener('click',()=>{source(b.dataset.sourceShortcut);view('sources',true);}));
function chart(data){
 const filter=$('gc-filter').value,ceiling=Math.ceil(Math.max(10000,...data.days.map(d=>d.shopify+d.ticketing))/10000)*10000;
 let svg='<title>Daily net revenue, November 1–7</title>';
 for(let i=0;i<=3;i++){const y=24+i*53,value=ceiling*(1-i/3);svg+=`<line x1="48" y1="${y}" x2="565" y2="${y}" stroke="#dfe5df" stroke-dasharray="3 5"/><text x="38" y="${y+4}" text-anchor="end" fill="#79847b" font-size="10">${Math.round(value/100)}</text>`;}
 data.days.forEach((day,i)=>{const x=68+i*71,a=day.shopify/ceiling*159,b=day.ticketing/ceiling*159;svg+=`<g><title>Nov ${day.day}: merchandise ${money(day.shopify)}, tickets ${money(day.ticketing)}</title><rect x="${x}" y="${183-a}" width="32" height="${a}" rx="2" fill="#265c48"/><rect x="${x}" y="${183-a-b}" width="32" height="${b}" rx="2" fill="#a8c2ab"/><text x="${x+16}" y="207" text-anchor="middle" fill="#79847b" font-size="11">0${day.day}</text></g>`;});
 svg+=`<text x="565" y="228" text-anchor="end" fill="#79847b" font-size="10">NOVEMBER · ${filter==='all'?'ALL SALES':filter.toUpperCase()}</text>`;$('gc-revenue-chart').innerHTML=svg;
}
function render(){
 const data=report(workflow,$('gc-filter').value);
 $('gc-net').textContent=money(data.net);$('gc-orders').textContent=number(data.rows.length);$('gc-units').textContent=number(data.units)+' items / tickets sold';$('gc-refunds').textContent=money(data.refund);$('gc-refund-rate').textContent=(data.gross?data.refund/data.gross*100:0).toFixed(1)+'% of gross sales';$('gc-sessions').textContent=number(data.sessions);
 for(const name of ['shopify','ticketing','instagram'])$('gc-'+name+'-count').textContent=[...(name==='instagram'?workflow.traffic:workflow.orders).values()].filter(r=>r.source===name).length+' rows';
 chart(data);
 const max=Math.max(1,...data.products.map(p=>p.net));
 $('gc-product-bars').innerHTML=[...data.products].sort((a,b)=>b.net-a.net).map(p=>`<div class="gc-product"><div><strong>${escape(p.name)}</strong><b>${money(p.net)}</b></div><small>${escape(p.variant)} <span>${p.units} sold</span></small><div class="gc-track"><span style="width:${p.net/max*100}%"></span></div></div>`).join('');
 $('gc-campaign-rows').innerHTML=data.campaigns.map((c,i)=>`<tr><td><i class="gc-campaign-dot" data-index="${i}"></i>${escape(c.campaign)}</td><td>${number(c.clicks)}</td><td>${number(c.sessions)}</td><td>${c.orders}</td><td>${(c.sessions?c.orders/c.sessions*100:0).toFixed(1)}%</td><td>${money(c.net)}</td></tr>`).join('');
 $('gc-valid').textContent=workflow.orders.size;$('gc-duplicates').textContent=workflow.duplicates;$('gc-held').textContent=workflow.held.size;$('gc-quality-count').textContent=workflow.held.size;$('gc-quality-count').dataset.warning=String(workflow.held.size>0);
 $('gc-run').disabled=ran;$('gc-replay').disabled=!ran;$('gc-refund').disabled=refunded;$('gc-repair').disabled=!workflow.held.size;
 $('gc-ledger').innerHTML=ledger.slice(0,16).map(e=>`<li><span class="gc-ledger-state" data-state="${e.state}">${e.state}</span><div><strong>${escape(e.id)}</strong><p>${escape(e.message)}</p></div></li>`).join('');
}
function ingest(records,label){
 const result=workflow.run(records);ledger.unshift(...result.entries.toReversed());
 $('gc-status').textContent=`${label}: ${result.loaded} loaded / updated · ${result.skipped} duplicates skipped · ${result.held} held. Report refreshed.`;
 $('gc-snapshot').textContent=label+' complete';render();return result;
}
$('gc-run').addEventListener('click',()=>{ran=true;ingest(batch,'Sample sync');});
$('gc-replay').addEventListener('click',()=>ingest(batch,'Batch replay'));
$('gc-refund').addEventListener('click',()=>{refunded=true;const original=sampleHistory().find(r=>r.source==='shopify');ingest([{...original,refund_total:4500,updated_at:'2026-11-08T09:00:00Z'}],'Late refund');});
$('gc-repair').addEventListener('click',()=>{const corrected=[...workflow.held.values()].map(({raw})=>({...raw,sku:'ARCHIVE-TEE-L',updated_at:'2026-11-08T10:00:00Z'}));ingest(corrected,'SKU correction');});
$('gc-filter').addEventListener('change',render);
function reset(){workflow=createWorkflow();workflow.run(sampleHistory());batch=nextBatch();ran=false;refunded=false;ledger=[{state:'ready',id:'Initial snapshot / 3 sources',message:'35 orders and 14 daily campaign records normalized. One $45 refund reconciled.'}];$('gc-filter').value='all';$('gc-status').textContent='Ready to sync. The overview already contains seven days of fictional data.';$('gc-snapshot').textContent='Sample data loaded';source('shopify');render();}
$('gc-reset').addEventListener('click',reset);reset();
