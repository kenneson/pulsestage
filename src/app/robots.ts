import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api", "/session", "/join", "/es/join", "/en/join", "/feedback", "/auth", "/oauth"] },
    sitemap: `${publicEnv.appUrl}/sitemap.xml`,
  };
}
