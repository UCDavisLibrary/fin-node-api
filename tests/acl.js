const assert = require('assert');
const parseLinkHeader = require('parse-link-header');
const API = require('..');
const jwt = require('./utils/jwt');

const HOST = 'http://localhost:3000';
const ADMIN = jwt.mint('integration-test-admin', true);
const ALICE = jwt.mint('alice');
const BOB = jwt.mint('bob');
const USERS = {ADMIN, ALICE, BOB};

const containerUtils = require('./utils/containerUtils')(HOST, USERS);

API.setConfig({host: HOST});

describe('ACL', function() {
  
  
  it('Should let you create ACL container', async function(){
    // create parent/child containers for setting access
    await containerUtils.createBasicSetup();

    try {
      let response = await API.acl.create({
        containerPath: '/integration-test'
      });

      assert.equal(response.response.statusCode, 204);
    } catch(e) {
      assert.equal(e, null);
    }
  });

  it('Should return the current Authorization definition for child', async function(){
    let response = await API.acl.get({path: '/integration-test/child1'});
    assert.equal(response, '/integration-test/.acl');
  });

  it('Should let you get all ACL authorizations', async function() {
    // let response = await API.acl.allACLAuthorizations({path:'/.acl'});
    // console.log(response);

    response = await API.acl.authorizations({path:'/user'});
    console.log(response);
  });

  it('Should let you remove acl integration test containers', async function(){
    // remove integration test containers
    try {
      await containerUtils.cleanTests();
    } catch(e) {
      assert.equal(e, null);
    }
  });

});
