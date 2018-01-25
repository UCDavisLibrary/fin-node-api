var N3 = require('n3');
var jsonld = require('jsonld').promises;
var processContext = require('jsonld').processContext;

const CONTAINER_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

/**
 * Utility library for json-ld to/from turtle
 */
class TransformUtils {

  turtleToJsonLd(turtle, compacted=false) {
    var parser = new N3.Parser();
    var triples = [];

    return new Promise((resolve, reject) => {
      parser.parse(turtle, function (err, triple, foo, bar) {
        if( err ) return reject(err);
        
        if( triple ) {
          triples.push({
              subject: term(triple.subject),
              predicate: term(triple.predicate),
              object: term(triple.object)
          });
        } else {
          resolve(finalizeJsonLd(parser._prefixes, triples, compacted));
        }
      });
    });
  }

  async jsonldToTurtle(json) {
    if( typeof json === 'string' ) {
      json = JSON.parse(json);
    }

    // let namespaces = await parseNamespaces(json)
    let dataset = await jsonld.toRDF(json, {format: 'application/nquads'});
    // console.log(dataset);
    return ntToTurtle(dataset);
  }
}

function finalizeJsonLd(prefixes, triples, compacted) {
  let bySubject = {};

  // group by subject
  triples.forEach(triple => {
    if( !bySubject[triple.subject.value] ) {
      bySubject[triple.subject.value] = {};
    }

    let subj = bySubject[triple.subject.value];
    if( !subj[triple.predicate.value] ) {
      subj[triple.predicate.value] = [];
    }

    if( triple.object.type === 'IRI' ) {
      subj[triple.predicate.value].push({
        '@id' : triple.object.value
      });
    } else {
      let val = {
        '@value' : triple.object.value
      };
      if( triple.object.datatype ) {
        val['@type'] = triple.object.datatype
      }
      subj[triple.predicate.value].push(val);
    }
  });

  let array = [];
  for( let key in bySubject ) {
    let subject = bySubject[key];

    // set the key
    subject['@id'] = key;

    // map the @types
    if( subject[CONTAINER_TYPE] ) {
      subject['@type'] = subject[CONTAINER_TYPE].map(item => item['@id']);
      delete subject[CONTAINER_TYPE];
    }

    array.push(subject);
  } 

  return array;
}

function ntToTurtle(dataset, namespaces) {
  var parser = new N3.Parser();
  // var writer = new N3.Writer({ prefixes: namespaces });
  var writer = new N3.Writer();

  return new Promise((resolve, reject) => {
    parser.parse(dataset, (parseErr, triple) => {
      if (parseErr) return reject (parseErr);
      
      if( triple ) {
        writer.addTriple(triple);
      } else {
        writer.end((err, data) => {
          if( err ) return reject(err);
          resolve(data);
        });
      }
    });
  });
};

function parseNamespaces(data) {
  return new Promise((resolve, reject) => {
    // processContext (null, null, function (notused, initialContext) {
      processContext (null, data, function (err, parsedContext) {
        if( err ) return reject(err);

        var namespaces = {};
        Object.keys(parsedContext.mappings).forEach((key, idx, arr) => {
          var value = parsedContext.mappings[key];
          if (value.reverse === false && value['@type'] === undefined && value['@id']) {
            namespaces[key] = value['@id'];
          }
        });

        resolve(namespaces);
      });
    // });
  });
};

function term(str) {
  if (N3.Util.isBlank(str)) {
      return {
          type: 'blank node',
          value: str
      };
  } else if (N3.Util.isLiteral(str)) {
      var ret = {
          type: 'literal',
          value: N3.Util.getLiteralValue(str),
          datatype: N3.Util.getLiteralType(str),
      };

      var language = N3.Util.getLiteralLanguage(str);
      if (language !== '') {
          ret.language = language;
      }

      return ret;
  } else {
      return {
          type: 'IRI',
          value: str
      };
  }
};

module.exports = new TransformUtils();