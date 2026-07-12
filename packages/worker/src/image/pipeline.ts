// sharp resize/encode pipeline. See docs/rules/05-worker-and-browser-pipeline.md §5.

import sharp from 'sharp';
import { DETAIL_MAX_EDGE_PX, IMG_MAX_KB, IMG_WEBP_QUALITY } from '@ocular/shared';

export interface EncodedImage {
  b64: string;
  mime: 'image/webp';
  w: number;
  h: number;
  bytes: number;
}

const MIN_WEBP_QUALITY = 35; // floor — below this the image is too degraded to be useful.
const QUALITY_STEP = 10;
const MIN_EDGE_PX = 320; // floor — below this further downscaling stops helping.
const EDGE_SHRINK_FACTOR = 0.75;

export async function encodeScreenshot(
  raw: Buffer,
  detail: keyof typeof DETAIL_MAX_EDGE_PX,
): Promise<EncodedImage> {
  let maxEdge: number = DETAIL_MAX_EDGE_PX[detail];
  let quality = IMG_WEBP_QUALITY;

  // Step quality down first (cheaper visually), then shrink dimensions once
  // quality bottoms out, until under IMG_MAX_KB or both floors are hit.
  for (;;) {
    const resized = sharp(raw).resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });
    const { data, info } = await resized.webp({ quality }).toBuffer({ resolveWithObject: true });

    const underBudget = info.size / 1024 <= IMG_MAX_KB;
    const atQualityFloor = quality <= MIN_WEBP_QUALITY;
    const atEdgeFloor = maxEdge <= MIN_EDGE_PX;

    if (underBudget || (atQualityFloor && atEdgeFloor)) {
      return { b64: data.toString('base64'), mime: 'image/webp', w: info.width, h: info.height, bytes: info.size };
    }

    if (!atQualityFloor) {
      quality = Math.max(quality - QUALITY_STEP, MIN_WEBP_QUALITY);
    } else {
      maxEdge = Math.max(Math.floor(maxEdge * EDGE_SHRINK_FACTOR), MIN_EDGE_PX);
    }
  }
}
