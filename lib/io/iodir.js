const fs = require('fs-extra');
const path = require('path');
const ignore = require('ignore');

const IGNORE_FILE = '.finignore';
// https://www.npmjs.com/package/ignore

class IoDir {

  constructor(fsroot, fsrel, fcpath, config={}) {
    this.fsroot = fsroot;
    this.fsrel = fsrel;
    this.fcpath = fcpath;
    this.fsfull = path.join(this.fsroot, this.fsrel);

    this.config = config;
    if( !this.config.ignore ) {
      this.config.ignore = [];
    }

    let parts = fcpath.split('/');
    this.id = parts.pop();

    this.parentFcPath = parts.join('/');
  }

  async crawl() {
    if( this.children ) return this.children;
    this.children = [];
    this.files = [];

    this.hasMetadata = false;
    if( fs.existsSync(path.resolve(this.fsfull, '..', this.id+'.ttl')) ) {
      this.hasMetadata = true;
    }

    let children = await fs.readdir(this.fsfull);
    for( let child of children ) {
      let p = path.join(this.fsfull, child);
      if( !fs.statSync(p).isDirectory() ) {
        this.files.push(child);
        continue;
      }

      child = new IoDir(
        this.fsroot, 
        path.join(this.fsrel, child),  
        path.join(this.fcpath, child),
        this.config
      );

      this.children.push(child);
      await child.crawl();
    }

    return this.children;
  }

  parseIgnore(file, fsfull) {
    let ig = {
      rules : ignore(),
      fsfull : fsfull || this.fsfull
    };
 
    fs.readFileSync(file, 'utf-8')
      .split(/(\r|\n)/)
      .map(line => line.trim())
      .filter(line => line ? true : false)
      .forEach(line => ig.rules.add(line));
      
    this.config.ignore.push(ig);
  }

  ignore(file) {
    for( let ignore of this.config.ignore ) {
      let relpath = file
        .replace(new RegExp('^'+ignore.fsfull), '')
        .replace(/^\//, '');

      if( ignore.rules.ignores(relpath) ) {
        return true;
      }
    }
    return false;
  }

  async getFiles() {
    let symlinks = {};
    let binaryFiles = {};
    let containerFiles = {};

    for( let child of this.files ) {
      if( child === IGNORE_FILE ) {
        this.parseIgnore(path.join(this.fsfull, child));
        break;
      }
    }

    for( let child of this.files ) {
      if( this.ignore(path.join(this.fsfull, child)) ) continue;
      if( child === '.fin' ) continue;

      let childFsPath = path.join(this.fsfull, child);
      let info = fs.lstatSync(childFsPath);

      if( info.isSymbolicLink() ) {
        let pointer = fs.realpathSync(childFsPath).split('/').pop();
        symlinks[pointer] = child;
      } else if( path.parse(child).ext !== '.ttl' ) {
        binaryFiles[child] = childFsPath;
      } else {
        containerFiles[child] = childFsPath;
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
        parentPath : this.fcpath,
        fcpath : path.join(this.fcpath, id),
        localpath : path.join(this.fsfull, name),
        metadata : containerFiles[name+'.ttl'] || null
      });
      if( containerFiles[name+'.ttl'] ) {
        delete containerFiles[name+'.ttl'];
      }
    }

    for( let name in containerFiles ) {
      let fcpath = path.join(this.fcpath, path.parse(name).name);
      let parentFcPath = fcpath.split('/');
      let id = parentFcPath.pop();
      parentFcPath = parentFcPath.join('/');

      result.containers.push({
        localpath : path.join(this.fsfull, name),
        fcpath, id, 
        parentPath : parentFcPath
      });
    }

    return result;
  }

  getTTLPath() {
    return path.join(this.root, this.path, 'index.ttl');
  }

  getBinaryPath() {
    return path.join(this.root, this.path, 'index.bin');
  }

}

module.exports = IoDir;