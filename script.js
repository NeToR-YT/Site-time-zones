
(function(){
  'use strict';

  const STORAGE_KEY = 'selectedTimezones_v1';

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
    // Тут немає російських часових поясів, але все одно відфільтруємо додатково
    return [
      'UTC', 'Europe/Kyiv', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
      'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'America/New_York',
      'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Pacific/Auckland'
    ].filter(tz => !isRussianTimezone(tz));
  }

  function saveSelected(timezones) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(timezones)); } catch(e) {}
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

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.type = 'button';
    removeBtn.textContent = '× Видалити';
    removeBtn.addEventListener('click', () => {
      removeTimezone(tz);
    });

    infoRow.appendChild(tzInfo);
    infoRow.appendChild(removeBtn);

    container.appendChild(title);
    container.appendChild(timeEl);
    container.appendChild(dateEl);
    container.appendChild(infoRow);

    // одиночне оновлення
    updateCard(container);

    return container;
  }

  function updateCard(card){
    const tz = card.dataset.tz;
    const now = new Date();
    const full = formatForTimezone(now, tz);
    // Розділимо простим способом — все у time та date окремо
    // Тут беремо всю відформатовану строку і умовно розділяємо на частини
    const parts = full.split(',');
    const timeText = parts.slice(-1).join(',').trim();
    const dateText = parts.slice(0, -1).join(',').trim();

    const timeEl = card.querySelector('.time');
    const dateEl = card.querySelector('.date');
    const tzInfo = card.querySelector('.info-row > div');

    timeEl.textContent = timeText || full;
    dateEl.textContent = dateText || '';
    tzInfo.textContent = '';
  }

  function updateClocks(){
    const cards = Array.from(els.clocks().children);
    cards.forEach(updateCard);
  }

  function addTimezone(tz, save=true){
    if (!tz) return;
    const list = loadSelected();
    if (list.includes(tz)) return; // уникальність
    list.push(tz);
    if (save) saveSelected(list);
    const card = createClockCard(tz);
    els.clocks().appendChild(card);
  }

  function removeTimezone(tz){
    const list = loadSelected().filter(x => x !== tz);
    saveSelected(list);
    const cards = Array.from(els.clocks().children);
    cards.forEach(c => { if (c.dataset.tz === tz) c.remove(); });
  }

  function clearAll(){
    saveSelected([]);
    els.clocks().innerHTML = '';
  }

  function renderSaved(){
    const saved = loadSelected();
    saved.forEach(tz => {
      const card = createClockCard(tz);
      els.clocks().appendChild(card);
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

    // Очищуємо збережені часові пояси від російських і зберігаємо зміни
    const savedRaw = loadSelected();
    const saved = savedRaw.filter(tz => !isRussianTimezone(tz));
    if (saved.length !== savedRaw.length) {
      saveSelected(saved);
    }

    // Додати автоматично часовий пояс користувача, якщо його нема в збережених
    if (!isRussianTimezone(det.value) && !saved.includes(det.value)) {
      // додати, але не зберігати duplicative якщо користувач захоче інше
      addTimezone(det.value);
      // тепер збережемо список
      const after = loadSelected();
      if (!after.includes(det.value)) {
        // ensure saved contains user tz
        after.push(det.value);
        saveSelected(after);
      }
    }

    // Рендер збережених (якщо були інші)
    renderSaved();

    // Запуск оновлення часу
    updateClocks();
    setInterval(updateClocks, 1000);
  });

})();
