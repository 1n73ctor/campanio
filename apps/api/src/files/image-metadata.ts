/**
 * Removes privacy-sensitive metadata from public photos without re-encoding them:
 *  - JPEG: GPS location inside EXIF is wiped (orientation etc. kept so photos aren't shown sideways);
 *          XMP, Photoshop/IPTC and comment segments are dropped
 *  - PNG:  eXIf and text chunks are dropped
 *  - WebP: EXIF and XMP chunks are dropped
 * Phone photos carry the GPS position they were taken at — for a companion, often their home.
 */
export function stripImageMetadata(buf: Buffer, kind: 'jpg' | 'png' | 'webp'): Buffer {
  try {
    if (kind === 'jpg') return stripJpeg(buf);
    if (kind === 'png') return stripPng(buf);
    return stripWebp(buf);
  } catch {
    // malformed metadata: refuse rather than publish a file we couldn't clean
    throw new Error('Could not process this image');
  }
}

// ---------- JPEG ----------
const XMP_IDS = ['http://ns.adobe.com/xap/1.0/', 'http://ns.adobe.com/xmp/extension/'];

function stripJpeg(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 2)]; // SOI
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) throw new Error('bad marker');
    const marker = buf[i + 1];
    if (marker === 0xda) {
      out.push(buf.subarray(i)); // start of scan: the rest is image data
      return Buffer.concat(out);
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) throw new Error('bad segment');
    const seg = buf.subarray(i, i + 2 + len);
    const data = seg.subarray(4);
    if (marker === 0xe1 && data.toString('latin1', 0, 6) === 'Exif\0\0') {
      out.push(scrubExifGps(Buffer.from(seg)));
    } else if (marker === 0xe1 && XMP_IDS.some((id) => data.toString('latin1', 0, id.length) === id)) {
      // drop XMP (can hold location)
    } else if (marker === 0xed || marker === 0xfe) {
      // drop Photoshop/IPTC (0xED) and comments (0xFE)
    } else {
      out.push(seg);
    }
    i += 2 + len;
  }
  throw new Error('no image data');
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

/** Zeroes the GPS directory inside an EXIF APP1 segment (copy), keeping everything else. */
function scrubExifGps(seg: Buffer): Buffer {
  const tiff = 10; // FF E1, length(2), "Exif\0\0"
  const le = seg.toString('latin1', tiff, tiff + 2) === 'II';
  const u16 = (o: number) => (le ? seg.readUInt16LE(o) : seg.readUInt16BE(o));
  const u32 = (o: number) => (le ? seg.readUInt32LE(o) : seg.readUInt32BE(o));
  const inRange = (o: number, n: number) => o >= tiff && o + n <= seg.length;

  const ifd0 = tiff + u32(tiff + 4);
  if (!inRange(ifd0, 2)) throw new Error('bad ifd0');
  const count = u16(ifd0);
  for (let e = 0; e < count; e++) {
    const entry = ifd0 + 2 + e * 12;
    if (!inRange(entry, 12)) throw new Error('bad entry');
    if (u16(entry) !== 0x8825) continue; // GPSInfo pointer
    const gps = tiff + u32(entry + 8);
    if (!inRange(gps, 2)) throw new Error('bad gps ifd');
    const n = u16(gps);
    for (let g = 0; g < n; g++) {
      const ge = gps + 2 + g * 12;
      if (!inRange(ge, 12)) throw new Error('bad gps entry');
      const size = (TYPE_SIZE[u16(ge + 2)] ?? 1) * u32(ge + 4);
      if (size > 4) {
        const off = tiff + u32(ge + 8);
        if (inRange(off, size)) seg.fill(0, off, off + size); // out-of-line values (coordinates, timestamps…)
      }
      seg.fill(0, ge, ge + 12);
    }
    seg.fill(0, gps, gps + 2); // the GPS directory now has 0 entries
  }
  return seg;
}

// ---------- PNG ----------
const PNG_DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);

function stripPng(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    const end = i + 12 + len;
    if (end > buf.length) throw new Error('bad chunk');
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') return Buffer.concat(out);
  }
  throw new Error('no IEND');
}

// ---------- WebP ----------
function stripWebp(buf: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let i = 12;
  let removed = false;
  while (i + 8 <= buf.length) {
    const type = buf.toString('latin1', i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2);
    if (i + 8 + size > buf.length) throw new Error('bad chunk');
    const chunk = Buffer.from(buf.subarray(i, Math.min(end, buf.length)));
    if (type === 'EXIF' || type === 'XMP ') removed = true;
    else {
      if (type === 'VP8X') chunk[8] &= ~(0x08 | 0x04); // clear the EXIF and XMP flags
      chunks.push(chunk);
    }
    i = end;
  }
  if (!removed) return buf;
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}
