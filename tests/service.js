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
    let response = await API.service.init();
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });

  it('Should should return 200 if root already exists', async function(){
    let response = await API.service.init();
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 200);
  });

  it('Should create a proxy service ', async function(){
    var response = await API.service.create({
      id : 'test-proxy-service',
      title : 'Test Proxy Service',
      description : 'This is a test of a service',
      type : API.service.TYPES.PROXY,
      supportedType : 'http://fedora.info/definitions/v4/repository#Container',
      urlTemplate : 'http://localhost:8080{{fcPath}}{{svcPath}}'
    });
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);

    var response = await API.get({
      path : '/integration-test/.services/test-proxy-service',
      headers : {Accept : API.RDF_FORMATS.JSON_LD}
    });
    assert.equal(response.error, null);
    let body = JSON.parse(response.last.body)[0];

    assert.equal(
      body['http://library.ucdavis.edu/fin-server#urlTemplate'][0]['@value'],
      'http://localhost:8080{{fcPath}}{{svcPath}}'
    );
  });

  it('Should create a frame service ', async function(){
    let response = await API.service.create({
      id : 'frame-service',
      title : 'Test Frame Service',
      description : 'This is a test of a service',
      type : API.service.TYPES.FRAME,
      frame : {
        foo : 'bar',
        baz : { another: 'thing', cool: 123}
      }
    });
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });

  it('Should let you list services', async function(){
    let response = await API.service.list();
    assert.equal(response.error, null);
    assert.equal(response.data.length, 2);
  });

  it('Should not leat you create service w/ same name', async function(){
    let response = await API.service.create({
      id : 'frame-service',
      title : 'Test Frame Service',
      description : 'This is a test of a service',
      type : API.service.TYPES.FRAME,
      frame : {
        foo : 'bar',
        baz : { another: 'thing', cool: 123}
      }
    });
    assert.notEqual(response.error, null);
  });

  it('Should create a webhook service ', async function(){
    let response = await API.service.create({
      id : 'Test Webhook Service',
      title : 'Test Webhook Service',
      description : 'This is a test of a webhook service',
      type : API.service.TYPES.WEBHOOK,
      url : 'http://localhost:3333/foo'
    });
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });

  it('Should let you get a service', async function(){
    let response = await API.service.get({
      id : 'test-webhook-service',
    });

    assert.equal(response.error, null);
    let service = response.data;

    assert.equal(service.title, 'Test Webhook Service');
    assert.equal(service.type, API.service.TYPES.WEBHOOK);
  });

  it('Should create a external service ', async function(){
    var response = await API.service.create({
      id : 'test-external-service',
      title : 'Test External Service',
      description : 'This is a test of a external service',
      type : API.service.TYPES.EXTERNAL,
      urlTemplate : 'http://my.editor.org/finurl={{URL}}&token={{token}}'
    });
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);

    response = await API.service.get({
      id : 'test-external-service'
    });

    assert.equal(response.error, null);
    let service = response.data;

    assert.equal(service.id, 'test-external-service');
    assert.equal(service.urlTemplate, 'http://my.editor.org/finurl={{URL}}&token={{token}}');
  });

  it('Should create a authentication service ', async function(){
    var response = await API.service.create({
      id : 'test-authentication-service',
      title : 'Test Authentication Service',
      description : 'This is a test of a authentication service',
      type : API.service.TYPES.AUTHENTICATION,
      url : 'http://cas:8000'
    });
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);

    var response = await API.service.get({
      id : 'test-authentication-service'
    });

    assert.equal(response.error, null);
    let service = response.data;

    assert.equal(service.id, 'test-authentication-service');
    assert.equal(service.url, 'http://cas:8000');
    assert.equal(service.type, API.service.TYPES.AUTHENTICATION);
  });

  it('Should create a client service ', async function(){
    var response = await API.service.create({
      id : 'test-client-service',
      title : 'Test Client Service',
      description : 'This is a test of a client service',
      type : API.service.TYPES.CLIENT,
      url : 'http://ui-client:8000'
    });
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);

    response = await API.service.get({
      id : 'test-client-service'
    });

    assert.equal(response.error, null);
    let service = response.data;


    assert.equal(service.id, 'test-client-service');
    assert.equal(service.url, 'http://ui-client:8000');
    assert.equal(service.type, API.service.TYPES.CLIENT);
  });

  it('Should let the services register', function(next) {
    setTimeout(() => next(), 500);
  })

  it('Should let you get all registered services', async function() {
    let response = await API.service.list();

    assert.equal(response.error, null);
    let services = response.data;

    assert.notEqual(services.find(service => service.id === 'test-proxy-service'), undefined);
    assert.notEqual(services.find(service => service.id === 'test-client-service'), undefined);
    assert.notEqual(services.find(service => service.id === 'test-authentication-service'), undefined);
    assert.notEqual(services.find(service => service.id === 'test-webhook-service'), undefined);
  });
  
  it('Should set a service secret', async function(){
    let response = await API.service.setSecret({
      id : 'test-proxy-service',
      secret : 'foobar'
    });
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 201);
  });

  it('Should verify a service secret', async function() {
    let response = await API.service.verifySecret({
      id : 'test-proxy-service'
    });
    
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 200);
    
    let signature = response.last.headers['x-fin-service-signature'];
    try {
      let payload = jwt.verify(signature, 'foobar');
      assert.equal(payload.service, 'test-proxy-service');
      assert.equal(payload.type, 'ProxyService');
      assert.equal(payload.signer, 'test-proxy-service');
    } catch(e) {
      assert.equal(null, e);
    }
  });

  it('Should remove a service secret', async function(){
    let response = await API.service.deleteSecret({
      id : 'test-proxy-service'
    });
    assert.equal(response.error, null);
    assert.equal(response.last.statusCode, 204);
  });

  it('Should verify a service secret using fin secret', async function(){
    let response = await API.service.verifySecret({
      id : 'test-proxy-service'
    });
    assert.equal(response.error, null);

    let signature = response.last.headers['x-fin-service-signature'];
    try {
      let payload = jwt.verify(signature, jwt.getSecret());
      assert.equal(payload.service, 'test-proxy-service');
      assert.equal(payload.type, 'ProxyService');
      assert.equal(payload.signer, 'fin');
    } catch(e) {
      assert.equal(null, e);
    }
  });

  it('Should let you remove acl integration test containers', async function(){
    let response = await containerUtils.cleanTests();
    assert.equal(response.error, null);
  });

});