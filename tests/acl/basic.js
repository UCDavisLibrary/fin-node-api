const assert = require('assert');
const API = require('../..');
const jwt = require('../utils/jwt');
const {ADMIN, ALICE, BOB} = jwt.createUsers();
const containerUtils = require('../utils/containerUtils');

API.setConfig({host: HOST});

describe('ACL - Basic Tests', function() {
  
  it('Should let you create ACL container', async function(){
    this.timeout(5000);

    // create parent/child containers for setting access
    await containerUtils.createBasicSetup();

    try {
      let response = await API.acl.create({
        path: containerUtils.TEST_CONTAINER_ROOT
      });

      assert.equal(response.response.statusCode, 201);
    } catch(e) {
      assert.equal(e, null);
    }
  });

  it('Should return the current ACL for child', async function(){
    let response = await API.acl.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response, containerUtils.TEST_CONTAINER_ROOT+'/.acl');
  });

  it('Should let you create an authorization for alice', async function(){
    let response = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT+'/child2',
      agent : 'alice',
      modes : [API.acl.MODES.READ]
    });
    assert.equal(response.response.statusCode, 201);
  });

  it('Should let you get all ACL authorizations, have new alice read auth', async function() {
    let response = await API.acl.allACLAuthorizations({path:containerUtils.TEST_CONTAINER_ROOT+'/.acl'});

    let c1 = response[containerUtils.TEST_CONTAINER_ROOT+'/child2'];
    assert.equal(typeof c1, 'object');
    assert.equal(c1.authorization.alice[API.acl.MODES.READ], true);
  });

  it('Should let alice read child2 and not read child1/child3/child4', async function(){
    API.setConfig({jwt: ALICE});

    let response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child2'});
    assert.equal(response.response.statusCode, 200);

    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.response.statusCode, 403);

    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1/child4'});
    assert.equal(response.response.statusCode, 403);

    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child2/child3'});
    assert.equal(response.response.statusCode, 403);
  });

  it('Should let alice read all children with root read authorization', async function(){
    API.setConfig({jwt: ADMIN});

    let response = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT,
      agent : 'alice',
      modes : [API.acl.MODES.READ]
    });
    assert.equal(response.response.statusCode, 201);

    response = await API.acl.authorizations({path: containerUtils.TEST_CONTAINER_ROOT+'/child2'});
    assert.equal(response.authorization.alice[API.acl.MODES.READ], true);
    assert.equal(response.authorization.alice[API.acl.MODES.WRITE], undefined);
    assert.equal(typeof response.authorizations[containerUtils.TEST_CONTAINER_ROOT+'/.acl/u/alice/integration-test/child2/r'], 'object');
    assert.equal(typeof response.authorizations[containerUtils.TEST_CONTAINER_ROOT+'/.acl/u/alice/integration-test/r'], 'object');
    assert.deepEqual(response.definedAt, [containerUtils.TEST_CONTAINER_ROOT+'/.acl']);
  
    API.setConfig({jwt: ALICE});

    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child2'});
    assert.equal(response.response.statusCode, 200);

    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child2/child3'});
    assert.equal(response.response.statusCode, 200);


  });

  it('Should let you create an authorization for bob', async function(){
    API.setConfig({jwt: ADMIN});
    
    let response = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT+'/child2',
      agent : 'bob',
      modes : [API.acl.MODES.READ, API.acl.MODES.WRITE]
    });
    assert.equal(response.response.statusCode, 201);

    response = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT+'/child1',
      agent : 'bob',
      modes : [API.acl.MODES.READ, API.acl.MODES.WRITE]
    });
    assert.equal(response.response.statusCode, 201);

  });

  it('Should let bob read child 2 & 3 and not 1', async function(){
    API.setConfig({jwt: BOB});
    
    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.response.statusCode, 200);
  });

  it('Should let you remove acl integration test containers', async function(){
    await containerUtils.cleanTests();
  });

});
