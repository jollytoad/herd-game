@skip
Feature: Bad question
  Anyone can call a prompt a dud. Enough of the room agreeing throws the
  question away and draws a replacement.

  Scenario: A majority calling bad question draws a new one
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And the host calls bad question
    And "dave" calls bad question
    Then a different question is on the table

  Scenario: Too few rejections leaves the question alone
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And the host calls bad question
    Then the question is unchanged
    And the reject count reads "1/2"

  Scenario: Rejecting twice counts once
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And the host calls bad question
    And the host calls bad question again
    Then the reject count reads "1/2"

  Scenario: A rejected question still starts the next round cleanly
    Given a room of 3 players with the timer set to no limit
    When I start the game
    And the host calls bad question
    And "dave" calls bad question
    Then nobody has answered yet
    When everyone answers:
      | dave  | pizza |
      | eve   | pizza |
      | frank | sushi |
    Then the host sees the round 1 result