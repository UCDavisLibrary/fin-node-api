const IoDir = require('./iodir');
const api = require('../api');
const fs = require('fs-extra');

class ImportCollection {

  constructor() {

  }

  async run(collectionName, fsRoot) {
    let rootDir = new IoDir(fsRoot, '/');
    await rootDir.crawl();

    // clean
    try {
      await api.collection.delete({id: collectionName});
    } catch(e) {}

    await api.collection.create({
      id: collectionName
    });
    
    await this.init(collectionName, rootDir);

    await this.patch(collectionName, rootDir);
  }

  async init(collectionName, dir) {
    if( dir.isBinary() ) {
      console.log('BINARY: ', dir.path, dir.getBinaryPath());
      await api.collection.addResource({
        collectionId : collectionName,
        id : dir.id,
        parentPath : dir.parentPath,
        data : dir.getBinaryPath()
      });
    } else {
      console.log('CONTAINER: ', dir.path);
      await api.collection.addResource({
        collectionId : collectionName,
        id : dir.id,
        parentPath : dir.parentPath
      });
    }
    
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