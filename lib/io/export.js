const api = require('../api');
const fs = require('fs-extra');
const clone = require('clone');
const path = require('path');
const config = require('../config');

class ExportCollection {

  async clean(collectionName, fsRoot) {

  }

  async run(collectionName, fsRoot) {
    if( fs.existsSync(fsRoot) ) await fs.remove(fsRoot);
    await fs.mkdirp(fsRoot);
  
    let options = {
      currentPath : '/collection/'+collectionName,
      collection : collectionName,
      root : fsRoot
    }

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
    let cdir = path.join(options.root, options.currentPath.replace(/^\/collection\//, ''));
    await fs.mkdirp(cdir);

    // write binary
    if( metadata['@type'].indexOf('http://fedora.info/definitions/v4/repository#Binary') > -1 ) {
      await api.get({
        path : options.currentPath,
        encoding : null,
        writeStream : fs.createWriteStream(path.join(cdir, 'index.bin'))
      });

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

    await fs.writeFile(path.join(cdir, 'index.ttl'), ttl);
    
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

module.exports = new ExportCollection();