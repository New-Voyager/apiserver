# apiserver

[![CircleCI](https://circleci.com/gh/New-Voyager/apiserver.svg?style=svg&circle-token=332b6c164df3a333a6d6e14282ca317d0c52abe5)](https://app.circleci.com/pipelines/github/New-Voyager/apiserver)

## Development
To run the project with postgres database, you need to run the postgres in docker.
```
docker-compose -f docker-compose-pg.yaml up

or

yarn run-pg
```

Then, run the server using either yarn and npm command.
```
yarn debug
```
To run in windows, use debug-windows script.
```
yarn debug-windows 
```

The hit the playground using http://<your host/ip>:9501/graphql.

Use the following sample graphql to verify the system is setup for development.
```
mutation resetData{
	status: resetDB  
}

mutation createPlayers {
 owner:createPlayer(player:{
  name:"owner"
  deviceId: "xyz"
 })
 player1:createPlayer(player:{
  name:"player1"
  deviceId: "player1"
 })
 player2: createPlayer(player:{
  name:"player2"
  deviceId: "player2"
 })
}

query allPlayers {
  allPlayers {
    name
    playerId
  }
}

# user player id (uuid) in the auth header from this point.See HTTP Headers in the playground
# {"Authorization": "Bearer <playerid>"}
# use the player id of the user called owner
mutation createClub {
  clubId: createClub(club:{
    name: "test"
    description:"for fun"
  })
}

query myClubs {
  myClubs {
    name
    memberCount
    private
    clubId
  }
}

# start a game in the club
# change the clubid with the clubid you created in the previous step
mutation startGame {
  game: startGame(clubId: "B6691CBFFA81", game:{
    gameType: HOLDEM
    title:"Friday game"
    smallBlind: 1.0
    bigBlind: 2.0
    straddleBet:4.0
    utgStraddleAllowed:true
    buttonStraddleAllowed:false
    minPlayers: 3
    maxPlayers:9
    gameLength: 60
    buyInApproval:true
    breakLength:20
    autoKickAfterBreak:true
    waitForBigBlind:true
    waitlistSupported:true
    maxWaitList:10
    sitInApproval:true
    rakePercentage: 5.00,
    rakeCap: 5.00,
    buyInMin: 100,
    buyInMax: 600,
    actionTime:30,
    muckLosingHand:true
  }){
    gameId
    bigBlind
    smallBlind
    maxWaitList
    maxPlayers
    minPlayers
    buyInMin
    buyInMax
    
  }
}

query mygames {
  mygames: clubGames(clubId: "EF3A662107CD", page:{prev: 34, count: 1}) {
    pageId
    gameId
    status
    startedAt
    startedBy
    endedBy
    endedAt
  }
}
```

## Testing
There are two run configurations to run tests in package json
First run the the server in test mode, which will use sqllite for database
  "test-server": "NODE_ENV=test DB_USED=sqllite node build/index.js"
```
yarn test-server
```

In windows, use test-server-windows script.
```
yarn test-server-windows
```

Then, run the jest test with test configuration. 
    "test": "NODE_ENV=test jest --runInBand",
```
yarn test
```

You can run below make target to run both test-server and tests.
```
make test
```
