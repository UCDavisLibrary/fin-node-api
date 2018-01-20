const fs = require('fs');
const path = require('path');

/**
* @method loadTemplate
* @description load a template from the templates dir.  if vars are passed
* replace {{}} syntax w/ vars
* 
* @param {String} name name of template to load
* @param {Object} vars Optional.  variables to replace
* 
* @returns {String}
*/
module.exports = function(name, vars = {}) {
  let template = fs.readFileSync(path.join(__dirname, name), 'utf-8');
  for( let key in vars ) {
    template = template.replace(new RegExp(`{{${key}}}`, 'g'), vars[key]);
  }
  return template;
}