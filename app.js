// Shared by the design options: plays a video in a dialog when a [data-video] element is clicked.
(() => {
  const d = document.createElement('dialog');
  d.className = 'vplayer';
  d.innerHTML = '<button class="vclose" aria-label="Close video">Close ×</button><video controls playsinline></video>';
  document.body.appendChild(d);
  const v = d.querySelector('video');
  document.querySelectorAll('[data-video]').forEach((el) => el.addEventListener('click', () => {
    d.classList.toggle('tall', el.hasAttribute('data-tall'));
    v.src = el.dataset.video; d.showModal(); v.play().catch(() => {});
  }));
  d.querySelector('.vclose').addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => { v.pause(); v.removeAttribute('src'); v.load(); });
  const s = document.createElement('style');
  s.textContent = `.vplayer{margin:auto;border:0;padding:44px 12px 12px;background:#0b0c0f;border-radius:14px;width:min(94vw,1100px);max-height:96vh;overflow:hidden}
  .vplayer.tall{width:fit-content}.vplayer::backdrop{background:#000c}.vplayer video{display:block;width:100%;max-height:calc(96vh - 60px);margin:auto;border-radius:8px}
  .vplayer.tall video{width:auto;height:calc(92vh - 60px);max-width:100%}
  .vclose{position:absolute;top:9px;right:12px;border:0;background:#ffffff1a;color:#fff;font:500 13px system-ui,sans-serif;padding:6px 12px;border-radius:999px;cursor:pointer}
  @media(max-width:600px){.vplayer.tall video{height:auto;width:100%}}`;
  document.head.appendChild(s);
})();

// Work filters: show one kind of project at a time. Without JS everything is shown and the bar stays hidden.
(() => {
  const bar = document.querySelector('.filters');
  if (!bar) return;
  const items = [...document.querySelectorAll('#work [data-tags]')];
  const groups = [...document.querySelectorAll('#work .group')];
  const grid = document.querySelector('#work .demos');
  const has = (el, f) => el.dataset.tags.split(' ').includes(f);
  const buttons = [...bar.querySelectorAll('button')];
  buttons.forEach((b) => {
    const f = b.dataset.filter;
    const n = f === 'all' ? items.length : items.filter((i) => has(i, f)).length;
    b.insertAdjacentHTML('beforeend', `<span class="n">${n}</span>`);
    b.addEventListener('click', () => {
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      items.forEach((i) => { i.hidden = f !== 'all' && !has(i, f); });
      groups.forEach((g) => { g.hidden = !g.querySelector('[data-tags]:not([hidden])'); });
      grid.classList.toggle('filtered', f !== 'all');
    });
  });
  bar.hidden = false;
})();
