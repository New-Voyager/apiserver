# apiserver

## Build

To build api server, run the following command.

``
make build
``

## Debug

You need to run postgres first before launching the api server. To run postgres server, use the following command.

``
make run-pg
`` 

To debug api server, first run the API server in watch debug mode. The node server will run in debug mode with watch enabled, and will listen at port 9235 for the debugger to be attached. 

``
make debug
``

Launch vscode debugger with “Watch debug” configuration.


## Testing

There are several tests written to test api server. 

*unit-tests*: Tests the API server functionality without running the graphql server. These tests use sqlite as database backend.

To run unit-tests, run the following command.

``
  make unit-tests
``
*tests*: These tests are functional tests, which is used for testing the graphql API.
To run functional tests, run the following command.

``
  make tests
``
*script-tests*: These tests are kind of end-to-end tests, which can also be used for setting up database for UI development and other testing.  

To run script-tests, run the following command.

``
  make script-tests
``


## Pre-commit Hook

Run the following command to setup the pre-commit style linter.

``
make setup-hook
``

You can also run the linter manually.

``
make lint
``
## Running API server in debugger
Run the game backend stack using docker.
``
POKER_LOCAL_IP=<your ip> make stack-up
``
POKER_LOCAL_IP=192.168.0.107 make stack-up
Run the apiserver in the vscode debugger (Watch Localhost debug in launch.json) 
or in the console (npm run watch-localhost-debug).
Change the setting in launch.json (Watch Localhost debug)
    "NATS_URL": "nats://192.168.0.106:4222",      -> your ip


Open the browser and try http://localhost:9501/graphql. You should see the GraphQL playground.

To bring down the stack.
  make stack-down

To run a simple bot runner game

POKER_LOCAL_IP=192.168.0.107 make simple-game

Sample GQL queries
```
query games {
  liveGames {
    gameCode
    gameType
    clubName
    buyInMin
    buyInMax
    smallBlind
    bigBlind
    maxPlayers
    elapsedTime
    waitlistCount
    isTableFull
  }
  pastGames {
    clubCode
    clubName
    gameCode
    smallBlind
    bigBlind
    gameType
    startedBy
    startedAt
    endedAt
    endedBy
    runTime
    smallBlind
    bigBlind
    endedAt
    startedAt
    handsDealt
    handsPlayed
    sessionTime
    stack
    buyIn
    balance
  }
}
```

Authorization Header
```
{
  "Authorization": "Bearer c2dc2c3d-13da-46cc-8c66-caa0c77459de"
}
```

To reset database

```
make reset-db
```