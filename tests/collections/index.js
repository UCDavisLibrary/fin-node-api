const assert = require('assert');
const API = require('../..');
const jwt = require('../utils/jwt');
const {ADMIN, ALICE, BOB} = jwt.createUsers();
const containerUtils = require('../utils/containerUtils');
const fs = require('fs');
const path = require('path');

API.setConfig({host: HOST});

describe('Collection Tests', function() {
  
  it('Should let you prepare for tests', async function(){
    API.setConfig({jwt: ADMIN});
    await containerUtils.cleanTests(); // clean any tests
    
    let response = await containerUtils.createContainer(); // create root testing container
    assert.equal(response.error, null);
    
    API.collection.testing(); // change the root url
  });

  it('Should let you create a collection', async function(){
    let response = await API.collection.create({
      id : 'test-collection',
      file : path.join(__dirname, 'collection.ttl')
    });
    assert.equal(response.error, null);

    assert.deepEqual(response.data, { 
      path: '/integration-test/collection/test-collection',
      groups: '/integration-test/collection/test-collection/groups',
      acl: '/integration-test/collection/test-collection/.acl' 
    });
  });

  it('Should let you create a collection relation', async function(){
    let response = await API.collection.createRelationContainer({
      id : 'items',
      collectionId : 'test-collection',
      type : 'part'
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 201);
  });

  it('Should let you create a collection member', async function(){
    let response = await API.collection.addItem({
      id : 'space',
      collectionId : 'test-collection',
      parentPath : 'items',
      fsPath : path.join(__dirname, 'space')
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 201);
  });

  it('Should let you create a media relation', async function(){
    let response = await API.collection.createRelationContainer({
      id : 'media',
      membershipResource : 'items/space',
      collectionId : 'test-collection',
      type : 'media'
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 201);
  });

  it('Should let you add main image to media relation', async function(){
    let response = await API.collection.addItem({
      id : 'cover-art',
      collectionId : 'test-collection',
      parentPath : 'items/space/media',
      fsPath : path.join(__dirname, 'space'),
      data : 'media/earthrise.jpg'
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });


  it('Should let you add images to media relation', async function(){
    let response = await API.collection.addItem({
      id : 'images/rings',
      collectionId : 'test-collection',
      parentPath : 'items/space/media',
      fsPath : path.join(__dirname, 'space', 'media', 'images'),
      data : 'rings.jpg',
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 201);

    response = await API.collection.addItem({
      id : 'images/PIA21340',
      collectionId : 'test-collection',
      parentPath : 'items/space/media',
      fsPath : path.join(__dirname, 'space', 'media', 'images'),
      data : 'PIA21340.png',
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 201);
  });


  it('Should let you delete a collection member', async function(){
    let response = await API.collection.deleteMember({
      id : 'earth-rise',
      collectionId : 'test-collection'
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });

  it('Should let you delete a collection', async function(){
    let response = await API.collection.delete({
      id : 'test-collection'
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });

  it('Should let you remove collection integration test containers', async function(){
    let response = await containerUtils.cleanTests();
    assert.equal(response.error, null);
  });


});