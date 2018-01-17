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
   * @param {String} options.path path to container this ACL will work on
   * @param {String} options.aclContainerName (optional) path for ACL Container, defaults to [options.containerPath]/.acl
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


    if( !options.aclContainerName ) {
      options.aclContainerName = '.acl';
    }

    options.headers.Slug = options.aclContainerName;
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;

    // create ACL container
    let response = await API.post(options);
    if( response.response.statusCode !== 201 ) {
      return response;
    }


    let templateOptions = {
      path: API.createUrl(options).replace(/\/$/, '') + '/' + options.aclContainerName
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
    let rootPath = options.path.replace(/\/^/, '');

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
        if( !aclAccess[url] ) {
          aclAccess[url] = {
            authorizations: {},
            authorization: {}
          };
        }
        aclAccess[url].authorizations[options.path] = {}

        agents.forEach(agent => {
          if( !aclAccess[url].authorization[agent] ) {
            aclAccess[url].authorization[agent] = {};
          }
          if( !aclAccess[url].authorizations[options.path][agent] ) {
            aclAccess[url].authorizations[options.path][agent] = {};
          }

          modes.forEach(mode => {
            aclAccess[url].authorization[agent][mode] = true;
            aclAccess[url].authorizations[options.path][agent][mode] = true;
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
    let aclContainerPath = await this.get(options);
    if( !aclContainerPath ) return {};
  
    // get all authorizations
    let authorizationsOptions = clone(orgOptions);
    authorizationsOptions.path = aclContainerPath;
    let acl = await this.allACLAuthorizations(authorizationsOptions);

    // get our paths access or set to empty object
    let access = acl[options.path.replace(/\/$/, '')];
    if( !access ) {
      access = {
        authorizations : {},
        authorization : {}
      }
    }
    access.definedAt = aclContainerPath;
   
    // now we need to walk up the tree and find the parent with webac:accessControl set
    // these roles propogate down to child
    let baseUrl = API.getBaseUrl(options).replace(/\/$/, '');
    let parts = aclContainerPath.replace(/(^\/|\/$)/g, '').split('/');
    let rootAclContainerPath;
    for( let i = parts.length-1; i >= 0; i-- ) {
      let tmpPath = '/'+parts.slice(0, i).join('/');
      let {response} = await API.get({
        path: tmpPath,
        headers : {
          Accept : API.RDF_FORMATS.JSON_LD
        }
      });
      let container = this._getContainer(response.body);
      
      // we have found a container with webac:accessControl
      if( container && container[ACCESS_CONTROL] ) {
        // does this property have a url that is the same as our paths acl?
        let isRootAclContainer = container[ACCESS_CONTROL].find(control => {
          return control['@id'].replace(baseUrl, '') === aclContainerPath;
        });

        // we found it quit out
        if( isRootAclContainer ) {
          rootAclContainerPath = tmpPath;
          break;
        }
      }
    }

    // append root access
    if( rootAclContainerPath && acl[rootAclContainerPath] ) {
      // merge in the authorizations from root
      for( let path in acl[rootAclContainerPath].authorizations ) {
        access.authorizations[path] = acl[rootAclContainerPath].authorizations[path];
      }

      // merge in modes from authorization
      for( let user in acl[rootAclContainerPath].authorization ) {
        if( !access.authorization[user] ) access.authorization[user] = {};
        for( let mode in acl[rootAclContainerPath].authorization[user] ) {
          access.authorization[user][mode] = true;
        }
      }
    }

    return access;
  }

  /**
   * @method add
   * @description add authorization to container
   * 
   * @param {Object} options arguments
   * @param {String} options.path path to container to apply authorization
   * @param {String} options.agent agent you wish to add
   * @param {String} options.type type should be either [user|group].  defaults to user.
   * @param {Array} options.modes modes you wish to add
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   */
  async add(options) {
    if( !options.headers ) options.headers = {};

    // set default type and make sure time is cleaned up
    if( !options.type ) options.type = 'user';
    options.type = options.type.toLowerCase().trim();

    // grab the correct turtle encoded value w/ a label from helper
    let result = this._parseRdfValue(options.agent, options);
    let authPath = result.label;
    options.agent = result.value; 

    // start creating the container label and authorization container path name
    // path name will be [type]/[agentLabel]/[containerPath]/[permissions]
    let label = '';
    if( options.type === 'group' ) {
      label = 'Group: '+authPath+', ';
      authPath = 'g/'+authPath+'/';
    } else {
      label = 'User: '+authPath+', ';
      authPath = 'u/'+authPath+'/';
    }

    // container creating auth path, append container path
    let tmp = options.path.replace(/(^\/|\/$)/g, '');
    if( tmp ) {
      authPath += tmp+'/';
    }

    // set the permission flags to label, authPath and the turtle template
    let modes = [];
    if( options.modes.indexOf(READ) > -1 ) {
      authPath += 'r';
      label += 'r';
      modes.push('  webac:mode webac:Read ;');
    }
    if( options.modes.indexOf(WRITE) > -1 ) {
      authPath += 'w';
      label += 'w';
      modes.push('  webac:mode webac:Write ;');
    }

    // on more bit for the label
    label += ', on /'+tmp;

    // find the acl for this container
    let aclPath = await this.get(clone(options));
    if( !aclPath ) throw new Error('Unable to find or access ACL for path: '+options.path);
    
    // options for creating authorization container turtle from template
    let templateOptions = {
      authorizationPath : API.getBaseUrl(options) + options.path,
      agent : options.agent,
      type : options.type === 'group' ? 'agentClass' : 'agent',
      modes : modes.join('\n'),
      label : label
    }

    // finally, lets setup the actual POST request
    options.path = aclPath;
    options.headers.Slug = authPath;
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;
    options.content = this._loadTemplate('authorization.ttl', templateOptions);

    // make request and let someone else handle response
    return API.post(options);
  }

  /**
   * @method addGroup
   * @description add a group with users (agents)
   * 
   * @param {Object} options arguments
   * @param {String} options.path path to container to create group
   * @param {String} options.name name of the group
   * @param {String} options.agents agents you wish to add to group
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   */
  addGroup(options) {
    options.agents = (options.agents || []).map(agent => {
      let result = this._parseRdfValue(agent, options);
      return `  foaf:member ${result.value} ;`;
    });

    options.content = this._loadTemplate('group.ttl', {
      label: options.name,
      members : options.agents.join('\n')
    });
    
    if( !options.headers ) options.headers = {};
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;
    options.headers.Slug = options.name;

    return API.post(options);
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

  _parseRdfValue(value, options) {
    let label;

    // we were given a full url
    if( value.match(/^http/i) ) {
      label = new URL(value).pathname.split('/');
      label = label[label.length-1];
      value = `<${value}>`;

    // we were given a full path 
    } else if( value.match(/^\//i) ) {
      label = value.replace(/\/$/, '').split('/').pop();
      let baseUrl = API.getBaseUrl(options);
      value = `<${baseUrl}/${value.replace(/^\//,'')}>`;

    // it's just a string
    } else {
      label = value;
      value = `"${value}"`;
    }

    return {label, value};
  }

}


module.exports = ACL;