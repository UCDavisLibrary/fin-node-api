const assert = require('assert');
const API = require('../..');
const path = require('path');
const fs = require('fs');

const data = {
  turtle : fs.readFileSync(path.join(__dirname, 'test.ttl'), 'utf-8'),
  turtle2 : fs.readFileSync(path.join(__dirname, 'test2.ttl'), 'utf-8'),
  jsonld : fs.readFileSync(path.join(__dirname, 'test.json'), 'utf-8'),
  sparqlDiff : fs.readFileSync(path.join(__dirname, 'diff.sparql'), 'utf-8')
}

describe('Turtle <-> JSON-LD transfroms tests', function() {
  
  it('let you transform turle to json-ld', async function(){
    let json = await API.transform.turtleToJsonLd(data.turtle);

    // TODO: better checks for this
    assert.equal(json.length, 3);
  });

  it('let you transform json-ld to turtle', async function(){
    let turtle = await API.transform.jsonldToTurtle(data.jsonld);

    // console.log(turtle);
  });

  it('let you create sparql from two turtle files', async function(){
    let sparql = await API.transform.diffToSparql(data.turtle, data.turtle2);
    assert.equal(sparql, data.sparqlDiff);
  });

});