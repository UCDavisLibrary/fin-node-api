// when tests go bad, use this to manually cleanup

const jwt = require('./jwt');
const ADMIN = jwt.mint('integration-test-admin', true);
const USERS = {ADMIN};
const containerUtils = require('./containerUtils')('http://localhost:3000', USERS);

containerUtils.cleanTests()
  .then(() => console.log('success'))
  .catch(e => console.error(e));