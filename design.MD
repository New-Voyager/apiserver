API server workflow/functionality
1. Create club
2. Host game
3. Players join game
4. Start/Resume game   -> Gameserver
5. GameServer posts poker hand result to API server 
    /internal/save-hand/gameId/:gameId/handNum/:handNum
6. GameServer checks whether any updates in the game
    /internal/any-pending-updates/gameId/:gameId
7. If there is a pending update, the call returns true. Game server waits for resume game notification.
8. Game server calls the api server to process pending updates.
    /internal/process-pending-updates/gameId/:gameId
    (pendingupdates.ts/NextHandUpdates table)
    - player left 
    - player joined
    - host paused the game
    - host ended the game
  When a player leaves a game, the following workflow can be triggered.
    - players are changing seats
    - a player from waiting list is taking a seat
9. After processing all updates, if we have enough players in the game (>=2),
   then api server calls the game server to resume the game.

   ${gameServerUrl}/resume-game?game-id=${gameId}
10. Game server interacts with the players and runs the hand. 
    After the hand is over, it posts result (go to step 5)

Game ends
---------
1. The host calls endGame(...) to end the game.
2. If the game is running, end game request is added to NextHandUpdates table.
3. If the game is not running, the game is ended.
4. After the game is ended, the api server calls scheduler service to aggregate
   results.
   ${scheduler url}/schedule-game-post-process?game-id=${gameId}
5. This step is done to avoid blocking end game request.
6. Scheduler calls API server  (src/repositories/aggregate.ts)
    /admin/post-process-games
7. This process will collect the games that are ended and data is not aggregated. This step processes one game at a time.
    

Test coverage
1. Save hands/Check results for each hand (player balance, status)
2. End game/run aggregation. Verify player balance, profit, tips
3. Player requests to join waiting list, let a player leave the game.
   Run pending updates. Accept waiting list seating, and join game.
   Verify the player is in the game (gameInfo API).
4. Two players requests to join waiting list. The first player declines
   to join the game, and the second player accepts to join the game.
   Verify the player is in the game (gameInfo API). Verify both players
   are not in the waiting list any longer.
5. Two players who are in the game request for seat-change. Let a player
   leave the game. The first player accepts to make the seat change. Verify
   the players in the game and the player has changed to new seat. Verify
   only one player is remaining in the seat change list.
6. Two players who are in the game request for seat-change. Let a player
   leave the game. The first player declines to make the seat change. The second player accepts to make seat change. Verify the players in the game and the player has changed to new seat. Verify only one player is remaining in the seat change list.
7. Club member approval/deny membership/kick a member from the club.
