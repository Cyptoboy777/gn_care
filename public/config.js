/*
  GN Care site settings. No ads are shown until ADSENSE_CLIENT is filled in.

  1. Get your site approved in Google AdSense (see README.md).
  2. Paste your publisher ID in ADSENSE_CLIENT, e.g. 'ca-pub-1234567890123456'.
     This is the one value that turns ads on. Leave it empty until AdSense approves your custom domain.
  3. Optional: in AdSense create display units and paste their numeric IDs in SLOTS
       app   = the reserved slot on Home, Shop and Coach
       guide = the reserved slot inside guide articles
     If SLOTS stay empty, the reserved boxes are not filled with a unit.
  4. Redeploy.

  Affiliate links: Amazon Associates India tracking ID in AFFILIATE_TAG, Flipkart affid in FLIPKART_AFFID.
*/
window.GN_CONFIG = {
  SITE_URL: 'https://gn-care.vercel.app',
  ADSENSE_CLIENT: '',
  SLOTS: { app: '', guide: '' },
  AFFILIATE_TAG: 'gncare-21', /* Amazon Associates India tracking ID */
  FLIPKART_AFFID: 'thisisnarenda', /* Flipkart affiliate id, added as affid= on Flipkart search links */
  AUTO_ADS: false,            /* true = Google places ads automatically and SLOTS are ignored */
  OWN_CONSENT_BANNER: true    /* set false if you use Google's own Privacy & messaging banner */
};
