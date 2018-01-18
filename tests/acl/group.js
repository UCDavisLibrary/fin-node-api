const assert = require('assert');
const parseLinkHeader = require('parse-link-header');
const API = require('../..');
const jwt = require('../utils/jwt');
const {ADMIN, ALICE, BOB} = jwt.createUsers();
const containerUtils = require('../utils/containerUtils');


API.setConfig({host: HOST});

describe('ACL - Group Tests', function() {
  
  it('should let you prepare for group testing', async function(){
    API.setConfig({jwt: ADMIN});
    try {
      await containerUtils.createBasicSetup();
      await API.acl.create({path: containerUtils.TEST_CONTAINER_ROOT});
    } catch(e) {
      assert.equal(e, null);
    }
  });

  it('should let you create a group', async function(){
    API.setConfig({jwt: ADMIN});

    let {response} = await API.acl.addGroup({
      path : containerUtils.TEST_CONTAINER_ROOT+'/.acl',
      name : 'foo',
      agents : ['alice', 'bob']
    });

    assert.equal(response.statusCode, 201);
  });

  it('should let you add a group to acl', async function(){
    API.setConfig({jwt: ADMIN});

    let {response} = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT+'/child1',
      agent : containerUtils.TEST_CONTAINER_ROOT+'/.acl/foo',
      type : 'group',
      modes : [API.acl.MODES.READ, API.acl.MODES.WRITE]
    });
    assert.equal(response.statusCode, 201);
  });

  it('should let bob access via group premissions', async function(){

    API.setConfig({jwt: BOB});
    
    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.response.statusCode, 200);

    response = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child2'});
    assert.equal(response.response.statusCode, 403);

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