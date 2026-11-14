/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image.
  output: 'standalone',
  swcMinify: true,
  webpack: (config) => {
    // @huggingface/transformers ships Node-only backends that must not be bundled for the browser.
    config.resolve.alias = { ...config.resolve.alias, sharp$: false, 'onnxruntime-node$': false };
    // The library locates its WebAssembly runtime itself (from its CDN) at run time;
    // webpack must not try to bundle those `new URL(...)` references.
    config.module.rules.push({
      test: /[\\/](@huggingface[\\/]transformers|onnxruntime-web)[\\/]/,
      parser: { url: false },
    });
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
};

export default nextConfig;
