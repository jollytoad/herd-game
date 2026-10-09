Feature: Smoke
  The narrowest pass over a whole game: a deployed instance loads, seats
  players, runs a round, and reports a result.

  Tagged @smoke @live: cheap enough to point at production. It asserts only
  that a round resolves, never what the judge decided.

  @smoke
  @live
  Scenario: A deployed game runs a round end to end
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | sushi |
    Then the host sees the round 1 result
    And every player has a score