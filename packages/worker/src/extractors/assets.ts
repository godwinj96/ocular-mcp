// extract_assets extractor. See docs/rules/05-worker-and-browser-pipeline.md §4.
// SSRF-safe by construction — rewrites to absolute public http(s) URLs only,
// never resolves or proxies the asset bytes through Ocular.

import type { Page } from '../providers/self-hosted-provider.js';
import type { ExtractAssetsInput } from '@ocular/shared';

export interface ExtractedAssets {
  svgs: string[];
  imageUrls: string[];
}

const MAX_SVGS = 50;
const MAX_SVG_CHARS = 20_000; // per-SVG cap so one pathological inline icon set can't blow the response payload.
const MAX_IMAGE_URLS = 200;

export async function extractAssets(page: Page, include: ExtractAssetsInput['include']): Promise<ExtractedAssets> {
  return page.evaluate(
    ({ wantSvg, wantImg, wantIcons, maxSvgs, maxSvgChars, maxImageUrls }) => {
      const svgs: string[] = [];
      const imageUrls = new Set<string>();

      const toAbsolute = (url: string): string | null => {
        try {
          const resolved = new URL(url, document.baseURI);
          return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : null;
        } catch {
          return null;
        }
      };

      if (wantSvg) {
        for (const el of Array.from(document.querySelectorAll('svg')).slice(0, maxSvgs)) {
          const serialized = new XMLSerializer().serializeToString(el);
          if (serialized.length <= maxSvgChars) svgs.push(serialized);
        }
      }

      if (wantImg) {
        for (const img of Array.from(document.querySelectorAll('img'))) {
          if (imageUrls.size >= maxImageUrls) break;
          if (img.src) {
            const abs = toAbsolute(img.src);
            if (abs) imageUrls.add(abs);
          }
          if (img.srcset) {
            for (const candidate of img.srcset.split(',')) {
              if (imageUrls.size >= maxImageUrls) break;
              const url = candidate.trim().split(/\s+/)[0];
              if (url) {
                const abs = toAbsolute(url);
                if (abs) imageUrls.add(abs);
              }
            }
          }
        }

        // CSS background-image url(...) on visible elements.
        for (const el of Array.from(document.querySelectorAll('*'))) {
          if (imageUrls.size >= maxImageUrls) break;
          const bg = window.getComputedStyle(el).backgroundImage;
          const match = /url\((['"]?)(.*?)\1\)/.exec(bg);
          if (match?.[2]) {
            const abs = toAbsolute(match[2]);
            if (abs) imageUrls.add(abs);
          }
        }
      }

      if (wantIcons) {
        for (const link of Array.from(document.querySelectorAll('link[rel~="icon"]'))) {
          if (imageUrls.size >= maxImageUrls) break;
          const href = link.getAttribute('href');
          if (href) {
            const abs = toAbsolute(href);
            if (abs) imageUrls.add(abs);
          }
        }
      }

      return { svgs, imageUrls: Array.from(imageUrls) };
    },
    {
      wantSvg: include.includes('svg'),
      wantImg: include.includes('img'),
      wantIcons: include.includes('icons'),
      maxSvgs: MAX_SVGS,
      maxSvgChars: MAX_SVG_CHARS,
      maxImageUrls: MAX_IMAGE_URLS,
    },
  );
}
