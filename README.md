## Classes

<dl>
<dt><a href="#FinApi">FinApi</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#setConfig">setConfig(params)</a></dt>
<dd><p>Set the API config</p>
<p>To make authenticated requests you should supply either a username/refreshToken or
username/password combo.  Then if a JWT doesn&#39;t exist or is expired, the request 
function will fetch a new JWT before the request is made.</p>
</dd>
<dt><a href="#getConfig">getConfig()</a> ⇒ <code>Object</code></dt>
<dd><p>return config object</p>
</dd>
<dt><a href="#isSuccess">isSuccess(response)</a> ⇒ <code>Boolean</code></dt>
<dd><p>Given a HTTP response see if response is in 200 range</p>
</dd>
<dt><a href="#get">get(options)</a> ⇒ <code>Promise</code></dt>
<dd><p>Retrieve the content of the resource</p>
</dd>
<dt><a href="#head">head(options)</a> ⇒ <code>Promise</code></dt>
<dd><p>Retrieve HTTP headers of the resource</p>
</dd>
<dt><a href="#create">create(options)</a> ⇒ <code>Promise</code></dt>
<dd><p>Create new resources within a LDP container</p>
</dd>
<dt><a href="#update">update(options)</a> ⇒ <code>Promise</code></dt>
<dd><p>Create a resource with a specified path, or replace the triples associated 
with a resource with the triples provided in the request body.</p>
</dd>
<dt><a href="#patch">patch(options)</a> ⇒ <code>Promise</code></dt>
<dd><p>Sparql base update</p>
</dd>
<dt><a href="#remove">remove(options)</a> ⇒ <code>Promise</code></dt>
<dd><p>Delete a resource</p>
</dd>
<dt><a href="#copy">copy()</a> ⇒ <code>Promise</code></dt>
<dd><p>Copy a resource (and its subtree) to a new location</p>
</dd>
<dt><a href="#startTransaction">startTransaction()</a> ⇒ <code>Promise</code></dt>
<dd><p>Start a new transaction, returns transation token.</p>
</dd>
<dt><a href="#commitTransaction">commitTransaction()</a> ⇒ <code>Promise</code></dt>
<dd><p>Commit transation</p>
</dd>
<dt><a href="#rollbackTransaction">rollbackTransaction()</a> ⇒ <code>Promise</code></dt>
<dd><p>Rollback transation</p>
</dd>
<dt><a href="#getVersions">getVersions()</a> ⇒ <code>Promise</code></dt>
<dd><p>Get a current version</p>
</dd>
<dt><a href="#getVersion">getVersion(options)</a> ⇒ <code>Promise</code></dt>
<dd></dd>
<dt><a href="#createVersion">createVersion(options)</a> ⇒ <code>Promise</code></dt>
<dd></dd>
<dt><a href="#revertToVersion">revertToVersion(options)</a> ⇒ <code>Promise</code></dt>
<dd></dd>
<dt><a href="#deleteVersion">deleteVersion(options)</a> ⇒ <code>Promise</code></dt>
<dd></dd>
</dl>

<a name="FinApi"></a>

## FinApi
**Kind**: global class  
<a name="new_FinApi_new"></a>

### new FinApi()
FIN API class

Many classes return a promise with a object that looks like {response, body, authenticated}
where
 - response: HTTP response object
 - body: HTTP body contents
 - authenticated: boolean flag if a JWT token was sent along with the request

<a name="setConfig"></a>

## setConfig(params)
Set the API config

To make authenticated requests you should supply either a username/refreshToken or
username/password combo.  Then if a JWT doesn't exist or is expired, the request 
function will fetch a new JWT before the request is made.

**Kind**: global function  

| Param | Description |
| --- | --- |
| params | key/value pairs to set |
| params.host | FIN host ex. http://mydams.org |
| params.fcBasePath | Fedora base path (default: /fcrepo/rest) |
| params.jwt | JWT Token |
| params.refreshToken | refresh token to use if JWT expires |
| params.username | username to use with refreshToken or password if JWT expires |
| params.password | password to use if JWT expires |
| params.transactionToken | custom transaction token |

<a name="getConfig"></a>

## getConfig() ⇒ <code>Object</code>
return config object

