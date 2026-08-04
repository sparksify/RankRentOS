/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: { '/api/admin/load': ['./data-snapshot/**'] },
};
export default nextConfig;
