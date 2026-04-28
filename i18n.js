(function () {
  var SUPPORTED = ['en', 'th', 'pt'];
  var DEFAULT = 'en';
  var current = DEFAULT;
  var strings = {};

  function detectLang() {
    var stored = localStorage.getItem('veripura-lang');
    if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    var nav = (navigator.language || '').toLowerCase();
    if (nav.indexOf('th') === 0) return 'th';
    if (nav.indexOf('pt') === 0) return 'pt';
    return DEFAULT;
  }

  function applyStrings(data) {
    strings = data;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (data[k] !== undefined) el.textContent = data[k];
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-html');
      if (data[k] !== undefined) el.innerHTML = data[k];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-placeholder');
      if (data[k] !== undefined) el.placeholder = data[k];
    });
    document.documentElement.lang = current;
    document.querySelectorAll('.lang-flag').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === current);
    });
  }

  function load(lang) {
    fetch('locales/' + lang + '.json')
      .then(function (r) { return r.json(); })
      .then(applyStrings)
      .catch(function () {
        if (lang !== DEFAULT) load(DEFAULT);
      });
  }

  window.setLanguage = function (lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    current = lang;
    localStorage.setItem('veripura-lang', lang);
    load(lang);
  };

  window.t = function (key) {
    return strings[key] !== undefined ? strings[key] : key;
  };

  function init() {
    current = detectLang();
    // Always fetch so window.t() works for form validation strings
    load(current);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
