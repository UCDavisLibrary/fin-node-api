/**
 * Extended functionality to working with ACL at low level
 */
const config = require('./config');
const {URL} = require('url');
const path = require('path');
const fs = require('fs');
const clone = require('clone');
const parseLinkHeader = require('parse-link-header');

let API;

const HAS_PARENT = 'http://fedora.info/definitions/v4/repository#hasParent';
const ACCESS_CONTROL = 'http://www.w3.org/ns/auth/acl#accessControl';
const ACCESS_TO = 'http://www.w3.org/ns/auth/acl#accessTo';
const AGENT = 'http://www.w3.org/ns/auth/acl#agent';
const AGENT_CLASS = 'http://www.w3.org/ns/auth/acl#agentClass';
const MODE = 'http://www.w3.org/ns/auth/acl#mode';
const CONTAINS = 'http://www.w3.org/ns/ldp#contains';
const CONTAINER_TYPE = 'http://www.w3.org/ns/ldp#Container';
const AUTORIZATION_TYPE = 'http://www.w3.org/ns/auth/acl#Authorization';
const READ = 'http://www.w3.org/ns/auth/acl#Read';
const WRITE = 'http://www.w3.org/ns/auth/acl#Write';

class ACL {

  constructor(api) {
    API = api;
  }

  /**
   * @method get
   * @description get ACL for given container.
   *
   * @param {Object} options arguments
   * @param {String} options.path path to container
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * @param {String} path absolute path to container
   * 
   * @returns {Promise} resolves to String or null;
   */
  async get(options) {
    if( !options.headers ) options.headers = {};
    options.headers.Accept = API.RDF_FORMATS.JSON_LD;

    let {response} = await API.get(options);

    if( response.statusCode !== 200 ) {
      return null;
    } else if( !response.headers.link ) {
      return null;
    }

    let links = parseLinkHeader(response.headers.link);
    if( links.acl && links.acl.url ) {
      let pathname = new URL(links.acl.url).pathname;
      return pathname.replace(API.getConfig().fcBasePath, '');
    }

    return null;
  }

  /**
   * @method create
   * @description create a ACL at specified path
   * 
   * @param {Object} options arguments
   * @param {String} options.containerPath path to container this ACL will work on
   * @param {String} options.aclPath (optional) path to ACL Container, defaults to [options.containerPath]/.acl
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * @param {String} options.label helper label for ACL container, defaults to 'System Access Control'
   */
  async create(options) {
    if( !options.headers ) {
      options.headers = {};
    }
    let patchOptions = clone(options);

    if( !options.label ) options.label = 'System Access Control';
    options.content = this._loadTemplate('acl.ttl', {label: options.label});


    if( !options.aclPath ) {
      options.aclPath = options.containerPath + '/.acl';
    }

    options.headers.Slug = options.aclPath.replace(/^\//,'');
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;
    options.path = '/';

    // create ACL container
    let response = await API.post(options);
    if( response.response.statusCode !== 201 ) {
      throw new Error(response.response.body);
    }

    // now point containerPath at new ACL
    if( patchOptions.aclPath ) delete patchOptions.aclPath;
    if( patchOptions.containerPath ) delete patchOptions.containerPath;
    patchOptions.path = options.containerPath;

    let templateOptions = {
      path: API.createUrl(options) + options.aclPath.replace(/^\//, '')
    };
    patchOptions.content = this._loadTemplate('aclPatch.sparql', templateOptions);

    return API.patch(patchOptions);
  }

  
  async access(path) {
    let container = await this.get(path);
    if( !container ) return {};

    let {response} = API.get({
      path : container,
      headers : {
        Accept : API.RDF_FORMATS.JSON_LD
      }
    });

    let access = {};
    let parts = path.replace(/(^\/|\/$)/g,'').split('/');
    parts.forEach((p, i) => {
      access['/'+parts.slice(0, i).join('/')] = {};
    });

    for( var i = 0; i < containers.length; i++ ) {
      await this._walkAccess(containers[i], access);
    }

    let keys = Object.keys(access);
    keys.sort((a, b) => {
      if( a.length > b.length ) return 1;
      if( a.length < b.length ) return -1;
      return 0;
    });

    return access;
  }

  async _walkAccess(container, access) {
    let response = API.get({
      path : container,
      headers : {
        Accept : API.RDF_FORMATS.JSON_LD
      }
    });
    container = this._getContainer(JSON.parse(response.body));

    let isAuthorizationContainer = (container['@type'].indexOf(AUTORIZATION_TYPE) > -1);
    let isAccessTo = [];

    if( container[ACCESS_TO] ) {
      for( let i = 0; i < container[ACCESS_TO].length; i++ ) {
        let pathname =  new URL(container[ACCESS_TO][i]['@id']).pathname;
        if( access[pathname] ) {
          isAccessTo.push(pathname);
          break;
        }
      }
    }

    if( isAuthorizationContainer && isAccessTo.length > 0 ) {
      let accessTo = this._getAccessToBestMatch(isAccessTo);
      let modes = container[MODE];
      if( modes ) {
        let isRead = modes.find((mode) => mode['@id'].indexOf(READ) > -1);
        let isWrite = modes.find((mode) => mode['@id'].indexOf(WRITE) > -1);

        let agents = (container[AGENT] || []).map(agent => agent['@id']);
        let agentClasses = (container[AGENT_CLASS] || []).map(agent => agent['@id']);

        let rw = {};
        if( isRead ) rw.read = true;
        if( isWrite ) rw.write = true;

        agents.forEach(agent => access[accessTo] = Object.assign({}, rw));
        agentClasses.forEach(agent => access[accessTo] = Object.assign({}, rw));
      }
    }

    if( container[CONTAINS] ) {
      for( var i = 0; i < container[CONTAINS].length; i++ ) {
        await this._walkAccess(container[CONTAINS][i], access);
      }
    }
  }

  /**
   * @method _getContainer
   * @description get container
   */
  _getContainer(results) {
    return results.find((result) => (result['@type'].indexOf(CONTAINER_TYPE) > -1));
  }

  _getAccessToBestMatch(accessTo) {
    let match = accessTo[0];
    for( var i = 1; i < accessTo.length; i++ ) {
      if( accessTo[i].length > match.length ) {
        match = accessTo[i];
      }
    }
    return match;
  }

  /**
   * @method _loadTemplate
   * @description load a template from the templates dir.  if vars are passed
   * replace {{}} syntax w/ vars
   * 
   * @param {String} name name of template to load
   * @param {Object} vars Optional.  variables to replace
   * 
   * @returns {String}
   */
  _loadTemplate(name, vars = {}) {
    let template = fs.readFileSync(path.join(__dirname, 'templates', name), 'utf-8');
    for( let key in vars ) {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), vars[key]);
    }
    return template;
  }

}


module.exports = ACL;