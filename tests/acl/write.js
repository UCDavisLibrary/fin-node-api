const assert = require('assert');
const parseLinkHeader = require('parse-link-header');
const API = require('../..');
const jwt = require('../utils/jwt');
const {ADMIN, ALICE, BOB} = jwt.createUsers();
const containerUtils = require('../utils/containerUtils');


API.setConfig({host: HOST});

/**
 * This test is about discovering oddness in read/write propagation
 */
describe('ACL - Write Test', function() {
  
  it('should let you prepare for testing', async function(){
    API.setConfig({jwt: ADMIN});
    await containerUtils.createBasicSetup();
    await API.acl.create({path: containerUtils.TEST_CONTAINER_ROOT});
  });

  it('should allow alice to write to root but not read', async function(){
    API.setConfig({jwt: ADMIN});

    let {response} = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT,
      agent : 'alice',
      modes : [ API.acl.MODES.WRITE]
    });
    assert.equal(response.statusCode, 201);
  });

  it('does not allow alice to update child1', async function(){
    API.setConfig({jwt: ALICE});

    let {response} = await containerUtils.updateTest(containerUtils.TEST_CONTAINER_ROOT+'/child1', 'alice');
    assert.equal(response.statusCode, 403);
  });

  it('does not allow alice to add child to child1', async function(){
    API.setConfig({jwt: ALICE});

    let {response} = await API.post({
      path : containerUtils.TEST_CONTAINER_ROOT + '/child1',
      headers : {
        'Content-Type' : API.RDF_FORMATS.TURTLE,
        Slug : containerUtils.TEST_CONTAINER_ROOT + '/child1/alicesContainer'
      },
      content : containerUtils.getChild()
    });

    assert.equal(response.statusCode, 403);
  });

  it('should allow alice to read/write to root', async function(){
    API.setConfig({jwt: ADMIN});

    let {response} = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT,
      agent : 'alice',
      modes : [API.acl.MODES.READ]
    });
    assert.equal(response.statusCode, 201);
  });

  it('allows alice to update child1', async function(){
    API.setConfig({jwt: ALICE});

    let {response} = await containerUtils.updateTest(containerUtils.TEST_CONTAINER_ROOT+'/child1', 'alice');
    assert.equal(response.statusCode, 204);
  });

  it('allows alice to add child to child1', async function(){
    API.setConfig({jwt: ALICE});

    let {response} = await API.post({
      path : containerUtils.TEST_CONTAINER_ROOT + '/child1',
      headers : {
        'Content-Type' : API.RDF_FORMATS.TURTLE,
        Slug : 'alicesContainer'
      },
      content : containerUtils.getChild()
    });

    assert.equal(response.statusCode, 201);
  });

  it('should cleanup, prepare for more testing', async function(){
    API.setConfig({jwt: ADMIN});
    await containerUtils.createBasicSetup();
    await API.acl.create({path: containerUtils.TEST_CONTAINER_ROOT});
  });

  it('should allow alice to write to child1', async function(){
    API.setConfig({jwt: ADMIN});

    let {response} = await API.acl.add({
      path : containerUtils.TEST_CONTAINER_ROOT+'/child1',
      agent : 'alice',
      modes : [ API.acl.MODES.WRITE, API.acl.MODES.READ ]
    });
    assert.equal(response.statusCode, 201);
  });

  it('does not allow alice to update child1/child4', async function(){
    API.setConfig({jwt: ALICE});

    let {response} = await containerUtils.updateTest(containerUtils.TEST_CONTAINER_ROOT+'/child1/child4', 'alice');
    assert.equal(response.statusCode, 403);
  });

  it('does not  allows alice to add child to child1/child4', async function(){
    API.setConfig({jwt: ALICE});

    let {response} = await API.post({
      path : containerUtils.TEST_CONTAINER_ROOT + '/child1/child4',
      headers : {
        'Content-Type' : API.RDF_FORMATS.TURTLE,
        Slug : 'alicesContainer'
      },
      content : containerUtils.getChild()
    });

    assert.equal(response.statusCode, 403);
  });


  it('allows alice to update child1', async function(){
    API.setConfig({jwt: ALICE});

    let {response} = await containerUtils.updateTest(containerUtils.TEST_CONTAINER_ROOT+'/child1', 'alice');
    assert.equal(response.statusCode, 204);
  });

  it('allows alice to add child to child1', async function(){
    API.setConfig({jwt: ALICE});

    let {response} = await API.post({
      path : containerUtils.TEST_CONTAINER_ROOT + '/child1',
      headers : {
        'Content-Type' : API.RDF_FORMATS.TURTLE,
        Slug : 'alicesContainer'
      },
      content : containerUtils.getChild()
    });

    assert.equal(response.statusCode, 201);
  });

  // it('Should let you remove acl integration test containers', async function(){
  //   await containerUtils.cleanTests();
  // });

});