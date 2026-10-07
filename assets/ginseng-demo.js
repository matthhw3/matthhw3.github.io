import {createWorkflow} from './ginseng-engine.js';
import {report} from './ginseng-report.js';
const workflow=createWorkflow();const cart={tea:1,ticket:0};const prices={tea:12,ticket:18};let current=null,order=null;
const accepted=new Map();const held=new Set(),duplicates=new Set();let seeding=false;
const $=id=>document.getElementById(id),money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
const log=$('gm-log-list'),retry=$('gm-retry'),replay=$('gm-replay');
function drawCart(){for(const key of Object.keys(cart))$('gm-'+key+'-qty').textContent=cart[key];$('gm-cart-total').textContent=money(cart.tea*prices.tea+cart.ticket*prices.ticket);$('gm-run').disabled=cart.tea+cart.ticket===0;document.querySelectorAll('[data-qty]').forEach(button=>{const [key,delta]=button.dataset.qty.split(':');button.disabled=Number(delta)<0?cart[key]===0:cart[key]>=9;});}
document.querySelectorAll('[data-qty]').forEach(button=>button.addEventListener('click',()=>{const [key,delta]=button.dataset.qty.split(':');cart[key]=Math.max(0,Math.min(9,cart[key]+Number(delta)));drawCart();}));
function run(event){
 const result=workflow.run(event);log.querySelector('.gm-empty-log')?.remove();
 const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
 result.entries.forEach(entry=>{const row=document.createElement('li');row.className='gm-log-entry';const label=document.createElement('span');label.className='gm-log-state';label.dataset.state=entry.status;label.textContent=entry.status;const heading=document.createElement('strong');heading.textContent=entry.stage;const meta=document.createElement('small');meta.textContent=`${time} · ${event.eventId}`;const text=document.createElement('p');text.textContent=entry.message;row.append(label,heading,meta,text);log.prepend(row);});
 while(log.children.length>40)log.lastElementChild.remove();
 retry.hidden=result.state!=='held';replay.hidden=result.state==='held';$('gm-result').dataset.state=result.state;
 $('gm-result-title').textContent=result.state==='held'?'Order held':result.state==='skipped'?'Duplicate skipped':'Order added';
 $('gm-status').textContent=result.state==='held'?'Missing customer reference. Fix and retry; totals are unchanged.':result.state==='skipped'?'Already processed. Totals are unchanged.':`${money(order.total)} added. Replay to test duplicate detection.`;
 if(result.state==='held')held.add(event.eventId);
 if(result.state==='skipped')duplicates.add(event.eventId);
 if(result.state==='ready'){held.delete(event.eventId);accepted.set(event.eventId,{...order,customerId:event.customerId,refunds:event.refunds||{},items:{...event.items}});}
 renderDashboard();
 document.querySelectorAll('.gm-stages li').forEach((step,index)=>{step.classList.toggle('gm-step-ready',result.state!=='held'||index===0);step.classList.toggle('gm-step-held',result.state==='held'&&index===1);});
 if(result.state==='ready'&&!seeding){showView('dashboard',true);$('gm-dashboard-status').textContent='Order added. Report updated.';}
}
$('gm-run').addEventListener('click',()=>{if(cart.tea+cart.ticket===0)return;order={total:cart.tea*prices.tea+cart.ticket*prices.ticket,summary:[cart.tea?`${cart.tea} × tea gift box`:null,cart.ticket?`${cart.ticket} × museum visit`:null].filter(Boolean).join(' · ')};current={...workflow.event($('gm-inject-error').checked?'missing':'valid'),total:order.total,items:{...cart}};run(current);});
retry.addEventListener('click',()=>{if(current){current=workflow.fix(current);run(current);$('gm-inject-error').checked=false;}});
replay.addEventListener('click',()=>{if(current)run(current);});
drawCart();
const tabs=[...document.querySelectorAll('[data-view]')];
function showView(key,focus=false){tabs.forEach(tab=>{const active=tab.dataset.view===key;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$(tab.getAttribute('aria-controls')).hidden=!active;if(active&&focus)tab.focus({preventScroll:true});});if(key==='dashboard')renderDashboard();}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>showView(tab.dataset.view));tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();showView(tabs[next].dataset.view,true);});});
document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>showView(button.dataset.go,true)));
function renderDashboard(){
 const data=report([...accepted.entries()],$('gm-product-filter').value);
 $('bi-net').textContent=money(data.net);$('bi-gross').textContent=money(data.gross);$('bi-refunds').textContent=money(data.refunds);$('bi-returning').textContent=money(data.returningNet);
 $('bi-refund-rate').textContent=(data.refundRate*100).toFixed(1)+'% of gross sales';$('bi-returning-share').textContent=(data.returningShare*100).toFixed(1)+'% of net sales';
 $('gm-dashboard-status').textContent=`${data.rows.length} orders shown.`;
 const max=Math.max(1,...data.products.map(p=>p.gross));$('bi-bars').replaceChildren();
 data.products.forEach(p=>{const row=document.createElement('div');row.className='gm-bar-row';const label=document.createElement('div');label.textContent=p.name;const value=document.createElement('strong');value.textContent=money(p.net)+' net';label.append(value);const track=document.createElement('div');track.className='gm-bar-track gm-stacked';const net=document.createElement('div');net.style.width=p.net/max*100+'%';const refund=document.createElement('div');refund.className='gm-refund-bar';refund.style.width=p.refunds/max*100+'%';track.append(net,refund);const note=document.createElement('p');note.className='gm-bar-note';note.textContent=`${money(p.refunds)} refunded · ${(p.rate*100).toFixed(1)}% of gross sales`;row.append(label,track,note);$('bi-bars').append(row);});
 const highest=[...data.products].filter(p=>p.gross).sort((a,b)=>b.rate-a.rate)[0];$('bi-product-insight').textContent=highest?`${highest.name}: ${(highest.rate*100).toFixed(1)}% refunded. Review refund reasons.`:'Add an order to compare products.';
 $('bi-repeat-value').textContent=money(data.returningNet);$('bi-first-value').textContent=money(data.newNet);
 const share=data.returningShare,c=2*Math.PI*48;$('bi-customer').innerHTML=`<title>Net sales by purchase history</title><desc>Repeat purchases ${money(data.returningNet)}; first purchases ${money(data.newNet)}.</desc><circle cx="70" cy="70" r="48" fill="none" stroke="#d8e2ee" stroke-width="17"/><circle cx="70" cy="70" r="48" fill="none" stroke="#346dba" stroke-width="17" stroke-dasharray="${share*c} ${c}" transform="rotate(-90 70 70)"/><text x="70" y="72" text-anchor="middle" font-size="24" fill="#29415c">${(share*100).toFixed(0)}%</text><text x="70" y="90" text-anchor="middle" font-size="12" fill="#64748b">repeat</text>`;
 $('bi-quality').textContent=`${held.size} record${held.size===1?'':'s'} held for correction · ${duplicates.size} duplicate event${duplicates.size===1?'':'s'} excluded.`;
 $('bi-rows').replaceChildren();data.rows.slice(-8).reverse().forEach(o=>{const tr=document.createElement('tr');[o.label,money(o.gross),money(o.refunds),money(o.net)].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});$('bi-rows').append(tr);});
}
function seed(){
 seeding=true;workflow.reset();accepted.clear();held.clear();duplicates.clear();log.replaceChildren();$('gm-product-filter').value='all';cart.tea=1;cart.ticket=0;drawCart();$('gm-inject-error').checked=false;
 const examples=[['A',2,1,0,0],['B',0,2,0,18],['A',1,0,0,0],['C',3,0,12,0],['B',1,1,0,0],['D',0,1,0,0]];
 for(const [customer,tea,ticket,teaRefund,ticketRefund]of examples){order={total:tea*12+ticket*18,summary:'Example order'};current={...workflow.event('valid'),customerId:'demo-'+customer,items:{tea,ticket},refunds:{tea:teaRefund,ticket:ticketRefund},total:order.total};run(current);if(teaRefund||ticketRefund){const row=document.createElement('li');row.className='gm-log-entry';row.textContent=`Refund reconciled · ${money(teaRefund+ticketRefund)} linked to ${current.orderId}.`;log.prepend(row);}}
 run(current);order={total:12,summary:'Held example order'};current={...workflow.event('missing'),items:{tea:1,ticket:0},total:12};run(current);
 seeding=false;renderDashboard();$('gm-result-title').textContent='Try your own order';$('gm-status').textContent='Examples loaded. Add an order or fix the held record.';
}
$('gm-product-filter').addEventListener('change',renderDashboard);
$('gm-seed').addEventListener('click',()=>{seed();showView('dashboard');});
$('gm-reset').addEventListener('click',()=>{seed();showView('dashboard',true);});
seed();showView('dashboard');
