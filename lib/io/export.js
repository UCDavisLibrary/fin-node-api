const fs = require('fs-extra');
const clone = require('clone');
const path = require('path');
const config = require('../config');

let api;

class ExportCollection {

  constructor(_api) {
    api = _api;
  }

  async run(collectionName, fsRoot) {

    await fs.mkdirp(fsRoot);
  
    let options = {
      currentPath : '/collection/'+collectionName,
      collection : collectionName,
      root : fsRoot
    }

    let rootColDir = path.join(fsRoot, collectionName);
    if( fs.existsSync(rootColDir) ) await fs.remove(rootColDir);

    await this.crawl(options);
  }

  async crawl(options) {
    console.log(options.currentPath);

    let metadata = await api.metadata({path: options.currentPath});
    if( metadata.error ) {
      console.log('Error Access Path: '+options.currentPath);
      console.error(metadata.error);
      // TODO:
      // options.errors.push(metadata.error);
      return;
    }

    metadata = JSON.parse(metadata.last.body)[0];

    // prep dir
    let cdir = path.join(options.root, options.currentPath.replace(/^\/collection\//, ''), '..');
    let dirname = options.currentPath.split('/').pop();
    await fs.mkdirp(cdir);

    let binaryFile = '';

    // write binary
    if( metadata['@type'].indexOf('http://fedora.info/definitions/v4/repository#Binary') > -1 ) {
      binaryFile = metadata['http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#filename'][0]['@value'];

      await fs.mkdirp(cdir);

      await api.get({
        path : options.currentPath,
        encoding : null,
        writeStream : fs.createWriteStream(path.join(cdir, binaryFile))
      });

      if( binaryFile !== dirname ) {
        await fs.symlink(
          path.join(cdir, binaryFile),
          path.join(cdir, dirname)
        );
      }

      options.currentPath += '/fcr:metadata'
    }

    // write ttl
    let ttl = await api.get({
      path: options.currentPath,
      headers : {
        Prefer : 'return=representation; omit="http://www.w3.org/ns/ldp#PreferMembership http://www.w3.org/ns/ldp#PreferContainment http://fedora.info/definitions/v4/repository#InboundReferences http://fedora.info/definitions/v4/repository#EmbedResources http://fedora.info/definitions/v4/repository#ServerManaged"'
      }
    });
    ttl = ttl.last.body
      .replace(new RegExp(config.host+config.fcBasePath+'/collection/'+options.collection, 'g'), '%COLLECTION%')
      .replace(new RegExp(config.host+config.fcBasePath, 'g'), '%URL%');

    if( binaryFile ) {
      await fs.writeFile(path.resolve(cdir, binaryFile+'.ttl'), ttl);
      return;
    } 
    
    await fs.writeFile(path.resolve(cdir, dirname+'.ttl'), ttl);

    // check if this container has children
    let contains = metadata['http://www.w3.org/ns/ldp#contains'];
    if( !contains ) return; // no more children, done crawling this branch

    // just make sure this is an array...
    if( !Array.isArray(contains) ) {
      contains = [contains];
    }

    // recursively crawl the children
    for( var i = 0; i < contains.length; i++ ) {
      let cOptions = Object.assign({}, options);
      cOptions.currentPath = contains[i]['@id'].replace(new RegExp('.*'+config.fcBasePath), '');

      await this.crawl(cOptions);
    }

  }

}

module.exports = ExportCollection;