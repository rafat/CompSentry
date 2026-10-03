/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["wagmi", "viem", "@tanstack/react-query"],
};

export default nextConfig;
