import { getBodyAsObject } from "@http/request/body-as-object";
import { seeOther } from "@http/response/see-other";

import { addPlayer, normCode } from "../../rooms.ts";
import { html } from "../../html.ts";
import { JoinPage } from "../../views/join-page.tsx";
import { sessionCookie } from "../../session.ts";

export const POST = async (req: Request) => {
  const form = await getBodyAsObject<Record<string, string>>(req);
  const code = normCode(form.code ?? "");
  const name = form.name?.trim().slice(0, 24) || "Player";
  if (!code) {
    return html(JoinPage({ code: "----", error: "That code doesn't look right." }), 400);
  }
  const result = await addPlayer(code, name, false);
  if ("error" in result) return html(JoinPage({ code, error: result.error }), 400);
  return seeOther(`/rooms/${code}`, sessionCookie(code, result.token));
};
