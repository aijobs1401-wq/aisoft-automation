import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep production deploys unblocked while the repository's legacy ESLint flat config is repaired.
  // Next.js TypeScript validation still runs during the production build.
  eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;
