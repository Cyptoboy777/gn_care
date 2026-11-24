/* On-device face scan. MediaPipe FaceLandmarker runs in the browser only.
   The photo is never uploaded. Pure metric helpers are exported for tests. */
(function (root) {
  'use strict';

  var MP_VER = '0.10.32';
  var MP_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VER;
  var WASM_URL = MP_URL + '/wasm';
  var MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

  /* MediaPipe Face Mesh indices. Image-left / image-right, not the person's left. */
  var REGIONS = {
    forehead: [10, 151, 9, 8, 107, 336, 67, 69, 104, 108, 109, 338, 297, 337, 333, 299],
    nose: [1, 2, 4, 5, 6, 19, 94, 97, 98, 168, 195, 197, 326, 327],
    cheekL: [50, 101, 118, 119, 205, 36, 142, 203, 216, 187, 123, 116],
    cheekR: [280, 330, 347, 348, 425, 266, 371, 423, 436, 411, 352, 345],
    chin: [152, 176, 148, 172, 136, 150, 149, 199, 200, 175, 18, 377, 400, 378, 379, 365],
    underEyeL: [111, 117, 118, 24, 110, 23, 22, 226, 31, 228, 229, 230, 145, 153],
    underEyeR: [340, 346, 347, 254, 339, 253, 252, 446, 261, 448, 449, 450, 374, 380]
  };

  /* MediaPipe Face Mesh FACE_OVAL loop, in connection order. */
  var FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  var OVERLAY_REGIONS = ['forehead', 'nose', 'cheekL', 'cheekR', 'chin'];

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function clamp100(n) { return Math.round(clamp(n, 0, 100)); }

  /* Image-space pixels for the same region ids used when drawing the overlay. */
  function landmarkImagePoints(landmarks, ids, w, h) {
    var a = [], i, p;
    for (i = 0; i < ids.length; i++) {
      p = landmarks && landmarks[ids[i]];
      if (!p) continue;
      a.push({ x: p.x * w, y: p.y * h });
    }
    return a;
  }

  /*
    Map a normalized image landmark (0–1, image space) into a display box.
    Accounts for object-fit cover/contain (centered), optional front-camera
    mirroring (CSS scaleX(-1) on the image), and devicePixelRatio for canvases.
    For an SVG overlay in CSS pixels, pass dpr: 1.
  */
  function mapLandmarkToDisplay(nx, ny, imgW, imgH, boxW, boxH, opts) {
    opts = opts || {};
    var fit = opts.fit || 'cover';
    var dpr = opts.dpr == null ? 1 : opts.dpr;
    var mirror = !!opts.mirror;
    if (!imgW || !imgH || !boxW || !boxH) return { x: 0, y: 0 };
    var scale = fit === 'contain'
      ? Math.min(boxW / imgW, boxH / imgH)
      : Math.max(boxW / imgW, boxH / imgH);
    var dw = imgW * scale, dh = imgH * scale;
    var ox = (boxW - dw) / 2, oy = (boxH - dh) / 2;
    var x = nx * dw + ox;
    var y = ny * dh + oy;
    if (mirror) x = boxW - x;
    return { x: x * dpr, y: y * dpr };
  }

  function fitEllipse(points, pad) {
    var n = points && points.length;
    if (!n) return null;
    var i, p, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, sx = 0, sy = 0;
    for (i = 0; i < n; i++) {
      p = points[i];
      sx += p.x; sy += p.y;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    var cx = sx / n, cy = sy / n;
    var grow = pad == null ? 1.12 : pad;
    var rx = Math.max(maxX - cx, cx - minX, 2) * grow;
    var ry = Math.max(maxY - cy, cy - minY, 2) * grow;
    return { cx: cx, cy: cy, rx: rx, ry: ry };
  }

  function overlayModel(landmarks, imgW, imgH, boxW, boxH, opts) {
    opts = opts || {};
    if (!landmarks || landmarks.length < 400 || !imgW || !imgH) {
      return { found: false, oval: [], regions: {} };
    }
    function mapped(ids) {
      var a = [], i, p;
      for (i = 0; i < ids.length; i++) {
        p = landmarks[ids[i]];
        if (!p) continue;
        a.push(mapLandmarkToDisplay(p.x, p.y, imgW, imgH, boxW, boxH, opts));
      }
      return a;
    }
    var regions = {}, i, name;
    for (i = 0; i < OVERLAY_REGIONS.length; i++) {
      name = OVERLAY_REGIONS[i];
      regions[name] = fitEllipse(mapped(REGIONS[name]));
    }
    return { found: true, oval: mapped(FACE_OVAL), regions: regions };
  }

  function overlaySvg(landmarks, imgW, imgH, boxW, boxH, opts) {
    opts = opts || {};
    var model = overlayModel(landmarks, imgW, imgH, boxW, boxH, opts);
    if (!model.found) return '';
    var z = opts.zones || {};
    var parts = [];
    if (model.oval.length) {
      var d = model.oval.map(function (p, i) {
        return (i ? 'L' : 'M') + p.x.toFixed(2) + ',' + p.y.toFixed(2);
      }).join(' ') + ' Z';
      parts.push('<path class="outline" d="' + d + '"' + (opts.photo ? ' style="opacity:.85;stroke:#fff"' : '') + '/>');
    }
    function el(cls, e) {
      if (!e || e.rx < 1 || e.ry < 1) return '';
      return '<ellipse class="z ' + (cls || '') + '" cx="' + e.cx.toFixed(2) + '" cy="' + e.cy.toFixed(2) + '" rx="' + e.rx.toFixed(2) + '" ry="' + e.ry.toFixed(2) + '"/>';
    }
    var r = model.regions;
    parts.push(el(z.f, r.forehead));
    parts.push(el(z.n, r.nose));
    parts.push(el(z.c, r.cheekL));
    parts.push(el(z.c, r.cheekR));
    parts.push(el(z.ch, r.chin));
    return parts.join('');
  }

  function packLandmarks(marks) {
    var a = [], i, p;
    if (!marks) return a;
    for (i = 0; i < marks.length; i++) {
      p = marks[i];
      a.push(p ? { x: p.x, y: p.y } : { x: 0, y: 0 });
    }
    return a;
  }

  /* Map v from [lo, hi] onto 0–100. */
  function scale(v, lo, hi) {
    if (hi === lo) return 0;
    return clamp100(((v - lo) / (hi - lo)) * 100);
  }

  function luma(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

  /* Compact sRGB → CIE Lab, used for a* redness. */
  function rgbToLab(r, g, b) {
    function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var R = lin(r), G = lin(g), B = lin(b);
    var x = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
    var y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
    var z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116); }
    var fx = f(x / 0.95047), fy = f(y), fz = f(z / 1.08883);
    return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }

  function summarize(pixels) {
    var n = pixels.length;
    if (!n) return { n: 0, meanL: 0, stdL: 0, shineRatio: 0, meanA: 0, highlightRatio: 0 };
    var i, L, sum = 0, aSum = 0, shines = 0, blown = 0, ls = new Array(n);
    for (i = 0; i < n; i++) {
      var p = pixels[i];
      L = luma(p.r, p.g, p.b) * 100;
      ls[i] = L;
      sum += L;
      aSum += rgbToLab(p.r, p.g, p.b).a;
      var mx = Math.max(p.r, p.g, p.b), mn = Math.min(p.r, p.g, p.b);
      var sat = mx ? (mx - mn) / mx : 0;
      if (L > 72 && sat < 0.18) shines++;
      if (L > 92) blown++;
    }
    var meanL = sum / n;
    var varSum = 0;
    for (i = 0; i < n; i++) { var d = ls[i] - meanL; varSum += d * d; }
    var stdL = Math.sqrt(varSum / n);
    /* Specular highlights: bright, low-saturation pixels clearly above the region mean. */
    var hi = 0;
    for (i = 0; i < n; i++) {
      var p2 = pixels[i];
      L = ls[i];
      var mx2 = Math.max(p2.r, p2.g, p2.b), mn2 = Math.min(p2.r, p2.g, p2.b);
      var sat2 = mx2 ? (mx2 - mn2) / mx2 : 0;
      if (L >= meanL + 12 && L >= 62 && sat2 < 0.22) hi++;
    }
    return {
      n: n,
      meanL: meanL,
      stdL: stdL,
      shineRatio: hi / n,
      meanA: aSum / n,
      highlightRatio: shines / n,
      blownRatio: blown / n
    };
  }

  function shineScore(summary) { return scale(summary.shineRatio, 0.02, 0.28); }
  function rednessScore(summary) { return scale(summary.meanA, 6, 28); }
  function evennessScore(summary) { return clamp100(100 - scale(summary.stdL, 4, 22)); }

  /* Positive when the under-eye area is darker than the cheeks. */
  function darkCircleScore(underEye, cheeks) {
    if (!underEye.n || !cheeks.n) return 0;
    return scale(cheeks.meanL - underEye.meanL, 2, 18);
  }

  function lightingQuality(summary) {
    if (!summary || summary.n < 200) return { ok: false, reason: 'noface', message: 'We could not read enough of your face. Try a closer photo.' };
    if (summary.meanL < 18) return { ok: false, reason: 'dark', message: 'This photo is too dark. Face a window or a lamp and retake.' };
    if (summary.meanL > 88 || summary.blownRatio > 0.35) return { ok: false, reason: 'bright', message: 'This photo is too bright or washed out. Step out of direct glare and retake.' };
    return { ok: true, reason: null, message: '' };
  }

  function zoneClass(shine) {
    if (shine >= 55) return 'oil';
    if (shine <= 35) return 'dry';
    return 'bal';
  }

  function typeFromTally(t) {
    var type;
    if (t.oil >= 3) type = 'Oily';
    else if (t.dry >= 3) type = 'Dry';
    else if (t.tz >= 2 || (t.tz >= 1 && (t.dry >= 1 || t.oil >= 1))) type = 'Combination';
    else if (t.dry + t.oil + t.tz <= 1) type = 'Normal';
    else type = t.dry >= 2 ? 'Dry' : t.oil >= 2 ? 'Oily' : 'Combination';
    return type;
  }

  function quizTally(answers, questions) {
    var t = { dry: 0, oil: 0, tz: 0, sens: 0, sun: 0 };
    (answers || []).forEach(function (a, i) {
      if (a == null || !questions || !questions[i] || !questions[i].o[a]) return;
      var w = questions[i].o[a][1] || {};
      for (var k in w) t[k] += w[k];
    });
    return t;
  }

  function zonesFromType(type) {
    if (type === 'Oily') return { f: 'oil', n: 'oil', c: 'oil', ch: 'oil' };
    if (type === 'Dry') return { f: 'dry', n: 'dry', c: 'dry', ch: 'dry' };
    if (type === 'Combination') return { f: 'oil', n: 'oil', c: 'dry', ch: 'oil' };
    if (type === 'Normal') return { f: 'bal', n: 'bal', c: 'bal', ch: 'bal' };
    return { f: '', n: '', c: '', ch: '' };
  }

  /* quiz: {dry,oil,tz,sens,sun}. metrics: output of buildMetrics, or null. */
  function combine(quiz, metrics) {
    var t = {
      dry: (quiz && quiz.dry) || 0,
      oil: (quiz && quiz.oil) || 0,
      tz: (quiz && quiz.tz) || 0,
      sens: (quiz && quiz.sens) || 0,
      sun: (quiz && quiz.sun) || 0
    };
    var usedPhoto = !!(metrics && metrics.ok);
    if (usedPhoto) {
      var tShine = metrics.regions.tzone.shine;
      var cShine = metrics.regions.cheeks.shine;
      var chShine = metrics.regions.chin.shine;
      var faceShine = (tShine + cShine + chShine) / 3;
      if (faceShine >= 65) t.oil += 2;
      else if (faceShine >= 50) t.oil += 1;
      else if (faceShine <= 25) t.dry += 2;
      else if (faceShine <= 40) t.dry += 1;
      /* Even shine across the face is oiliness, not a T-zone (combination) pattern. */
      if (faceShine >= 65 && (tShine - cShine) < 10) t.oil += 1;
      else if (tShine - cShine >= 18 && tShine >= 50) t.tz += 2;
      else if (tShine - cShine >= 10 && tShine >= 42) t.tz += 1;
      if (metrics.redness >= 65 && t.sens >= 1) t.sens += 1;
    }
    var type = typeFromTally(t);
    var sensitive = t.sens >= 2;
    var sensitiveLeaning = !sensitive && (t.sens >= 1 || (usedPhoto && metrics.redness >= 70));
    var zones = usedPhoto
      ? {
          f: zoneClass(metrics.regions.tzone.shine),
          n: zoneClass(metrics.regions.tzone.shine),
          c: zoneClass(metrics.regions.cheeks.shine),
          ch: zoneClass(metrics.regions.chin.shine)
        }
      : zonesFromType(type);
    return {
      type: type,
      sensitive: sensitive,
      sensitiveLeaning: sensitiveLeaning,
      sun: Math.min(2, t.sun || 0),
      source: usedPhoto ? 'quiz+photo' : 'quiz',
      tally: t,
      zones: zones,
      metrics: usedPhoto ? metrics : null
    };
  }


  var CONCERN_LABELS = {
    oily: 'Oily / shine',
    dry: 'Dryness',
    acne: 'Pimples',
    pigment: 'Dark spots',
    sensitive: 'Sensitivity',
    dull: 'Dullness',
    tan: 'Tanning',
    circles: 'Dark circles',
    pores: 'Blackheads and pores',
    lines: 'Fine lines',
    texture: 'Uneven texture'
  };

  /* English plus a few common Hinglish and Tenglish words. No AI required. */
  var CONCERN_RULES = [
    ['oily', /\b(oily|oiliness|greasy|shiny|shine)\b|\boil (by|at) noon\b|\boil (vasth|vast|ost)|teelu+|telu+|chip ?chip(a|i)?|jiddu|\bnune\b|chamak(ta|ti|the)?|\btel nikal/],
    ['dry', /\b(dry|dryness|tight|tightness|flak(?:y|es)|peeling)\b|khushk|\bsukha\b|rukh(a|i|ee)\b|dry (ayipoth|ayipothun|avuth|avut)|tarvata dry|after wash.{0,20}dry|varisa/],
    ['acne', /\b(pimples?|acne|breakouts?|zits?|mungurulu?|mottimalu|mosimalu|muhase|muhaase)\b|\bdaane\b|\bdane\b/],
    ['pigment', /\b(pigment(?:ation)?|melasma|blemish(?:es)?|dark spots?|acne marks?|black (?:spots?|marks?|patches))\b|\bdaags?\b|\bdags?\b|nalla (daag|dag|spots?)/],
    ['sensitive', /\b(sensitive|sensitivity|fragrance|perfume|parfum|allerg(?:y|ic)|stings?|redness)\b|mandutund|mandipoth|sugandh|khushbu|perfume ki/],
    ['dull', /\b(dull|dullness|no glow|glow ledu|kammi? glow|mothaga|thandaga)\b/],
    ['tan', /\b(tann?ing|tanned|sun ?tan|sunburn)\b|endulo nalla|endalo nalla|tan ayin/],
    ['pores', /\b(blackheads?|whiteheads?|open pores?|large pores?|big pores?|pores?)\b|nalla chukkalu|kaale daane/],
    ['lines', /\b(fine lines?|wrinkles?|lines on|ageing|aging|crow'?s feet)\b|mudathalu|jhurri/],
    ['texture', /\b(rough|bumpy|uneven texture|texture|bumps)\b|gharuku|khurdur/],
    ['circles', /\b(dark circles?|under[- ]?eyes?|eye bags?)\b|kalla kinda|kallu kinda|kaale ghere|aankh ke neeche|ankhon ke neeche/]
  ];

  function parseConcerns(text) {
    var s = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    var flags = [];
    if (!s) return flags;
    CONCERN_RULES.forEach(function (r) {
      if (r[1].test(s) && flags.indexOf(r[0]) < 0) flags.push(r[0]);
    });
    return flags;
  }

  function flagsToTally(flags) {
    var t = { dry: 0, oil: 0, tz: 0, sens: 0, sun: 0 };
    function has(id) { return (flags || []).indexOf(id) > -1; }
    if (has('oily')) t.oil += 2;
    if (has('dry')) t.dry += 2;
    if (has('oily') && has('dry')) t.tz += 2;
    if (has('sensitive')) t.sens += 2;
    if (has('tan')) t.sun += 2;
    if (has('acne') && has('oily')) t.oil += 1;
    return t;
  }

  function concernsFrom(metrics, flags) {
    var out = (flags || []).slice();
    function add(id) { if (out.indexOf(id) < 0) out.push(id); }
    if (metrics && metrics.ok) {
      if (metrics.shine >= 55) add('oily');
      if (metrics.shine <= 30) add('dry');
      if (metrics.darkCircles >= 55) add('circles');
      if (metrics.redness >= 70) add('sensitive');
      if (metrics.evenness <= 40) add('dull');
    }
    return out;
  }

  function recommend(metrics, flags) {
    var f = flags || [];
    var m = metrics && metrics.ok ? metrics : null;
    if (!m && !f.length) {
      return { ok: false, needInput: true, type: '', concerns: [], sensitive: false, sensitiveLeaning: false, sun: 0, source: '', zones: null, metrics: null, tally: flagsToTally([]) };
    }
    var r = combine(flagsToTally(f), m);
    r.ok = true;
    r.needInput = false;
    r.concerns = concernsFrom(m, f);
    r.source = m && f.length ? 'scan+note' : (m ? 'scan' : 'note');
    return r;
  }

  var KIT_BUDGETS = [
    { id: 'u500', n: 'Under ₹500', budget: 500 },
    { id: 'u1000', n: '₹500–1000', budget: 1000 },
    { id: 'u2000', n: '₹1000–2000', budget: 2000 },
    { id: 'open', n: 'No limit', budget: 0 }
  ];

  function buildRoutine(type, flags, sensitive) {
    function has(id) { return (flags || []).indexOf(id) > -1; }
    var am = [], pm = [];
    if (type === 'Oily') {
      am = ['Gel cleanser', 'Oil-free moisturizer', 'Sunscreen SPF 30+'];
      pm = ['Gel cleanser', has('acne') ? 'Salicylic acid (BHA) — 2 or 3 nights a week' : 'Niacinamide', 'Oil-free moisturizer'];
    } else if (type === 'Dry') {
      am = ['Cream or milk cleanser', 'Hyaluronic acid on damp skin', 'Ceramide moisturizer', 'Sunscreen SPF 30+'];
      pm = ['Cream or milk cleanser', 'Ceramide moisturizer'];
    } else if (type === 'Combination') {
      am = ['Gentle gel cleanser', 'Light lotion, richer cream on cheeks', 'Sunscreen SPF 30+'];
      pm = ['Gentle gel cleanser'];
      if (has('acne')) pm.push('BHA on forehead, nose and chin only');
      pm.push('Moisturizer');
    } else {
      am = ['Gentle cleanser', 'Light moisturizer', 'Sunscreen SPF 30+'];
      pm = ['Gentle cleanser', 'Moisturizer'];
    }
    if (has('dull') || has('pigment')) {
      if (am.indexOf('Vitamin C serum') < 0) am.splice(Math.min(1, am.length), 0, 'Vitamin C serum');
    }
    if (has('circles')) pm.push('Gentle eye cream');
    if (sensitive || has('sensitive')) {
      am = am.map(function (n) { return /moisturizer|cream|lotion/i.test(n) && n.indexOf('fragrance-free') < 0 ? 'Fragrance-free ' + n.charAt(0).toLowerCase() + n.slice(1) : n; });
      pm = pm.map(function (n) { return /moisturizer|cream|lotion/i.test(n) && n.indexOf('fragrance-free') < 0 ? 'Fragrance-free ' + n.charAt(0).toLowerCase() + n.slice(1) : n; });
    }
    return {
      am: am.map(function (n, i) { return { id: 'am' + (i + 1), n: n }; }),
      pm: pm.map(function (n, i) { return { id: 'pm' + (i + 1), n: n }; })
    };
  }

  function buildMetrics(parts) {

    var tzonePx = (parts.forehead || []).concat(parts.nose || []);
    var cheekPx = (parts.cheekL || []).concat(parts.cheekR || []);
    var chinPx = parts.chin || [];
    var eyePx = (parts.underEyeL || []).concat(parts.underEyeR || []);
    var all = tzonePx.concat(cheekPx, chinPx, eyePx);
    var tzone = summarize(tzonePx);
    var cheeks = summarize(cheekPx);
    var chin = summarize(chinPx);
    var eyes = summarize(eyePx);
    var face = summarize(all);
    var light = lightingQuality(face);
    var metrics = {
      ok: light.ok,
      lighting: light,
      shine: clamp100((shineScore(tzone) + shineScore(cheeks) + shineScore(chin)) / 3),
      redness: rednessScore(face),
      evenness: evennessScore(face),
      darkCircles: darkCircleScore(eyes, cheeks),
      regions: {
        tzone: { shine: shineScore(tzone), redness: rednessScore(tzone), evenness: evennessScore(tzone), n: tzone.n },
        cheeks: { shine: shineScore(cheeks), redness: rednessScore(cheeks), evenness: evennessScore(cheeks), n: cheeks.n },
        chin: { shine: shineScore(chin), redness: rednessScore(chin), evenness: evennessScore(chin), n: chin.n }
      }
    };
    return metrics;
  }

  function sampleAround(imageData, points, radius) {
    var w = imageData.width, h = imageData.height, data = imageData.data;
    var out = [];
    if (!points.length || radius < 1) return out;
    var r = Math.round(radius), r2 = r * r;
    var seen = new Uint8Array(w * h);
    for (var i = 0; i < points.length; i++) {
      var cx = Math.round(points[i].x), cy = Math.round(points[i].y);
      var x0 = Math.max(0, cx - r), x1 = Math.min(w - 1, cx + r);
      var y0 = Math.max(0, cy - r), y1 = Math.min(h - 1, cy + r);
      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          var dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy > r2) continue;
          var idx = y * w + x;
          if (seen[idx]) continue;
          seen[idx] = 1;
          var o = idx * 4;
          out.push({ r: data[o], g: data[o + 1], b: data[o + 2] });
        }
      }
    }
    return out;
  }

  function metricsFromLandmarks(imageData, landmarks) {
    if (!imageData || !landmarks || landmarks.length < 400) {
      return buildMetrics({});
    }
    var w = imageData.width, h = imageData.height;
    var left = landmarks[234], right = landmarks[454];
    var faceW = 0;
    if (left && right) {
      var dx = (right.x - left.x) * w, dy = (right.y - left.y) * h;
      faceW = Math.sqrt(dx * dx + dy * dy);
    }
    var radius = Math.max(6, Math.round((faceW || Math.min(w, h) * 0.45) * 0.045));
    var parts = {};
    for (var name in REGIONS) parts[name] = sampleAround(imageData, landmarkImagePoints(landmarks, REGIONS[name], w, h), radius);
    return buildMetrics(parts);
  }

  /* -------- browser-only: load model, read a photo -------- */
  var landmarker = null;
  var loadPromise = null;

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      if (src && src.tagName === 'IMG' && src.naturalWidth) { resolve(src); return; }
      var img = (root.document && root.document.createElement) ? root.document.createElement('img') : null;
      if (!img) { reject(new Error('no image')); return; }
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('bad image')); };
      img.src = typeof src === 'string' ? src : '';
    });
  }

  function drawScaled(img, max) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error('empty image');
    var scaleTo = Math.min(1, max / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scaleTo)), ch = Math.max(1, Math.round(h * scaleTo));
    var c = root.document.createElement('canvas');
    c.width = cw; c.height = ch;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, cw, ch);
    return c;
  }

  function resizeDataUrl(dataUrl, max, quality) {
    return loadImage(dataUrl).then(function (img) {
      var c = drawScaled(img, max || 640);
      try { return c.toDataURL('image/jpeg', quality == null ? 0.8 : quality); }
      catch (e) { return dataUrl; }
    });
  }

  function load(onProgress) {
    if (landmarker) return Promise.resolve(landmarker);
    if (loadPromise) return loadPromise;
    if (typeof onProgress === 'function') onProgress('Loading the on-device face model…');
    if (typeof root.import !== 'function' && typeof importScripts === 'undefined') {
      /* import() is what we need; it exists in browsers that can run this PWA. */
    }
    loadPromise = Promise.resolve()
      .then(function () { return import(MP_URL); })
      .then(function (mod) {
        var FilesetResolver = mod.FilesetResolver, FaceLandmarker = mod.FaceLandmarker;
        if (!FilesetResolver || !FaceLandmarker) throw new Error('MediaPipe export missing');
        return FilesetResolver.forVisionTasks(WASM_URL).then(function (vision) {
          var opts = { runningMode: 'IMAGE', numFaces: 1, outputFaceBlendshapes: false };
          return FaceLandmarker.createFromOptions(vision, Object.assign({}, opts, { baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' } }))
            .catch(function () {
              return FaceLandmarker.createFromOptions(vision, Object.assign({}, opts, { baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' } }));
            });
        });
      })
      .then(function (lm) { landmarker = lm; return lm; })
      .catch(function (err) { loadPromise = null; throw err; });
    return loadPromise;
  }

  function analyze(src, onProgress) {
    return load(onProgress).then(function (lm) {
      if (typeof onProgress === 'function') onProgress('Finding your face…');
      return loadImage(src).then(function (img) {
        var canvas = drawScaled(img, 480);
        var result = lm.detect(canvas);
        var marks = result && result.faceLandmarks && result.faceLandmarks[0];
        var imageSize = { w: img.naturalWidth || img.width || canvas.width, h: img.naturalHeight || img.height || canvas.height };
        if (!marks || !marks.length) {
          return { ok: false, reason: 'noface', message: 'Face not detected, center your face', imageSize: imageSize, landmarks: null };
        }
        var packed = packLandmarks(marks);
        var imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        var metrics = metricsFromLandmarks(imageData, marks);
        if (!metrics.lighting.ok) {
          return { ok: false, reason: metrics.lighting.reason, message: metrics.lighting.message, metrics: metrics, landmarks: packed, imageSize: imageSize };
        }
        return { ok: true, metrics: metrics, landmarks: packed, imageSize: imageSize };
      });
    });
  }

  var api = {
    quizTally: quizTally,
    typeFromTally: typeFromTally,
    zonesFromType: zonesFromType,
    combine: combine,
    parseConcerns: parseConcerns,
    flagsToTally: flagsToTally,
    concernsFrom: concernsFrom,
    recommend: recommend,
    buildRoutine: buildRoutine,
    CONCERN_LABELS: CONCERN_LABELS,
    KIT_BUDGETS: KIT_BUDGETS,
    summarize: summarize,
    shineScore: shineScore,
    rednessScore: rednessScore,
    evennessScore: evennessScore,
    darkCircleScore: darkCircleScore,
    lightingQuality: lightingQuality,
    buildMetrics: buildMetrics,
    metricsFromLandmarks: metricsFromLandmarks,
    landmarkImagePoints: landmarkImagePoints,
    mapLandmarkToDisplay: mapLandmarkToDisplay,
    fitEllipse: fitEllipse,
    overlayModel: overlayModel,
    overlaySvg: overlaySvg,
    packLandmarks: packLandmarks,
    REGIONS: REGIONS,
    FACE_OVAL: FACE_OVAL,
    scale: scale,
    load: load,
    analyze: analyze,
    resizeDataUrl: resizeDataUrl,
    supported: function () { return typeof root.import === 'function' || (typeof document !== 'undefined'); }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GNFaceScan = api;
})(typeof window !== 'undefined' ? window : this);
