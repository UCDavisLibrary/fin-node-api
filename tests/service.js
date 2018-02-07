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
      id : 'test-proxy-service',
      title : 'Test Proxy Service',
      description : 'This is a test of a service',
      type : API.service.TYPES.PROXY,
      supportedType : 'http://fedora.info/definitions/v4/repository#Container',
      urlTemplate : 'http://localhost:8080{{fcPath}}{{svcPath}}'
    });
    assert.equal(response.statusCode, 201);

    var {response} = await API.get({
      path : '/integration-test/.services/test-proxy-service',
      headers : {Accept : API.RDF_FORMATS.JSON_LD}
    });
    let body = JSON.parse(response.body)[0];

    assert.equal(
      body['http://library.ucdavis.edu/fin-server#urlTemplate'][0]['@value'],
      'http://localhost:8080{{fcPath}}{{svcPath}}'
    );
  });

  it('Should create a frame service ', async function(){
    let {response} = await API.service.create({
      id : 'frame-service',
      title : 'Test Frame Service',
      description : 'This is a test of a service',
      type : API.service.TYPES.FRAME,
      frame : {
        foo : 'bar',
        baz : { another: 'thing', cool: 123}
      }
    });
    assert.equal(response.statusCode, 201);
  });

  it('Should let you list services', async function(){
    let response = await API.service.list();
    assert.equal(response.length, 2);
  });

  it('Should not leat you create service w/ same name', async function(){
    try {
      let {response} = await API.service.create({
        id : 'frame-service',
        title : 'Test Frame Service',
        description : 'This is a test of a service',
        type : API.service.TYPES.FRAME,
        frame : {
          foo : 'bar',
          baz : { another: 'thing', cool: 123}
        }
      });
      assert.equal(true, false);
    } catch(e) {
      assert.equal(typeof e, 'object');
    }
  });

  it('Should create a webhook service ', async function(){
    let {response} = await API.service.create({
      id : 'Test Webhook Service',
      title : 'Test Webhook Service',
      description : 'This is a test of a webhook service',
      type : API.service.TYPES.WEBHOOK,
      webhook : 'http://localhost:3333/foo'
    });
    assert.equal(response.statusCode, 201);
  });

  it('Should let you get a service', async function(){
    let service = await API.service.get({
      id : 'test-webhook-service',
    });

    assert.equal(service.title, 'Test Webhook Service');
    assert.equal(service.type, API.service.TYPES.WEBHOOK);
  });

  it('Should create a external service ', async function(){
    var {response} = await API.service.create({
      id : 'test-external-service',
      title : 'Test External Service',
      description : 'This is a test of a external service',
      type : API.service.TYPES.EXTERNAL,
      urlTemplate : 'http://my.editor.org/finurl={{URL}}&token={{token}}'
    });
    assert.equal(response.statusCode, 201);

    var service = await API.service.get({
      id : 'test-external-service'
    });
    assert.equal(service.id, 'test-external-service');
    assert.equal(service.urlTemplate, 'http://my.editor.org/finurl={{URL}}&token={{token}}');
  });

  it('Should create a authentication service ', async function(){
    var {response} = await API.service.create({
      id : 'test-authentication-service',
      title : 'Test Authentication Service',
      description : 'This is a test of a authentication service',
      type : API.service.TYPES.AUTHENTICATION,
      url : 'http://cas:8000'
    });
    assert.equal(response.statusCode, 201);

    var service = await API.service.get({
      id : 'test-authentication-service'
    });
    assert.equal(service.id, 'test-authentication-service');
    assert.equal(service.url, 'http://cas:8000');
    assert.equal(service.type, API.service.TYPES.AUTHENTICATION);
  });

  it('Should create a client service ', async function(){
    var {response} = await API.service.create({
      id : 'test-client-service',
      title : 'Test Client Service',
      description : 'This is a test of a client service',
      type : API.service.TYPES.CLIENT,
      url : 'http://ui-client:8000'
    });
    assert.equal(response.statusCode, 201);

    var service = await API.service.get({
      id : 'test-client-service'
    });
    assert.equal(service.id, 'test-client-service');
    assert.equal(service.url, 'http://ui-client:8000');
    assert.equal(service.type, API.service.TYPES.CLIENT);
  });

  it('Should let you remove acl integration test containers', async function(){
    await containerUtils.cleanTests();
  });

});