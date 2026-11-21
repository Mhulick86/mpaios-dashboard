// The post-ready ZIP for a social card: caption, images in the platform's sizes, a feed mockup and a README.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import sharp from 'sharp';
import { startStudio } from './helpers.mjs';
import { captionFrom, PLATFORMS } from '../post-package.mjs';

/** Read a ZIP written by post-package.mjs: { name: Buffer }. */
function unzip(buf) {
  const files = {}; let at = buf.readUInt32LE(buf.length - 6); const count = buf.readUInt16LE(buf.length - 12);
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(at), 0x02014b50);
    const method = buf.readUInt16LE(at + 10), size = buf.readUInt32LE(at + 20), nameLen = buf.readUInt16LE(at + 28), local = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLen).toString('utf8');
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + size);
    files[name] = method === 8 ? inflateRawSync(body) : body;
    at += 46 + nameLen;
  }
  return files;
}
const picture = (w, h, color) => sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer();

test('caption: Markdown marks, labels and team notes are removed', () => {
  const out = captionFrom('## Post copy\n\nCalls are **not** conversions.\n\n- One\n- Two\n\nRead [the guide](https://example.com/g).\n\n#Leads\n\n## Notes\n\nPost on Tuesday.');
  assert.equal(out, 'Calls are not conversions.\n\n• One\n• Two\n\nRead the guide (https://example.com/g).\n\n#Leads');
});

test('post package: a social card downloads as a ZIP with platform-sized JPEGs and a mockup', async (t) => {
  const s = await startStudio(t, { model: false, env: { AUTO_GENERATE_ON_MOVE: 'false' } });
  const made = await s.api('/api/commission', 'POST', { topic: 'Why a call is not a conversion', outputs: ['instagram', 'x', 'website'] });
  const byChannel = Object.fromEntries(made.tasks.map((x) => [x.channel, x]));
  const get = (id) => fetch(`${s.origin}/api/tasks/${id}/post-package`);

  let r = await get(byChannel.website.id); assert.equal(r.status, 400, 'website cards have no post package');
  r = await get(byChannel.instagram.id); assert.equal(r.status, 400); assert.match((await r.json()).error, /no draft yet/);

  for (const channel of ['instagram', 'x']) {
    const id = byChannel[channel].id;
    await s.api(`/api/tasks/${id}/artifact`, 'POST', { kind: 'draft', body: '## Caption\n\nMost clinics count **calls**. Few count patients.\n\n#Attribution' });
    await s.api(`/api/tasks/${id}/asset`, 'POST', { name: 'Hero photo.png', mime: 'image/png', data: (await picture(1024, 1280, '#2cace8')).toString('base64') });
    await s.api(`/api/tasks/${id}/asset`, 'POST', { name: 'Infographic steps.png', mime: 'image/png', data: (await picture(1024, 1536, '#08ae67')).toString('base64') });
    r = await get(id);
    assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'application/zip');
    assert.match(r.headers.get('content-disposition'), new RegExp(`${channel}-post-package\\.zip"$`));
    const files = unzip(Buffer.from(await r.arrayBuffer()));
    const names = Object.keys(files), root = names[0].split('/')[0];
    assert.equal(files[`${root}/caption.txt`].toString(), 'Most clinics count calls. Few count patients.\n\n#Attribution\n');
    assert.match(files[`${root}/README.txt`].toString(), /HOW TO POST[\s\S]+CHECKS[\s\S]+OK +Caption is \d+ characters/);
    for (const place of PLATFORMS[channel].placements) {
      const shots = names.filter((n) => n.startsWith(`${root}/images/${place.id}/`)).sort();
      assert.equal(shots.length, 2, `${place.id} has every image`);
      for (const shot of shots) {
        const meta = await sharp(files[shot]).metadata();
        assert.deepEqual([meta.format, meta.width, meta.height, meta.space], ['jpeg', place.w, place.h, 'srgb'], shot);
        assert.ok(!meta.exif, 'no camera data');
      }
    }
    const mock = await sharp(files[`${root}/mockup-${channel}.jpg`]).metadata();
    assert.equal(mock.format, 'jpeg'); assert.equal(mock.width, 1080); assert.ok(mock.height > 900, 'the mockup includes the image');
  }
});
