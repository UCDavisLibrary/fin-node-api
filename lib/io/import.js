const IoDir = require('./iodir');
const api = require('../api');
const fs = require('fs-extra');
const path = require('path');

class ImportCollection {

  async run(collectionName, fsRoot) {
    let rootDir = new IoDir(fsRoot, '', '');
    await rootDir.crawl();

    // clean
    // try {
    //   await api.collection.delete({id: collectionName});
    // } catch(e) { 
    //   console.log(e);
    // }

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
      console.log('PATCH CONTAINER '+rootDir.fsfull);
      await api.collection.patch({
        collectionId : collectionName,
        id : '',
        parentPath : '',
        metadata : this.getMetadata(rootMetadata, collectionName)
      });
    }

    await this.patch(collectionName, rootDir);
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
      console.log('PATCH CONTAINER: ', container.fcpath, container.localpath);
      let response = await api.collection.patch({
        collectionId : collectionName,
        id : container.id,
        parentPath : container.parentPath,
        metadata : this.getMetadata(container.localpath, collectionName)
      });
      if( response.noop ) console.log('noop');
    }

    for( let binary of files.binaries ) {
      if( !binary.metadata ) continue;
      console.log('\n\nPATCH BINARY: ', binary.fcpath, binary.metadata);

      let response = await api.collection.patch({
        collectionId : collectionName,
        id : binary.id,
        parentPath : binary.parentPath,
        metadata : this.getMetadata(binary.metadata, collectionName)
      });

      if( response.noop ) console.log('noop');
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