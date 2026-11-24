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
  function amazonDealsURL(tag) {
    var u = 'https://www.amazon.in/gp/goldbox';
    if (/^[A-Za-z0-9-]{3,40}$/.test(tag || '')) u += '?tag=' + encodeURIComponent(tag);
    return u;
  }
  function flipkartOffersURL(affid) {
    var u = 'https://www.flipkart.com/offers-store';
    if (/^[A-Za-z0-9_]{3,40}$/.test(affid || '')) u += '?affid=' + encodeURIComponent(affid);
    return u;
  }
  function dealDiscount(p) {
    if (!p || p.price == null || p.mrp == null || p.mrp <= p.price) return null;
    return Math.round((1 - p.price / p.mrp) * 100);
  }
  function deals(ids) {
    var map = {};
    products().forEach(function (p) { map[p.id] = p; });
    var list = (ids && ids.length ? ids : (root.GN_DEALS || [])).map(function (id) { return map[id]; }).filter(Boolean);
    return list.filter(function (p) { return dealDiscount(p) != null; });
  }
  function treatments(type, concerns) {
    concerns = concerns || [];
    return products().filter(function (p) {
      if (p.cat !== 'Serum' && p.cat !== 'Treatment') return false;
      if (type && p.skin && p.skin.length && p.skin.indexOf(type) < 0) return false;
      return true;
    }).sort(function (a, b) {
      var score = function (p) {
        var n = ((p.actives || []).join(' ') + ' ' + (p.name || '')).toLowerCase();
        var s = 0;
        if (concerns.indexOf('acne') > -1 && /bha|salicylic/.test(n)) s += 3;
        if (concerns.indexOf('pigment') > -1 && /niacinamide|vitc|vitamin c/.test(n)) s += 3;
        if (concerns.indexOf('dull') > -1 && /vitc|vitamin c/.test(n)) s += 3;
        if ((type === 'Dry' || concerns.indexOf('dry') > -1 || concerns.indexOf('sensitive') > -1) && /ceramide/.test(n)) s += 3;
        if (type === 'Oily' && /niacinamide|bha|gel/.test(n)) s += 1;
        return s;
      };
      return score(b) - score(a) || effPrice(a) - effPrice(b);
    });
  }
  function copyLangPack(p, lang) {
    lang = lang || 'en';
    if (lang === 'hi') return { why: p.whyThisHi, avoid: p.avoidHi, how: p.howToUseHi };
    if (lang === 'te') return { why: p.whyThisTe, avoid: p.avoidTe, how: p.howToUseTe };
    return { why: p.whyThis, avoid: p.avoid, how: p.howToUse };
  }
  function catalogWhy(p, type, lang) {
    var pack = copyLangPack(p, lang);
    var map = pack.why;
    if (!map) return '';
    if (typeof map === 'string') return map;
    if (type && map[type]) return map[type];
    return map.general || '';
  }
  function howToUse(p, lang) {
    var pack = copyLangPack(p, lang);
    if (pack.how) return pack.how;
    if (lang && lang !== 'en') return howToUse(p, 'en');
    return '';
  }
  function productAvoid(p, lang) {
    var pack = copyLangPack(p, lang);
    if (Array.isArray(pack.avoid) && pack.avoid.length) return pack.avoid.slice(0, 3);
    if (lang && lang !== 'en') return productAvoid(p, 'en');
    return [];
  }
  function whyThis(p, type, concerns, lang) {
    var fromCat = catalogWhy(p, type, lang);
    if (fromCat) return fromCat;
    if (lang && lang !== 'en') {
      fromCat = catalogWhy(p, type, 'en');
      if (fromCat) return fromCat;
    }
    concerns = concerns || [];
    var name = ((p.brand || '') + ' ' + (p.name || '') + ' ' + (p.note || '') + ' ' + (p.actives || []).join(' ')).toLowerCase();
    var bits = [];
    if (p.skin && type && p.skin.indexOf(type) > -1) bits.push('Chosen because it is listed for ' + type.toLowerCase() + ' skin.');
    if (p.sens) bits.push('Marked sensitive-friendly, so it is a gentler place to start.');
    if (/niacinamide/.test(name) && (type === 'Oily' || concerns.indexOf('acne') > -1 || concerns.indexOf('pigment') > -1))
      bits.push('Niacinamide is a common, budget-friendly choice for oil control and uneven tone.');
    if (/salicylic|\bbha\b/.test(name) && (type === 'Oily' || type === 'Combination' || concerns.indexOf('acne') > -1))
      bits.push('Salicylic acid can help keep pores clearer. Start slowly and patch test.');
    if (/vitamin c|vitc|ascorb/.test(name) && (concerns.indexOf('dull') > -1 || concerns.indexOf('pigment') > -1 || concerns.indexOf('tan') > -1 || !concerns.length))
      bits.push('Vitamin C is often used for a brighter look. Use in the morning and follow with sunscreen.');
    if (/ceramide/.test(name) && (type === 'Dry' || concerns.indexOf('dry') > -1 || concerns.indexOf('sensitive') > -1 || p.sens))
      bits.push('Ceramides help support a dry or easily irritated barrier.');
    if (/hyaluronic|hydro boost/.test(name) && type === 'Dry')
      bits.push('A hydrating formula that suits tight, dry skin when sealed with a cream.');
    if (/gel|oil-free|oil free|matt/.test(name) && (type === 'Oily' || type === 'Combination'))
      bits.push('A lighter gel or oil-free texture is usually more comfortable on oilier areas.');
    if (/cream|balm|nourishing/.test(name) && type === 'Dry')
      bits.push('A richer cream texture helps when skin feels tight or flaky.');
    if (p.cat === 'Sunscreen') bits.push('Daily sunscreen is the one step every skin type should keep.');
    if (!bits.length) bits.push('A straightforward ' + String(p.cat || 'product').toLowerCase() + ' that can fit a ' + String(type || 'your').toLowerCase() + ' routine. Patch test first.');
    return bits.slice(0, 2).join(' ');
  }
  function avoidTips(type, concerns, sensitive) {
    var tips = [];
    concerns = concerns || [];
    if (type === 'Oily' || type === 'Combination') tips.push('Go easy on heavy oils and thick occlusive creams on the T-zone.');
    if (type === 'Dry') tips.push('Avoid strong foaming cleansers and daily high-strength acids, which can leave skin tighter.');
    if (sensitive || concerns.indexOf('sensitive') > -1) tips.push('Skip fragrance and essential oils where you can, and patch test new actives.');
    if (concerns.indexOf('acne') > -1) tips.push('Do not stack several exfoliating acids on the same night.');
    if (!tips.length) tips.push('Add only one new active at a time, and wear sunscreen in the day.');
    return tips.slice(0, 3);
  }

  function isoDay(now) {
    var d = now ? new Date(now) : new Date();
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  /* Coupons: hide when expired or missing a code. expires is an inclusive YYYY-MM-DD calendar date. */
  function couponLive(coupon, now) {
    if (!coupon || !coupon.code) return false;
    if (coupon.expires) {
      var exp = String(coupon.expires);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) return false;
      var today = isoDay(now);
      if (!today || today > exp) return false;
    }
    return true;
  }
  function couponSave(price, coupon) {
    if (price == null || price <= 0 || !coupon || coupon.value == null) return null;
    if (coupon.minOrder != null && price < coupon.minOrder) return null;
    var v = Number(coupon.value);
    if (!(v > 0)) return null;
    if (coupon.discountType === 'percent') return Math.round(price * v / 100);
    if (coupon.discountType === 'flat') return Math.min(Math.round(price), Math.round(v));
    return null;
  }
  function couponApprox(price, coupon) {
    var save = couponSave(price, coupon);
    if (price == null || save == null) return null;
    return Math.max(0, Math.round(price) - save);
  }
  function safeTag(tag) { return /^[A-Za-z0-9_-]{1,40}$/.test(tag || '') ? tag : ''; }
  function amazonSearchURL(q, tag, priceCeil) {
    var u = 'https://www.amazon.in/s?k=' + encodeURIComponent(q) + '&i=apparel';
    if (priceCeil) u += '&rh=' + encodeURIComponent('p_36:-' + (priceCeil * 100));
    tag = safeTag(tag);
    if (tag) u += '&tag=' + encodeURIComponent(tag);
    return u;
  }
  function flipkartSearchURL(q, affid) {
    var u = 'https://www.flipkart.com/search?q=' + encodeURIComponent(q);
    affid = safeTag(affid);
    if (affid) u += '&affid=' + encodeURIComponent(affid);
    return u;
  }
  /* Category / search links only. No invented products or prices. */
  function fashionLinks(tag, affid) {
    return {
      men: [
        { store: 'Amazon', label: 'Men’s fashion under ₹499', url: amazonSearchURL('men fashion', tag, 499) },
        { store: 'Amazon', label: 'Men’s fashion under ₹999', url: amazonSearchURL('men fashion', tag, 999) },
        { store: 'Flipkart', label: 'Men’s fashion under ₹499', url: flipkartSearchURL('men fashion under 499', affid) },
        { store: 'Flipkart', label: 'Men’s fashion under ₹999', url: flipkartSearchURL('men fashion under 999', affid) }
      ],
      women: [
        { store: 'Amazon', label: 'Women’s fashion under ₹499', url: amazonSearchURL('women fashion', tag, 499) },
        { store: 'Amazon', label: 'Women’s fashion under ₹999', url: amazonSearchURL('women fashion', tag, 999) },
        { store: 'Flipkart', label: 'Women’s fashion under ₹499', url: flipkartSearchURL('women fashion under 499', affid) },
        { store: 'Flipkart', label: 'Women’s fashion under ₹999', url: flipkartSearchURL('women fashion under 999', affid) }
      ]
    };
  }
  function telegramURL(raw) {
    raw = String(raw || '').trim();
    if (!/^https:\/\/(t\.me|telegram\.me)\/[-A-Za-z0-9_+/]+$/i.test(raw)) return '';
    return raw;
  }

  var api = { CORE: CORE, candidates: candidates, buildKit: buildKit, addOns: addOns, buyURL: buyURL, flipkartURL: flipkartURL, amazonDealsURL: amazonDealsURL, flipkartOffersURL: flipkartOffersURL, effPrice: effPrice, dealDiscount: dealDiscount, deals: deals, treatments: treatments, whyThis: whyThis, avoidTips: avoidTips, couponLive: couponLive, couponSave: couponSave, couponApprox: couponApprox, fashionLinks: fashionLinks, telegramURL: telegramURL, isoDay: isoDay, howToUse: howToUse, productAvoid: productAvoid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GNPicks = api;
})(typeof window !== 'undefined' ? window : this);
