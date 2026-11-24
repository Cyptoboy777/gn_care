/*
  GN Care skin knowledge base. Plain, general cosmetic guidance based on public dermatology advice
  (American Academy of Dermatology, NHS, British Association of Dermatologists). No AI, no download.
  Used for the instant explanation in the app and as guardrails for the optional AI wording.
  Not medical advice and never a diagnosis. Strengths are typical over-the-counter ranges.
*/
(function (root) {
  'use strict';
  var SPF = 'Broad-spectrum sunscreen SPF 30+ (PA+++), two-finger amount for face and neck, reapply every 2–3 hours outdoors';

  var TYPES = {
    Oily: {
      cause: 'Skin makes more sebum (oil), mostly from genes, hormones, heat and humidity.',
      cleanser: 'gentle gel or foaming cleanser', moisturizer: 'light, oil-free, non-comedogenic gel moisturizer',
      avoid: ['Washing more than twice a day or harsh scrubs, which can make skin feel oilier', 'Heavy oils, thick balms and comedogenic products on the face'],
      te: 'Oily skin ki kooda light gel moisturizer kavali, skip cheyyakandi.', hi: 'Oily skin ko bhi light gel moisturizer chahiye, skip mat karo.'
    },
    Dry: {
      cause: 'Skin holds less oil and water, often from genes, age, cold or dry air, hot water and harsh cleansers.',
      cleanser: 'creamy, non-foaming gentle cleanser', moisturizer: 'rich cream with ceramides or glycerin, applied on damp skin',
      avoid: ['Hot water and long hot showers', 'Strong foaming (sulfate) cleansers, alcohol toners and daily strong acids'],
      te: 'Face wash tarvata 1 nimisham lopu moisturizer raayandi.', hi: 'Face wash ke 1 minute ke andar moisturizer lagao.'
    },
    Combination: {
      cause: 'Oilier T-zone (forehead, nose, chin) with normal or dry cheeks, mostly genetic.',
      cleanser: 'gentle gel cleanser', moisturizer: 'light lotion all over, a little extra cream only on dry cheeks',
      avoid: ['Treating the whole face as oily: strong oil-control products can dry the cheeks', 'Heavy creams on the T-zone'],
      te: 'T-zone ki light, cheeks ki konchem ekkuva moisturizer.', hi: 'T-zone pe light, cheeks pe thoda zyada moisturizer.'
    },
    Normal: {
      cause: 'Oil and water are fairly balanced. The goal is to keep it that way.',
      cleanser: 'gentle cleanser', moisturizer: 'simple lotion moisturizer',
      avoid: ['Adding many new products at once', 'Skipping sunscreen'],
      te: 'Simple routine chaalu: cleanser, moisturizer, sunscreen.', hi: 'Simple routine kaafi hai: cleanser, moisturizer, sunscreen.'
    }
  };

  /* Concern ids match the face scan and note flags. */
  var CONCERNS = {
    acne: {
      label: 'Pimples and breakouts',
      cause: 'Oil and dead skin block pores, bacteria grow and the pore gets inflamed. Hormones, stress and some products can trigger it.',
      helps: ['Benzoyl peroxide 2.5–5% gel or wash (can bleach fabric)', 'Salicylic acid 0.5–2%', 'Niacinamide 2–5%', 'Azelaic acid 10%', 'Adapalene 0.1% gel at night (ask a pharmacist or doctor first in India)'],
      avoid: ['Picking or squeezing, which can leave marks and scars', 'Scrubs and over-washing', 'Using several acne actives on the same night', 'Oily hair products and heavy creams near breakouts'],
      am: 'thin layer of niacinamide or a salicylic acid cleanser', pm: 'one acne active (benzoyl peroxide or salicylic acid or adapalene), not all together',
      time: 'Usually 6–8 weeks of daily use before clear improvement; 3 months for full effect.',
      red: ['Deep, painful lumps or cysts', 'Acne leaving scars or dark marks quickly', 'Sudden acne with irregular periods or extra facial hair', 'No improvement after 2–3 months of steady care'],
      te: 'Pimples ni pindakandi, marks migilipothayi.', hi: 'Pimples ko mat phodo, daag reh jaate hain.'
    },
    pores: {
      label: 'Blackheads and visible pores',
      cause: 'Oil and dead skin collect in the pore opening and darken in air. Pore size is mostly genetic and looks bigger with oil and sun damage.',
      helps: ['Salicylic acid 0.5–2% (oil-soluble, gets into pores)', 'Niacinamide 2–5%', 'A night retinoid such as retinol 0.25–0.5%', 'Clay mask once a week'],
      avoid: ['Squeezing blackheads or using pins', 'Daily pore strips or harsh scrubs', 'Heavy, comedogenic makeup and oils'],
      am: 'gentle cleanser; niacinamide if you like', pm: 'salicylic acid 2–3 nights a week',
      time: 'About 4–8 weeks. Pores can look smaller but cannot be closed permanently.',
      red: ['Painful, swollen bumps that keep coming back'],
      te: 'Blackheads ni nokkakandi, salicylic acid vaadandi.', hi: 'Blackheads ko dabao mat, salicylic acid use karo.'
    },
    pigment: {
      label: 'Dark spots and pigmentation',
      cause: 'Extra melanin after pimples, sun, heat or hormones. Indian skin marks easily and sun makes spots darker.',
      helps: [SPF + ', every single day', 'Niacinamide 4–5%', 'Vitamin C 10–15% (or a stable derivative) in the morning', 'Azelaic acid 10%', 'Alpha arbutin 1–2%'],
      avoid: ['Skin-lightening or "fairness" creams with steroids, mercury or unprescribed hydroquinone', 'Lemon, baking soda and other DIY bleaches', 'Picking pimples or spots', 'Skipping sunscreen even one day'],
      am: 'vitamin C or niacinamide serum, then sunscreen', pm: 'niacinamide, azelaic acid or alpha arbutin',
      time: 'Slow: 8–12 weeks of daily sunscreen and treatment; older marks can take months.',
      red: ['A spot that changes size, shape or colour, itches or bleeds', 'A new dark patch that appears quickly', 'Patchy pigment during pregnancy or on hormone medicines'],
      te: 'Dark spots ki sunscreen ye main medicine, roju vaadandi.', hi: 'Dark spots ke liye roz sunscreen sabse zaroori hai.'
    },
    tan: {
      label: 'Tanning',
      cause: 'Skin makes more melanin to protect itself from UV light. Tan is a sign of sun damage.',
      helps: [SPF, 'Shade, cap or scarf between 11 am and 3 pm', 'Vitamin C 10–15% or niacinamide 4–5%', 'Gentle lactic acid 5–10% once or twice a week if skin is not sensitive'],
      avoid: ['Bleach and DIY lemon packs', 'Scrubbing tanned skin hard', 'Forgetting neck, ears and hands'],
      am: 'vitamin C or niacinamide, then plenty of sunscreen', pm: 'moisturizer; mild lactic acid 1–2 nights a week',
      time: 'Fades as skin renews, usually 4–8 weeks, faster with steady sun protection.',
      red: ['Blistering or very painful sunburn', 'Sunburn with fever, chills or dizziness'],
      te: 'Bayataki vellataniki 15 nimishala mundu sunscreen raayandi.', hi: 'Bahar jaane se 15 minute pehle sunscreen lagao.'
    },
    circles: {
      label: 'Dark circles and puffiness',
      cause: 'Often genetic pigment or thin under-eye skin; worse with poor sleep, rubbing, allergies and sun. Puffiness comes from fluid, salt and sleep position.',
      helps: ['7–9 hours of sleep and less salt at night', 'Cold compress for 5–10 minutes for puffiness', 'Sunscreen or sunglasses around the eyes', 'Eye cream with caffeine, niacinamide or vitamin C (modest effect)'],
      avoid: ['Rubbing the eyes', 'Strong acids or retinoids close to the eyes', 'Expecting creams to remove genetic dark circles'],
      am: 'light eye cream, sunscreen around the eye area', pm: 'gentle hydrating eye cream',
      time: 'Puffiness improves in days; darkness changes slowly over 6–8 weeks and genetic circles may stay.',
      red: ['Sudden swelling of one eye or swelling with pain, rash or itching', 'Swelling of eyes or lips with breathing trouble: get emergency help'],
      te: 'Kallu ruddakandi, baaga nidra poyandi.', hi: 'Aankhein mat ragdo, poori neend lo.'
    },
    sensitive: {
      label: 'Redness, stinging and irritation',
      cause: 'A weaker skin barrier reacts to fragrance, heat, sun, friction or too many actives.',
      helps: ['Fragrance-free products with ceramides, glycerin, panthenol, centella or colloidal oatmeal', 'Mineral sunscreen with zinc oxide or titanium dioxide', 'Lukewarm water and a soft towel, pat dry'],
      avoid: ['Fragrance, essential oils and high drying alcohol', 'Scrubs, peel-off masks and stacking acids or retinoids', 'Trying more than one new product at a time'],
      am: 'gentle cleanser or plain water, barrier moisturizer, mineral sunscreen', pm: 'gentle cleanser and barrier cream; no strong actives until skin settles',
      time: 'The barrier usually settles in 2–4 weeks with a simple routine.',
      red: ['Rash, burning or redness lasting more than 2 weeks', 'Swelling, blisters or oozing', 'Frequent flushing with small bumps on cheeks and nose'],
      te: 'Kotha product ni 24 gantalu chethi meedha patch test cheyyandi.', hi: 'Naya product 24 ghante haath pe patch test karo.'
    },
    dry: {
      label: 'Dryness and flaking',
      cause: 'The skin barrier is losing water, from weather, hot water, harsh cleansers or over-exfoliation.',
      helps: ['Ceramides, glycerin, shea butter', 'Hyaluronic acid on damp skin, sealed with a cream', 'Urea up to 5% on the face', 'A thin layer of petroleum jelly on very dry patches at night'],
      avoid: ['Hot water and foaming cleansers', 'Alcohol toners and scrubs', 'Daily acids or retinoids while skin is flaking'],
      am: 'creamy cleanser or water, hydrating serum, cream', pm: 'creamy cleanser, richer cream; seal dry patches',
      time: 'Comfort in a few days; flaking usually settles in 1–2 weeks.',
      red: ['Itchy, red, scaly patches that keep coming back', 'Cracks that bleed or skin not better after 2 weeks of moisturizing'],
      te: 'Vedi neellu kakunda goruvechani neellu tho mukham kadagandi.', hi: 'Garam paani nahi, gungune paani se muh dho.'
    },
    oily: {
      label: 'Oiliness and shine',
      cause: 'Overactive oil glands, from genes, hormones, heat and humidity.',
      helps: ['Niacinamide 2–5%', 'Salicylic acid 0.5–2% cleanser', 'Oil-free gel moisturizer and gel or matte sunscreen', 'Blotting paper during the day'],
      avoid: ['Over-washing or stripping cleansers, which can trigger more oil', 'Skipping moisturizer', 'Heavy oils and thick creams'],
      am: 'gel cleanser, niacinamide, gel moisturizer, matte sunscreen', pm: 'gel cleanser, light moisturizer',
      time: 'Usually 4–8 weeks to notice less shine.',
      red: ['Sudden heavy oiliness with acne and irregular periods or hair changes'],
      te: 'Rojuki 2 saarlu kante ekkuva face wash cheyyakandi.', hi: 'Din mein 2 baar se zyada face wash mat karo.'
    },
    lines: {
      label: 'Fine lines',
      cause: 'Natural ageing plus sun damage, which breaks down collagen; smoking and poor sleep add to it.',
      helps: [SPF + ' (the best anti-ageing step)', 'Retinol 0.25–0.5%, start 2–3 nights a week', 'Vitamin C 10–15% in the morning', 'Peptides and a good moisturizer'],
      avoid: ['Starting retinol and acids together', 'Sun exposure and smoking', 'Retinoids if pregnant, planning pregnancy or breastfeeding'],
      am: 'vitamin C, moisturizer, sunscreen', pm: 'retinol on alternate nights, then moisturizer',
      time: 'Retinol needs about 12 weeks; results are gradual, not overnight.',
      red: ['Ask a doctor before retinoids if pregnant or breastfeeding'],
      te: 'Retinol ni varaniki 2–3 saarlu tho start cheyyandi.', hi: 'Retinol hafte mein 2–3 baar se shuru karo.'
    },
    texture: {
      label: 'Uneven or rough texture',
      cause: 'Dead skin builds up, or small bumps and old marks make the surface uneven.',
      helps: ['Lactic acid 5–10% or glycolic acid 5–8%, 1–2 nights a week', 'Salicylic acid 0.5–2% if bumps are from clogged pores', 'Retinol 0.25–0.5% on other nights', 'Daily moisturizer and sunscreen (acids make skin sun-sensitive)'],
      avoid: ['Harsh grainy scrubs', 'Acid and retinol on the same night', 'Exfoliating more than 2–3 times a week'],
      am: 'gentle cleanser, moisturizer, sunscreen', pm: 'an acid on 1–2 nights, retinol on others, moisturizer always',
      time: 'About 4–8 weeks.',
      red: ['A rough, scaly or crusty patch that does not heal in a few weeks', 'Deep acne scars: a dermatologist can discuss procedures'],
      te: 'Acid mariyu retinol oke raatri vaadakandi.', hi: 'Acid aur retinol ek hi raat mat lagao.'
    },
    dull: {
      label: 'Dullness',
      cause: 'Dead skin build-up, dehydration, sun and tan, poor sleep and stress make skin reflect less light.',
      helps: ['Vitamin C 10–15% in the morning', 'Niacinamide 2–5%', 'Gentle lactic acid 5–10% once a week', 'Moisturizer, sunscreen, sleep and water'],
      avoid: ['Daily scrubs', 'Quick "instant glow" bleach or fairness creams'],
      am: 'vitamin C, moisturizer, sunscreen', pm: 'moisturizer; gentle exfoliation once a week',
      time: 'About 4 weeks.',
      red: ['Sudden dullness with tiredness or weight change: worth a general doctor check'],
      te: 'Glow ki sunscreen, nidra, neellu mukhyam.', hi: 'Glow ke liye sunscreen, neend aur paani zaroori.'
    }
  };
  var ORDER = ['sensitive', 'acne', 'pigment', 'tan', 'pores', 'oily', 'dry', 'texture', 'lines', 'dull', 'circles'];
  var GENERAL_RED = 'See a dermatologist for anything painful, spreading, bleeding, or not better after 8–12 weeks.';

  function norm(ctx) {
    ctx = ctx || {};
    var type = TYPES[ctx.type] ? ctx.type : 'Normal';
    var cs = (ctx.concerns || []).filter(function (c, i, a) { return CONCERNS[c] && a.indexOf(c) === i; });
    var sens = !!ctx.sensitive || cs.indexOf('sensitive') > -1;
    if (sens && cs.indexOf('sensitive') < 0) cs.push('sensitive');
    cs.sort(function (a, b) { return ORDER.indexOf(a) - ORDER.indexOf(b); });
    return { type: type, sens: sens, cs: cs };
  }
  function has(cs, id) { return cs.indexOf(id) > -1; }

  /* Sensible combinations of type and concerns. */
  function combos(n) {
    var t = n.type, cs = n.cs, out = [];
    var actives = cs.filter(function (c) { return ['acne', 'pores', 'pigment', 'lines', 'texture', 'tan'].indexOf(c) > -1; });
    if (n.sens && actives.length) out.push('Sensitive skin: start only one active, at the lowest strength, 2–3 nights a week, and patch test first.');
    if ((t === 'Dry' || has(cs, 'dry')) && (has(cs, 'acne') || has(cs, 'pores'))) out.push('Dry skin with breakouts: use acne actives as a thin layer and never skip a non-comedogenic moisturizer.');
    if ((t === 'Oily' || t === 'Combination') && (has(cs, 'pigment') || has(cs, 'tan'))) out.push('Oily skin with dark spots: niacinamide and a gel or matte sunscreen fit well; avoid heavy oils.');
    if (has(cs, 'acne') && has(cs, 'pigment')) out.push('Pimples and marks: treat the pimples first and use sunscreen daily, or new marks keep forming. Azelaic acid and niacinamide help both.');
    if ((has(cs, 'lines') || has(cs, 'texture')) && actives.length > 1) out.push('Rotate actives: retinoid and exfoliating acids on different nights, never together.');
    if (t === 'Oily' && has(cs, 'dry')) out.push('Oily but tight after washing usually means a stripped barrier: switch to a gentler cleanser and keep a light moisturizer.');
    if (!actives.length && !n.sens) out.push('No strong actives needed: a steady cleanser, moisturizer and sunscreen routine is enough.');
    return out;
  }

  function routine(n) {
    var T = TYPES[n.type], cs = n.cs;
    var amSerum = has(cs, 'pigment') || has(cs, 'tan') || has(cs, 'dull') || has(cs, 'lines') ? 'vitamin C or niacinamide serum' :
      (has(cs, 'oily') || has(cs, 'acne') || has(cs, 'pores') || n.type === 'Oily') ? 'niacinamide serum (optional)' : '';
    var pmT = has(cs, 'acne') ? 'one acne active (salicylic acid, benzoyl peroxide or adapalene)' :
      has(cs, 'pigment') ? 'niacinamide, azelaic acid or alpha arbutin' :
      has(cs, 'pores') ? 'salicylic acid 2–3 nights a week' :
      has(cs, 'lines') || has(cs, 'texture') ? 'retinol or a gentle acid, on different nights' : '';
    if (n.sens && pmT) pmT += ' only after 2 calm weeks';
    var am = [T.cleanser, amSerum, T.moisturizer, 'sunscreen SPF 30+ PA+++' + (n.sens ? ' (mineral is gentler)' : '')].filter(Boolean);
    var pm = [T.cleanser, pmT, T.moisturizer].filter(Boolean);
    if (has(cs, 'circles')) pm.push('gentle eye cream');
    return { am: am, pm: pm };
  }

  function plan(ctx) {
    var n = norm(ctx), T = TYPES[n.type];
    var cs = n.cs.slice(0, 4);
    var avoid = T.avoid.slice();
    cs.forEach(function (c) { CONCERNS[c].avoid.slice(0, 2).forEach(function (a) { if (avoid.indexOf(a) < 0) avoid.push(a); }); });
    var red = [];
    cs.forEach(function (c) { CONCERNS[c].red.forEach(function (r) { if (red.indexOf(r) < 0) red.push(r); }); });
    red = red.slice(0, 5); red.push(GENERAL_RED);
    return {
      type: n.type, sensitive: n.sens, concerns: cs,
      typeCause: T.cause,
      items: cs.map(function (c) { var k = CONCERNS[c]; return { id: c, label: k.label, cause: k.cause, helps: k.helps.slice(0, 4), time: k.time, te: k.te, hi: k.hi }; }),
      combos: combos(n), routine: routine(n), avoid: avoid.slice(0, 6), red: red, te: T.te, hi: T.hi
    };
  }

  /* Plain bullet text ("- " lines). lang: 'en' | 'te' | 'hi' adds short local tips. Always returns text. */
  function explain(ctx, lang) {
    var p;
    try { p = plan(ctx); } catch (e) { p = plan({}); }
    var L = [];
    L.push('- ' + p.type + ' skin' + (p.sensitive ? ', sensitive' : '') + ': ' + p.typeCause);
    p.items.forEach(function (i) {
      L.push('- ' + i.label + ': ' + i.cause + ' Helps: ' + i.helps.join('; ') + '. Results: ' + i.time + (lang === 'te' ? ' ' + i.te : lang === 'hi' ? ' ' + i.hi : ''));
    });
    p.combos.forEach(function (c) { L.push('- ' + c); });
    L.push('- Morning: ' + p.routine.am.join(', then ') + '.');
    L.push('- Night: ' + p.routine.pm.join(', then ') + '.');
    L.push('- Avoid: ' + p.avoid.join('; ') + '.');
    if (lang === 'te') L.push('- ' + p.te); else if (lang === 'hi') L.push('- ' + p.hi);
    L.push('- See a dermatologist if: ' + p.red.join('; '));
    L.push('- Patch test each new product on the inner arm for 24 hours. General cosmetic guidance, not a diagnosis or medical advice.');
    return L.join('\n');
  }

  /* Compact guardrails for the AI prompt. */
  function promptContext(ctx) {
    var p = plan(ctx);
    return 'Reference guidance (stay consistent with it, do not add stronger strengths or claims): ' +
      p.type + ' skin' + (p.sensitive ? ', sensitive' : '') + '. ' +
      p.items.map(function (i) { return i.label + ': helps ' + i.helps.join(', ') + '; results ' + i.time; }).join(' ') + ' ' +
      p.combos.join(' ') + ' Avoid: ' + p.avoid.join('; ') + '. Red flags for a dermatologist: ' + p.red.join('; ');
  }

  var api = { TYPES: TYPES, CONCERNS: CONCERNS, ORDER: ORDER, plan: plan, explain: explain, promptContext: promptContext };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GNSkin = api;
})(typeof window !== 'undefined' ? window : this);
