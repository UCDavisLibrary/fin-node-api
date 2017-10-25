/**
 * Wrapper for API requests with Authorization token
 */
const requestCallback = require('request');
const config = require('./config');
const auth = require('./auth');

async function request(options) {
  // this sets config.jwt
  await auth.getJwt();

  let authUsed = false;
  if( config.jwt ) {
    if( !options.headers ) options.headers = {};
    authUsed = true;
    options.headers['Authorization'] = `Bearer ${config.jwt}`;
  }

  return new Promise((resolve, reject) => {
    requestCallback(options,  (error, response, body) => {
      if( error ) return reject(error);
      resolve({response, body, authenticated: authUsed});
    });
  });
}

module.exports = request;