/* main.js —— 入口装配 */
(function () {
  "use strict";

  function boot() {
    WM.Charts.init();
    WM.Analyzer.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
