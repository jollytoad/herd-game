import { GAME_NAME, TAGLINE } from "../brand.ts";
import { Page } from "./page.tsx";

export function LandingPage() {
  return (
    <Page title={GAME_NAME}>
      <Heading />
      <div class="cards">
        <CreateRoomCard />
        <JoinRoomCard />
      </div>
      <Rules />
    </Page>
  );
}

function Heading() {
  const words = GAME_NAME.split(" ");
  const last = words.pop() ?? "";
  return (
    <>
      <h1>
        <span>🐮</span>
        <span>{words.join(" ")}</span>
        <span class="pink">${last}</span>
      </h1>
      <p class="tag">{TAGLINE}</p>
    </>
  );
}

function CreateRoomCard() {
  return (
    <form class="card" method="post" action="/rooms">
      <h2>Create a room</h2>
      <input
        type="text"
        name="name"
        placeholder="Your name"
        required
        maxlength="24"
        autocomplete="off"
      />
      <button type="submit" class="btn primary">Create room</button>
    </form>
  );
}

function JoinRoomCard() {
  return (
    <form class="card" method="post" action="/rooms/join">
      <h2>Join a room</h2>
      <input
        type="text"
        name="code"
        placeholder="ROOM CODE"
        required
        maxlength="4"
        minlength="4"
        style="text-transform:uppercase;letter-spacing:0.3em;text-align:center"
        autocomplete="off"
      />
      <input
        type="text"
        name="name"
        placeholder="Your name"
        required
        maxlength="24"
        autocomplete="off"
      />
      <button type="submit" class="btn primary">Join</button>
    </form>
  );
}

function Rules() {
  return (
    <div class="rules-blurb">
      Each round everyone secretly answers the same prompt. The LLM referee finds the{" "}
      <b>herd answer</b>{" "}
      — the most common one, synonyms included. Match the herd and you score a cow. Miss it and
      you're stuck holding the <b>pink cow</b> 🐷 until you match the herd again. First to 8 cows
      {" "}
      <i>without</i> the pink cow wins.
    </div>
  );
}
