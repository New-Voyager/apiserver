What is hand?
A game hand contains a list of player actions and winners/winning money of a poker deal.
After the cards are dealt, the player makes preflop actions. If only one player hand is alive
after the actions, then the player is a winner at preflop. This evaulation goes for flop cards,
turn card and river card. In the showdown, all the remaining players are evaluated and winner(s)
are determined. There can be more than one winner. In Hi-LO PLO game, there can be one or more
high card winners and one or more low card winners. There can be more than one pot in a hand. 
For the initial implementation, we will track only main pot winners.


After a hand is concluded, the game server will post a message to API server with the hand information.

data:
{
  "ClubId": <club_id>,
  "GameNum": <game_num>,
  "HandNum": <hand_num>,
  "Players": [1000, 10001, 20001, 30001, 40001],
  "GameType": "HOLDEM",
  "StartedAt": "20200630T00:00:00",
  "EndedAt": "20200630T00:02:00",
  "PreFlop": {
    "actions": [
      { "1000": {"action": "SB", amount: 1.0, balance: 99.0} },
      { "1001": {"action": "BB", amount: 2.0, balance: 98.0} },
      { "20001": {"action": "FOLD", balance: 100.0} },
      { "30001": {"action": "RAISE", amount: 15.0, balance: 85.0} },
      { "40001": {"action": "CALL", amount: 15.0, balance: 85.0} },
      { "1000": {"action": "CALL", amount: 15.0, balance: 85.0} },
      { "1001": {"action": "FOLD",  balance: 98.0} },
    ],
    "pot": 47.0
  },
  "Flop": {
    "cards": ["Ac", "8d", "4s"],
    "actions": [
      { "1000": {"action": "CHECK", balance: 85.0} },
      { "30001": {"action": "BET", amount: 15.0, balance: 70.0} },
      { "40001": {"action": "FOLD", balance: 85.0} },
      { "1000": {"action": "FOLD", balance: 85.0} },
    ],
    "pot": 62.0
  },
  "Result": {
    "winners_count": 1
    "winners": [{
        "player": 10001,
        "received": 62.0 
      }],
    "won_at": "PREFLOP",
  }
}


Hand history tracks hands played in different clubs/games. 
1. Each player should be able to analyze hands that they played.
  For v1, it is OK to setup a scope within a club and game
2. The club owner should be able to analyze hands within a game or multiple games in a date range.

What does hand history contain?
club_id int
game_num int
hand_num int
game_type  GameType
won_at: int 0: preflop, 1: flop, 2: turn, 3: river, 4: showdown
show_down boolean
winning_cards: comma separated cards (string) 
winning_rank: int
lo_winning_cards: comma separated cards
lo_winning_rank: int
time_started (index)
time_ended (index)
data: json
total_pot: float

hand_winners
club_id
game_num
hand_num
is_high (bool, default: true)
winning_cards: comma separated cards (string)
winning_rank: int
player_id (index)
pot: float


Queries:
show the last hand information. Input: club_id, game_num, output: data
show a specific hand. Input: club_id, game_num, hand_num, output: data
get my winning hands (max last 10): input: club_id, game_num, output: data[]

Game analysis


Player analysis
- Show me the last hand
- Show me the hands I won pot in a specific game
- Show me the last x hands of a game since time t (club_id, game_num, time)
- Show me how many hands I won in last x days
- Show me my buy-in vs profit/loss in last x days in a club

Analysis 
- Show my session times last month
