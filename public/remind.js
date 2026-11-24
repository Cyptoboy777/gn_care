/* GN Care reminders: local notifications only (no push server, no cost).
   The same pure rules run in the page (while open) and in the service worker (periodic background sync,
   when the browser allows it). Config + a small state snapshot live in Cache Storage so the worker can read them. */
(function (root) {
  'use strict';
  var STORE = 'gn-remind', KEY = '/__gn/remind.json', H = 3600000;
  var DEF = { asked: false, on: false, am: '08:00', pm: '21:00', spf: true, water: false, waterEvery: 2, scan: true, scanDay: 0, repurchase: true, quietFrom: '22:00', quietTo: '07:00' };

  function cfgOf(c) { var o = {}; for (var k in DEF) o[k] = (c && c[k] !== undefined) ? c[k] : DEF[k]; return o; }
  function supported() { return typeof Notification === 'function' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator; }
  function perm() { return typeof Notification === 'function' ? Notification.permission : 'denied'; }
  function mins(hhmm) { var p = String(hhmm || '').split(':'); var h = parseInt(p[0], 10), m = parseInt(p[1], 10) || 0; return isNaN(h) ? null : Math.max(0, Math.min(23, h)) * 60 + Math.max(0, Math.min(59, m)); }
  function day(d) { d = new Date(d); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function inQuiet(cfg, now) {
    var a = mins(cfg.quietFrom), b = mins(cfg.quietTo); if (a === null || b === null || a === b) return false;
    var n = now.getHours() * 60 + now.getMinutes();
    return a < b ? (n >= a && n < b) : (n >= a || n < b);
  }

  var ACT_ROUTINE = [{ action: 'done', title: 'Done' }, { action: 'snooze', title: 'Snooze 30 min' }];

  /* Pure: which reminders are due now. st = snapshot from the app + what notifications already did. */
  function dueList(c, st, nowArg) {
    var cfg = cfgOf(c), now = new Date(nowArg || Date.now()), t = now.getTime(), out = [];
    st = st || {}; var shown = st.lastShown || {}, snooze = st.snooze || {}, done = st.doneTags || {}, today = day(now);
    if (!cfg.on || inQuiet(cfg, now)) return out;
    var fresh = st.date === today, waterToday = fresh ? (st.waterToday || 0) : 0;
    function snoozed(tag) { return snooze[tag] && snooze[tag] > t; }
    function snoozeDue(tag) { return snooze[tag] && snooze[tag] <= t && (shown[tag] || 0) < snooze[tag]; }
    function shownToday(tag) { return shown[tag] && day(shown[tag]) === today; }
    function add(tag, title, body, url, actions) { out.push({ tag: tag, title: title, body: body, url: url, actions: actions || [] }); }
    var nm = now.getHours() * 60 + now.getMinutes();
    [['am', 'Morning routine', 'Your AM steps are waiting. Cleanser, moisturizer, sunscreen.'], ['pm', 'Night routine', 'Time for your PM steps before bed.']].forEach(function (r) {
      var tag = 'gn-' + r[0], at = mins(cfg[r[0]]);
      if (at === null || (fresh && st[r[0] + 'Done']) || done[tag] === today || snoozed(tag)) return;
      if (snoozeDue(tag) || (nm >= at && nm - at <= 180 && !shownToday(tag))) add(tag, 'GN Care · ' + r[1], r[2], '/#routine', ACT_ROUTINE);
    });
    if (cfg.spf && st.uvAppliedAt && !snoozed('gn-spf')) {
      var since = t - st.uvAppliedAt, h = now.getHours();
      if ((snoozeDue('gn-spf') || (since >= 2 * H && since <= 10 * H && (shown['gn-spf'] || 0) < st.uvAppliedAt + 2 * H)) && h >= 8 && h < 18)
        add('gn-spf', 'GN Care · Reapply sunscreen', 'About two hours since your last sunscreen. Reapply if you are outdoors or near windows.', '/#home', [{ action: 'done', title: 'Reapplied' }, { action: 'snooze', title: 'Snooze 30 min' }]);
    }
    if (cfg.water && st.goal > 0 && waterToday < st.goal && !snoozed('gn-water')) {
      var every = Math.max(1, Math.min(6, Number(cfg.waterEvery) || 2)) * H, hr = now.getHours();
      if (hr >= 9 && hr < 21 && (snoozeDue('gn-water') || (t - (shown['gn-water'] || 0) >= every && t - (st.lastWaterAt || 0) >= every)))
        add('gn-water', 'GN Care · Water break', 'You are at ' + waterToday + ' of ' + st.goal + ' ml today.', '/#home', [{ action: 'done', title: '+250 ml' }, { action: 'snooze', title: 'Snooze 30 min' }]);
    }
    if (cfg.scan && now.getDay() === Number(cfg.scanDay) && now.getHours() >= 10) {
      var last = st.lastScanAt || st.firstSeen || t;
      if (t - last >= 6.5 * 24 * H && t - (shown['gn-scan'] || 0) >= 6 * 24 * H)
        add('gn-scan', 'GN Care · Weekly progress check', 'Take a quick scan or progress photo in the same light as last week to see what changed.', '/#scan');
    }
    if (cfg.repurchase && st.shelfSoon) st.shelfSoon.forEach(function (it) {
      var tag = 'gn-shelf-' + it.id;
      if (it.days <= 14 && t - (shown[tag] || 0) >= 7 * 24 * H && now.getHours() >= 10)
        add(tag, 'GN Care · ' + String(it.n).slice(0, 40), it.days < 0 ? 'This product is past its use-by period after opening. Time to replace it.' : 'Use within ' + it.days + ' days after opening. Plan a repurchase if you love it.', '/#shelf');
    });
    return out;
  }

  /* ---- storage shared with the service worker ---- */
  function read() {
    if (typeof caches === 'undefined') return Promise.resolve({});
    return caches.open(STORE).then(function (c) { return c.match(KEY); }).then(function (r) { return r ? r.json() : {}; }).catch(function () { return {}; });
  }
  function write(obj) {
    if (typeof caches === 'undefined') return Promise.resolve();
    return caches.open(STORE).then(function (c) { return c.put(KEY, new Response(JSON.stringify(obj), { headers: { 'Content-Type': 'application/json' } })); }).catch(function () {});
  }
  /* Merge the app's snapshot with what notifications recorded (lastShown, snooze, done, pending water). */
  function sync(cfg, snap) {
    return read().then(function (old) {
      var st = old.st || {};
      ['lastShown', 'snooze', 'doneTags'].forEach(function (k) { snap[k] = st[k] || {}; });
      snap.pending = st.pending || {};
      snap.date = day(Date.now());
      var obj = { cfg: cfgOf(cfg), st: snap };
      return write(obj).then(function () { return obj; });
    });
  }
  function clearPending() { return read().then(function (o) { if (o.st) { o.st.pending = {}; return write(o); } }); }

  function opts(j) { return { body: j.body, tag: j.tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: j.url || '/', tag: j.tag }, actions: j.actions || [], renotify: false }; }
  function fire(reg, obj, now) {
    var list = dueList(obj.cfg, obj.st, now);
    if (!list.length) return Promise.resolve(0);
    obj.st.lastShown = obj.st.lastShown || {};
    list.forEach(function (j) { obj.st.lastShown[j.tag] = now || Date.now(); });
    return write(obj).then(function () { return Promise.all(list.map(function (j) { return reg.showNotification(j.title, opts(j)).catch(function () {}); })); }).then(function () { return list.length; });
  }
  /* Page side: run the rules now (app open or in a background tab). */
  function check(cfg, snap) {
    if (!supported() || perm() !== 'granted' || !cfg || !cfg.on) return Promise.resolve(0);
    return sync(cfg, snap).then(function (obj) { return navigator.serviceWorker.ready.then(function (reg) { return fire(reg, obj); }); }).catch(function () { return 0; });
  }
  function test() {
    if (perm() !== 'granted') return Promise.resolve(false);
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.showNotification('GN Care · Reminders are on', opts({ body: 'This is how reminders will look. Tap Done or Snooze right here.', tag: 'gn-test', url: '/#routine', actions: ACT_ROUTINE })).then(function () { return true; });
    }).catch(function () { return false; });
  }
  function request(onDone) {
    if (!supported()) return onDone && onDone('unsupported');
    if (perm() !== 'default') return onDone && onDone(perm());
    Notification.requestPermission().then(function (p) { if (onDone) onDone(p); }, function () { if (onDone) onDone('denied'); });
  }
  /* Chrome (installed PWA) may wake the worker roughly a few times a day. Best effort only. */
  function registerSync() {
    if (!supported()) return;
    navigator.serviceWorker.ready.then(function (reg) {
      if (!reg.periodicSync) return;
      var go = function () { return reg.periodicSync.register('gn-reminders', { minInterval: H }).catch(function () {}); };
      if (navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (s) { if (s.state === 'granted') go(); }, go);
      else go();
    }).catch(function () {});
  }

  /* ---- service worker side ---- */
  function onAction(action, tag) {
    return read().then(function (o) {
      if (!o.cfg) return o;
      var st = o.st = o.st || {}, now = Date.now();
      st.snooze = st.snooze || {}; st.doneTags = st.doneTags || {}; st.pending = st.pending || {};
      if (action === 'snooze') st.snooze[tag] = now + 30 * 60000;
      if (action === 'done') {
        st.doneTags[tag] = day(now); delete st.snooze[tag];
        if (tag === 'gn-spf') { st.uvAppliedAt = now; st.pending.uvAppliedAt = now; }
        if (tag === 'gn-water') { if (st.date !== day(now)) { st.date = day(now); st.waterToday = 0; st.amDone = false; st.pmDone = false; } st.waterToday = (st.waterToday || 0) + 250; st.lastWaterAt = now; st.pending.water = (st.pending.water || 0) + 250; }
      }
      return write(o).then(function () { return o; });
    });
  }
  function periodic(reg) { return read().then(function (o) { return o.cfg ? fire(reg, o) : 0; }); }

  root.GNRemind = { DEF: DEF, cfgOf: cfgOf, supported: supported, perm: perm, dueList: dueList, inQuiet: inQuiet, check: check, sync: sync, read: read, clearPending: clearPending, test: test, request: request, registerSync: registerSync, onAction: onAction, periodic: periodic };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GNRemind;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
