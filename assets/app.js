(() => {
  'use strict';
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motion = !reducedMotion.matches;
  const motionButton = document.getElementById('motion-toggle');
  const applyMotion = () => {
    root.classList.toggle('js-motion', motion);
    root.classList.toggle('no-motion', !motion);
    motionButton.textContent = motion ? 'Motion on' : 'Motion off';
    motionButton.setAttribute('aria-pressed', String(motion));
  };
  applyMotion();
  motionButton.addEventListener('click', () => { motion = !motion; applyMotion(); updateScroll(); });
  reducedMotion.addEventListener('change', event => { motion = !event.matches; applyMotion(); updateScroll(); });
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => { if(entry.isIntersecting){ entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); } });
  }, { threshold: 0.09 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
  function updateScroll(){window.dispatchEvent(new CustomEvent('portfolio-motion',{detail:{enabled:motion}}));}
  const daylight=document.getElementById('daylight');
  daylight.addEventListener('input',()=>{const label=Number(daylight.value)<50?'Daylight':'Dusk';document.getElementById('daylight-label').textContent=label;daylight.setAttribute('aria-valuetext',label);});
  const photoDialog=document.getElementById('photo-dialog');
  const photoImage=document.getElementById('photo-dialog-image');
  let photoOpener=null;
  function openPhoto(photo,opener){
    photoOpener=opener;photoImage.src=photo.url;photoImage.alt=photo.caption;
    document.getElementById('photo-dialog-caption').textContent=photo.caption;
    document.getElementById('photo-dialog-category').textContent=categoryName(photo.category);
    photoDialog.showModal();document.body.classList.add('photo-modal-open');
    if(motion)photoDialog.animate([{opacity:0,transform:'translateY(18px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:250,easing:'ease-out'});
  }
  document.getElementById('photo-dialog-close').addEventListener('click',()=>photoDialog.close());
  photoDialog.addEventListener('click',event=>{if(event.target===photoDialog){const r=photoDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)photoDialog.close();}});
  photoDialog.addEventListener('close',()=>{document.body.classList.remove('photo-modal-open');photoImage.removeAttribute('src');photoOpener?.focus({preventScroll:true});});
  let photoCollection=[],canEdit=false,photoFilter='hiking';
  const gallery=document.getElementById('gallery');
  const galleryStatus=document.getElementById('gallery-status');
  const categoryName=value=>({hiking:'Hiking',cooking:'Cooking',travel:'Travel'})[value]||'Photos';
  async function api(path,options={}) {
    const response=await fetch(path,{credentials:'same-origin',...options});
    let result;
    try {result=await response.json();} catch {throw new Error('The photo service is unavailable. Please try again.');}
    if(!response.ok) throw new Error(result.error||'Could not save your changes. Please try again.');
    return result;
  }
  function drawGallery() {
    gallery.replaceChildren();
    const photos=photoCollection.filter(photo=>photo.category===photoFilter);
    if(!photos.length){
      const categories=[photoFilter];
      categories.forEach((category,index)=>{
        const empty=document.createElement('div');empty.className='photo-empty';
        const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');
        const heading=document.createElement('h3');heading.textContent=categoryName(category);
        const message=document.createElement('p');message.textContent=canEdit?'Add a photo below.':'Photos coming soon.';
        empty.append(number,heading,message);gallery.append(empty);
      });
    }
    photos.forEach(photo=>{
      const figure=document.createElement('figure');figure.className='photo-card';
      const link=document.createElement('button');link.type='button';link.className='photo-open';link.setAttribute('aria-haspopup','dialog');link.setAttribute('aria-label','Open photo: '+photo.caption);link.addEventListener('click',()=>openPhoto(photo,link));
      const img=document.createElement('img');img.src=photo.url;img.alt=photo.caption;img.loading='lazy';img.decoding='async';link.append(img);
      const caption=document.createElement('figcaption');
      const category=document.createElement('span');category.textContent=categoryName(photo.category);
      const text=document.createElement('p');text.textContent=photo.caption;caption.append(category,text);figure.append(link,caption);
      gallery.append(figure);
    });
    galleryStatus.textContent=photoCollection.length ? `${photos.length} photo${photos.length===1?'':'s'}` : canEdit?'Your photos will be saved to this portfolio.':'Photo collection coming soon.';
  }
  async function loadPhotos() {
    photoCollection=await api('./photos.json');
    drawGallery();
  }
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
    photoFilter=button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    drawGallery();
  }));
  loadPhotos().catch(error=>{
    galleryStatus.textContent=error.message+' ';
    const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';
    retry.addEventListener('click',()=>{loadPhotos().catch(err=>{galleryStatus.firstChild.textContent=err.message+' ';});});galleryStatus.append(retry);
  });
  const copyButton = document.getElementById('copy-email');
  copyButton.addEventListener('click', async () => {
    const status = document.getElementById('copy-status');
    try { await navigator.clipboard.writeText(document.querySelector('.email-link').textContent.trim()); status.textContent = 'Email copied.'; }
    catch { status.textContent = 'Email: '+document.querySelector('.email-link').textContent.trim(); }
    window.setTimeout(() => { status.textContent = ''; }, 4500);
  });
})();
