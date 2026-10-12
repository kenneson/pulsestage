import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/api", "/session", "/join", "/feedback", "/auth"] },
    sitemap: `${publicEnv.appUrl}/sitemap.xml`,
  };
}
