"""Checks that every text line and every image of each original page also appears on the rebuild.

usage: python3 scripts/content-parity.py ORIGINAL_BASE REBUILD_BASE
Images are matched by their upload id (the 9-character prefix of the file name), since the
rebuild serves resized copies under new names; byte-identical uploads share one resized copy, so
an id is also accepted when another upload with the same bytes is present. Text is compared
case-insensitively (the template uppercases labels with CSS). Exits 1 if anything is missing.
"""
import hashlib, os, re, sys

MEDIA = os.path.join(os.path.dirname(__file__), '..', 'media')
_digest = {}
for _f in os.listdir(MEDIA):
    _digest.setdefault(_f[:9], hashlib.md5(open(os.path.join(MEDIA, _f), 'rb').read()).hexdigest())
from playwright.sync_api import sync_playwright

ROUTES = ["/", "/About", "/Awards", "/Contact", "/Credits", "/Work", "/Photography",
          "/FilmAfters", "/FilmAgalma", "/FilmBoundlessHeart", "/FilmRunaways",
          "/FilmThreeOnAMatch", "/FilmUnrequited", "/FilmYouNeverKnow"]
# Film-page headings that the shared template deliberately renames (reported, not failed).
TEMPLATE_RENAMES = {"BACK TO WORK", "TECHNICAL", "ON SET", "CREDITS & TECHNICAL"}


def grab(page, url):
    page.goto(url, wait_until="load"); page.wait_for_timeout(1500)
    h = page.evaluate("document.body.scrollHeight")
    for y in range(0, h + 900, 900):
        page.evaluate(f"window.scrollTo(0,{y})"); page.wait_for_timeout(60)
    page.wait_for_timeout(1200)
    text = page.evaluate("document.body.innerText")
    imgs = page.evaluate("[...document.images].map(i => i.getAttribute('src'))")
    links = page.evaluate("[...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))")
    frames = page.evaluate("[...document.querySelectorAll('iframe')].map(f => f.src)")
    lines = {re.sub(r"\s+", " ", l).strip() for l in text.split("\n")}
    ids = {m.group(1) for s in imgs if (m := re.search(r"/([0-9a-f]{9})_", s or ""))}
    return lines - {""}, ids, links, frames


def main():
    orig, new = sys.argv[1], sys.argv[2]
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        for r in ROUTES:
            ot, oi, ol, of = grab(pg, orig + r)
            nt, ni, nl, nf = grab(pg, new + r)
            new_text = " ".join(nt).upper()
            missing_text = sorted(l for l in ot if l.upper() not in new_text and l.upper() not in TEMPLATE_RENAMES)
            renamed = sorted(l for l in ot if l.upper() in TEMPLATE_RENAMES and l not in nt)
            new_digests = {_digest.get(i) for i in ni}
            missing_img = sorted(i for i in oi - ni if _digest.get(i) not in new_digests)
            missing_frames = sorted(set(of) - set(nf))
            status = "OK" if not (missing_text or missing_img or missing_frames) else "MISSING"
            bad += status != "OK"
            print(f"{r:22} {status}  text lines {len(ot)}  images {len(oi)}/{len(ni)}  iframes {len(of)}/{len(nf)}"
                  + (f"  renamed-by-template={renamed}" if renamed else ""))
            for t in missing_text: print("    text :", t)
            for i in missing_img: print("    image:", i)
            for f in missing_frames: print("    video:", f)
        b.close()
    sys.exit(1 if bad else 0)


main()
