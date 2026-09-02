// sharp resize/encode pipeline — deliberately duplicated from
// packages/worker/src/image/pipeline.ts, byte-for-byte identical logic,
// rather than lifted into @ocular/shared.
//
// The local-worker implementation plan originally proposed lifting this
// into @ocular/shared since the logic itself is 100% engine-agnostic (it
// takes a raw PNG Buffer, no Patchright/CDP dependency either way). Building
// it revealed that's the wrong call: docs/rules/03-shared-contracts.md §5
// and this repo's own eslint.config.js keep `shared` at zero runtime
// dependencies beyond zod (explicitly restricting even things not
// currently imported — ioredis/bullmq/fastify/patchright/next — as a
// deliberate policy, not an oversight). `sharp` is a real native-binary
// dependency; adding it to `shared` would make every consumer of `shared`
// (including packages that never touch an image, like `dashboard`) pull in
// a native build step. Duplicating this ~30-line function across the two
// packages that actually need it is the same precedent already established
// by packages/dashboard/lib/hash-key.ts and this package's own
// src/ssrf/local-check.ts — keep both copies in sync by hand if
// IMG_MAX_KB/IMG_WEBP_QUALITY/the stepping algorithm itself ever changes.

import sharp from 'sharp';
import { DETAIL_MAX_EDGE_PX, IMG_MAX_KB, IMG_WEBP_QUALITY } from '@ocular/shared';

export interface EncodedImage {
  b64: string;
  mime: 'image/webp';
  w: number;
  h: number;
  bytes: number;
}

const MIN_WEBP_QUALITY = 35;
const QUALITY_STEP = 10;
const MIN_EDGE_PX = 320;
const EDGE_SHRINK_FACTOR = 0.75;

export async function encodeScreenshot(
  raw: Buffer,
  detail: keyof typeof DETAIL_MAX_EDGE_PX,
): Promise<EncodedImage> {
  let maxEdge: number = DETAIL_MAX_EDGE_PX[detail];
  let quality = IMG_WEBP_QUALITY;

  for (;;) {
    const resized = sharp(raw).resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
    const { data, info } = await resized.webp({ quality }).toBuffer({ resolveWithObject: true });

    const underBudget = info.size / 1024 <= IMG_MAX_KB;
    const atQualityFloor = quality <= MIN_WEBP_QUALITY;
    const atEdgeFloor = maxEdge <= MIN_EDGE_PX;

    if (underBudget || (atQualityFloor && atEdgeFloor)) {
      return {
        b64: data.toString('base64'),
        mime: 'image/webp',
        w: info.width,
        h: info.height,
        bytes: info.size,
      };
    }

    if (!atQualityFloor) {
      quality = Math.max(quality - QUALITY_STEP, MIN_WEBP_QUALITY);
    } else {
      maxEdge = Math.max(Math.floor(maxEdge * EDGE_SHRINK_FACTOR), MIN_EDGE_PX);
    }
  }
}
