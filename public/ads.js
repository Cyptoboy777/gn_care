/* GN Care ads: Consent Mode v2, load AdSense only after a choice, fixed-size lazy slots. */
(function () {
  'use strict';
  var C = window.GN_CONFIG || {};
  var KEY = 'gn-consent-v2';
  var LEGACY = 'gn-ads-consent';
  var loaded = false;
  var want = false;

  function enabled() { return /^ca-pub-\d{10,}$/.test(C.ADSENSE_CLIENT || ''); }

  function get() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
      var old = localStorage.getItem(LEGACY);
      if (old === 'p') return { ads: true, personalization: true, analytics: false };
      if (old === 'np') return { ads: true, personalization: false, analytics: false };
      if (old === 'none') return { ads: false, personalization: false, analytics: false };
    } catch (e) {}
    return null;
  }
  function set(v) {
    try { localStorage.setItem(KEY, JSON.stringify({ ads: !!v.ads, personalization: !!v.personalization, analytics: !!v.analytics, at: Date.now() })); } catch (e) {}
  }
  function choice() { return get(); }

  function applyConsent(c) {
    if (typeof window.gtag !== 'function') return;
    var adsOn = !!(c && c.ads);
    var pers = !!(c && c.ads && c.personalization);
    window.gtag('consent', 'update', {
      ad_storage: adsOn ? 'granted' : 'denied',
      ad_user_data: pers ? 'granted' : 'denied',
      ad_personalization: pers ? 'granted' : 'denied',
      analytics_storage: (c && c.analytics) ? 'granted' : 'denied'
    });
  }

  function load() {
    if (loaded || !enabled()) return;
    var c = get();
    if (!c || !c.ads) return;
    loaded = true;
    applyConsent(c);
    window.adsbygoogle = window.adsbygoogle || [];
    if (!c.personalization) window.adsbygoogle.requestNonPersonalizedAds = 1;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(C.ADSENSE_CLIENT);
    document.head.appendChild(s);
  }

  function fill(el) {
    if (!enabled()) return;
    var c = get();
    if (!c || !c.ads) return;
    load();
    el.hidden = false;
    el.setAttribute('data-filled', '1');
    var slot = (C.SLOTS || {})[el.getAttribute('data-ad')];
    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.style.width = '100%';
    ins.style.height = '250px';
    ins.setAttribute('data-ad-client', C.ADSENSE_CLIENT);
    if (slot) ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', 'rectangle');
    ins.setAttribute('data-full-width-responsive', 'false');
    el.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  }

  function lazyFill(el) {
    if (el.getAttribute('data-filled')) { el.hidden = false; return; }
    if (typeof IntersectionObserver !== 'function') { fill(el); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.disconnect();
        fill(el);
      });
    }, { rootMargin: '200px' });
    io.observe(el);
  }

  function apply() {
    var els = document.querySelectorAll('[data-ad]');
    var c = get();
    if (!enabled() || !c || !c.ads) {
      for (var i = 0; i < els.length; i++) els[i].hidden = true;
      return;
    }
    if (C.AUTO_ADS) { load(); return; }
    for (var j = 0; j < els.length; j++) {
      var el = els[j];
      if (el.id === 'ad-app') {
        if (want) { if (el.getAttribute('data-filled')) el.hidden = false; else lazyFill(el); }
        else if (el.getAttribute('data-filled')) el.hidden = true;
      } else if (!el.getAttribute('data-filled')) {
        lazyFill(el);
      }
    }
  }

  function hideBanner() {
    var d = document.getElementById('gn-consent');
    if (d) d.remove();
  }

  function saveAndApply(c) {
    set(c);
    applyConsent(c);
    hideBanner();
    if (loaded && c && c.ads) { location.reload(); return; }
    apply();
  }

  function customizeHTML(c) {
    c = c || { ads: true, personalization: false, analytics: false };
    return '<div class="consent-in"><b>Cookie settings</b>' +
      '<p>Necessary cookies keep the app working (your routine, settings and cookie choice). They are always on. See our <a href="/privacy">Privacy Policy</a>.</p>' +
      '<label class="consent-row"><span><b>Necessary</b><small>App settings and your consent choice</small></span><input type="checkbox" checked disabled></label>' +
      '<label class="consent-row"><span><b>Ads personalisation</b><small>Allow Google to show ads that may match your interests. If this is off, we still show non-personalised ads when ads are enabled.</small></span><input type="checkbox" id="gn-c-pers"' + (c.personalization ? ' checked' : '') + '></label>' +
      '<label class="consent-row"><span><b>Analytics</b><small>Help us understand aggregate use. No analytics script is loaded unless you turn this on and we add one later.</small></span><input type="checkbox" id="gn-c-an"' + (c.analytics ? ' checked' : '') + '></label>' +
      '<div class="btn-grid"><button type="button" class="btn" data-c="save">Save choices</button>' +
      '<button type="button" class="btn ghost" data-c="back">Back</button></div></div>';
  }

  function banner(mode) {
    var existing = document.getElementById('gn-consent');
    if (existing) existing.remove();
    var d = document.createElement('div');
    d.className = 'consent';
    d.id = 'gn-consent';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', 'Cookie and ad preferences');
    function mainView() {
      d.innerHTML = '<div class="consent-in"><b>Cookies and ads keep GN Care free</b>' +
        '<p>We use necessary cookies so the app works. If you accept, ads may be personalised. If you reject, we show non-personalised ads only. You can customise this or change it later in Settings. See our <a href="/privacy">Privacy Policy</a>.</p>' +
        '<div class="btn-grid"><button type="button" class="btn" data-c="accept">Accept</button>' +
        '<button type="button" class="btn ghost" data-c="reject">Reject</button>' +
        '<button type="button" class="btn ghost" data-c="customize">Customise</button></div></div>';
    }
    if (mode === 'customize') d.innerHTML = customizeHTML(get() || { ads: true, personalization: false, analytics: false });
    else mainView();
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]');
      if (!b) return;
      var v = b.getAttribute('data-c');
      if (v === 'accept') { saveAndApply({ ads: true, personalization: true, analytics: true }); return; }
      if (v === 'reject') { saveAndApply({ ads: true, personalization: false, analytics: false }); return; }
      if (v === 'customize') { d.innerHTML = customizeHTML(get() || { ads: true, personalization: false, analytics: false }); return; }
      if (v === 'back') { mainView(); return; }
      if (v === 'save') {
        var pers = !!(d.querySelector('#gn-c-pers') && d.querySelector('#gn-c-pers').checked);
        var an = !!(d.querySelector('#gn-c-an') && d.querySelector('#gn-c-an').checked);
        saveAndApply({ ads: true, personalization: pers, analytics: an });
      }
    });
    document.body.appendChild(d);
  }

  window.GNAds = {
    enabled: function () { return enabled() && C.OWN_CONSENT_BANNER !== false; },
    show: function (flag) { want = !!flag; apply(); },
    reopen: function () { banner(); },
    choice: choice
  };

  function init() {
    var c = get();
    if (c) applyConsent(c);
    if (!enabled()) return;
    if (C.OWN_CONSENT_BANNER !== false && !c) banner();
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
