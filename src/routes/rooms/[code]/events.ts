import { sseHandler } from "../../../sse-handler.ts";

export const GET = (req: Request, match: URLPatternResult) =>
  sseHandler(req, match.pathname.groups.code!);
