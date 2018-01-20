const assert = require('assert');
const API = require('..');
const jwt = require('./utils/jwt');
const {ADMIN, ALICE, BOB} = jwt.createUsers();
const containerUtils = require('./utils/containerUtils');

API.setConfig({host: HOST});

describe('Service Tests', function() {
  
  it('Should let you prepare for tests', async function(){
    API.setConfig({jwt: ADMIN});
    API.service.testing(); // change the root url
    await containerUtils.createBasicSetup();
  });

  it('Should let you init service root', async function(){
    let {response} = await API.service.init();
    assert.equal(response.statusCode, 201);
  });

  it('Should should return 200 if root already exists', async function(){
    let {response} = await API.service.init();
    assert.equal(response.statusCode, 200);
  });

  it('Should create a proxy service ', async function(){
    var {response} = await API.service.create({
      name : 'Test Proxy Service',
      description : 'This is a test of a service',
      type : API.service.TYPES.PROXY,
      urlTemplate : 'http://localhost:8080{{fcPath}}{{extPath}}'
    });
    assert.equal(response.statusCode, 201);

    var {response} = await API.get({
      path : '/integration-test/.services/test-proxy-service',
      headers : {Accept : API.RDF_FORMATS.JSON_LD}
    });
    let body = JSON.parse(response.body)[0];

    assert.equal(
      body['http://library.ucdavis.edu/fin-server#urlTemplate'][0]['@value'],
      'http://localhost:8080{{fcPath}}{{extPath}}'
    );
  });

  it('Should create a frame service ', async function(){
    let {response} = await API.service.create({
      name : 'Test Frame Service',
      description : 'This is a test of a service',
      type : API.service.TYPES.FRAME,
      frame : {
        foo : 'bar',
        baz : { another: 'thing', cool: 123}
      }
    });
    assert.equal(response.statusCode, 201);
  });

  it('Should let you remove acl integration test containers', async function(){
    await containerUtils.cleanTests();
  });

});