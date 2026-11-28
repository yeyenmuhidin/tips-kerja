/* Bikin Video di HP — semua proses di browser HP (tanpa server, tanpa AI).
   MP4: WebCodecs (H.264 + AAC) + mp4-muxer.  Cadangan: MediaRecorder (WebM/MP4). */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const FPS = 30;
  const MAX_TOTAL_WARN = 180; // detik

  const state = {
    items: [],            // klip: {id,type,name,file,...}
    music: null,          // {file,name,url,el}
    nextId: 1,
    t: 0,                 // posisi preview (detik)
    playing: false,
    rendering: false,
    cancel: false,
    result: null,
  };

  /* ---------- util ---------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmtTime = (s) => {
    s = Math.max(0, s || 0);
    const m = Math.floor(s / 60), d = Math.floor(s % 60);
    return m + ':' + String(d).padStart(2, '0');
  };
  const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
  const fmtMB = (b) => (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
  class Batal extends Error {}

  function getCfg() {
    const [W, H] = document.querySelector('input[name=ukuran]:checked').value.split('x').map(Number);
    return {
      W, H,
      fit: document.querySelector('input[name=fit]:checked').value,
      kenburns: $('#kenburns').checked,
      text: $('#teks').value,
      pos: document.querySelector('input[name=pos]:checked').value,
      size: parseFloat(document.querySelector('input[name=huruf]:checked').value),
      color: document.querySelector('input[name=warna]:checked').value,
      vol: $('#vol').value / 100,
      mute: $('#mute').checked,
    };
  }

  /* ---------- timeline ---------- */
  const segDur = (it) => (it.type === 'video' ? Math.max(0.2, it.end - it.start) : it.dur);
  function timeline() {
    let t = 0;
    const segs = state.items.map((item) => {
      const dur = segDur(item);
      const s = { item, start: t, dur };
      t += dur;
      return s;
    });
    return { segs, total: t };
  }
  function segAt(segs, t) {
    for (const s of segs) if (t < s.start + s.dur) return s;
    return segs[segs.length - 1];
  }

  /* ---------- gambar 1 frame ---------- */
  function wrapText(ctx, text, maxW) {
    const out = [];
    for (const para of text.split('\n')) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { out.push(''); continue; }
      let line = '';
      for (let w of words) {
        // kata yang terlalu panjang dipotong per huruf
        while (ctx.measureText(w).width > maxW) {
          let i = w.length;
          while (i > 1 && ctx.measureText(w.slice(0, i)).width > maxW) i--;
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, i));
          w = w.slice(i);
        }
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width <= maxW) line = test;
        else { out.push(line); line = w; }
      }
      if (line) out.push(line);
    }
    return out;
  }

  function drawCaption(ctx, W, H, cfg) {
    const text = cfg.text.trim();
    if (!text) return;
    const fs = Math.round(Math.min(W, H) * cfg.size);
    ctx.font = `bold ${fs}px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, text, W * 0.86);
    const lh = fs * 1.22;
    const blockH = lines.length * lh;
    const portrait = H > W * 1.2;
    let y0;
    if (cfg.pos === 'top') y0 = portrait ? H * 0.12 : H * 0.07;
    else if (cfg.pos === 'middle') y0 = (H - blockH) / 2;
    else y0 = (portrait ? H * 0.78 : H * 0.93) - blockH; // 9:16: di atas area tombol TikTok
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(4, fs * 0.2);
    ctx.strokeStyle = '#000';
    ctx.fillStyle = cfg.color;
    lines.forEach((ln, i) => {
      const y = y0 + lh * (i + 0.5);
      ctx.strokeText(ln, W / 2, y);
      ctx.fillText(ln, W / 2, y);
    });
  }

  function drawFrame(ctx, W, H, seg, local, cfg, scale = 1) {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (seg) {
      const it = seg.item;
      const src = it.type === 'video' ? it.el : it.img;
      const sw = it.type === 'video' ? it.el.videoWidth : it.img.width;
      const sh = it.type === 'video' ? it.el.videoHeight : it.img.height;
      if (sw && sh) {
        let k = cfg.fit === 'cover' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
        if (it.type === 'photo' && cfg.kenburns) k *= 1 + 0.08 * clamp(local / seg.dur, 0, 1);
        const dw = sw * k, dh = sh * k;
        try { ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh); } catch (e) { /* frame belum siap */ }
      }
    }
    drawCaption(ctx, W, H, cfg);
    ctx.restore();
  }

  function seekTo(el, t) {
    return new Promise((resolve) => {
      const dur = isFinite(el.duration) ? el.duration : t + 1;
      t = clamp(t, 0, Math.max(0, dur - 0.04));
      if (Math.abs(el.currentTime - t) < 0.0005 && el.readyState >= 2) return resolve();
      let done = false;
      const fin = () => { if (done) return; done = true; el.removeEventListener('seeked', fin); clearTimeout(to); resolve(); };
      const to = setTimeout(fin, 4000);
      el.addEventListener('seeked', fin);
      el.currentTime = t;
    });
  }
  // sambil menunggu, kasih browser sempat menyiapkan frame
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

  /* ---------- preview ---------- */
  const prev = $('#prev');
  const pctx = prev.getContext('2d');
  let drawToken = 0;
  let raf = 0, playStart = 0, activeSeg = null;

  function sizePreview() {
    const { W, H } = getCfg();
    const s = Math.min(1, 720 / Math.max(W, H));
    prev.width = Math.round(W * s);
    prev.height = Math.round(H * s);
    prev.dataset.scale = s;
  }

  async function drawAt(t) {
    const token = ++drawToken;
    const { segs, total } = timeline();
    const cfg = getCfg();
    const s = parseFloat(prev.dataset.scale || 1);
    if (!segs.length) {
      drawFrame(pctx, cfg.W, cfg.H, null, 0, cfg, s);
      return;
    }
    t = clamp(t, 0, Math.max(0, total - 0.001));
    const seg = segAt(segs, t);
    const local = t - seg.start;
    if (seg.item.type === 'video') {
      await seekTo(seg.item.el, seg.item.start + local);
      await nextFrame();
      if (token !== drawToken) return;
    }
    drawFrame(pctx, cfg.W, cfg.H, seg, local, cfg, s);
  }

  let refreshTimer = 0;
  function refresh() {
    if (state.rendering) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      updateSummary();
      if (state.playing) return;
      sizePreview();
      drawAt(state.t);
    }, 60);
  }

  function updateSummary() {
    const { segs, total } = timeline();
    const has = segs.length > 0;
    $('#layar').classList.toggle('ada', has);
    $('#play').disabled = !has;
    $('#seek').disabled = !has;
    $('#render').disabled = !has || state.rendering;
    $('#klip-kosong').hidden = has;
    $('#waktu').textContent = fmtTime(state.t) + ' / ' + fmtTime(total);
    $('#seek').value = total ? Math.round((state.t / total) * 1000) : 0;
    let tot = $('#total');
    if (!tot) {
      tot = document.createElement('p');
      tot.id = 'total';
      tot.className = 'hint';
      $('#daftar').after(tot);
    }
    tot.hidden = !has;
    tot.innerHTML = has
      ? 'Total durasi: <b>' + fmtTime(total) + '</b>' + (total > MAX_TOTAL_WARN ? ' — ⚠️ lumayan panjang, render bisa lama.' : '')
      : '';
  }

  function stopPlay() {
    state.playing = false;
    cancelAnimationFrame(raf);
    if (activeSeg && activeSeg.item.type === 'video') activeSeg.item.el.pause();
    activeSeg = null;
    if (state.music) state.music.el.pause();
    $('#play').textContent = '▶ Putar';
  }

  function startPlay() {
    const { segs, total } = timeline();
    if (!segs.length) return;
    if (state.t >= total - 0.05) state.t = 0;
    state.playing = true;
    $('#play').textContent = '⏸ Berhenti';
    playStart = performance.now() - state.t * 1000;
    activeSeg = null;
    const cfg0 = getCfg();
    if (state.music) {
      const m = state.music.el;
      m.volume = cfg0.vol;
      try { m.currentTime = state.t % (m.duration || 1e9); } catch (e) {}
      m.play().catch(() => {});
    }
    const loop = () => {
      if (!state.playing) return;
      const cfg = getCfg();
      const { segs, total } = timeline();
      const t = (performance.now() - playStart) / 1000;
      if (t >= total) {
        state.t = total;
        stopPlay();
        updateSummary();
        return;
      }
      const seg = segAt(segs, t);
      const local = t - seg.start;
      if (seg !== activeSeg) {
        if (activeSeg && activeSeg.item.type === 'video') activeSeg.item.el.pause();
        activeSeg = seg;
        if (seg.item.type === 'video') {
          const el = seg.item.el;
          el.muted = cfg.mute;
          el.currentTime = seg.item.start + local;
          el.play().catch(() => {});
        }
      } else if (seg.item.type === 'video') {
        const el = seg.item.el;
        el.muted = cfg.mute;
        if (Math.abs(el.currentTime - (seg.item.start + local)) > 0.4) el.currentTime = seg.item.start + local;
      }
      if (state.music) state.music.el.volume = cfg.vol;
      drawFrame(pctx, cfg.W, cfg.H, seg, local, cfg, parseFloat(prev.dataset.scale || 1));
      state.t = t;
      $('#waktu').textContent = fmtTime(t) + ' / ' + fmtTime(total);
      $('#seek').value = Math.round((t / total) * 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  $('#play').addEventListener('click', () => (state.playing ? stopPlay() : startPlay()));
  $('#seek').addEventListener('input', (e) => {
    stopPlay();
    const { total } = timeline();
    state.t = (e.target.value / 1000) * total;
    $('#waktu').textContent = fmtTime(state.t) + ' / ' + fmtTime(total);
    drawAt(state.t);
  });

  /* ---------- tambah file ---------- */
  const isVideoFile = (f) => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp|mkv)$/i.test(f.name);
  const isImageFile = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name);

  function loadVideo(file) {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      const url = URL.createObjectURL(file);
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      const to = setTimeout(() => reject(new Error('timeout')), 20000);
      v.onloadeddata = () => {
        clearTimeout(to);
        if (!v.videoWidth || !isFinite(v.duration) || v.duration <= 0) return reject(new Error('bad'));
        resolve({ v, url });
      };
      v.onerror = () => { clearTimeout(to); reject(new Error('error')); };
    });
  }

  async function loadPhoto(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 2160 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    return c;
  }

  function makeThumb(src, sw, sh) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    const k = Math.max(128 / sw, 128 / sh);
    x.drawImage(src, (128 - sw * k) / 2, (128 - sh * k) / 2, sw * k, sh * k);
    return c.toDataURL('image/jpeg', 0.7);
  }

  function showKlipError(msg) {
    let e = $('#klip-error');
    if (!e) {
      e = document.createElement('p');
      e.id = 'klip-error';
      e.className = 'error';
      $('#klip-kosong').before(e);
    }
    e.hidden = !msg;
    e.textContent = msg || '';
  }

  $('#file-media').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const gagal = [];
    for (const f of files) {
      try {
        if (isVideoFile(f)) {
          const { v, url } = await loadVideo(f);
          await seekTo(v, Math.min(0.1, v.duration / 2));
          const thumb = makeThumb(v, v.videoWidth, v.videoHeight);
          const dur = Math.round(v.duration * 10) / 10;
          state.items.push({ id: state.nextId++, type: 'video', name: f.name, file: f, url, el: v, dur, start: 0, end: dur, thumb });
        } else if (isImageFile(f)) {
          const img = await loadPhoto(f);
          state.items.push({ id: state.nextId++, type: 'photo', name: f.name, file: f, img, dur: 3, thumb: makeThumb(img, img.width, img.height) });
        } else gagal.push(f.name + ' (bukan video/foto)');
      } catch (err) {
        gagal.push(f.name + ' (nggak bisa dibuka)');
      }
    }
    showKlipError(gagal.length ? 'Ini gagal dimasukkan: ' + gagal.join(', ') + '. Coba video MP4 atau foto JPG/PNG.' : '');
    renderList();
    state.t = 0;
    refresh();
  });

  /* ---------- daftar klip ---------- */
  function renderList() {
    const ol = $('#daftar');
    ol.innerHTML = '';
    state.items.forEach((it, idx) => {
      const li = document.createElement('li');
      li.className = 'item';
      li.dataset.id = it.id;
      const isV = it.type === 'video';
      li.innerHTML = `
        <div class="item-head">
          <img class="thumb" alt="" src="${it.thumb}">
          <div class="item-meta"><b></b><small>${isV ? '🎞️ Video · ' + fmt1(it.dur) + ' dtk' : '🖼️ Foto'}</small></div>
          <div class="item-btns">
            <button type="button" data-a="up" aria-label="Naik" ${idx === 0 ? 'disabled' : ''}>▲</button>
            <button type="button" data-a="down" aria-label="Turun" ${idx === state.items.length - 1 ? 'disabled' : ''}>▼</button>
            <button type="button" data-a="del" class="del" aria-label="Hapus">✕</button>
          </div>
        </div>
        <div class="extra"></div>`;
      li.querySelector('b').textContent = it.name;
      const extra = li.querySelector('.extra');
      if (isV) {
        extra.className = 'trim';
        extra.innerHTML = `
          <label><span>Mulai dari: <b class="v-s"></b></span><input type="range" class="r-s" min="0" max="${it.dur}" step="0.1" value="${it.start}"></label>
          <label><span>Berhenti di: <b class="v-e"></b></span><input type="range" class="r-e" min="0" max="${it.dur}" step="0.1" value="${it.end}"></label>
          <span class="hint v-len"></span>`;
        const rs = extra.querySelector('.r-s'), re = extra.querySelector('.r-e');
        const upd = () => {
          extra.querySelector('.v-s').textContent = fmt1(it.start) + ' dtk';
          extra.querySelector('.v-e').textContent = fmt1(it.end) + ' dtk';
          extra.querySelector('.v-len').textContent = 'Dipakai: ' + fmt1(it.end - it.start) + ' detik';
        };
        const minLen = Math.min(0.3, it.dur);
        const goto = (atEnd) => {
          stopPlay();
          const { segs } = timeline();
          const sg = segs.find((s) => s.item === it);
          state.t = sg.start + (atEnd ? Math.max(0, sg.dur - 0.05) : 0);
          refresh();
        };
        rs.addEventListener('input', () => { it.start = clamp(parseFloat(rs.value), 0, it.end - minLen); rs.value = it.start; upd(); goto(false); });
        re.addEventListener('input', () => { it.end = clamp(parseFloat(re.value), it.start + minLen, it.dur); re.value = it.end; upd(); goto(true); });
        upd();
      } else {
        extra.className = 'stepper';
        extra.innerHTML = `<span>Tampil:</span><button type="button" data-a="min" aria-label="Kurangi">−</button><output></output><button type="button" data-a="plus" aria-label="Tambah">+</button>`;
        const out = extra.querySelector('output');
        const upd = () => { out.textContent = fmt1(it.dur) + ' detik'; };
        extra.querySelector('[data-a=min]').addEventListener('click', () => { it.dur = clamp(it.dur - 0.5, 1, 10); upd(); stopPlay(); refresh(); });
        extra.querySelector('[data-a=plus]').addEventListener('click', () => { it.dur = clamp(it.dur + 0.5, 1, 10); upd(); stopPlay(); refresh(); });
        upd();
      }
      ol.appendChild(li);
    });
    updateSummary();
  }

  $('#daftar').addEventListener('click', (e) => {
    const b = e.target.closest('.item-btns button');
    if (!b) return;
    const id = +b.closest('.item').dataset.id;
    const i = state.items.findIndex((x) => x.id === id);
    stopPlay();
    if (b.dataset.a === 'up' && i > 0) [state.items[i - 1], state.items[i]] = [state.items[i], state.items[i - 1]];
    else if (b.dataset.a === 'down' && i < state.items.length - 1) [state.items[i + 1], state.items[i]] = [state.items[i], state.items[i + 1]];
    else if (b.dataset.a === 'del') {
      const it = state.items[i];
      if (it.url) URL.revokeObjectURL(it.url);
      state.items.splice(i, 1);
    }
    state.t = 0;
    renderList();
    refresh();
  });

  /* ---------- musik & pengaturan ---------- */
  $('#file-musik').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (state.music) URL.revokeObjectURL(state.music.url);
    const url = URL.createObjectURL(f);
    const el = new Audio(url);
    el.loop = true;
    state.music = { file: f, name: f.name, url, el };
    $('#musik-nama').textContent = '🎵 ' + f.name;
    $('#musik-info').hidden = false;
    $('#baris-vol').hidden = false;
  });
  $('#musik-hapus').addEventListener('click', () => {
    if (!state.music) return;
    state.music.el.pause();
    URL.revokeObjectURL(state.music.url);
    state.music = null;
    $('#musik-info').hidden = true;
    $('#baris-vol').hidden = true;
  });
  $('#vol').addEventListener('input', (e) => { $('#vol-val').textContent = e.target.value + '%'; });
  document.querySelectorAll('input[name=ukuran],input[name=fit],input[name=pos],input[name=huruf],input[name=warna],#kenburns,#teks').forEach((el) => {
    el.addEventListener('input', refresh);
    el.addEventListener('change', refresh);
  });
  $('#mute').addEventListener('change', () => { if (state.playing) { stopPlay(); startPlay(); } });

  /* ---------- dukungan MP4 ---------- */
  const VIDEO_CODECS = ['avc1.64002A', 'avc1.640033', 'avc1.640028', 'avc1.4D002A', 'avc1.42E02A', 'avc1.64001F', 'avc1.4D001F', 'avc1.42E01F'];
  const hasWebCodecs = () =>
    typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined' && typeof AudioData !== 'undefined' && typeof Mp4Muxer !== 'undefined';

  function bitrateFor(W, H) { return Math.round(clamp(W * H * FPS * 0.13, 2e6, 10e6)); }

  async function pickVideoConfig(W, H) {
    if (!hasWebCodecs()) return null;
    for (const codec of VIDEO_CODECS) {
      const cfg = { codec, width: W, height: H, bitrate: bitrateFor(W, H), framerate: FPS, avc: { format: 'avc' } };
      try {
        const r = await VideoEncoder.isConfigSupported(cfg);
        if (r && r.supported) return r.config || cfg;
      } catch (e) { /* coba berikutnya */ }
    }
    return null;
  }
  async function pickAudioConfig() {
    for (const codec of ['mp4a.40.2', 'opus']) {
      const cfg = { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 };
      try {
        const r = await AudioEncoder.isConfigSupported(cfg);
        if (r && r.supported) return cfg;
      } catch (e) { /* lanjut */ }
    }
    return null;
  }

  async function showSupport() {
    const el = $('#dukung');
    const c = await pickVideoConfig(720, 1280);
    const recOK = typeof MediaRecorder !== 'undefined';
    if (c) {
      el.className = 'dukung ok';
      el.textContent = '✅ HP kamu bisa bikin video MP4 — aman buat diupload ke TikTok.';
    } else if (recOK) {
      el.className = 'dukung warn';
      el.textContent = '⚠️ Browser HP kamu belum bisa bikin MP4 langsung, jadi hasilnya WebM (dan renderingnya jalan real-time, selama durasi videonya). Kalau TikTok nolak, ubah dulu ke MP4. Coba pakai Chrome versi terbaru.';
    } else {
      el.className = 'dukung warn';
      el.textContent = '❌ Browser ini belum bisa render video. Pakai Chrome versi terbaru di HP Android.';
      $('#render').dataset.nosupport = '1';
    }
  }

  /* ---------- mixing audio (offline, cepat) ---------- */
  async function mixAudio(segs, cfg, totalR, onProg) {
    const SR = 48000;
    const len = Math.ceil(totalR * SR);
    const ctx = new OfflineAudioContext(2, len, SR);
    let any = false;
    if (!cfg.mute) {
      let n = 0;
      const vids = segs.filter((s) => s.item.type === 'video');
      for (const s of vids) {
        if (state.cancel) throw new Batal();
        try {
          const ab = await s.item.file.arrayBuffer();
          const buf = await ctx.decodeAudioData(ab);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          const off = Math.min(s.item.start, Math.max(0, buf.duration - 0.01));
          src.start(s.start, off, Math.min(s.dur, buf.duration - off));
          any = true;
        } catch (e) { /* klip ini nggak ada suaranya */ }
        onProg(++n / (vids.length + 1));
      }
    }
    if (state.music) {
      try {
        const ab = await state.music.file.arrayBuffer();
        const buf = await ctx.decodeAudioData(ab);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const g = ctx.createGain();
        g.gain.setValueAtTime(cfg.vol, 0);
        if (totalR > 2) {
          g.gain.setValueAtTime(cfg.vol, totalR - 1);
          g.gain.linearRampToValueAtTime(0, totalR);
        }
        src.connect(g).connect(ctx.destination);
        src.start(0);
        any = true;
      } catch (e) {
        throw new Error('Musik nggak bisa dibaca. Coba file MP3 atau M4A lain.');
      }
    }
    if (!any) return null;
    return await ctx.startRendering();
  }

  /* ---------- progress ---------- */
  let renderT0 = 0;
  function setProgress(p, label) {
    p = clamp(p, 0, 1);
    $('#bar-isi').style.width = (p * 100).toFixed(1) + '%';
    let txt = (label || 'Render') + ' ' + Math.round(p * 100) + '%';
    const el = (performance.now() - renderT0) / 1000;
    if (p > 0.08 && p < 1) txt += ' · sisa ± ' + Math.max(1, Math.round((el / p) * (1 - p))) + ' detik';
    $('#progres-teks').textContent = txt;
  }


  /* ---------- ambil frame video saat render ----------
     Cara cepat: video diputar biasa (decode berurutan), frame diambil sesuai jam.
     Kalau HP ketinggalan, kecepatan putar diturunkan otomatis.
     Cadangan: loncat (seek) per frame — lebih lambat tapi pasti. */
  function nextVideoFrame(el, ms = 700) {
    return new Promise((resolve) => {
      let done = false;
      const fin = (ok) => { if (!done) { done = true; clearTimeout(to); resolve(ok); } };
      const to = setTimeout(() => fin(false), ms);
      if (el.requestVideoFrameCallback) el.requestVideoFrameCallback(() => fin(true));
      else requestAnimationFrame(() => setTimeout(() => fin(true), 20));
    });
  }
  async function fetchVideoFrame(el, target, st) {
    const half = 0.5 / FPS;
    if (st.seekOnly) { await seekTo(el, target); return; }
    if (!st.started) {
      await seekTo(el, target);
      el.muted = true;
      el.playbackRate = st.rate = 1;
      try { await el.play(); } catch (e) { st.seekOnly = true; return; }
      st.started = true;
      st.fails = 0;
    }
    const limit = Math.min(isFinite(el.duration) ? el.duration : 1e9, target + 5);
    while (el.currentTime < target - half && !el.ended && el.currentTime < limit) {
      const ok = await nextVideoFrame(el);
      if (!ok) {
        // video macet: coba lompat sekali, kalau masih macet pakai cara seek
        if (++st.fails >= 3) { st.seekOnly = true; el.pause(); await seekTo(el, target); return; }
        await seekTo(el, target);
        try { await el.play(); } catch (e) { st.seekOnly = true; return; }
      }
    }
    const lag = el.currentTime - target;
    if (lag > 6 / FPS) { // ketinggalan jauh: lompat balik
      await seekTo(el, target);
      st.rate = Math.max(0.25, st.rate * 0.6); el.playbackRate = st.rate;
    } else if (lag > 2.5 / FPS) { // agak ketinggalan: pelankan
      st.rate = Math.max(0.25, st.rate * 0.8); el.playbackRate = st.rate;
    } else if (lag < 0.5 / FPS && st.rate < 1) { // lega lagi: percepat
      st.rate = Math.min(1, st.rate * 1.1); el.playbackRate = st.rate;
    }
  }

  /* ---------- render MP4 (WebCodecs) ---------- */
  async function renderMp4(segs, total, cfg, vcfg) {
    const { W, H } = cfg;
    const nFrames = Math.max(1, Math.ceil(total * FPS));
    const totalR = nFrames / FPS;
    const mix = await mixAudio(segs, cfg, totalR, (p) => setProgress(p * 0.08, 'Menyiapkan suara'));
    if (state.cancel) throw new Batal();
    const acfg = mix ? await pickAudioConfig() : null;
    if (mix && !acfg) throw new Error('Encoder suara belum didukung');

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H },
      audio: acfg ? { codec: acfg.codec === 'opus' ? 'opus' : 'aac', numberOfChannels: 2, sampleRate: 48000 } : undefined,
      fastStart: 'in-memory',
    });
    let encErr = null;
    // suara dulu (cepat)
    if (acfg) {
      const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { encErr = e; } });
      aenc.configure(acfg);
      const L = mix.getChannelData(0), R = mix.getChannelData(1);
      const CH = 4800;
      for (let off = 0; off < mix.length; off += CH) {
        if (encErr) throw encErr;
        const n = Math.min(CH, mix.length - off);
        const data = new Float32Array(n * 2);
        data.set(L.subarray(off, off + n), 0);
        data.set(R.subarray(off, off + n), n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((off / 48000) * 1e6), data });
        aenc.encode(ad);
        ad.close();
        while (aenc.encodeQueueSize > 20) await sleep(2);
      }
      await aenc.flush();
      aenc.close();
      if (encErr) throw encErr;
    }
    setProgress(0.1, 'Render');

    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { encErr = e; } });
    venc.configure(vcfg);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { alpha: false });
    for (const s of segs) if (s.item.type === 'video') { s.item.el.pause(); s.item.el.muted = true; }
    renderT0 = performance.now();
    let curSeg = null, vst = null;
    const prof = (window.__rvProf = { seek: 0, draw: 0, wait: 0 });
    for (let i = 0; i < nFrames; i++) {
      if (state.cancel) { try { venc.close(); } catch (e) {} throw new Batal(); }
      if (encErr) throw encErr;
      const t = Math.min(i / FPS, total - 0.001);
      const seg = segAt(segs, t);
      const local = t - seg.start;
      const p0 = performance.now();
      if (seg !== curSeg) {
        if (curSeg && curSeg.item.type === 'video') curSeg.item.el.pause();
        curSeg = seg; vst = { started: false, rate: 1, fails: 0, seekOnly: false };
      }
      if (seg.item.type === 'video') await fetchVideoFrame(seg.item.el, seg.item.start + local, vst);
      const p1 = performance.now();
      drawFrame(ctx, W, H, seg, local, cfg, 1);
      prof.seek += p1 - p0; prof.draw += performance.now() - p1;
      const frame = new VideoFrame(cv, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      venc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      const p2 = performance.now();
      while (venc.encodeQueueSize > 6) await sleep(3);
      prof.wait += performance.now() - p2;
      if (i % 3 === 0) { setProgress(0.1 + 0.88 * (i / nFrames), 'Render'); await sleep(0); }
    }
    if (curSeg && curSeg.item.type === 'video') curSeg.item.el.pause();
    await venc.flush();
    venc.close();
    if (encErr) throw encErr;
    muxer.finalize();
    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    return { blob, ext: 'mp4', mime: 'video/mp4', how: 'webcodecs', audio: acfg ? acfg.codec : null, w: W, h: H, dur: totalR };
  }

  /* ---------- render cadangan (MediaRecorder, real-time) ---------- */
  async function renderRecorder(segs, total, cfg) {
    const { W, H } = cfg;
    const mix = await mixAudio(segs, cfg, total, (p) => setProgress(p * 0.05, 'Menyiapkan suara'));
    if (state.cancel) throw new Batal();
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { alpha: false });
    drawFrame(ctx, W, H, segs[0], 0, cfg, 1);
    const stream = cv.captureStream(FPS);
    let ac = null, asrc = null;
    if (mix) {
      ac = new AudioContext();
      await ac.resume().catch(() => {});
      const dest = ac.createMediaStreamDestination();
      asrc = ac.createBufferSource();
      asrc.buffer = mix;
      asrc.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
    const types = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported(t));
    if (!mime) throw new Error('Browser nggak punya perekam video');
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrateFor(W, H) });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((r) => { rec.onstop = r; });
    for (const s of segs) if (s.item.type === 'video') { s.item.el.pause(); s.item.el.muted = true; }
    renderT0 = performance.now();
    if (segs[0].item.type === 'video') await seekTo(segs[0].item.el, segs[0].item.start);
    rec.start(1000);
    if (asrc) asrc.start();
    const t0 = performance.now();
    let active = null;
    await new Promise((resolve, reject) => {
      const tick = () => {
        if (state.cancel) return reject(new Batal());
        const t = (performance.now() - t0) / 1000;
        if (t >= total) return resolve();
        const seg = segAt(segs, t);
        const local = t - seg.start;
        if (seg !== active) {
          if (active && active.item.type === 'video') active.item.el.pause();
          active = seg;
          if (seg.item.type === 'video') {
            seg.item.el.currentTime = seg.item.start + local;
            seg.item.el.play().catch(() => {});
          }
        }
        drawFrame(ctx, W, H, seg, local, cfg, 1);
        setProgress(t / total, 'Merekam');
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }).catch(async (e) => {
      try { rec.stop(); } catch (x) {}
      if (active && active.item.type === 'video') active.item.el.pause();
      if (ac) ac.close();
      throw e;
    });
    if (active && active.item.type === 'video') active.item.el.pause();
    await sleep(150);
    rec.stop();
    await stopped;
    if (ac) ac.close();
    const isMp4 = mime.startsWith('video/mp4');
    const blob = new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' });
    return { blob, ext: isMp4 ? 'mp4' : 'webm', mime: blob.type, how: 'recorder', audio: mix ? 'rec' : null, w: W, h: H, dur: total };
  }

  /* ---------- tombol render ---------- */
  let wakeLock = null;
  function setBusy(b) {
    state.rendering = b;
    ['#sec-klip', '#sec-klip ~ .card:not(#sec-render)'].forEach((sel) => document.querySelectorAll(sel).forEach((el) => (b ? el.setAttribute('inert', '') : el.removeAttribute('inert'))));
    $('#render').hidden = b;
    $('#progres').hidden = !b;
    document.body.classList.toggle('sibuk', b);
  }
  function showError(msg) {
    const e = $('#error');
    e.hidden = !msg;
    e.textContent = msg || '';
  }

  $('#batal').addEventListener('click', () => { state.cancel = true; $('#progres-teks').textContent = 'Membatalkan…'; });

  $('#render').addEventListener('click', async () => {
    stopPlay();
    showError('');
    $('#hasil').hidden = true;
    if (state.result) { URL.revokeObjectURL(state.result.url); state.result = null; }
    const { segs, total } = timeline();
    if (!segs.length) return;
    const cfg = getCfg();
    state.cancel = false;
    setBusy(true);
    renderT0 = performance.now();
    setProgress(0, 'Menyiapkan');
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
    try {
      let res = null;
      const vcfg = await pickVideoConfig(cfg.W, cfg.H);
      if (vcfg) {
        try {
          res = await renderMp4(segs, total, cfg, vcfg);
        } catch (e) {
          if (e instanceof Batal) throw e;
          console.warn('MP4 gagal, pindah ke cadangan:', e);
          setProgress(0, 'Coba cara lain');
        }
      }
      if (!res) {
        if (typeof MediaRecorder === 'undefined') throw new Error('Browser ini belum bisa render video. Pakai Chrome terbaru.');
        res = await renderRecorder(segs, total, cfg);
      }
      if (!res.blob || res.blob.size < 1000) throw new Error('Hasil video kosong. Coba lagi dengan ukuran 720×1280.');
      showResult(res);
    } catch (e) {
      if (e instanceof Batal) showError('Render dibatalkan.');
      else showError('Maaf, render gagal: ' + (e && e.message ? e.message : e) + '. Coba ukuran "TikTok hemat" atau kurangi jumlah klip.');
      console.error(e);
    } finally {
      if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
      for (const s of segs) if (s.item.type === 'video') { s.item.el.pause(); s.item.el.muted = true; }
      setBusy(false);
      refresh();
    }
  });

  function showResult(res) {
    const url = URL.createObjectURL(res.blob);
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const name = `video-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${res.ext}`;
    state.result = { url, name, blob: res.blob, res };
    const v = $('#hasil-video');
    v.src = url;
    const a = $('#unduh');
    a.href = url;
    a.download = name;
    $('#hasil-info').textContent = `${res.ext.toUpperCase()} · ${res.w}×${res.h} · ${fmtTime(res.dur)} · ${fmtMB(res.blob.size)} · ${name}`;
    const note = $('#hasil-note');
    if (res.ext === 'mp4' && res.how === 'webcodecs') {
      note.className = 'note';
      note.innerHTML = '✅ <b>Bisa langsung diupload ke TikTok.</b> Formatnya MP4 (H.264' + (res.audio ? (res.audio === 'opus' ? ' + Opus' : ' + AAC') : '') + '), format yang dipakai TikTok.' +
        (res.audio === 'opus' ? ' Kalau suaranya nggak keluar di TikTok, ubah dulu lewat CapCut.' : '');
    } else if (res.ext === 'mp4') {
      note.className = 'note warn';
      note.innerHTML = '🟡 Hasilnya MP4 dari perekam browser. <b>Biasanya bisa diupload ke TikTok</b>, tapi kalau ditolak atau suaranya aneh, buka di CapCut lalu export ulang.';
    } else {
      note.className = 'note warn';
      note.innerHTML = '⚠️ Hasilnya <b>WebM</b>. TikTok sering <b>nggak bisa terima WebM</b>. Ubah dulu ke MP4 (misalnya impor ke CapCut lalu export, atau pakai situs convert WebM ke MP4 gratis), baru upload.';
    }
    const f = new File([res.blob], name, { type: res.mime });
    const sb = $('#bagikan');
    sb.hidden = !(navigator.canShare && navigator.canShare({ files: [f] }));
    sb.onclick = async () => { try { await navigator.share({ files: [f], title: 'Video' }); } catch (e) {} };
    $('#hasil').hidden = false;
    $('#hasil').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- mulai ---------- */
  sizePreview();
  drawAt(0);
  renderList();
  showSupport();
  window.addEventListener('pagehide', () => { stopPlay(); });
})();
