const IoDir = require('./iodir');
const config = require('../config');
const fs = require('fs-extra');
const path = require('path');
const ignore = require('ignore');
const yaml = require('js-yaml');
const mime = require('mime');

let api;
let CONFIG_DIR = '.fin';
let CONFIG_FILE = 'config.yml';
const IGNORE_FILE = '.finignore';

class ImportCollection {

  constructor(_api) {
    api = _api;
  }

  /**
   * @method run
   * 
   * @param {Object} options
   * @param {String} options.collectionName Optional collection name to insert.  Defaults to current collection name
   * @param {String} options.fsPath local file system path
   * @param {String} options.fcPath fedora path.  Defaults to ''
   * @param {Boolean} options.includeImplementation defaults to true
   * 
   */
  async run(options) {
    if( !options.fcPath ) options.fcPath = '';
    if( options.includeImplementation === undefined ) options.includeImplementation = true;

    // parse the ./.fin/config.yaml file
    let config = this.parseConfig(options.fsPath);
    
    // collection name we are inserting into.  Either passed via options or provided by config
    let newCollectionName = options.collectionName || config.source.collection;

    // root fs path
    let fsPath = path.join(options.fsPath, config.source.collection);

    // IoDir object for root fs path, crawl repo
    let rootDir = new IoDir(fsPath, options.fcPath, options.fcPath);
    // set root ignore file if it exists
    if( fs.existsSync(path.join(options.fsPath, IGNORE_FILE)) ) {
      rootDir.parseIgnore(
        path.join(options.fsPath, IGNORE_FILE),
        path.join(options.fsPath, options.fcPath)
      );
    }
    await rootDir.crawl();

    // add implementation containers
    if( options.includeImplementation ) {
      let ig = ignore();
      ig.add(CONFIG_FILE);
      rootDir.config.ignore.push({
        rules : ig,
        fsfull : path.join(options.fsPath, CONFIG_DIR)
      });
    
      let implDir = new IoDir(
        options.fsPath, 
        CONFIG_DIR, 
        CONFIG_DIR,
        rootDir.config
      );
      await implDir.crawl();
      rootDir.children.push(implDir);
    }

    // check for current collection status
    let response = await api.head({path: '/collection/'+newCollectionName});
    
    // check if collection is deleted but tombstone exists
    if( response.last.statusCode === 410 ) {
    try {
        await api.collection.delete({id: newCollectionName});
      } catch(e) { 
        console.log(e);
      }
    }

    // create collection if it doesn't exist
    if( response.last.statusCode !== 200 ) {
      await api.collection.create({
        id: newCollectionName
      });
    }
    
    // create empty rdf as well as binary containers
    await this.postContainers(newCollectionName, rootDir, config);

    // patch root collection container
    let rootMetadata = path.resolve(options.fsPath, config.source.collection+'.ttl');

    // add the root metadata
    if( fs.existsSync(rootMetadata) ) {
      let p = path.join('/collection/'+newCollectionName,  (options.fcPath || ''));
      console.log('PUT CONTAINER '+p);

      response = await api.put({
        path : p,
        content : this.getMetadata(rootMetadata, {newCollectionName, oldCollectionName: config.source.collection}),
        partial : true,
        headers : {
          'content-type' : api.RDF_FORMATS.TURTLE
        }
      });
      console.log(response.last.statusCode, response.last.body);
    }

    // path rdf metadata now that all containers exist
    await this.putContainers(newCollectionName, rootDir, config.source.collection);

    // remove all containers that exist in fedora but not locally on disk
    await this.remove(rootDir, options.fcPath, newCollectionName);
  }

  /**
   * @method parseConfig
   * @description parse the ./.fin/config.yaml file
   * 
   * @param {String} fsRoot
   * 
   * @returns {Object}
   */
  parseConfig(fsRoot) {
    let configFolder = path.join(fsRoot, CONFIG_DIR);
    let configFile = path.join(configFolder, CONFIG_FILE);

    if( !fs.existsSync(configFolder) ) return {source:{},implementation:{}};
    if( !fs.existsSync(configFile) ) return {source:{},implementation:{}};
    
    let config = yaml.safeLoad(fs.readFileSync(configFile, 'utf-8'));
    if( !config.source ) config.source = {};
    if( !config.implementation ) config.implementation = [];
    config.implementation = config.implementation.map(item => {
      let [id, fcPath] = item.split(':');
      return {id, fcPath}; 
    });

    return config;
  }

  async remove(dir, fcRel, collectionName) {
    let fsPaths = await this.getAllFsPaths(dir, {}, collectionName);
    await this._removeFcPaths(fcRel, fsPaths, collectionName);
  }

  async _removeFcPaths(currentPath, fsPaths, collectionName) {
    let cPath = '/collection/'+collectionName+'/'+currentPath;

    let response = await api.head({path: cPath});
    if( response.last.statusCode !== 200 ) return;

    if( !api.isRdfContainer(response.last) ) {
      if( !fsPaths[cPath] ) {
        console.log('REMOVING: '+cPath);
        api.delete({
          path : cPath,
          permanent : true
        });
      }
      return;
    } 
    
    response = await api.get({
      path: cPath,
      headers : {
        accept : api.RDF_FORMATS.JSON_LD
      }
    });
    response = JSON.parse(response.last.body)[0];

    let contains = response['http://www.w3.org/ns/ldp#contains'];
    if( !contains ) return;
    if( !Array.isArray(contains) ) {
      contains = [contains];
    }

    for( var i = 0; i < contains.length; i++ ) {
      let p = contains[i]['@id'].replace(new RegExp('.*'+config.fcBasePath+'/collection/'+collectionName+'/'), '');

      if( !fsPaths['/collection/'+collectionName+'/'+p] ) {
        console.log('REMOVING: /collection/'+collectionName+'/'+p);
        response = await api.delete({
          path : '/collection/'+collectionName+'/'+p,
          permanent : true
        });
        console.log(response.last.statusCode, response.last.body);
      } else {
        await this._removeFcPaths(p, fsPaths, collectionName);
      }
    }
  }

