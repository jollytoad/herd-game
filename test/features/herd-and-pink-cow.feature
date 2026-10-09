Feature: Herd and pink cow
  Each round the group clusters on one answer. Matching it earns a cow and
  sheds the pink cow; missing it alone leaves you holding it.

  Tagged @mock: these assert an exact judged outcome, so they need a deploy
  running without OLLAMA_API_KEY, where the deterministic majority judge applies.

  @mock
  Scenario: The most common answer is the herd
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | sushi |
    Then the herd answer is "pizza"
    And "dave" and "eve" each gained a cow
    And "frank" missed the herd

  @mock
  Scenario: Two answers tied means no herd and nobody scores
    Given a room of 4 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | sushi |
      | grace | sushi |
    Then there is no herd
    And nobody gained a cow

  @mock
  Scenario: The only player who missed holds the pink cow
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | sushi |
    Then "frank" holds the pink cow
    And nobody else holds the pink cow

  @mock
  Scenario: Two players who missed leaves the pink cow where it was
    Given a room of 4 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | sushi |
      | grace | sushi |
    Then nobody holds the pink cow

  @mock
  Scenario: Matching the herd sheds the pink cow
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | sushi |
    Then "frank" holds the pink cow
    When the host opens the next round
    And everyone answers:
      | dave  | sushi  |
      | eve   | pizza  |
      | frank | pizza  |
    Then "frank" no longer holds the pink cow
    And "frank" gained a cow

  @mock
  Scenario: Nobody can be named in a herd they never answered
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | pizza |
    Then the herd answer is "pizza"
    And "dave", "eve" and "frank" all gained a cow
    And nobody holds the pink cow