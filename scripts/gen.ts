import { generateRoutesModule } from "@http/generate/generate-routes-module";
import { dprintFormatModule } from "@http/generate/dprint-format-module";

export async function generateRoutes() {
  console.debug("Generating routes:");
  return await generateRoutesModule({
    fileRootUrl: import.meta.resolve("../src/routes"),
    moduleOutUrl: import.meta.resolve("../src/routes.ts"),
    pathMapper: "@http/discovery/fresh-path-mapper",
    routeMapper: [
      import.meta.resolve("./route-mapper/ignore.ts"),
      "@http/discovery/ts-route-mapper",
    ],
    formatModule: dprintFormatModule(),
    verbose: true,
  });
}

if (import.meta.main) {
  await generateRoutes();
}
