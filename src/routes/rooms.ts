import { getBodyAsObject } from "@http/request/body-as-object";
import { createRoom } from "../rooms.ts";
import { seeOther } from "@http/response/see-other";
import { sessionCookie } from "../session.ts";

export const POST = async (req: Request) => {
  const form = await getBodyAsObject<Record<string, string>>(req);
  const name = form.name?.trim().slice(0, 24) || "Player";
  const { code, token } = await createRoom(name);
  return seeOther(`/rooms/${code}`, sessionCookie(code, token));
};
