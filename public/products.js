/*
  Product catalog for the Shop tab. Edit this file to add, remove or re-price products.
  Fields:
    cat   Cleanser | Moisturizer | Sunscreen | Intimate wash | Beard oil
    skin  skin types it suits: Oily, Dry, Combination, Normal
    sens  true only when the source says it is for sensitive skin or is hypoallergenic
    aud   any | women | men  (face products suit everyone, so they are "any")
    price approximate price in rupees, or null when no price was found
    src   where the name and price came from
  Prices are estimates for budgeting, taken from published 2026 reviews. They change often and are not live store prices.
  Every link in the app is an Amazon.in search for the product, so it never goes stale.
*/
window.GN_PRODUCTS = [
  /* Cleansers. Source: Esquire India best face washes 2026 */
  { id: 'c1', cat: 'Cleanser', brand: 'CeraVe', name: 'Hydrating Cleanser', size: '88 ml', price: 359, skin: ['Dry', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'c2', cat: 'Cleanser', brand: 'Cetaphil', name: 'Gentle Skin Cleanser', size: '118 ml', price: 459, skin: ['Dry', 'Normal'], sens: true, aud: 'any', src: 'esquire' },
  { id: 'c3', cat: 'Cleanser', brand: 'Minimalist', name: 'B12 + Oat Extract 6.5% Gentle Cleanser', size: '120 ml', price: 299, skin: ['Combination', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'c4', cat: 'Cleanser', brand: "L'Oreal Paris", name: 'Revitalift Hyaluronic Acid Oil Control Replumping Cleansing Gel', size: '120 ml', price: 399, skin: ['Oily', 'Combination'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'c5', cat: 'Cleanser', brand: 'Bioderma', name: 'Sebium Gel Moussant Acne Defence Cleanser', size: '100 ml', price: 899, skin: ['Oily', 'Combination'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'c6', cat: 'Cleanser', brand: 'La Roche-Posay', name: 'Effaclar Purifying Anti-Acne Gel Face Wash', size: '200 ml', price: 1400, skin: ['Oily', 'Combination'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'c7', cat: 'Cleanser', brand: 'Neutrogena', name: 'Hydro Boost Cleanser Water Gel', size: '145 ml', price: 1155, skin: ['Combination', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'c8', cat: 'Cleanser', brand: 'Formularx', name: 'Barrier Comfort Gentle Ceramide Cleanser', size: '175 ml', price: 699, skin: ['Dry'], sens: false, aud: 'any', src: 'esquire' },

  /* Moisturizers. Sources: Esquire India best moisturisers 2026, Nykaa top moisturisers 2026 */
  { id: 'm1', cat: 'Moisturizer', brand: 'Minimalist', name: '10% Vitamin B5 Moisturizer', size: '50 g', price: 349, skin: ['Oily', 'Combination'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'm2', cat: 'Moisturizer', brand: 'Hyphen', name: 'Barrier Repair Moisturizer', size: '50 ml', price: 449, skin: ['Combination', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'm3', cat: 'Moisturizer', brand: 'The Formularx', name: 'Hydraveil Ceramide Water Cream', size: '50 g', price: 699, skin: ['Combination', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'm4', cat: 'Moisturizer', brand: 'Dot & Key', name: 'Cica Calming Oil Free Moisturizer', size: '60 g', price: 495, skin: ['Oily', 'Combination', 'Normal'], sens: true, aud: 'any', src: 'esquire' },
  { id: 'm5', cat: 'Moisturizer', brand: 'The Deconstruct', name: 'Acne Control Moisturizer', size: '50 g', price: 399, skin: ['Oily', 'Combination'], sens: true, aud: 'any', src: 'esquire' },
  { id: 'm6', cat: 'Moisturizer', brand: 'Sebamed', name: 'Clear Face Gel', size: '50 ml', price: 649, skin: ['Oily', 'Combination'], sens: true, aud: 'any', src: 'esquire' },
  { id: 'm7', cat: 'Moisturizer', brand: 'Bioderma', name: 'Atoderm Creme Ultra-Nourishing Moisturising Cream', size: '200 ml', price: 799, skin: ['Dry'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'm8', cat: 'Moisturizer', brand: 'La Roche-Posay', name: 'Cicaplast Baume B5+', size: '40 ml', price: 1150, skin: ['Dry'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'm9', cat: 'Moisturizer', brand: 'Cetaphil', name: 'Moisturising Cream', size: '', price: 499, skin: ['Dry', 'Normal'], sens: false, aud: 'any', src: 'nykaa' },
  { id: 'm10', cat: 'Moisturizer', brand: 'CeraVe', name: 'Moisturizer Cream', size: '77 ml', price: 1200, skin: ['Dry', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 'm11', cat: 'Moisturizer', brand: 'Plum', name: 'Green Tea Mattifying Moisturiser', size: '', price: 395, skin: ['Oily', 'Combination'], sens: false, aud: 'any', src: 'nykaa' },
  { id: 'm12', cat: 'Moisturizer', brand: 'Neutrogena', name: 'Hydro Boost Water Gel', size: '', price: 799, skin: ['Normal', 'Combination', 'Oily'], sens: false, aud: 'any', src: 'nykaa' },

  /* Sunscreens. Sources: Esquire India best sunscreens 2026, Nykaa sunscreens under 1000, skinroutineeveryday */
  { id: 's1', cat: 'Sunscreen', brand: 'Foxtale', name: 'SPF 50 Glow Sunscreen with Vitamin C & Niacinamide', size: '50 ml', spf: 'SPF 50', price: 375, skin: ['Dry', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 's2', cat: 'Sunscreen', brand: 'Lakme', name: 'Sun Expert Dry Matte Fluid', size: '50 ml', spf: '', price: 499, skin: ['Oily', 'Combination'], sens: false, aud: 'any', src: 'esquire' },
  { id: 's3', cat: 'Sunscreen', brand: 'Eucerin', name: 'Hydro Protect Ultra-Light Sunscreen Fluid', size: '50 ml', spf: 'SPF 50+', price: 990, skin: ['Oily', 'Combination', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 's4', cat: 'Sunscreen', brand: 'La Roche-Posay', name: 'Anthelios Invisible Fluid UVMune 400', size: '50 ml', spf: 'SPF 50', price: 1400, skin: ['Oily', 'Combination', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 's5', cat: 'Sunscreen', brand: 'Asaya', name: 'Spot Light Sunscreen', size: '50 g', spf: 'SPF 50 PA++++', price: 499, skin: ['Combination', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 's6', cat: 'Sunscreen', brand: "Pond's", name: 'Biome Miracle UV Invisigel Moisturiser', size: '50 g', spf: '', price: 399, skin: ['Combination', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 's7', cat: 'Sunscreen', brand: 'Bioderma', name: 'Photoderm XDefense Ultra-Fluid Invisible Sunscreen', size: '40 g', spf: 'SPF 50+ PA++++', price: 2199, skin: ['Combination', 'Normal'], sens: false, aud: 'any', src: 'esquire' },
  { id: 's8', cat: 'Sunscreen', brand: 'Minimalist', name: 'SPF 50 PA++++ Sunscreen', size: '', spf: 'SPF 50 PA++++', price: 399, priceNote: 'Listed as under ₹400', skin: ['Oily', 'Combination'], sens: false, aud: 'any', src: 'blog' },
  { id: 's9', cat: 'Sunscreen', brand: 'Cetaphil', name: 'SUN Light Gel', size: '', spf: 'SPF 50+', price: null, skin: ['Dry', 'Normal', 'Combination', 'Oily'], sens: true, aud: 'any', src: 'nykaa' },
  { id: 's10', cat: 'Sunscreen', brand: 'La Shield', name: 'Sensitive Protect Sunscreen', size: '', spf: 'SPF 50+', price: null, skin: ['Dry', 'Normal', 'Combination', 'Oily'], sens: true, aud: 'any', src: 'blog' },

  /* Add-ons. Sources: Purplle intimate wash list, NDTV Shopping beard oils */
  { id: 'i1', cat: 'Intimate wash', brand: 'VWash', name: 'Plus Expert Intimate Hygiene', size: '100 ml', price: 180, skin: [], sens: false, aud: 'women', note: 'Lactic acid, pH about 3.5, free of parabens and SLS', src: 'purplle' },
  { id: 'i2', cat: 'Intimate wash', brand: 'Sanfe', name: 'Natural Intimate Wash, Lavender and Chamomile', size: '100 ml', price: 199, skin: [], sens: false, aud: 'women', note: 'Dermatologically tested, free of sulfates and parabens', src: 'purplle' },
  { id: 'i3', cat: 'Intimate wash', brand: 'Good Vibes', name: 'Intimate Care Hygiene Wash, Aloe Vera', size: '100 ml', price: 225, skin: [], sens: false, aud: 'women', note: 'Free of parabens and sulfates, supports natural pH', src: 'purplle' },
  { id: 'b1', cat: 'Beard oil', brand: 'Beardo', name: 'Godfather Lite Beard Oil', size: '', price: 273, skin: [], sens: false, aud: 'men', note: 'Conditions and softens the beard', src: 'ndtv' }
];

window.GN_SOURCES = {
  esquire: 'Esquire India, best face washes, moisturisers and sunscreens 2026',
  nykaa: 'Nykaa Beauty Book, top moisturisers 2026 and sunscreens under ₹1000',
  blog: 'Skin Routine Every Day, best face sunscreens under ₹800',
  purplle: 'Purplle Magazine, best intimate washes for women',
  ndtv: 'NDTV Shopping, beard oils under ₹500'
};
