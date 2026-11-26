/* v42: some phones block browser storage (in-app browsers of Instagram/WhatsApp/Facebook with storage off,
   private tabs on older Safari, Samsung secret mode with strict settings). Reading localStorage then THROWS and
   the whole app stayed blank. If storage is not usable, give the page an in-memory stand-in so it still works
   (the visitor just stays signed in only until the tab closes). Loaded before every other script. */
(function () {
  function mem() {
    var d = {};
    return {
      getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function (k, v) { d[String(k)] = String(v); },
      removeItem: function (k) { delete d[String(k)]; },
      clear: function () { d = {}; },
      key: function (i) { return Object.keys(d)[i] || null; },
      get length() { return Object.keys(d).length; }
    };
  }
  ['localStorage', 'sessionStorage'].forEach(function (n) {
    var ok = false;
    try { var s = window[n]; s.setItem('__lah_t', '1'); s.removeItem('__lah_t'); ok = true; } catch (e) {}
    if (!ok) { try { Object.defineProperty(window, n, { value: mem(), configurable: true, writable: true }); } catch (e) {} }
  });
})();
