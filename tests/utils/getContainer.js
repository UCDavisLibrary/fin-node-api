const fs = require('fs');
const path = require('path');

let count = 0;
let child = fs.readFileSync(path.join(__dirname, '..', 'data', 'child-container.ttl'), 'utf-8');

module.exports = {
  getChild : function() {
    count++;
    return child.replace(/{{childnum}}/g, count);
  },
  getRoot : function() {
    return fs.readFileSync(path.join(__dirname, '..', 'data', 'root-container.ttl'), 'utf-8')
  }
}

