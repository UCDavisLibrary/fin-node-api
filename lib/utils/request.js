/**
 * Wrapper for API requests with Authorization token
 */
const requestCallback = require('request');
const config = require('../config');
const auth = require('../auth');

async function request(options) {
  // this sets config.jwt
  await auth.getJwt();

  if( !options.headers ) options.headers = {};

  let authUsed = false;
  if( config.jwt ) {
    authUsed = true;
    options.headers['Authorization'] = `Bearer ${config.jwt}`;
  }

  // browsers are going to try and cache requests event though we may be switching
  // accept header, just set to no-cache for this library
  options.headers['Cache-Control'] = 'no-cache';
  
  options.headers['User-Agent'] = config.userAgent;

  return new Promise((resolve, reject) => {
    requestCallback(options,  (error, response, body) => {
      if( error ) return reject(error);

      response.finAuthenticated = authUsed;
      resolve(response);
    });
  });
}

module.exports = request;