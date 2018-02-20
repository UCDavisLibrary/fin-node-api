/**
 * Extended functionality to working with FIN services at a low level
 */
const config = require('./config');
const fs = require('fs');
const path = require('path');
const URL = require('./utils/url');
const loadTemplate = require('./templates/load');

let API;
const PROXY = 'ProxyService';
const FRAME = 'FrameService';
const WEBHOOK = 'WebhookService';
const EXTERNAL = 'ExternalService';
const AUTHENTICATION = 'AuthenticationService';
const CLIENT = 'ClientService';

let DEFAULT_ROOT = '.services';
let ROOT = DEFAULT_ROOT;

const CONTAINS = 'http://www.w3.org/ns/ldp#contains';
const CONTAINER_TYPE = 'http://www.w3.org/ns/ldp#Container';
const TITLE = 'http://purl.org/dc/elements/1.1/title';
const DESCRIPTION = 'http://purl.org/dc/elements/1.1/description';
const IDENTIFIER = 'http://purl.org/dc/elements/1.1/identifier';

class Service {

  constructor(api) {
    API = api;

    this.TYPES = {PROXY, FRAME, WEBHOOK, EXTERNAL, AUTHENTICATION, CLIENT}
    this.ROOT = ROOT;
    this.DEFAULT_ROOT = DEFAULT_ROOT;

    this.FIN_SERVER_TYPES = {
      SERVICE_ROOT : 'http://library.ucdavis.edu/fin-server#ServiceRoot',
      SERVICE : 'http://library.ucdavis.edu/fin-server#Service',
      FRAME_SERVICE : 'http://library.ucdavis.edu/fin-server#FrameService',
      PROXY_SERVICE : 'http://library.ucdavis.edu/fin-server#ProxyService',
      EXTERNAL_SERVICE : 'http://library.ucdavis.edu/fin-server#ExternalService',
      WEBHOOK_SERVICE : 'http://library.ucdavis.edu/fin-server#WebhookService',
      AUTHENTICATION_SERVICE : 'http://library.ucdavis.edu/fin-server#AuthenticationService',
      CLIENT_SERVICE : 'http://library.ucdavis.edu/fin-server#ClientService',
      URL_TEMPLATE : 'http://library.ucdavis.edu/fin-server#urlTemplate',
      URL : 'http://library.ucdavis.edu/fin-server#url',
      JSON_LD_FRAME : 'http://library.ucdavis.edu/fin-server#jsonldFrame',
      SUPPORTED_TYPE : 'http://library.ucdavis.edu/fin-server#supportedType'
    }
  }


  /**
   * @method testing
   * @description If we are in a test env, change the root URL;
   */
  testing(testing=true) {
    if( testing ) ROOT = 'integration-test/'+DEFAULT_ROOT;
    else ROOT = DEFAULT_ROOT;
    
    this.ROOT = ROOT;
  }

  /**
   * @method init
   * @description create the root .service container
   */
  async init() {
    var {response} = await API.get({path: '/'+ROOT});
    if( response.statusCode !== 404 ) return {response}; 

    return API.post({
      path : '/',
      headers : {
        Slug : ROOT,
        'Content-Type' : API.RDF_FORMATS.TURTLE
      },
      content : loadTemplate('serviceContainer.ttl')
    });
  }

