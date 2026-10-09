Feature: Identity
  A player is recognised by the cookie their seat sets, scoped to one room.
  That seat follows a refresh and grants nothing anywhere else.

  Scenario: Refreshing keeps you in your seat
    Given I am the host of a new room
    When "dave" joins
    And I refresh the page
    Then I am still in the room
    And "dave" is still in the room

  Scenario: A room's cookie does not open another room
    Given I am the host of a new room
    When "dave" joins
    And "dave" opens a different room
    Then "dave" is asked to join instead

  Scenario: An unknown room code is refused
    Given I am the host of a new room
    When I try to join room "ZZZZ"
    Then I see the error "Room not found."

  Scenario: A malformed room code never reaches a room
    Given I am on the landing page
    When I try to join room "N.P!"
    Then I see the error "That code doesn't look right."