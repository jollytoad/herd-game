@skip
Feature: Round lifecycle
  A game is a run of rounds. The host opens each one, everyone answers
  secretly, and the round resolves once no one is left waiting.

  Scenario: The host opens the first round
    Given I am the host of a new room
    When "dave" joins
    And "eve" joins
    And I set the timer to no limit
    And I start the game
    Then everyone is asked round 1's question
    And nobody has answered yet

  Scenario: Locking in an answer is final for the round
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And "dave" answers "pizza"
    Then "dave" has locked in
    And the board shows "dave" has answered

  Scenario: The round resolves once everyone has answered
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And "dave" answers "pizza"
    And "eve" answers "pizza"
    And "frank" answers "sushi"
    Then the host sees the round 1 result

  Scenario: Only the host can open the next round
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | sushi |
    Then the host is offered the next round
    And "dave" is waiting for the host to start the next round
    When the host opens the next round
    Then everyone is asked round 2's question

  Scenario: A player cannot answer after the round is judged
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | sushi |
    Then "frank" can no longer lock in an answer