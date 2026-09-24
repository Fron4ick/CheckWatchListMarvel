import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Статический экспорт для хостинга на Yandex Cloud Object Storage.
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
