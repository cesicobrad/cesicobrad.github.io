/* Shared shape and projection for the interactive form and its static fallback. */
(function () {
  const TAU = Math.PI * 2;
  function surface(phi, theta) {
    const radius = 1 + .12 * Math.sin(3 * theta + .5) * Math.sin(phi) ** 2 + .06 * Math.cos(3 * phi);
    const twist = theta + .3 * Math.cos(phi);
    return [radius * Math.sin(phi) * Math.cos(twist) * .97, radius * Math.cos(phi) * 1.13, radius * Math.sin(phi) * Math.sin(twist) * .82];
  }
  function lines(yaw = -.55, pitch = .22) {
    const transform = ([x,y,z]) => {
      const a=x*Math.cos(yaw)+z*Math.sin(yaw), b=-x*Math.sin(yaw)+z*Math.cos(yaw);
      const c=y*Math.cos(pitch)-b*Math.sin(pitch), depth=y*Math.sin(pitch)+b*Math.cos(pitch);
      const scale=.34/(1+depth*.12);
      return [.5+a*scale,.5+c*scale,depth];
    };
    const result=[];
    for(let latitude=1;latitude<19;latitude++) {
      result.push(Array.from({length:121},(_,i)=>transform(surface(latitude/19*Math.PI,i/120*TAU))));
    }
    for(let longitude=0;longitude<24;longitude++) {
      result.push(Array.from({length:81},(_,i)=>transform(surface(i/80*Math.PI,longitude/24*TAU))));
    }
    return result;
  }
  if(typeof module!=='undefined' && module.exports){module.exports={lines};return;}
  const canvas=document.getElementById('form');if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'), touchy=matchMedia('(pointer:coarse)');
  let yaw=-.55,pitch=.22,drag=false,lastX=0,lastY=0,pending=0,touched=false,visible=false,spin=0;
  function draw(){pending=0;const size=canvas.clientWidth;if(!size||reduced.matches)return;
    const density=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(size*density);canvas.height=Math.round(size*density);ctx.setTransform(density,0,0,density,0,0);
    const colors=getComputedStyle(document.documentElement),blue=colors.getPropertyValue('--wire').trim(),red=colors.getPropertyValue('--red').trim();
    const paths=lines(yaw,pitch);
    for(const [color,offset,alpha] of [[red,3.5,.49],[blue,0,.83]]){
      ctx.strokeStyle=color;ctx.lineWidth=.95;
      for(const path of paths){for(let i=1;i<path.length;i++){
        const a=path[i-1],b=path[i];ctx.globalAlpha=alpha*((a[2]+b[2])/2>0?.32:1);
        ctx.beginPath();ctx.moveTo(a[0]*size+offset,a[1]*size+offset*.6);ctx.lineTo(b[0]*size+offset,b[1]*size+offset*.6);ctx.stroke();
      }}
    }
    ctx.globalAlpha=1;canvas.classList.add('ready');
  }
  function schedule(){if(!pending)pending=requestAnimationFrame(draw);}
  canvas.addEventListener('pointerdown',e=>{touched=true;drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
  // On touch, only sideways swipes turn the form; touch-action:pan-y leaves vertical swipes to page scrolling.
  canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-lastX)*.009;if(e.pointerType!=='touch')pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-lastY)*.009));lastX=e.clientX;lastY=e.clientY;schedule();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=false);
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home'){yaw=-.55;pitch=.22;}else{yaw+=(e.key==='ArrowRight'?.12:e.key==='ArrowLeft'?-.12:0);pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.key==='ArrowDown'?.12:e.key==='ArrowUp'?-.12:0)));}schedule();});
  new ResizeObserver(schedule).observe(canvas);new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  for(const query of [reduced,matchMedia('(prefers-color-scheme:dark)')])query.addEventListener('change',schedule);
  // On touch screens nobody hovers or drags by accident, so turn slowly while visible until the first touch.
  function idle(){spin=0;if(!visible||touched||reduced.matches||!touchy.matches)return;yaw+=.006;draw();spin=requestAnimationFrame(idle);}
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible&&!spin)idle();}).observe(canvas);
  draw();
})();
