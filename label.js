/* On-device ingredient label scanner. No internet, no AI, no cost. */
(function (root) {
  'use strict';
  var ACTIVES = [
    ['retinol', /\b(retinol|retinal|retinaldehyde|retinyl|tretinoin|adapalene|retinoid)/i],
    ['vitc', /\b(ascorbic acid|l-ascorbic|ascorbyl|ethyl ascorbic|ascorbyl glucoside)/i],
    ['aha', /\b(glycolic acid|lactic acid|mandelic acid|malic acid|tartaric acid)/i],
    ['bha', /\b(salicylic acid|betaine salicylate)/i],
    ['bp', /\bbenzoyl peroxide/i],
    ['niac', /\bniacinamide/i],
    ['ha', /\b(hyaluronic acid|sodium hyaluronate|hyaluronate)/i],
    ['pep', /\b(peptide|matrixyl|argireline|palmitoyl (tri|tetra|penta|hexa)peptide)/i],
    ['spf', /\b(zinc oxide|titanium dioxide|avobenzone|octinoxate|homosalate|octocrylene|octisalate|bemotrizinol|tinosorb|uvinul|ethylhexyl triazone|oxybenzone|ensulizole|drometrizole)/i]
  ];
  var FLAGS = [
    ['Fragrance', /\b(parfum|fragrance|linalool|limonene|citronellol|geraniol|hexyl cinnamal|coumarin)\b/i, 'Fragrance can irritate sensitive skin. Patch test first.'],
    ['Drying alcohol', /\b(alcohol denat|sd alcohol|denatured alcohol|isopropyl alcohol)/i, 'Denatured alcohol can sting dry or sensitive skin.'],
    ['Essential oils', /\b(essential oil|lavandula|lavender oil|mentha|menthol|eucalyptus|tea tree|melaleuca|cinnamomum|citrus [a-z ]*oil)/i, 'Essential oils and menthol are common triggers for irritation.']
  ];

  function scan(text) {
    var t = String(text || '');
    var actives = [];
    var flags = [];
    var i;
    for (i = 0; i < ACTIVES.length; i++) if (ACTIVES[i][1].test(t)) actives.push(ACTIVES[i][0]);
    for (i = 0; i < FLAGS.length; i++) if (FLAGS[i][1].test(t)) flags.push({ n: FLAGS[i][0], tx: FLAGS[i][2] });
    return { actives: actives, flags: flags };
  }

  var api = { scan: scan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GNLabel = api;
})(typeof window !== 'undefined' ? window : this);
