// Post-build steps that keep old addresses working and keep original photos off the web.
//  1. Removes any original image Vite copied into dist/_astro that no page uses (only resized
//     copies are published), then fails the build if any published image is larger than MAX_EDGE on its longest side.
//  2. Writes tiny redirect pages for the address variants the old site answered to:
//     /about, /filmrunaways, /film-runaways, /home, /Home … → the canonical /About/, /FilmRunaways/, /.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const MAX_EDGE = 2000;
const IMAGE = /\.(jpe?g|png|webp|avif|gif|tiff?)$/i;

const dashed = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

function redirectPage(origin, target) {
  const url = new URL(target, origin).href;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting…</title>` +
    `<link rel="canonical" href="${url}"><meta name="robots" content="noindex">` +
    `<meta http-equiv="refresh" content="0; url=${target}"></head>` +
    `<body style="background:#000;color:#fff"><a href="${target}" style="color:#fff">${url}</a></body></html>\n`;
}

/** True when `rel` already exists in `dir` under exactly this spelling. */
function existsExact(dir, rel) {
  let cur = dir;
  for (const part of rel.split('/').filter(Boolean)) {
    if (!fs.existsSync(cur) || !fs.readdirSync(cur).includes(part)) return false;
    cur = path.join(cur, part);
  }
  return true;
}

export default function legacyUrls() {
  let origin = '';
  return {
    name: 'legacy-urls',
    hooks: {
      'astro:config:done': ({ config }) => {
        origin = config.site;
      },
      'astro:build:done': async ({ dir, pages, logger }) => {
        const out = fileURLToPath(dir);

        // 1. Originals out, size gate.
        const all = walk(out);
        const text = all.filter((f) => /\.(html|css|js|xml|json|webmanifest)$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
        let removed = 0;
        for (const f of all) {
          if (!IMAGE.test(f) || !f.includes(`${path.sep}_astro${path.sep}`)) continue;
          if (!text.includes(`/_astro/${path.basename(f)}`)) {
            fs.rmSync(f);
            removed++;
          }
        }
        const oversized = [];
        for (const f of walk(out).filter((f) => IMAGE.test(f))) {
          const { width = 0, height = 0 } = await sharp(f).metadata();
          if (Math.max(width, height) > MAX_EDGE) oversized.push(`${path.relative(out, f)} (${width}×${height})`);
        }
        if (oversized.length) throw new Error(`Published images larger than ${MAX_EDGE}px: ${oversized.join(', ')}`);
        logger.info(`removed ${removed} unused original image(s) from the output; every published image is ≤ ${MAX_EDGE}px on its longest edge`);

        // 2. Redirect pages for legacy spellings.
        const routes = pages
          .map((p) => p.pathname.replace(/\/$/, ''))
          .filter((p) => p && p !== '404' && /^[A-Z][A-Za-z0-9]*$/.test(p));
        const wanted = new Map([['Home', '/']]);
        for (const r of [...routes, 'Home']) {
          const target = r === 'Home' ? '/' : `/${r}/`;
          for (const v of [r.toLowerCase(), dashed(r).toLowerCase()]) if (v !== r && !wanted.has(v)) wanted.set(v, target);
        }
        const written = [];
        const skipped = [];
        for (const [variant, target] of wanted) {
          if (routes.includes(variant)) continue;
          const file = path.join(out, variant, 'index.html');
          // On a case-insensitive disk (macOS) "about/" IS "About/": never overwrite a real page.
          if (fs.existsSync(path.join(out, variant)) && !existsExact(out, variant)) {
            skipped.push(variant);
            continue;
          }
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, redirectPage(origin, target));
          written.push(`/${variant} → ${target}`);
        }
        logger.info(`wrote ${written.length} legacy redirect page(s): ${written.join(', ')}`);
        if (skipped.length) {
          logger.warn(
            `skipped ${skipped.length} case-only variant(s) because this disk is case-insensitive (${skipped.map((s) => '/' + s).join(', ')}). ` +
              'The GitHub Actions build runs on Linux and writes them; nothing to fix.',
          );
        }
      },
    },
  };
}
