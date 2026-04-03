(function () {
  var TOKEN_KEY = 'emailhistory_token';

  function getBaseUrl() {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
    return '';
  }

  window.auth = {
    getToken: function () { return localStorage.getItem(TOKEN_KEY); },
    setToken: function (t) { localStorage.setItem(TOKEN_KEY, t); },
    removeToken: function () { localStorage.removeItem(TOKEN_KEY); },
    isAuthenticated: function () { return !!localStorage.getItem(TOKEN_KEY); },
    getApiUrl: function (path) {
      var p = (path && path.charAt(0) === '/') ? path : '/' + (path || '');
      return getBaseUrl() + '/api' + p;
    },
    getAuthHeaders: function (extra) {
      var h = { 'Content-Type': 'application/json' };
      if (extra) Object.assign(h, extra);
      var t = this.getToken();
      if (t) h['Authorization'] = 'Bearer ' + t;
      return h;
    }
  };
})();
