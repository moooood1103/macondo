/* 《复活》阅读分享 · 滚动动效引擎
   原生 JS，无任何外部依赖（无 CDN / 无字体请求），适合国内网络与 Edge 浏览器 */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";
  var frame = document.getElementById("frame");
  var scrollSpace = document.getElementById("scrollSpace");
  var progressBar = document.getElementById("progressBar");
  var hint = document.getElementById("hint");
  var fsBtn = document.getElementById("fsBtn");

  var SHIFT = 1.6;                     // 肖像后新增"停顿+名字"节拍，其后内容整体后移
  var SHIFT2 = 0.7;                    // 钢笔等第二屏文字完全渐隐之后才出现
  var EXTRA3 = 0.35;                   // 第三屏（主线）多停留一会儿
  var ACTS = 14 + SHIFT + SHIFT2 + EXTRA3;  // 整条滚动时间轴长度

  var range = function (v, a, b) {
    if (b === a) return v >= b ? 1 : 0;
    return Math.min(1, Math.max(0, (v - a) / (b - a)));
  };
  var smooth = function (t) { return t * t * (3 - 2 * t); };
  var clip = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var len = function (v) { return v.toFixed(1); };

  /* ============================================================
     1. 破碎笔画：沿肖像路径采样，初始散落在标题区域
        滚动时飞向路径 → “文字笔画重组成侧面肖像”
     ============================================================ */
  var shardGroup = document.getElementById("shards");
  var shards = [];
  var portraitPaths = [].slice.call(document.querySelectorAll("#portrait path"));
  portraitPaths.forEach(function (path) {
    var total = path.getTotalLength();
    var count = Math.max(7, Math.round(total / 40));
    for (var i = 0; i < count; i++) {
      var t = (i + 0.5) / count;
      var p1 = path.getPointAtLength(t * total);
      var p2 = path.getPointAtLength(Math.min(total, t * total + 20));
      var line = document.createElementNS(SVGNS, "line");
      line.setAttribute("x1", len(p1.x));
      line.setAttribute("y1", len(p1.y));
      line.setAttribute("x2", len(p2.x));
      line.setAttribute("y2", len(p2.y));
      // 起点：散落在封面文字所在区域（左上），随滚动收拢到肖像路径
      var sx = 130 + Math.random() * 620;
      var sy = 200 + Math.random() * 250;
      line.dataset.dx = len(sx - p1.x);
      line.dataset.dy = len(sy - p1.y);
      line.dataset.rot = len((Math.random() - 0.5) * 120);
      shardGroup.appendChild(line);
      shards.push(line);
    }
  });

  /* ============================================================
     2. 最终致谢的笔画：散落 → 聚拢成“谢谢 欢迎交流 / 名字”
     ============================================================ */
  var finalShardGroup = document.getElementById("finalShards");
  var finalShards = [];
  for (var fi = 0; fi < 84; fi++) {
    var tx = 430 + Math.random() * 740;      // 目标落在致谢文字区域内
    var ty = 340 + Math.random() * 220;
    var fl = document.createElementNS(SVGNS, "line");
    fl.setAttribute("x1", len(tx));
    fl.setAttribute("y1", len(ty));
    fl.setAttribute("x2", len(tx + (Math.random() - 0.5) * 52));
    fl.setAttribute("y2", len(ty + (Math.random() - 0.5) * 52));
    fl.dataset.dx = len((Math.random() - 0.5) * 1500);
    fl.dataset.dy = len((Math.random() - 0.5) * 900);
    fl.dataset.rot = len((Math.random() - 0.5) * 150);
    finalShardGroup.appendChild(fl);
    finalShards.push(fl);
  }

  /* ============================================================
     3. 线稿准备（描边生长）
     ============================================================ */
  function prepStroke(el) {
    var l = el.getTotalLength ? el.getTotalLength() : 0;
    el.style.strokeDasharray = l;
    el.style.strokeDashoffset = l;
    return l;
  }
  var portraitLens = portraitPaths.map(prepStroke);
  var penPaths = [].slice.call(document.querySelectorAll("#pen path"));
  var penLens = penPaths.map(prepStroke);
  var pencilPaths = [].slice.call(document.querySelectorAll("#pencil path"));
  var pencilLens = pencilPaths.map(prepStroke);
  var linePaths = [].slice.call(document.querySelectorAll("#lines path"));
  var lineLens = linePaths.map(prepStroke);
  var inkLine = document.getElementById("inkLine");
  var inkLen = prepStroke(inkLine);
  var duelPaths = [].slice.call(document.querySelectorAll("#duel path"));
  var duelLens = duelPaths.map(prepStroke);
  var duelL = document.getElementById("duelL");
  var duelR = document.getElementById("duelR");
  var grabPaths = [].slice.call(document.querySelectorAll("#grab path"));
  var grabLens = grabPaths.map(prepStroke);
  var grabEl = document.getElementById("grab");
  var doveBigPaths = [].slice.call(document.querySelectorAll("#doveBig path"));
  var doveBigLens = doveBigPaths.map(prepStroke);
  var doveBigEl = document.getElementById("doveBig");

  var art = {
    bloom: document.getElementById("bloom"),
    shards: shardGroup,
    portrait: document.getElementById("portrait"),
    pen: document.getElementById("pen"),
    inkLine: inkLine,
    pencil: document.getElementById("pencil"),
    duel: document.getElementById("duel"),
    grab: grabEl,
    doveBig: doveBigEl,
    doves: document.getElementById("doves"),
    lines: document.getElementById("lines"),
    finalShards: finalShardGroup
  };
  var doveEls = [].slice.call(document.querySelectorAll(".dove"));

  /* ============================================================
     4. 文字：拆成单字，便于“笔画分崩离析”
     ============================================================ */
  function splitChars(root) {
    var out = [];
    var walk = function (node) {
      var kids = [].slice.call(node.childNodes);
      for (var i = 0; i < kids.length; i++) {
        var n = kids[i];
        if (n.nodeType === 3) {
          var text = n.nodeValue;
          if (!text || !text.replace(/\s/g, "")) continue;
          var frag = document.createDocumentFragment();
          for (var k = 0; k < text.length; k++) {
            var ch = text.charAt(k);
            if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); continue; }
            var span = document.createElement("span");
            span.className = "char";
            span.textContent = ch;
            span.dataset.dx = len((Math.random() - 0.5) * 700);
            span.dataset.dy = len((Math.random() - 0.35) * 460);
            span.dataset.rot = len((Math.random() - 0.5) * 80);
            frag.appendChild(span);
            out.push(span);
          }
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== "BR") {
          walk(n);
        }
      }
    };
    walk(root);
    return out;
  }
  function applyShatter(chars, t) {
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];
      var s = smooth(clip(t * 1.15 - (i % 9) * 0.02, 0, 1));
      c.style.transform = "translate(" + (c.dataset.dx * s) + "px," + (c.dataset.dy * s) +
        "px) rotate(" + (c.dataset.rot * s) + "deg)";
      c.style.opacity = (1 - s * 1.2).toFixed(3);
    }
  }

  var coverScene = document.querySelector(".scene-cover");
  var endScene = document.querySelector(".scene-end");
  var coverChars = coverScene ? splitChars(coverScene) : [];
  var endChars = endScene ? splitChars(endScene) : [];

  /* ============================================================
     5. 场景缓存
     ============================================================ */
  var ENTRY = { 2: 1.62, 10: 1.90 };      // 肖像节拍之后，这些场景额外错开
  function actOffset(act) {                 // 肖像之后的场景统一后移
    if (act <= 1) return 0;
    if (act === 2) return ENTRY[2];          // 第二屏保持原位（先渐隐）
    var extra = act >= 4 ? EXTRA3 : 0;       // 第三屏之后让出主线的时间
    var base = SHIFT + SHIFT2 + extra;
    return ENTRY[act] !== undefined ? ENTRY[act] + SHIFT2 + extra : base;
  }
  function sceneHold(act) { return act === 3 ? EXTRA3 : 0; }
  var scenes = [].slice.call(document.querySelectorAll(".scene")).map(function (el) {
    var act = parseInt(el.dataset.act || "0", 10);
    return {
      el: el,
      act: act,
      off: actOffset(act),
      fades: [].slice.call(el.querySelectorAll(".fade"))
    };
  });
  var LAST_ACT = scenes.reduce(function (m, s) { return Math.max(m, s.act); }, 0);

  /* 场景进出：淡入 → 停留 → 淡出（相邻场景交叉过渡，衔接自然） */
  function sceneOpacity(p, act, off) {
    if (act === 0) return 1;                                  // 封面由单字碎裂控制
    var inA = act - 0.22 + off, inB = act + 0.20 + off;
    var inP = smooth(range(p, inA, inB));
    if (act === LAST_ACT) return inP;
    var hold = sceneHold(act);
    var outA = act + 0.82 + off + hold, outB = act + 1.06 + off + hold;
    return inP * (1 - smooth(range(p, outA, outB)));
  }

  /* ============================================================
     6. 渲染
     ============================================================ */
  var maxScroll = 1;
  var lineGeom = null;
  var lineSteps = [];
  function measureLine() {
    var sceneLine = document.querySelector('.scene[data-act="3"]');
    var stepsEl = sceneLine ? sceneLine.querySelector(".steps") : null;
    if (!sceneLine || !stepsEl) return;
    var fr = frame.getBoundingClientRect();
    if (!fr.width) return;
    var k = 1600 / fr.width;                       // CSS px -> SVG 视图坐标
    var sr = stepsEl.getBoundingClientRect();
    var x1 = (sr.left - fr.left) * k - 12;
    var x2 = (sr.right - fr.left) * k + 12;
    var y = (sr.bottom - fr.top) * k + 30;         // 文字下方
    lineGeom = { x1: x1, x2: x2, y: y };
    inkLine.setAttribute("x1", x1.toFixed(1));
    inkLine.setAttribute("y1", y.toFixed(1));
    inkLine.setAttribute("x2", x2.toFixed(1));
    inkLine.setAttribute("y2", y.toFixed(1));
    inkLen = inkLine.getTotalLength();
    inkLine.style.strokeDasharray = inkLen;
    lineSteps = [].slice.call(sceneLine.querySelectorAll(".step"));
    lineFoot = sceneLine.querySelector(".foot");
  }
  var lineFoot = null;
  function measure() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    measureLine();
  }

  function render() {
    var p = clip((window.scrollY || window.pageYOffset || 0) / maxScroll * ACTS, 0, ACTS);
    var inkT = smooth(range(p, 5.42, 6.00));        // 墨迹从左到右的进度（笔尖所在位置）

    /* --- 场景文字 --- */
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i];
      var op = sceneOpacity(p, s.act, s.off);
      s.el.style.opacity = op;
      var gone = op < 0.01 || (s.act === 0 && p > 1.55);
      s.el.style.visibility = gone ? "hidden" : "visible";
      s.el.style.transform = "scale(" + (1 + (1 - op) * 0.03).toFixed(4) + ")";
      var t0 = p - (s.act - 0.22 + s.off);
      for (var j = 0; j < s.fades.length; j++) {
        var f = s.fades[j];
        var d = parseFloat(f.dataset.d || "0");
        var e = s.act === 0 ? 1 : smooth(range(t0, 0.06 + d * 0.075, 0.40 + d * 0.075));
        f.style.opacity = e;
        f.style.transform = "translateY(" + ((1 - e) * 0.9).toFixed(3) + "em)";
      }
      /* 第三屏：三段主线随墨迹从左到右依次亮起，速度与喷墨一致 */
      if (s.act === 3) {
        for (var q = 0; q < lineSteps.length; q++) {
          var c = (q + 0.5) / lineSteps.length;
          var tt = smooth(range(inkT, c - 0.07, c + 0.07));
          lineSteps[q].style.opacity = tt;
          lineSteps[q].style.transform = "translateY(" + ((1 - tt) * 0.5).toFixed(3) + "em)";
        }
        if (lineFoot) {
          var ft = smooth(range(inkT, 0.93, 1.07));
          lineFoot.style.opacity = ft;
          lineFoot.style.transform = "translateY(" + ((1 - ft) * 0.5).toFixed(3) + "em)";
        }
      }
    }

    /* --- 背景由晨光渐入夜色 --- */
    var night = clip(1 - smooth(range(p, 3.30, 3.80)) + smooth(range(p, 12.60, 13.10)), 0, 1);
    var dawn = 1 - night;
    frame.style.setProperty("--o-night", night.toFixed(3));
    frame.style.setProperty("--o-dawn", (dawn * 0.96).toFixed(3));
    frame.style.setProperty("--o-ink", (dawn * 0.62).toFixed(3));
    document.documentElement.style.setProperty("--art", mix("#23282D", "#F5F3EE", night));
    document.documentElement.style.setProperty("--bloom",
      night > 0.5 ? "rgba(245,243,238," + (0.10 + night * 0.05).toFixed(2) + ")"
                  : "rgba(35,40,45,0.16)");

    /* --- 封面文字：笔画分崩离析 --- */
    var coverT = smooth(range(p, 0.84, 1.30));
    applyShatter(coverChars, coverT);
    coverScene.style.filter = coverT > 0.02 ? "blur(" + (coverT * 3.4).toFixed(2) + "px)" : "none";

    /* --- 散落笔画重组成肖像 --- */
    var shardIn = smooth(range(p, 0.86, 1.06));
    var assemble = smooth(range(p, 1.02, 1.80));
    var shardOut = smooth(range(p, 1.80, 2.12));
    art.shards.style.opacity = (shardIn * (1 - shardOut)).toFixed(3);
    for (var k = 0; k < shards.length; k++) {
      var el = shards[k];
      var back = 1 - assemble;
      el.style.transform = "translate(" + (el.dataset.dx * back) + "px," +
        (el.dataset.dy * back) + "px) rotate(" + (el.dataset.rot * back) + "deg)";
    }

    /* --- 肖像描边 + 镜头穿过 --- */
    var draw = smooth(range(p, 1.34, 1.96));
    for (var a = 0; a < portraitPaths.length; a++) {
      portraitPaths[a].style.strokeDashoffset = (portraitLens[a] * (1 - draw)).toFixed(1);
    }
    /* 停顿：1.96→2.45 肖像静置不动 */
    var nameIn = smooth(range(p, 2.45, 2.92));      // 名字渐渐显出
    var nameOut = smooth(range(p, 3.15, 3.48));     // 名字消失
    var nameEl = document.getElementById("portraitName");
    if (nameEl) {
      nameEl.style.opacity = (nameIn * (1 - nameOut)).toFixed(3);
      nameEl.style.transform = "translate(-50%," + ((1 - nameIn) * 14 - nameOut * 12).toFixed(1) + "px)";
    }
    var passT = smooth(range(p, 3.30, 4.05));       // 视角穿过肖像
    art.portrait.style.opacity = (draw * (1 - passT)).toFixed(3);
    art.portrait.style.transform = "scale(" + (1 + passT * 3.1).toFixed(3) + ")";
    art.portrait.style.transformOrigin = "830px 380px";

    /* --- 钢笔 + 墨线 --- */
    var penT = smooth(range(p, 5.30, 5.50));            // 钢笔先转正、浮现
    for (var b = 0; b < penPaths.length; b++) {
      penPaths[b].style.strokeDashoffset = (penLens[b] * (1 - penT)).toFixed(1);
    }
    art.pen.style.opacity = (penT * (1 - smooth(range(p, 6.10, 6.45)))).toFixed(3);
    inkLine.style.strokeDashoffset = (inkLen * (1 - inkT)).toFixed(1);
    art.inkLine.style.opacity = ((penT ? 1 : 0) * (1 - smooth(range(p, 6.35, 6.75)))).toFixed(3);
    if (lineGeom) {                                      // 逆时针 90°：笔身在后、笔尖朝右
      var nibX = lineGeom.x1 + (lineGeom.x2 - lineGeom.x1) * inkT;
      art.pen.setAttribute("transform",
        "translate(" + nibX.toFixed(1) + "," + lineGeom.y.toFixed(1) + ") rotate(-90) translate(-841,-326)");
    }

    /* --- 墨水晕染（第四页的四格分区） --- */
    var bloomT = smooth(range(p, 6.20, 7.20));
    art.bloom.style.opacity = (bloomT * (1 - smooth(range(p, 7.75, 8.65)))).toFixed(3);
    art.bloom.style.transform = "scale(" + (0.7 + bloomT * 0.5).toFixed(3) + ")";
    art.bloom.style.transformOrigin = "800px 480px";

    /* --- 墨水勾出铅笔 --- */
    var pencilT = smooth(range(p, 7.85, 8.45));
    for (var c = 0; c < pencilPaths.length; c++) {
      pencilPaths[c].style.strokeDashoffset = (pencilLens[c] * (1 - pencilT)).toFixed(1);
    }
    art.pencil.style.opacity = (pencilT * (1 - smooth(range(p, 8.45, 8.75)))).toFixed(3);

    /* --- 细节二：两个侧面肖像面对面交锋（随文字同屏出现，再相向靠近） --- */
    var duelOp = 0.55 * smooth(range(p, 8.42, 8.60)) * (1 - smooth(range(p, 9.45, 9.71)));
    if (art.duel) art.duel.style.opacity = duelOp.toFixed(3);
    var duelHalf = Math.floor(duelPaths.length / 2);
    for (var u = 0; u < duelPaths.length; u++) {
      var rightSide = u >= duelHalf;
      var idx = rightSide ? u - duelHalf : u;
      var begin = (rightSide ? 8.62 : 8.46) + idx * 0.024;
      var tt2 = smooth(range(p, begin, begin + 0.30));
      duelPaths[u].style.strokeDashoffset = (duelLens[u] * (1 - tt2)).toFixed(1);
    }
    var duelDrift = smooth(range(p, 8.90, 9.55)) * 100;  // 起点间距 70 → 终点深度重合 130（与放大量一致）
    if (duelL) duelL.setAttribute("transform", "translate(" + (879 + duelDrift).toFixed(1) + ",107) scale(1.5)");
    if (duelR) duelR.setAttribute("transform", "translate(" + (1585 - duelDrift).toFixed(1) + ",105) scale(-1.5,1.5)");

    /* --- 细节三：握拳抓钞票（同套极简线稿，右侧，让开文字） --- */
    var grabOp = 0.55 * smooth(range(p, 9.50, 9.72)) * (1 - smooth(range(p, 10.45, 10.71)));
    if (art.grab) art.grab.style.opacity = grabOp.toFixed(3);
    for (var g = 0; g < grabPaths.length; g++) {
      var gb = 9.55 + g * 0.05;
      var gt = smooth(range(p, gb, gb + 0.42));
      grabPaths[g].style.strokeDashoffset = (grabLens[g] * (1 - gt)).toFixed(1);
    }
    if (grabEl) {
      var grabRise = smooth(range(p, 9.55, 10.35)) * 10;   // 轻轻向上一提，像"抓起来"
      grabEl.setAttribute("transform", "translate(1070," + (293 - grabRise).toFixed(1) + ") scale(1.5)");
    }

    /* --- 细节四：极简白鸽（逐线描出，随后与背景小鸽群交棒） --- */
    var doveBigOp = 0.55 * smooth(range(p, 10.55, 10.78)) * (1 - smooth(range(p, 11.45, 11.71)));
    if (art.doveBig) art.doveBig.style.opacity = doveBigOp.toFixed(3);
    for (var dq = 0; dq < doveBigPaths.length; dq++) {
      var db = 10.60 + dq * 0.05;
      var dt = smooth(range(p, db, db + 0.42));
      doveBigPaths[dq].style.strokeDashoffset = (doveBigLens[dq] * (1 - dt)).toFixed(1);
    }
    if (doveBigEl) {
      var doveRise2 = smooth(range(p, 10.60, 11.40)) * 12;   // 轻轻上浮，像要起飞
      doveBigEl.setAttribute("transform", "translate(894," + (223 - doveRise2).toFixed(1) + ") scale(1.6)");
    }

    /* --- 鸽子：第八页出现，第九页飞走 --- */
    var doveIn = smooth(range(p, 10.70, 11.30));
    var doveOut = smooth(range(p, 11.70, 12.35));
    var doveRise = smooth(range(p, 11.95, 12.75));
    art.doves.style.opacity = (doveIn * (1 - doveOut)).toFixed(3);
    for (var d = 0; d < doveEls.length; d++) {
      var de = doveEls[d];
      var dir = d % 2 === 0 ? -1 : 1;
      var dx = 210 + d * 268 + Math.sin(p * 2.1 + d) * 14 - doveRise * dir * 260;
      var dy = 150 + (d % 3) * 96 + Math.cos(p * 1.7 + d) * 10 - doveOut * 320 - doveRise * 140;
      de.setAttribute("transform", "translate(" + dx.toFixed(1) + "," + dy.toFixed(1) + ") scale(" + (0.85 + (d % 3) * 0.22).toFixed(2) + ")");
      de.style.opacity = (doveIn * (1 - doveOut * 0.9) * (0.55 + 0.45 * Math.abs(Math.sin(d + 0.7)))).toFixed(3);
    }

    /* --- 两条线（第九页） --- */
    var lineT = smooth(range(p, 11.80, 12.60));
    for (var e2 = 0; e2 < linePaths.length; e2++) {
      linePaths[e2].style.strokeDashoffset = (lineLens[e2] * (1 - lineT)).toFixed(1);
    }
    art.lines.style.opacity = (lineT * (1 - smooth(range(p, 12.80, 13.35)))).toFixed(3);
    art.lines.style.transform = "translateY(" + (-smooth(range(p, 12.75, 13.45)) * 80).toFixed(1) + "px)";

    /* --- 收尾：上一页文字碎裂 → 笔画聚拢成致谢 --- */
    var endT = smooth(range(p, 15.23, 15.79));
    applyShatter(endChars, endT);

    var fIn = smooth(range(p, 15.47, 15.71));
    var fConverge = smooth(range(p, 15.59, 16.23));
    var fOut = smooth(range(p, 16.21, 16.57));
    art.finalShards.style.opacity = (fIn * (1 - fOut)).toFixed(3);
    for (var q = 0; q < finalShards.length; q++) {
      var fs2 = finalShards[q];
      var bk = 1 - fConverge;
      fs2.style.transform = "translate(" + (fs2.dataset.dx * bk) + "px," +
        (fs2.dataset.dy * bk) + "px) rotate(" + (fs2.dataset.rot * bk) + "deg)";
    }
    var thanksT = smooth(range(p, 15.79, 16.27));
    var namesT = smooth(range(p, 16.13, 16.57));
    var ct = document.getElementById("clipThanksRect");
    var cn = document.getElementById("clipNamesRect");
    if (ct) ct.setAttribute("width", (thanksT * 820).toFixed(1));
    if (cn) cn.setAttribute("width", (namesT * 560).toFixed(1));

    /* --- 进度与提示 --- */
    progressBar.style.width = (p / ACTS * 100).toFixed(2) + "%";
    if (p > 0.25) hint.classList.add("hide");
    else hint.classList.remove("hide");
  }

  /* ---------- 颜色插值 ---------- */
  function hex2rgb(h) {
    return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  }
  function mix(c1, c2, t) {
    var a = hex2rgb(c1), b = hex2rgb(c2);
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," +
      Math.round(a[1] + (b[1] - a[1]) * t) + "," +
      Math.round(a[2] + (b[2] - a[2]) * t) + ")";
  }

  /* ---------- 交互 ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { render(); ticking = false; });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { measure(); render(); });

  function goAct(delta) {
    var actPx = maxScroll / ACTS;
    var cur = Math.round((window.scrollY || 0) / actPx);
    var next = clip(cur + delta, 0, ACTS);
    window.scrollTo({ top: next * actPx, behavior: "smooth" });
  }
  window.addEventListener("keydown", function (ev) {
    var k = ev.key;
    if (k === "ArrowDown" || k === "PageDown" || k === " " || k === "Enter") {
      ev.preventDefault(); goAct(1);
    } else if (k === "ArrowUp" || k === "PageUp") {
      ev.preventDefault(); goAct(-1);
    } else if (k === "Home") {
      ev.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (k === "End") {
      ev.preventDefault(); window.scrollTo({ top: maxScroll, behavior: "smooth" });
    }
  });
  /* 白板/触屏：轻触画面推进一段 */
  frame.addEventListener("click", function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest("button")) return;
    goAct(1);
  });

  if (fsBtn) {
    fsBtn.addEventListener("click", function () {
      var el = document.documentElement;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen();
    });
  }

  measure();
  render();
  window.addEventListener("load", function () { measure(); render(); });
})();
