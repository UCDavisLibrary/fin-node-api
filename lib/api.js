const request = require('./request');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const config = require('./config');
const pathutils = require('./pathutils');

/**
 * @class FinApi
 * 
 * @description FIN API class
 * 
 * Many classes return a promise with a object that looks like {response, body, authenticated}
 * where
 *  - response: HTTP response object
 *  - body: HTTP body contents
 *  - authenticated: boolean flag if a JWT token was sent along with the request
 */
class FinApi {

  constructor() {
    /**
     * @name RDF_FORMATS
     * @type {Object}
     * 
     * JSON_LD: application/ld+json<br />
     * N_TRIPLES: application/n-triples<br />
     * RDF_XML: application/rdf+xml<br />
     * SPARQL_UPDATE: application/sparql-update<br />
     * N3: text/n3<br />
     * PLAIN: text/plain<br />
     * TURTLE: text/turtle
     */
    this.RDF_FORMATS = {
      JSON_LD : 'application/ld+json',
      N_TRIPLES : 'application/n-triples',
      RDF_XML : 'application/rdf+xml',
      SPARQL_UPDATE : 'application/sparql-update',
      N3 : 'text/n3',
      PLAIN : 'text/plain',
      TURTLE : 'text/turtle'
    }

    /**
     * @name FILE_EXTENSIONS
     * @type {Object}
     * 
     * .json: application/ld+json<br />
     * .nt: application/n-triples<br />
     * .xml: application/rdf+xml<br />
     * .n3: text/n3<br />
     * .txt: text/plain<br />
     * .ttl: text/turtle
     */
    this.FILE_EXTENSIONS = {
      '.json' : this.RDF_FORMATS.JSON_LD,
      '.nt' : this.RDF_FORMATS.N_TRIPLES,
      '.xml' : this.RDF_FORMATS.RDF_XML,
      '.n3' : this.RDF_FORMATS.N3,
      '.txt' : this.RDF_FORMATS.PLAIN,
      '.ttl' : this.RDF_FORMATS.TURTLE
    }

    /**
     * @name GET_JSON_ACCEPT
     * @type {Object}
     * 
     * Optional Accept HTTP header values for GET request of Content-Type=application/ld+json
     */
    this.GET_JSON_ACCEPT = {
      EXPANDED : 'application/ld+json; profile="http://www.w3.org/ns/json-ld#expanded"',
      COMPACTED : 'application/ld+json; profile="http://www.w3.org/ns/json-ld#compacted"',
      FLATTENED : 'application/ld+json; profile="http://www.w3.org/ns/json-ld#flattened"'
    }

    /**
     * @name GET_PREFER
     * @type {Object}
     * 
     * Optional Prefer HTTP header values for GET request
     */
    this.GET_PREFER = {
      MINIMAL : 'return=minimal',
      REPRESENTATION : 'return=representation',
      REPRESENTATION_INCLUDE_EMBED_RESOURCE : 'return=representation; include="http://fedora.info/definitions/v4/repository#EmbedResources"',
      REPRESENTATION_INCLUDE_INBOUND_REFERENCES : 'return=representation; include="http://fedora.info/definitions/v4/repository#InboundReferences"',
      REPRESENTATION_INCLUDE_SERVER_MANAGED : 'return=representation; include="http://fedora.info/definitions/v4/repository#ServerManaged"',
      REPRESENTATION_OMIT_EMBED_RESOURCE : 'return=representation; omit="http://fedora.info/definitions/v4/repository#EmbedResources"',
      REPRESENTATION_OMIT_INBOUND_REFERENCES : 'return=representation; omit="http://fedora.info/definitions/v4/repository#InboundReferences"',
      REPRESENTATION_OMIT_SERVER_MANAGED : 'return=representation; omit="http://fedora.info/definitions/v4/repository#ServerManaged"',
    }

    /**
     * @name PUT_PEFER
     * @type {Object}
     * 
     * Optional Prefer HTTP header values for PUT request.
     * Allows replacing the properties of a container without having to provide all of the server-managed triples.
     */
    this.PUT_PEFER = {
      MINIMAL : 'handling=lenient; received="minimal"'
    }
  }

