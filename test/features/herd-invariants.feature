Feature: Herd invariants
  Whatever a judge decides, the rules the server applies stay true. These
  scenarios run against any deploy, including one with a live LLM referee, and
  assert consistency rather than the judge's wording.

  Tagged @live: the herd answer is model-chosen free text on such a deploy, so
  these check the rules, never the wording.

  @live
  Scenario: Never more than one pink cow in the room
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | sushi  |
      | frank | curry |
    Then at most one player holds the pink cow

  @live
  Scenario: Cow counts always agree with the badges shown
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | sushi |
    Then each player's cow count matches the result badges

  @live
  Scenario: A player in the herd never ends the round holding the pink cow
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | sushi |
    Then nobody badged as in the herd holds the pink cow

  @live
  Scenario: A round with no herd changes nothing
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza  |
      | eve   | sushi   |
      | frank | curry  |
    Then nobody gained a cow
    And nobody holds the pink cow