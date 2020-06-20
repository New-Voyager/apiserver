# apiserver

[![CircleCI](https://circleci.com/gh/New-Voyager/apiserver.svg?style=svg&circle-token=332b6c164df3a333a6d6e14282ca317d0c52abe5)](https://app.circleci.com/pipelines/github/New-Voyager/apiserver)

# Testing
There are two run configurations to run tests in package json
First run the the server in test mode, which will use sqllite for database
  "test-server": "NODE_ENV=test DB_USED=sqllite node build/index.js"
yarn test-server

Then, run the jest test with test configuration. 
    "test": "NODE_ENV=test jest --runInBand",
yarn test


  
  
