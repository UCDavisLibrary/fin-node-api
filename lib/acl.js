/**
 * Extended functionality to working with ACL at low level
 */
const config = require('./config');
const {URL} = require('url');

let API;

const HAS_PARENT = 'http://fedora.info/definitions/v4/repository#hasParent';
const ACCESS_CONTROL = 'http://www.w3.org/ns/auth/acl#accessControl';
const ACCESS_TO = 'http://www.w3.org/ns/auth/acl#accessTo';
const AGENT = 'http://www.w3.org/ns/auth/acl#agent';
const AGENT_CLASS = 'http://www.w3.org/ns/auth/acl#agentClass';
const MODE = 'http://www.w3.org/ns/auth/acl#mode';
const CONTAINS = 'http://www.w3.org/ns/ldp#contains';
const CONTAINER_TYPE = 'http://fedora.info/definitions/v4/repository#Container';
const AUTORIZATION_TYPE = 'http://www.w3.org/ns/auth/acl#Authorization';
const READ = 'http://www.w3.org/ns/auth/acl#Read';
const WRITE = 'http://www.w3.org/ns/auth/acl#Write';

class ACL {

  constructor(api) {
    API = api;
  }

  /**
   * @method get
   * @description get ACL containers for given container.
   * 
   * @param {String} path absolute path to container
   * 
   * @returns {Promise} resolves to Array or null;
   */
  async get(path) {
    let parts = path.replace(/(^\/|\/$)/g,'').split('/');
    
    while( parts.length > 0 ) {
      path = parts.join('/');

      let response = API.get({
        path : path,
        headers : {
          Accept : API.RDF_FORMATS.JSON_LD
        }
      });
      let container = this._getContainer(JSON.parse(response.body));

      if( container[ACCESS_CONTROL] ) {
        return container[ACCESS_CONTROL].map(item => item['@id']);
      }

      parts.pop();
    }

    return null;
  }

  async access(path) {
    let containers = await this.get(path);
    if( !containers ) return {};

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
    return results.find((result) => result['@type'].indexOf(CONTAINER_TYPE) > -1);
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

}


module.exports = ACL;