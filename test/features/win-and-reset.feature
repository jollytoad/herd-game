@skip
Feature: Win and reset
  Eight cows without the pink cow wins the game. A finished game can be reset
  back to an empty lobby without anyone re-joining.

  Tagged @mock: reaching eight cows takes eight rounds, so this stays on a
  mock-mode deploy where rounds resolve fast and deterministically.

  @mock
  Scenario: Holding the pink cow blocks the win
    Given a room of 3 players with the timer set to no limit
    When the room plays until someone reaches 8 cows
    And the sole pink cow holder was "frank" every round
    Then the game is not over
    And "frank" holds the pink cow

  @mock
  Scenario: Reaching eight cows without the pink cow wins
    Given a room of 3 players with the timer set to no limit
    When the room plays until someone reaches 8 cows
    And nobody held the pink cow in the round that won
    Then the game is over
    And the winner is announced

  @mock
  Scenario: A finished game resets to a fresh lobby
    Given a room of 3 players with the timer set to no limit
    When the room plays until someone reaches 8 cows
    And the host resets the game
    Then the room is back in the lobby
    And everybody's cow count is 0
    And nobody holds the pink cow