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

    let children = await fs.readdir(path.join(this.root, this.path));
    for( let child of children ) {
      let p = path.join(this.root, this.path, child);
      if( !fs.statSync(p).isDirectory() ) continue;

      child = new IoDir(this.root, path.join(this.path, child));
      this.children.push(child);
      await child.crawl();
    }

    return this.children;
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