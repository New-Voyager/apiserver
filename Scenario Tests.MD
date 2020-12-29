Scenario 1 (Club Creation)
===========
1. Player registers to the system.
2. Player authenticates using email/password (returns jwt)
> We should use proper JWT at this point (not Bearer <uuid>)
3. Player creates a club using the jwt.
4. Other players registers and joins the club.
5. Club owner approves the players.
6. Club owner denies join request.
7. Get the list of club members and verify the result.

Scenario 2 (Start Game)
===========
A club exists
1. Club owner creates a new HOLDEM game (game has auto buyin approval: true)
2. Club members joins the game
3. A club member tries to join the game in a seat that is already taken (verify the error)
4. Once the table is full. Use gameInfo API to verify the players are marked as PLAYING
5. Query using liveGames API and verify the fields
6. Create another game and let the members join.
7. Verify liveGames has two games now

Scenario 3 (Past Games)
===========
A club exists/create a game/join 5 players- auto approval
Build a map of player names and player id
1. Save hands to the game using /save-hand API. Update the playerID using the playerID.
2. Call end game API
3. Using gameInfo API, wait for the game to end.
4. Using pastGames API, verify the ended game is returned in the list
5. Verify the attributes

Scenario   (Player leaves a seat)
===========

Scenario   (Player takes a open seat)
===========

Scenario   (Player takes a break)
===========

Scenario   (Player comes from break)
===========

Scenario   (BuyIn approval required/approved)
===========

Scenario   (BuyIn approval required/timed out)
===========

Scenario   (Add to Waitlist)
===========

Scenario   (Players are in waitlist and a player leaves a seat)
===========
Wait list player sits in the open seat

Scenario   (Players are in waitlist and a player leaves a seat)
===========
Wait list player did not take the open seat

Scenario   (Open seat, player switches to open seat)
===========

Scenario   (Player requests Seat Change option)
===========

Scenario   (A seat open (player left). The player should be given seat change preference)
===========
Player confirms seat change. Verify the player is moved
Player does not confirm seat change, nothing should happen
Multiple players confirm seat change, the first player in the list should switch seat

