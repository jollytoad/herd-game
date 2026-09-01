import routes from "./routes.ts";
import { html } from "./html.ts";
import { ErrorPage } from "./views/error-page.tsx";
import { withFallback } from "@http/route/with-fallback";

export default withFallback(
  routes,
  () => html(ErrorPage({ message: "404 — nothing here but hay." }), 404),
);
