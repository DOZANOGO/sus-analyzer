/* components/calibrationUI.js —— 官方 Combo 自动计算展示（纯 UI，无业务逻辑） */
window.WM = window.WM || {};
WM.CalibrationUI = (function () {
  "use strict";

  function init() {}

  /** 展示 combo 分解：slide + tap + 半拍tick = 总数 */
  function render(combo) {
    const el = document.getElementById('calib-display');
    if (!combo || combo.total === 0) {
      el.innerHTML = '<span class="calib-hint">暂无 Combo 数据</span>';
      return;
    }
    el.innerHTML =
      `<div class="combo-total">官方 Combo：<b>${combo.total}</b></div>` +
      `<div class="combo-breakdown">` +
      `<span class="combo-part">slide note × ${combo.slide}</span>` +
      `<span class="combo-plus">+</span>` +
      `<span class="combo-part">tap × ${combo.tap}</span>` +
      `<span class="combo-plus">+</span>` +
      `<span class="combo-part">半拍 tick × ${combo.halfBeat}</span>` +
      `</div>` +
      `<div class="combo-source">基于 MMW 引擎 calculateHudEvents 逻辑自动计算</div>`;
  }

  return { init, render };
})();
