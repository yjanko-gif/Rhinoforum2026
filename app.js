/* Rhinoforum 2026 — app vanilla JS (Direction B). Déployable GitHub Pages. */
(function () {
  'use strict';
  var R = window.RHINO;
  var THEMES = R.THEMES, FORMATS = R.FORMATS, ROOMS = R.ROOMS, ROOM_ORDER = R.ROOM_ORDER, DAYS = R.DAYS;
  var DOM = { jeu: '18', ven: '19', sam: '20' };

  /* ---- horloge réelle : quel jour du congrès et combien de minutes ---- */
  function computeNow() {
    var d = new Date();
    var map = { '2026-06-18': 'jeu', '2026-06-19': 'ven', '2026-06-20': 'sam' };
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    var dayId = map[key] || null;
    return { dayId: dayId, min: d.getHours() * 60 + d.getMinutes() };
  }
  // Pour tester l'état "en direct" hors congrès : ajouter ?demo=1 à l'URL → fige jeudi 13:35.
  var DEMO = new URLSearchParams(location.search).get('demo');
  var NOW = DEMO ? { dayId: 'jeu', min: 815 } : computeNow();

  /* ---- état ---- */
  var FAV_KEY = 'rhino26_fav';
  function loadFav() { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch (e) { return new Set(); } }
  var state = {
    view: 'list',
    dayId: DAYS.some(function (d) { return d.id === NOW.dayId; }) ? NOW.dayId : DAYS[0].id,
    fav: loadFav(),
    detail: null,
    filterOpen: false,
    filters: { theme: new Set(), room: new Set(), format: new Set() },
    draft: null,
    query: '',
    searchOpen: false,
  };
  function saveFav() { try { localStorage.setItem(FAV_KEY, JSON.stringify([].concat(Array.from(state.fav)))); } catch (e) {} }

  /* ---- utils ---- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fmtTime(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function hueColors(h) {
    return {
      bar: 'oklch(0.55 0.15 ' + h + ')', text: 'oklch(0.46 0.12 ' + h + ')',
      tint: 'oklch(0.95 0.045 ' + h + ')', dot: 'oklch(0.6 0.14 ' + h + ')',
    };
  }
  function day() { return DAYS.find(function (d) { return d.id === state.dayId; }); }
  function activeFilterCount() { return state.filters.theme.size + state.filters.room.size + state.filters.format.size; }
  function matchFilters(s) {
    var f = state.filters;
    if (f.theme.size && !f.theme.has(s.theme)) return false;
    if (f.room.size && !f.room.has(s.room)) return false;
    if (f.format.size && !f.format.has(s.format)) return false;
    if (state.query.trim()) {
      var q = state.query.toLowerCase();
      if ((s.title + ' ' + s.speakers.join(' ')).toLowerCase().indexOf(q) === -1) return false;
    }
    return true;
  }
  function overlaps(a, b) { return a.dayId === b.dayId && a.startMin < b.endMin && b.startMin < a.endMin; }

  /* ---- templates ---- */
  function cardHTML(s, opts) {
    opts = opts || {};
    var th = THEMES[s.theme], c = hueColors(th.hue), room = ROOMS[s.room];
    var live = s.dayId === NOW.dayId && NOW.min >= s.startMin && NOW.min < s.endMin;
    var fav = state.fav.has(s.id);
    var sp = s.speakers[0], more = s.speakers.length - 1;
    var style = '--c-bar:' + c.bar + ';--c-text:' + c.text + ';--c-tint:' + c.tint + ';--c-dot:' + c.dot;
    return '' +
      '<div class="card" style="' + style + '" data-act="open" data-id="' + s.id + '">' +
        '<span class="card-bar"></span>' +
        '<div class="card-main">' +
          '<div class="card-top">' +
            '<span class="theme-tag">' + esc(th.short) + '</span>' +
            '<span class="fmt-pill">' + esc(FORMATS[s.format]) + '</span>' +
            (live ? '<span class="live-pill">● en cours</span>' : '') +
          '</div>' +
          '<h3 class="card-title">' + esc(s.title) + '</h3>' +
          '<div class="card-meta">' +
            '<span class="m-time">' + s.start + '–' + s.end + '</span>' +
            (opts.hideRoom ? '' : '<span class="m-room">' + esc(room.name) + '<i>·' + esc(room.cru) + '</i></span>') +
            (sp ? '<span class="m-sp">' + esc(sp) + (more > 0 ? '<i> +' + more + '</i>' : '') + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<button class="star' + (fav ? ' on' : '') + '" data-act="fav" data-id="' + s.id + '" aria-label="Ajouter à mes sessions">' + (fav ? '★' : '☆') + '</button>' +
      '</div>';
  }

  function listHTML() {
    var all = day().sessions.filter(matchFilters);
    var filtered = activeFilterCount() > 0 || !!state.query.trim();
    if (!all.length) return '<div class="empty"><div class="empty-em">∅</div><p>Aucune session ne correspond.</p><span>Ajustez la recherche ou les filtres.</span></div>';
    all.sort(function (a, b) { return a.startMin - b.startMin || a.room.localeCompare(b.room); });
    var groups = [], cur = null;
    all.forEach(function (s) { if (!cur || cur.start !== s.start) { cur = { start: s.start, startMin: s.startMin, items: [] }; groups.push(cur); } cur.items.push(s); });
    var curStart = null;
    if (state.dayId === NOW.dayId) {
      var liveG = groups.find(function (g) { return NOW.min >= g.startMin && g.items.some(function (i) { return NOW.min < i.endMin; }); });
      var nextG = groups.find(function (g) { return g.startMin >= NOW.min; });
      curStart = (liveG || nextG || {}).start;
    }
    var html = '<div class="list">';
    if (filtered) html += '<div class="result-note">' + all.length + ' session' + (all.length > 1 ? 's' : '') + ' sur ' + day().sessions.length + '</div>';
    groups.forEach(function (g) {
      var live = state.dayId === NOW.dayId && NOW.min >= g.startMin && g.items.some(function (i) { return NOW.min < i.endMin; });
      html += '<section class="slot"' + (g.start === curStart ? ' data-cur="1"' : '') + '>' +
        '<div class="slot-head' + (live ? ' live' : '') + '">' +
          '<span class="slot-time">' + g.start + '</span><span class="slot-rule"></span>' +
          '<span class="slot-count">' + (live ? 'en cours · ' : '') + g.items.length + ' en parallèle</span>' +
        '</div>' +
        g.items.map(function (s) { return cardHTML(s); }).join('') +
      '</section>';
    });
    html += '<div class="list-end">Programme officiel · mise à jour en continu</div></div>';
    return html;
  }

  function laneize(list) {
    var sorted = list.slice().sort(function (a, b) { return a.startMin - b.startMin; });
    var lanes = [];
    sorted.forEach(function (s) {
      var idx = -1;
      for (var i = 0; i < lanes.length; i++) { if (lanes[i] <= s.startMin) { idx = i; break; } }
      if (idx === -1) { idx = lanes.length; lanes.push(0); }
      lanes[idx] = s.endMin; s._lane = idx;
    });
    return { sorted: sorted, laneCount: Math.max(1, lanes.length) };
  }
  var SCALE = 1.55, COLW = 134, AXISW = 44;
  function gridHTML() {
    var all = day().sessions.filter(matchFilters);
    if (!all.length) return '<div class="empty"><div class="empty-em">∅</div><p>Aucune session ne correspond.</p></div>';
    var starts = all.map(function (s) { return s.startMin; }), ends = all.map(function (s) { return s.endMin; });
    var dayStart = Math.floor(Math.min.apply(null, starts) / 30) * 30;
    var dayEnd = Math.ceil(Math.max.apply(null, ends) / 30) * 30;
    var height = (dayEnd - dayStart) * SCALE;
    var rooms = ROOM_ORDER.filter(function (r) { return all.some(function (s) { return s.room === r; }); });
    var nowHere = state.dayId === NOW.dayId && NOW.min >= dayStart && NOW.min <= dayEnd;
    var inner = AXISW + rooms.length * COLW;

    var head = '<div class="grid-head" style="height:44px"><div class="ghead-axis" style="width:' + AXISW + 'px"></div>' +
      rooms.map(function (r) { return '<div class="ghead-room" style="width:' + COLW + 'px"><span class="gh-name">' + esc(ROOMS[r].name) + '</span><span class="gh-cru">' + esc(ROOMS[r].cru) + '</span></div>'; }).join('') + '</div>';

    var ticks = '';
    for (var t = dayStart; t <= dayEnd; t += 30) {
      ticks += '<div class="g-tick' + (t % 60 === 0 ? ' hour' : '') + '" style="top:' + ((t - dayStart) * SCALE) + 'px"><span class="g-tlabel" style="width:' + AXISW + 'px">' + (t % 60 === 0 ? fmtTime(t) : '') + '</span></div>';
    }
    var cols = rooms.map(function (r, ci) {
      var lz = laneize(all.filter(function (s) { return s.room === r; }));
      var w = COLW / lz.laneCount;
      var blocks = lz.sorted.map(function (s) {
        var th = THEMES[s.theme], c = hueColors(th.hue);
        var top = (s.startMin - dayStart) * SCALE, h = (s.endMin - s.startMin) * SCALE - 3;
        var fav = state.fav.has(s.id);
        var st = 'top:' + top + 'px;height:' + h + 'px;left:' + (s._lane * w) + 'px;width:' + (w - 3) + 'px;--c-bar:' + c.bar + ';--c-tint:' + c.tint + ';--c-text:' + c.text;
        return '<button class="g-block' + (fav ? ' fav' : '') + (h < 46 ? ' tiny' : '') + '" style="' + st + '" data-act="open" data-id="' + s.id + '">' +
          '<span class="gb-time">' + s.start + '</span><span class="gb-title">' + esc(s.title) + '</span>' + (fav ? '<span class="gb-star">★</span>' : '') + '</button>';
      }).join('');
      return '<div class="g-col" style="left:' + (AXISW + ci * COLW) + 'px;width:' + COLW + 'px">' + blocks + '</div>';
    }).join('');
    var now = nowHere ? '<div class="now-line" style="top:' + ((NOW.min - dayStart) * SCALE) + 'px;left:' + AXISW + 'px"><span class="now-dot"></span><span class="now-lb">' + fmtTime(NOW.min) + '</span></div>' : '';

    return '<div class="grid-wrap"><div class="grid-scroll"><div class="grid-inner" style="width:' + inner + 'px;height:' + (height + 44) + 'px">' +
      head + '<div class="grid-body" style="height:' + height + 'px">' + ticks + cols + now + '</div></div></div>' +
      '<div class="grid-hint">↔ glissez pour voir les 8 salles · touchez une séance</div></div>';
  }

  function mineHTML() {
    var all = DAYS.reduce(function (acc, d) { return acc.concat(d.sessions); }, []).filter(function (s) { return state.fav.has(s.id); });
    if (!all.length) return '<div class="empty mine"><div class="empty-em">☆</div><p>Votre planning est vide</p><span>Touchez l’étoile d’une session pour la retrouver ici, détecter les conflits d’horaire et l’exporter vers votre agenda.</span><button class="btn-primary" data-act="go" data-day="' + DAYS[0].id + '">Parcourir le programme</button></div>';
    var conflict = new Set();
    for (var i = 0; i < all.length; i++) for (var j = i + 1; j < all.length; j++) if (overlaps(all[i], all[j])) { conflict.add(all[i].id); conflict.add(all[j].id); }
    var html = '<div class="mine-body"><div class="mine-top"><div><div class="mine-h">Mon planning</div><div class="mine-sub">' + all.length + ' session' + (all.length > 1 ? 's' : '') + ' sélectionnée' + (all.length > 1 ? 's' : '') + '</div></div>' +
      '<button class="btn-primary sm" data-act="export-all"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 3v11m0 0l-4-4m4 4l4-4M4 19h16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>Agenda</button></div>';
    if (conflict.size) html += '<div class="conflict-banner"><strong>⚠ ' + Math.round(conflict.size / 2) + ' chevauchement' + (conflict.size > 2 ? 's' : '') + ' d’horaire</strong><span>Deux sessions ou plus se déroulent en même temps.</span></div>';
    DAYS.forEach(function (d) {
      var items = all.filter(function (s) { return s.dayId === d.id; }).sort(function (a, b) { return a.startMin - b.startMin; });
      if (!items.length) return;
      html += '<section class="mine-day"><div class="mine-day-h">' + esc(d.label) + '</div>' +
        items.map(function (s) { return '<div class="mine-card-wrap' + (conflict.has(s.id) ? ' conflict' : '') + '">' + (conflict.has(s.id) ? '<span class="conflict-tag">Conflit</span>' : '') + cardHTML(s) + '</div>'; }).join('') +
      '</section>';
    });
    html += '<div class="list-end">.ics compatible Apple Agenda, Google, Outlook</div></div>';
    return html;
  }

  function detailHTML(s) {
    var th = THEMES[s.theme], c = hueColors(th.hue), room = ROOMS[s.room];
    var d = DAYS.find(function (x) { return x.id === s.dayId; });
    var fav = state.fav.has(s.id);
    var sp = s.speakers.length ? '<div class="sheet-sp"><div class="sp-h">' + (s.speakers.length > 1 ? 'Intervenant·e·s' : 'Intervenant·e') + '</div><div class="sp-list">' +
      s.speakers.map(function (n) { var ini = n.split(' ').slice(-1)[0][0]; return '<span class="sp-chip"><span class="sp-av">' + esc(ini) + '</span>' + esc(n) + '</span>'; }).join('') + '</div></div>' : '';
    return '<div class="sheet-back" data-act="close-sheet"><div class="sheet" style="--c-bar:' + c.bar + ';--c-text:' + c.text + ';--c-tint:' + c.tint + '" data-stop="1">' +
      '<div class="sheet-grip"></div>' +
      '<div class="sheet-tags"><span class="theme-tag big">' + esc(th.short) + '</span><span class="fmt-pill">' + esc(FORMATS[s.format]) + '</span></div>' +
      '<h2 class="sheet-title">' + esc(s.title) + '</h2>' +
      '<div class="sheet-info">' +
        '<div class="d-row"><span class="d-k">Quand</span><span class="d-v">' + esc(d.label) + ' · ' + s.start + ' – ' + s.end + '</span></div>' +
        '<div class="d-row"><span class="d-k">Où</span><span class="d-v">' + esc(room.name) + ' — ' + esc(room.cru) + '</span></div>' +
        '<div class="d-row"><span class="d-k">Référence</span><span class="d-v">' + s.id + '</span></div>' +
      '</div>' + sp +
      '<div class="sheet-actions">' +
        '<button class="btn-primary wide' + (fav ? ' is-fav' : '') + '" data-act="fav" data-id="' + s.id + '">' + (fav ? '★ Retirer de mon planning' : '☆ Ajouter à mon planning') + '</button>' +
        '<button class="btn-ghost" data-act="export-one" data-id="' + s.id + '" aria-label="Ajouter au calendrier"><svg viewBox="0 0 24 24" width="18" height="18"><rect x="4" y="5" width="16" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
      '</div>' +
    '</div></div>';
  }

  function filterHTML() {
    var d = state.draft;
    function group(title, grp, entries) {
      return '<div class="fgroup"><div class="fgroup-h">' + title + '</div><div class="fgroup-chips">' +
        entries.map(function (e) {
          var on = d[grp].has(e[0]);
          var dot = e[2] != null ? '<span class="fchip-dot"></span>' : '';
          var style = e[2] != null ? ' style="--fc:' + hueColors(e[2]).dot + '"' : '';
          return '<button class="fchip' + (on ? ' on' : '') + '"' + style + ' data-act="fchip" data-grp="' + grp + '" data-key="' + e[0] + '">' + dot + esc(e[1]) + '</button>';
        }).join('') + '</div></div>';
    }
    var count = d.theme.size + d.room.size + d.format.size;
    return '<div class="sheet-back" data-act="close-sheet"><div class="sheet filter-sheet" data-stop="1">' +
      '<div class="sheet-grip"></div>' +
      '<div class="filter-head"><h2>Filtres</h2><button class="lnk" data-act="filter-clear">Tout effacer</button></div>' +
      '<div class="filter-scroll">' +
        group('Thème', 'theme', Object.keys(THEMES).map(function (k) { return [k, THEMES[k].short, THEMES[k].hue]; })) +
        group('Salle', 'room', ROOM_ORDER.map(function (k) { return [k, ROOMS[k].name, null]; })) +
        group('Format', 'format', Object.keys(FORMATS).map(function (k) { return [k, FORMATS[k], null]; })) +
      '</div>' +
      '<button class="btn-primary wide apply" data-act="filter-apply">' + (count ? 'Afficher (' + count + ' filtre' + (count > 1 ? 's' : '') + ')' : 'Afficher tout') + '</button>' +
    '</div></div>';
  }

  function chipsActiveHTML() {
    if (activeFilterCount() === 0) return '';
    var f = state.filters, html = '<div class="chips-active">';
    Array.from(f.theme).forEach(function (t) { html += '<span class="chip">' + esc(THEMES[t].short) + '<button data-act="chip-x" data-grp="theme" data-key="' + t + '">×</button></span>'; });
    Array.from(f.room).forEach(function (t) { html += '<span class="chip">' + esc(ROOMS[t].name) + '<button data-act="chip-x" data-grp="room" data-key="' + t + '">×</button></span>'; });
    Array.from(f.format).forEach(function (t) { html += '<span class="chip">' + esc(FORMATS[t]) + '<button data-act="chip-x" data-grp="format" data-key="' + t + '">×</button></span>'; });
    html += '<button class="chip-clear" data-act="chips-clear">Effacer</button></div>';
    return html;
  }

  function headerHTML() {
    var fc = activeFilterCount();
    var days = DAYS.map(function (d) {
      return '<button class="day' + (d.id === state.dayId ? ' on' : '') + '" data-act="day" data-day="' + d.id + '"><span class="day-d">' + d.short + '</span><span class="day-n">' + d.dom + '</span></button>';
    }).join('');
    return '<div class="statusbar"><span id="clock">' + fmtTime(new Date().getHours() * 60 + new Date().getMinutes()) + '</span><span class="sb-r"><span class="dot3"></span> Bordeaux</span></div>' +
      '<header class="appbar">' +
        '<div class="appbar-row"><div class="brand"><span class="brand-mark"></span><div class="brand-txt"><div class="brand-name">Rhinoforum <span>2026</span></div><div class="brand-sub">26ᵉ éd. · Bordeaux · 18–20 juin</div></div></div>' +
          '<button class="icon-btn" data-act="search-toggle" aria-label="Rechercher"><svg viewBox="0 0 24 24" width="21" height="21"><circle cx="10.5" cy="10.5" r="6.3" fill="none" stroke="currentColor" stroke-width="2.1"/><line x1="15.2" y1="15.2" x2="20" y2="20" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg></button></div>' +
        (state.searchOpen ? '<div class="searchbar"><input id="q" value="' + esc(state.query) + '" placeholder="Sujet, orateur, salle…">' + (state.query ? '<button class="clearq" data-act="clearq">×</button>' : '') + '</div>' : '') +
        (state.view !== 'mine' ? '<div class="daybar"><div class="days">' + days + '</div><button class="filter-btn' + (fc ? ' has' : '') + '" data-act="filter-open"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' + (fc ? '<span class="fcount">' + fc + '</span>' : '') + '</button></div>' : '') +
        (state.view !== 'mine' ? chipsActiveHTML() : '') +
      '</header>';
  }

  function tabbarHTML() {
    function tab(v, label, ic, badge) {
      return '<button class="tab' + (state.view === v ? ' on' : '') + '" data-act="tab" data-view="' + v + '"><span class="tab-ic">' + ic + (badge > 0 ? '<span class="tab-badge">' + badge + '</span>' : '') + '</span><span class="tab-lb">' + label + '</span></button>';
    }
    var icList = '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3.5" y="5" width="17" height="2.2" rx="1.1" fill="currentColor"/><rect x="3.5" y="11" width="17" height="2.2" rx="1.1" fill="currentColor"/><rect x="3.5" y="17" width="17" height="2.2" rx="1.1" fill="currentColor"/></svg>';
    var icGrid = '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" fill="currentColor"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" fill="currentColor"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" fill="currentColor"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" fill="currentColor"/></svg>';
    var icStar = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3.6l2.5 5.06 5.58.81-4.04 3.94.95 5.56L12 16.34 6.99 19l.95-5.56L3.9 9.5l5.58-.81L12 3.6z" fill="currentColor"/></svg>';
    return '<nav class="tabbar">' + tab('list', 'Programme', icList) + tab('grid', 'Grille', icGrid) + tab('mine', 'Mes sessions', icStar, state.fav.size) + '</nav>';
  }

  /* ---- rendu ---- */
  var root = document.getElementById('app');
  function render() {
    var body = state.view === 'list' ? listHTML() : state.view === 'grid' ? gridHTML() : mineHTML();
    var overlay = state.detail ? detailHTML(state.detail) : (state.filterOpen ? filterHTML() : '');
    root.innerHTML = headerHTML() + '<main class="screen-body">' + body + '</main>' + tabbarHTML() + overlay;

    // repositionnement cohérent à l'ouverture / changement de jour
    var sc = root.querySelector('.screen-body');
    if (state.view === 'list' && state.dayId === NOW.dayId) {
      var cur = root.querySelector('[data-cur="1"]');
      if (sc && cur) { var top = cur.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 6; sc.scrollTop = Math.max(0, top); }
    }
    if (state.view === 'grid' && state.dayId === NOW.dayId) {
      var gs = root.querySelector('.grid-scroll');
      var all = day().sessions.filter(matchFilters);
      if (gs && all.length) { var ds = Math.floor(Math.min.apply(null, all.map(function (s) { return s.startMin; })) / 30) * 30; if (NOW.min >= ds) gs.scrollTop = Math.max(0, (NOW.min - ds) * SCALE - 130); }
    }
    if (state.searchOpen) { var q = document.getElementById('q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  }

  /* ---- export .ics ---- */
  function exportICS(list) {
    var ev = function (t) { return String(t).replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n'); };
    var dt = function (dom, t) { return ('2026-06-' + dom + 'T' + t + ':00').replace(/[-:]/g, ''); };
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rhinoforum2026//FR', 'CALSCALE:GREGORIAN'];
    list.forEach(function (s) {
      var room = ROOMS[s.room];
      lines.push('BEGIN:VEVENT', 'UID:' + s.id + '@rhinoforum2026',
        'DTSTART:' + dt(DOM[s.dayId], s.start), 'DTEND:' + dt(DOM[s.dayId], s.end),
        'SUMMARY:' + ev(s.title), 'LOCATION:' + ev(room.name + ' — ' + room.cru),
        'DESCRIPTION:' + ev(THEMES[s.theme].label + ' · ' + FORMATS[s.format] + (s.speakers.length ? ' · ' + s.speakers.join(', ') : '')),
        'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = list.length > 1 ? 'rhinoforum-2026.ics' : 'rhinoforum-' + list[0].id + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function findSession(id) { for (var i = 0; i < DAYS.length; i++) { var s = DAYS[i].sessions.find(function (x) { return x.id === id; }); if (s) return s; } return null; }

  /* ---- événements (délégation) ---- */
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    var id = t.getAttribute('data-id');
    switch (act) {
      case 'day': state.dayId = t.getAttribute('data-day'); render(); break;
      case 'tab': state.view = t.getAttribute('data-view'); state.detail = null; state.filterOpen = false; render(); break;
      case 'search-toggle': state.searchOpen = !state.searchOpen; if (!state.searchOpen) state.query = ''; render(); break;
      case 'clearq': state.query = ''; render(); break;
      case 'fav': state.fav.has(id) ? state.fav.delete(id) : state.fav.add(id); saveFav(); render(); break;
      case 'open': state.detail = findSession(id); render(); break;
      case 'close-sheet': if (e.target.closest('[data-stop]')) return; state.detail = null; state.filterOpen = false; render(); break;
      case 'filter-open': state.draft = { theme: new Set(state.filters.theme), room: new Set(state.filters.room), format: new Set(state.filters.format) }; state.filterOpen = true; render(); break;
      case 'fchip': { var g = t.getAttribute('data-grp'), k = t.getAttribute('data-key'); state.draft[g].has(k) ? state.draft[g].delete(k) : state.draft[g].add(k); render(); break; }
      case 'filter-clear': state.draft = { theme: new Set(), room: new Set(), format: new Set() }; render(); break;
      case 'filter-apply': state.filters = state.draft; state.filterOpen = false; render(); break;
      case 'chip-x': { var g2 = t.getAttribute('data-grp'), k2 = t.getAttribute('data-key'); state.filters[g2].delete(k2); render(); break; }
      case 'chips-clear': state.filters = { theme: new Set(), room: new Set(), format: new Set() }; render(); break;
      case 'export-all': exportICS(DAYS.reduce(function (a, d) { return a.concat(d.sessions); }, []).filter(function (s) { return state.fav.has(s.id); })); break;
      case 'export-one': exportICS([findSession(id)]); break;
      case 'go': state.view = 'list'; state.dayId = t.getAttribute('data-day'); render(); break;
    }
  });
  root.addEventListener('input', function (e) {
    if (e.target.id === 'q') { state.query = e.target.value; render(); }
  });

  render();
  // horloge status-bar
  setInterval(function () { var c = document.getElementById('clock'); if (c) c.textContent = fmtTime(new Date().getHours() * 60 + new Date().getMinutes()); }, 30000);
})();
