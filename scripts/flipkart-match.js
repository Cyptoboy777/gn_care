/* Pure helpers for matching a GN Care catalog product to a Flipkart listing.
   Conservative: reject combos, wrong size, and obvious variant swaps. */
(function (root) {
  'use strict';

  var STOP = {
    with: 1, and: 1, the: 1, for: 1, of: 1, a: 1, an: 1, by: 1, in: 1, on: 1, to: 1,
    from: 1, new: 1, india: 1, pack: 1, items: 1, set: 1, daily: 1
  };

  function norm(s) {
    return String(s || '').toLowerCase().replace(/['’]/g, '').replace(/\s+/g, ' ').trim();
  }

  function normBrand(s) {
    return norm(s)
      .replace(/la roche-?posay/g, 'larocheposay')
      .replace(/l'?oreal(?: paris)?/g, 'loreal')
      .replace(/the derma co\.?/g, 'dermaco')
      .replace(/derma co\.?/g, 'dermaco')
      .replace(/the formularx/g, 'formularx')
      .replace(/dot\s*(?:and|&)\s*key/g, 'dotandkey')
      .replace(/pond'?s/g, 'ponds')
      .replace(/[^a-z0-9]+/g, '');
  }

  function parseSize(s) {
    s = norm(s).replace(/,/g, '');
    if (!s) return null;
    var m = s.match(/(\d+(?:\.\d+)?)\s*(ml|millilitre|milliliter|g|gm|gms|grams?|kg|l|ltr|litre|liter)\b/);
    if (!m) return null;
    var v = parseFloat(m[1]);
    var u = m[2];
    if (/^gm|^gram|^g$/.test(u)) u = 'g';
    else if (/^ml|^milli/.test(u)) u = 'ml';
    else if (/^l$|^ltr|^litre|^liter/.test(u)) { v *= 1000; u = 'ml'; }
    else if (u === 'kg') { v *= 1000; u = 'g'; }
    if (!(v > 0)) return null;
    return { v: Math.round(v * 10) / 10, u: u };
  }

  function sizeMatch(a, b) {
    if (!a || !b) return null;
    if (a.u !== b.u) return false;
    return Math.abs(a.v - b.v) <= 0.51;
  }

  function isCombo(listing) {
    var title = norm(listing.title || '');
    var cat = norm(listing.categoryPath || listing.category || '');
    if (/combo|combos and kits|items in the set|kit\b|pack of\s*\d/.test(title)) return true;
    if (/combos and kits/.test(cat)) return true;
    if (/\d+\s*(ml|g|gm)\s*&\s*/.test(title) || /\s&\s.+\d+\s*(ml|g|gm)/.test(title)) return true;
    return false;
  }

  function tokens(s) {
    return norm(s).replace(/[^a-z0-9%+]+/g, ' ').split(/\s+/).filter(function (t) {
      return t && t.length > 1 && !STOP[t];
    });
  }

  function hasBrand(listing, brand) {
    var want = normBrand(brand);
    if (!want) return false;
    var got = normBrand(listing.brand || '') + ' ' + normBrand(listing.title || '');
    return got.indexOf(want) !== -1;
  }

  function extractSpf(s) {
    var m = norm(s).match(/spf\s*(\d+)\s*(\+)?/);
    return m ? (m[1] + (m[2] || '')) : '';
  }

  function conflictingSizes(title) {
    var all = [];
    var re = /(\d+(?:\.\d+)?)\s*(ml|millilitre|g|gm|gms|grams?)\b/gi;
    var m;
    while ((m = re.exec(title))) {
      var parsed = parseSize(m[0]);
      if (parsed) all.push(parsed);
    }
    if (all.length < 2) return false;
    for (var i = 1; i < all.length; i++) {
      if (all[i].u !== all[0].u || Math.abs(all[i].v - all[0].v) > 0.51) return true;
    }
    return false;
  }

  function variantClash(product, listing) {
    var pt = norm((product.brand || '') + ' ' + (product.name || '') + ' ' + (product.size || '') + ' ' + (product.cat || ''));
    var tt = norm(listing.title || '');
    if (/\bcleanser\b/.test(pt) && !/\bcleanser|face wash|wash\b/.test(tt) && /\bmoisturizer|moisturiser|cream|serum\b/.test(tt) && !/cleansing/.test(tt)) return 'category';
    if (/\bmoisturizer|moisturiser|cream\b/.test(pt) && !/\bcleanser|face wash\b/.test(pt) && /\bcleanser|face wash\b/.test(tt) && !/cream|moistur/.test(tt)) return 'category';
    if (/\bserum\b/.test(pt) && /\bcleanser|face wash|moisturizer|sunscreen\b/.test(tt) && !/\bserum\b/.test(tt)) return 'category';
    // Hydro Boost: cleanser vs water gel moisturizer
    if (/hydro boost/.test(pt) && /hydro boost/.test(tt)) {
      var pCleanser = /\bcleanser\b/.test(pt);
      var tCleanser = /\bcleanser\b/.test(tt);
      if (pCleanser !== tCleanser) return 'hydro-boost-variant';
    }
    // Gentle vs oily Cetaphil cleanser
    if (/gentle skin cleanser/.test(pt) && /oily skin cleanser/.test(tt)) return 'gentle-vs-oily';
    if (/oily skin cleanser/.test(pt) && /gentle skin cleanser/.test(tt)) return 'gentle-vs-oily';
    // Cicaplast B5+ vs B5 SPF
    if (/cicaplast/.test(pt)) {
      if (/spf/.test(tt) && !/spf/.test(pt)) return 'cicaplast-spf';
      if (/b5\+|b5 plus/.test(pt) && !/b5\+|b5 plus/.test(tt) && /b5/.test(tt)) return 'cicaplast-plus';
    }
    if (/\btinted\b/.test(tt) && !/\btinted\b/.test(pt)) return 'tinted';
    if (/anti-?acne|\bacne\b/.test(pt) && !/anti-?acne|\bacne\b/.test(tt)) return 'acne-name';
    if (/\bplus\b/.test(pt) && !/\bplus\b/.test(tt)) return 'plus-variant';
    var pSpf = extractSpf(pt);
    var tSpf = extractSpf(tt);
    if (pSpf && tSpf && parseInt(pSpf, 10) !== parseInt(tSpf, 10)) return 'spf';
    if (!pSpf && tSpf && !/sunscreen|sun expert|photoderm|anthelios|sun light/i.test(pt)) return 'unexpected-spf';
    if (conflictingSizes(tt)) return 'size-conflict';
    return '';
  }

  function titleCoversName(product, listing) {
    var nameToks = tokens(product.name);
    var titleToks = tokens(listing.title);
    if (!nameToks.length || !titleToks.length) return false;
    var set = {};
    titleToks.forEach(function (t) { set[t] = true; });
    var need = nameToks.filter(function (t) {
      return /%/.test(t) || /^\d+$/.test(t) || t.length >= 5 || /niacinamide|salicylic|ceramide|vitamin|hyaluronic|cicaplast|effaclar|anthelios|uvmune|photoderm|sebium|atoderm/.test(t);
    });
    if (!need.length) need = nameToks;
    var hit = 0;
    need.forEach(function (t) { if (set[t]) hit++; });
    return hit >= Math.ceil(need.length * 0.7) && hit >= Math.min(2, need.length);
  }

  function listingSize(listing) {
    return parseSize(listing.size) || parseSize(listing.title) || null;
  }

  /* Return { ok, reason, listing } for the best exact-enough candidate. */
  function pickMatch(product, listings) {
    var catalogSize = parseSize(product.size || '');
    if (!catalogSize) {
      return { ok: false, reason: 'catalog-size-unknown' };
    }
    var best = null;
    var reasons = [];
    (listings || []).forEach(function (listing) {
      if (!listing || !listing.title) return;
      if (isCombo(listing)) { reasons.push('combo'); return; }
      if (!hasBrand(listing, product.brand)) { reasons.push('brand'); return; }
      var clash = variantClash(product, listing);
      if (clash) { reasons.push(clash); return; }
      if (!titleCoversName(product, listing)) { reasons.push('name'); return; }
      var ls = listingSize(listing);
      var sm = sizeMatch(catalogSize, ls);
      if (sm === false) { reasons.push('size'); return; }
      if (sm === null) { reasons.push('size-unknown'); return; }
      var score = 1;
      if (norm(listing.title).indexOf(norm(product.name).slice(0, 18)) !== -1) score += 2;
      if (!best || score > best.score) best = { listing: listing, score: score };
    });
    if (!best) return { ok: false, reason: reasons[0] || 'no-candidate' };
    return { ok: true, listing: best.listing };
  }

  function isFlipkartImageHost(url) {
    try {
      var u = new URL(url);
      return /(^|\.)flixcart\.com$|(^|\.)fkcdn\.com$/.test(u.hostname) && u.protocol === 'https:';
    } catch (e) { return false; }
  }

  function withAffid(url, affid) {
    try {
      var u = new URL(url);
      if (!/(^|\.)flipkart\.com$/.test(u.hostname)) return '';
      if (/^[A-Za-z0-9_]{3,40}$/.test(affid || '')) u.searchParams.set('affid', affid);
      return u.toString();
    } catch (e) { return ''; }
  }

  var api = {
    parseSize: parseSize, sizeMatch: sizeMatch, isCombo: isCombo, hasBrand: hasBrand,
    variantClash: variantClash, titleCoversName: titleCoversName, pickMatch: pickMatch,
    isFlipkartImageHost: isFlipkartImageHost, withAffid: withAffid, normBrand: normBrand
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GNFlipkartMatch = api;
})(typeof window !== 'undefined' ? window : this);
