// Content schema for everything Clara can edit in Pages CMS (.pages.yml mirrors these fields).
// If the CMS (or a hand edit) writes something malformed, `astro build` stops with the file name
// and the field that is wrong, so a broken edit can never be deployed.
import fs from 'node:fs';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const MEDIA = /^\/media\/[^/]+\.(jpe?g|png|webp|avif|gif|tiff?)$/i;
const media = (what: string) =>
  z
    .string({ error: `${what} is missing` })
    .regex(MEDIA, `${what} must be an image uploaded to the media library (a path like /media/photo.jpg)`);
const optionalMedia = (what: string) => z.union([z.literal(''), media(what)]).default('');
const text = (what: string) => z.string({ error: `${what} is missing` }).trim().min(1, `${what} cannot be empty`);
const optionalText = z.string().default('');
const labelValue = z.object({ label: text('Label'), value: text('Value') });

export const BADGES = [
  'DoP', 'Director', 'Camera Op.', '1st AC', 'A-Cam', 'B-Cam', 'B-Cam / A-Cam', 'Camera',
  'Camera Dept.', 'Editor', 'Camera Trainee', 'Post Production',
] as const;
export const AWARD_TYPES = ['Winner', 'Finalist', 'Official Selection'] as const;
export const VIDEO_SHAPES = { '16:9': 56.25, '2.39:1': 41.84, '2.2:1': 45.45, '4:3': 75 } as const;

const film = z
  .object({
    title: text('Title'),
    display_title: optionalText,
    year: z.union([z.literal(''), z.string().regex(/^\d{4}$/, 'Year must be four digits, e.g. 2026')]).default(''),
    category: text('Category'),
    order: z.number({ error: 'Position on the Work page must be a number' }).int().min(1),
    show_on_work_page: z.boolean().default(true),
    thumbnail: media('Work page image'),
    logline: optionalText,
    video_platform: z.enum(['none', 'vimeo', 'youtube'], { error: 'Video site must be Vimeo, YouTube or None' }).default('none'),
    video_id: optionalText,
    video_private_code: z.union([z.literal(''), z.string().regex(/^[0-9a-f]{6,20}$/i, 'Private link code must be the letters/digits after the video number, e.g. b8e9f5c8e0')]).default(''),
    video_shape: z.enum(Object.keys(VIDEO_SHAPES) as [keyof typeof VIDEO_SHAPES]).default('16:9'),
    video_params: optionalText,
    hero_image: optionalMedia('Top image'),
    synopsis: optionalText,
    credits: z.array(labelValue).default([]),
    details: z.array(labelValue).default([]),
    stills: z.array(media('Still')).default([]),
    bts_photos: z.array(media('Behind-the-scenes photo')).default([]),
  })
  .superRefine((f, ctx) => {
    const id = f.video_id.trim();
    if (f.video_platform === 'vimeo' && !/^\d{5,12}$/.test(id))
      ctx.addIssue({ code: 'custom', path: ['video_id'], message: `Vimeo video number must be only digits (the number at the end of the vimeo.com link), got "${f.video_id}"` });
    if (f.video_platform === 'youtube' && !/^[A-Za-z0-9_-]{11}$/.test(id))
      ctx.addIssue({ code: 'custom', path: ['video_id'], message: `YouTube video code must be the 11 characters after "watch?v=", got "${f.video_id}"` });
    if (f.video_platform === 'none' && id)
      ctx.addIssue({ code: 'custom', path: ['video_platform'], message: 'A video number is filled in but "Video site" is None — pick Vimeo or YouTube' });
    if (f.video_platform !== 'vimeo' && f.video_private_code)
      ctx.addIssue({ code: 'custom', path: ['video_private_code'], message: 'Private link code only applies to Vimeo videos' });
  });

/** A collection holding exactly one JSON file (a page's settings), validated like any other entry. */
function single(file: string) {
  return async () => {
    const path = `src/data/${file}.json`;
    let data: unknown;
    try {
      data = JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (e) {
      throw new Error(`${path} is not valid JSON: ${(e as Error).message}`);
    }
    return [{ id: file, ...(data as object) }];
  };
}

const featured = z.object({
  image: media('Featured still'),
  film: text('Film the still links to'),
});

export const collections = {
  films: defineCollection({ loader: glob({ pattern: '*.json', base: './src/content/films' }), schema: film }),
  site: defineCollection({
    loader: single('site'),
    schema: z.object({
      site_name: text('Site name'),
      description: text('Site description'),
      share_image: media('Share image'),
      icon: media('Browser tab icon'),
      header_name: text('Name in the header'),
      footer_name: text('Name in the footer'),
    }),
  }),
  home: defineCollection({
    loader: single('home'),
    schema: z.object({
      page_title: text('Page title'),
      page_description: text('Page description'),
      hero_image: media('Big background image'),
      eyebrow: text('Small gold line above the name'),
      name: text('Name'),
      intro: text('Intro text'),
      hero_button: text('Button text'),
      selected_work_heading: text('Selected work heading'),
      all_work_link: text('All work link text'),
      featured_stills: z.array(featured).min(1, 'Add at least one featured still'),
      about_heading: text('About heading'),
      about_text: text('About text'),
      about_link: text('About link text'),
    }),
  }),
  about: defineCollection({
    loader: single('about'),
    schema: z.object({
      page_title: text('Page title'),
      page_description: text('Page description'),
      share_image: media('Share image'),
      photo: media('Photo'),
      photo_description: text('Photo description'),
      caption: optionalText,
      eyebrow: text('Small gold line'),
      name: text('Name'),
      bio: text('Biography'),
      specialisms_heading: optionalText,
      specialisms: z.array(text('Specialism')).default([]),
    }),
  }),
  awards: defineCollection({
    loader: single('awards'),
    schema: z.object({
      eyebrow: text('Small gold line'),
      heading: text('Heading'),
      awards: z.array(
        z.object({
          year: z.string().regex(/^\d{4}$/, 'Award year must be four digits'),
          title: text('Award'),
          festival: text('Festival'),
          film: optionalText,
          type: z.enum(AWARD_TYPES, { error: `Award type must be one of: ${AWARD_TYPES.join(', ')}` }),
        }),
      ),
      footnote: optionalText,
    }),
  }),
  credits: defineCollection({
    loader: single('credits'),
    schema: z.object({
      eyebrow: text('Small gold line'),
      heading: text('Heading'),
      credits: z.array(
        z.object({
          year: z.string().regex(/^\d{4}$/, 'Credit year must be four digits'),
          title: text('Production title'),
          type: optionalText,
          role: text('Role'),
          badge: z.enum(BADGES, { error: `Badge must be one of: ${BADGES.join(', ')}` }),
          director: optionalText,
          producer: optionalText,
        }),
      ),
    }),
  }),
  contact: defineCollection({
    loader: single('contact'),
    schema: z.object({
      eyebrow: text('Small gold line'),
      heading: text('Heading'),
      intro: optionalText,
      note: optionalText,
      email: z.string().email('Email address is not valid'),
      phone: optionalText,
      based: optionalText,
    }),
  }),
  photography: defineCollection({
    loader: single('photography'),
    schema: z.object({
      eyebrow: text('Small gold line'),
      heading: text('Heading'),
      sections: z.array(z.object({ heading: text('Gallery name'), photos: z.array(media('Photo')).default([]) })),
    }),
  }),
  work: defineCollection({
    loader: single('work'),
    schema: z.object({ eyebrow: text('Small gold line'), heading: text('Heading'), footnote: optionalText }),
  }),
};
