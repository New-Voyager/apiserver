# apiserver

[![CircleCI](https://circleci.com/gh/New-Voyager/apiserver.svg?style=svg&circle-token=332b6c164df3a333a6d6e14282ca317d0c52abe5)](https://app.circleci.com/pipelines/github/New-Voyager/apiserver)



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
make watch-debug
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
