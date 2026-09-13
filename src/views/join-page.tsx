import { Page } from "./page.tsx";

export function JoinPage(props: { code: string; error?: string }) {
  return (
    <Page title="Join room">
      <h1>🐮 Join room</h1>
      <form class="card" method="post" action={`/rooms/${props.code}/join`} hx-boost="true">
        <div class="big-code">{props.code}</div>
        <input
          type="text"
          name="name"
          placeholder="Your name"
          required
          maxlength="24"
          autofocus
          autocomplete="off"
        />
        {props.error ? <p class="error">{props.error}</p> : null}
        <button type="submit" class="btn primary">Join</button>
      </form>
      <p class="muted">
        <a class="muted" href="/">← back</a>
      </p>
    </Page>
  );
}
