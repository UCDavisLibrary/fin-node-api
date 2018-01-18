const assert = require('assert');
const API = require('../..');
const jwt = require('../utils/jwt');
const {ADMIN, ALICE, BOB} = jwt.createUsers();
const containerUtils = require('../utils/containerUtils');


API.setConfig({host: HOST});

/**
 * This test is about discovering oddness in read/write propagation
 */
describe('ACL - Multiple ACL test', function() {
  
  it('should let you prepare for testing', async function(){
    API.setConfig({jwt: ADMIN});
    await containerUtils.createBasicSetup();
    await API.acl.create({path: containerUtils.TEST_CONTAINER_ROOT});
  });

  it('should allow you give alice read access to child1 and let alice access', async function(){
    API.setConfig({jwt: ADMIN});

    let response = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT+'/child1',
      agent : 'alice',
      modes : [API.acl.MODES.READ]
    });
    assert.equal(response.response.statusCode, 201);

    API.setConfig({jwt: ALICE});
    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.response.statusCode, 200);
  });


  it('should allow you to make a secondary ACL', async function(){
    API.setConfig({jwt: ADMIN});

    let {response} = await API.acl.create({
      path: containerUtils.TEST_CONTAINER_ROOT,
      aclContainerName : '.acl2',
      label: 'Secondary ACL'
    });

    assert.equal(response.statusCode, 204);
  });


  it('it still allows alice access but shows container ACL as secondary ACL', async function(){
    API.setConfig({jwt: ALICE});

    let response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.response.statusCode, 200);

    response = await API.acl.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.deepEqual(response, [ '/integration-test/.acl', '/integration-test/.acl2' ]);
  });

  it('BUG should allow you give bob read access to child1 via acl2 but does not allow him to read', async function(){
    API.setConfig({jwt: ADMIN});

    let response = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT+'/child1',
      agent : 'bob',
      modes : [API.acl.MODES.READ],
      aclPath : containerUtils.TEST_CONTAINER_ROOT+'/.acl2'
    });
    assert.equal(response.response.statusCode, 201);

    API.setConfig({jwt: BOB});
    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.response.statusCode, 403);
  });

  it('BUG should allow you give bob read access to child1 via acl2 but does not allow him to read', async function(){
    API.setConfig({jwt: ADMIN});

    let response = await API.delete({
      path: containerUtils.TEST_CONTAINER_ROOT+'/.acl',
      permanent : true
    });
    assert.equal(response.response.statusCode, 204);

    API.setConfig({jwt: BOB});
    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.response.statusCode, 200);
  });

  it('Should cleanup for fresh test', async function() {
    API.setConfig({jwt: ADMIN});
    await containerUtils.createBasicSetup();
    await API.acl.create({path: containerUtils.TEST_CONTAINER_ROOT});
  });

  it('Should make a second nested acl at child4, allow bob to read child1 and not child5', async function() {
    API.setConfig({jwt: ADMIN});
    let response = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT,
      agent : 'bob',
      modes : [API.acl.MODES.READ],
    });
    assert.equal(response.response.statusCode, 201);

    await API.acl.create({path: containerUtils.TEST_CONTAINER_ROOT+'/child1/child4'});
    assert.equal(response.response.statusCode, 201);

    API.setConfig({jwt: BOB});
    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.response.statusCode, 200);

    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1/child4/child5'});
    assert.equal(response.response.statusCode, 403);
  });

});