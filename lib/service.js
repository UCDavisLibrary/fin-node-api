/**
 * Extended functionality to working with FIN services at a low level
 */
const config = require('./config');
const fs = require('fs');
const path = require('path');
const loadTemplate = require('./templates/load');

let API;
const PROXY = 'ProxyService';
const FRAME = 'FrameService';
let ROOT = '.services';

class Service {

  constructor(api) {
    API = api;

    this.TYPES = {PROXY, FRAME}
    this.ROOT = ROOT;
  }


  /**
   * @method testing
   * @description If we are in a test env, change the root URL;
   */
  testing() {
    ROOT = 'integration-test/'+ROOT;
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
   * @param {String} options.name service name
   * @param {String} options.description (optional) service description
   * @param {String} options.type either [ProxyService|FrameService]
   * @param {String} options.urlTemplate url template (ProxyService Only).  ex: http://my-service.com{{fcPath}}?extPath={{extPath}} 
   * @param {Object} options.frame frame definition (FrameService Only) 
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   */
  create(options) {
    if( this.TYPES[options.type] ) throw new Error('Invalid Type: '+options.type);
    if( !options.name ) throw new Error('Service Name Required');

    let templateOptions = {
      name : options.name,
      description : options.description || '',
      type : options.type,
      payload : ''
    }

    if( options.type === this.TYPES.PROXY ) {
      templateOptions.payload = `  fin:urlTemplate "${options.urlTemplate}" ;`
    } else if( options.type === this.TYPES.FRAME ) {
      let frame = JSON.stringify(options.frame || {}).replace(/"/g,'\\"')
      templateOptions.payload = `  fin:jsonldFrame "${frame}" ;`
    }

    let ttl = loadTemplate('service.ttl', templateOptions);
    let urlName = options.name.replace(/[^a-zA-Z ]/g, '').trim().replace(/ /g, '-').toLowerCase();

    options.path = '/'+ROOT;
    if( !options.headers) options.headers = {}
    options.headers.Slug = urlName;
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;
    options.content = ttl;

    return API.post(options);
  }

}

module.exports = Service;