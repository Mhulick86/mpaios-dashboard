/**
 * Post-ready package for a social card: one ZIP with everything needed to publish it.
 *
 *   caption.txt            the post copy as plain text, ready to paste
 *   post.md                the approved draft as written (with any notes it carries)
 *   images/<placement>/    every image on the card as a JPEG, resized and cropped for each placement of the card's
 *                          platform (sizes below), sRGB, metadata removed
 *   mockup-<platform>.jpg  what the post will look like in that platform's feed
 *   README.txt             what each file is for, how to post, and checks (caption length, hashtags, missing images)
 *
 * Built on request from the card's current draft and images, so it is never out of date and takes no storage.
 * Image work uses sharp; the ZIP is written here.
 */
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';
import { getDb, getTask } from './db.mjs';
import { assets } from './assets.mjs';

/**
 * Image sizes each platform shows without cropping or re-compressing badly. The first placement is the main feed
 * post and the one the mockup uses. limit: caption characters the platform accepts; fold: where the feed cuts the
 * caption behind "more".
 */
export const PLATFORMS = {
  linkedin: {
    name: 'LinkedIn', limit: 3000, fold: 210, hashtags: 5,
    placements: [
      { id: 'feed-portrait-1080x1350', w: 1080, h: 1350, use: 'Feed post, portrait 4:5. Takes the most room in the mobile feed. Use this for single images and for every slide of a carousel.' },
      { id: 'feed-square-1200x1200', w: 1200, h: 1200, use: 'Feed post, square 1:1. Use when several images go in one post.' },
      { id: 'link-landscape-1200x627', w: 1200, h: 627, use: 'Landscape 1.91:1. Use for link previews and sponsored content.' }
    ]
  },
  facebook: {
    name: 'Facebook', limit: 63206, fold: 125, hashtags: 3,
    placements: [
      { id: 'feed-portrait-1080x1350', w: 1080, h: 1350, use: 'Feed post, portrait 4:5. Takes the most room in the mobile feed.' },
      { id: 'feed-square-1080x1080', w: 1080, h: 1080, use: 'Feed post, square 1:1. Use for multi-image posts.' },
      { id: 'link-landscape-1200x630', w: 1200, h: 630, use: 'Landscape 1.91:1. Use for link posts and ads.' },
      { id: 'story-1080x1920', w: 1080, h: 1920, use: 'Story, 9:16. Keep text away from the top and bottom 250px.' }
    ]
  },
  instagram: {
    name: 'Instagram', limit: 2200, fold: 125, hashtags: 5,
    placements: [
      { id: 'feed-portrait-1080x1350', w: 1080, h: 1350, use: 'Feed post and carousel slides, portrait 4:5. All slides of a carousel must share this size.' },
      { id: 'feed-square-1080x1080', w: 1080, h: 1080, use: 'Feed post, square 1:1.' },
      { id: 'story-reel-cover-1080x1920', w: 1080, h: 1920, use: 'Story and Reel cover, 9:16. Keep text away from the top and bottom 250px.' }
    ]
  },
  x: {
    name: 'X', limit: 280, fold: 280, hashtags: 2,
    placements: [
      { id: 'post-landscape-1600x900', w: 1600, h: 900, use: 'Single image post, 16:9. Shown in full in the timeline.' },
      { id: 'post-square-1080x1080', w: 1080, h: 1080, use: 'Square 1:1. Use when two to four images go in one post.' }
    ]
  },
  gbp: {
    name: 'Google Business Profile', limit: 1500, fold: 250, hashtags: 0,
    placements: [
      { id: 'update-1200x900', w: 1200, h: 900, use: 'Update post photo, 4:3. Google crops other shapes; keep the subject centred.' }
    ]
  }
};
const MAX_IMAGES = 12;
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// ---------- ZIP ----------
function dosTime(d) {
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}
/** files: [{ name, data: Buffer|string }] */
export function zip(files, now = new Date()) {
  const parts = [], central = []; let offset = 0;
  const { time, date } = dosTime(now);
  for (const file of files) {
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(String(file.data), 'utf8');
    const name = Buffer.from(file.name, 'utf8'), sum = crc32(data);
    const packed = /\.jpe?g$/i.test(file.name) ? data : deflateRawSync(data), store = packed.length >= data.length; // JPEGs do not shrink
    const body = store ? data : packed;
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); // UTF-8 names
    head.writeUInt16LE(store ? 0 : 8, 8); head.writeUInt16LE(time, 10); head.writeUInt16LE(date, 12);
    head.writeUInt32LE(sum, 14); head.writeUInt32LE(body.length, 18); head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(store ? 0 : 8, 10); entry.writeUInt16LE(time, 12); entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(sum, 16); entry.writeUInt32LE(body.length, 20); entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    parts.push(head, name, body); central.push(entry, name);
    offset += head.length + name.length + body.length;
  }
  const dir = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

