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

  }
}