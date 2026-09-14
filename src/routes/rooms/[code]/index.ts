import { auth } from "../../../auth.ts";
import { html } from "../../../html.ts";
import { JoinPage } from "../../../views/join-page.tsx";
import { RoomPage } from "../../../views/room-page.tsx";

export const GET = async (req: Request, match: URLPatternResult) => {
  const code = match.pathname.groups.code!;
  try {
    const { room, player } = await auth(req, code);
    return html(RoomPage({ room, player }));
  } catch (err) {
    // not seated → show the join form; anything else is a real error
    if (err instanceof Response) return html(JoinPage({ code }));
    throw err;
  }
};