// ---------- Caption ----------
const fileSafe = (s, max = 60) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '') || 'post';

/** The post copy as it would be pasted: Markdown marks removed, production notes and labels dropped. */
export function captionFrom(markdown) {
  let text = String(markdown || '').replace(/\r\n/g, '\n');
  // Everything from a notes/production heading on is for the team, not the post.
  text = text.split(/\n#{1,6}\s*(?:notes?\b|production notes|editor'?s? notes|graphics?\b|visual (?:direction|notes)|image (?:direction|notes|prompts?)|alt text|posting notes|sources?\b|references?\b)[^\n]*\n/i)[0];
  return text
    .replace(/^#{1,6}\s*(?:post(?: copy| text)?|caption|copy|final (?:post|copy)|linkedin post|facebook post|instagram caption)\s*:?\s*$/gim, '')
    .replace(/^[ \t]*(?:\*\*)?(?:post(?: copy| text)?|caption)(?:\*\*)?[ \t]*:[ \t]*/gim, '')
    .replace(/^[ \t]*([-*_])\1{2,}[ \t]*$/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1 ($2)')
    .replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,!?:;]|$)/gm, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    .replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- Images ----------
let sharpLib;
async function loadSharp() {
  if (!sharpLib) {
    try { sharpLib = (await import('sharp')).default; }
    catch { throw new Error('The post package needs the "sharp" image library. Run npm install in the MAIOS folder, then try again.'); }
  }
  return sharpLib;
}
/** Diagrams, infographics and quote cards carry their meaning edge to edge, so they are never cropped. */
const isGraphic = (name) => /diagram|infographic|chart|quote|callout|icon|carousel|slide|summary|takeaway|stat/i.test(name || '');

/** One image, shaped for one placement. Close shapes and photos are cropped around the subject; graphics are fitted whole on a soft background made from the image itself. */
async function fitImage(source, { w, h }, graphic) {
  const sharp = await loadSharp();
  const base = sharp(source, { failOn: 'none' }).rotate(); // apply camera orientation
  const meta = await base.metadata();
  const [sw, sh] = (meta.orientation || 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
  const drift = Math.abs(sw / sh - w / h) / (w / h);
  let out;
  if (!graphic || drift < 0.04) out = base.resize(w, h, { fit: 'cover', position: drift < 0.04 ? 'centre' : sharp.strategy.attention });
  else {
    const backdrop = await base.clone().resize(w, h, { fit: 'cover' }).blur(40).modulate({ brightness: 0.82 }).toBuffer();
    const whole = await base.clone().resize(w, h, { fit: 'inside' }).toBuffer();
    out = sharp(backdrop).composite([{ input: whole, gravity: 'centre' }]);
  }
  return out.flatten({ background: '#ffffff' }).toColourspace('srgb').jpeg({ quality: 86, mozjpeg: true, chromaSubsampling: '4:2:0' }).toBuffer();
}

// ---------- Mockup ----------
const FONT_DIRS = [join(process.cwd(), 'content-studio', 'fonts'), join(process.cwd(), 'fonts')];
try { FONT_DIRS.push(join(dirname(fileURLToPath(import.meta.url)), 'fonts')); } catch { /* bundled: no file URL */ }
const fontFile = (name) => FONT_DIRS.map((d) => join(d, name)).find((p) => existsSync(p));
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// The mockup font has no emoji; leaving them in would draw empty boxes.
const plain = (s) => String(s).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu, '').replace(/[ \t]{2,}/g, ' ');

/** A block of text as a transparent image: { input, width, height }. */
async function textBlock(text, { size = 30, color = '#111111', bold = false, width = 1000, spacing = 6 } = {}) {
  const sharp = await loadSharp();
  const file = fontFile(bold ? 'Inter-SemiBold.otf' : 'Inter-Regular.otf');
  const img = sharp({ text: {
    text: `<span foreground="${color}">${xml(plain(text)) || ' '}</span>`,
    font: `${file ? 'Inter' : 'sans'}${bold ? ' Semi-Bold' : ''} ${size}`, ...(file ? { fontfile: file } : {}),
    width, dpi: 72, rgba: true, wrap: 'word-char', spacing
  } });
  const { data, info } = await img.png().toBuffer({ resolveWithObject: true });
  return { input: data, width: info.width, height: info.height };
}
const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);

const LOOKS = {
  linkedin: { page: '#f4f2ee', accent: '#0a66c2', sub: () => 'Company · Just now', actions: ['Like', 'Comment', 'Repost', 'Send'], captionFirst: true, more: '…more', label: 'LinkedIn feed' },
  facebook: { page: '#f0f2f5', accent: '#1877f2', sub: () => 'Just now · Public', actions: ['Like', 'Comment', 'Share'], captionFirst: true, more: '… See more', label: 'Facebook feed' },
  instagram: { page: '#ffffff', accent: '#e1306c', sub: () => 'Just now', actions: ['Like', 'Comment', 'Share', 'Save'], captionFirst: false, more: '… more', label: 'Instagram feed' },
  x: { page: '#ffffff', accent: '#000000', sub: (b) => `@${fileSafe(b, 15).replace(/-/g, '').toLowerCase()} · 1m`, actions: ['Reply', 'Repost', 'Like', 'Views', 'Share'], captionFirst: true, inset: true, more: '', label: 'X timeline' },
  gbp: { page: '#ffffff', accent: '#1a73e8', sub: () => 'Update · Just now', actions: ['Learn more'], captionFirst: false, more: '… More', label: 'Google Business Profile update' }
};

/** A JPEG of the post as its platform's feed would show it. image: the main placement's JPEG, or null for a text post. */
export async function renderMockup({ platform, brand, caption, image, imageCount = 1 }) {
  const sharp = await loadSharp();
  const spec = PLATFORMS[platform], look = LOOKS[platform];
  const W = 1080, pad = 40, inner = W - pad * 2;
  const layers = []; let y = 56; // room for the label strip
  const put = (block, left, top) => layers.push({ input: block.input, left: Math.round(left), top: Math.round(top) });

  // Header: avatar, name, the line under it.
  const initials = String(brand).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'MP';
  const top = y + 28;
  layers.push({ input: svg(96, 96, `<circle cx="48" cy="48" r="48" fill="${look.accent}"/>`), left: pad, top });
  const ini = await textBlock(initials, { size: 36, color: '#ffffff', bold: true, width: 96 });
  put(ini, pad + (96 - ini.width) / 2, top + (96 - ini.height) / 2);
  const name = await textBlock(brand, { size: 32, bold: true, width: inner - 130 });
  const sub = await textBlock(look.sub(brand), { size: 24, color: '#65676b', width: inner - 130 });
  put(name, pad + 120, top + 6); put(sub, pad + 120, top + 12 + name.height);
  y = top + Math.max(96, 18 + name.height + sub.height) + 26;

  // Caption as the feed shows it before "more".
  const text = plain(caption).trim();
  const fold = image ? spec.fold : Math.max(spec.fold, 600);
  let shown = text;
  if (text.length > fold) { shown = text.slice(0, fold); shown = shown.slice(0, Math.max(shown.lastIndexOf(' '), fold - 30)).trimEnd() + (look.more ? ` ${look.more}` : '…'); }
  const captionBlock = shown ? await textBlock(platform === 'instagram' ? `${fileSafe(brand, 30).replace(/-/g, '').toLowerCase()}  ${shown}` : shown, { size: 31, width: inner, spacing: 10 }) : null;
  const placeCaption = () => { if (captionBlock) { put(captionBlock, pad, y); y += captionBlock.height + 28; } };
  const placeActions = async () => {
    layers.push({ input: svg(inner, 2, `<rect width="${inner}" height="2" fill="#e4e6eb"/>`), left: pad, top: y }); y += 22;
    const cell = inner / look.actions.length;
    for (const [i, label] of look.actions.entries()) {
      const b = await textBlock(label, { size: 26, color: platform === 'gbp' ? look.accent : '#65676b', bold: true, width: Math.floor(cell) });
      put(b, pad + cell * i + (platform === 'gbp' ? 0 : (cell - b.width) / 2), y);
    }
    y += 58;
  };
  const placeImage = async () => {
    if (!image) return;
    const meta = await sharp(image).metadata();
    const width = look.inset ? inner : W, height = Math.round(width * meta.height / meta.width);
    let pic = await sharp(image).resize(width, height).toBuffer();
    if (look.inset) pic = await sharp(pic).composite([{ input: svg(width, height, `<rect width="${width}" height="${height}" rx="32" ry="32"/>`), blend: 'dest-in' }]).png().toBuffer();
    layers.push({ input: pic, left: look.inset ? pad : 0, top: y });
    if (imageCount > 1) { // carousel marker
      const tag = await textBlock(`1/${imageCount}`, { size: 24, color: '#ffffff', bold: true, width: 120 });
      const bw = tag.width + 36, bh = tag.height + 20, bx = (look.inset ? pad : 0) + width - bw - 24;
      layers.push({ input: svg(bw, bh, `<rect width="${bw}" height="${bh}" rx="${bh / 2}" fill="#000000" fill-opacity="0.62"/>`), left: bx, top: y + 24 });
      put(tag, bx + 18, y + 24 + 10);
    }
    y += height + 26;
  };
  if (look.captionFirst) { placeCaption(); await placeImage(); await placeActions(); }
  else { await placeImage(); await placeActions(); placeCaption(); }
  const H = y + 16;

  const note = await textBlock(`MOCKUP · ${look.label} · preview only, not a screenshot of a live post`, { size: 20, color: '#ffffff', bold: true, width: W - 60 });
  const card = [{ input: svg(W, 56, `<rect width="${W}" height="56" fill="#1f2937"/>`), left: 0, top: 0 }, { input: note.input, left: 30, top: Math.round((56 - note.height) / 2) }];
  return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
    .composite([...card, ...layers]).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

// ---------- Package ----------
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Is a post package available for this card? (Social cards only.) */
export const packagePlatform = (task) => (task && task.board_id === 'social' && PLATFORMS[task.channel] ? task.channel : null);

/** Build the ZIP for one social card. Returns { name, data, report }. */
export async function buildPostPackage(taskId, { readAsset = (path) => assets().read(path), listAssets } = {}) {
  const task = typeof taskId === 'object' ? taskId : getTask(taskId);
  if (!task) throw new Error('Task not found.');
  const platform = packagePlatform(task);
  if (!platform) throw new Error('Post packages are made for cards on the Social Media board (LinkedIn, Facebook, Instagram, X, Google Business).');
  const spec = PLATFORMS[platform];
  const draft = (task.artifacts || []).find((a) => a.kind === 'draft'); // newest first
  if (!draft?.body?.trim()) throw new Error('This card has no draft yet. Write the post first, then download the package.');
  const caption = captionFrom(draft.body);
  const brand = task.brand || 'Marketing Powered';

  // Oldest first: the order the images were made is the order of the slides.
  const records = (listAssets ? await listAssets(task.id) : getDb().prepare('SELECT id,name,mime,path,created_at FROM assets WHERE task_id=? ORDER BY created_at ASC, name ASC').all(task.id))
    .filter((a) => IMAGE_MIMES.has(a.mime));
  const used = records.slice(0, MAX_IMAGES);
  const files = [], listing = [], problems = [];
  let lead = null;
  for (const [i, rec] of used.entries()) {
    const source = await readAsset(rec.path);
    if (!source) { problems.push(`Image "${rec.name}" could not be read from storage and is missing from this package.`); continue; }
    const n = String(i + 1).padStart(2, '0'), graphic = isGraphic(rec.name);
    for (const [p, place] of spec.placements.entries()) {
      try {
        const data = await fitImage(source, place, graphic);
        const name = `images/${place.id}/${n}-${fileSafe(rec.name.replace(/^AI image \d+\s*·\s*/i, '').replace(/\.(png|jpe?g|webp)$/i, ''), 40)}.jpg`;
        files.push({ name, data }); listing.push(`  ${name}  (${place.w}x${place.h}, ${kb(data.length)})`);
        if (p === 0 && !lead) lead = data;
      } catch (e) { problems.push(`Image "${rec.name}" could not be prepared for ${place.id}: ${String(e?.message || e).slice(0, 120)}`); break; }
    }
  }
  const mockup = await renderMockup({ platform, brand, caption, image: lead, imageCount: task.content_type === 'carousel' ? Math.max(1, used.length) : 1 });

  // Checks a person would otherwise find out about while posting.
  const tags = caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu) || [];
  const checks = [
    `${caption.length <= spec.limit ? 'OK ' : 'FIX'}  Caption is ${caption.length} characters; ${spec.name} allows ${spec.limit}.`,
    caption.length > spec.fold ? `NOTE The feed shows about the first ${spec.fold} characters before "more". Make sure the opening line carries the point.` : `OK   The whole caption shows in the feed without "more".`,
    spec.hashtags && tags.length > spec.hashtags ? `NOTE ${tags.length} hashtags; ${spec.hashtags} or fewer reads better on ${spec.name}.` : `OK   Hashtags: ${tags.length}.`,
    used.length ? `OK   ${used.length} image${used.length > 1 ? 's' : ''} prepared in ${spec.placements.length} size${spec.placements.length > 1 ? 's' : ''}.` : 'NOTE This card has no images, so the package is a text post. Generate or attach images and download again to include them.',
    ...(records.length > MAX_IMAGES ? [`NOTE The card has ${records.length} images; the first ${MAX_IMAGES} are included.`] : []),
    ...(task.approved_at ? [] : ['NOTE This card has not been approved yet. The package reflects the current draft.']),
    ...problems.map((p) => `FIX  ${p}`)
  ];
  const readme = [
    `${task.title}`, `${spec.name} · ${String(task.content_type || 'post').replace(/_/g, ' ')} · prepared ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, '',
    'WHAT IS IN THIS FOLDER', '',
    '  caption.txt   The post copy, ready to paste.',
    '  post.md       The draft exactly as written, including any notes for the team.',
    `  mockup-${platform}.jpg   How the post will look in the ${spec.name} feed. A preview only; never upload it.`,
    ...(used.length ? ['  images/       The images to upload, one folder per placement:', '', ...spec.placements.map((p) => `    ${p.id}/  ${p.use}`)] : []), '',
    'HOW TO POST', '',
    `  1. Open ${spec.name} and start a new post.`,
    used.length ? `  2. Upload the files from images/${spec.placements[0].id}/ in number order${task.content_type === 'carousel' ? ' (each file is one slide)' : ''}.` : '  2. This is a text post; no image is needed.',
    '  3. Paste caption.txt.', '  4. Compare with the mockup, then publish or schedule.',
    '  5. Back in the studio, record the live URL on the card.', '',
    'CHECKS', '', ...checks.map((c) => `  ${c}`), '',
    ...(listing.length ? ['FILES', '', ...listing, ''] : []),
    'All images are JPEG, sRGB, with camera and location data removed. Photos are cropped around the subject for each',
    'shape; diagrams and infographics are fitted whole on a soft background so nothing is cut off.', ''
  ].join('\n');

  const folder = `${fileSafe(task.title, 50)}-${platform}`;
  const all = [
    { name: 'README.txt', data: readme }, { name: 'caption.txt', data: caption + '\n' }, { name: 'post.md', data: draft.body.trim() + '\n' },
    { name: `mockup-${platform}.jpg`, data: mockup }, ...files
  ].map((f) => ({ ...f, name: `${folder}/${f.name}` }));
  return { name: `${folder}-post-package.zip`, data: zip(all), report: { platform, images: used.length, files: all.length, checks, problems } };
}
