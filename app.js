(() => {
  const root=document.documentElement,button=document.querySelector('.theme-toggle');
  const modes=['auto','dark','light'];let mode='auto';
  try{const saved=localStorage.getItem('obrad-appearance');if(modes.includes(saved))mode=saved;}catch{}
  function setTheme(){if(mode==='auto')delete root.dataset.theme;else root.dataset.theme=mode;
    const label=mode==='auto'?'Auto':mode==='dark'?'Dark':'Light';
    button.innerHTML=label+' <span aria-hidden="true">◐</span>';
    button.setAttribute('aria-label','Change appearance. Current setting: '+(mode==='auto'?'automatic':mode));
    const dark=mode==='dark'||(mode==='auto'&&matchMedia('(prefers-color-scheme:dark)').matches);
    document.querySelector('.sculpture img').src=dark?'form-dark.svg':'form.svg';
  }
  button.addEventListener('click',()=>{mode=modes[(modes.indexOf(mode)+1)%modes.length];try{localStorage.setItem('obrad-appearance',mode);}catch{}setTheme();});
  matchMedia('(prefers-color-scheme:dark)').addEventListener('change',setTheme);setTheme();
  function openFromHash(){const target=document.getElementById(location.hash.slice(1));if(target?.tagName==='DETAILS'){target.open=true;requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));}}
  addEventListener('hashchange',openFromHash);openFromHash();
  document.querySelectorAll('a[href^="#c-"]').forEach(link=>link.addEventListener('click',()=>{if(link.hash===location.hash)openFromHash();}));
  document.getElementById('year').textContent=new Date().getFullYear();
})();

(() => {
 const viewer=document.getElementById('screenshot-viewer');if(!viewer)return;
 const img=document.getElementById('viewer-image'),caption=document.getElementById('viewer-caption');
 document.querySelectorAll('[data-screenshot]').forEach(button=>button.addEventListener('click',()=>{
  img.src=button.dataset.screenshot;img.alt=button.querySelector('img').alt;caption.textContent=button.dataset.caption;viewer.showModal();
 }));
 viewer.addEventListener('click',event=>{if(event.target===viewer)viewer.close();});
})();

(() => {
 document.querySelectorAll('[data-gallery]').forEach(gallery=>{
  const shot=gallery.querySelector('[data-screenshot]'),image=shot.querySelector('img'),art=gallery.querySelector('.app-visual');
  gallery.querySelectorAll('[data-shot]').forEach(tab=>tab.addEventListener('click',()=>{
   shot.dataset.screenshot=tab.dataset.shot;shot.dataset.caption=tab.dataset.caption;
   shot.setAttribute('aria-label','Open full screenshot: '+tab.dataset.caption);
   image.src=tab.dataset.shot;image.alt=tab.dataset.alt;
   art.classList.remove('top','bottom','center');art.classList.add(tab.dataset.position);
   gallery.querySelectorAll('[data-shot]').forEach(item=>{const active=item===tab;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});
  }));
 });
})();