**Kind**: global function  
<a name="isSuccess"></a>

## isSuccess(response) ⇒ <code>Boolean</code>
Given a HTTP response see if response is in 200 range

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>Object</code> | HTTP response object |

<a name="get"></a>

## get(options) ⇒ <code>Promise</code>
Retrieve the content of the resource

**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.fcBasePath | <code>String</code> | (optional) override config.fcBasePath |

<a name="head"></a>

## head(options) ⇒ <code>Promise</code>
Retrieve HTTP headers of the resource

**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.fcBasePath | <code>String</code> | (optional) override config.fcBasePath |

<a name="create"></a>

## create(options) ⇒ <code>Promise</code>
Create new resources within a LDP container

**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.file | <code>Object</code> | (optional) path to file to upload |
| options.content | <code>Object</code> | (optional) content to upload |
| options.host | <code>String</code> | (optional) override config.host |
| options.fcBasePath | <code>String</code> | (optional) override config.fcBasePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="update"></a>

## update(options) ⇒ <code>Promise</code>
Create a resource with a specified path, or replace the triples associated 
with a resource with the triples provided in the request body.

**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.file | <code>Object</code> | (optional) path to file to upload |
| options.content | <code>Object</code> | (optional) content to upload |
| options.partial | <code>Object</code> | (optional) only partial update happening, sets Prefer header to handling=lenient; received="minimal" |
| options.host | <code>String</code> | (optional) override config.host |
| options.fcBasePath | <code>String</code> | (optional) override config.fcBasePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="patch"></a>

## patch(options) ⇒ <code>Promise</code>
Sparql base update

**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.file | <code>Object</code> | (optional) path to file to upload |
| options.content | <code>Object</code> | (optional) content to upload |
| options.host | <code>String</code> | (optional) override config.host |
| options.fcBasePath | <code>String</code> | (optional) override config.fcBasePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="remove"></a>

## remove(options) ⇒ <code>Promise</code>
Delete a resource

**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.permanent | <code>Boolean</code> | remove /fcr:tombstone as well |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.fcBasePath | <code>String</code> | (optional) override config.fcBasePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="copy"></a>

## copy() ⇒ <code>Promise</code>
Copy a resource (and its subtree) to a new location

**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type | Description |
| --- | --- | --- |
| options.path | <code>String</code> | resource path |
| options.destination | <code>Boolean</code> | path to copy resource to |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.fcBasePath | <code>String</code> | (optional) override config.fcBasePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="startTransaction"></a>

## startTransaction() ⇒ <code>Promise</code>
Start a new transaction, returns transation token.

**Kind**: global function  
**Returns**: <code>Promise</code> - {String} transaction token  

| Param | Type | Description |
| --- | --- | --- |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.fcBasePath | <code>String</code> | (optional) override config.fcBasePath |

<a name="commitTransaction"></a>

## commitTransaction() ⇒ <code>Promise</code>
Commit transation

**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type | Description |
| --- | --- | --- |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.fcBasePath | <code>String</code> | (optional) override config.fcBasePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="rollbackTransaction"></a>

## rollbackTransaction() ⇒ <code>Promise</code>
Rollback transation

**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type | Description |
| --- | --- | --- |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.fcBasePath | <code>String</code> | (optional) override config.fcBasePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="getVersions"></a>

## getVersions() ⇒ <code>Promise</code>
Get a current version

**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type | Description |
| --- | --- | --- |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.fcBasePath | <code>String</code> | (optional) override config.fcBasePath |

<a name="getVersion"></a>

## getVersion(options) ⇒ <code>Promise</code>
**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type |
| --- | --- |
| options | <code>\*</code> | 

<a name="createVersion"></a>

## createVersion(options) ⇒ <code>Promise</code>
**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type |
| --- | --- |
| options | <code>\*</code> | 

<a name="revertToVersion"></a>

## revertToVersion(options) ⇒ <code>Promise</code>
**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type |
| --- | --- |
| options | <code>\*</code> | 

<a name="deleteVersion"></a>

## deleteVersion(options) ⇒ <code>Promise</code>
**Kind**: global function  
**Returns**: <code>Promise</code> - {response, body, authenticated}  

| Param | Type |
| --- | --- |
| options | <code>\*</code> | 