  /**
   * @method setConfig
   * @description Set the API config
   * 
   * To make authenticated requests you should supply either a username/refreshToken or
   * username/password combo.  Then if a JWT doesn't exist or is expired, the request 
   * function will fetch a new JWT before the request is made.
   * 
   * @param params key/value pairs to set
   * @param params.host FIN host ex. http://mydams.org
   * @param params.fcBasePath Fedora base path (default: /fcrepo/rest)
   * @param params.jwt JWT Token
   * @param params.refreshToken refresh token to use if JWT expires
   * @param params.username username to use with refreshToken or password if JWT expires
   * @param params.password password to use if JWT expires
   * @param params.transactionToken custom transaction token
   */
  setConfig(params) {
    for( var key in params ) {
      config[key] = params[key];
    }
  }

  /**
   * @method getConfig
   * @description return config object
   * @returns {Object}
   */
  getConfig() {
    return config;
  }

  /**
   * @method createFcBasePath
   * @private
   * @description Create the url base for fedora request. ex: /fcrepo/rest/[transactionid]
   * @param options Optional arguments
   * @param options.fcBasePath override config.fcBasePath
   * @param options.transactionToken override config.transactionToken
   * @returns {String}
   */
  createFcBasePath(options = {}) {
    return pathutils.joinUrlPath(
      (options.fcBasePath ? options.fcBasePath : config.fcBasePath),
      (this.transaction ? this.transaction : '')
    );
  }

  /**
   * @method createUrl
   * @private
   * @description Create the url for fedora request.
   * @param {Object} options arguments
   * @param {String} options.path url path
   * @param {String} options.host override config.host
   * @param {String} options.fcBasePath override config.fcBasePath
   * @param {String} options.transactionToken override config.transactionToken
   * @returns {String} url
   */
  createUrl(options) {
    return (options.host ? options.host : config.host) + 
           pathutils.joinUrlPath(
            this.createFcBasePath(options),
            options.path || ''
           );
  }

  /**
   * @method baseRequest
   * @private 
   * @description Create a base request object
   * 
   * @param {String} method HTTP method ex. GET, POST, etc
   * @param {Object} options arguments
   * @param {String} options.path url path
   * @param {Object} options.headers url headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  baseRequest(method, options) {
    return {
      method : method,
      headers : options.headers || {},
      uri : this.createUrl(options)
    }
  }

  /**
   * @method extensionHelper
   * @private
   * @description If a file is provided on the request, look at the extension,
   * if it is of a known rdf type, set the content type for the request.
   * 
   * If the content-type header is already set, no operation is performed.
   * 
   * @param {Object} options 
   */
  extensionHelper(options) {
    options.isRdfType = false;
    if( options.headers['Content-Type'] ) {
      for( var key in this.FILE_EXTENSIONS ) {
        if( this.FILE_EXTENSIONS[key] === options.headers['Content-Type'] ) {
          options.isRdfType = true;
          break;
        }
      }
      return;
    }

    // ignore if file argument is the file contents and not the path
    if( options.content ) return;

    var info = path.parse(options.file);
    var knownContentType = this.FILE_EXTENSIONS[info.ext.toLowerCase()];
    
    if( knownContentType ) {
      options.isRdfType = true;
      options.headers['Content-Type'] = knownContentType;
    } 
  }

  /**
   * @method destinationHelper
   * @private
   * @description Set the Destination HTTP header.
   */
  destinationHelper(options) {
    if( !options.headers ) options.headers = {};
    if( !options.headers.Destination && options.destination ) {
      options.headers.Destination = (options.host ? options.host : config.host)+options.destination;
    }
  }

