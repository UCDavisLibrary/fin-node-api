var path = require('path');

class PathUtils {

  makeAbsolutePath(file) {
    file = file.trim();

    if( file.match(/^~/) ) {
      return path.join(this.getUserHome(), file.replace(/^~/, ''));
    } else if( !path.isAbsolute(file) ) {
      return path.join(process.cwd(), file);
    }
    return file;
  }

  makeAbsoluteFcPath(fcpath = '.', basepath = '/') {
    if( !fcpath.match(/^\//) ) {
      return this.joinUrlPath(basepath, fcpath);
    }
    return fcpath;
  }

  joinUrlPath() {
    var newpath = path.join.apply(path, arguments);
    if( path.sep !== '/' ) newpath = newpath.replace(path.sep, '/');
    return newpath;
  }
}

module.exports = new PathUtils();