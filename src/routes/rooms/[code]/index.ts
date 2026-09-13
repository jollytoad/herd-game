import { auth } from "../../../auth.ts";
import { html } from "../../../html.ts";
import { JoinPage } from "../../../views/join-page.tsx";
import { RoomPage } from "../../../views/room-page.tsx";

export const GET = async (req: Request, match: URLPatternResult) => {
  const code = match.pathname.groups.code!;
  const session = await auth(req, code);
  if (!session) return html(JoinPage({ code }));
  return html(RoomPage({ room: session.room, player: session.player }));
};
