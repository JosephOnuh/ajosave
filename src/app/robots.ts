import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/circles", "/circles/*"],
        disallow: ["/api/", "/dashboard/"],
      },
    ],
    sitemap: "https://www.ajosave.app/sitemap.xml",
  };
}

