/**
 * Client-side auth helpers - token and region in localStorage
 */
(function () {
  const TOKEN_KEY = 'emailhistory_token';
  const REGION_KEY = 'emailhistory_region';
  const API_BASE = '';

  function getBaseUrl() {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
    return API_BASE || '';
  }

  window.auth = {
    getToken: function () {
      return localStorage.getItem(TOKEN_KEY);
    },
    setToken: function (token) {
      localStorage.setItem(TOKEN_KEY, token);
    },
    removeToken: function () {
      localStorage.removeItem(TOKEN_KEY);
    },
    getRegion: function () {
      return localStorage.getItem(REGION_KEY) || '';
    },
    setRegion: function (region) {
      if (region != null) localStorage.setItem(REGION_KEY, String(region));
      else localStorage.removeItem(REGION_KEY);
    },
    removeRegion: function () {
      localStorage.removeItem(REGION_KEY);
    },
    isAuthenticated: function () {
      return !!localStorage.getItem(TOKEN_KEY);
    },
    getApiUrl: function (path) {
      var base = getBaseUrl();
      var p = (path && path.indexOf('/') === 0) ? path : '/' + (path || '');
      return base + '/api' + p;
    },
    getAuthHeaders: function (extra) {
      const h = { 'Content-Type': 'application/json' };
      if (extra) Object.assign(h, extra);
      const t = this.getToken();
      if (t) h['Authorization'] = 'Bearer ' + t;
      return h;
    },
  };
})();
