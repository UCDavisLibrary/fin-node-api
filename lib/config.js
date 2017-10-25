
class Config {

  constructor() {
    /**
     * Fin server host url eg. http://mydams.org
     */
    this.host = '';
    this.fcBasePath = '/fcrepo/rest'
    
    /**
     * Auth Information
     */
    this.jwt = '';
    this.refreshToken = '';
    this.username = '';
    this.password = '';

    /**
     * Open transaction token
     */
    this.transactionToken = '';
  }

}

module.exports = new Config();