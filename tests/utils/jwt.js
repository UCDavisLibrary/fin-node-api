const jwt = require('jsonwebtoken');
const secrets = require('../secrets');

module.exports = {
  mint : function(username, admin = false) {
    let user = {username};
    if( admin === true ) {
      user.admin = true;
    }

    return jwt.sign(
      user, 
      secrets.jwt.secret, 
      {
        issuer: secrets.jwt.issuer,
        expiresIn: parseInt(secrets.jwt.ttl)
      }
    );
  },
  createUsers() {
    const ADMIN = this.mint('integration-test-admin', true);
    const ALICE = this.mint('alice');
    const BOB = this.mint('bob');
    return {ADMIN, ALICE, BOB};
  }
}