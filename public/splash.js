// Runs synchronously before React: tints the splash with the user's theme and
// language so the very first frame already matches the app.
(function () {
  var THEMES = {
    parchment: ['#191612', '#e5a953', '#f3ece2', '#2a231c'],
    serika:    ['#1f2326', '#e2b714', '#d1d0c5', '#30353a'],
    dracula:   ['#21222c', '#8be9fd', '#f8f8f2', '#2e3040'],
    nord:      ['#242933', '#88c0d0', '#eceff4', '#353c4a'],
    botanical: ['#151d18', '#7ea172', '#e6eee8', '#223028'],
    coffee:    ['#1c1512', '#c89666', '#ede3da', '#2e231e'],
    carbon:    ['#1e2022', '#f66e0d', '#f2f2f2', '#2e3236'],
    matrix:    ['#070d08', '#00ff66', '#00ff66', '#102213'],
    solarized: ['#00212b', '#2aa198', '#93a1a1', '#073642'],
    gruvbox:   ['#1d2021', '#fabd2f', '#ebdbb2', '#32302f'],
    cyber:     ['#16162a', '#00d2d3', '#e0e1dd', '#24243f'],
    oled:      ['#050507', '#ffffff', '#f4f4f5', '#141418']
  };
  var settings = {};
  try { settings = JSON.parse(localStorage.getItem('bookify_settings_v2') || '{}') || {}; } catch { /* first run */ }

  var palette = THEMES[settings.theme] || THEMES.parchment;
  var splash = document.getElementById('splash');
  if (!splash) return;
  splash.style.setProperty('--sp-bg', palette[0]);
  splash.style.setProperty('--sp-accent', palette[1]);
  splash.style.setProperty('--sp-text', palette[2]);
  splash.style.setProperty('--sp-paper', palette[3]);
  document.documentElement.style.background = palette[0];
  document.body.style.background = palette[0];
  if (settings.theme) document.documentElement.setAttribute('data-theme', settings.theme);

  if (settings.language === 'en') {
    document.documentElement.lang = 'en';
    var tagline = document.getElementById('splash-tagline');
    if (tagline) tagline.textContent = 'Where stories come to life';
    splash.setAttribute('aria-label', 'Bookify is starting');
  }
  window.__BOOKIFY_SPLASH_START__ = Date.now();
})();
