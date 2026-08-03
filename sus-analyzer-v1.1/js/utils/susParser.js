/* utils/susParser.js —— SUS 两阶段解析器（对齐 main 分支 analyze.ts + convert.ts）
   阶段1 analyze: 原始 SUS → tick 制 Score（channel 分流 + 分段累积 tick）
   阶段2 convert: Score → 统一 note 列表（ms 制 + 7 类分类 + 判定标记）
   仅支持真 SUS 格式（变体2），不兼容简化格式。 */
window.WM = window.WM || {};
WM.SusParser = (function () {
  "use strict";

  const CATEGORY = {
    TAP: 'tap', CRITICAL: 'critical', FLICK: 'flick',
    SLIDE_START: 'slideStart', SLIDE_TICK: 'slideTick', SLIDE_END: 'slideEnd',
    TRACE: 'trace'
  };
  const CATEGORY_NAMES = {
    tap: 'Tap', critical: 'Critical Tap', flick: 'Flick',
    slideStart: 'Slide Start', slideTick: 'Slide Tick', slideEnd: 'Slide End',
    trace: 'Trace'
  };

  /** 主入口 */
  function parse(text) {
    const score = analyze(text);
    const { notes, slides } = convert(score);
    const combo = calcCombo(score);
    return { meta: extractMeta(score), notes, slides, combo, skipped: 0 };
  }

  function extractMeta(score) {
    return {
      title: score.meta.TITLE || '', artist: score.meta.ARTIST || '',
      designer: score.meta.DESIGNER || '', bpm: score.bpm,
      waveOffset: parseFloat(score.meta.WAVEOFFSET || '0') || 0
    };
  }

  /* ==================== 阶段 1: analyze ==================== */

  function analyze(text) {
    const { lines, measureChanges, meta } = splitParse(text);
    const tpb = getTicksPerBeat(meta);
    const barLengths = getBarLengths(lines, measureChanges);
    const toTick = makeToTick(barLengths, tpb);
    const ctx = makeCtx(meta, tpb, toTick);
    for (let i = 0; i < lines.length; i++) {
      dispatchLine(lines[i], measureChanges, i, ctx);
    }
    ctx.slides = flatMap(ctx.streams.values(), toSlides);
    ctx.bpmChanges.sort((a, b) => a.tick - b.tick);
    ctx.bpm = resolveBpm(ctx.bpms, ctx.bpmChanges);
    return ctx;
  }

  function makeCtx(meta, tpb, toTick) {
    return {
      meta, tpb, toTick, offset: -parseFloat(meta.WAVEOFFSET || '0') || 0,
      bpms: {}, bpmChanges: [], tapNotes: [], dirNotes: [], streams: new Map(),
      slides: [], bpm: 120
    };
  }

  /** 对应 analyze.ts parse: 分离 lines / meta / measureChanges */
  function splitParse(text) {
    const lines = [], measureChanges = [], meta = {};
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line.startsWith('#')) continue;
      const isLine = line.includes(':');
      const idx = line.indexOf(isLine ? ':' : ' ');
      if (idx === -1) continue;
      const left = line.substring(1, idx).trim();
      const right = line.substring(idx + 1).trim();
      if (isLine) lines.push([left, right]);
      else if (left === 'MEASUREBS') measureChanges.unshift([lines.length, +right || 0]);
      else meta[left] = right;
    }
    return { lines, measureChanges, meta };
  }

  function getTicksPerBeat(meta) {
    const req = meta.REQUEST || '';
    if (!req.startsWith('"ticks_per_beat ') || !req.endsWith('"')) return 480;
    return +req.slice(16, -1) || 480;
  }

  function getBarLengths(lines, measureChanges) {
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const [h, d] = lines[i];
      if (h.length !== 5 || !h.endsWith('02')) continue;
      out.push({ measure: +h.substring(0, 3) + measureOffset(measureChanges, i), length: +d || 4 });
    }
    if (out.length === 0) out.push({ measure: 0, length: 4 });
    return out;
  }

  function measureOffset(mc, idx) {
    let off = 0;
    for (const [ci, cv] of mc) if (ci <= idx) off = cv;
    return off;
  }

  /** 对应 getToTick: 分段累积 tick */
  function makeToTick(barLengths, tpb) {
    let ticks = 0;
    const sorted = [...barLengths].sort((a, b) => a.measure - b.measure);
    const bars = sorted.map((bl, i) => {
      if (i) { const prev = sorted[i - 1]; ticks += (bl.measure - prev.measure) * prev.length * tpb; }
      return { measure: bl.measure, tpm: bl.length * tpb, ticks };
    }).reverse();
    return (measure, p, q) => {
      const bar = bars.find(b => measure >= b.measure);
      if (!bar) throw new Error('Unexpected missing bar');
      return bar.ticks + (measure - bar.measure) * bar.tpm + (p * bar.tpm) / q;
    };
  }

  function dispatchLine(line, measureChanges, i, ctx) {
    const [header, data] = line;
    const moff = measureOffset(measureChanges, i);
    if (header.length === 5 && header.startsWith('BPM')) { ctx.bpms[header.substring(3)] = +data || 0; return; }
    if (header.length === 5 && header.endsWith('08')) { pushBpmChanges(ctx, header, data, moff); return; }
    if (header.length === 5 && header[3] === '1') { ctx.tapNotes.push(...toNotes(header, data, moff, ctx.toTick)); return; }
    if (header.length === 6 && (header[3] === '3' || header[3] === '9')) { pushStream(ctx, header, data, moff); return; }
    if (header.length === 5 && header[3] === '5') { ctx.dirNotes.push(...toNotes(header, data, moff, ctx.toTick)); return; }
  }

  function pushBpmChanges(ctx, header, data, moff) {
    for (const r of toRaws(header, data, moff, ctx.toTick)) {
      ctx.bpmChanges.push({ tick: r.tick, bpm: ctx.bpms[r.value] || 0 });
    }
  }

  function pushStream(ctx, header, data, moff) {
    const key = header[5] + '-' + header[3];
    const notes = toNotes(header, data, moff, ctx.toTick);
    const stream = ctx.streams.get(key);
    if (stream) stream.notes.push(...notes);
    else ctx.streams.set(key, { type: +header[3], notes });
  }

  function toRaws(header, data, moff, toTick) {
    const measure = +header.substring(0, 3) + moff;
    const pairs = data.match(/.{2}/g) || [];
    const out = [];
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i] !== '00') out.push({ tick: Math.round(toTick(measure, i, pairs.length)), value: pairs[i] });
    }
    return out;
  }

  function toNotes(header, data, moff, toTick) {
    const lane = parseInt(header[4], 36);
    return toRaws(header, data, moff, toTick).map(r => ({
      tick: r.tick, lane, width: parseInt(r.value[1], 36), type: parseInt(r.value[0], 36)
    }));
  }

  /** 对应 toSlides: 按 type===2 切分 */
  function toSlides(stream) {
    const slides = [];
    let notes = null;
    for (const note of [...stream.notes].sort((a, b) => a.tick - b.tick)) {
      if (!notes) { notes = []; slides.push({ type: stream.type, notes }); }
      notes.push(note);
      if (note.type === 2) notes = null;
    }
    return slides;
  }

  function resolveBpm(bpms, bpmChanges) {
    if (bpmChanges.length > 0) return bpmChanges[0].bpm;
    for (const k in bpms) return bpms[k];
    return 120;
  }

  /* ==================== 阶段 2: convert ==================== */

  function convert(score) {
    const mods = buildMods(score);
    const singles = genSingles(score, mods);
    const slideObjs = genSlides(score, mods);
    const slideNotes = flatMap(slideObjs, s => slideToNotes(s, score, mods));
    const slides = slideObjs.map(s => ({
      noteCount: s.notes.length,
      duration: tickToMs(s.notes[s.notes.length - 1].tick, score) - tickToMs(s.notes[0].tick, score)
    }));
    return { notes: [...singles, ...slideNotes], slides };
  }

  function buildMods(score) {
    const m = {
      preventSingles: new Set(), flickMods: {}, traceMods: new Set(),
      criticalMods: new Set(), tickRemove: new Set(), slideSeRemove: new Set()
    };
    fillPreventSingles(score, m.preventSingles);
    fillFlickMods(score, m.flickMods);
    fillTapMods(score, m);
    return m;
  }

  function fillPreventSingles(score, set) {
    for (const slide of score.slides) {
      if (slide.type !== 3) continue;
      for (const n of slide.notes) if (n.type === 1 || n.type === 2 || n.type === 3 || n.type === 5) set.add(key(n));
    }
  }

  function fillFlickMods(score, mods) {
    for (const n of score.dirNotes) {
      if (n.type === 1) mods[key(n)] = 'up';
      else if (n.type === 3) mods[key(n)] = 'left';
      else if (n.type === 4) mods[key(n)] = 'right';
    }
  }

  function fillTapMods(score, m) {
    for (const n of score.tapNotes) {
      const k = key(n);
      if (n.type === 2) m.criticalMods.add(k);
      else if (n.type === 5) m.traceMods.add(k);
      else if (n.type === 6) { m.traceMods.add(k); m.criticalMods.add(k); }
      else if (n.type === 3) m.tickRemove.add(k);
      else if (n.type === 7) m.slideSeRemove.add(k);
      else if (n.type === 8) { m.criticalMods.add(k); m.slideSeRemove.add(k); }
    }
  }

  /** 生成 single notes（四重过滤） */
  function genSingles(score, m) {
    const out = [], dedupe = new Set();
    for (const n of score.tapNotes) {
      if (n.lane <= 1 || n.lane >= 14) continue;
      if (n.type !== 1 && n.type !== 2 && n.type !== 5 && n.type !== 6) continue;
      const k = key(n);
      if (m.preventSingles.has(k) || dedupe.has(k)) continue;
      dedupe.add(k);
      const trace = n.type === 5 || n.type === 6;
      const critical = n.type === 2 || n.type === 6;
      out.push(makeNote(n.tick, n.lane, score, singleCat(trace, critical, m.flickMods[k]), !trace, critical, m.flickMods[k]));
    }
    return out;
  }

  function singleCat(trace, critical, dir) {
    if (trace) return CATEGORY.TRACE;
    if (dir) return CATEGORY.FLICK;
    return critical ? CATEGORY.CRITICAL : CATEGORY.TAP;
  }

  function genSlides(score, m) {
    const out = [];
    for (const slide of score.slides) {
      const start = slide.notes.find(n => n.type === 1 || n.type === 2);
      if (!start) continue;
      const active = slide.type === 3;
      const crit = m.criticalMods.has(key(start));
      out.push({ active, critical: crit, notes: slide.notes });
    }
    return out;
  }

  /** slide → note 列表（按 connection kind 分类） */
  function slideToNotes(slide, score, mods) {
    const out = [];
    for (const n of slide.notes) {
      const k = key(n);
      const ms = tickToMs(n.tick, score);
      const cat = connCategory(n.type, slide.active, k, mods);
      if (!cat) continue;
      const judged = isConnJudged(cat);
      const trace = cat === CATEGORY.TRACE;
      out.push(makeNote(n.tick, n.lane, score, cat, judged, slide.critical && !trace, undefined, ms));
    }
    return out;
  }

  function connCategory(type, active, k, mods) {
    if (type === 1 || type === 2) {
      if (!active || mods.slideSeRemove.has(k)) return CATEGORY.TRACE;
      return type === 1 ? CATEGORY.SLIDE_START : CATEGORY.SLIDE_END;
    }
    if (type === 3) return mods.tickRemove.has(k) ? CATEGORY.TRACE : CATEGORY.SLIDE_TICK;
    if (type === 5) return mods.tickRemove.has(k) ? null : CATEGORY.TRACE;
    return null;
  }

  function isConnJudged(cat) {
    return cat === CATEGORY.SLIDE_START || cat === CATEGORY.SLIDE_TICK || cat === CATEGORY.SLIDE_END;
  }

  /* ==================== 共用工具 ==================== */

  function key(n) { return n.lane + '-' + n.tick; }

  function makeNote(tick, lane, score, category, judged, critical, direction, preMs) {
    return {
      ms: preMs !== undefined ? preMs : tickToMs(tick, score),
      lane, category, judged, critical: !!critical, direction: direction || null
    };
  }

  /** tick → ms: 按 BPM 段累加 */
  function tickToMs(tick, score) {
    const bc = score.bpmChanges;
    if (bc.length === 0) return 0;
    let ms = 0, prevTick = 0, prevBpm = bc[0].bpm || 120;
    for (const c of bc) {
      if (c.tick >= tick) break;
      ms += (c.tick - prevTick) * 60000 / (score.tpb * prevBpm);
      prevTick = c.tick; prevBpm = c.bpm || prevBpm;
    }
    ms += (tick - prevTick) * 60000 / (score.tpb * prevBpm);
    return ms;
  }

  function flatMap(arr, fn) { return arr.reduce((a, x) => a.concat(fn(x)), []); }

  /* ==================== 官方 Combo 计算（对齐 mmw_preview.cpp calculateHudEvents） ==================== */

  /** combo = slide note 事件 + tap note 事件 + hold 半拍 tick 事件 */
  function calcCombo(score) {
    const halfBeat = Math.floor(score.tpb / 2);
    const mods = buildComboMods(score);
    const prevent = buildPrevent(score.slides);
    const slideEv = countSlideEvents(score.slides, mods);
    const tapEv = countTapEvents(score.tapNotes, prevent);
    const hbEv = countHalfBeatEvents(score.slides, halfBeat);
    return { total: slideEv + tapEv + hbEv, slide: slideEv, tap: tapEv, halfBeat: hbEv };
  }

  /** 构建 combo 专用 mods（对齐 convert.ts：trace/critical/tickRemove/slideStartEndRemove） */
  function buildComboMods(score) {
    const m = { traceMods: new Set(), criticalMods: new Set(), tickRemove: new Set(), slideSeRemove: new Set() };
    for (const n of score.tapNotes) {
      const k = n.lane + '-' + n.tick;
      if (n.type === 2) m.criticalMods.add(k);
      else if (n.type === 5) m.traceMods.add(k);
      else if (n.type === 6) { m.traceMods.add(k); m.criticalMods.add(k); }
      else if (n.type === 3) m.tickRemove.add(k);
      else if (n.type === 7) m.slideSeRemove.add(k);
      else if (n.type === 8) { m.criticalMods.add(k); m.slideSeRemove.add(k); }
    }
    return m;
  }

  /** preventSingles: active slide 中 type 1/2/3/5 的 note 占用的 lane-tick */
  function buildPrevent(slides) {
    const set = new Set();
    for (const slide of slides) {
      if (slide.type !== 3) continue;
      for (const n of slide.notes) {
        if (n.type === 1 || n.type === 2 || n.type === 3 || n.type === 5) set.add(n.lane + '-' + n.tick);
      }
    }
    return set;
  }

  /** active slide 中的 note 事件数（跳过 invisible type5 + seRemove 端点） */
  function countSlideEvents(slides, mods) {
    let count = 0;
    for (const slide of slides) {
      if (slide.type !== 3) continue;
      for (const n of slide.notes) {
        if (n.type === 5) continue;
        if (n.type === 1 || n.type === 2) {
          if (mods.slideSeRemove.has(n.lane + '-' + n.tick)) continue;
        }
        count++;
      }
    }
    return count;
  }

  /** 独立 tap 事件数（lane 过滤 + type 白名单 + prevent 排除 + 去重） */
  function countTapEvents(tapNotes, prevent) {
    let count = 0;
    const dedupe = new Set();
    for (const n of tapNotes) {
      if (n.lane <= 1 || n.lane >= 14) continue;
      if (n.type !== 1 && n.type !== 2 && n.type !== 5 && n.type !== 6) continue;
      const k = n.lane + '-' + n.tick;
      if (prevent.has(k) || dedupe.has(k)) continue;
      dedupe.add(k);
      count++;
    }
    return count;
  }

  /** active hold 的半拍 tick 数（每 240 ticks 一个额外 combo） */
  function countHalfBeatEvents(slides, halfBeat) {
    let count = 0;
    for (const slide of slides) {
      if (slide.type !== 3) continue;
      const start = slide.notes.find(n => n.type === 1 || n.type === 2);
      const end = findLastType2(slide.notes);
      if (!start || !end) continue;
      count += calcHalfBeatTicks(start.tick, end.tick, halfBeat);
    }
    return count;
  }

  function findLastType2(notes) {
    for (let i = notes.length - 1; i >= 0; i--) if (notes[i].type === 2) return notes[i];
    return null;
  }

  /** 半拍 tick 数：从 start+halfBeat 对齐后，到 end 对齐，每 halfBeat 一个 */
  function calcHalfBeatTicks(st, et, halfBeat) {
    let eigth = st + halfBeat;
    if (eigth % halfBeat) eigth -= (eigth % halfBeat);
    if (eigth === st || eigth === et) return 0;
    if (et % halfBeat) et += halfBeat - (et % halfBeat);
    return Math.floor((et - eigth) / halfBeat);
  }

  return { parse, calcCombo, CATEGORY, CATEGORY_NAMES };
})();
