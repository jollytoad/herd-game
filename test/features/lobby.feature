Feature: Lobby
  Players gather in a room before a game starts. The host controls when the
  game begins, and the room refuses anyone who cannot be seated.

  @mock
  Scenario: Three players unlock the start button
    Given I am the host of a new room
    When "dave" joins
    And "eve" joins
    Then the start button becomes enabled

  @mock
  Scenario: A name that is already taken is refused
    Given I am the host of a new room
    When "dave" joins
    And "dave" tries to join again
    Then "dave" sees the error "That name is taken."

  @mock
  Scenario: Only the host sees the host controls
    Given I am the host of a new room
    When "dave" joins
    Then "dave" waits for the host to start
    And "dave" cannot add a bot
    But I see the start control

  @mock
  Scenario: The host can add a bot to fill the room
    Given I am the host of a new room
    When I add a bot player
    Then the room has 2 players
    And the bot is marked as a bot