const IoDir = require('./iodir');
const api = require('../api');
const fs = require('fs-extra');

class ImportCollection {

  constructor() {

  }

  async run(collectionName, fsRoot) {
    let rootDir = new IoDir(fsRoot, '/');
    await rootDir.crawl();

    console.log(1);
    // clean
    try {
      await api.collection.delete({id: collectionName});
    } catch(e) { 
      console.log(e);
    }

    console.log(2);

    await api.collection.create({
      id: collectionName
    });
    
    await this.init(collectionName, rootDir);

    // await this.patch(collectionName, rootDir);
  }

  async init(collectionName, dir) {
    let files = await dir.getFiles();

    for( let container of files.containers ) {
      console.log('CONTAINER: ', container.fcpath);
      await api.collection.addResource({
        collectionId : collectionName,
        id : container.id,
        parentPath : container.parentPath
      });
    }

    for( let binary of files.binaries ) {
      console.log('BINARY: ', binary.fcpath, binary.localpath);
      console.log({
        collectionId : collectionName,
        id : binary.id,
        parentPath : binary.parentPath,
        data : binary.localpath
      });
      console.log(await api.collection.addResource({
        collectionId : collectionName,
        id : binary.id,
        parentPath : binary.parentPath,
        data : binary.localpath
      }));
    }

    // if( dir.isBinary() ) {
    //   console.log('BINARY: ', dir.path, dir.getBinaryPath());
    //   await api.collection.addResource({
    //     collectionId : collectionName,
    //     id : dir.id,
    //     parentPath : dir.parentPath,
    //     data : dir.getBinaryPath()
    //   });
    // } else {
    //   console.log('CONTAINER: ', dir.path);
    //   await api.collection.addResource({
    //     collectionId : collectionName,
    //     id : dir.id,
    //     parentPath : dir.parentPath
    //   });
    // }
    
    for( let child of dir.children ) {
      await this.init(collectionName, child);
    }
  }

  async patch(collectionName, dir) {
    console.log('PATCH', dir.getTTLPath());

    if( fs.existsSync(dir.getTTLPath()) ) {
      await api.collection.patch({
        collectionId : collectionName,
        id : dir.id,
        parentPath : dir.parentPath,
        metadata : this.getMetadata(dir, collectionName)
      });
    }
    
    for( let child of dir.children ) {
      await this.patch(collectionName, child);
    }
  }

  getMetadata(dir, collectionName) {
    let content = fs.readFileSync(dir.getTTLPath(), 'utf-8');
    content = content
      .replace(/%COLLECTION%/g, api.getBaseUrl()+'/collection/'+collectionName)
      .replace(/%URL%/g, api.getBaseUrl());
    return content;
  }

}

module.exports = new ImportCollection();