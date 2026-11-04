/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Produces a small self-contained server in .next/standalone, used by the Docker image.
  // `npm run dev` and `npm start` work the same as before.
  output: "standalone",
};
export default nextConfig;
