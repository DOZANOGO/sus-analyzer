/* utils/stats.js —— 统计计算（纯函数，适配两阶段 parser 的 note 模型） */
window.WM = window.WM || {};
WM.Stats = (function () {
  "use strict";

  const WINDOW_MS = 5000;
  const STEP_MS = 1000;
  const CAT = WM.SusParser.CATEGORY;
  const TYPE_COLORS = {
    tap: '#4fc3f7', critical: '#ffd54f', flick: '#ff7043',
    slideStart: '#ab47bc', slideTick: '#ce93d8', slideEnd: '#7b1fa2',
    trace: '#78909c'
  };
  const TYPE_ORDER = ['tap', 'critical', 'flick', 'slideStart', 'slideTick', 'slideEnd', 'trace'];

  /** 主入口 */
  function compute(notes, slides, combo) {
    const judged = notes.filter(n => n.judged);
    const typeCounts = countByType(notes);
    const duration = calcDuration(judged);
    const densityCurve = calcDensityCurve(judged);
    const counts = densityCurve.points.map(p => p.count);
    const threshold = mean(counts) + stdDev(counts);
    return {
      objectCount: notes.length, judgedCount: judged.length,
      comboCount: combo || { total: 0, slide: 0, tap: 0, halfBeat: 0 },
      typeCounts, typePercentages: calcPercentages(typeCounts, notes.length),
      duration, avgDensity: duration > 0 ? judged.length / duration : 0,
      densityCurve, difficultySections: findDifficultySections(densityCurve.points, threshold),
      doublePress: calcDoublePress(judged), slideChains: calcSlideChains(slides || [])
    };
  }

  function countByType(notes) {
    const c = {};
    for (const cat of TYPE_ORDER) c[cat] = 0;
    for (const n of notes) c[n.category] = (c[n.category] || 0) + 1;
    return c;
  }

  function calcPercentages(counts, total) {
    const p = {};
    for (const k in counts) p[k] = total > 0 ? counts[k] / total * 100 : 0;
    return p;
  }

  function calcDuration(judged) {
    return judged.length === 0 ? 0 : judged[judged.length - 1].ms / 1000;
  }

  /** 滑窗密度曲线（5s 窗口，1s 步长） */
  function calcDensityCurve(judged) {
    if (judged.length === 0) return { points: [], peakIdx: -1 };
    const lastMs = judged[judged.length - 1].ms;
    const points = [];
    let peakIdx = 0;
    for (let t = 0; t <= lastMs; t += STEP_MS) {
      const count = countInWindow(judged, t, t + WINDOW_MS);
      points.push({ time: t, count });
      if (count > points[peakIdx].count) peakIdx = points.length - 1;
    }
    return { points, peakIdx };
  }

  function countInWindow(judged, start, end) {
    let c = 0;
    for (const n of judged) if (n.ms >= start && n.ms < end) c++;
    return c;
  }

  function findDifficultySections(points, threshold) {
    const sections = [];
    let start = -1;
    for (let i = 0; i < points.length; i++) {
      if (points[i].count > threshold && start === -1) start = i;
      if (points[i].count <= threshold && start !== -1) {
        sections.push(makeSection(points, start, i - 1));
        start = -1;
      }
    }
    if (start !== -1) sections.push(makeSection(points, start, points.length - 1));
    return sections;
  }

  function makeSection(points, s, e) {
    let peak = 0;
    for (let i = s; i <= e; i++) peak = Math.max(peak, points[i].count);
    return { startIdx: s, endIdx: e, startTime: points[s].time, endTime: points[e].time, peak };
  }

  /** 双押统计（同 ms 的 judged note） */
  function calcDoublePress(judged) {
    const byMs = groupByMs(judged);
    const multiTimes = Object.keys(byMs).map(Number)
      .filter(t => byMs[t].length >= 2).sort((a, b) => a - b);
    const maxSim = multiTimes.length > 0 ? Math.max(...multiTimes.map(t => byMs[t].length)) : 0;
    return { count: multiTimes.length, maxSimultaneous: maxSim, densestWindow: findDensestWindow(multiTimes) };
  }

  function groupByMs(judged) {
    const m = {};
    for (const n of judged) (m[n.ms] = m[n.ms] || []).push(n);
    return m;
  }

  function findDensestWindow(times) {
    if (times.length === 0) return null;
    let best = { startTime: times[0], count: 0 };
    for (let i = 0; i < times.length; i++) {
      let c = 0;
      for (let j = i; j < times.length && times[j] < times[i] + WINDOW_MS; j++) c++;
      if (c > best.count) best = { startTime: times[i], count: c };
    }
    best.endTime = best.startTime + WINDOW_MS;
    return best;
  }

  /** 滑键链统计 */
  function calcSlideChains(slides) {
    let longest = 0, longestDur = 0;
    for (const s of slides) {
      longest = Math.max(longest, s.noteCount);
      longestDur = Math.max(longestDur, s.duration);
    }
    return { count: slides.length, longestLength: longest, longestDuration: longestDur };
  }

  function mean(arr) { return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
  function stdDev(arr) {
    if (arr.length === 0) return 0;
    const m = mean(arr);
    return Math.sqrt(mean(arr.map(x => (x - m) ** 2)));
  }

  return { compute, TYPE_COLORS, TYPE_ORDER, WINDOW_MS };
})();
