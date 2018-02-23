const transform = require('./utils/transform');
const loadTemplate = require('./templates/load');
const clone = require('clone');
const fs = require('fs');
const ApiResponse = require('./utils/response');

let API;

const COLLECTION_ROOT_PATH = 'collection';

const MEMBER_OF = 'http://pcdm.org/models#memberOf';
const PCMD_COLLECTION = 'http://pcdm.org/models#Collection';
const BASIC_CONTAINER = 'http://www.w3.org/ns/ldp#BasicContainer'

class Collection {

  constructor(api) {
    API = api;

    this.COLLECTION_ROOT_PATH = COLLECTION_ROOT_PATH;
  }

  testing(testing=true) {
    if( testing ) this.COLLECTION_ROOT_PATH = 'integration-test/'+COLLECTION_ROOT_PATH;
    else this.COLLECTION_ROOT_PATH = COLLECTION_ROOT_PATH;
  }

  /**
   * @method create
   * @description create a new collection
   * 
   * @param {Object} options
   * @param {Object} options.id collection name in path
   * @param {String} options.content turtle content to write to collection root
   * @param {String} options.file turtle file to read from disk and write to collection root
   */
  async create(options) {
    if( !options.id ) {
      return new ApiResponse().setError('You must provide a id for collection');
    }

    let orgOptions = clone(options);

    // make sure the root collection container is setup
    let response = await this._ensureCollectionRoot(options);
    if( response.error ) return response;

    // read turtle if provided by system file
    if( options.file ) {
      if( !fs.existsSync(options.file) ) {
        throw new Error('Unable to find collection file: '+options.file);
      }
      options.content = fs.readFileSync(options.file, 'utf-8');
      delete options.file;
    }

    // transform to jsonld so we can manipulate 
    let jsonld = {};
    if( options.content ) {
      jsonld = await transform.turtleToJsonLd(options.content);
    }

    // ensure container has correct types for collection
    if( Array.isArray(jsonld) ) jsonld.forEach(item => this._ensureCollectionTypes(item));
    else this._ensureCollectionTypes(item);

    // set our content-type to turtle
    if( !options.headers ) options.headers = {};
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;
    options.headers['Slug'] = options.id;
    options.content = await transform.jsonldToTurtle(jsonld);
    options.path = '/'+this.COLLECTION_ROOT_PATH;

    response.appendResponse(await API.postEnsureSlug(options));
    if( response.error ) return response;

    let newPath = response.last.headers.location.replace(API.getBaseUrl(options), '');

    // create the members path
    options = clone(orgOptions);
    if( !options.headers ) options.headers = {};
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;
    options.headers['Slug'] = 'members';
    options.path = newPath;
    options.content = loadTemplate('collectionMembers.ttl', {
      collectionId: API.createFcBasePath(options)+newPath
    });


    response.appendResponse(await API.postEnsureSlug(options));
    if( response.error ) return response;
    let membersPath = response.last.headers.location.replace(API.getBaseUrl(options), '');

    // create the groups path
    options = clone(orgOptions);
    if( !options.headers ) options.headers = {};
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;
    options.headers['Slug'] = 'groups';
    options.path = newPath;
    options.content = loadTemplate('collectionGroups.ttl');

    response.appendResponse(await API.postEnsureSlug(options));
    if( response.error ) return response;
    let groupsPath = response.last.headers.location.replace(API.getBaseUrl(options), '');

    // create the collection acl root
    options = clone(orgOptions);
    options.path = newPath;
    options.label = 'Collection Access Control'
    response.appendResponse(await API.acl.create(options));
    if( response.error ) return response;
    let aclPath = response.data.aclLocation.replace(API.getBaseUrl(options), '');

    return response.setData({
      path : newPath,
      members : membersPath,
      groups : groupsPath,
      acl : aclPath
    });
  }  

