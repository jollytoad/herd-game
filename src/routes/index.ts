import { renderHtmlResponse } from "@http/html-stream/render-html-response";
import { LandingPage } from "../views/landing-page.tsx";

export const GET = () => renderHtmlResponse(LandingPage());
