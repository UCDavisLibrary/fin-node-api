const IoDir = require('./iodir');
const api = require('../api');
const config = require('../config');
const fs = require('fs-extra');
const path = require('path');

class ImportCollection {

  async run(collectionName, fsRoot, fcRel='') {
    // clean
    // try {
    //   await api.collection.delete({id: collectionName});
    // } catch(e) { 
    //   console.log(e);
    // }

    let rootDir = new IoDir(fsRoot, fcRel, fcRel);
    await rootDir.crawl();

    let response = await api.head({path: '/collection/'+collectionName});
    if( response.last.statusCode !== 200 ) {
      await api.collection.create({
        id: collectionName
      });
    }
    
    await this.init(collectionName, rootDir);

    // patch root collection container
    let rootMetadata = path.resolve(rootDir.fsfull, '..', rootDir.fsfull.split().pop()+'.ttl');

    if( fs.existsSync(rootMetadata) ) {
      let p = path.join('/collection/'+collectionName,  (fcRel || ''));
      console.log('PUT CONTAINER '+p);

      await api.put({
        path : p,
        content : this.getMetadata(rootMetadata, collectionName),
        partial : true,
        headers : {
          'content-type' : api.RDF_FORMATS.TURTLE
        }
      });
    }

    await this.patch(collectionName, rootDir);

    await this.remove(rootDir, fcRel, collectionName);
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
        console.log('REMOVING: '+'/collection/'+collectionName+'/'+p);
        api.delete({
          path : '/collection/'+collectionName+'/'+p,
          permanent : true
        });
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

  async init(collectionName, dir) {
    let files = await dir.getFiles();

    for( let container of files.containers ) {
      let response = await api.head({path: '/collection/'+collectionName+'/'+container.fcpath});
      if( response.last.statusCode === 200 ) continue;

      console.log('POST CONTAINER: ', container.fcpath);
      await api.collection.addResource({
        collectionId : collectionName,
        id : container.fcpath,
        parentPath : ''
      });
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

      console.log('POST BINARY: ', binary.fcpath);
      await api.collection.addResource({
        collectionId : collectionName,
        id : binary.fcpath,
        parentPath : '',
        data : binary.localpath
      });
    }
    
    for( let child of dir.children ) {
      await this.init(collectionName, child);
    }
  }

  async patch(collectionName, dir) {
    let files = await dir.getFiles();

    for( let container of files.containers ) {
      console.log('PUT CONTAINER: ', container.fcpath, container.localpath);

      await api.put({
        path : '/collection/'+collectionName+'/'+container.fcpath,
        content : this.getMetadata(container.localpath, collectionName),
        partial : true,
        headers : {
          'content-type' : api.RDF_FORMATS.TURTLE
        }
      });

      // await api.collection.patch({
      //   collectionId : collectionName,
      //   id : container.id,
      //   parentPath : container.parentPath,
      //   metadata : this.getMetadata(container.localpath, collectionName)
      // });

    }

    for( let binary of files.binaries ) {
      if( !binary.metadata ) continue;
      console.log('PUT BINARY: ', binary.fcpath, binary.metadata);

      await api.put({
        path : '/collection/'+collectionName+'/'+binary.fcpath+'/fcr:metadata',
        content : this.getMetadata(binary.metadata, collectionName),
        partial : true,
        headers : {
          'content-type' : api.RDF_FORMATS.TURTLE
        }
      });

      // await api.collection.patch({
      //   collectionId : collectionName,
      //   id : binary.id,
      //   parentPath : binary.parentPath,
      //   metadata : this.getMetadata(binary.metadata, collectionName)
      // });
    }

    for( let child of dir.children ) {
      await this.patch(collectionName, child);
    }
  }

  getMetadata(path, collectionName) {
    let content = fs.readFileSync(path, 'utf-8');
    content = content
      .replace(/%COLLECTION%/g, api.getBaseUrl()+'/collection/'+collectionName)
      .replace(/%URL%/g, api.getBaseUrl());
    return content;
  }

}

module.exports = new ImportCollection();