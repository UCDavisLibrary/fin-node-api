const assert = require('assert');
const API = require('../..');
const jwt = require('../utils/jwt');
const {ADMIN, ALICE, BOB} = jwt.createUsers();
const containerUtils = require('../utils/containerUtils');

API.setConfig({host: HOST});

describe('ACL - Group Tests', function() {
  
  it('should let you prepare for group testing', async function(){
    API.setConfig({jwt: ADMIN});
    await containerUtils.createBasicSetup();

    let response = await API.acl.create({path: containerUtils.TEST_CONTAINER_ROOT});
    assert.equal(response.error, null);
  });

  it('should let you create a group', async function(){
    API.setConfig({jwt: ADMIN});

    let response = await API.acl.addGroup({
      path : containerUtils.TEST_CONTAINER_ROOT+'/.acl',
      name : 'foo',
      agents : ['bob']
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 201);
  });

  it('should let you add a group to acl', async function(){
    API.setConfig({jwt: ADMIN});

    let response = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT+'/child1',
      agent : containerUtils.TEST_CONTAINER_ROOT+'/.acl/foo',
      type : 'group',
      modes : [API.acl.MODES.READ, API.acl.MODES.WRITE]
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 201);
  });

  it('should let bob access via group permissions', async function(){

    API.setConfig({jwt: BOB});
    
    var response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 200);

    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child2'});
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 403);

  });

  it('should let you add alice to group', async function(){
    API.setConfig({jwt: ADMIN});

    let response = await API.acl.modifyGroupAgents({
      path : containerUtils.TEST_CONTAINER_ROOT+'/.acl/foo',
      addAgents : ['alice']
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });

  it('should let alice access via group permissions', async function(){
    API.setConfig({jwt: ALICE});
    
    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 200);

    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child2'});
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 403);
  });

  it('should let you remove alice from group', async function(){
    API.setConfig({jwt: ADMIN});

    let response = await API.acl.modifyGroupAgents({
      path : containerUtils.TEST_CONTAINER_ROOT+'/.acl/foo',
      removeAgents : 'alice'
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });

  it('should not let alice access', async function(){
    API.setConfig({jwt: ALICE});
    
    var response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 403);

    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child2'});
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 403);
  });

  it('Should let you remove acl integration test containers', async function(){
    let response = await containerUtils.cleanTests();
    assert.equal(response.error, null);
  });

});