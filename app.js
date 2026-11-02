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
