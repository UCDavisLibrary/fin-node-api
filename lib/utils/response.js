/**
 * All methods return this response
 */

class ApiResponse {

  constructor() {
    // all http responses made for method call
    this.httpStack = [];

    // last http response made for method call
    this.last = null;
    
    // data to return for method (may be a response)
    this.data = null;
    
    // was there an known error
    this.error = null;
  }

  /**
   * @method checkStatus
   * @description check the status code of the last response
   * 
   * @param {Number} statusCode
   * 
   * @returns {Boolean} 
   */
  checkStatus(statusCode) {
    if( !this.last ) return false;
    return (this.last.statusCode === statusCode);
  }

  /**
   * @method push
   * @description push a new http response on to the http
   * stack.  Optionally set response as data
   * 
   * @param {Object} response http response
   * @param {Boolean} setData set http response as data
   */
  push(response, setData = false) {
    this.httpStack.push(response);
    this.last = response;
    if( setData ) this.setData(response);
    return this;
  }

  /**
   * @method appendResponse
   * @description append a ApiResponse httpStack to
   * this response httpStack
   * 
   * @param {ApiResponse} response
   **/
  appendResponse(response) {
    this.httpStack = this.httpStack.concat(response.httpStack);
    this.last = response.last;

    if( !this.error && response.error ) {
      this.error = response.error;
    }

    this.setData(response.data);
    return this;
  }

  setData(response) {
    this.data = response;
    return this;
  }

  setError(error) {
    if( typeof error === 'string' ) {
      error = new Error(error);
    }

    this.error = error;
    return this;
  }

}

module.exports = ApiResponse;