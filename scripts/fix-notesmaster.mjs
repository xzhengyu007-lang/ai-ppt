// 出口后处理层的最小验证：把 plus 版退化的 notesMaster 换成合规的一份。
// 目的不是"修补某个版本"，而是证明「后处理层可以兜住库的缺陷」这条策略成立 ——
// 这正是阶段 2 要落地的 src/renderer/pptx/postprocess.ts 的原型。
//
// 用法: node fix-notesmaster.mjs <待修.pptx> <notesMaster 来源.pptx> <输出.pptx>

import fs from 'node:fs';
import JSZip from 'jszip';

const [target, source, out] = process.argv.slice(2);
const NM = 'ppt/notesMasters/notesMaster1.xml';

const srcZip = await JSZip.loadAsync(fs.readFileSync(source));
const goodMaster = await srcZip.file(NM).async('string');

const zip = await JSZip.loadAsync(fs.readFileSync(target));
if (!zip.file(NM)) throw new Error(`目标文件没有 ${NM}`);

zip.file(NM, goodMaster);
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(out, buf);

const ph = (goodMaster.match(/<p:ph\b/g) || []).length;
console.log(`FIXED ${out}`);
console.log(`  notesMaster: ${(await (await JSZip.loadAsync(fs.readFileSync(target))).file(NM).async('string')).length} B -> ${goodMaster.length} B, 占位符 ${ph} 个`);
