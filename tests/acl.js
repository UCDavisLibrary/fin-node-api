const assert = require('assert');
const API = require('..');
const containerUtils = require('./utils/getContainer');
const jwt = require('./utils/jwt');

const HOST = 'http://localhost:3000';
const ADMIN = jwt.mint('unit-test-admin', true);
const USER_ALICE = jwt.mint('alice');
const BOB_ALICE = jwt.mint('bob');

API.setConfig({host: HOST});

describe('ACL', function() {
  
  it('Should let you create parent/child containers for ACL testing', async function(){
    API.setConfig({jwt: ADMIN});

    // create parent/child containers for setting access
    let response = await API.post({
      path : '/',
      headers : {
        'Content-Type' : API.RDF_FORMATS.TURTLE,
        Slug : 'unit-test'
      },
      content : containerUtils.getRoot()
    });
    assert.equal(response.response.statusCode, 201);

    response = await API.post({
      path : '/',
      headers : {
        'Content-Type' : API.RDF_FORMATS.TURTLE,
        Slug : 'unit-test/child1'
      },
      content : containerUtils.getChild()
    });
    assert.equal(response.response.statusCode, 201);
  });

  it('should return -1 when the value is not present', function() {
    assert.equal([1,2,3].indexOf(4), -1);
  });

  it('Should let you remove acl unit test containers', async function(){
    API.setConfig({jwt: ADMIN});

    // create parent/child containers for setting access
    response = await API.delete({
      path : '/unit-test',
      host : HOST
    });
    assert.equal(response.response.statusCode, 204);

    response = await API.delete({
      path : '/unit-test/fcr:tombstone',
      host : HOST
    });
    assert.equal(response.response.statusCode, 204);
  });
  
});