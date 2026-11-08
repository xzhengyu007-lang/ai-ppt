// OOXML 语义体检：不只看"文件结构完整"，而是针对已知会产生「需要修复」弹窗的
// 具体缺陷逐条断言。四条实测来源都是 PptxGenJS 的 open issue：
//   #1534 BAR/LINE 写出孤儿 <c:axId>          -> 检查图表轴引用完整性
//   #1546 组合图把 bar 专属 dLblPos 串进 line  -> 按图型校验 dLblPos 取值
//   #1444 多页写出幽灵 slideMaster 条目        -> Override 必须指向真实部件
//   #1443 notesMaster 占位符被修复流程删除      -> 检查 notesMaster/notesSlide 关系
//
// 用法: node lint.mjs <file.pptx>

import fs from 'node:fs';
import JSZip from 'jszip';

const ILLEGAL_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const DLBLPOS_BAR_ONLY = ['inEnd', 'inBase', 'outEnd', 'bestFit'];
const AXIS_TAGS = ['c:catAx', 'c:valAx', 'c:serAx', 'c:dateAx'];
const CHART_TAGS = ['c:barChart', 'c:lineChart', 'c:pieChart', 'c:areaChart', 'c:doughnutChart', 'c:scatterChart'];

function blockOf(xml, tag) {
  const open = `<${tag}>`;
  const out = [];
  let i = 0;
  while ((i = xml.indexOf(open, i)) !== -1) {
    const end = xml.indexOf(`</${tag}>`, i);
    if (end === -1) break;
    out.push(xml.slice(i, end));
    i = end + 1;
  }
  return out;
}

function axIds(s) {
  return [...s.matchAll(/<c:axId\s+val="(-?\d+)"/g)].map((m) => m[1]);
}

function resolveTarget(basePart, target) {
  // basePart 形如 ppt/slides/slide1.xml；target 相对 basePart 所在目录
  if (target.startsWith('/')) return target.slice(1);
  const baseDir = basePart.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') baseDir.pop();
    else if (seg !== '.') baseDir.push(seg);
  }
  return baseDir.join('/');
}

