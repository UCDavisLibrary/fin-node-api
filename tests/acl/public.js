const assert = require('assert');
const parseLinkHeader = require('parse-link-header');
const API = require('../..');
const jwt = require('../utils/jwt');
const {ADMIN, ALICE, BOB} = jwt.createUsers();
const containerUtils = require('../utils/containerUtils');

const PUBLIC = '';
API.setConfig({host: HOST});

describe('ACL - Public Access Tests', function() {
  
  it('Should let you setup test', async function(){
    API.setConfig({jwt: ADMIN});
    await containerUtils.createBasicSetup();
    await API.acl.create({path: containerUtils.TEST_CONTAINER_ROOT});
  });

  it('Should not let public access root or children', async function(){
    API.setConfig({jwt: PUBLIC});
    
    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT});
    assert.equal(response.statusCode, 403);

    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.statusCode, 403);

    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1/child4'});
    assert.equal(response.statusCode, 403);

    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child2'});
    assert.equal(response.statusCode, 403);
  });

  it('Should let you give public read to child1', async function(){
    API.setConfig({jwt: ADMIN});
    var {response} = await API.acl.add({
      path: containerUtils.TEST_CONTAINER_ROOT+'/child1',
      agent : API.acl.PUBLIC_AGENT,
      modes : [API.acl.MODES.READ]
    });
    assert.equal(response.statusCode, 201);

    API.setConfig({jwt: PUBLIC});
    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT});
    assert.equal(response.statusCode, 403);

    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.statusCode, 200);

    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1/child4'});
    assert.equal(response.statusCode, 403);

    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child2'});
    assert.equal(response.statusCode, 403);
  });

  it('Should let you give public read to all', async function(){
    API.setConfig({jwt: ADMIN});
    var {response} = await API.acl.add({
      path: containerUtils.TEST_CONTAINER_ROOT,
      agent : API.acl.PUBLIC_AGENT,
      modes : [API.acl.MODES.READ]
    });
    assert.equal(response.statusCode, 201);

    API.setConfig({jwt: PUBLIC});
    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT});
    assert.equal(response.statusCode, 200);

    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1'});
    assert.equal(response.statusCode, 200);

    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child1/child4'});
    assert.equal(response.statusCode, 200);

    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/child2'});
    assert.equal(response.statusCode, 200);

    // JUST FYI :/
    var {response} = await API.get({path: containerUtils.TEST_CONTAINER_ROOT+'/.acl'});
    assert.equal(response.statusCode, 200);
  });

  it('Should let you give public write and add childContainer to child1', async function(){
    API.setConfig({jwt: ADMIN});
    var {response} = await API.acl.add({
      path: containerUtils.TEST_CONTAINER_ROOT+'/child1',
      agent : API.acl.PUBLIC_AGENT,
      modes : [API.acl.MODES.WRITE]
    });
    assert.equal(response.statusCode, 201);

    API.setConfig({jwt: PUBLIC});
    var {response} = await containerUtils.updateTest(containerUtils.TEST_CONTAINER_ROOT+'/child1', 'public');
    assert.equal(response.statusCode, 204);

    var {response} = await API.post({
      path : containerUtils.TEST_CONTAINER_ROOT + '/child1',
      headers : {
        'Content-Type' : API.RDF_FORMATS.TURTLE,
        Slug : 'publicContainer'
      },
      content : containerUtils.getChild()
    });
    assert.equal(response.statusCode, 201);
  });

  it('Public is not allowed to write to newly created child publicContainer', async function(){
    API.setConfig({jwt: PUBLIC});
    var {response} = await containerUtils.updateTest(containerUtils.TEST_CONTAINER_ROOT+'/child1/publicContainer', 'public');
    assert.equal(response.statusCode, 403);
  });

  it('Should let you remove acl integration test containers', async function(){
    await containerUtils.cleanTests();
  });

});
