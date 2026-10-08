Feature: Landing page

  The front door of the game: a visitor can start a new game or join one that
  already exists.

  Scenario: A visitor sees both ways in
    When I visit the landing page
    Then I see the "Create a room" card
    And I see the "Join a room" card
    And I see the rules