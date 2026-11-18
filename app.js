'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const duration = MOTION.duration;
  const timeline = window.__timelines.memories;
  const holes = [[548,185,-12],[745,190,15],[935,280,40],[1055,445,65],[1100,650,91],[1045,840,115],[922,1007,139],[727,1090,166],[528,1085,193],[335,985,218],[215,825,244],[175,625,270],[225,425,297],[355,270,322]];
  let photos = structuredClone(DEFAULT_PROJECT.photos).map(p => ({...p, position:50}));
  let selected = 0, time = 0, playing = false, origin = 0, frame = 0;
  let db = null, saveTimer, exporting = false, cancelExport = null;
  let audioContext, audioSource;
  const audio = $('soundtrack');
  for (const [id,src] of Object.entries(SCENE_ASSETS)) $(id).src=src;
  audio.src = DEFAULT_PROJECT.music;
  audio.loop = true;
  audio.volume = DEFAULT_PROJECT.volume;
  const status = message => { $('status').textContent = message; };

  // The scale must contain the evaluated number, never a literal JS expression.
  function resizePreview() {
    const scale = Math.min($('stage').clientWidth / 960, $('stage').clientHeight / 720);
    $('root').style.transform = `scale(${scale})`;
  }
  new ResizeObserver(resizePreview).observe($('stage'));

  function render(t) {
    time = Math.max(0, Math.min(duration, t));
    timeline.seek(time);
    $('stars').style.opacity = time < 2 ? 1 : 0;
    const k = Math.max(0, MOTION.cuts.filter(c => c <= time).length - 1);
    for (const [id, p] of [['left', photos[k % 14]], ['right', photos[(k + 7) % 14]]]) {
      const el = $(id);
      if (el.getAttribute('src') !== p.src) el.src = p.src;
      el.style.objectPosition = '50% 50%';
      el.style.opacity = time >= 2 ? 1 : 0;
      const shift = 14 * (1 - Math.min(1, Math.max(0, (time - MOTION.cuts[k]) / .22))) ** 3;
      el.style.transform = `translateY(${id === 'left' ? shift : -shift}px)`;
    }
    $('seek').value = time;
    $('time').textContent = `00:${String(Math.floor(time)).padStart(2,'0')} / 00:22`;
  }
  function pause() {
    playing = false;
    cancelAnimationFrame(frame);
    audio.pause();
    $('play').textContent = '▶ 播放';
  }
  function syncAudio() {
    if (Number.isFinite(audio.duration) && audio.duration > 0) audio.currentTime = time % audio.duration;
  }
  function tick(now) {
    if (!playing) return;
    render((now - origin) / 1000);
    if (time >= duration) return pause();
    frame = requestAnimationFrame(tick);
  }
  function play() {
    if (exporting) return;
    if (time >= duration) render(0);
    syncAudio();
    audioContext?.resume();
    playing = true;
    origin = performance.now() - time * 1000;
    $('play').textContent = 'Ⅱ 暂停';
    audio.play().catch(() => status('配乐播放失败，请使用 Chrome 或 Edge 重试。'));
    frame = requestAnimationFrame(tick);
  }
  function changed() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!db) return status('照片已替换；当前浏览器无法自动保存。');
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').put({version:2, photos}, 'draft');
      tx.oncomplete = () => status('照片已自动保存在此浏览器 · 可以导出视频了');
      tx.onerror = () => status('照片已替换；浏览器存储空间不足，无法自动保存。');
    }, 400);
  }
  function refresh() {
    $('photos').replaceChildren();
    $('ring').replaceChildren();
    photos.forEach((p, i) => {
      const card = document.createElement('button');
      card.className = 'photo-card';
      card.title = `替换第 ${i + 1} 张照片`;
      const img = new Image(); img.src = p.src; img.alt = p.name;
      const name = document.createElement('span'); name.textContent = `${String(i + 1).padStart(2,'0')} · ${p.name}`;
      card.append(img, name);
      card.onclick = () => {
        if (exporting) return;
        pause(); selected = i;
        document.querySelectorAll('.photo-card').forEach((el, k) => el.classList.toggle('selected', k === i));
        render(MOTION.cuts[i] + .25);
        $('single').click();
      };
      $('photos').append(card);
      const ringImg = new Image(); ringImg.src = p.src; ringImg.alt = '';
      const [x, y, angle] = holes[i];
      ringImg.style.cssText = `left:${(x-98)/1280*490}px;top:${(y-105)/1280*490}px;transform:rotate(${angle}deg);object-position:50% 50%`;
      $('ring').append(ringImg);
    });
    render(time);
  }
  function readData(file) {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }
  async function photoFile(file) {
    if (!file.type.startsWith('image/')) throw Error('请选择图片文件');
    if (file.size > 30 * 1024 * 1024) throw Error('单张图片请小于 30 MB');
    const image = new Image(); image.src = await readData(file);
    await image.decode().catch(() => { throw Error('无法读取图片，请使用 JPG、PNG 或 WebP'); });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {name:file.name, src:canvas.toDataURL('image/jpeg', .9), position:50};
  }
  async function guard(fn) { try { await fn(); } catch (error) { status(error.message || '操作失败，请重试'); } }
  $('single').onchange = e => guard(async () => {
    const file = e.target.files[0], index = selected; e.target.value = '';
    if (!file || exporting) return;
    photos[index] = await photoFile(file); refresh(); changed();
  });
  $('batch').onchange = e => guard(async () => {
    const files = Array.from(e.target.files); e.target.value = '';
    if (!files.length || exporting) return;
    pause();
    const imported = await Promise.all(files.slice(0,14).map(photoFile));
    imported.forEach((p,i) => { photos[i] = p; });
    refresh(); render(2.3); changed();
    status(`已替换 ${imported.length} 张照片${files.length > 14 ? '（仅取前 14 张）' : ''}`);
  });
  $('play').onclick = () => playing ? pause() : play();
  $('restart').onclick = () => { if (!exporting) { pause(); render(0); syncAudio(); } };
  $('seek').oninput = () => { if (!exporting) { pause(); render(Number($('seek').value)); syncAudio(); } };

  // Canvas export uses the same sampled timeline and CSS layout as the preview.
  function drawCover(ctx, img, width, height) {
    const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const sw = width / scale, sh = height / scale;
    ctx.drawImage(img, (img.naturalWidth-sw)/2, (img.naturalHeight-sh)/2, sw, sh, 0, 0, width, height);
  }
  function drawElement(ctx, el) {
    const style = getComputedStyle(el), opacity = Number(style.opacity);
    if (!opacity) return;
    ctx.save(); ctx.globalAlpha *= opacity;
    ctx.translate(el.offsetLeft, el.offsetTop);
    const [ox, oy] = style.transformOrigin.split(' ').map(parseFloat);
    ctx.translate(ox, oy);
    if (style.transform !== 'none') { const m = new DOMMatrix(style.transform); ctx.transform(m.a,m.b,m.c,m.d,m.e,m.f); }
    ctx.translate(-ox, -oy);
    if (el instanceof HTMLImageElement) {
      const radius = parseFloat(style.borderTopLeftRadius) || 0;
      ctx.beginPath(); ctx.roundRect(0,0,el.offsetWidth,el.offsetHeight,radius); ctx.clip();
      if (style.objectFit === 'cover') drawCover(ctx, el, el.offsetWidth, el.offsetHeight);
      else ctx.drawImage(el,0,0,el.offsetWidth,el.offsetHeight);
    } else if (el.id === 'title') {
      ctx.fillStyle = style.color; ctx.font = style.font; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      // DOM baseline measured with an inline probe, preserving the font's ascent.
      const baseline = $('headline').offsetHeight - fontDescent;
      ctx.fillText(DEFAULT_PROJECT.title, 480, baseline);
      ctx.fillStyle = '#ddd'; ctx.font = '10px Arial'; ctx.textAlign = 'left';
      ctx.fillText(DEFAULT_PROJECT.subtitle,535,48);
    } else if (el.id === 'stars') {
      ctx.fillStyle = '#201917'; ctx.fillRect(0,0,960,720);
      for (const star of el.children) drawElement(ctx,star);
    } else if (el.classList.contains('star')) {
      ctx.fillStyle = style.backgroundColor;
      const points = [[.5,0],[.61,.35],[.98,.35],[.68,.57],[.79,.91],[.5,.7],[.21,.91],[.32,.57],[.02,.35],[.39,.35]];
      ctx.beginPath(); points.forEach(([x,y],i) => ctx[i?'lineTo':'moveTo'](x*el.offsetWidth,y*el.offsetHeight)); ctx.closePath(); ctx.fill();
    } else {
      if (el.id === 'ring') {ctx.fillStyle='#14130b';ctx.beginPath();ctx.arc(245,245,245,0,Math.PI*2);ctx.fill();ctx.clip();}
      for (const child of el.children) drawElement(ctx,child);
    }
    ctx.restore();
  }
  let fontDescent = 0;
  function drawFrame(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,960,720);
    for (const id of ['stars','left','right','reel','viewer','title']) drawElement(ctx,$(id));
  }
  function setExporting(value) {
    exporting = value;
    for (const selector of ['#play','#restart','#seek','#batch','#single','.photo-card','#export']) {
      document.querySelectorAll(selector).forEach(el => {el.disabled = value;});
    }
    document.querySelector('label[for="batch"]').classList.toggle('disabled',value);
    $('cancelExport').hidden = !value;
  }
  $('cancelExport').onclick = () => cancelExport?.();
  $('export').onclick = () => guard(async () => {
    if (exporting) return;
    const mime = ['video/mp4;codecs=avc1.42001f,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(type => window.MediaRecorder?.isTypeSupported(type));
    if (!mime || !HTMLCanvasElement.prototype.captureStream) throw Error('此浏览器不支持视频导出，请使用新版 Chrome 或 Edge。');
    pause(); setExporting(true);
    let stream, recorder, destination, gain, cancelled = false, stopped = false, exportFrame = 0;
    const savedTime = time;
    cancelExport = () => {cancelled=true;stopped=true;cancelAnimationFrame(exportFrame);if(recorder && recorder.state!=='inactive')recorder.stop();status('已取消导出');};
    try {
      status('正在准备视频与固定配乐…');
      await Promise.all(Array.from(document.querySelectorAll('#root img')).map(img => img.decode()));
      // Preload every photo so switching slots never produces an empty export frame.
      await Promise.all(photos.map(async p => { const img = new Image(); img.src = p.src; await img.decode(); }));
      await document.fonts.ready;
      if (cancelled) return;
      const canvas = document.createElement('canvas'); canvas.width=960;canvas.height=720;
      const ctx = canvas.getContext('2d');
      ctx.font = getComputedStyle($('title')).font;
      const metrics = ctx.measureText('Mg'); fontDescent = metrics.fontBoundingBoxDescent || 20;
      audioContext ||= new AudioContext(); await audioContext.resume();
      if (!audioSource) {audioSource = audioContext.createMediaElementSource(audio);audioSource.connect(audioContext.destination);}
      destination = audioContext.createMediaStreamDestination();
      gain = audioContext.createGain(); gain.gain.value = DEFAULT_PROJECT.volume;
      audioSource.connect(gain); gain.connect(destination);
      stream = canvas.captureStream(30);
      destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      recorder = new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000,audioBitsPerSecond:192000});
      const chunks = [];
      recorder.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
      const finished = new Promise((resolve,reject) => {
        recorder.onstop = resolve;
        recorder.onerror = e => reject(e.error || Error('视频编码失败'));
      });
      render(0); drawFrame(ctx); syncAudio();
      await audio.play(); recorder.start(250);
      const start = performance.now();
      const step = now => {
        if(stopped) return;
        const elapsed = Math.min(duration,(now-start)/1000);
        render(elapsed);drawFrame(ctx);
        status(`正在导出 ${Math.round(elapsed/duration*100)}% · 请保持此页面在前台`);
        if(elapsed>=duration){stopped=true;recorder.stop();audio.pause();return;}
        exportFrame=requestAnimationFrame(step);
      };
      exportFrame=requestAnimationFrame(step);
      await finished;
      if(cancelled) { status('已取消导出'); return; }
      const blob=new Blob(chunks,{type:recorder.mimeType});
      if (!blob.size) throw Error('导出文件为空，请重试');
      const url=URL.createObjectURL(blob), link=document.createElement('a');
      const check=document.createElement('video');check.preload='metadata';check.src=url;
      await new Promise((resolve,reject)=>{check.onloadedmetadata=()=>check.videoWidth===960 && check.videoHeight===720?resolve():reject(Error('视频画面编码失败，请使用新版 Chrome 或 Edge 重试'));check.onerror=()=>reject(Error('视频文件无法解码，请重试'));});
      check.removeAttribute('src');check.load();
      const extension=recorder.mimeType.includes('mp4')?'mp4':'webm';
      link.href=url;link.download=`memories.${extension}`;link.click();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      status(`视频已导出 · 960 × 720 · ${extension.toUpperCase()} · 含固定配乐`);
    } finally {
      stopped=true; cancelAnimationFrame(exportFrame);
      if(recorder && recorder.state!=='inactive') recorder.stop();
      audio.pause();stream?.getTracks().forEach(track=>track.stop());
      if(gain) {audioSource.disconnect(gain);gain.disconnect();}
      destination?.disconnect();cancelExport=null;setExporting(false);render(savedTime);syncAudio();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (exporting) {cancelExport?.();} else pause();
  });
  document.addEventListener('keydown', e => {
    if(e.code==='Space' && !exporting && !['INPUT','TEXTAREA','BUTTON','A'].includes(e.target.tagName)) {e.preventDefault();playing?pause():play();}
  });
  refresh();resizePreview();$('play').disabled=false;status('替换照片，预览后即可导出视频');
  try {
    const request=indexedDB.open('memories-studio',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('projects');
    request.onsuccess=()=>{
      db=request.result;
      const get=db.transaction('projects').objectStore('projects').get('draft');
      get.onsuccess=()=>{
        if (!get.result || exporting) return;
        const draft=get.result.photos;
        if(Array.isArray(draft) && draft.length===14 && draft.every(p=>typeof p.name==='string' && /^data:image\/(png|jpeg|webp);base64,/.test(p.src))) {
          photos=draft.map(p=>({...p,position:50}));refresh();status('已恢复上次的照片 · 配乐固定');
        }
      };
    };
    request.onerror=()=>status('当前浏览器无法保存照片，仍可替换和导出视频');
  } catch {status('当前浏览器无法保存照片，仍可替换和导出视频');}
})();
