/* Deals tab: Flipkart listings from /deals.json plus fixed EarnKaro Myntra links. */
(function (root) {
  'use strict';

  var CATS = [
    { id: 'all', label: 'All' },
    { id: 'men-clothing', label: "Men's clothing" },
    { id: 'women-clothing', label: "Women's clothing" },
    { id: 'laptops', label: 'Laptops' },
    { id: 'mobile-accessories', label: 'Mobile accessories' },
    { id: 'electronics-accessories', label: 'Electronics accessories' },
    { id: 'beauty', label: 'Beauty' }
  ];
  var MYNTRA = {
    fashion: { label: 'Shop Myntra fashion', url: 'https://myntr.it/zHNk6zz' },
    under399: { label: 'Myntra deals under ₹399', url: 'https://myntr.it/afrMHGG' }
  };

  var esc = function (s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var inr = new Intl.NumberFormat('en-IN');
  var money = function (n) { return '₹' + inr.format(Math.round(n)); };

  var state = { cat: 'all', deals: null, err: '', loading: true };

  function priceAsOf(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) {
      var day = String(iso).slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(day) ? 'Price as of ' + day : '';
    }
    return 'Price as of ' + d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Calcutta'
    });
  }

  function categories() {
    return (state.deals && state.deals.categories) || [];
  }

  function itemsFor(cat) {
    var all = [];
    var seen = Object.create(null);
    categories().forEach(function (c) {
      if (cat !== 'all' && c.id !== cat) return;
      (c.items || []).forEach(function (it) {
        if (!it || !it.id || seen[it.id]) return;
        if (typeof it.price !== 'number' || !(it.price > 0) || !it.url) return;
        seen[it.id] = true;
        all.push(it);
      });
    });
    all.sort(function (a, b) {
      var da = a.discount != null ? a.discount : -1;
      var db = b.discount != null ? b.discount : -1;
      if (db !== da) return db - da;
      return (b.mrp && b.price ? b.mrp - b.price : 0) - (a.mrp && a.price ? a.mrp - a.price : 0);
    });
    return all;
  }

  function extLink(href, label, extraClass) {
    return '<a class="' + (extraClass || 'btn') + '" href="' + esc(href) + '" target="_blank" rel="sponsored nofollow noopener">' + esc(label) + '</a>';
  }

  function myntraCard() {
    return '<section class="tile store-deals-myntra" aria-label="Myntra">' +
      '<div><h3 class="t">Myntra</h3>' +
      '<p class="hint">Fashion on Myntra. These open the store via an EarnKaro tracked link. We do not show a Myntra price here.</p></div>' +
      '<div class="btn-grid">' +
      extLink(MYNTRA.fashion.url, MYNTRA.fashion.label, 'btn') +
      extLink(MYNTRA.under399.url, MYNTRA.under399.label, 'btn ghost') +
      '</div></section>';
  }

  function card(it) {
    var asOf = priceAsOf(it.fetchedAt);
    var img = it.image
      ? '<div class="store-deals-img"><img src="' + esc(it.image) + '" alt="" width="400" height="400" loading="lazy"></div>'
      : '<div class="store-deals-img store-deals-img-empty" aria-hidden="true"></div>';
    var price = '<div class="store-deals-price"><span class="store-deals-now">' + money(it.price) + '</span>' +
      (it.mrp != null && it.mrp > it.price ? '<span class="mrp"><s>' + money(it.mrp) + '</s></span>' : '') +
      (it.discount != null ? '<span class="chip good">' + it.discount + '% off</span>' : '') +
      '</div>';
    return '<article class="store-deals-card">' + img +
      '<div class="store-deals-body">' +
      (it.brand ? '<p class="store-deals-brand">' + esc(it.brand) + '</p>' : '') +
      '<h3 class="store-deals-title">' + esc(it.title) + '</h3>' +
      price +
      (asOf ? '<p class="hint store-deals-asof">' + esc(asOf) + '</p>' : '') +
      extLink(it.url, 'Buy on Flipkart', 'btn sm') +
      '</div></article>';
  }

  function chips(active, counts) {
    return '<div class="chips store-deals-chips" role="tablist" aria-label="Deal categories">' +
      CATS.map(function (c) {
        var n = counts[c.id];
        var label = c.label + (typeof n === 'number' ? ' (' + n + ')' : '');
        return '<button type="button" data-deal-cat="' + esc(c.id) + '" aria-pressed="' + (active === c.id) + '">' + esc(label) + '</button>';
      }).join('') +
      '</div>';
  }

  function bodyHTML() {
    var fetched = state.deals && state.deals.fetchedAt;
    var asOf = priceAsOf(fetched);
    var counts = { all: 0 };
    CATS.forEach(function (c) { if (c.id !== 'all') counts[c.id] = itemsFor(c.id).length; });
    counts.all = itemsFor('all').length;
    var items = itemsFor(state.cat);
    var head = '<div class="head"><p class="eyebrow">Today\'s deals</p><h2 class="page-h">Store <em>deals</em></h2>' +
      '<p class="sub">Live Flipkart listings with a real price. ' + (asOf ? esc(asOf) + '. ' : '') +
      'Buy opens Flipkart. Check the price at checkout.</p></div>';
    var status = '';
    if (state.loading && !state.deals) status = '<p class="hint">Loading Flipkart deals…</p>';
    else if (state.err && !state.deals) status = '<p class="hint">Could not load deals just now. Try again later.</p>';
    else if (!items.length) status = '<p class="hint">No Flipkart deals with a real price in this category yet. Check back after the daily sync.</p>';
    var grid = items.length ? '<div class="store-deals-grid">' + items.map(card).join('') + '</div>' : '';
    var legal = '<p class="hint store-deals-legal">As an Amazon Associate, Flipkart affiliate, and via EarnKaro, GN Care may earn from qualifying purchases. We do not invent prices, ratings or coupons.</p>';
    return '<div id="deals-root" class="store-deals">' + head + myntraCard() + chips(state.cat, counts) + status + grid + legal + '</div>';
  }

  function paint() {
    var root = typeof document !== 'undefined' && document.getElementById('deals-root');
    if (!root) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = bodyHTML();
    var next = wrap.firstChild;
    if (next) root.replaceWith(next);
  }

  function setCat(id) {
    var ok = CATS.some(function (c) { return c.id === id; });
    if (!ok) return;
    state.cat = id;
    paint();
  }

  function view() { return bodyHTML(); }

  function applyData(data) {
    if (!data || !Array.isArray(data.categories)) return;
    state.deals = data;
    state.loading = false;
    state.err = '';
    paint();
  }

  function load() {
    if (typeof fetch !== 'function') { state.loading = false; return; }
    state.loading = true;
    fetch('/deals.json', { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('deals ' + res.status);
      return res.json();
    }).then(function (data) {
      applyData(data);
    }).catch(function () {
      state.loading = false;
      state.err = 'load';
      paint();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest && e.target.closest('[data-deal-cat]');
      if (!t) return;
      e.preventDefault();
      setCat(t.getAttribute('data-deal-cat'));
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
    else load();
  }

  var api = { view: view, setCat: setCat, load: load, applyData: applyData, itemsFor: itemsFor, MYNTRA: MYNTRA, CATS: CATS, priceAsOf: priceAsOf, state: state };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GNDeals = api;
})(typeof window !== 'undefined' ? window : this);
