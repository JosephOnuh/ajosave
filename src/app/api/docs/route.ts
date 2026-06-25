import { headers } from "next/headers";
import { NextResponse } from "next/server";

const SPEC_URL = "/api/docs/spec";
const SWAGGER_CSS_URL = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
const SWAGGER_JS_URL = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
const SWAGGER_CSS_SHA = "sha384-9Q2fpS+xeS4ffJy6CagnwoUl+4ldAYhOs9pgZuEKxypVModhmZFzeMlvVsAjf7uT";
const SWAGGER_JS_SHA = "sha384-IKpAWwsTL0pcw7/Amtnt2eXF4P1BK64WNuY2E/RG15SWLUW5HXzFuyqCSAr/DP8C";

export async function GET() {
  const nonce = headers().get("x-nonce") ?? "";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ajosave API Docs</title>
  <link rel="stylesheet" href="${SWAGGER_CSS_URL}" integrity="${SWAGGER_CSS_SHA}" crossorigin="anonymous" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_JS_URL}" integrity="${SWAGGER_JS_SHA}" crossorigin="anonymous" nonce="${nonce}"></script>
  <script nonce="${nonce}">
    SwaggerUIBundle({
      url: "${SPEC_URL}",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
