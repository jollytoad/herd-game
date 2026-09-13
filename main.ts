import init from "@http/host-deno-local/init";
import { catchResponse } from "@http/interceptor/catch-response";
import handler from "./src/handler.ts";

await Deno.serve(await init(handler, { error: catchResponse })).finished;
