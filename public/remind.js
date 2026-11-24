/* Local AM/PM and sunscreen reminders. No paid push service. */
(function (root) {
  'use strict';
  var lastShown = {};

  function supported() { return typeof Notification === 'function'; }
  function perm() { return supported() ? Notification.permission : 'denied'; }

  function nextAt(hhmm) {
    var p = String(hhmm || '08:00').split(':');
    var h = Math.max(0, Math.min(23, parseInt(p[0], 10) || 0));
    var m = Math.max(0, Math.min(59, parseInt(p[1], 10) || 0));
    var d = new Date();
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= Date.now() + 15000) d.setDate(d.getDate() + 1);
    return d;
  }

  function show(title, body, tag, url) {
    if (perm() !== 'granted') return Promise.resolve();
    lastShown[tag] = Date.now();
    var opts = { body: body, tag: tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: url || '/#routine' } };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.showNotification(title, opts);
      }).catch(function () { return new Notification(title, opts); });
    }
    try { return Promise.resolve(new Notification(title, opts)); } catch (e) { return Promise.resolve(); }
  }

  function scheduleTriggers(cfg) {
    if (!cfg || !cfg.on || perm() !== 'granted') return;
    if (typeof TimestampTrigger !== 'function') return;
    navigator.serviceWorker.ready.then(function (reg) {
      var jobs = [
        { at: nextAt(cfg.am), title: 'GN Care · Morning routine', body: 'Time for your AM steps.', tag: 'gn-am', url: '/#routine' },
        { at: nextAt(cfg.pm), title: 'GN Care · Night routine', body: 'Time for your PM steps.', tag: 'gn-pm', url: '/#routine' }
      ];
      jobs.forEach(function (j) {
        reg.showNotification(j.title, {
          body: j.body, tag: j.tag + '-sched', icon: '/icons/icon-192.png',
          data: { url: j.url }, showTrigger: new TimestampTrigger(j.at.getTime())
        }).catch(function () {});
      });
    }).catch(function () {});
  }

  function dueOnOpen(cfg, uvAppliedAt) {
    if (!cfg || !cfg.on || perm() !== 'granted') return;
    var now = new Date();
    function isDue(hhmm, tag, windowMin) {
      var p = String(hhmm || '').split(':');
      var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
      if (isNaN(h)) return false;
      var t = new Date(); t.setHours(h, m || 0, 0, 0);
      var dt = now.getTime() - t.getTime();
      if (dt < 0 || dt > (windowMin || 90) * 60000) return false;
      var last = lastShown[tag] || 0;
      return now.getTime() - last > 6 * 3600000;
    }
    if (isDue(cfg.am, 'gn-am', 120)) show('GN Care · Morning routine', 'Your AM routine is waiting.', 'gn-am', '/#routine');
    if (isDue(cfg.pm, 'gn-pm', 150)) show('GN Care · Night routine', 'Your PM routine is waiting.', 'gn-pm', '/#routine');
    if (cfg.spf && uvAppliedAt && now.getTime() - uvAppliedAt >= 2 * 3600000) {
      if (!lastShown['gn-spf'] || now.getTime() - lastShown['gn-spf'] > 2 * 3600000) {
        show('GN Care · Reapply sunscreen', 'It has been about two hours since you logged sunscreen.', 'gn-spf', '/#');
      }
    }
  }

  function requestAfterRoutine(cfg, onDone) {
    if (!supported()) { if (onDone) onDone('unsupported'); return; }
    if (perm() === 'granted') { if (onDone) onDone('granted'); return; }
    if (perm() === 'denied') { if (onDone) onDone('denied'); return; }
    Notification.requestPermission().then(function (p) { if (onDone) onDone(p); });
  }

  function registerSync() {
    if (!navigator.serviceWorker || !('periodicSync' in (navigator.serviceWorker || {}))) {
      navigator.serviceWorker && navigator.serviceWorker.ready.then(function (reg) {
        if (reg.periodicSync) {
          return reg.periodicSync.register('gn-reminders', { minInterval: 60 * 60 * 1000 }).catch(function () {});
        }
      });
    }
  }

  root.GNRemind = { supported: supported, perm: perm, show: show, scheduleTriggers: scheduleTriggers, dueOnOpen: dueOnOpen, requestAfterRoutine: requestAfterRoutine, registerSync: registerSync };
})(typeof window !== 'undefined' ? window : this);
