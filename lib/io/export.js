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
   * 
   */
  async run(options) {
    options.fsRoot = path.join(options.fsRoot, options.collectionName);
    await fs.mkdirp(options.fsRoot);
    options.currentPath = '/collection/'+options.collectionName;

    let orgRoot = options.fsRoot;
    let finDir = path.join(orgRoot, '.fin');
    let rootColDir = path.join(orgRoot, options.collectionName);

    if( fs.existsSync(options.fsRoot) ) await fs.remove(options.fsRoot);

    await this.crawl(options);

    if( fs.existsSync(path.join(rootColDir, '.fin')) ) {
      await fs.move(path.join(rootColDir, '.fin'), finDir);
    } else {
      await fs.mkdirp(finDir);
    }

    // support old .acl location export to new .fin location
    if( fs.existsSync(path.join(rootColDir, '.acl')) ) {
      await fs.move(path.join(rootColDir, '.acl'), path.join(finDir, 'acl'));
    }
    if( fs.existsSync(path.join(rootColDir, '.acl.ttl')) ) {
      await fs.move(path.join(rootColDir, '.acl.ttl'), path.join(finDir, 'acl.ttl'));
    }

    await fs.writeFile(
      path.join(finDir, 'config.yml'), 
      yaml.dump({
        source: {
          host : config.host,
          base : config.fcBasePath,
          collection : options.collectionName
        }
      })
    );
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
    let cdir = path.join(options.fsRoot, options.currentPath.replace(/^\/collection\//, ''), '..');
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
    let parts = ttl.match(new RegExp('<'+config.host+config.fcBasePath+'/collection/'+options.collectionName+'(>|/.*>)', 'g'));
    let relCurrentPath = (options.currentPath.replace(new RegExp('/collection/'+options.collectionName), '') || '/')
      .replace(/\/fcr:metadata\/?$/, '');
    
    parts.forEach(url => {

      let p = url
        .replace(new RegExp('<'+config.host+config.fcBasePath+'/collection/'+options.collectionName), '')
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