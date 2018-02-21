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
    await containerUtils.createContainer(); // create root testing container
    API.collection.testing(); // change the root url
  });

  it('Should let you create a collection', async function(){
    let response = await API.collection.create({
      id : 'test-collection',
      file : path.join(__dirname, 'collection.ttl')
    });

    assert.deepEqual(response, { 
      path: '/integration-test/collection/test-collection',
      members: '/integration-test/collection/test-collection/members',
      groups: '/integration-test/collection/test-collection/groups',
      acl: '/integration-test/collection/test-collection/.acl' 
    });
  });

  it('Should let you create a collection member', async function(){
    let response = await API.collection.addMember({
      id : 'earth-rise',
      collectionId : 'test-collection',
      file : path.join(__dirname, 'earthrise.jpg')
    });

    assert.equal(response.statusCode, 201);
  });

  it('Should let you delete a collection member', async function(){
    let {response} = await API.collection.deleteMember({
      id : 'earth-rise',
      collectionId : 'test-collection'
    });

    assert.equal(response.statusCode, 204);
  });

  it('Should let you delete a collection', async function(){
    let {response} = await API.collection.delete({
      id : 'test-collection'
    });

    assert.equal(response.statusCode, 204);
  });

  it('Should let you remove collection integration test containers', async function(){
    await containerUtils.cleanTests();
  });


});