import routes from "./routes.ts";
import { html } from "./html.ts";
import { ErrorPage } from "./views/error-page.tsx";
import { interceptResponse } from "@http/interceptor/intercept-response";
import { staticRoute } from "@http/route/static-route";
import { skip } from "@http/interceptor/skip";
import { handle } from "@http/route/handle";

const assets = interceptResponse(staticRoute("/", import.meta.resolve("../public")), skip(405));

export default handle([
  routes,
  assets,
], () => html(ErrorPage({ message: "404 — nothing here but hay." }), 404));