  /**
   * @method addMember
   * @description add a member to a collection
   * 
   * @param {Object} options
   * @param {String} options.id container id (name in path)
   * @param {String} options.collectionId collection id (name in path)
   * @param {String} options.metadata turtle content to write to collection root
   * @param {String} options.metadataFile turtle file to read from disk and write to collection root
   * @param {String} options.content turtle content to write to collection root
   * @param {String} options.file turtle file to read from disk and write to collection root
   */
  async addMember(options) {
    if( !options.headers ) options.headers = {};
    let orgOptions = clone(options);
    let collectionPath = '/'+this.COLLECTION_ROOT_PATH+'/'+options.collectionId;

    // make sure collection exists
    options.path = collectionPath;
    var response = await API.head(options);
    if( !response.checkStatus(200) ) {
      return response.setError('Unknown collection id: '+options.collectionId)
    }

    options.path = collectionPath +'/members';
    options.headers['Slug'] = options.id;
    
    response.appendResponse(await API.postEnsureSlug(options));
    if( response.error ) return response;


    // handle metadata merge
    // get current metadata
    options = clone(orgOptions);
    if( options.metadataFile ) {
      options.metadata = fs.readFileSync(options.metadataFile, 'utf-8');
    } else if( !options.metadata && options.file && fs.existsSync(options.file+'.ttl') ) {
      options.metadata = fs.readFileSync(options.file+'.ttl', 'utf-8');
    }

    // nothing let to do
    if( !options.metadata ) return response;

    options.path = collectionPath +'/members/fcr:metadata';
    if( !options.headers ) options.headers = {};
    options.headers['Accept'] = API.RDF_FORMATS.JSON_LD;
    
    response.appendResponse(await API.get(options));
    if( !response.checkStatus(200) ) {
      return response.setError('Unable to get /fcr:metadata for new container');
    }

    let jsonld = JSON.parse(response.last.body)[0];
    let orgJsonld = clone(jsonld);
  
    let mergeData = (await transform.turtleToJsonLd(options.metadata))[0];

    for( let key in mergeData ) {
      if( key === '@id' ) continue;

      if( jsonld[key] ) jsonld[key] = mergeData[key].concat(jsonld[key]);
      else jsonld[key] = mergeData[key];
    }

    let orgttl = await transform.jsonldToTurtle(orgJsonld);
    let newttl = await transform.jsonldToTurtle(jsonld);
    let sparql = await transform.diffToSparql(orgttl, newttl);

    response.appendResponse(await API.patch({
      path : options.path,
      content: sparql
    }));

    // badness
    if( !response.checkStatus(204) ) {
      response.setError('Unable to patch metadata');
    }

    return response;
  }

  /**
   * @method deleteMember
   * @description delete a member of a collection
   * 
   * @param {Object} options
   * @param {String} options.id container id (name in path)
   * @param {String} options.collectionId collection id (name in path)
   */
  deleteMember(options) {
    let path = '/'+this.COLLECTION_ROOT_PATH+'/'+options.collectionId+'/members/'+options.id;
    
    return API.delete({
      path,
      permanent: true
    });
  }

  /**
   * @method delete
   * @description delete a collection
   * 
   * @param {Object} options
   * @param {String} options.id collection id (name in path)
   */
  delete(options) {
    let path = '/'+this.COLLECTION_ROOT_PATH+'/'+options.id;
    
    return API.delete({
      path,
      permanent: true
    });
  }

  /**
   * @method _ensureCollectionRoot
   * @description ensure the /collection container has been created
   * 
   * @param {Object} options 
   */
  async _ensureCollectionRoot(options) {
    options = clone(options);
    if( options.content ) delete options.content;

    options.path = '/'+this.COLLECTION_ROOT_PATH;
    let response = await API.head(options);
    if( response.checkStatus(200) ) return;

    if( !response.checkStatus(404) ) {
      return response.setError('You do not have write permissions to create a collection');
    }

    options.path = '/';
    if( !options.headers ) options.headers = {};
    options.headers['Content-Type'] = API.RDF_FORMATS.TURTLE;
    options.headers['Slug'] = this.COLLECTION_ROOT_PATH;
    options.content = loadTemplate('collectionRoot.ttl');
    
    response.appendResponse(await API.post(options));
    if( !response.checkStatus(201) ) {
      response.setError('You do not have write permissions to create a collection');
    }

    return response;
  }

  async _ensureCollectionTypes(jsonld) {
    if( !jsonld['@type'] ) jsonld['@type'] = [];

    [BASIC_CONTAINER, PCMD_COLLECTION].forEach(type => {
      if( jsonld['@type'].indexOf(type) == -1 ) {
        jsonld['@type'].push(type)
      }
    });
  }

}

module.exports = Collection;