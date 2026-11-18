// Every image on the site goes through here. Originals live in /media (uploaded by the CMS, kept
// in the repo, never deployed); visitors only ever get resized WebP copies made at build time.
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';

const originals = import.meta.glob<ImageMetadata>(
  '/media/*.{jpg,jpeg,png,webp,avif,gif,tif,tiff,JPG,JPEG,PNG,WEBP,AVIF,GIF,TIF,TIFF}',
  { eager: true, import: 'default' },
);

/** Longest edge we ever ship: a 6000×4000 camera original becomes 2000×1333. */
export const MAX_EDGE = 2000;
const STEPS = [480, 960, 1440, MAX_EDGE];

export function original(path: string): ImageMetadata {
  const meta = originals[path];
  if (!meta) {
    throw new Error(
      `Image "${path}" is referenced in the content but there is no such file in web/media/. ` +
        'Re-upload it in the CMS media library or pick an existing image.',
    );
  }
  return meta;
}

export interface WebImage {
  src: string;
  srcset: string;
  width: number;
  height: number;
}

const cache = new Map<string, Promise<WebImage>>();

/** Resized, responsive copy of a /media/... image with its intrinsic (capped) dimensions. */
export function webImage(path: string): Promise<WebImage> {
  const key = path;
  let hit = cache.get(key);
  if (!hit) {
    hit = build(path);
    cache.set(key, hit);
  }
  return hit;
}

async function build(path: string): Promise<WebImage> {
  const meta = original(path);
  const scale = Math.min(1, MAX_EDGE / meta.width, MAX_EDGE / meta.height);
  const width = Math.round(meta.width * scale);
  const height = Math.round(meta.height * scale);
  const widths = [...new Set([...STEPS.filter((w) => w < width), width])];
  const img = await getImage({ src: meta, width, height, widths, format: 'webp', quality: 80 });
  return { src: img.src, srcset: img.srcSet.attribute, width, height };
}

/** A single fixed-size copy (share images, favicon) — absolute URL when `site` is given. */
export async function fixedImage(path: string, width: number, format: 'jpg' | 'png' = 'jpg') {
  const meta = original(path);
  const w = Math.min(width, meta.width);
  const img = await getImage({ src: meta, width: w, height: Math.round((meta.height * w) / meta.width), format, quality: 85 });
  return { src: img.src, width: w, height: Math.round((meta.height * w) / meta.width) };
}
