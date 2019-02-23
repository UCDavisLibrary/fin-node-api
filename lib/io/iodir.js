const fs = require('fs-extra');
const path = require('path');

class IoDir {

  constructor(root, p) {
    this.root = root;
    this.path = p;
    
    let parts = p.split('/');
    this.id = parts.pop();
    this.parentPath = parts.join('/');
  }

  async crawl() {
    if( this.children ) return this.children;
    this.children = [];
    this.files = [];

    let children = await fs.readdir(path.join(this.root, this.path));
    for( let child of children ) {
      let p = path.join(this.root, this.path, child);
      if( !fs.statSync(p).isDirectory() ) {
        this.files.push(child);
        continue;
      }

      child = new IoDir(this.root, path.join(this.path, child));
      this.children.push(child);
      await child.crawl();
    }

    return this.children;
  }

  async getFiles() {
    let symlinks = {};
    let binaryFiles = {};
    let containerFiles = {};

    for( let child of this.files ) {
      let fullPath = path.join(this.root, this.path, child);
      let info = fs.lstatSync(fullPath);

      if( info.isSymbolicLink() ) {
        let pointer = fs.realpathSync(fullPath).split('/').pop();
        symlinks[pointer] = child;
      } else if( path.parse(child).ext !== '.ttl' ) {
        binaryFiles[child] = fullPath;
      } else {
        containerFiles[child] = fullPath;
      }
    }

    let result = {
      containers : [],
      binaries : []
    }

    for( let name in binaryFiles ) {
      let id = symlinks[name] ? symlinks[name] : name;


      result.binaries.push({
        id,
        filename : name,
        parentPath : '/'+path.join('collection', this.path),
        fcpath : '/'+path.join('collection', this.path, id),
        localpath : path.join(this.root, this.path, name),
        metadata : containerFiles[name+'.ttl'] || null
      });
      if( containerFiles[name+'.ttl'] ) {
        delete containerFiles[name+'.ttl'];
      }
    }

    for( let name in containerFiles ) {
      let fcpath = '/'+path.join('collection', this.path, path.parse(name).name);
      let parentPath = fcpath.split('/');
      let id = parentPath.pop();
      parentPath = parentPath.join('/');

      result.containers.push({
        localpath : path.join(this.root, this.path, name),
        fcpath, id, parentPath
      });
    }

    return result;
  }

  isBinary() {
    return fs.existsSync(this.getBinaryPath());
  }

  getTTLPath() {
    return path.join(this.root, this.path, 'index.ttl');
  }

  getBinaryPath() {
    return path.join(this.root, this.path, 'index.bin');
  }

}

module.exports = IoDir;