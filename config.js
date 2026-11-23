/*
  GN Care site settings. No ads are shown until ADSENSE_CLIENT is filled in.

  1. Get your site approved in Google AdSense (see README.md).
  2. Paste your publisher ID below, e.g. 'ca-pub-1234567890123456'.
  3. In AdSense go to Ads > By ad unit > Display ads, create two units and paste their numeric IDs:
       app   = the ad under the app screens (shows on Home, Shelf and Checker)
       guide = the ad inside the guide articles
  4. Redeploy.
*/
window.GN_CONFIG = {
  SITE_URL: 'https://YOUR-DOMAIN.com',
  ADSENSE_CLIENT: '',
  SLOTS: { app: '', guide: '' },
  AUTO_ADS: false,            /* true = Google places ads automatically and SLOTS are ignored */
  OWN_CONSENT_BANNER: true    /* set false if you use Google's own Privacy & messaging banner */
};
