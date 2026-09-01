import { Page } from "./page.tsx";

export function ErrorPage(props: { message?: string } = {}) {
  return (
    <Page title="Error">
      <h1>🐮 Moo-ving on…</h1>
      <div class="card">
        <p>{props.message ?? "Something went wrong. The herd apologises."}</p>
      </div>
      <p>
        <a class="muted" href="/">← back to the barn</a>
      </p>
    </Page>
  );
}
