require('source-map-support').install();
require('module-alias/register');
require('reflect-metadata');

// testSetup.ts
module.exports = async () => {
  console.log('teardown');
};
