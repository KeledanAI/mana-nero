import type { NextConfig } from "next";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
if (supabaseUrl) {
  try {
    const { hostname } = new URL(supabaseUrl);
    remotePatterns.push({
      protocol: "https",
      hostname,
      pathname: "/storage/v1/object/public/**",
    });
  } catch {
    /* URL non valido in CI o locale: ignora */
  }
}

const nextConfig: NextConfig = {
  cacheComponents: false,
  images: {
    remotePatterns,
  },
};

export default nextConfig;
