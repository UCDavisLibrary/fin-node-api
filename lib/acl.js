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

    this.MODES = {READ, WRITE}
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
   * @param {String} options.aclPath (optional) path for ACL Container, defaults to [options.containerPath]/.acl
   * @param {String} options.label (optional) label for ACL container, defaults to 'System Access Control'
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
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

  /**
   * @method allACLAuthorizations
   * @description get all authorizations defined by ACL container
   * 
   * @param {Object} options arguments
   * @param {String} options.path path to ACL container
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * @param {String} path absolute path to container
   * 
   * @returns {Promise}
   */
  async allACLAuthorizations(options) {
    if( !options.headers ) options.headers = {};
    let orgOptions = clone(options);

    // grab ACL container
    options = clone(orgOptions);
    options.headers.Accept = API.RDF_FORMATS.JSON_LD;
    let response = await API.get(options);

    // grab everything defined by this ACL
    let contains = this._getContainer(JSON.parse(response.response.body))[CONTAINS] || [];
    let aclAccess = {};
    let baseUrl = API.getBaseUrl(options).replace(/\/$/, '');

    for( let i = 0; i < contains.length; i++ ) {
      options = clone(orgOptions);
      options.headers.Accept = API.RDF_FORMATS.JSON_LD;
      options.path = contains[i]['@id'].replace(baseUrl, '');
      response = await API.get(options);

      let container = this._getContainer(JSON.parse(response.response.body));

      let accessTo = container[ACCESS_TO];
      let agents = container[AGENT];
      let modes = container[MODE];

      if( !accessTo || !agents || !modes ) {
        continue;
      }

      accessTo = accessTo.map(item => item['@id']);
      agents = agents.map(item => item['@id'] ? item['@id'] : item['@value']);
      modes = modes.map(item => item['@id']);

      accessTo.forEach(url => {
        url = url.replace(baseUrl, '');
        if( !aclAccess[url] ) aclAccess[url] = {__defs__: []};
        aclAccess[url].__defs__.push(options.path);

        agents.forEach(agent => {
          if( !aclAccess[url][agent] ) aclAccess[url][agent] = {};

          modes.forEach(mode => {
            aclAccess[url][agent][mode] = true;
          });
        });
      });
    }

    return aclAccess;
  }

  /**
   * @method authorizations
   * @description get all authorizations for container
   * 
   * @param {Object} options arguments
   * @param {String} options.path path to container
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   * @param {String} path absolute path to container
   */
  async authorizations(options) {
    if( !options.headers ) options.headers = {};
    let orgOptions = clone(options);

    // get the path to ACL container
    let containerPath = await this.get(options);
    if( !containerPath ) return {};
  
    // get all authorizations
    let authorizationsOptions = clone(orgOptions);
    authorizationsOptions.path = containerPath;
    let authorizations = await this.allACLAuthorizations(authorizationsOptions);

    // break out the path into it and it's parent
    let parts = options.path.split('/');
    let parentPaths = [];
    for( var i = 1; i <= parts.length; i++ ) {
      parentPaths.push(parts.slice(0,i).join('/') || '/');
    }

    // ignore authorization paths that are not in the current path
    let paths = Object.keys(authorizations);
    for( var i = paths.length-1; i >= 0; i-- ) {
      if( parentPaths.indexOf(paths[i]) === -1 ) {
        paths.splice(i, 1);
      }
    }
    if( paths.length === 0 ) return {};

    // sort by length, longest path is the one we care about
    paths.sort((a, b) => {
      if( a.length < b.length ) return -1;
      if( a.length > b.length ) return 1;
      return 0;
    });

    // return information about how authorization was built as well
    let definedAt = paths[paths.length-1];
    let auth = authorizations[definedAt];
    let definedBy = auth.__defs__;
    delete auth.__defs__;

    return {
      definedAt, definedBy,
      authorizations: auth
    }
  }

  /**
   * @method add
   * @description add authorization to container
   * 
   * @param {Object} options arguments
   * @param {String} options.path path to container to apply authorization
   * @param {String} options.agent agent you wish to add
   * @param {Array} options.modes modes you wish to add
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   */
  async add(options) {
    if( !options.headers ) options.headers = {};

    let agentName = options.agent;
    if( agentName.match(/^http/i) ) {
      agentName = new URL(agentName).pathname.split('/');
      agentName = agentName[agentName.length-1];
      options.agent = `<${options.agent}>`;
    } else {
      options.agent = `"${options.agent}"`;
    }

    agentName = 'u-'+agentName+'-';
    let modes = [];
    if( options.modes.indexOf(READ) > -1 ) {
      agentName += 'r';
      modes.push('  webac:mode webac:Read ;');
    }
    if( options.modes.indexOf(WRITE) > -1 ) {
      agentName += 'w';
      modes.push('  webac:mode webac:Write ;');
    }
    agentName += '-'+options.path.replace(/\//g, '_');

    let aclPath = await this.get(clone(options));
    if( !aclPath ) throw new Error('Unable to find ACL for path: ',options.path);
    
    let templateOptions = {
      authorizationPath : API.getBaseUrl(options) + options.path,
      agent : options.agent,
      modes : modes.join('\n'),
      label : agentName
    }

    options.path = '/';
    options.headers.Slug = aclPath.replace(/^\//, '') + '/' + agentName;
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;
    options.content = this._loadTemplate('authorization.ttl', templateOptions);

    return API.post(options);
  }

  /**
   * @method _getContainer
   * @description get container
   */
  _getContainer(results) {
    return results.find((result) => (result['@type'].indexOf(CONTAINER_TYPE) > -1));
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