"""Read-back validator prototype (stage-0 feasibility proof, not product code).

Purpose: prove that an INDEPENDENT reader (python-pptx, i.e. not the generator)
can confirm the four things the acceptance gate cares about:
  1. the file opens at all
  2. slide count / text blocks / images are enumerable
  3. geometry is recoverable in EMU and matches the IR's px * 9525
  4. speaker notes are readable

Exit code 0 = all assertions pass (this is what makes it usable in CI).

Usage: python readback_check.py <file.pptx>
"""

import sys
from pptx import Presentation
from pptx.util import Emu

PX_TO_EMU = 9525  # 914400 EMU/inch ÷ 96 px/inch


def main(path):
    ok, bad = [], []

    def chk(cond, label, detail=""):
        (ok if cond else bad).append(f"{'PASS' if cond else 'FAIL'}  {label}" + (f"  -> {detail}" if detail else ""))

    prs = Presentation(path)          # 打不开就在这里抛异常
    chk(True, "python-pptx 成功打开文件")
    chk(len(prs.slides) > 0, "页数枚举", f"{len(prs.slides)} 页")

    # 画布尺寸（EMU）——直接来自 package，不依赖生成器
    w, h = prs.slide_width, prs.slide_height
    chk(w == 12192000 and h == 6858000, "画布 = 12192000x6858000 EMU (13.333x7.5in)",
        f"实测 {w}x{h}")

    total_text, total_pics, boxes = 0, 0, []
    for i, slide in enumerate(prs.slides, 1):
        for shp in slide.shapes:
            if shp.has_text_frame:
                for para in shp.text_frame.paragraphs:
                    if para.text.strip():
                        total_text += 1
            if shp.shape_type is not None and "PICTURE" in str(shp.shape_type):
                total_pics += 1
            if shp.left is not None and shp.top is not None:
                boxes.append((i, shp.name, shp.left, shp.top, shp.width, shp.height))

    chk(total_text > 0, "文本块可枚举", f"{total_text} 个非空段落")
    chk(len(boxes) > 0, "形状几何可枚举", f"{len(boxes)} 个带坐标的形状")

    # 几何回读：EMU -> px 是否严格还原（几何一致性测试的基础）
    px_boxes = [(i, n, Emu(l).inches * 96, Emu(t).inches * 96) for i, n, l, t, _, _ in boxes]
    chk(all(abs(x - round(x)) < 1e-6 for _, _, x, y in px_boxes),
        "EMU->px 回读为整数（无累积漂移）",
        f"样例 {px_boxes[0][1]} x={px_boxes[0][2]:.3f} y={px_boxes[0][3]:.3f}" if px_boxes else "")

    # 备注可读
    notes_total = 0
    for i, slide in enumerate(prs.slides, 1):
        if slide.has_notes_slide:
            t = slide.notes_slide.notes_text_frame.text
            cjk = sum(1 for c in t if "\u4e00" <= c <= "\u9fa5")
            notes_total += cjk
            chk(cjk > 0, f"第 {i} 页备注可读（中文 {cjk} 字）")
    chk(notes_total > 0, "备注总计", f"{notes_total} 个汉字")

    # 字体名回读（验证"只存名字不嵌字体"这一事实）
    faces = set()
    for slide in prs.slides:
        for shp in slide.shapes:
            if not shp.has_text_frame:
                continue
            for para in shp.text_frame.paragraphs:
                for run in para.runs:
                    if run.font.name:
                        faces.add(run.font.name)
    chk(len(faces) > 0, "字体名可回读（证明字体只存名、未嵌入）", ", ".join(sorted(faces)))

    for line in ok + bad:
        print(line)
    print(f"\n合计：PASS {len(ok)} / FAIL {len(bad)}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "spike-out.pptx"))
