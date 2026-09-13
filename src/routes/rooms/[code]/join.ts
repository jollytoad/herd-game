import { getBodyAsObject } from "@http/request/body-as-object";
import { addPlayer } from "../../../rooms.ts";
import { html } from "../../../html.ts";
import { JoinPage } from "../../../views/join-page.tsx";
import { sessionCookie } from "../../../session.ts";
import { seeOther } from "@http/response/see-other";

export const POST = async (req: Request, match: URLPatternResult) => {
  const code = match.pathname.groups.code!;
  const form = await getBodyAsObject<Record<string, string>>(req);
  const name = form.name?.trim().slice(0, 24) || "Player";
  const result = await addPlayer(code, name, false);
  if ("error" in result) return html(JoinPage({ code, error: result.error }), 400);
  return seeOther(`/rooms/${code}`, sessionCookie(code, result.token));
};
