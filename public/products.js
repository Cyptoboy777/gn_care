/* Loads the shop catalog from /catalog.json (easy to edit). Node tests require the JSON file directly. */
(function (root) {
  'use strict';
  function apply(data) {
    if (!data || !Array.isArray(data.products)) return;
    root.GN_PRODUCTS = data.products;
    root.GN_SOURCES = data.sources || {};
    root.GN_DEALS = data.deals || [];
    root.GN_CATALOG_NOTE = data.note || '';
    if (typeof document !== 'undefined' && document.dispatchEvent) {
      try { document.dispatchEvent(new Event('gn-catalog')); } catch (e) {}
    }
  }
  if (typeof require === 'function' && typeof module !== 'undefined') {
    apply(require('./catalog.json'));
    return;
  }
  if (typeof fetch === 'function') {
    fetch('/catalog.json').then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(apply).catch(function () {});
  }
})(typeof window !== 'undefined' ? window : globalThis);
