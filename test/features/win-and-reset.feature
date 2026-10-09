Feature: Win and reset
  Eight cows without the pink cow wins the game. A finished game can be reset
  back to an empty lobby without anyone re-joining.

  Tagged @mock: reaching eight cows takes eight rounds, so this stays on a
  mock-mode deploy where rounds resolve fast and deterministically.

  @timeout:180000
  @mock
  Scenario: Holding the pink cow blocks the win
    Given a room of 3 players with the timer set to no limit
    When the room plays until someone reaches 8 cows, always leaving "frank" alone
    Then "frank" has 0 cows
    And "frank" is not announced as the winner
    And "frank" holds the pink cow

  @timeout:180000
  @mock
  Scenario: Reaching eight cows without the pink cow wins
    Given a room of 3 players with the timer set to no limit
    When the room plays until someone reaches 8 cows, with everyone agreeing
    Then the game is over
    And the winner is announced

  @timeout:180000
  @mock
  Scenario: A finished game resets to a fresh lobby
    Given a room of 3 players with the timer set to no limit
    When the room plays until someone reaches 8 cows, with everyone agreeing
    And the host resets the game
    Then the room is back in the lobby
    And everybody's cow count is 0
    And nobody holds the pink cow