const fs = require('fs');
const assert = require('assert');
const API = require('../..');
const path = require('path');
const jwt = require('./jwt');

const USERS = jwt.createUsers();

let count = 0;
let basicChild = fs.readFileSync(path.join(__dirname, '..', 'data', 'child-container.ttl'), 'utf-8');
let directChild = fs.readFileSync(path.join(__dirname, '..', 'data', 'direct-container.ttl'), 'utf-8');

const TEST_CONTAINER_ROOT = '/integration-test'

module.exports = {

  TEST_CONTAINER_ROOT : TEST_CONTAINER_ROOT,

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
  //     -> child4
  //       -> child5
  //         -> child6 
  //   -> child2
  //     -> child3

  createBasicSetup : async function() {
    API.setConfig({jwt: USERS.ADMIN});

    let response = await API.get({path: TEST_CONTAINER_ROOT});
    if( response.response.statusCode === 200 ) {
      await this.cleanTests();
    }

    // create parent/child containers for setting access
    response = await this.createContainer();
    assert.equal(response.response.statusCode, 201);
  
    response = await this.createContainer('child1');
    assert.equal(response.response.statusCode, 201);
  
    // direct container
    // response = await this.createContainer('/child2', '/integration-test');
    response = await this.createContainer('child2');
    assert.equal(response.response.statusCode, 201);
  
    response = await this.createContainer('child2/child3');
    assert.equal(response.response.statusCode, 201);

    response = await this.createContainer('child1/child4');
    assert.equal(response.response.statusCode, 201);

    response = await this.createContainer('child1/child4/child5');
    assert.equal(response.response.statusCode, 201);

    response = await this.createContainer('child1/child4/child5/child6');
    assert.equal(response.response.statusCode, 201);
  },

  cleanTests: async function() {
    API.setConfig({jwt: USERS.ADMIN});

    // remove integration test containers
    response = await API.delete({
      path : TEST_CONTAINER_ROOT,
      host : HOST
    });
    assert.equal(response.response.statusCode, 204);
  
    response = await API.delete({
      path : TEST_CONTAINER_ROOT + '/fcr:tombstone',
      host : HOST
    });
    assert.equal(response.response.statusCode, 204);

    count = 0;
  },

  createContainer: function(path = '', memberOf = '') {
    return API.post({
      path : path ? TEST_CONTAINER_ROOT : '/',
      headers : {
        'Content-Type' : API.RDF_FORMATS.TURTLE,
        Slug : path ? path : TEST_CONTAINER_ROOT.replace(/^\//, '')
      },
      content : path ? this.getChild(memberOf) : this.getRoot()
    });
  },

  updateTest : function(path, user) {
    let sparql = `PREFIX dc: <http://purl.org/dc/elements/1.1/>

    DELETE {}
    INSERT { 
      <> dc:description "Write allowed by ${user}"
    }
    WHERE { }`

    return API.patch({
      path : path,
      content : sparql
    });
  }
}
