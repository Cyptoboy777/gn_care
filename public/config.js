/*
  GN Care site settings. No ads are shown until ADSENSE_CLIENT is filled in.

  1. Get your site approved in Google AdSense (see README.md).
  2. Paste your publisher ID below, e.g. 'ca-pub-1234567890123456'.
  3. In AdSense go to Ads > By ad unit > Display ads, create two units and paste their numeric IDs:
       app   = the ad under the app screens (shows on Home, Shelf and Checker)
       guide = the ad inside the guide articles
  4. Redeploy.

  Affiliate links: join Amazon Associates India, then put your tracking ID in AFFILIATE_TAG below.
*/
window.GN_CONFIG = {
  SITE_URL: 'https://gn-care.vercel.app',
  ADSENSE_CLIENT: '',
  SLOTS: { app: '', guide: '' },
  AFFILIATE_TAG: '',          /* Amazon Associates India tracking ID, for example 'yourname-21'. Links earn nothing until this is set. */
  AUTO_ADS: false,            /* true = Google places ads automatically and SLOTS are ignored */
  OWN_CONSENT_BANNER: true    /* set false if you use Google's own Privacy & messaging banner */
};
