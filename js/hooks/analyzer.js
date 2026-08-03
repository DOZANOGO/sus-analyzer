/* hooks/analyzer.js —— 分析流程编排（状态管理 + 业务逻辑） */
window.WM = window.WM || {};
WM.Analyzer = (function () {
  "use strict";
  const state = { parsed: null, stats: null };

  function init() {
    WM.FileImport.init({ onAnalyze: analyze, onClear: clear });
    WM.CalibrationUI.init({});
  }

  /** 主流程：解析 → 统计 → 渲染 */
  function analyze(text) {
    if (!text || !text.trim()) { showNotice('请输入 SUS 数据', 'error'); return; }
    try {
      state.parsed = WM.SusParser.parse(text);
      if (state.parsed.notes.length === 0) {
        showNotice('未解析到任何 Note，请检查格式', 'error');
        return;
      }
      state.stats = WM.Stats.compute(state.parsed.notes, state.parsed.slides, state.parsed.combo);
      showResults();
      updateUI();
      showNotice('解析完成 ✓', 'success');
    } catch (e) {
      console.error(e);
      showNotice('解析出错：' + (e.message || e), 'error');
    }
  }

  function showResults() { document.getElementById('results').style.display = 'block'; }

  function updateUI() {
    WM.Details.renderMeta(state.parsed.meta);
    WM.StatCards.render(state.stats);
    WM.Charts.drawTypeChart(state.stats);
    WM.Charts.drawDensityChart(state.stats);
    WM.Details.renderDifficulty(state.stats.difficultySections);
    WM.Details.renderDoublePress(state.stats.doublePress);
    WM.Details.renderSlides(state.stats.slideChains);
    WM.CalibrationUI.render(state.stats.comboCount);
  }

  function showNotice(msg, type) {
    const el = document.getElementById('notice');
    el.textContent = msg;
    el.className = 'notice ' + (type || '');
  }

  function clear() {
    state.parsed = null; state.stats = null;
    document.getElementById('results').style.display = 'none';
    showNotice('', '');
  }

  return { init, analyze };
})();
