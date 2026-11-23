/* GN Care ads: loads Google AdSense only after the visitor chooses an ad preference. */
(function () {
  'use strict';
  var C = window.GN_CONFIG || {};
  var KEY = 'gn-ads-consent';
  var want = false;
  var loaded = false;

  function enabled() { return /^ca-pub-\d{10,}$/.test(C.ADSENSE_CLIENT || ''); }
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function consented() {
    if (C.OWN_CONSENT_BANNER === false) return true;
    var c = get();
    return c === 'p' || c === 'np';
  }

  function load() {
    if (loaded) return;
    loaded = true;
    window.adsbygoogle = window.adsbygoogle || [];
    if (get() === 'np') window.adsbygoogle.requestNonPersonalizedAds = 1;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(C.ADSENSE_CLIENT);
    document.head.appendChild(s);
  }

  function fill(el) {
    var slot = (C.SLOTS || {})[el.getAttribute('data-ad')];
    if (!slot) return;
    load();
    el.hidden = false;
    el.setAttribute('data-filled', '1');
    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', C.ADSENSE_CLIENT);
    ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    el.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  }

  function apply() {
    var els = document.querySelectorAll('[data-ad]');
    if (!enabled()) return;
    if (!consented()) { for (var i = 0; i < els.length; i++) els[i].hidden = true; return; }
    if (C.AUTO_ADS) { load(); return; }
    for (var j = 0; j < els.length; j++) {
      var el = els[j];
      if (el.id === 'ad-app') {
        /* one persistent slot under the app: requested once, then only shown or hidden */
        if (want) { if (el.getAttribute('data-filled')) el.hidden = false; else fill(el); }
        else if (el.getAttribute('data-filled')) el.hidden = true;
      } else if (!el.getAttribute('data-filled')) {
        fill(el);
      }
    }
  }

  function banner() {
    if (document.getElementById('gn-consent')) return;
    var d = document.createElement('div');
    d.className = 'consent';
    d.id = 'gn-consent';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', 'Ad preferences');
    d.innerHTML = '<div class="consent-in"><b>Ads keep GN Care free</b>' +
      '<p>Choose how ads are shown. Personalised ads use cookies to match ads to your interests. You can change this any time in Settings. See our <a href="/privacy.html">Privacy Policy</a>.</p>' +
      '<div class="btn-grid"><button type="button" class="btn" data-c="p">Personalised ads</button>' +
      '<button type="button" class="btn ghost" data-c="np">Non-personalised ads</button>' +
      '<button type="button" class="btn ghost" data-c="none">No ads</button></div></div>';
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]');
      if (!b) return;
      set(b.getAttribute('data-c'));
      d.remove();
      if (loaded) { location.reload(); return; }
      apply();
    });
    document.body.appendChild(d);
  }

  window.GNAds = {
    enabled: function () { return enabled() && C.OWN_CONSENT_BANNER !== false; },
    show: function (flag) { want = !!flag; apply(); },
    reopen: banner
  };

  function init() {
    if (!enabled()) return;
    if (C.OWN_CONSENT_BANNER !== false && !get()) banner();
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
