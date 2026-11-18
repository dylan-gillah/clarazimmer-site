import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { VIDEO_SHAPES } from '../content.config';

export type Film = CollectionEntry<'films'>;

/** Pages that are not films. A film URL can never collide with these because it always starts with "Film". */
export const STATIC_PAGES = ['Work', 'Credits', 'Photography', 'About', 'Awards', 'Contact'] as const;

/**
 * A film's page address comes from its file name: "three-on-a-match.json" → "/FilmThreeOnAMatch".
 * The CMS names a new file after the title when it is created, and renaming is switched off so a
 * published address never changes by accident.
 */
export function filmSlug(id: string): string {
  const words = id.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length) throw new Error(`Film file "${id}.json" has no letters or digits in its name`);
  return 'Film' + words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

export const filmPath = (id: string) => `/${filmSlug(id)}/`;

export async function allFilms(): Promise<Film[]> {
  const films = await getCollection('films');
  const seen = new Map<string, string>();
  for (const f of films) {
    const key = filmSlug(f.id).toLowerCase();
    const clash = seen.get(key);
    if (clash) {
      throw new Error(
        `Films "${clash}.json" and "${f.id}.json" would get the same web address (/${filmSlug(f.id)}). Rename one of the files.`,
      );
    }
    seen.set(key, f.id);
  }
  return films.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
}

/** Resolves a CMS film reference ("src/content/films/runaways.json", "runaways.json" or "runaways"). */
export async function filmByRef(ref: string): Promise<Film> {
  const id = ref.split('/').pop()!.replace(/\.json$/i, '');
  const film = await getEntry('films', id);
  if (!film) throw new Error(`Home page featured still links to film "${ref}", which does not exist (was it deleted?)`);
  return film;
}

export function videoEmbed(f: Film['data']): { src: string; padding: number } | null {
  const id = f.video_id.trim();
  if (f.video_platform === 'none' || !id) return null;
  const padding = VIDEO_SHAPES[f.video_shape];
  if (f.video_platform === 'youtube') {
    return { src: `https://www.youtube.com/embed/${id}?${f.video_params || 'rel=0'}`, padding };
  }
  const params = f.video_params || 'color=c9a96e&title=0&byline=0&portrait=0&dnt=1';
  const query = f.video_private_code ? `h=${f.video_private_code}&${params}` : params;
  return { src: `https://player.vimeo.com/video/${id}?${query}`, padding };
}

/** Public page of the video ("Watch Now" on the Work page). */
export function videoPage(f: Film['data']): string | null {
  const id = f.video_id.trim();
  if (f.video_platform === 'vimeo' && id) return `https://vimeo.com/${id}`;
  if (f.video_platform === 'youtube' && id) return `https://www.youtube.com/watch?v=${id}`;
  return null;
}
