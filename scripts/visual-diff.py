"""Screenshot every route on two servers and report pixel differences.

usage: python3 scripts/visual-diff.py ORIGINAL_BASE REBUILD_BASE OUT_DIR [--width 1440] [--ref-dir DIR]

Each route is loaded, scrolled top to bottom (to fire scroll-triggered reveals), given time for
animations to finish, scrolled back to the top and captured full-page. `--ref-dir` additionally
diffs the rebuild against existing reference PNGs (e.g. capture/screenshots).
"""
import argparse, json, os
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROUTES = ["/", "/About", "/Awards", "/Contact", "/Credits", "/Work", "/Photography",
          "/FilmAfters", "/FilmAgalma", "/FilmBoundlessHeart", "/FilmRunaways",
          "/FilmThreeOnAMatch", "/FilmUnrequited", "/FilmYouNeverKnow"]
# Third-party video players load differently on every run; mask them so they don't count.
MASK_JS = """() => document.querySelectorAll('iframe').forEach(f => {
  f.style.visibility = 'hidden'; f.parentElement.style.background = '#123456'; })"""


def shoot(page, url, path):
    page.goto(url, wait_until="load")
    page.wait_for_timeout(2500)
    h = page.evaluate("document.body.scrollHeight")
    for y in range(0, h + 900, 600):
        page.evaluate(f"window.scrollTo(0,{y})")
        page.wait_for_timeout(150)
    page.wait_for_timeout(2000)
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(800)
    page.evaluate(MASK_JS)
    overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    page.screenshot(path=path, full_page=True)
    return overflow


def diff(a_path, b_path, heat_path=None, tol=24):
    a, b = Image.open(a_path).convert("RGB"), Image.open(b_path).convert("RGB")
    w, h = max(a.width, b.width), max(a.height, b.height)
    pa, pb = Image.new("RGB", (w, h), (255, 0, 255)), Image.new("RGB", (w, h), (255, 0, 255))
    pa.paste(a, (0, 0)); pb.paste(b, (0, 0))
    d = ImageChops.difference(pa, pb).convert("L")
    mask = d.point(lambda v: 255 if v > tol else 0)
    changed = sum(1 for v in mask.getdata() if v)
    if heat_path:
        heat = Image.blend(pb.convert("RGB"), Image.new("RGB", (w, h), (0, 0, 0)), 0.6)
        heat.paste((255, 40, 40), mask=mask)
        heat.save(heat_path)
    return {"pct": round(100 * changed / (w * h), 3), "heights": [a.height, b.height]}


def side_by_side(a_path, b_path, out, labels=("ORIGINAL", "REBUILD")):
    a, b = Image.open(a_path).convert("RGB"), Image.open(b_path).convert("RGB")
    gap = 40
    s = Image.new("RGB", (a.width + b.width + gap, max(a.height, b.height)), (60, 60, 60))
    s.paste(a, (0, 0)); s.paste(b, (a.width + gap, 0))
    if s.height > 16000:  # keep PNGs viewable
        s = s.resize((s.width * 16000 // s.height, 16000))
    s.save(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("orig"); ap.add_argument("new"); ap.add_argument("out")
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--ref-dir")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    report = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": args.width, "height": 900})
        for r in ROUTES:
            name = r.strip("/") or "home"
            o = f"{args.out}/{name}.orig.png"; n = f"{args.out}/{name}.new.png"
            ov_o = shoot(page, args.orig + r, o)
            ov_n = shoot(page, args.new + r, n)
            res = diff(o, n, f"{args.out}/{name}.diff.png")
            res["overflow_px"] = {"orig": ov_o, "new": ov_n}
            if args.ref_dir and os.path.exists(f"{args.ref_dir}/{name}.png"):
                res["vs_reference_pct"] = diff(f"{args.ref_dir}/{name}.png", n)["pct"]
            if r.startswith("/Film"):
                side_by_side(o, n, f"{args.out}/{name}.side-by-side.png")
            report[r] = res
            print(r, json.dumps(res), flush=True)
        browser.close()
    json.dump(report, open(f"{args.out}/report.json", "w"), indent=1)


if __name__ == "__main__":
    main()
