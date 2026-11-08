import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads its font files from disk and Prisma ships a native engine; keep both unbundled.
  serverExternalPackages: ["pdfkit", "@prisma/client", "@mobilerun/sdk", "unpdf", "mammoth"],
};

export default nextConfig;