  /**
   * @method create
   * @description create a new service
   * 
   * @param {Object} options arguments
   * @param {String} options.id service id
   * @param {String} options.title (optional) service title
   * @param {String} options.description (optional) service description
   * @param {String} options.type either [ProxyService|FrameService|ExternalService|WebhookService|AuthenticationService]
   * @param {String} options.urlTemplate url template (ProxyService or ExternalService Only).  ex: http://my-service.com{{fcPath}}?extPath={{svcPath}} 
   * @param {String} options.url url template (AuthenticationService, WebhookService or  ClientService).  ex: http://cas:8000
   * @param {Object} options.frame frame definition (FrameService Only) 
   * @param {String} options.supportedType (optional) uri of container rdf:type that is supported by this service
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   */
  async create(options) {
    if( !this._validType(options.type) ) throw new Error('Invalid Type: '+options.type);
    if( !options.id ) throw new Error('Service id Required');

    let id = options.id.replace(/[^a-zA-Z- ]/g, '').trim().replace(/ /g, '-').toLowerCase();
    let templateOptions = {
      id : id,
      title : options.title || id,
      description : options.description || '',
      type : options.type,
      payload : ''
    }
      
    if( options.type === this.TYPES.FRAME && options.frame ) {
      let frame = JSON.stringify(options.frame || {}).replace(/"/g,'\\"')
      templateOptions.payload = `  fin:jsonldFrame "${frame}" ;`
    }
    if( options.urlTemplate ) {
      templateOptions.payload = `  fin:urlTemplate "${options.urlTemplate}" ;`
    }
    if( options.url ) {
      templateOptions.payload += `\n  fin:url "${options.url}" ;`
    }
    if( options.supportedType ) {
      templateOptions.payload += `\n  fin:supportedType <${options.supportedType}> ;`
    }

    let ttl = loadTemplate('service.ttl', templateOptions);

    if( !options.headers) options.headers = {}

    // make sure a service with this name doesn't already exist
    options.path = '/'+ROOT+'/'+templateOptions.id;
    var {response} = await API.head(options);
    if( response.statusCode !== 404 ) throw new Error('Service already exists: '+templateOptions.id);
    
    options.path = '/'+ROOT;
    options.headers.Slug = templateOptions.id;
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;
    options.content = ttl;

    return API.post(options);
  }

  /**
   * @method list
   * @description get a list of all services and service information
   * 
   * @param {Object} options arguments
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   */
  async list(options = {}) {
    if( !options.header ) options.headers = {};
    options.path = '/'+ROOT;
    options.headers.Accept = API.RDF_FORMATS.JSON_LD;

    var {response} = await API.get(options);
    if( response.statusCode !== 200 ) throw new Error('Unabled to access: /'+ROOT);

    let container = this._getContainer(response.body);
    let children = container[CONTAINS] || [];
    let list = [];

    let baseUrl = API.getBaseUrl(options);
    for( let i = 0; i < children.length; i++ ) {
      options.path = children[i]['@id'].replace(baseUrl, '');
      var {response} = await API.get(options);

      let child = this._getContainer(response.body);
      let info = this._getServiceInfo(child);
      info.path = children[i]['@id'].replace(baseUrl, '');
      list.push(info);
    }

    return list;
  }

  /**
   * @method get
   * @description get service info object by service id
   * 
   * @param {Object} options arguments
   * @param {String} options.id service id
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * 
   * @returns {Promise} resolves to service info object
   */
  async get(options) {
    if( !options.headers ) options.headers = {};
    options.headers.Accept = API.RDF_FORMATS.JSON_LD;
    options.path = this.ROOT + '/' + options.id;
    var {response} = await API.get(options);
    if( response.statusCode !== 200 ) throw new Error(`Unabled to get service at ${options.path}`);

    let container = this._getContainer(response.body);
    let info = this._getServiceInfo(container);
    info.path = options.path;
    
    return info;
  }

  /**
   * @method setSecret
   * @description set a service secret.  This will be used to sign the
   * X-FIN-SERVICE-SIGNATURE header.
   * 
   * @param {Object} options
   * @param {Object} options.id service id
   * @param {Object} options.secret service secret
   * 
   * @returns {Promise}
   */
  setSecret(options) {
    return API.post({
      finRequest : true,
      path : `/auth/service/${options.id}`,
      content : options.secret
    });
  }

  /**
   * @method deleteSecret
   * @description remove a service secret.  
   * 
   * @param {Object} options
   * @param {Object} options.id service id
   * 
   * @returns {Promise}
   */
  deleteSecret(options) {
    return API.delete({
      finRequest : true,
      path : `/auth/service/${options.id}`
    });
  }

  /**
   * @method verifySecret
   * @description a GET request to the /auth/service/:id which
   * returns a simple payload with the current X-FIN-SERVICE-SIGNATURE 
   * header set
   * 
   * @param {Object} options 
   * @param {Object} options.id service id 
   */
  verifySecret(options) {
    return API.get({
      finRequest : true,
      path : `/auth/service/${options.id}`
    });
  }

  _getServiceInfo(container) {
    let type = null;
    if( container['@type'].indexOf(this.FIN_SERVER_TYPES.FRAME_SERVICE) > -1 ) {
      type = FRAME;
    } else if( container['@type'].indexOf(this.FIN_SERVER_TYPES.PROXY_SERVICE) > -1 ) {
      type = PROXY;
    } else if( container['@type'].indexOf(this.FIN_SERVER_TYPES.WEBHOOK_SERVICE) > -1 ) {
      type = WEBHOOK;
    } else if( container['@type'].indexOf(this.FIN_SERVER_TYPES.EXTERNAL_SERVICE) > -1 ) {
      type = EXTERNAL;
    } else if( container['@type'].indexOf(this.FIN_SERVER_TYPES.AUTHENTICATION_SERVICE) > -1 ) {
      type = AUTHENTICATION;
    } else if( container['@type'].indexOf(this.FIN_SERVER_TYPES.CLIENT_SERVICE) > -1 ) {
      type = CLIENT;
    }
    
    let supportedTypes = [];
    if( container[this.FIN_SERVER_TYPES.SUPPORTED_TYPE] ) {
      supportedTypes = container[this.FIN_SERVER_TYPES.SUPPORTED_TYPE].map(value => value['@id']);
    }

    return {
      type : type,
      supportedTypes : supportedTypes,
      urlTemplate : this._getValue(container, this.FIN_SERVER_TYPES.URL_TEMPLATE),
      url : this._getValue(container, this.FIN_SERVER_TYPES.URL),
      frame : this._getValue(container, this.FIN_SERVER_TYPES.JSON_LD_FRAME),
      title : this._getValue(container, TITLE),
      description : this._getValue(container, DESCRIPTION),
      id : this._getValue(container, IDENTIFIER)
    }
  }

  /**
   * @method _getValue
   * @description given and container and property, return 
   * first value for that property found
   * 
   * @param {Object} container
   * @param {String} property
   * 
   * @return {String}
   */
  _getValue(container, property) {
    if( !container[property] ) return '';
    if( !container[property].length ) return '';
    return container[property][0]['@value'] || '';
  }

  /**
   * @method _getContainer
   * @description get container
   */
  _getContainer(results) {
    if( typeof results === 'string' ) {
      results = JSON.parse(results);
    }
    return results.find((result) => (result['@type'].indexOf(CONTAINER_TYPE) > -1));
  }

  _validType(type) {
    for(let key in this.TYPES) {
      if( this.TYPES[key] === type ) return true;
    } 
    return false;
  }

}

module.exports = Service;