  /**
   * @method fileHelper
   * @private
   * @description Set the sha256 hash for a file upload request
   */
  async fileHelper(options) {
    // ignore if file argument is the file contents and not the path
    if( options.content ) return;

    // if no file path is provided, throw an error
    if( !options.file ) throw new Error('File required');
    
    if( !options.headers ) options.headers = {};
    
    // create absolute file path
    if( !path.isAbsolute(options.file) ) {
      options.file = path.resolve(process.cwd(), options.file);
    }

    // set content type if known and not already set
    this.extensionHelper(options);

    // set the checksum if not an rdf file
    if( !options.isRdfType ) {
      var sha = await this.sha256(options.file);
      options.headers.digest = `sha256=${sha}`;
    }

    // set the content disposition from file name or provided filename option
    if( !options.headers['Content-Disposition'] && !options.isRdfType ) {
      // if filename is provided, set the filename
      if( options.filename ) {
        options.headers['Content-Disposition'] = `attachment; filename="${options.filename}"`;

      // otherwise use the actual filename
      } else {
        var info = path.parse(options.file);
        options.headers['Content-Disposition'] = `attachment; filename="${info.name}"`;
      }
    }
  }

  /**
   * @method sha256
   * @private 
   * @description Calculate sha256 for given file
   * 
   * @param {String} file absolute path to file
   * @return {Promise} String
   */
  sha256(file) {
    return new Promise((resolve, reject) => {
      fs.readFile(file, (err, data) => {
        if( err ) return reject(err);
        var hash = crypto.createHash('sha256');
        hash.update(data);
        resolve(hash.digest('hex'));
      });
    });
  }

  /**
   * @method isSuccess
   * @description Given a HTTP response see if response is in 200 range
   * 
   * @param {Object} response HTTP response object
   * @return {Boolean}
   */
  isSuccess(response) {
    if( response.statusCode >= 200 && response.statusCode < 300 ) {
      return true;
    }
    return false;
  }

