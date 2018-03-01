/**
 * Extended functionality to working with ACL at low level
 */
const config = require('./config');
const URL = require('./utils/url');
const path = require('path');
const fs = require('fs');
const clone = require('clone');
const template = require('./templates/load');
const transform = require('./utils/transform');
const ApiResponse = require('./utils/response');

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
const MEMBER = 'http://xmlns.com/foaf/0.1/member';
const PUBLIC_AGENT = 'http://xmlns.com/foaf/0.1/Agent';

class ACL {

  constructor(api) {
    API = api;

    this.PUBLIC_AGENT = PUBLIC_AGENT;
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
   * @returns {Promise} ApiResponse Array
   */
  async get(options) {
    if( !options.headers ) options.headers = {};
    options.headers.Accept = API.RDF_FORMATS.JSON_LD;

    let response = await API.get(options);

    if( response.last.statusCode !== 200 ) {
      return response;
    } else if( !response.last.headers.link ) {
      return response;
    }

    let links = API.parseLinkHeader(response.last.headers.link);

    if( links.acl ) {
      let arr = links.acl.map(link => {
        let pathname = new URL(link.url).pathname;
        return pathname.replace(API.getConfig().fcBasePath, '');
      });
      response.setData(arr);
    }

    return response;
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
   * 
   * @returns {Promise} ApiResponse
   */
  async create(options) {
    if( !options.headers ) {
      options.headers = {};
    }
    let patchOptions = clone(options);

    if( !options.label ) options.label = 'System Access Control';
    options.content = template('acl.ttl', {label: options.label});


    if( !options.aclContainerName ) {
      options.aclContainerName = '.acl';
    }

    options.headers.Slug = options.aclContainerName;
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;

    // create ACL container
    let response = await API.postEnsureSlug(options);
    if( response.error ) {
      return response;
    }
    let aclLocation = response.data;

    let templateOptions = {
      path: API.createUrl(options).replace(/\/$/, '') + '/' + options.aclContainerName
    };
    patchOptions.content = template('aclPatch.sparql', templateOptions);
    
    response.appendResponse(await API.patch(patchOptions));
    if( !response.checkStatus(204) ) {
      response.setError(new Error('Unable to patch container with accessControl property '));
    }

    return response.setData({aclLocation});
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
    if( response.last.statusCode !== 200 ) {
      return response.setError('No access to acl container');
    }

    // grab everything defined by this ACL
    let contains = this._getContainer(JSON.parse(response.last.body))[CONTAINS] || [];
    let aclAccess = {};
    let baseUrl = API.getBaseUrl(options).replace(/\/$/, '');
    let rootPath = options.path.replace(/\/^/, '');

    for( let i = 0; i < contains.length; i++ ) {
      options = clone(orgOptions);
      options.headers.Accept = API.RDF_FORMATS.JSON_LD;
      options.path = contains[i]['@id'].replace(baseUrl, '');
      
      response.appendResponse(await API.get(options));

      if( response.error || !response.checkStatus(200) ) {
        if( !response.error ) response.setError('Unable to get container: '+options.path);
        return response;
      }

      let container = this._getContainer(JSON.parse(response.last.body));

      let accessTo = container[ACCESS_TO];
      let agents = container[AGENT];
      let agentClasses = container[AGENT_CLASS];
      let modes = container[MODE];

      if( !accessTo || (!agents && !agentClasses) || !modes ) {
        continue;
      }

      accessTo = accessTo.map(item => item['@id']);
      agents = (agents || []).map(item => item['@id'] ? item['@id'] : item['@value']);
      agentClasses = (agentClasses || []).map(item => item['@id'] ? item['@id'] : item['@value']);
      modes = modes.map(item => item['@id']);

      // if we have groups, set the group information,
      // ie who are the groups agents
      if( agentClasses.length > 0 ) {
        if( !aclAccess.groups ) aclAccess.__groups__ = {};

        for( var j = 0; j < agentClasses.length; j++ ) {
          if( aclAccess.__groups__[agentClasses[j]] ) continue;

          response.appendResponse(await API.get({
            path: agentClasses[j].replace(baseUrl, ''),
            headers : {
              Accept : API.RDF_FORMATS.JSON_LD
            }
          }));

          if( response.error || !response.checkStatus(200) ) {
            if( !response.error ) response.setError('Unable to get container: '+agentClasses[j].replace(baseUrl, ''));
            return response;
          }

          let groupContainer = this._getContainer(JSON.parse(response.last.body));
          if( !groupContainer ) continue;
          aclAccess.__groups__[agentClasses[j]] = (groupContainer[MEMBER] || []).map(item => item['@id'] ? item['@id'] : item['@value']);
        }
      }

      agents = agents.concat(agentClasses);

      // now lets actually fill out the access information
      for( var j = 0; j < accessTo.length; j++ ) {
        let url = accessTo[j];

        url = url.replace(baseUrl, '');
        if( !aclAccess[url] ) {
          aclAccess[url] = {
            authorizations: {},
            authorization: {}
          };
        }

        let isRootAclContainer = await this._isPathAccessControlRoot(baseUrl, url, orgOptions.path);
        if( isRootAclContainer ) {
          aclAccess[url].aclRoot = true;
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
      }
    }

    return response.setData(aclAccess);
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
    let response = await this.get(options);
    if( response.error ) return response;
  
    // get all authorizations
    let authorizationsOptions = clone(orgOptions);

    let access = {
      authorizations : {},
      authorization : {},
      definedAt : []
    }

    let aclContainerPaths = response.data;
    for( var i = 0; i < aclContainerPaths.length; i++ ) {
      let aclContainerPath = aclContainerPaths[i];

      access.definedAt.push(aclContainerPath);
      authorizationsOptions.path = aclContainerPath;

      response.appendResponse(await this.allACLAuthorizations(authorizationsOptions));
      if( response.error ) return response;
      let acl = response.data;

      // get our paths access or set to empty object
      let containerAccess = acl[options.path.replace(/\/$/, '')];
      if( containerAccess ) {
        this._mergeRoles(access, containerAccess)
      }
      
      // now we need to walk up the tree and find the parent with webac:accessControl set
      // these roles propogate down to child
      let baseUrl = API.getBaseUrl(options).replace(/\/$/, '');
      let parts = aclContainerPath.replace(/(^\/|\/$)/g, '').split('/');
      let rootAclContainerPath;
      for( let i = parts.length-1; i >= 0; i-- ) {
        let tmpPath = '/'+parts.slice(0, i).join('/');
        let isRootAclContainer = await this._isPathAccessControlRoot(baseUrl, tmpPath, aclContainerPath)
        
        // we found it quit out
        if( isRootAclContainer ) {
          rootAclContainerPath = tmpPath;
          break;
        }
      }

      // append root access
      if( rootAclContainerPath && acl[rootAclContainerPath] ) {
        this._mergeRoles(access, acl[rootAclContainerPath]);
      }
    }

    return response.setData(access);
  }

  _mergeRoles(access1, access2) {

    // merge in the authorizations
    for( let path in access2.authorizations ) {
      access1.authorizations[path] = access2.authorizations[path];
    }

    // merge in modes from authorization
    for( let user in access2.authorization ) {
      if( !access1.authorization[user] ) access1.authorization[user] = {};
      for( let mode in access2.authorization[user] ) {
        access1.authorization[user][mode] = true;
      }
    }
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
   * @param {Array} options.aclPath (optional) if multiple acls are defined, select the acl to add
   * authorization to.  Otherwise the first ACL will be used.
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

    let aclPath = options.aclPath;
    let response = new ApiResponse();
    if( !aclPath ) {
      // find the acls for this container
      response = await this.get(clone(options));
      if( response.error ) return response;
      aclPath = response.data[0];
    }
    
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
    options.content = template('authorization.ttl', templateOptions);

    // make request and let someone else handle response
    return response.appendResponse(await API.post(options));
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

    options.content = template('group.ttl', {
      label: options.name || 'Agent Group',
      members : options.agents.join('\n')
    });
    
    if( !options.headers ) options.headers = {};
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;
    options.headers.Slug = options.name;

    return API.postEnsureSlug(options);
  }

  /**
   * @method modifyGroupAgents
   * @description add agents to group
   * 
   * @param {Object} options arguments
   * @param {String} options.path path to group
   * @param {String|Array} options.addAgents agents you wish to add to group
   * @param {String|Array} options.removeAgents agents you wish to remove from the group
   * @param {Object} options.headers (optional) additional resource headers, key/value pairs
   * @param {String} options.host (optional) override config.host
   * @param {String} options.fcBasePath (optional) override config.fcBasePath
   * @param {String} options.transactionToken (optional) override config.transactionToken
   */
  async modifyGroupAgents(options) {
    if( !options.headers ) options.headers = {};
    let getOptions = clone(options);
    
    // first group the group container
    getOptions.headers['Accept'] = API.RDF_FORMATS.JSON_LD;
    var response = await API.get(getOptions);
    
    if( !response.checkStatus(200) ) {
      return response.setError('Unable to access container');
    }
    
    // make a clone for diff later on
    let jsonld = JSON.parse(response.last.body)[0];
    let orgJsonld = clone(jsonld);

    let currentMembers = jsonld[MEMBER] || [];
    if( typeof currentMembers === 'string' ) {
      currentMembers = [currentMembers];
    }

    let addAgents = options.addAgents || [];
    if( typeof addAgents === 'string' ) {
      addAgents = [addAgents];
    }

    let removeAgents = options.removeAgents || [];
    if( typeof removeAgents === 'string' ) {
      removeAgents = [removeAgents];
    }

    addAgents.forEach(agent => {
      let exists = currentMembers.find(member => {
        if( member['@id'] === agent || member['@value'] === agent ) {
          return true;
        }
      });

      if( !exists ) currentMembers.push(this._parseJsonLdValue(agent));
    });

    removeAgents.forEach(agent => {
      let index = currentMembers.findIndex(member => {
        if( member['@id'] === agent || member['@value'] === agent ) {
          return true;
        }
      });

      if( index > -1 ) {
        currentMembers.splice(index, 1);
      }
    });

    jsonld[MEMBER] = currentMembers;

    let oldttl = await transform.jsonldToTurtle(orgJsonld);
    let newttl = await transform.jsonldToTurtle(jsonld);
    let sparql = await transform.diffToSparql(oldttl, newttl);

    options.content = sparql;
    return response.appendResponse(await API.patch(options));
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

  _parseJsonLdValue(value, options) {
    // we were given a full url
    if( value.match(/^http/i) ) {
      return {'@id': value};

    // we were given a full path 
    } else if( value.match(/^\//i) ) {
      let baseUrl = API.getBaseUrl(options);
      return {'@id': `${baseUrl}/${value.replace(/^\//,'')}`};

    // it's just a string
    } 

    return {'@value': value};
  }

  async _isPathAccessControlRoot(baseUrl, containerPath, aclPath) {
    let response = await API.get({
      path: containerPath.replace(baseUrl, ''),
      headers : {
        Accept : API.RDF_FORMATS.JSON_LD
      }
    });

    if( response.last.statusCode === 200 ) {
      let container = this._getContainer(response.last.body);
      if( container && container[ACCESS_CONTROL] ) {
        let isRootAclContainer = container[ACCESS_CONTROL].find(control => {
          return control['@id'].replace(baseUrl, '') === aclPath;
        });

        if( isRootAclContainer ) return true
      }
    }

    return false;
  }

}

module.exports = ACL;