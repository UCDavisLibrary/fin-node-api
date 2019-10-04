const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const yaml = require('js-yaml');

let api;

class ExportCollection {

  constructor(_api) {
    api = _api;
  }

  /**
   * @method run
   * 
   * @param {Object} options
   * @param {String} options.collectionName Optional collection name to export
   * @param {String} options.fsRoot local file system path to export to
   * @param {Boolean} options.cleanDir remove dir if it already exists
   * @param {Boolean} options.ignoreBinary ignore binary file downloads
   * 
   */
  async run(options) {
    options.fsRoot = path.join(options.fsRoot, options.collectionName);
    await fs.mkdirp(options.fsRoot);
    options.currentPath = '/collection/'+options.collectionName;

    if( options.ignoreBinary !== true ) options.ignoreBinary = false;
    if( options.cleanDir !== true ) options.cleanDir = false;

    if( options.ignoreBinary && options.cleanDir ) {
      console.error('ERROR: you cannot clean directory and ignore binary.');
      return;
    }

    let orgRoot = options.fsRoot;
    let finDir = path.join(orgRoot, '.fin');
    let rootColDir = path.join(orgRoot, options.collectionName);

    if( fs.existsSync(options.fsRoot) ) {
      if( options.cleanDir ) {
        console.log(`DIR EXISTS, removing: ${options.fsRoot}`);
        await fs.remove(options.fsRoot);
      } else {
        console.log(`DIR EXISTS, syncing: ${options.fsRoot}`);
      }
    }

    let contentTypes = {};
    await this.crawl(options, contentTypes);

    if( fs.existsSync(path.join(rootColDir, '.fin')) ) {
      await fs.move(path.join(rootColDir, '.fin'), finDir);
    } else {
      await fs.mkdirp(finDir);
    }

    await fs.writeFile(
      path.join(finDir, 'config.yml'), 
      yaml.dump({
        source: {
          host : config.host,
          base : config.fcBasePath,
          collection : options.collectionName
        },
        contentTypes : contentTypes
      })
    );
  }

  async crawl(options, contentTypes) {
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
    let cdir = path.join(options.fsRoot, options.currentPath.replace(/^\/collection\//, ''), '..');
    let dirname = options.currentPath.split('/').pop();
    await fs.mkdirp(cdir);

    let binaryFile = '';

    // write binary
    if( metadata['@type'].indexOf('http://fedora.info/definitions/v4/repository#Binary') > -1 ) {
      // if we are ignoring binary, we have hit a leaf and are down
      if( options.ignoreBinary === true ) return;

      binaryFile = metadata['http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#filename'][0]['@value'];
      // HACK: not sure how this happens, but you can have empty filenames for binaries...
      if( !binaryFile ) binaryFile = dirname;

      // get content type
      let contentType = metadata['http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#hasMimeType'];
      if( contentType ) {
        contentType = contentType[0]['@value'];
        contentTypes[path.parse(binaryFile).ext.replace(/^\./, '')] = contentType;
      }

      // prep dir
      await fs.mkdirp(cdir);

      let download = false;

      // check sha
      if( !fs.existsSync(path.join(cdir, binaryFile)) ) {
        download = true;
      } else {
        let [urn,shaNum,sha] = metadata['http://www.loc.gov/premis/rdf/v1#hasMessageDigest'][0]['@id'].split(':');
        shaNum = shaNum.replace('sha', '');

        let localSha = await api.sha(path.join(cdir, binaryFile), shaNum);
        if( localSha !== sha ) download = true;
        else console.log('SHA OK: '+path.join(cdir, binaryFile));
      }

      if( download ) {
        console.log('DOWNLOADING BINARY: '+path.join(cdir, binaryFile));
        await api.get({
          path : options.currentPath,
          encoding : null,
          writeStream : fs.createWriteStream(path.join(cdir, binaryFile))
        });
      }

      // hack: fs.existsSync doesn't seem to link symlinks :(
      let exists = true;
      try {fs.lstatSync(path.join(cdir, dirname))} 
      catch(e) {exists = false}
      
      if( binaryFile !== dirname && !exists ) {
        let rpath = path.relative(
          path.join(cdir, dirname),
          path.join(cdir, binaryFile) 
        );

        console.log('  -> SETTING SYMLINK: '+path.join(cdir, dirname));
        await fs.symlink(
          rpath,
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

    let baseRe = '<'+config.host+config.fcBasePath+'/collection';
    if( options.currentPath !== '/collection/'+options.collectionName ) {
      baseRe += '/'+options.collectionName;
    }

    let parts = ttl.match(new RegExp(baseRe+'(>|/.*>)', 'g')) || [];
    let relCurrentPath = (options.currentPath.replace(new RegExp('/collection/'+options.collectionName), '') || '/')
      .replace(/\/fcr:metadata\/?$/, '');
    
    parts.forEach(url => {

      let p = url
        .replace(new RegExp(baseRe), '')
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
      console.log('  -> WRITING METADATA: '+path.resolve(cdir, binaryFile+'.ttl'));
      await fs.writeFile(path.resolve(cdir, binaryFile+'.ttl'), ttl);
      return;
    } 
    
    console.log('WRITING METADATA: '+path.resolve(cdir, dirname+'.ttl'));
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

      await this.crawl(cOptions, contentTypes);
    }

  }

}

module.exports = ExportCollection;