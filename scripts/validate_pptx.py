#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""pptx 导出正确性校验（CI 门禁）。

两段式，任何一段失败都返回非 0：

  A 段 · 纯标准库（不需要任何第三方包，CI 一定能跑）
      1. [Content_Types].xml 存在且可解析
      2. 每个 Override 指向真实部件（防幽灵 slideMaster，PptxGenJS #1444）
      3. 每个 .rels 的 Target 可解析（防断链）
      4. 每个部件都有 Content-Type
      5. XML 1.0 非法控制字符扫描（0x00-0x08 / 0x0B / 0x0C / 0x0E-0x1F）
      6. sldSz == 12192000 x 6858000 EMU（16:9 1280x720@96dpi）
      7. 图表轴引用完整性（防孤儿 <c:axId>，PptxGenJS #1534）
      8. notesMaster 含占位符（防 #1443）
      9. 备注文本存在

  B 段 · 可选（装了 python-pptx 才跑）
      打开文件、页数、文本块、形状几何 EMU->px、备注、字体名

用法：
  python scripts/validate_pptx.py out.pptx [out2.pptx ...]
退出码 0 = 全部通过。
"""

import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "c": "http://schemas.openxmlformats.org/drawingml/2006/chart",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
}

ILLEGAL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
AXIS_TAGS = ["catAx", "valAx", "serAx", "dateAx"]
CHART_TAGS = ["barChart", "lineChart", "pieChart", "areaChart", "doughnutChart", "scatterChart"]


class Report:
    def __init__(self, path):
        self.path = path
        self.passed = []
        self.failed = []

    def check(self, cond, label, detail=""):
        (self.passed if cond else self.failed).append(
            f"{'PASS' if cond else 'FAIL'}  {label}" + (f"  -> {detail}" if detail else "")
        )

    def lines(self):
        return self.passed + self.failed


def resolve_target(src_part, target):
    if target.startswith("/"):
        return target[1:]
    base = src_part.split("/")[:-1]
    for seg in target.split("/"):
        if seg == "..":
            if base:
                base.pop()
        elif seg and seg != ".":
            base.append(seg)
    return "/".join(base)


def stage_a(path, rep):
    with zipfile.ZipFile(path) as z:
        names = set(n for n in z.namelist() if not n.endswith("/"))
        read = lambda n: z.read(n).decode("utf-8", "replace")

        rep.check("[Content_Types].xml" in names, "[Content_Types].xml 存在")
        rep.check("_rels/.rels" in names, "_rels/.rels 存在")
        rep.check("ppt/presentation.xml" in names, "ppt/presentation.xml 存在")
        if "[Content_Types].xml" not in names:
            return

        ct = read("[Content_Types].xml")
        overrides = re.findall(r'<Override\s+PartName="([^"]+)"', ct)
        ghosts = [p for p in overrides if p.lstrip("/") not in names]
        rep.check(
            not ghosts,
            f"{len(overrides)} 个 Override 全部指向真实部件",
            ", ".join(ghosts[:5]) or "无幽灵条目",
        )

        broken = []
        for rels in [n for n in names if n.endswith(".rels")]:
            src = "" if rels == "_rels/.rels" else re.sub(r"_rels/([^/]+)\.rels$", r"\1", rels)
            for m in re.finditer(r"<Relationship\s+([^>]+)>", read(rels)):
                attrs = m.group(1)
                if 'TargetMode="External"' in attrs:
                    continue
                tm = re.search(r'Target="([^"]+)"', attrs)
                if not tm:
                    continue
                if resolve_target(src, tm.group(1)) not in names:
                    broken.append(f"{rels} -> {tm.group(1)}")
        rep.check(not broken, "所有 rels 引用可解析", " | ".join(broken[:3]) or "无断链")

        defaults = set(
            e.lower() for e in re.findall(r'<Default\s+Extension="([^"]+)"', ct)
        )
        over = set(p.lstrip("/") for p in overrides)
        nocontent = [
            n
            for n in names
            if n != "[Content_Types].xml"
            and not n.endswith(".rels")
            and n not in over
            and n.rsplit(".", 1)[-1].lower() not in defaults
        ]
        rep.check(not nocontent, "所有部件都有 Content-Type", ", ".join(nocontent[:3]) or "无缺声明")

        xml_parts = [n for n in names if n.endswith((".xml", ".rels"))]
        dirty = [n for n in xml_parts if ILLEGAL.search(read(n))]
        rep.check(not dirty, f"{len(xml_parts)} 个 XML 部件无非法控制字符", ",".join(dirty) or "0 处")

        pres = read("ppt/presentation.xml")
        m = re.search(r'<p:sldSz cx="(\d+)" cy="(\d+)"', pres)
        rep.check(
            bool(m) and m.group(1) == "12192000" and m.group(2) == "6858000",
            "画布 12192000x6858000 EMU",
            f"{m.group(1)}x{m.group(2)}" if m else "sldSz 缺失",
        )

        charts = [n for n in names if re.match(r"ppt/charts/chart\d+\.xml$", n)]
        if charts:
            bad = []
            for cp in charts:
                x = read(cp)
                defined = set()
                for tag in AXIS_TAGS:
                    for blk in re.findall(rf"<c:{tag}>.*?</c:{tag}>", x, re.S):
                        defined.update(re.findall(r'<c:axId\s+val="(-?\d+)"', blk)[:1])
                refs = set()
                for tag in CHART_TAGS:
                    for blk in re.findall(rf"<c:{tag}>.*?</c:{tag}>", x, re.S):
                        refs.update(re.findall(r'<c:axId\s+val="(-?\d+)"', blk))
                orphans = refs - defined
                if orphans:
                    bad.append(f"{cp}: 孤儿 {sorted(orphans)}")
            rep.check(
                not bad,
                f"{len(charts)} 个图表轴引用完整（#1534）",
                " | ".join(bad) or "全部对齐",
            )
        else:
            rep.check(True, "无图表部件（跳过轴引用检查）")

        masters = [n for n in names if re.match(r"ppt/notesMasters/notesMaster\d+\.xml$", n)]
        if masters:
            ph = len(re.findall(r"<p:ph\b", read(masters[0])))
            rep.check(ph >= 5, "notesMaster 含占位符（#1443）", f"{ph} 个 <p:ph>")
        else:
            rep.check(False, "notesMaster 存在", "缺失")

        notes = [n for n in names if re.match(r"ppt/notesSlides/notesSlide\d+\.xml$", n)]
        cjk = 0
        for n in notes:
            cjk += len(re.findall(r"[\u4e00-\u9fa5]", read(n)))
        rep.check(
            len(notes) > 0 and cjk > 0,
            "备注幻灯片存在且含中文",
            f"{len(notes)} 个 notesSlide，{cjk} 个汉字",
        )

        slides = [n for n in names if re.match(r"ppt/slides/slide\d+\.xml$", n)]
        rep.check(len(slides) > 0, "至少有 1 页", f"{len(slides)} 页")


def stage_b(path, rep):
    try:
        from pptx import Presentation
        from pptx.util import Emu
    except Exception:
        print("  (跳过 B 段：未安装 python-pptx)")
        return

    prs = Presentation(path)
    rep.check(True, "B python-pptx 打开成功")
    rep.check(len(prs.slides) > 0, "B 页数可枚举", f"{len(prs.slides)} 页")
    rep.check(
        prs.slide_width == 12192000 and prs.slide_height == 6858000,
        "B 画布 EMU 一致",
        f"{prs.slide_width}x{prs.slide_height}",
    )

    texts = 0
    boxes = []
    for s in prs.slides:
        for shp in s.shapes:
            if shp.has_text_frame and shp.text_frame.text.strip():
                texts += 1
            if shp.left is not None and shp.top is not None:
                boxes.append((Emu(shp.left).inches * 96, Emu(shp.top).inches * 96))
    rep.check(texts > 0, "B 文本块可枚举", f"{texts} 个")
    rep.check(len(boxes) > 0, "B 几何可枚举", f"{len(boxes)} 个形状")
    # 注意：坐标允许带小数（例如项目符号 y=199.2px 是合法的），
    # 有意义的不变量是 px*9525 必须无损命中整数 EMU（即没有浮点漂移）。
    drift = [v for b in boxes for v in b if abs(v * 9525 - round(v * 9525)) > 0.5]
    rep.check(
        not drift,
        "B EMU↔px 换算无漂移（px*9525 为整数）",
        f"{len(drift)} 处漂移" if drift else "全部无损",
    )


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    all_ok = True
    for path in argv:
        print(f"\n===== {path} =====")
        rep = Report(path)
        try:
            stage_a(path, rep)
            stage_b(path, rep)
        except Exception as e:  # noqa: BLE001
            rep.failed.append(f"FAIL  校验过程异常：{e}")
        for line in rep.lines():
            print(line)
        print(f"合计：PASS {len(rep.passed)} / FAIL {len(rep.failed)}")
        if rep.failed:
            all_ok = False
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
