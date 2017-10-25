## Classes

<dl>
<dt><a href="#FinApi">FinApi</a></dt>
<dd><p>FinApi</p>
<p>FIN API class</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#setConfig">setConfig(params)</a></dt>
<dd></dd>
<dt><a href="#getConfig">getConfig()</a></dt>
<dd><p>return config object</p>
</dd>
<dt><a href="#createUrl">createUrl(options)</a></dt>
<dd><p>Create the url for fedora request.</p>
</dd>
<dt><a href="#extensionHelper">extensionHelper(options)</a></dt>
<dd><p>If a file is provided on the request, look at the extension,
if it is of a known rdf type, set the content type for the request.</p>
<p>If the content-type header is already set, no operation is performed.</p>
</dd>
<dt><a href="#isSuccess">isSuccess(response)</a></dt>
<dd><p>Given a HTTP response see if response is in 200 range</p>
</dd>
<dt><a href="#get">get(options)</a></dt>
<dd><p>Retrieve the content of the resource</p>
</dd>
<dt><a href="#head">head(options)</a></dt>
<dd><p>Retrieve HTTP headers of the resource</p>
</dd>
<dt><a href="#create">create(options)</a></dt>
<dd><p>Create new resources within a LDP container</p>
</dd>
<dt><a href="#update">update(options)</a></dt>
<dd><p>Create a resource with a specified path, or replace the triples associated 
with a resource with the triples provided in the request body.</p>
</dd>
<dt><a href="#patch">patch(options)</a></dt>
<dd><p>Sparql base update</p>
</dd>
<dt><a href="#remove">remove(options)</a></dt>
<dd><p>Delete a resource</p>
</dd>
<dt><a href="#copy">copy()</a></dt>
<dd><p>Copy a resource (and its subtree) to a new location</p>
</dd>
<dt><a href="#startTransaction">startTransaction()</a> ⇒ <code>String</code></dt>
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
<dt><a href="#getVersion">getVersion(options)</a></dt>
<dd></dd>
<dt><a href="#createVersion">createVersion(options)</a></dt>
<dd></dd>
<dt><a href="#revertToVersion">revertToVersion(options)</a></dt>
<dd></dd>
<dt><a href="#deleteVersion">deleteVersion(options)</a></dt>
<dd></dd>
</dl>

<a name="FinApi"></a>

## FinApi
FinApi

FIN API class

**Kind**: global class  
<a name="setConfig"></a>

## setConfig(params)
**Kind**: global function  

| Param |
| --- |
| params | 

<a name="getConfig"></a>

## getConfig()
return config object

**Kind**: global function  
<a name="createUrl"></a>

## createUrl(options)
Create the url for fedora request.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | url path |
| options.host | <code>String</code> | override config.host |
| options.basePath | <code>String</code> | override config.basePath |
| options.transactionToken | <code>String</code> | override config.transactionToken |

<a name="extensionHelper"></a>

## extensionHelper(options)
If a file is provided on the request, look at the extension,
if it is of a known rdf type, set the content type for the request.

If the content-type header is already set, no operation is performed.

**Kind**: global function  

| Param | Type |
| --- | --- |
| options | <code>Object</code> | 

<a name="isSuccess"></a>

## isSuccess(response)
Given a HTTP response see if response is in 200 range

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| response | <code>Object</code> | HTTP response object |

<a name="get"></a>

## get(options)
Retrieve the content of the resource

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.basePath | <code>String</code> | (optional) override config.basePath |

<a name="head"></a>

## head(options)
Retrieve HTTP headers of the resource

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.basePath | <code>String</code> | (optional) override config.basePath |

<a name="create"></a>

## create(options)
Create new resources within a LDP container

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.file | <code>Object</code> | (optional) path to file to upload |
| options.content | <code>Object</code> | (optional) content to upload |
| options.host | <code>String</code> | (optional) override config.host |
| options.basePath | <code>String</code> | (optional) override config.basePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="update"></a>

## update(options)
Create a resource with a specified path, or replace the triples associated 
with a resource with the triples provided in the request body.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.file | <code>Object</code> | (optional) path to file to upload |
| options.content | <code>Object</code> | (optional) content to upload |
| options.partial | <code>Object</code> | (optional) only partial update happening, sets Prefer header to handling=lenient; received="minimal" |
| options.host | <code>String</code> | (optional) override config.host |
| options.basePath | <code>String</code> | (optional) override config.basePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="patch"></a>

## patch(options)
Sparql base update

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.file | <code>Object</code> | (optional) path to file to upload |
| options.content | <code>Object</code> | (optional) content to upload |
| options.host | <code>String</code> | (optional) override config.host |
| options.basePath | <code>String</code> | (optional) override config.basePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="remove"></a>

## remove(options)
Delete a resource

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | arguments |
| options.path | <code>String</code> | resource path |
| options.permanent | <code>Boolean</code> | remove /fcr:tombstone as well |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.basePath | <code>String</code> | (optional) override config.basePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="copy"></a>

## copy()
Copy a resource (and its subtree) to a new location

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| options.path | <code>String</code> | resource path |
| options.destination | <code>Boolean</code> | path to copy resource to |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.basePath | <code>String</code> | (optional) override config.basePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="startTransaction"></a>

## startTransaction() ⇒ <code>String</code>
Start a new transaction, returns transation token.

**Kind**: global function  
**Returns**: <code>String</code> - transaction token  

| Param | Type | Description |
| --- | --- | --- |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.basePath | <code>String</code> | (optional) override config.basePath |

<a name="commitTransaction"></a>

## commitTransaction() ⇒ <code>Promise</code>
Commit transation

**Kind**: global function  
**Returns**: <code>Promise</code> - transaction token  

| Param | Type | Description |
| --- | --- | --- |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.basePath | <code>String</code> | (optional) override config.basePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="rollbackTransaction"></a>

## rollbackTransaction() ⇒ <code>Promise</code>
Rollback transation

**Kind**: global function  
**Returns**: <code>Promise</code> - - response, body  

| Param | Type | Description |
| --- | --- | --- |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.basePath | <code>String</code> | (optional) override config.basePath |
| options.transactionToken | <code>String</code> | (optional) override config.transactionToken |

<a name="getVersions"></a>

## getVersions() ⇒ <code>Promise</code>
Get a current version

**Kind**: global function  
**Returns**: <code>Promise</code> - - response, body  

| Param | Type | Description |
| --- | --- | --- |
| options.headers | <code>Object</code> | resource headers, key/value pairs |
| options.host | <code>String</code> | (optional) override config.host |
| options.basePath | <code>String</code> | (optional) override config.basePath |

<a name="getVersion"></a>

## getVersion(options)
**Kind**: global function  

| Param | Type |
| --- | --- |
| options | <code>\*</code> | 

<a name="createVersion"></a>

## createVersion(options)
**Kind**: global function  

| Param | Type |
| --- | --- |
| options | <code>\*</code> | 

<a name="revertToVersion"></a>

## revertToVersion(options)
**Kind**: global function  

| Param | Type |
| --- | --- |
| options | <code>\*</code> | 

<a name="deleteVersion"></a>

## deleteVersion(options)
**Kind**: global function  

| Param | Type |
| --- | --- |
| options | <code>\*</code> | 