export async function lint(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const names = new Set(Object.keys(zip.files).filter((n) => !zip.files[n].dir));
  const read = (n) => zip.file(n).async('string');

  const pass = [];
  const fail = [];
  const info = [];
  const chk = (c, label, detail = '') => (c ? pass : fail).push(`${c ? 'PASS' : 'FAIL'}  ${label}${detail ? '  -> ' + detail : ''}`);

  // ---- 1. OPC 必备件 ----
  chk(names.has('[Content_Types].xml'), '[Content_Types].xml 存在');
  chk(names.has('_rels/.rels'), '_rels/.rels 存在');
  chk(names.has('ppt/presentation.xml'), 'ppt/presentation.xml 存在');

  const ct = await read('[Content_Types].xml');

  // ---- 2. 每个 Override 必须指向真实部件（#1444 幽灵条目）----
  const overrides = [...ct.matchAll(/<Override\s+PartName="([^"]+)"/g)].map((m) => m[1]);
  const ghost = overrides.filter((p) => !names.has(p.replace(/^\//, '')));
  chk(ghost.length === 0, `Content_Types 的 ${overrides.length} 个 Override 全部指向真实部件`, ghost.join(', ') || '无幽灵条目');

  // ---- 3. 每个 .rels 的 Target 必须解析到真实部件 ----
  const relsParts = [...names].filter((n) => n.endsWith('.rels'));
  const broken = [];
  for (const relsName of relsParts) {
    // 包级关系文件 _rels/.rels 的基准目录是包根，不是 _rels/
    const srcPart = relsName === '_rels/.rels' ? '' : relsName.replace(/_rels\/([^/]+)\.rels$/, '$1');
    const xml = await read(relsName);
    for (const m of xml.matchAll(/<Relationship\s+([^>]+)>/g)) {
      const attrs = m[1];
      if (/TargetMode="External"/.test(attrs)) continue;
      const tm = attrs.match(/Target="([^"]+)"/);
      if (!tm) continue;
      const resolved = resolveTarget(srcPart, tm[1]);
      if (!names.has(resolved)) broken.push(`${relsName} -> ${tm[1]}`);
    }
  }
  chk(broken.length === 0, `${relsParts.length} 个 rels 文件的引用全部可解析`, broken.slice(0, 3).join(' | ') || '无断链');

  // ---- 4. 每个部件都必须有 Content-Type（Default 或 Override）----
  const defaults = new Set([...ct.matchAll(/<Default\s+Extension="([^"]+)"/g)].map((m) => m[1].toLowerCase()));
  const overrideSet = new Set(overrides.map((p) => p.replace(/^\//, '')));
  const noCt = [...names]
    .filter((n) => n !== '[Content_Types].xml' && !n.endsWith('.rels'))
    .filter((n) => !overrideSet.has(n) && !defaults.has(n.split('.').pop().toLowerCase()));
  chk(noCt.length === 0, `所有部件都有 Content-Type`, noCt.slice(0, 3).join(', ') || '无缺声明');

  // ---- 5. XML 1.0 非法控制字符 ----
  const xmlParts = [...names].filter((n) => /\.(xml|rels)$/.test(n));
  const dirty = [];
  for (const n of xmlParts) if (ILLEGAL_XML.test(await read(n))) dirty.push(n);
  chk(dirty.length === 0, `${xmlParts.length} 个 XML 部件无非法控制字符`, dirty.join(',') || '0 处');

  // ---- 6. 画布尺寸 ----
  const pres = await read('ppt/presentation.xml');
  const sz = pres.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
  chk(sz && +sz[1] === 12192000 && +sz[2] === 6858000, '画布 = 12192000x6858000 EMU',
    sz ? `${sz[1]}x${sz[2]}` : 'sldSz 缺失');

  // ---- 7/8. 图表：轴引用完整性 + 按图型校验 dLblPos ----
  const chartParts = [...names].filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  info.push(`图表部件数：${chartParts.length}`);
  for (const cp of chartParts) {
    const xml = await read(cp);
    const defined = new Set();
    for (const tag of AXIS_TAGS) for (const b of blockOf(xml, tag)) axIds(b).slice(0, 1).forEach((v) => defined.add(v));

    const referenced = new Set();
    let hasGroup = false;
    for (const tag of CHART_TAGS) {
      for (const b of blockOf(xml, tag)) {
        hasGroup = true;
        axIds(b).forEach((v) => referenced.add(v));
      }
    }
    const orphans = [...referenced].filter((v) => !defined.has(v));
    const unused = [...defined].filter((v) => !referenced.has(v));
    chk(hasGroup && orphans.length === 0,
      `${cp}: 轴引用完整（#1534）`,
      hasGroup ? `引用 ${[...referenced].join(',')} / 定义 ${[...defined].join(',')}${orphans.length ? ' 孤儿:' + orphans.join(',') : ''}${unused.length ? ' 未引用:' + unused.join(',') : ''}` : '未找到图表组');

    // dLblPos 是否与图型匹配（#1546：line 里出现 bar 专属取值）
    for (const tag of CHART_TAGS) {
      for (const b of blockOf(xml, tag)) {
        const bad = [...b.matchAll(/<c:dLblPos\s+val="([^"]+)"/g)]
          .map((m) => m[1])
          .filter((v) => tag === 'c:lineChart' && DLBLPOS_BAR_ONLY.includes(v));
        if (bad.length) chk(false, `${cp}: ${tag} 的 dLblPos 合法（#1546）`, `非法取值 ${[...new Set(bad)].join(',')}`);
      }
    }
    // 分类标签引用类型（#1466：单层分类被写成 multiLvlStrRef）
    const multi = (xml.match(/<c:multiLvlStrRef>/g) || []).length;
    const single = (xml.match(/<c:strRef>/g) || []).length;
    info.push(`${cp}: multiLvlStrRef=${multi} strRef=${single}`);
  }
  if (chartParts.length) {
    const anyBad = fail.some((f) => /#1534|#1546/.test(f));
    if (!anyBad) chk(true, '图表：轴引用与 dLblPos 全部通过（#1534/#1546 未触发）');
  }

  // ---- 9. notesMaster / notesSlide 关系（#1443）----
  const notesMasters = [...names].filter((n) => /^ppt\/notesMasters\/notesMaster\d+\.xml$/.test(n));
  const notesSlides = [...names].filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n));
  info.push(`notesMaster=${notesMasters.length} notesSlide=${notesSlides.length}`);
  chk(true, `备注部件存在`, `notesMaster ${notesMasters.length} / notesSlide ${notesSlides.length}`);
  if (notesMasters.length) {
    const nm = await read(notesMasters[0]);
    const phs = (nm.match(/<p:ph\b[^>]*>/g) || []).length;
    chk(phs > 0, 'notesMaster 含占位符（修复流程会检查）', `${phs} 个 <p:ph>`);
  }

  // ---- 10. CJK 字体槽：a:ea 是否写出（plus 自称补了这个）----
  let ea = 0;
  let latin = 0;
  for (const sp of xmlParts.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    const x = await read(sp);
    ea += (x.match(/<a:ea\s/g) || []).length;
    latin += (x.match(/<a:latin\s/g) || []).length;
  }
  info.push(`字体槽：a:latin=${latin} a:ea=${ea}`);

  return { pass, fail, info, names: names.size, charts: chartParts.length, notesSlides: notesSlides.length };
}

// 直接执行时才跑 CLI（路径含中文，import.meta.url 会被百分号编码，不能直接比较）
if (process.argv[2]) {
  const file = process.argv[2];
  const r = await lint(file);
  console.log(`\n===== ${file} =====`);
  r.info.forEach((i) => console.log(`  · ${i}`));
  console.log('');
  [...r.pass, ...r.fail].forEach((l) => console.log(l));
  console.log(`\n合计：PASS ${r.pass.length} / FAIL ${r.fail.length}  （部件 ${r.names}）`);
  process.exit(r.fail.length ? 1 : 0);
}
