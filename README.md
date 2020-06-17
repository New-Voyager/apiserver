# apiserver

# Testing
There are two run configurations to run tests in package json
First run the the server in test mode, which will use sqllite for database
  "test-server": "NODE_ENV=test DB_USED=sqllite node build/index.js"
yarn test-server

Then, run the jest test with test configuration. 
    "test": "NODE_ENV=test jest --runInBand",
yarn test


  
  