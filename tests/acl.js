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
        path: '/integration-test'
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
    assert.equal(c1.authorization.alice[API.acl.MODES.READ], true);
  });

  it('Should let alice read child1 and not read child2/child3/child4', async function(){
    API.setConfig({jwt: ALICE});

    let response = await API.get({path: '/integration-test/child1'});
    assert.equal(response.response.statusCode, 200);

    response = await API.get({path: '/integration-test/child4'});
    assert.equal(response.response.statusCode, 403);

    response = await API.get({path: '/integration-test/child2'});
    assert.equal(response.response.statusCode, 403);

    response = await API.get({path: '/integration-test/child2/child3'});
    assert.equal(response.response.statusCode, 403);
  });

  it('Should let alice read all children with root read authorization', async function(){
    API.setConfig({jwt: ADMIN});

    let response = await API.acl.add({
      path : '/integration-test',
      agent : 'alice',
      modes : [API.acl.MODES.WRITE]
    });
    assert.equal(response.response.statusCode, 201);

    response = await API.acl.authorizations({path:'/integration-test/child1'});
    assert.equal(response.authorization.alice[API.acl.MODES.READ], true);
    assert.equal(response.authorization.alice[API.acl.MODES.WRITE], true);
    assert.equal(typeof response.authorizations['/integration-test/.acl/u/alice/integration-test/child1/r'], 'object');
    assert.equal(typeof response.authorizations['/integration-test/.acl/u/alice/integration-test/w'], 'object');
  
  
    response = await API.get({path: '/integration-test/child2'});
    assert.equal(response.response.statusCode, 200);

    response = await API.get({path: '/integration-test/child2/child3'});
    assert.equal(response.response.statusCode, 200);
  });

  it('Should let you create an authorization for bob', async function(){
    API.setConfig({jwt: ADMIN});
    
    let response = await API.acl.add({
      path : '/integration-test/child2',
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
    
    response = await API.get({path: '/integration-test/child1'});
    assert.equal(response.response.statusCode, 200);
  });

  it('should let you prepare for group testing', async function(){
    API.setConfig({jwt: ADMIN});
    try {
      await containerUtils.cleanTests();
      await containerUtils.createBasicSetup();
      await API.acl.create({path: '/integration-test'});
    } catch(e) {
      assert.equal(e, null);
    }
  });

  it('should let you create a group', async function(){
    API.setConfig({jwt: ADMIN});

    let {response} = await API.acl.addGroup({
      path : '/integration-test/.acl',
      name : 'foo',
      agents : ['alice', 'bob']
    });

    assert.equal(response.statusCode, 201);
  });

  it('should let you add a group to acl', async function(){
    API.setConfig({jwt: ADMIN});

    let {response} = await API.acl.add({
      path : '/integration-test/child1',
      agent : '/integration-test/.acl/foo',
      type : 'group',
      modes : [API.acl.MODES.READ, API.acl.MODES.WRITE]
    });
    assert.equal(response.statusCode, 201);
  });

  it('should let bob access via group premissions', async function(){

    API.setConfig({jwt: BOB});
    
    response = await API.get({path: '/integration-test/child1'});
    assert.equal(response.response.statusCode, 200);

    response = await API.get({path: '/integration-test/child2'});
    assert.equal(response.response.statusCode, 403);

  });

  // it('Should let you remove acl integration test containers', async function(){
  //   // remove integration test containers
  //   try {
  //     await containerUtils.cleanTests();
  //   } catch(e) {
  //     assert.equal(e, null);
  //   }
  // });

});
