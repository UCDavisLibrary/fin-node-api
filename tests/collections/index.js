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
    assert.equal(response.last.statusCode, 204);
  });

  it('Should let you create a collection member', async function(){
    let response = await API.collection.addResource({
      id : 'space',
      collectionId : 'test-collection',
      parentPath : 'items',
      fsPath : path.join(__dirname, 'space')
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });

  it('Should let you create a media relation', async function(){
    let response = await API.collection.createRelationContainer({
      id : 'media',
      membershipResource : 'items/space',
      collectionId : 'test-collection',
      type : 'media'
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });

  it('Should let you add main image to media relation', async function(){
    let response = await API.collection.addResource({
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
    let response = await API.collection.addResource({
      id : 'images/rings',
      collectionId : 'test-collection',
      parentPath : 'items/space/media',
      fsPath : path.join(__dirname, 'space', 'media', 'images'),
      data : 'rings.jpg',
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);

    response = await API.collection.addResource({
      id : 'images/PIA21340',
      collectionId : 'test-collection',
      parentPath : 'items/space/media',
      fsPath : path.join(__dirname, 'space', 'media', 'images'),
      data : 'PIA21340.png',
    });

    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });


  it('should let you set a property relation of exampleOfWork/workExample', async function() {
    let response = await API.collection.createRelationProperties({
      collectionId : 'test-collection',
      dstPath : 'items/space/media/images/PIA21340',
      dstProperty : 'http://schema.org/workExample',
      srcProperty : 'http://schema.org/exampleOfWork'
    });

    let httpStack = response.httpStack.map(r => r.statusCode);
    assert.deepEqual(httpStack, [200, 200, 201, 200, 204, 200, 204, 204]);

    response = await API.get({
      path : '/integration-test/collection/test-collection',
      headers : {
        Accept : API.RDF_FORMATS.JSON_LD
      }
    });
    let json = JSON.parse(response.last.body)[0];
    assert.equal(json['http://schema.org/exampleOfWork'][0]['@id'].indexOf('items/space/media/images/PIA21340') > -1, true);

    response = await API.get({
      path : '/integration-test/collection/test-collection/items/space/media/images/PIA21340/fcr:metadata',
      headers : {
        Accept : API.RDF_FORMATS.JSON_LD
      }
    });
    json = JSON.parse(response.last.body)[0];
    assert.equal(json['http://schema.org/workExample'][0]['@id'].indexOf('integration-test/collection/test-collection') > -1, true);
  });

  it('Should let you delete a collection member', async function(){
    let response = await API.collection.deleteResource({
      id : 'items/space/media/images/PIA21340',
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