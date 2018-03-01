const assert = require('assert');
const API = require('..');
const jwt = require('./utils/jwt');
const {ADMIN, ALICE, BOB} = jwt.createUsers();
const containerUtils = require('./utils/containerUtils');

API.setConfig({host: HOST});

describe('JSON-LD Util Tests', function() {
  
  it('Should let you prepare for tests', async function(){
    API.setConfig({jwt: ADMIN});
    await containerUtils.createBasicSetup();
  });

  it('Should let you get the resource container', async function(){
    let response = await API.get({
      headers : {
        Accept : API.RDF_FORMATS.JSON_LD
      },
      path: containerUtils.TEST_CONTAINER_ROOT+'/child1'
    });

    let jsonld = API.jsonld.getByRdfType(response.last.body, API.FEDORA_TYPES.RESOURCE);
    assert.equal(typeof jsonld, 'object');
    assert.equal(jsonld['@type'].indexOf(API.FEDORA_TYPES.RESOURCE) > -1, true);
  });

  it('Should let you patch a container', async function(){
    let response = await API.jsonld.patch({
      insert : {
        'http://purl.org/dc/elements/1.1/creator' : [
          {'@value' : 'bob'},
          {'@value' : 'alice'},
          {'@id' : 'http://library.ucdavis.edu/fin-server#test-creator'}
        ],
        'http://purl.org/dc/elements/1.1/title' : {
          '@value' : 'patched update'
        }
      },
      delete : {
        'http://purl.org/dc/elements/1.1/description' : [{ 
          '@value': 'a child container for tests.  child number 1' 
        }],
        'http://purl.org/dc/elements/1.1/title' : { 
          '@value': 'Basic Child 1'
        }
      },
      path: containerUtils.TEST_CONTAINER_ROOT+'/child1'
    });

    let httpStack = response.httpStack.map(r => r.statusCode);
    assert.deepEqual(httpStack, [200, 204]);

    response = await API.get({
      headers : {
        Accept : API.RDF_FORMATS.JSON_LD
      },
      path: containerUtils.TEST_CONTAINER_ROOT+'/child1'
    });
    let jsonld = API.jsonld.getByRdfType(response.last.body, API.FEDORA_TYPES.RESOURCE);

    assert.equal(jsonld['http://purl.org/dc/elements/1.1/description'], undefined);
    assert.deepEqual(jsonld['http://purl.org/dc/elements/1.1/creator'], [
      {'@id' : 'http://library.ucdavis.edu/fin-server#test-creator'},
      {'@value' : 'alice'},
      {'@value' : 'bob'}
    ]);
    assert.deepEqual(jsonld['http://purl.org/dc/elements/1.1/title'], [
      {'@value' : 'patched update'},
    ]);
  });

  it('Should double check you can delete by id', async function(){
    let response = await API.jsonld.patch({
      delete : {
        'http://purl.org/dc/elements/1.1/creator' : [{ 
          '@id' : 'http://library.ucdavis.edu/fin-server#test-creator'
        }]
      },
      path: containerUtils.TEST_CONTAINER_ROOT+'/child1'
    });

    let httpStack = response.httpStack.map(r => r.statusCode);
    assert.deepEqual(httpStack, [200, 204]);

    response = await API.get({
      headers : {
        Accept : API.RDF_FORMATS.JSON_LD
      },
      path: containerUtils.TEST_CONTAINER_ROOT+'/child1'
    });
    let jsonld = API.jsonld.getByRdfType(response.last.body, API.FEDORA_TYPES.RESOURCE);

    assert.deepEqual(jsonld['http://purl.org/dc/elements/1.1/creator'], [
      {'@value' : 'alice'},
      {'@value' : 'bob'}
    ]);
  });

  it('Should let you remove integration test containers', async function(){
    let response = await containerUtils.cleanTests();
    assert.equal(response.error, null);
  });

});