/* Shop tab logic: picks a starter kit for a skin type and budget. Pure functions, no network. */
(function (root) {
  'use strict';
  var CORE = ['Cleanser', 'Moisturizer', 'Sunscreen'];
  /* If the kit is over budget, make cheaper swaps in this order. Sunscreen is protected last. */
  var CUT_ORDER = ['Cleanser', 'Moisturizer', 'Sunscreen'];

  function products() { return root.GN_PRODUCTS || (typeof globalThis !== 'undefined' && globalThis.GN_PRODUCTS) || []; }

  function median(cat) {
    var v = products().filter(function (p) { return p.cat === cat && p.price != null; }).map(function (p) { return p.price; }).sort(function (a, b) { return a - b; });
    if (!v.length) return 0;
    var m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
  }
  /* Price used for budget maths. Products with no known price use the middle price of their category. */
  function effPrice(p) { return p.price != null ? p.price : median(p.cat); }

  function fit(p, type, sens) {
    var s = 0;
    if (p.skin.indexOf(type) > -1) s += 2;
    if (p.skin.length <= 2) s += 1;
    if (sens && p.sens) s += 3;
    return s;
  }

  /* Products of a category for a skin type, best fit first, then cheapest. */
  function candidates(cat, type, sens) {
    var all = products().filter(function (p) { return p.cat === cat && p.skin.indexOf(type) > -1; });
    var sensList = sens ? all.filter(function (p) { return p.sens; }) : [];
    var list = (sens && sensList.length ? sensList : all).slice();
    list.sort(function (a, b) { return fit(b, type, sens) - fit(a, type, sens) || effPrice(a) - effPrice(b) || (a.id < b.id ? -1 : 1); });
    return { list: list, noSens: !!sens && !sensList.length && all.length > 0 };
  }

  /*
    opts: { type, sens, budget, swaps: {Cleanser: id, ...}, have: {Cleanser: true, ...} }
    Returns { items: [{cat, item, have, manual, alts, noSens}], total, min, fits }
  */
  function buildKit(opts) {
    var type = opts.type, sens = !!opts.sens, budget = Number(opts.budget) || 0;
    var swaps = opts.swaps || {}, have = opts.have || {};
    var items = CORE.map(function (cat) {
      if (have[cat]) return { cat: cat, have: true, item: null, alts: [], noSens: false, manual: false };
      var c = candidates(cat, type, sens);
      var manual = null;
      if (swaps[cat]) manual = c.list.filter(function (p) { return p.id === swaps[cat]; })[0] || null;
      return { cat: cat, have: false, item: manual || c.list[0] || null, alts: c.list, noSens: c.noSens, manual: !!manual };
    });
    var sum = function () { return items.reduce(function (a, i) { return a + (i.item ? effPrice(i.item) : 0); }, 0); };
    var min = items.reduce(function (a, i) {
      if (!i.item || !i.alts.length) return a;
      return a + Math.min.apply(null, i.alts.map(effPrice));
    }, 0);
    if (budget > 0) {
      CUT_ORDER.forEach(function (cat) {
        if (sum() <= budget) return;
        var it = items.filter(function (i) { return i.cat === cat; })[0];
        if (!it || it.have || it.manual || !it.item) return;
        var cheapest = it.alts.slice().sort(function (a, b) { return effPrice(a) - effPrice(b); })[0];
        if (cheapest && effPrice(cheapest) < effPrice(it.item)) it.item = cheapest;
      });
    }
    var total = sum();
    return { items: items, total: total, min: min, fits: budget <= 0 || total <= budget };
  }

  function addOns(aud) {
    if (aud !== 'women' && aud !== 'men') return [];
    return products().filter(function (p) { return p.aud === aud; });
  }

  /* Search links stay valid when products are renamed. Affiliate ids are added only when they look safe. */
  function query(p) { return [p.brand, p.name, p.size].filter(Boolean).join(' '); }
  function buyURL(p, tag) {
    var u = 'https://www.amazon.in/s?k=' + encodeURIComponent(query(p));
    if (/^[A-Za-z0-9-]{3,40}$/.test(tag || '')) u += '&tag=' + encodeURIComponent(tag);
    return u;
  }
  function flipkartURL(p, affid) {
    var u = 'https://www.flipkart.com/search?q=' + encodeURIComponent(query(p));
    if (/^[A-Za-z0-9_]{3,40}$/.test(affid || '')) u += '&affid=' + encodeURIComponent(affid);
    return u;
  }

  var api = { CORE: CORE, candidates: candidates, buildKit: buildKit, addOns: addOns, buyURL: buyURL, flipkartURL: flipkartURL, effPrice: effPrice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GNPicks = api;
})(typeof window !== 'undefined' ? window : this);
