
(function(){
  'use strict';

  const STORAGE_KEY = 'selectedTimezones_v1';
  const STORAGE_KEY_FAV = 'favTimezones_v1';

  const RUSSIAN_TZ_PREFIXES = [
    'Europe/Moscow','Europe/Kaliningrad','Europe/Simferopol','Europe/Volgograd','Europe/Samara','Europe/Saratov','Europe/Ulyanovsk',
    'Asia/Yekaterinburg','Asia/Omsk','Asia/Novosibirsk','Asia/Krasnoyarsk','Asia/Irkutsk','Asia/Yakutsk','Asia/Vladivostok','Asia/Magadan','Asia/Anadyr','Asia/Kamchatka','Asia/Chita','Asia/Khandyga','Asia/Tomsk'
  ];

  function isRussianTimezone(tz){
    if (!tz || typeof tz !== 'string') return false;
    return RUSSIAN_TZ_PREFIXES.some(p => tz === p || tz.startsWith(p + '/')) || RUSSIAN_TZ_PREFIXES.includes(tz);
  }

  function detectUserTimezone() {
    const tz = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || null;
    if (tz) return { type: 'iana', value: tz };

    // Якщо немає IANA, повертаємо UTC offset як fallback, наприклад "UTC+3"
    const offsetMin = new Date().getTimezoneOffset();
    const hours = -offsetMin / 60;
    const sign = hours >= 0 ? '+' : '';
    return { type: 'offset', value: `UTC${sign}${hours}` };
  }

  function getAvailableTimezones() {
    if (typeof Intl.supportedValuesOf === 'function') {
      try {
        // Отримуємо повний список часових поясів
        const all = Intl.supportedValuesOf('timeZone');
        return all.filter(tz => !isRussianTimezone(tz));
      } catch (e) {

      }
    }
    // Короткий список популярних зон як запасний варіант
    return [
      'UTC', 'Europe/Kyiv', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
      'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'America/New_York',
      'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Pacific/Auckland'
    ].filter(tz => !isRussianTimezone(tz));
  }

  function saveSelected(timezones) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(timezones)); } catch(e) {}
  }

  function saveFavorites(list){
    try { localStorage.setItem(STORAGE_KEY_FAV, JSON.stringify(list)); } catch(e) {}
  }

  function loadFavorites(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_FAV) || '[]'); } catch(e){ return []; }
  }

  function loadSelected(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e){ return []; }
  }

  function formatForTimezone(date, tz) {
    // Якщо tz - валідний IANA, Intl відформатує
    try {
      const f = new Intl.DateTimeFormat(undefined, {
        timeZone: tz,
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        year: 'numeric', month: 'short', day: 'numeric',
        timeZoneName: 'short'
      });
      return f.format(date);
    } catch (e) {
      // Якщо tz виглядає як 'UTC+3' — застосуємо ручне зміщення
      if (/^UTC[+-]?\d+(:\d+)?$/.test(tz)){
        const m = tz.match(/^UTC([+-]?\d+)(?::(\d+))?/);
        const hours = m ? parseInt(m[1],10) : 0;
        const mins = m && m[2] ? parseInt(m[2],10) : 0;
        const offsetMs = (hours*60 + mins) * 60 * 1000;
        const utc = Date.now();
        const d = new Date(utc + offsetMs);
        return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', year:'numeric', month:'short', day:'numeric'}) + ` (${tz})`;
      }
      // fallback — показати UTC час та повідомлення
      return new Date().toLocaleString() + ` (${tz} - unknown)`;
    }
  }

  // Отримати числові частини часу (год, хв, сек) для певного часового поясу
  function getTimePartsForTimezone(date, tz){
    try{
      const fmt = new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const parts = fmt.formatToParts(date);
      const hourPart = parts.find(p => p.type === 'hour')?.value || '0';
      const minutePart = parts.find(p => p.type === 'minute')?.value || '0';
      const secondPart = parts.find(p => p.type === 'second')?.value || '0';
      return { h: parseInt(hourPart,10), m: parseInt(minutePart,10), s: parseInt(secondPart,10) };
    }catch(e){ return null; }
  }

  function drawHand(ctx, angle, length, width, color){
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.rotate(angle);
    ctx.moveTo(-6,0);
    ctx.lineTo(length,0);
    ctx.stroke();
    ctx.rotate(-angle);
  }

  function drawAnalog(canvas, parts){
    if (!parts) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    // canvas.width/height are in device pixels; convert to CSS pixels (user units)
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const r = Math.min(w,h)/2;
    // clear in user space (CSS pixels)
    ctx.clearRect(0,0,w,h);
    ctx.save();
    ctx.translate(w/2,h/2);
    // face
    ctx.beginPath();
    ctx.arc(0,0,r-1,0,Math.PI*2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e6eefc';
    ctx.stroke();
    // ticks
    for (let i=0;i<60;i++){
      ctx.save();
      ctx.rotate(i*Math.PI/30);
      ctx.beginPath();
      const inner = (i%5===0) ? r*0.78 : r*0.86;
      ctx.moveTo(inner,0);
      ctx.lineTo(r-6,0);
      ctx.lineWidth = (i%5===0)?3:1;
      ctx.strokeStyle = '#9aa3b2';
      ctx.stroke();
      ctx.restore();
    }
    // hands
    const hour = (parts.h % 12) + parts.m/60;
    const minute = parts.m + parts.s/60;
    const second = parts.s;
    // line widths are in user units; transform already set in resizeCanvas to account for DPR
    drawHand(ctx, hour * Math.PI*2 / 12, r*0.5, 6, '#111');
    drawHand(ctx, minute * Math.PI*2 / 60, r*0.72, 4, '#111');
    drawHand(ctx, second * Math.PI*2 / 60, r*0.88, 2, '#c62828');
    // center dot
    ctx.beginPath();ctx.fillStyle='#111';ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  // Підлаштування canvas під CSS-розміри з урахуванням devicePixelRatio
  function resizeCanvas(canvas){
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    // Налаштувати видимий розмір через CSS (в CSS ми контролюємо фактичну ширину)
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const ctx = canvas.getContext('2d');
    if (ctx && typeof ctx.setTransform === 'function') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function resizeAllCanvases(){
    const canvases = document.querySelectorAll('.analog');
    canvases.forEach(c => resizeCanvas(c));
  }

  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    if (_resizeTimer) clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => { resizeAllCanvases(); updateClocks(); }, 120);
  });

  // DOM helpers
  const els = {
    userTzName: () => document.getElementById('user-tz-name'),
    tzSelect: () => document.getElementById('tz-select'),
    tzSearch: () => document.getElementById('tz-search'),
    addBtn: () => document.getElementById('add-tz'),
    clearAllBtn: () => document.getElementById('clear-all'),
    clocks: () => document.getElementById('clocks')
  };

  function populateSelect(zones) {
    const sel = els.tzSelect();
    sel.innerHTML = '';
    zones.forEach(z => {
      const opt = document.createElement('option');
      opt.value = z; opt.textContent = z;
      sel.appendChild(opt);
    });
  }

  function filterSelect(query){
    const sel = els.tzSelect();
    const q = (query||'').toLowerCase();
    Array.from(sel.options).forEach(opt => {
      const show = opt.value.toLowerCase().includes(q);
      opt.style.display = show ? '' : 'none';
    });
  }

  function createClockCard(tz){
    const container = document.createElement('article');
    container.className = 'card clock-card';
    container.dataset.tz = tz;

    const title = document.createElement('h3');
    title.textContent = tz;

    const timeEl = document.createElement('div');
    timeEl.className = 'time';
    timeEl.textContent = '';

    const dateEl = document.createElement('div');
    dateEl.className = 'date';
    dateEl.textContent = '';

    const infoRow = document.createElement('div');
    infoRow.className = 'info-row';

    const tzInfo = document.createElement('div');
    tzInfo.className = 'muted';
    tzInfo.textContent = '';

    const btns = document.createElement('div');
    btns.className = 'card-actions';

    const favBtn = document.createElement('button');
    favBtn.className = 'favorite-btn';
    favBtn.type = 'button';
    favBtn.title = 'Додати/прибрати у вибране';
    favBtn.innerHTML = '★';
    favBtn.addEventListener('click', () => {
      toggleFavorite(tz, favBtn);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.type = 'button';
    removeBtn.textContent = '× Видалити';
    removeBtn.addEventListener('click', () => {
      removeTimezone(tz);
    });

    btns.appendChild(favBtn);
    btns.appendChild(removeBtn);

    infoRow.appendChild(tzInfo);
    infoRow.appendChild(btns);

    container.appendChild(title);

    const canvas = document.createElement('canvas');
    canvas.className = 'analog';
    // Розмір canvas буде налаштовано згідно з CSS при додаванні в DOM
    container.appendChild(canvas);
    container.appendChild(timeEl);
    container.appendChild(dateEl);
    container.appendChild(infoRow);

    // одиночне оновлення після додавання в DOM (resize буде викликано зовні)
    updateCard(container);

    // restore favorite state
    const favs = loadFavorites();
    if (favs.includes(tz)) {
      const b = container.querySelector('.favorite-btn');
      if (b) b.classList.add('fav');
    }

    return container;
  }

  function updateCard(card){
    const tz = card.dataset.tz;
    const now = new Date();
    const full = formatForTimezone(now, tz);

    const parts = full.split(',');
    const timeText = parts.slice(-1).join(',').trim();
    const dateText = parts.slice(0, -1).join(',').trim();

    const timeEl = card.querySelector('.time');
    const dateEl = card.querySelector('.date');
    const tzInfo = card.querySelector('.info-row > div');

    timeEl.textContent = timeText || full;
    dateEl.textContent = dateText || '';
    tzInfo.textContent = '';

    const canvas = card.querySelector('.analog');
    if (canvas){
      const tp = getTimePartsForTimezone(now, tz);
      if (tp) drawAnalog(canvas, tp);
    }
  }

  function updateClocks(){
    const cards = Array.from(els.clocks().children);
    cards.forEach(updateCard);
  }

  function addTimezone(tz, save=true){
    if (!tz) return;
    const list = loadSelected();
    if (list.includes(tz)) return; 
    list.push(tz);
    if (save) saveSelected(list);
    const card = createClockCard(tz);
    els.clocks().appendChild(card);
    // Після додавання в DOM підганяємо canvas та відмалюємо
    const canvas = card.querySelector('.analog');
    if (canvas) { resizeCanvas(canvas); updateCard(card); }
  }

  function removeTimezone(tz){
    const list = loadSelected().filter(x => x !== tz);
    saveSelected(list);
    // remove from favorites as well
    const favs = loadFavorites().filter(x => x !== tz);
    saveFavorites(favs);
    const cards = Array.from(els.clocks().children);
    cards.forEach(c => { if (c.dataset.tz === tz) c.remove(); });
  }

  function clearAll(){
    saveSelected([]);
    saveFavorites([]);
    els.clocks().innerHTML = '';
  }

  function renderSaved(){
    const saved = loadSelected();
    saved.forEach(tz => {
      const card = createClockCard(tz);
      els.clocks().appendChild(card);
      const canvas = card.querySelector('.analog');
      if (canvas) { resizeCanvas(canvas); updateCard(card); }
    });
  }

  // Favorites toggle
  function toggleFavorite(tz, btn){
    const list = loadFavorites();
    if (list.includes(tz)) {
      const next = list.filter(x => x !== tz);
      saveFavorites(next);
      if (btn) btn.classList.remove('fav');
    } else {
      list.push(tz);
      saveFavorites(list);
      if (btn) btn.classList.add('fav');
    }
  }

  // Meeting planner: convert provided datetime (or now) into local times for each selected tz
  function planMeeting(datetimeLocal, durationMinutes){
    const resultsEl = document.getElementById('plan-results');
    resultsEl.innerHTML = '';
    const selected = loadSelected();
    if (!selected.length) {
      resultsEl.textContent = 'Додайте хоча б один часовий пояс.';
      return;
    }

    const baseDate = datetimeLocal ? new Date(datetimeLocal) : new Date();

    selected.forEach(tz => {
      let localStr = '';
      try {
        localStr = new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(baseDate);
      } catch(e){
        localStr = formatForTimezone(baseDate, tz);
      }
      const parts = getTimePartsForTimezone(baseDate, tz) || { h: 0, m: 0 };
      const inWork = parts.h >= 9 && parts.h < 18;

      const row = document.createElement('div');
      row.className = 'row' + (inWork ? ' in-work' : '');
      const left = document.createElement('div'); left.className = 'tz'; left.textContent = tz;
      const right = document.createElement('div'); right.className = 'local'; right.textContent = localStr + (inWork ? ' — робочий час' : '');
      row.appendChild(left); row.appendChild(right);
      resultsEl.appendChild(row);
    });
  }

  // Ініціалізація
  document.addEventListener('DOMContentLoaded', () => {
    const det = detectUserTimezone();
    const tzNameEl = els.userTzName();
    tzNameEl.textContent = det.value;

    const zones = getAvailableTimezones();
    populateSelect(zones);

    // Події
    els.tzSearch().addEventListener('input', e => {
      filterSelect(e.target.value);
    });

    els.tzSelect().addEventListener('dblclick', e => {
      const tz = e.target.value;
      if (tz) addTimezone(tz);
    });

    els.addBtn().addEventListener('click', () => {
      const sel = els.tzSelect();
      const tz = sel.value;
      addTimezone(tz);
    });

    els.clearAllBtn().addEventListener('click', () => {
      clearAll();
    });

    const savedRaw = loadSelected();
    const saved = savedRaw.filter(tz => !isRussianTimezone(tz));
    if (saved.length !== savedRaw.length) {
      saveSelected(saved);
    }

    // Додати автоматично часовий пояс користувача
    if (!isRussianTimezone(det.value) && !saved.includes(det.value)) {
      addTimezone(det.value);
      const after = loadSelected();
      if (!after.includes(det.value)) {
        after.push(det.value);
        saveSelected(after);
      }
    }

    renderSaved();
    // Планувальник: підключення елементів
    const meetingInput = document.getElementById('meeting-time');
    const planBtn = document.getElementById('plan-btn');
    const durationSel = document.getElementById('meeting-duration');

    // Встановити значення за замовчуванням: зараз (локально) у форматі, що підходить для datetime-local
    try{
      const now = new Date();
      const pad = n => String(n).padStart(2,'0');
      const localIso = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes());
      if (meetingInput) meetingInput.value = localIso;
    }catch(e){}

    if (planBtn) {
      planBtn.addEventListener('click', () => {
        const dt = meetingInput && meetingInput.value ? meetingInput.value : null;
        const dur = durationSel ? parseInt(durationSel.value,10) : 60;
        planMeeting(dt, dur);
      });
    }

    updateClocks();
    setInterval(updateClocks, 1000);
  });

})();
