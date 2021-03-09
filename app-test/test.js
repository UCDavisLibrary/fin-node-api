let API = require('../index');

let appName = 'ucd-lib-client';

(async function() {
  API.setConfig({
    host : 'http://localhost:3000',
    jwt : process.env.FIN_JWT,
    username: 'jrmerz@ucdavis.edu'
  });
  
  let resp = await API.application.create({id: appName});

  console.log(API.getConfig().fcBasePath+'/collection/ex1-pets/pets/bb.jpg')
  resp = await API.postEnsureSlug({
    path : '/application/'+appName,
    slug : 'testImage',
    headers : {
     'Content-Type' : API.RDF_FORMATS.JSON_LD
    },
    content : JSON.stringify({
      "@id" : '',
      "@type" : API.service.FIN_SERVER_TYPES.FEATURED_CONTAINER,
      'http://schema.org/label' : 'look at the wonder!',
      'http://schema.org/associatedMedia' : {'@id' : API.getConfig().fcBasePath+'/collection/ex1-pets/pets/bb.jpg'}
    })
  });

  await API.postEnsureSlug({
    path : '/application/'+appName+'/testImage',
    slug : 'photoshop',
    file : './oval1.jpg'
  });

  resp = await API.jsonld.patch({
    path : '/application/'+appName+'/testImage',
    insert : {
      'http://digital.ucdavis.edu/clientMedia' : {
        '@id' : API.getConfig().fcBasePath+'/application/'+appName+'/testImage/photoshop'
      }
    }
  })


  resp = await API.postEnsureSlug({
    path : '/application/'+appName,
    slug : 'testCollection',
    headers : {
     'Content-Type' : API.RDF_FORMATS.JSON_LD
    },
    content : JSON.stringify({
      "@id" : '',
      "@type" : API.service.FIN_SERVER_TYPES.FEATURED_CONTAINER,
      'http://schema.org/label' : 'this is a great collection',
      'http://schema.org/associatedMedia' : {'@id' : API.getConfig().fcBasePath+'/collection/ex1-pets'}
    })
  });

  await API.postEnsureSlug({
    path : '/application/'+appName+'/testCollection',
    slug : 'photoshop',
    file : './oval1.jpg'
  });


  resp = await API.jsonld.patch({
    path : '/application/'+appName+'/testCollection',
    insert : {
      'http://digital.ucdavis.edu/clientMedia' : {
        '@id' : API.getConfig().fcBasePath+'/application/'+appName+'/testCollection/photoshop'
      }
    }
  })

  resp = await API.jsonld.patch({
    path : '/application/'+appName,
    insert : {
      [API.service.FIN_SERVER_TYPES.FEATURED_IMAGE] : [{
        '@id' : 'http://localhost:3000'+API.getConfig().fcBasePath+'/application/'+appName+'/testImage'
      },{
        '@id' : 'http://localhost:3000'+API.getConfig().fcBasePath+'/collection/ex1-pets/pets/gimli.jpg'
      }],
      [API.service.FIN_SERVER_TYPES.FEATURED_COLLECTION] : [{
        '@id' : 'http://localhost:3000'+API.getConfig().fcBasePath+'/collection/ex1-pets'
      },{
        '@id' : 'http://localhost:3000'+API.getConfig().fcBasePath+'/application/'+appName+'/testCollection'
      }]
    }
  });


})();