  async getAllFsPaths(dir, paths, collectionName) {
    let files = await dir.getFiles();
    for( let container of files.containers ) {
      paths['/collection/'+collectionName+'/'+container.fcpath] = true;
    }
    for( let binary of files.binaries ) {
      paths['/collection/'+collectionName+'/'+binary.fcpath] = true;
    }
    for( let child of dir.children ) {
      await this.getAllFsPaths(child, paths, collectionName);
    }
    return paths;
  }

  /**
   * @method postContainers
   * @description create all containers.  rdf containers are empty.  binary files or posted.
   * 
   * @param {String} collectionName new collection name
   * @param {IoDir} dir 
   */
  async postContainers(collectionName, dir, collectionConfig={}) {
    let files = await dir.getFiles();

    for( let container of files.containers ) {
      let response = await api.head({path: '/collection/'+collectionName+'/'+container.fcpath});
      if( response.last.statusCode === 200 ) continue;

      console.log('POST CONTAINER: ', container.fcpath);
      response = await api.collection.addResource({
        collectionId : collectionName,
        id : container.fcpath,
        parentPath : ''
      });
      console.log(response.last.statusCode, response.last.body);
    }

    for( let binary of files.binaries ) {
      let fullfcpath = '/collection/'+collectionName+'/'+binary.fcpath;
      let response = await api.head({path: fullfcpath});

      if( !api.isRdfContainer(response.last) && response.last.statusCode === 200 ) {
        response = await api.get({
          path: fullfcpath+'/fcr:metadata',
          headers : {
            accept : api.RDF_FORMATS.JSON_LD
          }
        });

        response = JSON.parse(response.last.body)[0];

        if( !response['http://www.loc.gov/premis/rdf/v1#hasMessageDigest'] ) continue;

        let [urn,shaNum,sha] = response['http://www.loc.gov/premis/rdf/v1#hasMessageDigest'][0]['@id'].split(':');
        shaNum = shaNum.replace('sha', '');

        let localSha = await api.sha(binary.localpath, shaNum);
        if( localSha === sha ) continue;
      }

      await api.collection.deleteResource({
        collectionId : collectionName,
        id : binary.fcpath
      });

      console.log('POST BINARY: ', binary.fcpath);
      
      let customHeaders = {};
      let ext = path.parse(binary.localpath).ext.replace(/^\./, '');
      let mimeLibType = mime.getType(ext);
      if( collectionConfig.contentTypes && collectionConfig.contentTypes[ext] ) {
        customHeaders['content-type'] = 'application/octet-stream';
      } else if( mimeLibType ) {
        customHeaders['content-type'] = mimeLibType;
      }

      response = await api.collection.addResource({
        collectionId : collectionName,
        id : binary.fcpath,
        parentPath : '',
        data : binary.localpath,
        customHeaders
      });
      console.log(response.last.statusCode, response.last.body);
    }
    
    for( let child of dir.children ) {
      await this.postContainers(collectionName, child);
    }
  }

  /**
   * @method putContainers
   * @description put rdf container metadata
   * 
   * @param {String} collectionName
   * @param {IoDir} dir 
   */
  async putContainers(collectionName, dir, oldCollectionName) {
    let files = await dir.getFiles();

    for( let container of files.containers ) {
      console.log('PUT CONTAINER: ', container.fcpath, container.localpath);

      let response = await api.put({
        path : '/collection/'+collectionName+'/'+container.fcpath,
        content : this.getMetadata(container.localpath, {newCollectionName:collectionName, oldCollectionName}),
        partial : true,
        headers : {
          'content-type' : api.RDF_FORMATS.TURTLE
        }
      });
      console.log(response.last.statusCode, response.last.body);
    }

    for( let binary of files.binaries ) {
      if( !binary.metadata ) continue;
      console.log('PUT BINARY: ', binary.fcpath, binary.metadata);

      let response = await api.put({
        path : '/collection/'+collectionName+'/'+binary.fcpath+'/fcr:metadata',
        content : this.getMetadata(binary.metadata, {binaryId: binary.id, newCollectionName:collectionName, oldCollectionName}),
        partial : true,
        headers : {
          'content-type' : api.RDF_FORMATS.TURTLE
        }
      });
      console.log(response.last.statusCode, response.last.body);
    }

    for( let child of dir.children ) {
      await this.putContainers(collectionName, child);
    }
  }

  getMetadata(path, options={}) {
    let content = fs.readFileSync(path, 'utf-8');

    // binary files are posted at /fcr:metadata, so root rdf node should point one level up
    if( options.binaryId ) {
      content = content.replace(/<\s*>/g, '<../'+options.binaryId+'>');
    }

    // if we are renaming collections, this hack is for the fact the top level containers
    // must have the collection name in the ttl to correctly PUT to the LDP.  Simply
    // replacing the old collection name with the new collection name.
    if( options.oldCollectionName && options.newCollectionName ) {
      content = content.replace(
        new RegExp('<'+options.oldCollectionName+'(\/| *>)', 'g'), 
        '<'+options.newCollectionName+'$1'
      );
    }

    return content;
  }

}

module.exports = ImportCollection;