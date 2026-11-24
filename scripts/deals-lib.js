/* Pure helpers for Flipkart store deals and Telegram dedupe. No network, no secrets. */
(function (root) {
  'use strict';

  var CATEGORIES = [
    { id: 'men-clothing', label: "Men's clothing", queries: ['men shirts', 'men t-shirt', 'men jeans', 'men formal trousers'] },
    { id: 'women-clothing', label: "Women's clothing", queries: ['women dresses', 'women kurta', 'women tops', 'women jeans'] },
    { id: 'laptops', label: 'Laptops', queries: ['laptop', 'gaming laptop', 'thin laptop'] },
    { id: 'mobile-accessories', label: 'Mobile accessories', queries: ['mobile cover', 'power bank', 'bluetooth earphones', 'phone charger'] },
    { id: 'electronics-accessories', label: 'Electronics accessories', queries: ['laptop bag', 'wireless mouse', 'pendrive', 'usb cable', 'keyboard'] },
    { id: 'beauty', label: 'Beauty', queries: ['face wash', 'moisturizer', 'sunscreen', 'face serum'] }
  ];

  var MYNTRA = {
    fashion: { label: 'Shop Myntra fashion', url: 'https://myntr.it/zHNk6zz' },
    under399: { label: 'Myntra deals under ₹399', url: 'https://myntr.it/afrMHGG' }
  };

  function pickPrice(special, selling) {
    var nums = [special, selling].filter(function (n) { return typeof n === 'number' && n > 0; });
    if (!nums.length) return null;
    return Math.min.apply(null, nums);
  }

  function discountOf(price, mrp) {
    if (typeof price === 'number' && price > 0 && typeof mrp === 'number' && mrp > price) {
      return Math.round((1 - price / mrp) * 100);
    }
    return null;
  }

  function flattenProduct(raw) {
    var b = (raw && (raw.productBaseInfoV1 || raw.productBaseInfo)) || raw || {};
    var attrs = b.attributes || {};
    var imgs = b.imageUrls || {};
    var img = imgs['400x400'] || imgs['800x800'] || imgs['200x200'] || '';
    var special = b.flipkartSpecialPrice && b.flipkartSpecialPrice.amount;
    var selling = b.flipkartSellingPrice && b.flipkartSellingPrice.amount;
    var price = pickPrice(special, selling);
    var mrp = b.maximumRetailPrice && typeof b.maximumRetailPrice.amount === 'number' ? b.maximumRetailPrice.amount : null;
    return {
      productId: b.productId || '',
      title: b.title || '',
      brand: b.productBrand || '',
      categoryPath: b.categoryPath || '',
      size: attrs.size || '',
      inStock: !!b.inStock,
      price: price,
      mrp: mrp,
      productUrl: b.productUrl || '',
      image: img
    };
  }

  function extractPid(url) {
    try {
      var u = new URL(url);
      var pid = u.searchParams.get('pid');
      if (pid && /^[A-Za-z0-9]{6,30}$/.test(pid)) return pid;
    } catch (e) { /* ignore */ }
    var m = String(url || '').match(/[?&]pid=([A-Za-z0-9]{6,30})/i);
    return m ? m[1] : '';
  }

  function toDealItem(listing, category, fetchedAt, affid, helpers) {
    if (!listing || !listing.productId || !listing.title) return null;
    if (typeof listing.price !== 'number' || !(listing.price > 0)) return null;
    var withAffid = helpers && helpers.withAffid;
    var isImg = helpers && helpers.isFlipkartImageHost;
    var url = withAffid ? withAffid(listing.productUrl, affid) : '';
    if (!url) return null;
    var price = Math.round(listing.price);
    var mrp = listing.mrp != null && listing.mrp > 0 ? Math.round(listing.mrp) : null;
    var image = listing.image && isImg && isImg(listing.image) ? listing.image : '';
    return {
      id: String(listing.productId),
      title: String(listing.title).slice(0, 180),
      brand: listing.brand ? String(listing.brand).slice(0, 80) : '',
      image: image || undefined,
      price: price,
      mrp: mrp,
      discount: discountOf(price, mrp),
      url: url,
      inStock: !!listing.inStock,
      category: category,
      fetchedAt: fetchedAt
    };
  }

  function rankScore(item) {
    var disc = item && item.discount != null ? item.discount : -1;
    var save = (item && item.mrp != null && item.price != null && item.mrp > item.price) ? (item.mrp - item.price) : 0;
    var stock = item && item.inStock ? 1 : 0;
    return stock * 1e9 + disc * 1e6 + save;
  }

  function selectCategoryItems(items, limit) {
    var seen = Object.create(null);
    var out = [];
    (items || []).forEach(function (it) {
      if (!it || !it.id || seen[it.id]) return;
      if (typeof it.price !== 'number' || !(it.price > 0)) return;
      seen[it.id] = true;
      out.push(it);
    });
    out.sort(function (a, b) { return rankScore(b) - rankScore(a); });
    return out.slice(0, Math.max(0, limit || 20));
  }

  function allItems(deals) {
    var cats = (deals && deals.categories) || [];
    var out = [];
    cats.forEach(function (c) {
      (c.items || []).forEach(function (it) { out.push(it); });
    });
    return out;
  }

  function pruneDateMap(map, todayISO, keepDays) {
    var next = {};
    map = map && typeof map === 'object' ? map : {};
    var keep = Math.max(1, keepDays || 7);
    Object.keys(map).forEach(function (id) {
      var day = String(map[id] || '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && daysBetween(day, todayISO) < keep) next[id] = map[id];
    });
    return next;
  }

  function prunePosted(posted, todayISO, keepDays) {
    posted = posted && typeof posted === 'object' ? posted : {};
    return {
      ids: pruneDateMap(posted.ids, todayISO, keepDays),
      photos: pruneDateMap(posted.photos, todayISO, keepDays),
      drops: posted.drops && typeof posted.drops === 'object' ? posted.drops : {},
      lastPosted: posted.lastPosted || ''
    };
  }

  function daysBetween(fromISO, toISO) {
    var a = Date.parse(fromISO + 'T00:00:00+05:30');
    var b = Date.parse(toISO + 'T00:00:00+05:30');
    if (!isFinite(a) || !isFinite(b)) return 999;
    return Math.round((b - a) / 86400000);
  }

  function pickTelegramDeals(deals, posted, todayISO, limit, opts) {
    var state = prunePosted(posted, todayISO, 7);
    var used = state.ids;
    var photos = state.photos || {};
    var skipIds = opts && opts.skipIds ? opts.skipIds : {};
    var photoBackfill = !!(opts && opts.photoBackfill);
    var seen = Object.create(null);
    var fresh = [];
    allItems(deals).forEach(function (it) {
      if (!it || !it.id || seen[it.id] || skipIds[it.id]) return;
      if (typeof it.price !== 'number' || it.discount == null || it.discount <= 0 || !it.url) return;
      if (photoBackfill) {
        if (photos[it.id]) return;
      } else if (used[it.id]) return;
      seen[it.id] = true;
      fresh.push(it);
    });
    fresh.sort(function (a, b) { return rankScore(b) - rankScore(a); });
    return fresh.slice(0, Math.max(0, limit || 5));
  }

  function markPosted(posted, items, todayISO, opts) {
    var state = prunePosted(posted, todayISO, 7);
    (items || []).forEach(function (it) {
      if (!it || !it.id) return;
      state.ids[it.id] = todayISO;
      if (opts && opts.photos) state.photos[it.id] = todayISO;
    });
    state.lastPosted = todayISO;
    return state;
  }

  function formatInr(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function priceAsOfLabel(fetchedAt, withTime) {
    if (!fetchedAt) return '';
    var d = new Date(fetchedAt);
    if (isNaN(d.getTime())) {
      var day = String(fetchedAt).slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(day) ? 'Price as of ' + day : '';
    }
    var label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Calcutta' });
    if (!withTime) return 'Price as of ' + label;
    var time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Calcutta' });
    return 'Price as of ' + label + ', ' + time + ' IST';
  }

  function isHttpsImage(url) {
    try {
      var u = new URL(url);
      if (u.protocol !== 'https:') return false;
      return /(^|\.)flixcart\.com$|(^|\.)fkcdn\.com$/.test(u.hostname);
    } catch (e) { return false; }
  }

  function stampDay(iso) {
    if (!iso) return '';
    var s = String(iso);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var z = d.getTime() + 5.5 * 60 * 60 * 1000;
    return new Date(z).toISOString().slice(0, 10);
  }

  function applyPriceHistory(history, deals, fetchedAt) {
    history = history && typeof history === 'object' ? history : {};
    var recs = history.items && typeof history.items === 'object' ? Object.assign({}, history.items) : {};
    var alerts = [];
    allItems(deals).forEach(function (it) {
      if (!it || !it.id || typeof it.price !== 'number' || !(it.price > 0)) return;
      var price = Math.round(it.price);
      var rec = recs[it.id];
      if (!rec || typeof rec.last !== 'number' || !(rec.last > 0)) {
        recs[it.id] = { last: price, lastOn: fetchedAt || '', lowest: price, lowestOn: stampDay(fetchedAt) };
        if (it.mrp != null) recs[it.id].mrp = Math.round(it.mrp);
        return;
      }
      var last = rec.last;
      var lowest = typeof rec.lowest === 'number' && rec.lowest > 0 ? rec.lowest : last;
      var dropFrac = last > 0 ? (last - price) / last : 0;
      var isNewLow = price < lowest;
      var lowEnough = isNewLow && ((lowest - price) >= 5 || (lowest - price) / lowest >= 0.01);
      var meaningful = price < last && dropFrac >= 0.05;
      if (lowEnough || meaningful) {
        var alert = {
          id: it.id,
          title: it.title,
          brand: it.brand,
          image: it.image,
          price: price,
          mrp: it.mrp != null ? it.mrp : null,
          discount: discountOf(price, it.mrp),
          url: it.url,
          inStock: !!it.inStock,
          category: it.category,
          fetchedAt: it.fetchedAt || fetchedAt,
          previous: last,
          previousLowest: lowest,
          dropPct: Math.round(dropFrac * 100),
          alertKind: isNewLow ? 'all-time-low' : 'drop'
        };
        alerts.push(alert);
      }
      var next = { last: price, lastOn: fetchedAt || rec.lastOn || '', lowest: Math.min(lowest, price), lowestOn: price < lowest ? stampDay(fetchedAt) : (rec.lowestOn || stampDay(fetchedAt)) };
      if (it.mrp != null) next.mrp = Math.round(it.mrp);
      else if (rec.mrp != null) next.mrp = rec.mrp;
      if (price !== last) {
        next.prev = last;
        if (rec.lastOn) next.prevOn = rec.lastOn;
      }
      recs[it.id] = next;
    });
    alerts.sort(function (a, b) { return (b.dropPct || 0) - (a.dropPct || 0) || (b.previous - b.price) - (a.previous - a.price); });
    return { history: { updatedAt: fetchedAt || '', items: recs }, alerts: alerts };
  }

  function stillAlerted(dropRec, alert) {
    if (!dropRec || typeof dropRec.price !== 'number') return false;
    if (alert.price >= dropRec.price) return true;
    var frac = dropRec.price > 0 ? (dropRec.price - alert.price) / dropRec.price : 0;
    if (alert.alertKind === 'all-time-low' && frac >= 0.02) return false;
    if (frac >= 0.05) return false;
    return true;
  }

  function pickPriceDrops(alerts, posted, limit) {
    var drops = (posted && posted.drops && typeof posted.drops === 'object') ? posted.drops : {};
    var seen = Object.create(null);
    var out = [];
    (alerts || []).forEach(function (it) {
      if (!it || !it.id || seen[it.id]) return;
      if (typeof it.price !== 'number' || !(it.price > 0) || !it.url) return;
      if (typeof it.previous !== 'number' || !(it.previous > it.price)) return;
      if (stillAlerted(drops[it.id], it)) return;
      seen[it.id] = true;
      out.push(it);
    });
    return out.slice(0, Math.max(0, limit || 5));
  }

  function markDrops(posted, items, atISO) {
    var state = prunePosted(posted, stampDay(atISO), 7);
    if (!state.drops || typeof state.drops !== 'object') state.drops = {};
    (items || []).forEach(function (it) {
      if (it && it.id) state.drops[it.id] = { at: atISO, price: it.price };
    });
    return state;
  }

  function dealCaption(item, kind) {
    item = item || {};
    var title = [item.brand, item.title].filter(Boolean).join(' — ').slice(0, 140);
    var lines = [];
    if (kind === 'drop') {
      lines.push(item.alertKind === 'all-time-low' ? 'Price drop — new Flipkart low' : 'Price drop — Flipkart');
    } else {
      lines.push('GN Care — Flipkart deal');
    }
    if (title) lines.push(title);
    var price = typeof item.price === 'number' ? formatInr(item.price) : '';
    if (typeof item.previous === 'number' && item.previous > item.price) price += ' (was ' + formatInr(item.previous) + ')';
    if (item.mrp != null) price += ' · MRP ' + formatInr(item.mrp);
    if (item.discount != null) price += ' · ' + item.discount + '% off';
    if (price) lines.push(price);
    if (kind === 'drop' && item.alertKind === 'all-time-low') lines.push('Lowest price since we started tracking.');
    else if (kind === 'drop' && item.dropPct != null) lines.push(item.dropPct + '% lower than the last price we saw.');
    var asOf = priceAsOfLabel(item.fetchedAt, true);
    if (asOf) lines.push(asOf);
    if (item.url) lines.push(item.url);
    return lines.join('\n').slice(0, 1024);
  }

  function footerText(site) {
    site = site || 'https://gncare.xyz/#deals';
    return [
      'Shop all deals: ' + site,
      MYNTRA.under399.label + ': ' + MYNTRA.under399.url,
      'As an Amazon Associate, Flipkart affiliate, and via EarnKaro, GN Care may earn from qualifying purchases.'
    ].join('\n');
  }

  var api = {
    CATEGORIES: CATEGORIES,
    MYNTRA: MYNTRA,
    pickPrice: pickPrice,
    discountOf: discountOf,
    flattenProduct: flattenProduct,
    extractPid: extractPid,
    toDealItem: toDealItem,
    selectCategoryItems: selectCategoryItems,
    allItems: allItems,
    prunePosted: prunePosted,
    pickTelegramDeals: pickTelegramDeals,
    markPosted: markPosted,
    formatInr: formatInr,
    priceAsOfLabel: priceAsOfLabel,
    rankScore: rankScore,
    isHttpsImage: isHttpsImage,
    applyPriceHistory: applyPriceHistory,
    pickPriceDrops: pickPriceDrops,
    markDrops: markDrops,
    dealCaption: dealCaption,
    footerText: footerText,
    stampDay: stampDay
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GNDealsLib = api;
})(typeof window !== 'undefined' ? window : this);