  /**
   * @method get
   * @description Retrieve the content of the resource
   * 
   * @param {Object} options arguments
   * @param {String} options.path resource path
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async get(options) {
    var req = this.baseRequest('GET', options);

    try {
      return await request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method head
   * @description Retrieve HTTP headers of the resource
   * 
   * @param {Object} options arguments
   * @param {String} options.path resource path
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async head(options) {
    var req = this.baseRequest('HEAD', options);
    try {
      return await request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method post
   * @description Create new resources within a LDP container
   * 
   * @param {Object} options arguments
   * @param {String} options.path resource path
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {Object} options.file (optional) path to file to upload
   * @param {Object} options.content (optional) content to upload
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async post(options) {
    await this.fileHelper(options);

    var req = this.baseRequest('POST', options);

    if( options.content ) req.body = options.content;
    else req.body = fs.createReadStream(options.file);

    try {
      return await request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method put
   * @description Create a resource with a specified path, or replace the triples associated 
   * with a resource with the triples provided in the request body.
   * 
   * @param {Object} options arguments
   * @param {String} options.path resource path
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {Object} options.file (optional) path to file to upload
   * @param {Object} options.content (optional) content to upload
   * @param {Object} options.partial (optional) only partial update happening, sets Prefer header to handling=lenient; received="minimal" 
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async put(options) {
    await this.fileHelper(options);

    var req = this.baseRequest('PUT', options);

    if( options.content ) req.body = options.file;
    else req.body = fs.createReadStream(options.file);

    if( options.partial ) {
      req.headers.Prefer = 'handling=lenient; received="minimal"';
    }

    try {
      return await request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method patch
   * @description Sparql base update
   * 
   * @param {Object} options arguments
   * @param {String} options.path resource path
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {Object} options.file (optional) path to file to upload
   * @param {Object} options.content (optional) content to upload
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async patch(options) {
    if( !options.headers ) options.headers = {};
    options.headers['Content-Type'] = 'application/sparql-update';

    var req = this.baseRequest('PATCH', options);
    
    if( options.content ) req.body = options.file;
    else req.body = fs.createReadStream(options.file);

    try {
      return await request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method delete
   * @description Delete a resource
   * 
   * @param {Object} options arguments
   * @param {String} options.path resource path
   * @param {Boolean} options.permanent remove /fcr:tombstone as well
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async delete(options) {
    var req = this.baseRequest('DELETE', options);
    try {
      if( options.permanent ) {
        let {response, body, authenticated} = await this.request(req);

        // if the initial delete fails, do not attempt to delete tombstone
        if( !this.isSuccess(response) ) {
          return {response, body, authenticated};
        }

        req.uri = req.uri + '/fcr:tombstone';
        return await request(req);
      } else {
        return await request(req);
      } 
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method copy
   * @description Copy a resource (and its subtree) to a new location
   * 
   * @param {Object} options arguments
   * @param {String} options.path resource path
   * @param {Boolean} options.destination path to copy resource to
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async copy(options) {
    this.destinationHelper(options);
    var req = this.baseRequest('COPY', options);
    try {
      return await request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method startTransaction
   * @description Start a new transaction, returns transation token.
   * 
   * @param {Object} options arguments
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * 
   * @returns {Promise} {response, body, authenticated, transactionToken}
   */
  async startTransaction(options = {}) {
    options.path = '/fcr:tx';
    var req = this.baseRequest('POST', options);
    try {
      var {response, body, authenticated} = await request(req);
      config.transactionToken = new URL(response.headers.location).pathname.split('/').pop();
      return {response, body, authenticated, transactionToken: config.transactionToken};
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method commitTransaction
   * @description Commit transation
   * 
   * @param {Object} options arguments
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async commitTransaction(options = {}) {
    options.path = '/fcr:tx/fcr:commit';
    var req = baseRequest('POST', options);
    try {
      let {response, body, authenticated} = await this._request(req);
      config.transactionToken = '';
      return {response, body, authenticated};
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method rollbackTransaction
   * @description Rollback transation
   * 
   * @param {Object} options arguments
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async rollbackTransaction(options = {}) {
    options.path = '/fcr:tx/fcr:rollback';
    var req = this.baseRequest('POST', options);
    try {
      var {response, body, authenticated} = await this._request(req);
      config.transaction = '';
      return {response, body, authenticated};
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method getVersions
   * @description Get a current version
   * 
   * @param {Object} options 
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async getVersions(options) {
    options.path = pathutils.joinUrlPath(options.path, '/fcr:versions');
    if( !options.headers ) options.headers = {};
    if( !options.headers.Accept ) {
      options.headers.Accept = this.RDF_FORMATS.TURTLE;
    }

    var req = this.baseRequest('GET', options);
    try {
      return await request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method getVersion
   * 
   * @param {Object} options 
   * @param {String} options.versionName version to get
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async getVersion(options) {
    options.path = pathutils.joinUrlPath(options.path, '/fcr:versions', options.versionName);
    var req = this.baseRequest('GET', options);
    try {
      return await request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method createVersion
   * 
   * @param {Object} options 
   * @param {String} options.versionName version to create
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async createVersion(options) {
    options.path = pathutils.joinUrlPath(options.path, '/fcr:versions');

    if( !options.headers ) options.headers = {};
    options.headers['Slug'] = options.versionName;

    var req = this.baseRequest('POST', options);
    try {
      return await request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method revertToVersion
   * 
   * @param {Object} options 
   * @param {String} options.versionName version name to revert to
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async revertToVersion(options) {
    options.path = pathutils.joinUrlPath(options.path, '/fcr:versions', options.versionName);
    var req = this.baseRequest('PATCH', options);
    try {
      return await request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method deleteVersion
   * 
   * @param {Object} options 
   * @param {String} options.versionName version to delete
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * 
   * @returns {Promise} {response, body, authenticated}
   */
  async deleteVersion(options) {
    options.path = pathutils.joinUrlPath(options.path, '/fcr:versions', options.versionName);
    var req = this.baseRequest('DELETE', options);
    try {
      return await request(req);
    } catch(e) {
      throw e;
    }
  }


}

module.exports = new FinApi();