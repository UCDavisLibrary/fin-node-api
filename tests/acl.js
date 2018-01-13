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
    this.timeout(5000);

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

  it('Should return the current ACL for child', async function(){
    let response = await API.acl.get({path: '/integration-test/child1'});
    assert.equal(response, '/integration-test/.acl');
  });

  it('Should let you create an authorization for alice', async function(){
    let response = await API.acl.add({
      path : '/integration-test/child1',
      agent : 'alice',
      modes : [API.acl.MODES.READ]
    });
    assert.equal(response.response.statusCode, 201);
  });

  it('Should let you get all ACL authorizations, have new alice read auth', async function() {
    let response = await API.acl.allACLAuthorizations({path:'/integration-test/.acl'});

    let c1 = response['/integration-test/child1'];
    assert.equal(typeof c1, 'object');
    // assert.equal(c1.__defs__.indexOf('/integration-test/.acl/u-alice-r') > -1, true);
    assert.equal(c1.alice[API.acl.MODES.READ], true);
  });

  it('Should let alice read child1 and not read child2/child3', async function(){
    API.setConfig({jwt: ALICE});

    let response = await API.get({path: '/integration-test/child1'});
    assert.equal(response.response.statusCode, 200);

    response = await API.get({path: '/integration-test/child2'});
    assert.equal(response.response.statusCode, 403);

    response = await API.get({path: '/integration-test/child2/child3'});
    assert.equal(response.response.statusCode, 403);
  });

  it('Should let you create an authorization for bob', async function(){
    API.setConfig({jwt: ADMIN});
    
    // let response = await API.acl.add({
    //   path : '/integration-test/child2',
    //   agent : 'bob',
    //   modes : [API.acl.MODES.READ, API.acl.MODES.WRITE]
    // });

    // assert.equal(response.response.statusCode, 201);

    // response = await API.acl.authorizations({path: '/integration-test/child2'});
    // assert.equal(response.definedAt, '/integration-test/child2');
    // // assert.equal(response.definedBy.indexOf('/integration-test/.acl/u-bob-rw') > -1, true);
    // assert.equal(response.authorizations.bob[API.acl.MODES.WRITE], true);

    response = await API.acl.authorizations({path: '/integration-test/child2/child3'});
    assert.equal(response.definedAt, '/integration-test/child2');

    response = await API.acl.add({
      path : '/integration-test',
      agent : 'bob',
      modes : [API.acl.MODES.READ, API.acl.MODES.WRITE]
    });
    assert.equal(response.response.statusCode, 201);

    response = await API.acl.add({
      path : '/integration-test/child1',
      agent : 'bob',
      modes : [API.acl.MODES.READ, API.acl.MODES.WRITE]
    });
    assert.equal(response.response.statusCode, 201);
  });

  it('Should let bob read child 2 & 3 and not 1', async function(){
    API.setConfig({jwt: BOB});
    
    let response = await API.get({path : '/integration-test/child2'});
    assert.equal(response.response.statusCode, 200);

    response = await API.get({path : '/integration-test/child2/child3'});
    assert.equal(response.response.statusCode, 200);

    response = await API.get({path: '/integration-test/child1'});
    assert.equal(response.response.statusCode, 200);

    response = await API.get({path: '/integration-test/child1/child4'});
    assert.equal(response.response.statusCode, 200);
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
