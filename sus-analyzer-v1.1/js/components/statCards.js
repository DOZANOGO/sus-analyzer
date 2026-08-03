/* components/statCards.js —— 统计卡片（纯 UI 渲染） */
window.WM = window.WM || {};
WM.StatCards = (function () {
  "use strict";

  function render(stats) {
    const el = document.getElementById('stat-cards');
    el.innerHTML = '';
    buildCardData(stats).forEach(d => el.appendChild(createCard(d)));
  }

  function buildCardData(s) {
    return [
      { label: '官方 Combo', value: s.comboCount.total, unit: '', color: '#66bb6a', highlight: true },
      { label: '对象数（口径A）', value: s.objectCount, unit: '个', color: '#7c4dff' },
      { label: '判定数（口径B）', value: s.judgedCount, unit: '个', color: '#4fc3f7' },
      { label: '总时长', value: s.duration.toFixed(1), unit: '秒', color: '#4fc3f7' },
      { label: '平均密度', value: s.avgDensity.toFixed(2), unit: 'n/s', color: '#ff7043' },
      { label: '双押次数', value: s.doublePress.count, unit: '次', color: '#ab47bc' },
      { label: '滑键链', value: s.slideChains.count, unit: '条', color: '#ffca28' }
    ];
  }

  function createCard(d) {
    const div = document.createElement('div');
    div.className = 'stat-card' + (d.highlight ? ' stat-card-highlight' : '');
    div.innerHTML = `<div class="stat-label">${d.label}</div>` +
      `<div class="stat-value" style="color:${d.color}">${d.value}` +
      `<span class="stat-unit">${d.unit}</span></div>`;
    return div;
  }

  return { render };
})();
