import init from "@http/host-deno-local/init";
import handler from "./src/handler.ts";

await Deno.serve(await init(handler)).finished;
