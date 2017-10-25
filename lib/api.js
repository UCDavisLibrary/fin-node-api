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
 * FIN API class
 */
class FinApi {

  constructor() {
    this.RDF_FORMATS = {
      JSON_LD : 'application/ld+json',
      N_TRIPLES : 'application/n-triples',
      RDF_XML : 'application/rdf+xml',
      SPARQL_UPDATE : 'application/sparql-update',
      N3 : 'text/n3',
      PLAIN : 'text/plain',
      TURTLE : 'text/turtle'
    }

    this.FILE_EXTENSIONS = {
      '.json' : this.RDF_FORMATS.JSON_LD,
      '.nt' : this.RDF_FORMATS.N_TRIPLES,
      '.xml' : this.RDF_FORMATS.RDF_XML,
      '.n3' : this.RDF_FORMATS.N3,
      '.txt' : this.RDF_FORMATS.PLAIN,
      '.ttl' : this.RDF_FORMATS.TURTLE
    }
  }

  /**
   * @method setConfig
   * @param params
   */
  setConfig(params) {
    for( var key in params ) {
      config[key] = params[key];
    }
  }

  /**
   * @method getConfig
   * @description return config object
   */
  getConfig() {
    return config;
  }

  /**
   * @description Create the url base for fedora request. ex: /fcrepo/rest/[transactionid]
   * @param options Optional arguments
   * @param options.basePath override config.basePath
   * @param options.transactionToken override config.transactionToken
   */
  createBasePath(options = {}) {
    return pathutils.joinUrlPath(
      (options.basePath ? options.basePath : config.basePath),
      (this.transaction ? this.transaction : '')
    );
  }

  /**
   * @method createUrl
   * @description Create the url for fedora request.
   * @param {Object} options arguments
   * @param {String} options.path url path
   * @param {String} options.host override config.host
   * @param {String} options.basePath override config.basePath
   * @param {String} options.transactionToken override config.transactionToken
   */
  createUrl(options) {
    return (options.host ? options.host : config.host) + 
           pathutils.joinUrlPath(
            this.createBasePath(options),
            options.path || ''
           );
  }

  /**
   * @description Create a base request object
   * 
   * @param {String} method HTTP method ex. GET, POST, etc
   * @param {Object} options arguments
   * @param {String} options.path url path
   * @param {Object} options.headers url headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.basePath (optional) override config.basePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
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
   * Set the Destination HTTP header.
   */
  destinationHelper(options) {
    if( !options.headers ) options.headers = {};
    if( !options.headers.Destination && options.destination ) {
      options.headers.Destination = (options.host ? options.host : config.host)+options.destination;
    }
  }

  /**
   * Set the sha256 hash for a file upload request
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
   * Calculate sha256 for given file
   * 
   * @param {String} file absolute path to file
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
   * @param {String} options.basePath (optional) override config.basePath
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
   * @param {String} options.basePath (optional) override config.basePath
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
   * @method create
   * @description Create new resources within a LDP container
   * 
   * @param {Object} options arguments
   * @param {String} options.path resource path
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {Object} options.file (optional) path to file to upload
   * @param {Object} options.content (optional) content to upload
   * @param {String} options.host (optional) override config.host
   * @param {String} options.basePath (optional) override config.basePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   */
  async create(options) {
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
   * @method update
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
   * @param {String} options.basePath (optional) override config.basePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   */
  async update(options) {
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
   * @param {String} options.basePath (optional) override config.basePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
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
   * @method remove
   * @description Delete a resource
   * 
   * @param {Object} options arguments
   * @param {String} options.path resource path
   * @param {Boolean} options.permanent remove /fcr:tombstone as well
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.basePath (optional) override config.basePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   */
  async remove(options) {
    var req = this.baseRequest('DELETE', options);
    try {
      if( options.permanent ) {
        await this.request(req);
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
   * @param {String} options.path resource path
   * @param {Boolean} options.destination path to copy resource to
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.basePath (optional) override config.basePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
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
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.basePath (optional) override config.basePath
   * 
   * @returns {String} transaction token
   */
  async startTransaction(options = {}) {
    options.path = '/fcr:tx';
    var req = this.baseRequest('POST', options);
    try {
      var {response, body} = await request(req);
      config.transactionToken = new URL(response.headers.location).pathname.split('/').pop();
      return config.transactionToken;
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method commitTransaction
   * @description Commit transation
   * 
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.basePath (optional) override config.basePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * 
   * @returns {Promise} transaction token
   */
  async commitTransaction(options = {}) {
    options.path = '/fcr:tx/fcr:commit';
    var req = baseRequest('POST', options);
    try {
      let {response, body} = await this._request(req);
      config.transactionToken = '';
      return {response, body};
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method rollbackTransaction
   * @description Rollback transation
   * 
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.basePath (optional) override config.basePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * 
   * @returns {Promise} - response, body
   */
  async rollbackTransaction(options = {}) {
    options.path = '/fcr:tx/fcr:rollback';
    var req = this.baseRequest('POST', options);
    try {
      var {response, body} = await this._request(req);
      config.transaction = '';
      return {response, body};
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method getVersions
   * @description Get a current version
   * 
   * @param {Object} options.headers resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.basePath (optional) override config.basePath
   * 
   * @returns {Promise} - response, body
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
   * @param {*} options 
   */
  async getVersion(options) {
    options.path = pathutils.joinUrlPath(options.path, '/fcr:versions', options.versionName);
    var req = this._baseRequest('GET', options);
    try {
      return await this._request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method createVersion
   * 
   * @param {*} options 
   */
  async createVersion(options) {
    options.path = pathutils.joinUrlPath(options.path, '/fcr:versions');

    if( !options.headers ) options.headers = {};
    options.headers['Slug'] = options.versionName;

    var req = this._baseRequest('POST', options);
    try {
      return await this._request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method revertToVersion
   * 
   * @param {*} options 
   */
  async revertToVersion(options) {
    options.path = pathutils.joinUrlPath(options.path, '/fcr:versions', options.versionName);
    var req = this._baseRequest('PATCH', options);
    try {
      return await this._request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * @method deleteVersion
   * 
   * @param {*} options 
   */
  async deleteVersion(options) {
    options.path = pathutils.joinUrlPath(options.path, '/fcr:versions', options.versionName);
    var req = this._baseRequest('DELETE', options);
    try {
      return await this._request(req);
    } catch(e) {
      throw e;
    }
  }


}

module.exports = FinApi;