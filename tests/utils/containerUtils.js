const fs = require('fs');
const assert = require('assert');
const API = require('../..');
const path = require('path');

let count = 0;
let basicChild = fs.readFileSync(path.join(__dirname, '..', 'data', 'child-container.ttl'), 'utf-8');
let directChild = fs.readFileSync(path.join(__dirname, '..', 'data', 'direct-container.ttl'), 'utf-8');


module.exports = (HOST, USERS) => {
  return {
    getChild : function(memberOf) {
      count++;

      if( memberOf ) {
        return directChild.replace(/{{childnum}}/g, count)
                          .replace(/{{memberOf}}/, `/fcrepo/rest${memberOf}`);
      } else {
        return basicChild.replace(/{{childnum}}/g, count);
      }
    },

    getRoot : function() {
      return fs.readFileSync(path.join(__dirname, '..', 'data', 'root-container.ttl'), 'utf-8')
    },

    // create a basic setup 
    //  root
    //   -> child1
    //   -> child2
    //     -> child3
    createBasicSetup : async function() {
      API.setConfig({jwt: USERS.ADMIN});

      // create parent/child containers for setting access
      let response = await this.createContainer();
      assert.equal(response.response.statusCode, 201);
    
      response = await this.createContainer('/child1');
      assert.equal(response.response.statusCode, 201);
    
      // direct container
      response = await this.createContainer('/child2', '/integration-test');
      assert.equal(response.response.statusCode, 201);
    
      response = await this.createContainer('/child2/child3');
      assert.equal(response.response.statusCode, 201);

      response = await this.createContainer('/child1/child4');
      assert.equal(response.response.statusCode, 201);
    },

    cleanTests: async function() {
      API.setConfig({jwt: USERS.ADMIN});

      // remove integration test containers
      response = await API.delete({
        path : '/integration-test',
        host : HOST
      });
      assert.equal(response.response.statusCode, 204);
    
      response = await API.delete({
        path : '/integration-test/fcr:tombstone',
        host : HOST
      });
      assert.equal(response.response.statusCode, 204);
    },

    createContainer: function(path = '', memberOf = '') {
      return API.post({
        path : '/',
        headers : {
          'Content-Type' : API.RDF_FORMATS.TURTLE,
          Slug : 'integration-test' + path
        },
        content : path ? this.getChild(memberOf) : this.getRoot()
      });
    }
  }
}
