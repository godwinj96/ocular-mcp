/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // /quota became /usage and /keys became /access when the dashboard grew a
  // real information architecture. Permanent redirects rather than nothing:
  // both paths were linked from the old root's card grid and are plausibly
  // bookmarked, and a 404 on a path that worked yesterday is the kind of small
  // breakage that makes a product feel unmaintained.
  async redirects() {
    return [
      { source: '/quota', destination: '/usage', permanent: true },
      { source: '/keys', destination: '/access', permanent: true },
    ];
  },
};

export default nextConfig;
