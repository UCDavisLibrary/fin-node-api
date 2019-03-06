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
    let parts = ttl.match(new RegExp('<'+config.host+config.fcBasePath+'/collection/'+options.collection+'(>|/.*>)', 'g'));
    let relCurrentPath = (options.currentPath.replace(new RegExp('/collection/'+options.collection), '') || '/')
      .replace(/\/fcr:metadata\/?$/, '');
    
    parts.forEach(url => {

      let p = url
        .replace(new RegExp('<'+config.host+config.fcBasePath+'/collection/'+options.collection), '')
        .replace(/>/, '') || '/';

      /**
       * If we have to go up a directory to get from current container path to linked container, you must
       * remember the starting point is the parent path. So if you are at container /foo/bar/baz.  The parent
       * 'folder'/'path' /foo/bar holds container baz, and relative paths should be from /foo/bar. 
       * 
       * You do not want to make this adjustment for child containers.
       */
      let hack = relCurrentPath;
      if( hack !== '/' && !p.startsWith(hack) ) {
        hack = path.resolve(hack, '..');
      }

      hack = path.relative(hack, p);
      ttl = ttl.replace(url, '<'+hack+'>');
    });

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