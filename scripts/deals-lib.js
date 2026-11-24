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

  function prunePosted(posted, todayISO, keepDays) {
    posted = posted && typeof posted === 'object' ? posted : {};
    var ids = posted.ids && typeof posted.ids === 'object' ? posted.ids : {};
    var keep = Math.max(1, keepDays || 7);
    var next = {};
    Object.keys(ids).forEach(function (id) {
      var day = String(ids[id] || '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && daysBetween(day, todayISO) < keep) next[id] = day;
    });
    return { ids: next, lastPosted: posted.lastPosted || '' };
  }

  function daysBetween(fromISO, toISO) {
    var a = Date.parse(fromISO + 'T00:00:00+05:30');
    var b = Date.parse(toISO + 'T00:00:00+05:30');
    if (!isFinite(a) || !isFinite(b)) return 999;
    return Math.round((b - a) / 86400000);
  }

  function pickTelegramDeals(deals, posted, todayISO, limit) {
    var state = prunePosted(posted, todayISO, 7);
    var used = state.ids;
    var seen = Object.create(null);
    var fresh = [];
    allItems(deals).forEach(function (it) {
      if (!it || !it.id || seen[it.id] || used[it.id]) return;
      if (typeof it.price !== 'number' || it.discount == null || it.discount <= 0 || !it.url) return;
      seen[it.id] = true;
      fresh.push(it);
    });
    fresh.sort(function (a, b) { return rankScore(b) - rankScore(a); });
    return fresh.slice(0, Math.max(0, limit || 5));
  }

  function markPosted(posted, items, todayISO) {
    var state = prunePosted(posted, todayISO, 7);
    (items || []).forEach(function (it) {
      if (it && it.id) state.ids[it.id] = todayISO;
    });
    state.lastPosted = todayISO;
    return state;
  }

  function formatInr(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function priceAsOfLabel(fetchedAt) {
    if (!fetchedAt) return '';
    var d = new Date(fetchedAt);
    if (isNaN(d.getTime())) {
      var day = String(fetchedAt).slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(day) ? 'Price as of ' + day : '';
    }
    var label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Calcutta' });
    return 'Price as of ' + label;
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
    rankScore: rankScore
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GNDealsLib = api;
})(typeof window !== 'undefined' ? window : this);
