import{i as e,r as t,t as n}from"./rolldown-runtime-aKtaBQYM.js";import{l as r,r as i}from"./config-64zJ5TLN.js";import{n as a,t as o}from"./txPromise-EBECky1b.js";import{t as s}from"./getConfig-D89uJgo5.js";import{_ as c,d as l,g as u,v as d}from"./custom-element-security-MwgLnC6q.js";import{n as f}from"./toast-60iDlgiH.js";import{Cn as p,Sn as m,o as h,pn as g,t as _,xn as v,xt as y}from"./orchestrator-DrMg2dnI.js";import{t as b}from"./setConfig-DFMYnYLE.js";import{t as x}from"./browser-nBz_r6l4.js";import{t as S}from"./buffer-9oRIc-5Z.js";import{a as C,n as w,r as T,t as E}from"./toast-D3gxhZpN.js";import{n as D}from"./e2e-bridge-uU5ep5pj.js";import{t as O}from"./shadow-claw-element-na_3JW5e.js";import{t as k}from"./effect-BEsuusE8.js";import{i as A,n as j,r as M}from"./prompt-api-CyfgoCqW.js";import"./shadow-claw-page-header-action-button-Cn1xDjfA.js";import"./shadow-claw-page-header-DyG_qg9T.js";import{t as N}from"./markdown-DXtaNEac.js";import{i as P,n as F,o as I}from"./peerjs-iGj_NCGS.js";import{t as L}from"./downloadGroupFile-BbGOQ0jp.js";import{t as R}from"./file-viewer-C3DgeHSd.js";import{t as z}from"./config-value-oBfKgLT4.js";import"./shadow-claw-dialog-n4xdcUp-.js"
/*!

JSZip v3.10.1 - A JavaScript class for generating and reading zip files
<http://stuartk.com/jszip>

(c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/main/LICENSE.markdown.

JSZip uses the library pako released under the MIT license :
https://github.com/nodeca/pako/blob/main/LICENSE
*/
;var B=e(n(((n,r)=>{var i=e(x()),a=S();(function(e){typeof n==`object`&&r!==void 0?r.exports=e():typeof define==`function`&&define.amd?define([],e):(typeof window<`u`?window:typeof globalThis<`u`?globalThis:typeof self<`u`?self:this).JSZip=e()})(function(){return function e(n,r,i){function a(s,c){if(!r[s]){if(!n[s]){var l=typeof t==`function`&&t;if(!c&&l)return l(s,!0);if(o)return o(s,!0);var u=Error(`Cannot find module '`+s+`'`);throw u.code=`MODULE_NOT_FOUND`,u}var d=r[s]={exports:{}};n[s][0].call(d.exports,function(e){var t=n[s][1][e];return a(t||e)},d,d.exports,e,n,r,i)}return r[s].exports}for(var o=typeof t==`function`&&t,s=0;s<i.length;s++)a(i[s]);return a}({1:[function(e,t,n){var r=e(`./utils`),i=e(`./support`),a=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=`;n.encode=function(e){for(var t,n,i,o,s,c,l,u=[],d=0,f=e.length,p=f,m=r.getTypeOf(e)!==`string`;d<e.length;)p=f-d,i=m?(t=e[d++],n=d<f?e[d++]:0,d<f?e[d++]:0):(t=e.charCodeAt(d++),n=d<f?e.charCodeAt(d++):0,d<f?e.charCodeAt(d++):0),o=t>>2,s=(3&t)<<4|n>>4,c=1<p?(15&n)<<2|i>>6:64,l=2<p?63&i:64,u.push(a.charAt(o)+a.charAt(s)+a.charAt(c)+a.charAt(l));return u.join(``)},n.decode=function(e){var t,n,r,o,s,c,l=0,u=0,d=`data:`;if(e.substr(0,d.length)===d)throw Error(`Invalid base64 input, it looks like a data url.`);var f,p=3*(e=e.replace(/[^A-Za-z0-9+/=]/g,``)).length/4;if(e.charAt(e.length-1)===a.charAt(64)&&p--,e.charAt(e.length-2)===a.charAt(64)&&p--,p%1!=0)throw Error(`Invalid base64 input, bad content length.`);for(f=i.uint8array?new Uint8Array(0|p):Array(0|p);l<e.length;)t=a.indexOf(e.charAt(l++))<<2|(o=a.indexOf(e.charAt(l++)))>>4,n=(15&o)<<4|(s=a.indexOf(e.charAt(l++)))>>2,r=(3&s)<<6|(c=a.indexOf(e.charAt(l++))),f[u++]=t,s!==64&&(f[u++]=n),c!==64&&(f[u++]=r);return f}},{"./support":30,"./utils":32}],2:[function(e,t,n){var r=e(`./external`),i=e(`./stream/DataWorker`),a=e(`./stream/Crc32Probe`),o=e(`./stream/DataLengthProbe`);function s(e,t,n,r,i){this.compressedSize=e,this.uncompressedSize=t,this.crc32=n,this.compression=r,this.compressedContent=i}s.prototype={getContentWorker:function(){var e=new i(r.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new o(`data_length`)),t=this;return e.on(`end`,function(){if(this.streamInfo.data_length!==t.uncompressedSize)throw Error(`Bug : uncompressed data size mismatch`)}),e},getCompressedWorker:function(){return new i(r.Promise.resolve(this.compressedContent)).withStreamInfo(`compressedSize`,this.compressedSize).withStreamInfo(`uncompressedSize`,this.uncompressedSize).withStreamInfo(`crc32`,this.crc32).withStreamInfo(`compression`,this.compression)}},s.createWorkerFrom=function(e,t,n){return e.pipe(new a).pipe(new o(`uncompressedSize`)).pipe(t.compressWorker(n)).pipe(new o(`compressedSize`)).withStreamInfo(`compression`,t)},t.exports=s},{"./external":6,"./stream/Crc32Probe":25,"./stream/DataLengthProbe":26,"./stream/DataWorker":27}],3:[function(e,t,n){var r=e(`./stream/GenericWorker`);n.STORE={magic:`\0\0`,compressWorker:function(){return new r(`STORE compression`)},uncompressWorker:function(){return new r(`STORE decompression`)}},n.DEFLATE=e(`./flate`)},{"./flate":7,"./stream/GenericWorker":28}],4:[function(e,t,n){var r=e(`./utils`),i=function(){for(var e,t=[],n=0;n<256;n++){e=n;for(var r=0;r<8;r++)e=1&e?3988292384^e>>>1:e>>>1;t[n]=e}return t}();t.exports=function(e,t){return e!==void 0&&e.length?r.getTypeOf(e)===`string`?function(e,t,n,r){var a=i,o=r+n;e^=-1;for(var s=r;s<o;s++)e=e>>>8^a[255&(e^t.charCodeAt(s))];return-1^e}(0|t,e,e.length,0):function(e,t,n,r){var a=i,o=r+n;e^=-1;for(var s=r;s<o;s++)e=e>>>8^a[255&(e^t[s])];return-1^e}(0|t,e,e.length,0):0}},{"./utils":32}],5:[function(e,t,n){n.base64=!1,n.binary=!1,n.dir=!1,n.createFolders=!0,n.date=null,n.compression=null,n.compressionOptions=null,n.comment=null,n.unixPermissions=null,n.dosPermissions=null},{}],6:[function(e,t,n){var r=null;r=typeof Promise<`u`?Promise:e(`lie`),t.exports={Promise:r}},{lie:37}],7:[function(e,t,n){var r=typeof Uint8Array<`u`&&typeof Uint16Array<`u`&&typeof Uint32Array<`u`,i=e(`pako`),a=e(`./utils`),o=e(`./stream/GenericWorker`),s=r?`uint8array`:`array`;function c(e,t){o.call(this,`FlateWorker/`+e),this._pako=null,this._pakoAction=e,this._pakoOptions=t,this.meta={}}n.magic=`\b\0`,a.inherits(c,o),c.prototype.processChunk=function(e){this.meta=e.meta,this._pako===null&&this._createPako(),this._pako.push(a.transformTo(s,e.data),!1)},c.prototype.flush=function(){o.prototype.flush.call(this),this._pako===null&&this._createPako(),this._pako.push([],!0)},c.prototype.cleanUp=function(){o.prototype.cleanUp.call(this),this._pako=null},c.prototype._createPako=function(){this._pako=new i[this._pakoAction]({raw:!0,level:this._pakoOptions.level||-1});var e=this;this._pako.onData=function(t){e.push({data:t,meta:e.meta})}},n.compressWorker=function(e){return new c(`Deflate`,e)},n.uncompressWorker=function(){return new c(`Inflate`,{})}},{"./stream/GenericWorker":28,"./utils":32,pako:38}],8:[function(e,t,n){function r(e,t){var n,r=``;for(n=0;n<t;n++)r+=String.fromCharCode(255&e),e>>>=8;return r}function i(e,t,n,i,o,u){var d,f,p=e.file,m=e.compression,h=u!==s.utf8encode,g=a.transformTo(`string`,u(p.name)),_=a.transformTo(`string`,s.utf8encode(p.name)),v=p.comment,y=a.transformTo(`string`,u(v)),b=a.transformTo(`string`,s.utf8encode(v)),x=_.length!==p.name.length,S=b.length!==v.length,C=``,w=``,T=``,E=p.dir,D=p.date,O={crc32:0,compressedSize:0,uncompressedSize:0};t&&!n||(O.crc32=e.crc32,O.compressedSize=e.compressedSize,O.uncompressedSize=e.uncompressedSize);var k=0;t&&(k|=8),h||!x&&!S||(k|=2048);var A=0,j=0;E&&(A|=16),o===`UNIX`?(j=798,A|=function(e,t){var n=e;return e||(n=t?16893:33204),(65535&n)<<16}(p.unixPermissions,E)):(j=20,A|=function(e){return 63&(e||0)}(p.dosPermissions)),d=D.getUTCHours(),d<<=6,d|=D.getUTCMinutes(),d<<=5,d|=D.getUTCSeconds()/2,f=D.getUTCFullYear()-1980,f<<=4,f|=D.getUTCMonth()+1,f<<=5,f|=D.getUTCDate(),x&&(w=r(1,1)+r(c(g),4)+_,C+=`up`+r(w.length,2)+w),S&&(T=r(1,1)+r(c(y),4)+b,C+=`uc`+r(T.length,2)+T);var M=``;return M+=`
\0`,M+=r(k,2),M+=m.magic,M+=r(d,2),M+=r(f,2),M+=r(O.crc32,4),M+=r(O.compressedSize,4),M+=r(O.uncompressedSize,4),M+=r(g.length,2),M+=r(C.length,2),{fileRecord:l.LOCAL_FILE_HEADER+M+g+C,dirRecord:l.CENTRAL_FILE_HEADER+r(j,2)+M+r(y.length,2)+`\0\0\0\0`+r(A,4)+r(i,4)+g+C+y}}var a=e(`../utils`),o=e(`../stream/GenericWorker`),s=e(`../utf8`),c=e(`../crc32`),l=e(`../signature`);function u(e,t,n,r){o.call(this,`ZipFileWorker`),this.bytesWritten=0,this.zipComment=t,this.zipPlatform=n,this.encodeFileName=r,this.streamFiles=e,this.accumulate=!1,this.contentBuffer=[],this.dirRecords=[],this.currentSourceOffset=0,this.entriesCount=0,this.currentFile=null,this._sources=[]}a.inherits(u,o),u.prototype.push=function(e){var t=e.meta.percent||0,n=this.entriesCount,r=this._sources.length;this.accumulate?this.contentBuffer.push(e):(this.bytesWritten+=e.data.length,o.prototype.push.call(this,{data:e.data,meta:{currentFile:this.currentFile,percent:n?(t+100*(n-r-1))/n:100}}))},u.prototype.openedSource=function(e){this.currentSourceOffset=this.bytesWritten,this.currentFile=e.file.name;var t=this.streamFiles&&!e.file.dir;if(t){var n=i(e,t,!1,this.currentSourceOffset,this.zipPlatform,this.encodeFileName);this.push({data:n.fileRecord,meta:{percent:0}})}else this.accumulate=!0},u.prototype.closedSource=function(e){this.accumulate=!1;var t=this.streamFiles&&!e.file.dir,n=i(e,t,!0,this.currentSourceOffset,this.zipPlatform,this.encodeFileName);if(this.dirRecords.push(n.dirRecord),t)this.push({data:function(e){return l.DATA_DESCRIPTOR+r(e.crc32,4)+r(e.compressedSize,4)+r(e.uncompressedSize,4)}(e),meta:{percent:100}});else for(this.push({data:n.fileRecord,meta:{percent:0}});this.contentBuffer.length;)this.push(this.contentBuffer.shift());this.currentFile=null},u.prototype.flush=function(){for(var e=this.bytesWritten,t=0;t<this.dirRecords.length;t++)this.push({data:this.dirRecords[t],meta:{percent:100}});var n=this.bytesWritten-e,i=function(e,t,n,i,o){var s=a.transformTo(`string`,o(i));return l.CENTRAL_DIRECTORY_END+`\0\0\0\0`+r(e,2)+r(e,2)+r(t,4)+r(n,4)+r(s.length,2)+s}(this.dirRecords.length,n,e,this.zipComment,this.encodeFileName);this.push({data:i,meta:{percent:100}})},u.prototype.prepareNextSource=function(){this.previous=this._sources.shift(),this.openedSource(this.previous.streamInfo),this.isPaused?this.previous.pause():this.previous.resume()},u.prototype.registerPrevious=function(e){this._sources.push(e);var t=this;return e.on(`data`,function(e){t.processChunk(e)}),e.on(`end`,function(){t.closedSource(t.previous.streamInfo),t._sources.length?t.prepareNextSource():t.end()}),e.on(`error`,function(e){t.error(e)}),this},u.prototype.resume=function(){return!!o.prototype.resume.call(this)&&(!this.previous&&this._sources.length?(this.prepareNextSource(),!0):this.previous||this._sources.length||this.generatedError?void 0:(this.end(),!0))},u.prototype.error=function(e){var t=this._sources;if(!o.prototype.error.call(this,e))return!1;for(var n=0;n<t.length;n++)try{t[n].error(e)}catch{}return!0},u.prototype.lock=function(){o.prototype.lock.call(this);for(var e=this._sources,t=0;t<e.length;t++)e[t].lock()},t.exports=u},{"../crc32":4,"../signature":23,"../stream/GenericWorker":28,"../utf8":31,"../utils":32}],9:[function(e,t,n){var r=e(`../compressions`),i=e(`./ZipFileWorker`);n.generateWorker=function(e,t,n){var a=new i(t.streamFiles,n,t.platform,t.encodeFileName),o=0;try{e.forEach(function(e,n){o++;var i=function(e,t){var n=e||t,i=r[n];if(!i)throw Error(n+` is not a valid compression method !`);return i}(n.options.compression,t.compression),s=n.options.compressionOptions||t.compressionOptions||{},c=n.dir,l=n.date;n._compressWorker(i,s).withStreamInfo(`file`,{name:e,dir:c,date:l,comment:n.comment||``,unixPermissions:n.unixPermissions,dosPermissions:n.dosPermissions}).pipe(a)}),a.entriesCount=o}catch(e){a.error(e)}return a}},{"../compressions":3,"./ZipFileWorker":8}],10:[function(e,t,n){function r(){if(!(this instanceof r))return new r;if(arguments.length)throw Error(`The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.`);this.files=Object.create(null),this.comment=null,this.root=``,this.clone=function(){var e=new r;for(var t in this)typeof this[t]!=`function`&&(e[t]=this[t]);return e}}(r.prototype=e(`./object`)).loadAsync=e(`./load`),r.support=e(`./support`),r.defaults=e(`./defaults`),r.version=`3.10.1`,r.loadAsync=function(e,t){return new r().loadAsync(e,t)},r.external=e(`./external`),t.exports=r},{"./defaults":5,"./external":6,"./load":11,"./object":15,"./support":30}],11:[function(e,t,n){var r=e(`./utils`),i=e(`./external`),a=e(`./utf8`),o=e(`./zipEntries`),s=e(`./stream/Crc32Probe`),c=e(`./nodejsUtils`);function l(e){return new i.Promise(function(t,n){var r=e.decompressed.getContentWorker().pipe(new s);r.on(`error`,function(e){n(e)}).on(`end`,function(){r.streamInfo.crc32===e.decompressed.crc32?t():n(Error(`Corrupted zip : CRC32 mismatch`))}).resume()})}t.exports=function(e,t){var n=this;return t=r.extend(t||{},{base64:!1,checkCRC32:!1,optimizedBinaryString:!1,createFolders:!1,decodeFileName:a.utf8decode}),c.isNode&&c.isStream(e)?i.Promise.reject(Error(`JSZip can't accept a stream when loading a zip file.`)):r.prepareContent(`the loaded zip file`,e,!0,t.optimizedBinaryString,t.base64).then(function(e){var n=new o(t);return n.load(e),n}).then(function(e){var n=[i.Promise.resolve(e)],r=e.files;if(t.checkCRC32)for(var a=0;a<r.length;a++)n.push(l(r[a]));return i.Promise.all(n)}).then(function(e){for(var i=e.shift(),a=i.files,o=0;o<a.length;o++){var s=a[o],c=s.fileNameStr,l=r.resolve(s.fileNameStr);n.file(l,s.decompressed,{binary:!0,optimizedBinaryString:!0,date:s.date,dir:s.dir,comment:s.fileCommentStr.length?s.fileCommentStr:null,unixPermissions:s.unixPermissions,dosPermissions:s.dosPermissions,createFolders:t.createFolders}),s.dir||(n.file(l).unsafeOriginalName=c)}return i.zipComment.length&&(n.comment=i.zipComment),n})}},{"./external":6,"./nodejsUtils":14,"./stream/Crc32Probe":25,"./utf8":31,"./utils":32,"./zipEntries":33}],12:[function(e,t,n){var r=e(`../utils`),i=e(`../stream/GenericWorker`);function a(e,t){i.call(this,`Nodejs stream input adapter for `+e),this._upstreamEnded=!1,this._bindStream(t)}r.inherits(a,i),a.prototype._bindStream=function(e){var t=this;(this._stream=e).pause(),e.on(`data`,function(e){t.push({data:e,meta:{percent:0}})}).on(`error`,function(e){t.isPaused?this.generatedError=e:t.error(e)}).on(`end`,function(){t.isPaused?t._upstreamEnded=!0:t.end()})},a.prototype.pause=function(){return!!i.prototype.pause.call(this)&&(this._stream.pause(),!0)},a.prototype.resume=function(){return!!i.prototype.resume.call(this)&&(this._upstreamEnded?this.end():this._stream.resume(),!0)},t.exports=a},{"../stream/GenericWorker":28,"../utils":32}],13:[function(e,t,n){var r=e(`readable-stream`).Readable;function i(e,t,n){r.call(this,t),this._helper=e;var i=this;e.on(`data`,function(e,t){i.push(e)||i._helper.pause(),n&&n(t)}).on(`error`,function(e){i.emit(`error`,e)}).on(`end`,function(){i.push(null)})}e(`../utils`).inherits(i,r),i.prototype._read=function(){this._helper.resume()},t.exports=i},{"../utils":32,"readable-stream":16}],14:[function(e,t,n){t.exports={isNode:a.Buffer!==void 0,newBufferFrom:function(e,t){if(a.Buffer.from&&a.Buffer.from!==Uint8Array.from)return a.Buffer.from(e,t);if(typeof e==`number`)throw Error(`The "data" argument must not be a number`);return new a.Buffer(e,t)},allocBuffer:function(e){if(a.Buffer.alloc)return a.Buffer.alloc(e);var t=new a.Buffer(e);return t.fill(0),t},isBuffer:function(e){return a.Buffer.isBuffer(e)},isStream:function(e){return e&&typeof e.on==`function`&&typeof e.pause==`function`&&typeof e.resume==`function`}}},{}],15:[function(e,t,n){function r(e,t,n){var r,i=a.getTypeOf(t),s=a.extend(n||{},c);s.date=s.date||new Date,s.compression!==null&&(s.compression=s.compression.toUpperCase()),typeof s.unixPermissions==`string`&&(s.unixPermissions=parseInt(s.unixPermissions,8)),s.unixPermissions&&16384&s.unixPermissions&&(s.dir=!0),s.dosPermissions&&16&s.dosPermissions&&(s.dir=!0),s.dir&&(e=h(e)),s.createFolders&&(r=m(e))&&g.call(this,r,!0);var d=i===`string`&&!1===s.binary&&!1===s.base64;n&&n.binary!==void 0||(s.binary=!d),(t instanceof l&&t.uncompressedSize===0||s.dir||!t||t.length===0)&&(s.base64=!1,s.binary=!0,t=``,s.compression=`STORE`,i=`string`);var _=null;_=t instanceof l||t instanceof o?t:f.isNode&&f.isStream(t)?new p(e,t):a.prepareContent(e,t,s.binary,s.optimizedBinaryString,s.base64);var v=new u(e,_,s);this.files[e]=v}var i=e(`./utf8`),a=e(`./utils`),o=e(`./stream/GenericWorker`),s=e(`./stream/StreamHelper`),c=e(`./defaults`),l=e(`./compressedObject`),u=e(`./zipObject`),d=e(`./generate`),f=e(`./nodejsUtils`),p=e(`./nodejs/NodejsStreamInputAdapter`),m=function(e){e.slice(-1)===`/`&&(e=e.substring(0,e.length-1));var t=e.lastIndexOf(`/`);return 0<t?e.substring(0,t):``},h=function(e){return e.slice(-1)!==`/`&&(e+=`/`),e},g=function(e,t){return t=t===void 0?c.createFolders:t,e=h(e),this.files[e]||r.call(this,e,null,{dir:!0,createFolders:t}),this.files[e]};function _(e){return Object.prototype.toString.call(e)===`[object RegExp]`}t.exports={load:function(){throw Error(`This method has been removed in JSZip 3.0, please check the upgrade guide.`)},forEach:function(e){var t,n,r;for(t in this.files)r=this.files[t],(n=t.slice(this.root.length,t.length))&&t.slice(0,this.root.length)===this.root&&e(n,r)},filter:function(e){var t=[];return this.forEach(function(n,r){e(n,r)&&t.push(r)}),t},file:function(e,t,n){if(arguments.length!==1)return e=this.root+e,r.call(this,e,t,n),this;if(_(e)){var i=e;return this.filter(function(e,t){return!t.dir&&i.test(e)})}var a=this.files[this.root+e];return a&&!a.dir?a:null},folder:function(e){if(!e)return this;if(_(e))return this.filter(function(t,n){return n.dir&&e.test(t)});var t=this.root+e,n=g.call(this,t),r=this.clone();return r.root=n.name,r},remove:function(e){e=this.root+e;var t=this.files[e];if(t||=(e.slice(-1)!==`/`&&(e+=`/`),this.files[e]),t&&!t.dir)delete this.files[e];else for(var n=this.filter(function(t,n){return n.name.slice(0,e.length)===e}),r=0;r<n.length;r++)delete this.files[n[r].name];return this},generate:function(){throw Error(`This method has been removed in JSZip 3.0, please check the upgrade guide.`)},generateInternalStream:function(e){var t,n={};try{if((n=a.extend(e||{},{streamFiles:!1,compression:`STORE`,compressionOptions:null,type:``,platform:`DOS`,comment:null,mimeType:`application/zip`,encodeFileName:i.utf8encode})).type=n.type.toLowerCase(),n.compression=n.compression.toUpperCase(),n.type===`binarystring`&&(n.type=`string`),!n.type)throw Error(`No output type specified.`);a.checkSupport(n.type),n.platform!==`darwin`&&n.platform!==`freebsd`&&n.platform!==`linux`&&n.platform!==`sunos`||(n.platform=`UNIX`),n.platform===`win32`&&(n.platform=`DOS`);var r=n.comment||this.comment||``;t=d.generateWorker(this,n,r)}catch(e){(t=new o(`error`)).error(e)}return new s(t,n.type||`string`,n.mimeType)},generateAsync:function(e,t){return this.generateInternalStream(e).accumulate(t)},generateNodeStream:function(e,t){return(e||={}).type||(e.type=`nodebuffer`),this.generateInternalStream(e).toNodejsStream(t)}}},{"./compressedObject":2,"./defaults":5,"./generate":9,"./nodejs/NodejsStreamInputAdapter":12,"./nodejsUtils":14,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31,"./utils":32,"./zipObject":35}],16:[function(e,t,n){t.exports=e(`stream`)},{stream:void 0}],17:[function(e,t,n){var r=e(`./DataReader`);function i(e){r.call(this,e);for(var t=0;t<this.data.length;t++)e[t]=255&e[t]}e(`../utils`).inherits(i,r),i.prototype.byteAt=function(e){return this.data[this.zero+e]},i.prototype.lastIndexOfSignature=function(e){for(var t=e.charCodeAt(0),n=e.charCodeAt(1),r=e.charCodeAt(2),i=e.charCodeAt(3),a=this.length-4;0<=a;--a)if(this.data[a]===t&&this.data[a+1]===n&&this.data[a+2]===r&&this.data[a+3]===i)return a-this.zero;return-1},i.prototype.readAndCheckSignature=function(e){var t=e.charCodeAt(0),n=e.charCodeAt(1),r=e.charCodeAt(2),i=e.charCodeAt(3),a=this.readData(4);return t===a[0]&&n===a[1]&&r===a[2]&&i===a[3]},i.prototype.readData=function(e){if(this.checkOffset(e),e===0)return[];var t=this.data.slice(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i},{"../utils":32,"./DataReader":18}],18:[function(e,t,n){var r=e(`../utils`);function i(e){this.data=e,this.length=e.length,this.index=0,this.zero=0}i.prototype={checkOffset:function(e){this.checkIndex(this.index+e)},checkIndex:function(e){if(this.length<this.zero+e||e<0)throw Error(`End of data reached (data length = `+this.length+`, asked index = `+e+`). Corrupted zip ?`)},setIndex:function(e){this.checkIndex(e),this.index=e},skip:function(e){this.setIndex(this.index+e)},byteAt:function(){},readInt:function(e){var t,n=0;for(this.checkOffset(e),t=this.index+e-1;t>=this.index;t--)n=(n<<8)+this.byteAt(t);return this.index+=e,n},readString:function(e){return r.transformTo(`string`,this.readData(e))},readData:function(){},lastIndexOfSignature:function(){},readAndCheckSignature:function(){},readDate:function(){var e=this.readInt(4);return new Date(Date.UTC(1980+(e>>25&127),(e>>21&15)-1,e>>16&31,e>>11&31,e>>5&63,(31&e)<<1))}},t.exports=i},{"../utils":32}],19:[function(e,t,n){var r=e(`./Uint8ArrayReader`);function i(e){r.call(this,e)}e(`../utils`).inherits(i,r),i.prototype.readData=function(e){this.checkOffset(e);var t=this.data.slice(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i},{"../utils":32,"./Uint8ArrayReader":21}],20:[function(e,t,n){var r=e(`./DataReader`);function i(e){r.call(this,e)}e(`../utils`).inherits(i,r),i.prototype.byteAt=function(e){return this.data.charCodeAt(this.zero+e)},i.prototype.lastIndexOfSignature=function(e){return this.data.lastIndexOf(e)-this.zero},i.prototype.readAndCheckSignature=function(e){return e===this.readData(4)},i.prototype.readData=function(e){this.checkOffset(e);var t=this.data.slice(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i},{"../utils":32,"./DataReader":18}],21:[function(e,t,n){var r=e(`./ArrayReader`);function i(e){r.call(this,e)}e(`../utils`).inherits(i,r),i.prototype.readData=function(e){if(this.checkOffset(e),e===0)return new Uint8Array;var t=this.data.subarray(this.zero+this.index,this.zero+this.index+e);return this.index+=e,t},t.exports=i},{"../utils":32,"./ArrayReader":17}],22:[function(e,t,n){var r=e(`../utils`),i=e(`../support`),a=e(`./ArrayReader`),o=e(`./StringReader`),s=e(`./NodeBufferReader`),c=e(`./Uint8ArrayReader`);t.exports=function(e){var t=r.getTypeOf(e);return r.checkSupport(t),t!==`string`||i.uint8array?t===`nodebuffer`?new s(e):i.uint8array?new c(r.transformTo(`uint8array`,e)):new a(r.transformTo(`array`,e)):new o(e)}},{"../support":30,"../utils":32,"./ArrayReader":17,"./NodeBufferReader":19,"./StringReader":20,"./Uint8ArrayReader":21}],23:[function(e,t,n){n.LOCAL_FILE_HEADER=`PK`,n.CENTRAL_FILE_HEADER=`PK`,n.CENTRAL_DIRECTORY_END=`PK`,n.ZIP64_CENTRAL_DIRECTORY_LOCATOR=`PK\x07`,n.ZIP64_CENTRAL_DIRECTORY_END=`PK`,n.DATA_DESCRIPTOR=`PK\x07\b`},{}],24:[function(e,t,n){var r=e(`./GenericWorker`),i=e(`../utils`);function a(e){r.call(this,`ConvertWorker to `+e),this.destType=e}i.inherits(a,r),a.prototype.processChunk=function(e){this.push({data:i.transformTo(this.destType,e.data),meta:e.meta})},t.exports=a},{"../utils":32,"./GenericWorker":28}],25:[function(e,t,n){var r=e(`./GenericWorker`),i=e(`../crc32`);function a(){r.call(this,`Crc32Probe`),this.withStreamInfo(`crc32`,0)}e(`../utils`).inherits(a,r),a.prototype.processChunk=function(e){this.streamInfo.crc32=i(e.data,this.streamInfo.crc32||0),this.push(e)},t.exports=a},{"../crc32":4,"../utils":32,"./GenericWorker":28}],26:[function(e,t,n){var r=e(`../utils`),i=e(`./GenericWorker`);function a(e){i.call(this,`DataLengthProbe for `+e),this.propName=e,this.withStreamInfo(e,0)}r.inherits(a,i),a.prototype.processChunk=function(e){if(e){var t=this.streamInfo[this.propName]||0;this.streamInfo[this.propName]=t+e.data.length}i.prototype.processChunk.call(this,e)},t.exports=a},{"../utils":32,"./GenericWorker":28}],27:[function(e,t,n){var r=e(`../utils`),i=e(`./GenericWorker`);function a(e){i.call(this,`DataWorker`);var t=this;this.dataIsReady=!1,this.index=0,this.max=0,this.data=null,this.type=``,this._tickScheduled=!1,e.then(function(e){t.dataIsReady=!0,t.data=e,t.max=e&&e.length||0,t.type=r.getTypeOf(e),t.isPaused||t._tickAndRepeat()},function(e){t.error(e)})}r.inherits(a,i),a.prototype.cleanUp=function(){i.prototype.cleanUp.call(this),this.data=null},a.prototype.resume=function(){return!!i.prototype.resume.call(this)&&(!this._tickScheduled&&this.dataIsReady&&(this._tickScheduled=!0,r.delay(this._tickAndRepeat,[],this)),!0)},a.prototype._tickAndRepeat=function(){this._tickScheduled=!1,this.isPaused||this.isFinished||(this._tick(),this.isFinished||(r.delay(this._tickAndRepeat,[],this),this._tickScheduled=!0))},a.prototype._tick=function(){if(this.isPaused||this.isFinished)return!1;var e=null,t=Math.min(this.max,this.index+16384);if(this.index>=this.max)return this.end();switch(this.type){case`string`:e=this.data.substring(this.index,t);break;case`uint8array`:e=this.data.subarray(this.index,t);break;case`array`:case`nodebuffer`:e=this.data.slice(this.index,t)}return this.index=t,this.push({data:e,meta:{percent:this.max?this.index/this.max*100:0}})},t.exports=a},{"../utils":32,"./GenericWorker":28}],28:[function(e,t,n){function r(e){this.name=e||`default`,this.streamInfo={},this.generatedError=null,this.extraStreamInfo={},this.isPaused=!0,this.isFinished=!1,this.isLocked=!1,this._listeners={data:[],end:[],error:[]},this.previous=null}r.prototype={push:function(e){this.emit(`data`,e)},end:function(){if(this.isFinished)return!1;this.flush();try{this.emit(`end`),this.cleanUp(),this.isFinished=!0}catch(e){this.emit(`error`,e)}return!0},error:function(e){return!this.isFinished&&(this.isPaused?this.generatedError=e:(this.isFinished=!0,this.emit(`error`,e),this.previous&&this.previous.error(e),this.cleanUp()),!0)},on:function(e,t){return this._listeners[e].push(t),this},cleanUp:function(){this.streamInfo=this.generatedError=this.extraStreamInfo=null,this._listeners=[]},emit:function(e,t){if(this._listeners[e])for(var n=0;n<this._listeners[e].length;n++)this._listeners[e][n].call(this,t)},pipe:function(e){return e.registerPrevious(this)},registerPrevious:function(e){if(this.isLocked)throw Error(`The stream '`+this+`' has already been used.`);this.streamInfo=e.streamInfo,this.mergeStreamInfo(),this.previous=e;var t=this;return e.on(`data`,function(e){t.processChunk(e)}),e.on(`end`,function(){t.end()}),e.on(`error`,function(e){t.error(e)}),this},pause:function(){return!this.isPaused&&!this.isFinished&&(this.isPaused=!0,this.previous&&this.previous.pause(),!0)},resume:function(){if(!this.isPaused||this.isFinished)return!1;var e=this.isPaused=!1;return this.generatedError&&(this.error(this.generatedError),e=!0),this.previous&&this.previous.resume(),!e},flush:function(){},processChunk:function(e){this.push(e)},withStreamInfo:function(e,t){return this.extraStreamInfo[e]=t,this.mergeStreamInfo(),this},mergeStreamInfo:function(){for(var e in this.extraStreamInfo)Object.prototype.hasOwnProperty.call(this.extraStreamInfo,e)&&(this.streamInfo[e]=this.extraStreamInfo[e])},lock:function(){if(this.isLocked)throw Error(`The stream '`+this+`' has already been used.`);this.isLocked=!0,this.previous&&this.previous.lock()},toString:function(){var e=`Worker `+this.name;return this.previous?this.previous+` -> `+e:e}},t.exports=r},{}],29:[function(e,t,n){var r=e(`../utils`),i=e(`./ConvertWorker`),o=e(`./GenericWorker`),s=e(`../base64`),c=e(`../support`),l=e(`../external`),u=null;if(c.nodestream)try{u=e(`../nodejs/NodejsStreamOutputAdapter`)}catch{}function d(e,t){return new l.Promise(function(n,i){var o=[],c=e._internalType,l=e._outputType,u=e._mimeType;e.on(`data`,function(e,n){o.push(e),t&&t(n)}).on(`error`,function(e){o=[],i(e)}).on(`end`,function(){try{n(function(e,t,n){switch(e){case`blob`:return r.newBlob(r.transformTo(`arraybuffer`,t),n);case`base64`:return s.encode(t);default:return r.transformTo(e,t)}}(l,function(e,t){var n,r=0,i=null,o=0;for(n=0;n<t.length;n++)o+=t[n].length;switch(e){case`string`:return t.join(``);case`array`:return Array.prototype.concat.apply([],t);case`uint8array`:for(i=new Uint8Array(o),n=0;n<t.length;n++)i.set(t[n],r),r+=t[n].length;return i;case`nodebuffer`:return a.Buffer.concat(t);default:throw Error(`concat : unsupported type '`+e+`'`)}}(c,o),u))}catch(e){i(e)}o=[]}).resume()})}function f(e,t,n){var a=t;switch(t){case`blob`:case`arraybuffer`:a=`uint8array`;break;case`base64`:a=`string`}try{this._internalType=a,this._outputType=t,this._mimeType=n,r.checkSupport(a),this._worker=e.pipe(new i(a)),e.lock()}catch(e){this._worker=new o(`error`),this._worker.error(e)}}f.prototype={accumulate:function(e){return d(this,e)},on:function(e,t){var n=this;return e===`data`?this._worker.on(e,function(e){t.call(n,e.data,e.meta)}):this._worker.on(e,function(){r.delay(t,arguments,n)}),this},resume:function(){return r.delay(this._worker.resume,[],this._worker),this},pause:function(){return this._worker.pause(),this},toNodejsStream:function(e){if(r.checkSupport(`nodestream`),this._outputType!==`nodebuffer`)throw Error(this._outputType+` is not supported by this method`);return new u(this,{objectMode:this._outputType!==`nodebuffer`},e)}},t.exports=f},{"../base64":1,"../external":6,"../nodejs/NodejsStreamOutputAdapter":13,"../support":30,"../utils":32,"./ConvertWorker":24,"./GenericWorker":28}],30:[function(e,t,n){if(n.base64=!0,n.array=!0,n.string=!0,n.arraybuffer=typeof ArrayBuffer<`u`&&typeof Uint8Array<`u`,n.nodebuffer=a.Buffer!==void 0,n.uint8array=typeof Uint8Array<`u`,typeof ArrayBuffer>`u`)n.blob=!1;else{var r=new ArrayBuffer(0);try{n.blob=new Blob([r],{type:`application/zip`}).size===0}catch{try{var i=new(self.BlobBuilder||self.WebKitBlobBuilder||self.MozBlobBuilder||self.MSBlobBuilder);i.append(r),n.blob=i.getBlob(`application/zip`).size===0}catch{n.blob=!1}}}try{n.nodestream=!!e(`readable-stream`).Readable}catch{n.nodestream=!1}},{"readable-stream":16}],31:[function(e,t,n){for(var r=e(`./utils`),i=e(`./support`),a=e(`./nodejsUtils`),o=e(`./stream/GenericWorker`),s=Array(256),c=0;c<256;c++)s[c]=252<=c?6:248<=c?5:240<=c?4:224<=c?3:192<=c?2:1;s[254]=s[254]=1;function l(){o.call(this,`utf-8 decode`),this.leftOver=null}function u(){o.call(this,`utf-8 encode`)}n.utf8encode=function(e){return i.nodebuffer?a.newBufferFrom(e,`utf-8`):function(e){var t,n,r,a,o,s=e.length,c=0;for(a=0;a<s;a++)(64512&(n=e.charCodeAt(a)))==55296&&a+1<s&&(64512&(r=e.charCodeAt(a+1)))==56320&&(n=65536+(n-55296<<10)+(r-56320),a++),c+=n<128?1:n<2048?2:n<65536?3:4;for(t=i.uint8array?new Uint8Array(c):Array(c),a=o=0;o<c;a++)(64512&(n=e.charCodeAt(a)))==55296&&a+1<s&&(64512&(r=e.charCodeAt(a+1)))==56320&&(n=65536+(n-55296<<10)+(r-56320),a++),n<128?t[o++]=n:(n<2048?t[o++]=192|n>>>6:(n<65536?t[o++]=224|n>>>12:(t[o++]=240|n>>>18,t[o++]=128|n>>>12&63),t[o++]=128|n>>>6&63),t[o++]=128|63&n);return t}(e)},n.utf8decode=function(e){return i.nodebuffer?r.transformTo(`nodebuffer`,e).toString(`utf-8`):function(e){var t,n,i,a,o=e.length,c=Array(2*o);for(t=n=0;t<o;)if((i=e[t++])<128)c[n++]=i;else if(4<(a=s[i]))c[n++]=65533,t+=a-1;else{for(i&=a===2?31:a===3?15:7;1<a&&t<o;)i=i<<6|63&e[t++],a--;1<a?c[n++]=65533:i<65536?c[n++]=i:(i-=65536,c[n++]=55296|i>>10&1023,c[n++]=56320|1023&i)}return c.length!==n&&(c.subarray?c=c.subarray(0,n):c.length=n),r.applyFromCharCode(c)}(e=r.transformTo(i.uint8array?`uint8array`:`array`,e))},r.inherits(l,o),l.prototype.processChunk=function(e){var t=r.transformTo(i.uint8array?`uint8array`:`array`,e.data);if(this.leftOver&&this.leftOver.length){if(i.uint8array){var a=t;(t=new Uint8Array(a.length+this.leftOver.length)).set(this.leftOver,0),t.set(a,this.leftOver.length)}else t=this.leftOver.concat(t);this.leftOver=null}var o=function(e,t){var n;for((t||=e.length)>e.length&&(t=e.length),n=t-1;0<=n&&(192&e[n])==128;)n--;return n<0||n===0?t:n+s[e[n]]>t?n:t}(t),c=t;o!==t.length&&(i.uint8array?(c=t.subarray(0,o),this.leftOver=t.subarray(o,t.length)):(c=t.slice(0,o),this.leftOver=t.slice(o,t.length))),this.push({data:n.utf8decode(c),meta:e.meta})},l.prototype.flush=function(){this.leftOver&&this.leftOver.length&&(this.push({data:n.utf8decode(this.leftOver),meta:{}}),this.leftOver=null)},n.Utf8DecodeWorker=l,r.inherits(u,o),u.prototype.processChunk=function(e){this.push({data:n.utf8encode(e.data),meta:e.meta})},n.Utf8EncodeWorker=u},{"./nodejsUtils":14,"./stream/GenericWorker":28,"./support":30,"./utils":32}],32:[function(e,t,n){var r=e(`./support`),i=e(`./base64`),a=e(`./nodejsUtils`),o=e(`./external`);function s(e){return e}function c(e,t){for(var n=0;n<e.length;++n)t[n]=255&e.charCodeAt(n);return t}e(`setimmediate`),n.newBlob=function(e,t){n.checkSupport(`blob`);try{return new Blob([e],{type:t})}catch{try{var r=new(self.BlobBuilder||self.WebKitBlobBuilder||self.MozBlobBuilder||self.MSBlobBuilder);return r.append(e),r.getBlob(t)}catch{throw Error(`Bug : can't construct the Blob.`)}}};var l={stringifyByChunk:function(e,t,n){var r=[],i=0,a=e.length;if(a<=n)return String.fromCharCode.apply(null,e);for(;i<a;)t===`array`||t===`nodebuffer`?r.push(String.fromCharCode.apply(null,e.slice(i,Math.min(i+n,a)))):r.push(String.fromCharCode.apply(null,e.subarray(i,Math.min(i+n,a)))),i+=n;return r.join(``)},stringifyByChar:function(e){for(var t=``,n=0;n<e.length;n++)t+=String.fromCharCode(e[n]);return t},applyCanBeUsed:{uint8array:function(){try{return r.uint8array&&String.fromCharCode.apply(null,new Uint8Array(1)).length===1}catch{return!1}}(),nodebuffer:function(){try{return r.nodebuffer&&String.fromCharCode.apply(null,a.allocBuffer(1)).length===1}catch{return!1}}()}};function u(e){var t=65536,r=n.getTypeOf(e),i=!0;if(r===`uint8array`?i=l.applyCanBeUsed.uint8array:r===`nodebuffer`&&(i=l.applyCanBeUsed.nodebuffer),i)for(;1<t;)try{return l.stringifyByChunk(e,r,t)}catch{t=Math.floor(t/2)}return l.stringifyByChar(e)}function d(e,t){for(var n=0;n<e.length;n++)t[n]=e[n];return t}n.applyFromCharCode=u;var f={};f.string={string:s,array:function(e){return c(e,Array(e.length))},arraybuffer:function(e){return f.string.uint8array(e).buffer},uint8array:function(e){return c(e,new Uint8Array(e.length))},nodebuffer:function(e){return c(e,a.allocBuffer(e.length))}},f.array={string:u,array:s,arraybuffer:function(e){return new Uint8Array(e).buffer},uint8array:function(e){return new Uint8Array(e)},nodebuffer:function(e){return a.newBufferFrom(e)}},f.arraybuffer={string:function(e){return u(new Uint8Array(e))},array:function(e){return d(new Uint8Array(e),Array(e.byteLength))},arraybuffer:s,uint8array:function(e){return new Uint8Array(e)},nodebuffer:function(e){return a.newBufferFrom(new Uint8Array(e))}},f.uint8array={string:u,array:function(e){return d(e,Array(e.length))},arraybuffer:function(e){return e.buffer},uint8array:s,nodebuffer:function(e){return a.newBufferFrom(e)}},f.nodebuffer={string:u,array:function(e){return d(e,Array(e.length))},arraybuffer:function(e){return f.nodebuffer.uint8array(e).buffer},uint8array:function(e){return d(e,new Uint8Array(e.length))},nodebuffer:s},n.transformTo=function(e,t){return t||=``,e?(n.checkSupport(e),f[n.getTypeOf(t)][e](t)):t},n.resolve=function(e){for(var t=e.split(`/`),n=[],r=0;r<t.length;r++){var i=t[r];i===`.`||i===``&&r!==0&&r!==t.length-1||(i===`..`?n.pop():n.push(i))}return n.join(`/`)},n.getTypeOf=function(e){return typeof e==`string`?`string`:Object.prototype.toString.call(e)===`[object Array]`?`array`:r.nodebuffer&&a.isBuffer(e)?`nodebuffer`:r.uint8array&&e instanceof Uint8Array?`uint8array`:r.arraybuffer&&e instanceof ArrayBuffer?`arraybuffer`:void 0},n.checkSupport=function(e){if(!r[e.toLowerCase()])throw Error(e+` is not supported by this platform`)},n.MAX_VALUE_16BITS=65535,n.MAX_VALUE_32BITS=-1,n.pretty=function(e){var t,n,r=``;for(n=0;n<(e||``).length;n++)r+=`\\x`+((t=e.charCodeAt(n))<16?`0`:``)+t.toString(16).toUpperCase();return r},n.delay=function(e,t,n){setImmediate(function(){e.apply(n||null,t||[])})},n.inherits=function(e,t){function n(){}n.prototype=t.prototype,e.prototype=new n},n.extend=function(){var e,t,n={};for(e=0;e<arguments.length;e++)for(t in arguments[e])Object.prototype.hasOwnProperty.call(arguments[e],t)&&n[t]===void 0&&(n[t]=arguments[e][t]);return n},n.prepareContent=function(e,t,a,s,l){return o.Promise.resolve(t).then(function(e){return r.blob&&(e instanceof Blob||[`[object File]`,`[object Blob]`].indexOf(Object.prototype.toString.call(e))!==-1)&&typeof FileReader<`u`?new o.Promise(function(t,n){var r=new FileReader;r.onload=function(e){t(e.target.result)},r.onerror=function(e){n(e.target.error)},r.readAsArrayBuffer(e)}):e}).then(function(t){var u=n.getTypeOf(t);return u?(u===`arraybuffer`?t=n.transformTo(`uint8array`,t):u===`string`&&(l?t=i.decode(t):a&&!0!==s&&(t=function(e){return c(e,r.uint8array?new Uint8Array(e.length):Array(e.length))}(t))),t):o.Promise.reject(Error(`Can't read the data of '`+e+`'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?`))})}},{"./base64":1,"./external":6,"./nodejsUtils":14,"./support":30,setimmediate:54}],33:[function(e,t,n){var r=e(`./reader/readerFor`),i=e(`./utils`),a=e(`./signature`),o=e(`./zipEntry`),s=e(`./support`);function c(e){this.files=[],this.loadOptions=e}c.prototype={checkSignature:function(e){if(!this.reader.readAndCheckSignature(e)){this.reader.index-=4;var t=this.reader.readString(4);throw Error(`Corrupted zip or bug: unexpected signature (`+i.pretty(t)+`, expected `+i.pretty(e)+`)`)}},isSignature:function(e,t){var n=this.reader.index;this.reader.setIndex(e);var r=this.reader.readString(4)===t;return this.reader.setIndex(n),r},readBlockEndOfCentral:function(){this.diskNumber=this.reader.readInt(2),this.diskWithCentralDirStart=this.reader.readInt(2),this.centralDirRecordsOnThisDisk=this.reader.readInt(2),this.centralDirRecords=this.reader.readInt(2),this.centralDirSize=this.reader.readInt(4),this.centralDirOffset=this.reader.readInt(4),this.zipCommentLength=this.reader.readInt(2);var e=this.reader.readData(this.zipCommentLength),t=s.uint8array?`uint8array`:`array`,n=i.transformTo(t,e);this.zipComment=this.loadOptions.decodeFileName(n)},readBlockZip64EndOfCentral:function(){this.zip64EndOfCentralSize=this.reader.readInt(8),this.reader.skip(4),this.diskNumber=this.reader.readInt(4),this.diskWithCentralDirStart=this.reader.readInt(4),this.centralDirRecordsOnThisDisk=this.reader.readInt(8),this.centralDirRecords=this.reader.readInt(8),this.centralDirSize=this.reader.readInt(8),this.centralDirOffset=this.reader.readInt(8),this.zip64ExtensibleData={};for(var e,t,n,r=this.zip64EndOfCentralSize-44;0<r;)e=this.reader.readInt(2),t=this.reader.readInt(4),n=this.reader.readData(t),this.zip64ExtensibleData[e]={id:e,length:t,value:n}},readBlockZip64EndOfCentralLocator:function(){if(this.diskWithZip64CentralDirStart=this.reader.readInt(4),this.relativeOffsetEndOfZip64CentralDir=this.reader.readInt(8),this.disksCount=this.reader.readInt(4),1<this.disksCount)throw Error(`Multi-volumes zip are not supported`)},readLocalFiles:function(){var e,t;for(e=0;e<this.files.length;e++)t=this.files[e],this.reader.setIndex(t.localHeaderOffset),this.checkSignature(a.LOCAL_FILE_HEADER),t.readLocalPart(this.reader),t.handleUTF8(),t.processAttributes()},readCentralDir:function(){var e;for(this.reader.setIndex(this.centralDirOffset);this.reader.readAndCheckSignature(a.CENTRAL_FILE_HEADER);)(e=new o({zip64:this.zip64},this.loadOptions)).readCentralPart(this.reader),this.files.push(e);if(this.centralDirRecords!==this.files.length&&this.centralDirRecords!==0&&this.files.length===0)throw Error(`Corrupted zip or bug: expected `+this.centralDirRecords+` records in central dir, got `+this.files.length)},readEndOfCentral:function(){var e=this.reader.lastIndexOfSignature(a.CENTRAL_DIRECTORY_END);if(e<0)throw this.isSignature(0,a.LOCAL_FILE_HEADER)?Error(`Corrupted zip: can't find end of central directory`):Error(`Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html`);this.reader.setIndex(e);var t=e;if(this.checkSignature(a.CENTRAL_DIRECTORY_END),this.readBlockEndOfCentral(),this.diskNumber===i.MAX_VALUE_16BITS||this.diskWithCentralDirStart===i.MAX_VALUE_16BITS||this.centralDirRecordsOnThisDisk===i.MAX_VALUE_16BITS||this.centralDirRecords===i.MAX_VALUE_16BITS||this.centralDirSize===i.MAX_VALUE_32BITS||this.centralDirOffset===i.MAX_VALUE_32BITS){if(this.zip64=!0,(e=this.reader.lastIndexOfSignature(a.ZIP64_CENTRAL_DIRECTORY_LOCATOR))<0)throw Error(`Corrupted zip: can't find the ZIP64 end of central directory locator`);if(this.reader.setIndex(e),this.checkSignature(a.ZIP64_CENTRAL_DIRECTORY_LOCATOR),this.readBlockZip64EndOfCentralLocator(),!this.isSignature(this.relativeOffsetEndOfZip64CentralDir,a.ZIP64_CENTRAL_DIRECTORY_END)&&(this.relativeOffsetEndOfZip64CentralDir=this.reader.lastIndexOfSignature(a.ZIP64_CENTRAL_DIRECTORY_END),this.relativeOffsetEndOfZip64CentralDir<0))throw Error(`Corrupted zip: can't find the ZIP64 end of central directory`);this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir),this.checkSignature(a.ZIP64_CENTRAL_DIRECTORY_END),this.readBlockZip64EndOfCentral()}var n=this.centralDirOffset+this.centralDirSize;this.zip64&&(n+=20,n+=12+this.zip64EndOfCentralSize);var r=t-n;if(0<r)this.isSignature(t,a.CENTRAL_FILE_HEADER)||(this.reader.zero=r);else if(r<0)throw Error(`Corrupted zip: missing `+Math.abs(r)+` bytes.`)},prepareReader:function(e){this.reader=r(e)},load:function(e){this.prepareReader(e),this.readEndOfCentral(),this.readCentralDir(),this.readLocalFiles()}},t.exports=c},{"./reader/readerFor":22,"./signature":23,"./support":30,"./utils":32,"./zipEntry":34}],34:[function(e,t,n){var r=e(`./reader/readerFor`),i=e(`./utils`),a=e(`./compressedObject`),o=e(`./crc32`),s=e(`./utf8`),c=e(`./compressions`),l=e(`./support`);function u(e,t){this.options=e,this.loadOptions=t}u.prototype={isEncrypted:function(){return(1&this.bitFlag)==1},useUTF8:function(){return(2048&this.bitFlag)==2048},readLocalPart:function(e){var t,n;if(e.skip(22),this.fileNameLength=e.readInt(2),n=e.readInt(2),this.fileName=e.readData(this.fileNameLength),e.skip(n),this.compressedSize===-1||this.uncompressedSize===-1)throw Error(`Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)`);if((t=function(e){for(var t in c)if(Object.prototype.hasOwnProperty.call(c,t)&&c[t].magic===e)return c[t];return null}(this.compressionMethod))===null)throw Error(`Corrupted zip : compression `+i.pretty(this.compressionMethod)+` unknown (inner file : `+i.transformTo(`string`,this.fileName)+`)`);this.decompressed=new a(this.compressedSize,this.uncompressedSize,this.crc32,t,e.readData(this.compressedSize))},readCentralPart:function(e){this.versionMadeBy=e.readInt(2),e.skip(2),this.bitFlag=e.readInt(2),this.compressionMethod=e.readString(2),this.date=e.readDate(),this.crc32=e.readInt(4),this.compressedSize=e.readInt(4),this.uncompressedSize=e.readInt(4);var t=e.readInt(2);if(this.extraFieldsLength=e.readInt(2),this.fileCommentLength=e.readInt(2),this.diskNumberStart=e.readInt(2),this.internalFileAttributes=e.readInt(2),this.externalFileAttributes=e.readInt(4),this.localHeaderOffset=e.readInt(4),this.isEncrypted())throw Error(`Encrypted zip are not supported`);e.skip(t),this.readExtraFields(e),this.parseZIP64ExtraField(e),this.fileComment=e.readData(this.fileCommentLength)},processAttributes:function(){this.unixPermissions=null,this.dosPermissions=null;var e=this.versionMadeBy>>8;this.dir=!!(16&this.externalFileAttributes),e==0&&(this.dosPermissions=63&this.externalFileAttributes),e==3&&(this.unixPermissions=this.externalFileAttributes>>16&65535),this.dir||this.fileNameStr.slice(-1)!==`/`||(this.dir=!0)},parseZIP64ExtraField:function(){if(this.extraFields[1]){var e=r(this.extraFields[1].value);this.uncompressedSize===i.MAX_VALUE_32BITS&&(this.uncompressedSize=e.readInt(8)),this.compressedSize===i.MAX_VALUE_32BITS&&(this.compressedSize=e.readInt(8)),this.localHeaderOffset===i.MAX_VALUE_32BITS&&(this.localHeaderOffset=e.readInt(8)),this.diskNumberStart===i.MAX_VALUE_32BITS&&(this.diskNumberStart=e.readInt(4))}},readExtraFields:function(e){var t,n,r,i=e.index+this.extraFieldsLength;for(this.extraFields||={};e.index+4<i;)t=e.readInt(2),n=e.readInt(2),r=e.readData(n),this.extraFields[t]={id:t,length:n,value:r};e.setIndex(i)},handleUTF8:function(){var e=l.uint8array?`uint8array`:`array`;if(this.useUTF8())this.fileNameStr=s.utf8decode(this.fileName),this.fileCommentStr=s.utf8decode(this.fileComment);else{var t=this.findExtraFieldUnicodePath();if(t!==null)this.fileNameStr=t;else{var n=i.transformTo(e,this.fileName);this.fileNameStr=this.loadOptions.decodeFileName(n)}var r=this.findExtraFieldUnicodeComment();if(r!==null)this.fileCommentStr=r;else{var a=i.transformTo(e,this.fileComment);this.fileCommentStr=this.loadOptions.decodeFileName(a)}}},findExtraFieldUnicodePath:function(){var e=this.extraFields[28789];if(e){var t=r(e.value);return t.readInt(1)===1&&o(this.fileName)===t.readInt(4)?s.utf8decode(t.readData(e.length-5)):null}return null},findExtraFieldUnicodeComment:function(){var e=this.extraFields[25461];if(e){var t=r(e.value);return t.readInt(1)===1&&o(this.fileComment)===t.readInt(4)?s.utf8decode(t.readData(e.length-5)):null}return null}},t.exports=u},{"./compressedObject":2,"./compressions":3,"./crc32":4,"./reader/readerFor":22,"./support":30,"./utf8":31,"./utils":32}],35:[function(e,t,n){function r(e,t,n){this.name=e,this.dir=n.dir,this.date=n.date,this.comment=n.comment,this.unixPermissions=n.unixPermissions,this.dosPermissions=n.dosPermissions,this._data=t,this._dataBinary=n.binary,this.options={compression:n.compression,compressionOptions:n.compressionOptions}}var i=e(`./stream/StreamHelper`),a=e(`./stream/DataWorker`),o=e(`./utf8`),s=e(`./compressedObject`),c=e(`./stream/GenericWorker`);r.prototype={internalStream:function(e){var t=null,n=`string`;try{if(!e)throw Error(`No output type specified.`);var r=(n=e.toLowerCase())===`string`||n===`text`;n!==`binarystring`&&n!==`text`||(n=`string`),t=this._decompressWorker();var a=!this._dataBinary;a&&!r&&(t=t.pipe(new o.Utf8EncodeWorker)),!a&&r&&(t=t.pipe(new o.Utf8DecodeWorker))}catch(e){(t=new c(`error`)).error(e)}return new i(t,n,``)},async:function(e,t){return this.internalStream(e).accumulate(t)},nodeStream:function(e,t){return this.internalStream(e||`nodebuffer`).toNodejsStream(t)},_compressWorker:function(e,t){if(this._data instanceof s&&this._data.compression.magic===e.magic)return this._data.getCompressedWorker();var n=this._decompressWorker();return this._dataBinary||(n=n.pipe(new o.Utf8EncodeWorker)),s.createWorkerFrom(n,e,t)},_decompressWorker:function(){return this._data instanceof s?this._data.getContentWorker():this._data instanceof c?this._data:new a(this._data)}};for(var l=[`asText`,`asBinary`,`asNodeBuffer`,`asUint8Array`,`asArrayBuffer`],u=function(){throw Error(`This method has been removed in JSZip 3.0, please check the upgrade guide.`)},d=0;d<l.length;d++)r.prototype[l[d]]=u;t.exports=r},{"./compressedObject":2,"./stream/DataWorker":27,"./stream/GenericWorker":28,"./stream/StreamHelper":29,"./utf8":31}],36:[function(e,t,n){(function(e){var n,r,i=e.MutationObserver||e.WebKitMutationObserver;if(i){var a=0,o=new i(u),s=e.document.createTextNode(``);o.observe(s,{characterData:!0}),n=function(){s.data=a=++a%2}}else if(e.setImmediate||e.MessageChannel===void 0)n=`document`in e&&`onreadystatechange`in e.document.createElement(`script`)?function(){var t=e.document.createElement(`script`);t.onreadystatechange=function(){u(),t.onreadystatechange=null,t.parentNode.removeChild(t),t=null},e.document.documentElement.appendChild(t)}:function(){setTimeout(u,0)};else{var c=new e.MessageChannel;c.port1.onmessage=u,n=function(){c.port2.postMessage(0)}}var l=[];function u(){var e,t;r=!0;for(var n=l.length;n;){for(t=l,l=[],e=-1;++e<n;)t[e]();n=l.length}r=!1}t.exports=function(e){l.push(e)!==1||r||n()}}).call(this,typeof globalThis<`u`?globalThis:typeof self<`u`?self:typeof window<`u`?window:{})},{}],37:[function(e,t,n){var r=e(`immediate`);function i(){}var a={},o=[`REJECTED`],s=[`FULFILLED`],c=[`PENDING`];function l(e){if(typeof e!=`function`)throw TypeError(`resolver must be a function`);this.state=c,this.queue=[],this.outcome=void 0,e!==i&&p(this,e)}function u(e,t,n){this.promise=e,typeof t==`function`&&(this.onFulfilled=t,this.callFulfilled=this.otherCallFulfilled),typeof n==`function`&&(this.onRejected=n,this.callRejected=this.otherCallRejected)}function d(e,t,n){r(function(){var r;try{r=t(n)}catch(t){return a.reject(e,t)}r===e?a.reject(e,TypeError(`Cannot resolve promise with itself`)):a.resolve(e,r)})}function f(e){var t=e&&e.then;if(e&&(typeof e==`object`||typeof e==`function`)&&typeof t==`function`)return function(){t.apply(e,arguments)}}function p(e,t){var n=!1;function r(t){n||(n=!0,a.reject(e,t))}function i(t){n||(n=!0,a.resolve(e,t))}var o=m(function(){t(i,r)});o.status===`error`&&r(o.value)}function m(e,t){var n={};try{n.value=e(t),n.status=`success`}catch(e){n.status=`error`,n.value=e}return n}(t.exports=l).prototype.finally=function(e){if(typeof e!=`function`)return this;var t=this.constructor;return this.then(function(n){return t.resolve(e()).then(function(){return n})},function(n){return t.resolve(e()).then(function(){throw n})})},l.prototype.catch=function(e){return this.then(null,e)},l.prototype.then=function(e,t){if(typeof e!=`function`&&this.state===s||typeof t!=`function`&&this.state===o)return this;var n=new this.constructor(i);return this.state===c?this.queue.push(new u(n,e,t)):d(n,this.state===s?e:t,this.outcome),n},u.prototype.callFulfilled=function(e){a.resolve(this.promise,e)},u.prototype.otherCallFulfilled=function(e){d(this.promise,this.onFulfilled,e)},u.prototype.callRejected=function(e){a.reject(this.promise,e)},u.prototype.otherCallRejected=function(e){d(this.promise,this.onRejected,e)},a.resolve=function(e,t){var n=m(f,t);if(n.status===`error`)return a.reject(e,n.value);var r=n.value;if(r)p(e,r);else{e.state=s,e.outcome=t;for(var i=-1,o=e.queue.length;++i<o;)e.queue[i].callFulfilled(t)}return e},a.reject=function(e,t){e.state=o,e.outcome=t;for(var n=-1,r=e.queue.length;++n<r;)e.queue[n].callRejected(t);return e},l.resolve=function(e){return e instanceof this?e:a.resolve(new this(i),e)},l.reject=function(e){var t=new this(i);return a.reject(t,e)},l.all=function(e){var t=this;if(Object.prototype.toString.call(e)!==`[object Array]`)return this.reject(TypeError(`must be an array`));var n=e.length,r=!1;if(!n)return this.resolve([]);for(var o=Array(n),s=0,c=-1,l=new this(i);++c<n;)u(e[c],c);return l;function u(e,i){t.resolve(e).then(function(e){o[i]=e,++s!==n||r||(r=!0,a.resolve(l,o))},function(e){r||(r=!0,a.reject(l,e))})}},l.race=function(e){var t=this;if(Object.prototype.toString.call(e)!==`[object Array]`)return this.reject(TypeError(`must be an array`));var n=e.length,r=!1;if(!n)return this.resolve([]);for(var o=-1,s=new this(i);++o<n;)c=e[o],t.resolve(c).then(function(e){r||(r=!0,a.resolve(s,e))},function(e){r||(r=!0,a.reject(s,e))});var c;return s}},{immediate:36}],38:[function(e,t,n){var r={};(0,e(`./lib/utils/common`).assign)(r,e(`./lib/deflate`),e(`./lib/inflate`),e(`./lib/zlib/constants`)),t.exports=r},{"./lib/deflate":39,"./lib/inflate":40,"./lib/utils/common":41,"./lib/zlib/constants":44}],39:[function(e,t,n){var r=e(`./zlib/deflate`),i=e(`./utils/common`),a=e(`./utils/strings`),o=e(`./zlib/messages`),s=e(`./zlib/zstream`),c=Object.prototype.toString,l=0,u=-1,d=0,f=8;function p(e){if(!(this instanceof p))return new p(e);this.options=i.assign({level:u,method:f,chunkSize:16384,windowBits:15,memLevel:8,strategy:d,to:``},e||{});var t=this.options;t.raw&&0<t.windowBits?t.windowBits=-t.windowBits:t.gzip&&0<t.windowBits&&t.windowBits<16&&(t.windowBits+=16),this.err=0,this.msg=``,this.ended=!1,this.chunks=[],this.strm=new s,this.strm.avail_out=0;var n=r.deflateInit2(this.strm,t.level,t.method,t.windowBits,t.memLevel,t.strategy);if(n!==l)throw Error(o[n]);if(t.header&&r.deflateSetHeader(this.strm,t.header),t.dictionary){var m;if(m=typeof t.dictionary==`string`?a.string2buf(t.dictionary):c.call(t.dictionary)===`[object ArrayBuffer]`?new Uint8Array(t.dictionary):t.dictionary,(n=r.deflateSetDictionary(this.strm,m))!==l)throw Error(o[n]);this._dict_set=!0}}function m(e,t){var n=new p(t);if(n.push(e,!0),n.err)throw n.msg||o[n.err];return n.result}p.prototype.push=function(e,t){var n,o,s=this.strm,u=this.options.chunkSize;if(this.ended)return!1;o=t===~~t?t:!0===t?4:0,typeof e==`string`?s.input=a.string2buf(e):c.call(e)===`[object ArrayBuffer]`?s.input=new Uint8Array(e):s.input=e,s.next_in=0,s.avail_in=s.input.length;do{if(s.avail_out===0&&(s.output=new i.Buf8(u),s.next_out=0,s.avail_out=u),(n=r.deflate(s,o))!==1&&n!==l)return this.onEnd(n),!(this.ended=!0);s.avail_out!==0&&(s.avail_in!==0||o!==4&&o!==2)||(this.options.to===`string`?this.onData(a.buf2binstring(i.shrinkBuf(s.output,s.next_out))):this.onData(i.shrinkBuf(s.output,s.next_out)))}while((0<s.avail_in||s.avail_out===0)&&n!==1);return o===4?(n=r.deflateEnd(this.strm),this.onEnd(n),this.ended=!0,n===l):o!==2||(this.onEnd(l),!(s.avail_out=0))},p.prototype.onData=function(e){this.chunks.push(e)},p.prototype.onEnd=function(e){e===l&&(this.options.to===`string`?this.result=this.chunks.join(``):this.result=i.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg},n.Deflate=p,n.deflate=m,n.deflateRaw=function(e,t){return(t||={}).raw=!0,m(e,t)},n.gzip=function(e,t){return(t||={}).gzip=!0,m(e,t)}},{"./utils/common":41,"./utils/strings":42,"./zlib/deflate":46,"./zlib/messages":51,"./zlib/zstream":53}],40:[function(e,t,n){var r=e(`./zlib/inflate`),i=e(`./utils/common`),a=e(`./utils/strings`),o=e(`./zlib/constants`),s=e(`./zlib/messages`),c=e(`./zlib/zstream`),l=e(`./zlib/gzheader`),u=Object.prototype.toString;function d(e){if(!(this instanceof d))return new d(e);this.options=i.assign({chunkSize:16384,windowBits:0,to:``},e||{});var t=this.options;t.raw&&0<=t.windowBits&&t.windowBits<16&&(t.windowBits=-t.windowBits,t.windowBits===0&&(t.windowBits=-15)),!(0<=t.windowBits&&t.windowBits<16)||e&&e.windowBits||(t.windowBits+=32),15<t.windowBits&&t.windowBits<48&&!(15&t.windowBits)&&(t.windowBits|=15),this.err=0,this.msg=``,this.ended=!1,this.chunks=[],this.strm=new c,this.strm.avail_out=0;var n=r.inflateInit2(this.strm,t.windowBits);if(n!==o.Z_OK)throw Error(s[n]);this.header=new l,r.inflateGetHeader(this.strm,this.header)}function f(e,t){var n=new d(t);if(n.push(e,!0),n.err)throw n.msg||s[n.err];return n.result}d.prototype.push=function(e,t){var n,s,c,l,d,f,p=this.strm,m=this.options.chunkSize,h=this.options.dictionary,g=!1;if(this.ended)return!1;s=t===~~t?t:!0===t?o.Z_FINISH:o.Z_NO_FLUSH,typeof e==`string`?p.input=a.binstring2buf(e):u.call(e)===`[object ArrayBuffer]`?p.input=new Uint8Array(e):p.input=e,p.next_in=0,p.avail_in=p.input.length;do{if(p.avail_out===0&&(p.output=new i.Buf8(m),p.next_out=0,p.avail_out=m),(n=r.inflate(p,o.Z_NO_FLUSH))===o.Z_NEED_DICT&&h&&(f=typeof h==`string`?a.string2buf(h):u.call(h)===`[object ArrayBuffer]`?new Uint8Array(h):h,n=r.inflateSetDictionary(this.strm,f)),n===o.Z_BUF_ERROR&&!0===g&&(n=o.Z_OK,g=!1),n!==o.Z_STREAM_END&&n!==o.Z_OK)return this.onEnd(n),!(this.ended=!0);p.next_out&&(p.avail_out!==0&&n!==o.Z_STREAM_END&&(p.avail_in!==0||s!==o.Z_FINISH&&s!==o.Z_SYNC_FLUSH)||(this.options.to===`string`?(c=a.utf8border(p.output,p.next_out),l=p.next_out-c,d=a.buf2string(p.output,c),p.next_out=l,p.avail_out=m-l,l&&i.arraySet(p.output,p.output,c,l,0),this.onData(d)):this.onData(i.shrinkBuf(p.output,p.next_out)))),p.avail_in===0&&p.avail_out===0&&(g=!0)}while((0<p.avail_in||p.avail_out===0)&&n!==o.Z_STREAM_END);return n===o.Z_STREAM_END&&(s=o.Z_FINISH),s===o.Z_FINISH?(n=r.inflateEnd(this.strm),this.onEnd(n),this.ended=!0,n===o.Z_OK):s!==o.Z_SYNC_FLUSH||(this.onEnd(o.Z_OK),!(p.avail_out=0))},d.prototype.onData=function(e){this.chunks.push(e)},d.prototype.onEnd=function(e){e===o.Z_OK&&(this.options.to===`string`?this.result=this.chunks.join(``):this.result=i.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg},n.Inflate=d,n.inflate=f,n.inflateRaw=function(e,t){return(t||={}).raw=!0,f(e,t)},n.ungzip=f},{"./utils/common":41,"./utils/strings":42,"./zlib/constants":44,"./zlib/gzheader":47,"./zlib/inflate":49,"./zlib/messages":51,"./zlib/zstream":53}],41:[function(e,t,n){var r=typeof Uint8Array<`u`&&typeof Uint16Array<`u`&&typeof Int32Array<`u`;n.assign=function(e){for(var t=Array.prototype.slice.call(arguments,1);t.length;){var n=t.shift();if(n){if(typeof n!=`object`)throw TypeError(n+`must be non-object`);for(var r in n)n.hasOwnProperty(r)&&(e[r]=n[r])}}return e},n.shrinkBuf=function(e,t){return e.length===t?e:e.subarray?e.subarray(0,t):(e.length=t,e)};var i={arraySet:function(e,t,n,r,i){if(t.subarray&&e.subarray)e.set(t.subarray(n,n+r),i);else for(var a=0;a<r;a++)e[i+a]=t[n+a]},flattenChunks:function(e){var t,n,r,i,a,o;for(t=r=0,n=e.length;t<n;t++)r+=e[t].length;for(o=new Uint8Array(r),t=i=0,n=e.length;t<n;t++)a=e[t],o.set(a,i),i+=a.length;return o}},a={arraySet:function(e,t,n,r,i){for(var a=0;a<r;a++)e[i+a]=t[n+a]},flattenChunks:function(e){return[].concat.apply([],e)}};n.setTyped=function(e){e?(n.Buf8=Uint8Array,n.Buf16=Uint16Array,n.Buf32=Int32Array,n.assign(n,i)):(n.Buf8=Array,n.Buf16=Array,n.Buf32=Array,n.assign(n,a))},n.setTyped(r)},{}],42:[function(e,t,n){var r=e(`./common`),i=!0,a=!0;try{String.fromCharCode.apply(null,[0])}catch{i=!1}try{String.fromCharCode.apply(null,new Uint8Array(1))}catch{a=!1}for(var o=new r.Buf8(256),s=0;s<256;s++)o[s]=252<=s?6:248<=s?5:240<=s?4:224<=s?3:192<=s?2:1;function c(e,t){if(t<65537&&(e.subarray&&a||!e.subarray&&i))return String.fromCharCode.apply(null,r.shrinkBuf(e,t));for(var n=``,o=0;o<t;o++)n+=String.fromCharCode(e[o]);return n}o[254]=o[254]=1,n.string2buf=function(e){var t,n,i,a,o,s=e.length,c=0;for(a=0;a<s;a++)(64512&(n=e.charCodeAt(a)))==55296&&a+1<s&&(64512&(i=e.charCodeAt(a+1)))==56320&&(n=65536+(n-55296<<10)+(i-56320),a++),c+=n<128?1:n<2048?2:n<65536?3:4;for(t=new r.Buf8(c),a=o=0;o<c;a++)(64512&(n=e.charCodeAt(a)))==55296&&a+1<s&&(64512&(i=e.charCodeAt(a+1)))==56320&&(n=65536+(n-55296<<10)+(i-56320),a++),n<128?t[o++]=n:(n<2048?t[o++]=192|n>>>6:(n<65536?t[o++]=224|n>>>12:(t[o++]=240|n>>>18,t[o++]=128|n>>>12&63),t[o++]=128|n>>>6&63),t[o++]=128|63&n);return t},n.buf2binstring=function(e){return c(e,e.length)},n.binstring2buf=function(e){for(var t=new r.Buf8(e.length),n=0,i=t.length;n<i;n++)t[n]=e.charCodeAt(n);return t},n.buf2string=function(e,t){var n,r,i,a,s=t||e.length,l=Array(2*s);for(n=r=0;n<s;)if((i=e[n++])<128)l[r++]=i;else if(4<(a=o[i]))l[r++]=65533,n+=a-1;else{for(i&=a===2?31:a===3?15:7;1<a&&n<s;)i=i<<6|63&e[n++],a--;1<a?l[r++]=65533:i<65536?l[r++]=i:(i-=65536,l[r++]=55296|i>>10&1023,l[r++]=56320|1023&i)}return c(l,r)},n.utf8border=function(e,t){var n;for((t||=e.length)>e.length&&(t=e.length),n=t-1;0<=n&&(192&e[n])==128;)n--;return n<0||n===0?t:n+o[e[n]]>t?n:t}},{"./common":41}],43:[function(e,t,n){t.exports=function(e,t,n,r){for(var i=65535&e|0,a=e>>>16&65535|0,o=0;n!==0;){for(n-=o=2e3<n?2e3:n;a=a+(i=i+t[r++]|0)|0,--o;);i%=65521,a%=65521}return i|a<<16|0}},{}],44:[function(e,t,n){t.exports={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8}},{}],45:[function(e,t,n){var r=function(){for(var e,t=[],n=0;n<256;n++){e=n;for(var r=0;r<8;r++)e=1&e?3988292384^e>>>1:e>>>1;t[n]=e}return t}();t.exports=function(e,t,n,i){var a=r,o=i+n;e^=-1;for(var s=i;s<o;s++)e=e>>>8^a[255&(e^t[s])];return-1^e}},{}],46:[function(e,t,n){var r,i=e(`../utils/common`),a=e(`./trees`),o=e(`./adler32`),s=e(`./crc32`),c=e(`./messages`),l=0,u=4,d=0,f=-2,p=-1,m=4,h=2,g=8,_=9,v=286,y=30,b=19,x=2*v+1,S=15,C=3,w=258,T=w+C+1,E=42,D=113,O=1,k=2,A=3,j=4;function M(e,t){return e.msg=c[t],t}function N(e){return(e<<1)-(4<e?9:0)}function P(e){for(var t=e.length;0<=--t;)e[t]=0}function F(e){var t=e.state,n=t.pending;n>e.avail_out&&(n=e.avail_out),n!==0&&(i.arraySet(e.output,t.pending_buf,t.pending_out,n,e.next_out),e.next_out+=n,t.pending_out+=n,e.total_out+=n,e.avail_out-=n,t.pending-=n,t.pending===0&&(t.pending_out=0))}function I(e,t){a._tr_flush_block(e,0<=e.block_start?e.block_start:-1,e.strstart-e.block_start,t),e.block_start=e.strstart,F(e.strm)}function L(e,t){e.pending_buf[e.pending++]=t}function R(e,t){e.pending_buf[e.pending++]=t>>>8&255,e.pending_buf[e.pending++]=255&t}function z(e,t){var n,r,i=e.max_chain_length,a=e.strstart,o=e.prev_length,s=e.nice_match,c=e.strstart>e.w_size-T?e.strstart-(e.w_size-T):0,l=e.window,u=e.w_mask,d=e.prev,f=e.strstart+w,p=l[a+o-1],m=l[a+o];e.prev_length>=e.good_match&&(i>>=2),s>e.lookahead&&(s=e.lookahead);do if(l[(n=t)+o]===m&&l[n+o-1]===p&&l[n]===l[a]&&l[++n]===l[a+1]){a+=2,n++;do;while(l[++a]===l[++n]&&l[++a]===l[++n]&&l[++a]===l[++n]&&l[++a]===l[++n]&&l[++a]===l[++n]&&l[++a]===l[++n]&&l[++a]===l[++n]&&l[++a]===l[++n]&&a<f);if(r=w-(f-a),a=f-w,o<r){if(e.match_start=t,s<=(o=r))break;p=l[a+o-1],m=l[a+o]}}while((t=d[t&u])>c&&--i!=0);return o<=e.lookahead?o:e.lookahead}function B(e){var t,n,r,a,c,l,u,d,f,p,m=e.w_size;do{if(a=e.window_size-e.lookahead-e.strstart,e.strstart>=m+(m-T)){for(i.arraySet(e.window,e.window,m,m,0),e.match_start-=m,e.strstart-=m,e.block_start-=m,t=n=e.hash_size;r=e.head[--t],e.head[t]=m<=r?r-m:0,--n;);for(t=n=m;r=e.prev[--t],e.prev[t]=m<=r?r-m:0,--n;);a+=m}if(e.strm.avail_in===0)break;if(l=e.strm,u=e.window,d=e.strstart+e.lookahead,f=a,p=void 0,p=l.avail_in,f<p&&(p=f),n=p===0?0:(l.avail_in-=p,i.arraySet(u,l.input,l.next_in,p,d),l.state.wrap===1?l.adler=o(l.adler,u,p,d):l.state.wrap===2&&(l.adler=s(l.adler,u,p,d)),l.next_in+=p,l.total_in+=p,p),e.lookahead+=n,e.lookahead+e.insert>=C)for(c=e.strstart-e.insert,e.ins_h=e.window[c],e.ins_h=(e.ins_h<<e.hash_shift^e.window[c+1])&e.hash_mask;e.insert&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[c+C-1])&e.hash_mask,e.prev[c&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=c,c++,e.insert--,!(e.lookahead+e.insert<C)););}while(e.lookahead<T&&e.strm.avail_in!==0)}function V(e,t){for(var n,r;;){if(e.lookahead<T){if(B(e),e.lookahead<T&&t===l)return O;if(e.lookahead===0)break}if(n=0,e.lookahead>=C&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+C-1])&e.hash_mask,n=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),n!==0&&e.strstart-n<=e.w_size-T&&(e.match_length=z(e,n)),e.match_length>=C)if(r=a._tr_tally(e,e.strstart-e.match_start,e.match_length-C),e.lookahead-=e.match_length,e.match_length<=e.max_lazy_match&&e.lookahead>=C){for(e.match_length--;e.strstart++,e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+C-1])&e.hash_mask,n=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart,--e.match_length!=0;);e.strstart++}else e.strstart+=e.match_length,e.match_length=0,e.ins_h=e.window[e.strstart],e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+1])&e.hash_mask;else r=a._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++;if(r&&(I(e,!1),e.strm.avail_out===0))return O}return e.insert=e.strstart<C-1?e.strstart:C-1,t===u?(I(e,!0),e.strm.avail_out===0?A:j):e.last_lit&&(I(e,!1),e.strm.avail_out===0)?O:k}function H(e,t){for(var n,r,i;;){if(e.lookahead<T){if(B(e),e.lookahead<T&&t===l)return O;if(e.lookahead===0)break}if(n=0,e.lookahead>=C&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+C-1])&e.hash_mask,n=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),e.prev_length=e.match_length,e.prev_match=e.match_start,e.match_length=C-1,n!==0&&e.prev_length<e.max_lazy_match&&e.strstart-n<=e.w_size-T&&(e.match_length=z(e,n),e.match_length<=5&&(e.strategy===1||e.match_length===C&&4096<e.strstart-e.match_start)&&(e.match_length=C-1)),e.prev_length>=C&&e.match_length<=e.prev_length){for(i=e.strstart+e.lookahead-C,r=a._tr_tally(e,e.strstart-1-e.prev_match,e.prev_length-C),e.lookahead-=e.prev_length-1,e.prev_length-=2;++e.strstart<=i&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+C-1])&e.hash_mask,n=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),--e.prev_length!=0;);if(e.match_available=0,e.match_length=C-1,e.strstart++,r&&(I(e,!1),e.strm.avail_out===0))return O}else if(e.match_available){if((r=a._tr_tally(e,0,e.window[e.strstart-1]))&&I(e,!1),e.strstart++,e.lookahead--,e.strm.avail_out===0)return O}else e.match_available=1,e.strstart++,e.lookahead--}return e.match_available&&=(r=a._tr_tally(e,0,e.window[e.strstart-1]),0),e.insert=e.strstart<C-1?e.strstart:C-1,t===u?(I(e,!0),e.strm.avail_out===0?A:j):e.last_lit&&(I(e,!1),e.strm.avail_out===0)?O:k}function U(e,t,n,r,i){this.good_length=e,this.max_lazy=t,this.nice_length=n,this.max_chain=r,this.func=i}function ee(){this.strm=null,this.status=0,this.pending_buf=null,this.pending_buf_size=0,this.pending_out=0,this.pending=0,this.wrap=0,this.gzhead=null,this.gzindex=0,this.method=g,this.last_flush=-1,this.w_size=0,this.w_bits=0,this.w_mask=0,this.window=null,this.window_size=0,this.prev=null,this.head=null,this.ins_h=0,this.hash_size=0,this.hash_bits=0,this.hash_mask=0,this.hash_shift=0,this.block_start=0,this.match_length=0,this.prev_match=0,this.match_available=0,this.strstart=0,this.match_start=0,this.lookahead=0,this.prev_length=0,this.max_chain_length=0,this.max_lazy_match=0,this.level=0,this.strategy=0,this.good_match=0,this.nice_match=0,this.dyn_ltree=new i.Buf16(2*x),this.dyn_dtree=new i.Buf16(2*(2*y+1)),this.bl_tree=new i.Buf16(2*(2*b+1)),P(this.dyn_ltree),P(this.dyn_dtree),P(this.bl_tree),this.l_desc=null,this.d_desc=null,this.bl_desc=null,this.bl_count=new i.Buf16(S+1),this.heap=new i.Buf16(2*v+1),P(this.heap),this.heap_len=0,this.heap_max=0,this.depth=new i.Buf16(2*v+1),P(this.depth),this.l_buf=0,this.lit_bufsize=0,this.last_lit=0,this.d_buf=0,this.opt_len=0,this.static_len=0,this.matches=0,this.insert=0,this.bi_buf=0,this.bi_valid=0}function W(e){var t;return e&&e.state?(e.total_in=e.total_out=0,e.data_type=h,(t=e.state).pending=0,t.pending_out=0,t.wrap<0&&(t.wrap=-t.wrap),t.status=t.wrap?E:D,e.adler=t.wrap===2?0:1,t.last_flush=l,a._tr_init(t),d):M(e,f)}function G(e){var t=W(e);return t===d&&function(e){e.window_size=2*e.w_size,P(e.head),e.max_lazy_match=r[e.level].max_lazy,e.good_match=r[e.level].good_length,e.nice_match=r[e.level].nice_length,e.max_chain_length=r[e.level].max_chain,e.strstart=0,e.block_start=0,e.lookahead=0,e.insert=0,e.match_length=e.prev_length=C-1,e.match_available=0,e.ins_h=0}(e.state),t}function K(e,t,n,r,a,o){if(!e)return f;var s=1;if(t===p&&(t=6),r<0?(s=0,r=-r):15<r&&(s=2,r-=16),a<1||_<a||n!==g||r<8||15<r||t<0||9<t||o<0||m<o)return M(e,f);r===8&&(r=9);var c=new ee;return(e.state=c).strm=e,c.wrap=s,c.gzhead=null,c.w_bits=r,c.w_size=1<<c.w_bits,c.w_mask=c.w_size-1,c.hash_bits=a+7,c.hash_size=1<<c.hash_bits,c.hash_mask=c.hash_size-1,c.hash_shift=~~((c.hash_bits+C-1)/C),c.window=new i.Buf8(2*c.w_size),c.head=new i.Buf16(c.hash_size),c.prev=new i.Buf16(c.w_size),c.lit_bufsize=1<<a+6,c.pending_buf_size=4*c.lit_bufsize,c.pending_buf=new i.Buf8(c.pending_buf_size),c.d_buf=1*c.lit_bufsize,c.l_buf=3*c.lit_bufsize,c.level=t,c.strategy=o,c.method=n,G(e)}r=[new U(0,0,0,0,function(e,t){var n=65535;for(n>e.pending_buf_size-5&&(n=e.pending_buf_size-5);;){if(e.lookahead<=1){if(B(e),e.lookahead===0&&t===l)return O;if(e.lookahead===0)break}e.strstart+=e.lookahead,e.lookahead=0;var r=e.block_start+n;if((e.strstart===0||e.strstart>=r)&&(e.lookahead=e.strstart-r,e.strstart=r,I(e,!1),e.strm.avail_out===0)||e.strstart-e.block_start>=e.w_size-T&&(I(e,!1),e.strm.avail_out===0))return O}return e.insert=0,t===u?(I(e,!0),e.strm.avail_out===0?A:j):(e.strstart>e.block_start&&(I(e,!1),e.strm.avail_out),O)}),new U(4,4,8,4,V),new U(4,5,16,8,V),new U(4,6,32,32,V),new U(4,4,16,16,H),new U(8,16,32,32,H),new U(8,16,128,128,H),new U(8,32,128,256,H),new U(32,128,258,1024,H),new U(32,258,258,4096,H)],n.deflateInit=function(e,t){return K(e,t,g,15,8,0)},n.deflateInit2=K,n.deflateReset=G,n.deflateResetKeep=W,n.deflateSetHeader=function(e,t){return e&&e.state&&e.state.wrap===2?(e.state.gzhead=t,d):f},n.deflate=function(e,t){var n,i,o,c;if(!e||!e.state||5<t||t<0)return e?M(e,f):f;if(i=e.state,!e.output||!e.input&&e.avail_in!==0||i.status===666&&t!==u)return M(e,e.avail_out===0?-5:f);if(i.strm=e,n=i.last_flush,i.last_flush=t,i.status===E)if(i.wrap===2)e.adler=0,L(i,31),L(i,139),L(i,8),i.gzhead?(L(i,+!!i.gzhead.text+(i.gzhead.hcrc?2:0)+(i.gzhead.extra?4:0)+(i.gzhead.name?8:0)+(i.gzhead.comment?16:0)),L(i,255&i.gzhead.time),L(i,i.gzhead.time>>8&255),L(i,i.gzhead.time>>16&255),L(i,i.gzhead.time>>24&255),L(i,i.level===9?2:2<=i.strategy||i.level<2?4:0),L(i,255&i.gzhead.os),i.gzhead.extra&&i.gzhead.extra.length&&(L(i,255&i.gzhead.extra.length),L(i,i.gzhead.extra.length>>8&255)),i.gzhead.hcrc&&(e.adler=s(e.adler,i.pending_buf,i.pending,0)),i.gzindex=0,i.status=69):(L(i,0),L(i,0),L(i,0),L(i,0),L(i,0),L(i,i.level===9?2:2<=i.strategy||i.level<2?4:0),L(i,3),i.status=D);else{var p=g+(i.w_bits-8<<4)<<8;p|=(2<=i.strategy||i.level<2?0:i.level<6?1:i.level===6?2:3)<<6,i.strstart!==0&&(p|=32),p+=31-p%31,i.status=D,R(i,p),i.strstart!==0&&(R(i,e.adler>>>16),R(i,65535&e.adler)),e.adler=1}if(i.status===69)if(i.gzhead.extra){for(o=i.pending;i.gzindex<(65535&i.gzhead.extra.length)&&(i.pending!==i.pending_buf_size||(i.gzhead.hcrc&&i.pending>o&&(e.adler=s(e.adler,i.pending_buf,i.pending-o,o)),F(e),o=i.pending,i.pending!==i.pending_buf_size));)L(i,255&i.gzhead.extra[i.gzindex]),i.gzindex++;i.gzhead.hcrc&&i.pending>o&&(e.adler=s(e.adler,i.pending_buf,i.pending-o,o)),i.gzindex===i.gzhead.extra.length&&(i.gzindex=0,i.status=73)}else i.status=73;if(i.status===73)if(i.gzhead.name){o=i.pending;do{if(i.pending===i.pending_buf_size&&(i.gzhead.hcrc&&i.pending>o&&(e.adler=s(e.adler,i.pending_buf,i.pending-o,o)),F(e),o=i.pending,i.pending===i.pending_buf_size)){c=1;break}c=i.gzindex<i.gzhead.name.length?255&i.gzhead.name.charCodeAt(i.gzindex++):0,L(i,c)}while(c!==0);i.gzhead.hcrc&&i.pending>o&&(e.adler=s(e.adler,i.pending_buf,i.pending-o,o)),c===0&&(i.gzindex=0,i.status=91)}else i.status=91;if(i.status===91)if(i.gzhead.comment){o=i.pending;do{if(i.pending===i.pending_buf_size&&(i.gzhead.hcrc&&i.pending>o&&(e.adler=s(e.adler,i.pending_buf,i.pending-o,o)),F(e),o=i.pending,i.pending===i.pending_buf_size)){c=1;break}c=i.gzindex<i.gzhead.comment.length?255&i.gzhead.comment.charCodeAt(i.gzindex++):0,L(i,c)}while(c!==0);i.gzhead.hcrc&&i.pending>o&&(e.adler=s(e.adler,i.pending_buf,i.pending-o,o)),c===0&&(i.status=103)}else i.status=103;if(i.status===103&&(i.gzhead.hcrc?(i.pending+2>i.pending_buf_size&&F(e),i.pending+2<=i.pending_buf_size&&(L(i,255&e.adler),L(i,e.adler>>8&255),e.adler=0,i.status=D)):i.status=D),i.pending!==0){if(F(e),e.avail_out===0)return i.last_flush=-1,d}else if(e.avail_in===0&&N(t)<=N(n)&&t!==u)return M(e,-5);if(i.status===666&&e.avail_in!==0)return M(e,-5);if(e.avail_in!==0||i.lookahead!==0||t!==l&&i.status!==666){var m=i.strategy===2?function(e,t){for(var n;;){if(e.lookahead===0&&(B(e),e.lookahead===0)){if(t===l)return O;break}if(e.match_length=0,n=a._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++,n&&(I(e,!1),e.strm.avail_out===0))return O}return e.insert=0,t===u?(I(e,!0),e.strm.avail_out===0?A:j):e.last_lit&&(I(e,!1),e.strm.avail_out===0)?O:k}(i,t):i.strategy===3?function(e,t){for(var n,r,i,o,s=e.window;;){if(e.lookahead<=w){if(B(e),e.lookahead<=w&&t===l)return O;if(e.lookahead===0)break}if(e.match_length=0,e.lookahead>=C&&0<e.strstart&&(r=s[i=e.strstart-1])===s[++i]&&r===s[++i]&&r===s[++i]){o=e.strstart+w;do;while(r===s[++i]&&r===s[++i]&&r===s[++i]&&r===s[++i]&&r===s[++i]&&r===s[++i]&&r===s[++i]&&r===s[++i]&&i<o);e.match_length=w-(o-i),e.match_length>e.lookahead&&(e.match_length=e.lookahead)}if(e.match_length>=C?(n=a._tr_tally(e,1,e.match_length-C),e.lookahead-=e.match_length,e.strstart+=e.match_length,e.match_length=0):(n=a._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++),n&&(I(e,!1),e.strm.avail_out===0))return O}return e.insert=0,t===u?(I(e,!0),e.strm.avail_out===0?A:j):e.last_lit&&(I(e,!1),e.strm.avail_out===0)?O:k}(i,t):r[i.level].func(i,t);if(m!==A&&m!==j||(i.status=666),m===O||m===A)return e.avail_out===0&&(i.last_flush=-1),d;if(m===k&&(t===1?a._tr_align(i):t!==5&&(a._tr_stored_block(i,0,0,!1),t===3&&(P(i.head),i.lookahead===0&&(i.strstart=0,i.block_start=0,i.insert=0))),F(e),e.avail_out===0))return i.last_flush=-1,d}return t===u?i.wrap<=0?1:(i.wrap===2?(L(i,255&e.adler),L(i,e.adler>>8&255),L(i,e.adler>>16&255),L(i,e.adler>>24&255),L(i,255&e.total_in),L(i,e.total_in>>8&255),L(i,e.total_in>>16&255),L(i,e.total_in>>24&255)):(R(i,e.adler>>>16),R(i,65535&e.adler)),F(e),0<i.wrap&&(i.wrap=-i.wrap),i.pending===0?1:d):d},n.deflateEnd=function(e){var t;return e&&e.state?(t=e.state.status)!==E&&t!==69&&t!==73&&t!==91&&t!==103&&t!==D&&t!==666?M(e,f):(e.state=null,t===D?M(e,-3):d):f},n.deflateSetDictionary=function(e,t){var n,r,a,s,c,l,u,p,m=t.length;if(!e||!e.state||(s=(n=e.state).wrap)===2||s===1&&n.status!==E||n.lookahead)return f;for(s===1&&(e.adler=o(e.adler,t,m,0)),n.wrap=0,m>=n.w_size&&(s===0&&(P(n.head),n.strstart=0,n.block_start=0,n.insert=0),p=new i.Buf8(n.w_size),i.arraySet(p,t,m-n.w_size,n.w_size,0),t=p,m=n.w_size),c=e.avail_in,l=e.next_in,u=e.input,e.avail_in=m,e.next_in=0,e.input=t,B(n);n.lookahead>=C;){for(r=n.strstart,a=n.lookahead-(C-1);n.ins_h=(n.ins_h<<n.hash_shift^n.window[r+C-1])&n.hash_mask,n.prev[r&n.w_mask]=n.head[n.ins_h],n.head[n.ins_h]=r,r++,--a;);n.strstart=r,n.lookahead=C-1,B(n)}return n.strstart+=n.lookahead,n.block_start=n.strstart,n.insert=n.lookahead,n.lookahead=0,n.match_length=n.prev_length=C-1,n.match_available=0,e.next_in=l,e.input=u,e.avail_in=c,n.wrap=s,d},n.deflateInfo=`pako deflate (from Nodeca project)`},{"../utils/common":41,"./adler32":43,"./crc32":45,"./messages":51,"./trees":52}],47:[function(e,t,n){t.exports=function(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name=``,this.comment=``,this.hcrc=0,this.done=!1}},{}],48:[function(e,t,n){t.exports=function(e,t){var n=e.state,r=e.next_in,i,a,o,s,c,l,u,d,f,p,m,h,g,_,v,y,b,x,S,C,w,T=e.input,E;i=r+(e.avail_in-5),a=e.next_out,E=e.output,o=a-(t-e.avail_out),s=a+(e.avail_out-257),c=n.dmax,l=n.wsize,u=n.whave,d=n.wnext,f=n.window,p=n.hold,m=n.bits,h=n.lencode,g=n.distcode,_=(1<<n.lenbits)-1,v=(1<<n.distbits)-1;e:do{m<15&&(p+=T[r++]<<m,m+=8,p+=T[r++]<<m,m+=8),y=h[p&_];t:for(;;){if(p>>>=b=y>>>24,m-=b,(b=y>>>16&255)==0)E[a++]=65535&y;else{if(!(16&b)){if(!(64&b)){y=h[(65535&y)+(p&(1<<b)-1)];continue t}if(32&b){n.mode=12;break e}e.msg=`invalid literal/length code`,n.mode=30;break e}x=65535&y,(b&=15)&&(m<b&&(p+=T[r++]<<m,m+=8),x+=p&(1<<b)-1,p>>>=b,m-=b),m<15&&(p+=T[r++]<<m,m+=8,p+=T[r++]<<m,m+=8),y=g[p&v];r:for(;;){if(p>>>=b=y>>>24,m-=b,!(16&(b=y>>>16&255))){if(!(64&b)){y=g[(65535&y)+(p&(1<<b)-1)];continue r}e.msg=`invalid distance code`,n.mode=30;break e}if(S=65535&y,m<(b&=15)&&(p+=T[r++]<<m,(m+=8)<b&&(p+=T[r++]<<m,m+=8)),c<(S+=p&(1<<b)-1)){e.msg=`invalid distance too far back`,n.mode=30;break e}if(p>>>=b,m-=b,(b=a-o)<S){if(u<(b=S-b)&&n.sane){e.msg=`invalid distance too far back`,n.mode=30;break e}if(w=f,(C=0)===d){if(C+=l-b,b<x){for(x-=b;E[a++]=f[C++],--b;);C=a-S,w=E}}else if(d<b){if(C+=l+d-b,(b-=d)<x){for(x-=b;E[a++]=f[C++],--b;);if(C=0,d<x){for(x-=b=d;E[a++]=f[C++],--b;);C=a-S,w=E}}}else if(C+=d-b,b<x){for(x-=b;E[a++]=f[C++],--b;);C=a-S,w=E}for(;2<x;)E[a++]=w[C++],E[a++]=w[C++],E[a++]=w[C++],x-=3;x&&(E[a++]=w[C++],1<x&&(E[a++]=w[C++]))}else{for(C=a-S;E[a++]=E[C++],E[a++]=E[C++],E[a++]=E[C++],2<(x-=3););x&&(E[a++]=E[C++],1<x&&(E[a++]=E[C++]))}break}}break}}while(r<i&&a<s);r-=x=m>>3,p&=(1<<(m-=x<<3))-1,e.next_in=r,e.next_out=a,e.avail_in=r<i?i-r+5:5-(r-i),e.avail_out=a<s?s-a+257:257-(a-s),n.hold=p,n.bits=m}},{}],49:[function(e,t,n){var r=e(`../utils/common`),i=e(`./adler32`),a=e(`./crc32`),o=e(`./inffast`),s=e(`./inftrees`),c=1,l=2,u=0,d=-2,f=1,p=852,m=592;function h(e){return(e>>>24&255)+(e>>>8&65280)+((65280&e)<<8)+((255&e)<<24)}function g(){this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new r.Buf16(320),this.work=new r.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function _(e){var t;return e&&e.state?(t=e.state,e.total_in=e.total_out=t.total=0,e.msg=``,t.wrap&&(e.adler=1&t.wrap),t.mode=f,t.last=0,t.havedict=0,t.dmax=32768,t.head=null,t.hold=0,t.bits=0,t.lencode=t.lendyn=new r.Buf32(p),t.distcode=t.distdyn=new r.Buf32(m),t.sane=1,t.back=-1,u):d}function v(e){var t;return e&&e.state?((t=e.state).wsize=0,t.whave=0,t.wnext=0,_(e)):d}function y(e,t){var n,r;return e&&e.state?(r=e.state,t<0?(n=0,t=-t):(n=1+(t>>4),t<48&&(t&=15)),t&&(t<8||15<t)?d:(r.window!==null&&r.wbits!==t&&(r.window=null),r.wrap=n,r.wbits=t,v(e))):d}function b(e,t){var n,r;return e?(r=new g,(e.state=r).window=null,(n=y(e,t))!==u&&(e.state=null),n):d}var x,S,C=!0;function w(e){if(C){var t;for(x=new r.Buf32(512),S=new r.Buf32(32),t=0;t<144;)e.lens[t++]=8;for(;t<256;)e.lens[t++]=9;for(;t<280;)e.lens[t++]=7;for(;t<288;)e.lens[t++]=8;for(s(c,e.lens,0,288,x,0,e.work,{bits:9}),t=0;t<32;)e.lens[t++]=5;s(l,e.lens,0,32,S,0,e.work,{bits:5}),C=!1}e.lencode=x,e.lenbits=9,e.distcode=S,e.distbits=5}function T(e,t,n,i){var a,o=e.state;return o.window===null&&(o.wsize=1<<o.wbits,o.wnext=0,o.whave=0,o.window=new r.Buf8(o.wsize)),i>=o.wsize?(r.arraySet(o.window,t,n-o.wsize,o.wsize,0),o.wnext=0,o.whave=o.wsize):(i<(a=o.wsize-o.wnext)&&(a=i),r.arraySet(o.window,t,n-i,a,o.wnext),(i-=a)?(r.arraySet(o.window,t,n-i,i,0),o.wnext=i,o.whave=o.wsize):(o.wnext+=a,o.wnext===o.wsize&&(o.wnext=0),o.whave<o.wsize&&(o.whave+=a))),0}n.inflateReset=v,n.inflateReset2=y,n.inflateResetKeep=_,n.inflateInit=function(e){return b(e,15)},n.inflateInit2=b,n.inflate=function(e,t){var n,p,m,g,_,v,y,b,x,S,C,E,D,O,k,A,j,M,N,P,F,I,L,R,z=0,B=new r.Buf8(4),V=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!e||!e.state||!e.output||!e.input&&e.avail_in!==0)return d;(n=e.state).mode===12&&(n.mode=13),_=e.next_out,m=e.output,y=e.avail_out,g=e.next_in,p=e.input,v=e.avail_in,b=n.hold,x=n.bits,S=v,C=y,I=u;e:for(;;)switch(n.mode){case f:if(n.wrap===0){n.mode=13;break}for(;x<16;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}if(2&n.wrap&&b===35615){B[n.check=0]=255&b,B[1]=b>>>8&255,n.check=a(n.check,B,2,0),x=b=0,n.mode=2;break}if(n.flags=0,n.head&&(n.head.done=!1),!(1&n.wrap)||(((255&b)<<8)+(b>>8))%31){e.msg=`incorrect header check`,n.mode=30;break}if((15&b)!=8){e.msg=`unknown compression method`,n.mode=30;break}if(x-=4,F=8+(15&(b>>>=4)),n.wbits===0)n.wbits=F;else if(F>n.wbits){e.msg=`invalid window size`,n.mode=30;break}n.dmax=1<<F,e.adler=n.check=1,n.mode=512&b?10:12,x=b=0;break;case 2:for(;x<16;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}if(n.flags=b,(255&n.flags)!=8){e.msg=`unknown compression method`,n.mode=30;break}if(57344&n.flags){e.msg=`unknown header flags set`,n.mode=30;break}n.head&&(n.head.text=b>>8&1),512&n.flags&&(B[0]=255&b,B[1]=b>>>8&255,n.check=a(n.check,B,2,0)),x=b=0,n.mode=3;case 3:for(;x<32;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}n.head&&(n.head.time=b),512&n.flags&&(B[0]=255&b,B[1]=b>>>8&255,B[2]=b>>>16&255,B[3]=b>>>24&255,n.check=a(n.check,B,4,0)),x=b=0,n.mode=4;case 4:for(;x<16;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}n.head&&(n.head.xflags=255&b,n.head.os=b>>8),512&n.flags&&(B[0]=255&b,B[1]=b>>>8&255,n.check=a(n.check,B,2,0)),x=b=0,n.mode=5;case 5:if(1024&n.flags){for(;x<16;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}n.length=b,n.head&&(n.head.extra_len=b),512&n.flags&&(B[0]=255&b,B[1]=b>>>8&255,n.check=a(n.check,B,2,0)),x=b=0}else n.head&&(n.head.extra=null);n.mode=6;case 6:if(1024&n.flags&&(v<(E=n.length)&&(E=v),E&&(n.head&&(F=n.head.extra_len-n.length,n.head.extra||(n.head.extra=Array(n.head.extra_len)),r.arraySet(n.head.extra,p,g,E,F)),512&n.flags&&(n.check=a(n.check,p,E,g)),v-=E,g+=E,n.length-=E),n.length))break e;n.length=0,n.mode=7;case 7:if(2048&n.flags){if(v===0)break e;for(E=0;F=p[g+E++],n.head&&F&&n.length<65536&&(n.head.name+=String.fromCharCode(F)),F&&E<v;);if(512&n.flags&&(n.check=a(n.check,p,E,g)),v-=E,g+=E,F)break e}else n.head&&(n.head.name=null);n.length=0,n.mode=8;case 8:if(4096&n.flags){if(v===0)break e;for(E=0;F=p[g+E++],n.head&&F&&n.length<65536&&(n.head.comment+=String.fromCharCode(F)),F&&E<v;);if(512&n.flags&&(n.check=a(n.check,p,E,g)),v-=E,g+=E,F)break e}else n.head&&(n.head.comment=null);n.mode=9;case 9:if(512&n.flags){for(;x<16;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}if(b!==(65535&n.check)){e.msg=`header crc mismatch`,n.mode=30;break}x=b=0}n.head&&(n.head.hcrc=n.flags>>9&1,n.head.done=!0),e.adler=n.check=0,n.mode=12;break;case 10:for(;x<32;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}e.adler=n.check=h(b),x=b=0,n.mode=11;case 11:if(n.havedict===0)return e.next_out=_,e.avail_out=y,e.next_in=g,e.avail_in=v,n.hold=b,n.bits=x,2;e.adler=n.check=1,n.mode=12;case 12:if(t===5||t===6)break e;case 13:if(n.last){b>>>=7&x,x-=7&x,n.mode=27;break}for(;x<3;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}switch(n.last=1&b,--x,3&(b>>>=1)){case 0:n.mode=14;break;case 1:if(w(n),n.mode=20,t!==6)break;b>>>=2,x-=2;break e;case 2:n.mode=17;break;case 3:e.msg=`invalid block type`,n.mode=30}b>>>=2,x-=2;break;case 14:for(b>>>=7&x,x-=7&x;x<32;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}if((65535&b)!=(b>>>16^65535)){e.msg=`invalid stored block lengths`,n.mode=30;break}if(n.length=65535&b,x=b=0,n.mode=15,t===6)break e;case 15:n.mode=16;case 16:if(E=n.length){if(v<E&&(E=v),y<E&&(E=y),E===0)break e;r.arraySet(m,p,g,E,_),v-=E,g+=E,y-=E,_+=E,n.length-=E;break}n.mode=12;break;case 17:for(;x<14;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}if(n.nlen=257+(31&b),b>>>=5,x-=5,n.ndist=1+(31&b),b>>>=5,x-=5,n.ncode=4+(15&b),b>>>=4,x-=4,286<n.nlen||30<n.ndist){e.msg=`too many length or distance symbols`,n.mode=30;break}n.have=0,n.mode=18;case 18:for(;n.have<n.ncode;){for(;x<3;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}n.lens[V[n.have++]]=7&b,b>>>=3,x-=3}for(;n.have<19;)n.lens[V[n.have++]]=0;if(n.lencode=n.lendyn,n.lenbits=7,L={bits:n.lenbits},I=s(0,n.lens,0,19,n.lencode,0,n.work,L),n.lenbits=L.bits,I){e.msg=`invalid code lengths set`,n.mode=30;break}n.have=0,n.mode=19;case 19:for(;n.have<n.nlen+n.ndist;){for(;A=(z=n.lencode[b&(1<<n.lenbits)-1])>>>16&255,j=65535&z,!((k=z>>>24)<=x);){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}if(j<16)b>>>=k,x-=k,n.lens[n.have++]=j;else{if(j===16){for(R=k+2;x<R;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}if(b>>>=k,x-=k,n.have===0){e.msg=`invalid bit length repeat`,n.mode=30;break}F=n.lens[n.have-1],E=3+(3&b),b>>>=2,x-=2}else if(j===17){for(R=k+3;x<R;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}x-=k,F=0,E=3+(7&(b>>>=k)),b>>>=3,x-=3}else{for(R=k+7;x<R;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}x-=k,F=0,E=11+(127&(b>>>=k)),b>>>=7,x-=7}if(n.have+E>n.nlen+n.ndist){e.msg=`invalid bit length repeat`,n.mode=30;break}for(;E--;)n.lens[n.have++]=F}}if(n.mode===30)break;if(n.lens[256]===0){e.msg=`invalid code -- missing end-of-block`,n.mode=30;break}if(n.lenbits=9,L={bits:n.lenbits},I=s(c,n.lens,0,n.nlen,n.lencode,0,n.work,L),n.lenbits=L.bits,I){e.msg=`invalid literal/lengths set`,n.mode=30;break}if(n.distbits=6,n.distcode=n.distdyn,L={bits:n.distbits},I=s(l,n.lens,n.nlen,n.ndist,n.distcode,0,n.work,L),n.distbits=L.bits,I){e.msg=`invalid distances set`,n.mode=30;break}if(n.mode=20,t===6)break e;case 20:n.mode=21;case 21:if(6<=v&&258<=y){e.next_out=_,e.avail_out=y,e.next_in=g,e.avail_in=v,n.hold=b,n.bits=x,o(e,C),_=e.next_out,m=e.output,y=e.avail_out,g=e.next_in,p=e.input,v=e.avail_in,b=n.hold,x=n.bits,n.mode===12&&(n.back=-1);break}for(n.back=0;A=(z=n.lencode[b&(1<<n.lenbits)-1])>>>16&255,j=65535&z,!((k=z>>>24)<=x);){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}if(A&&!(240&A)){for(M=k,N=A,P=j;A=(z=n.lencode[P+((b&(1<<M+N)-1)>>M)])>>>16&255,j=65535&z,!(M+(k=z>>>24)<=x);){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}b>>>=M,x-=M,n.back+=M}if(b>>>=k,x-=k,n.back+=k,n.length=j,A===0){n.mode=26;break}if(32&A){n.back=-1,n.mode=12;break}if(64&A){e.msg=`invalid literal/length code`,n.mode=30;break}n.extra=15&A,n.mode=22;case 22:if(n.extra){for(R=n.extra;x<R;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}n.length+=b&(1<<n.extra)-1,b>>>=n.extra,x-=n.extra,n.back+=n.extra}n.was=n.length,n.mode=23;case 23:for(;A=(z=n.distcode[b&(1<<n.distbits)-1])>>>16&255,j=65535&z,!((k=z>>>24)<=x);){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}if(!(240&A)){for(M=k,N=A,P=j;A=(z=n.distcode[P+((b&(1<<M+N)-1)>>M)])>>>16&255,j=65535&z,!(M+(k=z>>>24)<=x);){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}b>>>=M,x-=M,n.back+=M}if(b>>>=k,x-=k,n.back+=k,64&A){e.msg=`invalid distance code`,n.mode=30;break}n.offset=j,n.extra=15&A,n.mode=24;case 24:if(n.extra){for(R=n.extra;x<R;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}n.offset+=b&(1<<n.extra)-1,b>>>=n.extra,x-=n.extra,n.back+=n.extra}if(n.offset>n.dmax){e.msg=`invalid distance too far back`,n.mode=30;break}n.mode=25;case 25:if(y===0)break e;if(E=C-y,n.offset>E){if((E=n.offset-E)>n.whave&&n.sane){e.msg=`invalid distance too far back`,n.mode=30;break}D=E>n.wnext?(E-=n.wnext,n.wsize-E):n.wnext-E,E>n.length&&(E=n.length),O=n.window}else O=m,D=_-n.offset,E=n.length;for(y<E&&(E=y),y-=E,n.length-=E;m[_++]=O[D++],--E;);n.length===0&&(n.mode=21);break;case 26:if(y===0)break e;m[_++]=n.length,y--,n.mode=21;break;case 27:if(n.wrap){for(;x<32;){if(v===0)break e;v--,b|=p[g++]<<x,x+=8}if(C-=y,e.total_out+=C,n.total+=C,C&&(e.adler=n.check=n.flags?a(n.check,m,C,_-C):i(n.check,m,C,_-C)),C=y,(n.flags?b:h(b))!==n.check){e.msg=`incorrect data check`,n.mode=30;break}x=b=0}n.mode=28;case 28:if(n.wrap&&n.flags){for(;x<32;){if(v===0)break e;v--,b+=p[g++]<<x,x+=8}if(b!==(4294967295&n.total)){e.msg=`incorrect length check`,n.mode=30;break}x=b=0}n.mode=29;case 29:I=1;break e;case 30:I=-3;break e;case 31:return-4;case 32:default:return d}return e.next_out=_,e.avail_out=y,e.next_in=g,e.avail_in=v,n.hold=b,n.bits=x,(n.wsize||C!==e.avail_out&&n.mode<30&&(n.mode<27||t!==4))&&T(e,e.output,e.next_out,C-e.avail_out)?(n.mode=31,-4):(S-=e.avail_in,C-=e.avail_out,e.total_in+=S,e.total_out+=C,n.total+=C,n.wrap&&C&&(e.adler=n.check=n.flags?a(n.check,m,C,e.next_out-C):i(n.check,m,C,e.next_out-C)),e.data_type=n.bits+(n.last?64:0)+(n.mode===12?128:0)+(n.mode===20||n.mode===15?256:0),(S==0&&C===0||t===4)&&I===u&&(I=-5),I)},n.inflateEnd=function(e){if(!e||!e.state)return d;var t=e.state;return t.window&&=null,e.state=null,u},n.inflateGetHeader=function(e,t){var n;return e&&e.state&&2&(n=e.state).wrap?((n.head=t).done=!1,u):d},n.inflateSetDictionary=function(e,t){var n,r=t.length;return e&&e.state?(n=e.state).wrap!==0&&n.mode!==11?d:n.mode===11&&i(1,t,r,0)!==n.check?-3:T(e,t,r,r)?(n.mode=31,-4):(n.havedict=1,u):d},n.inflateInfo=`pako inflate (from Nodeca project)`},{"../utils/common":41,"./adler32":43,"./crc32":45,"./inffast":48,"./inftrees":50}],50:[function(e,t,n){var r=e(`../utils/common`),i=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],a=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],o=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],s=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64];t.exports=function(e,t,n,c,l,u,d,f){var p,m,h,g,_,v,y,b,x,S=f.bits,C=0,w=0,T=0,E=0,D=0,O=0,k=0,A=0,j=0,M=0,N=null,P=0,F=new r.Buf16(16),I=new r.Buf16(16),L=null,R=0;for(C=0;C<=15;C++)F[C]=0;for(w=0;w<c;w++)F[t[n+w]]++;for(D=S,E=15;1<=E&&F[E]===0;E--);if(E<D&&(D=E),E===0)return l[u++]=20971520,l[u++]=20971520,f.bits=1,0;for(T=1;T<E&&F[T]===0;T++);for(D<T&&(D=T),C=A=1;C<=15;C++)if(A<<=1,(A-=F[C])<0)return-1;if(0<A&&(e===0||E!==1))return-1;for(I[1]=0,C=1;C<15;C++)I[C+1]=I[C]+F[C];for(w=0;w<c;w++)t[n+w]!==0&&(d[I[t[n+w]]++]=w);if(v=e===0?(N=L=d,19):e===1?(N=i,P-=257,L=a,R-=257,256):(N=o,L=s,-1),C=T,_=u,k=w=M=0,h=-1,g=(j=1<<(O=D))-1,e===1&&852<j||e===2&&592<j)return 1;for(;;){for(y=C-k,x=d[w]<v?(b=0,d[w]):d[w]>v?(b=L[R+d[w]],N[P+d[w]]):(b=96,0),p=1<<C-k,T=m=1<<O;l[_+(M>>k)+(m-=p)]=y<<24|b<<16|x|0,m!==0;);for(p=1<<C-1;M&p;)p>>=1;if(p===0?M=0:(M&=p-1,M+=p),w++,--F[C]==0){if(C===E)break;C=t[n+d[w]]}if(D<C&&(M&g)!==h){for(k===0&&(k=D),_+=T,A=1<<(O=C-k);O+k<E&&!((A-=F[O+k])<=0);)O++,A<<=1;if(j+=1<<O,e===1&&852<j||e===2&&592<j)return 1;l[h=M&g]=D<<24|O<<16|_-u|0}}return M!==0&&(l[_+M]=C-k<<24|4194304),f.bits=D,0}},{"../utils/common":41}],51:[function(e,t,n){t.exports={2:`need dictionary`,1:`stream end`,0:``,"-1":`file error`,"-2":`stream error`,"-3":`data error`,"-4":`insufficient memory`,"-5":`buffer error`,"-6":`incompatible version`}},{}],52:[function(e,t,n){var r=e(`../utils/common`),i=0,a=1;function o(e){for(var t=e.length;0<=--t;)e[t]=0}var s=0,c=29,l=256,u=l+1+c,d=30,f=19,p=2*u+1,m=15,h=16,g=7,_=256,v=16,y=17,b=18,x=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],S=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],C=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7],w=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],T=Array(2*(u+2));o(T);var E=Array(2*d);o(E);var D=Array(512);o(D);var O=Array(256);o(O);var k=Array(c);o(k);var A,j,M,N=Array(d);function P(e,t,n,r,i){this.static_tree=e,this.extra_bits=t,this.extra_base=n,this.elems=r,this.max_length=i,this.has_stree=e&&e.length}function F(e,t){this.dyn_tree=e,this.max_code=0,this.stat_desc=t}function I(e){return e<256?D[e]:D[256+(e>>>7)]}function L(e,t){e.pending_buf[e.pending++]=255&t,e.pending_buf[e.pending++]=t>>>8&255}function R(e,t,n){e.bi_valid>h-n?(e.bi_buf|=t<<e.bi_valid&65535,L(e,e.bi_buf),e.bi_buf=t>>h-e.bi_valid,e.bi_valid+=n-h):(e.bi_buf|=t<<e.bi_valid&65535,e.bi_valid+=n)}function z(e,t,n){R(e,n[2*t],n[2*t+1])}function B(e,t){for(var n=0;n|=1&e,e>>>=1,n<<=1,0<--t;);return n>>>1}function V(e,t,n){var r,i,a=Array(m+1),o=0;for(r=1;r<=m;r++)a[r]=o=o+n[r-1]<<1;for(i=0;i<=t;i++){var s=e[2*i+1];s!==0&&(e[2*i]=B(a[s]++,s))}}function H(e){var t;for(t=0;t<u;t++)e.dyn_ltree[2*t]=0;for(t=0;t<d;t++)e.dyn_dtree[2*t]=0;for(t=0;t<f;t++)e.bl_tree[2*t]=0;e.dyn_ltree[2*_]=1,e.opt_len=e.static_len=0,e.last_lit=e.matches=0}function U(e){8<e.bi_valid?L(e,e.bi_buf):0<e.bi_valid&&(e.pending_buf[e.pending++]=e.bi_buf),e.bi_buf=0,e.bi_valid=0}function ee(e,t,n,r){var i=2*t,a=2*n;return e[i]<e[a]||e[i]===e[a]&&r[t]<=r[n]}function W(e,t,n){for(var r=e.heap[n],i=n<<1;i<=e.heap_len&&(i<e.heap_len&&ee(t,e.heap[i+1],e.heap[i],e.depth)&&i++,!ee(t,r,e.heap[i],e.depth));)e.heap[n]=e.heap[i],n=i,i<<=1;e.heap[n]=r}function G(e,t,n){var r,i,a,o,s=0;if(e.last_lit!==0)for(;r=e.pending_buf[e.d_buf+2*s]<<8|e.pending_buf[e.d_buf+2*s+1],i=e.pending_buf[e.l_buf+s],s++,r===0?z(e,i,t):(z(e,(a=O[i])+l+1,t),(o=x[a])!==0&&R(e,i-=k[a],o),z(e,a=I(--r),n),(o=S[a])!==0&&R(e,r-=N[a],o)),s<e.last_lit;);z(e,_,t)}function K(e,t){var n,r,i,a=t.dyn_tree,o=t.stat_desc.static_tree,s=t.stat_desc.has_stree,c=t.stat_desc.elems,l=-1;for(e.heap_len=0,e.heap_max=p,n=0;n<c;n++)a[2*n]===0?a[2*n+1]=0:(e.heap[++e.heap_len]=l=n,e.depth[n]=0);for(;e.heap_len<2;)a[2*(i=e.heap[++e.heap_len]=l<2?++l:0)]=1,e.depth[i]=0,e.opt_len--,s&&(e.static_len-=o[2*i+1]);for(t.max_code=l,n=e.heap_len>>1;1<=n;n--)W(e,a,n);for(i=c;n=e.heap[1],e.heap[1]=e.heap[e.heap_len--],W(e,a,1),r=e.heap[1],e.heap[--e.heap_max]=n,e.heap[--e.heap_max]=r,a[2*i]=a[2*n]+a[2*r],e.depth[i]=(e.depth[n]>=e.depth[r]?e.depth[n]:e.depth[r])+1,a[2*n+1]=a[2*r+1]=i,e.heap[1]=i++,W(e,a,1),2<=e.heap_len;);e.heap[--e.heap_max]=e.heap[1],function(e,t){var n,r,i,a,o,s,c=t.dyn_tree,l=t.max_code,u=t.stat_desc.static_tree,d=t.stat_desc.has_stree,f=t.stat_desc.extra_bits,h=t.stat_desc.extra_base,g=t.stat_desc.max_length,_=0;for(a=0;a<=m;a++)e.bl_count[a]=0;for(c[2*e.heap[e.heap_max]+1]=0,n=e.heap_max+1;n<p;n++)g<(a=c[2*c[2*(r=e.heap[n])+1]+1]+1)&&(a=g,_++),c[2*r+1]=a,l<r||(e.bl_count[a]++,o=0,h<=r&&(o=f[r-h]),s=c[2*r],e.opt_len+=s*(a+o),d&&(e.static_len+=s*(u[2*r+1]+o)));if(_!==0){do{for(a=g-1;e.bl_count[a]===0;)a--;e.bl_count[a]--,e.bl_count[a+1]+=2,e.bl_count[g]--,_-=2}while(0<_);for(a=g;a!==0;a--)for(r=e.bl_count[a];r!==0;)l<(i=e.heap[--n])||(c[2*i+1]!==a&&(e.opt_len+=(a-c[2*i+1])*c[2*i],c[2*i+1]=a),r--)}}(e,t),V(a,l,e.bl_count)}function te(e,t,n){var r,i,a=-1,o=t[1],s=0,c=7,l=4;for(o===0&&(c=138,l=3),t[2*(n+1)+1]=65535,r=0;r<=n;r++)i=o,o=t[2*(r+1)+1],++s<c&&i===o||(s<l?e.bl_tree[2*i]+=s:i===0?s<=10?e.bl_tree[2*y]++:e.bl_tree[2*b]++:(i!==a&&e.bl_tree[2*i]++,e.bl_tree[2*v]++),a=i,l=(s=0)===o?(c=138,3):i===o?(c=6,3):(c=7,4))}function ne(e,t,n){var r,i,a=-1,o=t[1],s=0,c=7,l=4;for(o===0&&(c=138,l=3),r=0;r<=n;r++)if(i=o,o=t[2*(r+1)+1],!(++s<c&&i===o)){if(s<l)for(;z(e,i,e.bl_tree),--s!=0;);else i===0?s<=10?(z(e,y,e.bl_tree),R(e,s-3,3)):(z(e,b,e.bl_tree),R(e,s-11,7)):(i!==a&&(z(e,i,e.bl_tree),s--),z(e,v,e.bl_tree),R(e,s-3,2));a=i,l=(s=0)===o?(c=138,3):i===o?(c=6,3):(c=7,4)}}o(N);var q=!1;function J(e,t,n,i){R(e,(s<<1)+ +!!i,3),function(e,t,n,i){U(e),i&&(L(e,n),L(e,~n)),r.arraySet(e.pending_buf,e.window,t,n,e.pending),e.pending+=n}(e,t,n,!0)}n._tr_init=function(e){q||=(function(){var e,t,n,r,i,a=Array(m+1);for(r=n=0;r<c-1;r++)for(k[r]=n,e=0;e<1<<x[r];e++)O[n++]=r;for(O[n-1]=r,r=i=0;r<16;r++)for(N[r]=i,e=0;e<1<<S[r];e++)D[i++]=r;for(i>>=7;r<d;r++)for(N[r]=i<<7,e=0;e<1<<S[r]-7;e++)D[256+i++]=r;for(t=0;t<=m;t++)a[t]=0;for(e=0;e<=143;)T[2*e+1]=8,e++,a[8]++;for(;e<=255;)T[2*e+1]=9,e++,a[9]++;for(;e<=279;)T[2*e+1]=7,e++,a[7]++;for(;e<=287;)T[2*e+1]=8,e++,a[8]++;for(V(T,u+1,a),e=0;e<d;e++)E[2*e+1]=5,E[2*e]=B(e,5);A=new P(T,x,l+1,u,m),j=new P(E,S,0,d,m),M=new P([],C,0,f,g)}(),!0),e.l_desc=new F(e.dyn_ltree,A),e.d_desc=new F(e.dyn_dtree,j),e.bl_desc=new F(e.bl_tree,M),e.bi_buf=0,e.bi_valid=0,H(e)},n._tr_stored_block=J,n._tr_flush_block=function(e,t,n,r){var o,s,c=0;0<e.level?(e.strm.data_type===2&&(e.strm.data_type=function(e){var t,n=4093624447;for(t=0;t<=31;t++,n>>>=1)if(1&n&&e.dyn_ltree[2*t]!==0)return i;if(e.dyn_ltree[18]!==0||e.dyn_ltree[20]!==0||e.dyn_ltree[26]!==0)return a;for(t=32;t<l;t++)if(e.dyn_ltree[2*t]!==0)return a;return i}(e)),K(e,e.l_desc),K(e,e.d_desc),c=function(e){var t;for(te(e,e.dyn_ltree,e.l_desc.max_code),te(e,e.dyn_dtree,e.d_desc.max_code),K(e,e.bl_desc),t=f-1;3<=t&&e.bl_tree[2*w[t]+1]===0;t--);return e.opt_len+=3*(t+1)+5+5+4,t}(e),o=e.opt_len+3+7>>>3,(s=e.static_len+3+7>>>3)<=o&&(o=s)):o=s=n+5,n+4<=o&&t!==-1?J(e,t,n,r):e.strategy===4||s===o?(R(e,2+ +!!r,3),G(e,T,E)):(R(e,4+ +!!r,3),function(e,t,n,r){var i;for(R(e,t-257,5),R(e,n-1,5),R(e,r-4,4),i=0;i<r;i++)R(e,e.bl_tree[2*w[i]+1],3);ne(e,e.dyn_ltree,t-1),ne(e,e.dyn_dtree,n-1)}(e,e.l_desc.max_code+1,e.d_desc.max_code+1,c+1),G(e,e.dyn_ltree,e.dyn_dtree)),H(e),r&&U(e)},n._tr_tally=function(e,t,n){return e.pending_buf[e.d_buf+2*e.last_lit]=t>>>8&255,e.pending_buf[e.d_buf+2*e.last_lit+1]=255&t,e.pending_buf[e.l_buf+e.last_lit]=255&n,e.last_lit++,t===0?e.dyn_ltree[2*n]++:(e.matches++,t--,e.dyn_ltree[2*(O[n]+l+1)]++,e.dyn_dtree[2*I(t)]++),e.last_lit===e.lit_bufsize-1},n._tr_align=function(e){R(e,2,3),z(e,_,T),function(e){e.bi_valid===16?(L(e,e.bi_buf),e.bi_buf=0,e.bi_valid=0):8<=e.bi_valid&&(e.pending_buf[e.pending++]=255&e.bi_buf,e.bi_buf>>=8,e.bi_valid-=8)}(e)}},{"../utils/common":41}],53:[function(e,t,n){t.exports=function(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg=``,this.state=null,this.data_type=2,this.adler=0}},{}],54:[function(e,t,n){(function(e){(function(e,t){if(!e.setImmediate){var n,r,a,o,s=1,c={},l=!1,u=e.document,d=Object.getPrototypeOf&&Object.getPrototypeOf(e);d=d&&d.setTimeout?d:e,n={}.toString.call(e.process)===`[object process]`?function(e){i.default.nextTick(function(){p(e)})}:function(){if(e.postMessage&&!e.importScripts){var t=!0,n=e.onmessage;return e.onmessage=function(){t=!1},e.postMessage(``,`*`),e.onmessage=n,t}}()?(o=`setImmediate$`+Math.random()+`$`,e.addEventListener?e.addEventListener(`message`,m,!1):e.attachEvent(`onmessage`,m),function(t){e.postMessage(o+t,`*`)}):e.MessageChannel?((a=new MessageChannel).port1.onmessage=function(e){p(e.data)},function(e){a.port2.postMessage(e)}):u&&`onreadystatechange`in u.createElement(`script`)?(r=u.documentElement,function(e){var t=u.createElement(`script`);t.onreadystatechange=function(){p(e),t.onreadystatechange=null,r.removeChild(t),t=null},r.appendChild(t)}):function(e){setTimeout(p,0,e)},d.setImmediate=function(e){typeof e!=`function`&&(e=Function(``+e));for(var t=Array(arguments.length-1),r=0;r<t.length;r++)t[r]=arguments[r+1];return c[s]={callback:e,args:t},n(s),s++},d.clearImmediate=f}function f(e){delete c[e]}function p(e){if(l)setTimeout(p,0,e);else{var n=c[e];if(n){l=!0;try{(function(e){var n=e.callback,r=e.args;switch(r.length){case 0:n();break;case 1:n(r[0]);break;case 2:n(r[0],r[1]);break;case 3:n(r[0],r[1],r[2]);break;default:n.apply(t,r)}})(n)}finally{f(e),l=!1}}}}function m(t){t.source===e&&typeof t.data==`string`&&t.data.indexOf(o)===0&&p(+t.data.slice(o.length))}})(typeof self>`u`?e===void 0?this:e:self)}).call(this,typeof globalThis<`u`?globalThis:typeof self<`u`?self:typeof window<`u`?window:{})},{}]},{},[10])(10)})}))(),1);function V(e,t){return o(e,`sessions`,`readonly`,e=>e.get(t))}async function H(e,t){try{let n=e?.transaction(`messages`,`readonly`);if(!n)throw Error(`cannot get transaction to export chat data`);let r=n.objectStore(`messages`).index(`by-group`);return{messages:await new Promise((e,n)=>{let i=r.getAll(t);i.onsuccess=()=>e(i.result),i.onerror=()=>n(i.error)}),session:await V(e,t)}}catch(e){return console.error(`Failed to export chat data:`,e),null}}function U(e,t){return o(e,`sessions`,`readwrite`,e=>e.put(t)).then(()=>void 0)}async function ee(e,t,n){try{await h(e,t);let r=e?.transaction(`sessions`,`readwrite`);if(!r)throw Error(`cannot get existing session for this group from transaction`);let i=r.objectStore(`sessions`);if(await new Promise((e,n)=>{let r=i.delete(t);r.onsuccess=()=>e(void 0),r.onerror=()=>n(r.error)}),n.messages&&Array.isArray(n.messages))for(let r of n.messages)r.groupId=t,await y(e,r);n.session&&(n.session.groupId=t,await U(e,n.session))}catch(e){throw console.error(`Failed to import chat data:`,e),e}}const W=new class{_attachmentObjectUrls;_isNearBottom;_nearBottomSnapshot;_scrollStateByGroup;constructor(){this._isNearBottom=new f.State(!0),this._nearBottomSnapshot=!0,this._attachmentObjectUrls=new Set,this._scrollStateByGroup=new Map}getGroupScrollState(e){return this._scrollStateByGroup.get(e)??null}get isNearBottom(){return this._isNearBottom.get()}get nearBottomSnapshot(){return this._nearBottomSnapshot}registerAttachmentObjectUrl(e){this._attachmentObjectUrls.add(e)}reset(){this.revokeAttachmentObjectUrls(),this._scrollStateByGroup.clear(),this.resetNearBottom()}resetNearBottom(){this._nearBottomSnapshot=!0,this._isNearBottom.set(!0)}revokeAttachmentObjectUrls(){for(let e of this._attachmentObjectUrls)URL.revokeObjectURL(e);this._attachmentObjectUrls.clear()}setGroupScrollState(e,t,n){this._scrollStateByGroup.set(e,{distanceFromBottom:t,nearBottom:n})}setNearBottom(e){this._nearBottomSnapshot=e,this._isNearBottom.set(e)}};function G(e){let t=(e.cacheReadTokens||0)+(e.cacheCreationTokens||0),n=(e.inputTokens||0)+t,r=e.outputTokens||0;return{cacheTokens:t,promptTokens:n,outputTokens:r,totalTokens:e.totalTokens||n+r}}function K(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/\"/g,`&quot;`).replace(/'/g,`&#39;`)}function te(e,t){return e===`idle`&&t?`responding`:e}var ne=class extends HTMLElement{constructor(){super(),this.attachShadow({mode:`open`});let e=document.createElement(`slot`);this.shadowRoot.appendChild(e)}connectedCallback(){this.addEventListener(`shadow-claw-a2ui-action`,this.#e)}disconnectedCallback(){this.removeEventListener(`shadow-claw-a2ui-action`,this.#e)}#e=e=>{let t=e.detail?.action?.actionId;if(t){if(t===`playTrack`||t===`play`){let t=this.querySelector(`shadow-claw-a2ui`),n=!1;if(t&&t.shadowRoot){let e=t.shadowRoot.querySelectorAll(`audio, video`);e.length>0&&(e.forEach(e=>e.play().catch(console.error)),n=!0)}if(n){e.stopPropagation();return}}if(t===`pauseTrack`||t===`pause`){let t=this.querySelector(`shadow-claw-a2ui`),n=!1;if(t&&t.shadowRoot){let e=t.shadowRoot.querySelectorAll(`audio, video`);e.length>0&&(e.forEach(e=>e.pause()),n=!0)}if(n){e.stopPropagation();return}}if(t===`closeModal`||t===`close`){let t=this.querySelector(`shadow-claw-a2ui`),n=!1;if(t&&t.shadowRoot&&t.shadowRoot.querySelectorAll(`.a2ui__modal-overlay`).forEach(e=>{if(e.style.display!==`none`){let t=e.querySelector(`.a2ui__modal-close`);t&&t.click(),n=!0}}),n){e.stopPropagation();return}}}}};customElements.get(`shadow-claw-a2ui-interceptor`)||customElements.define(`shadow-claw-a2ui-interceptor`,ne);const q=new class{renderers=new Map;register(e,t){this.renderers.set(e,t)}get(e){return this.renderers.get(e)}},J=new class{functions=new Map;register(e){this.functions.set(e.name,e)}get(e){return this.functions.get(e)}execute(e,t,n){let r=this.functions.get(e);if(!r)throw Error(`INVALID_FUNCTION_CALL: Unregistered function ${e}`);return r.evaluate(t,n)}};function Y(e,t){if(!t||t===`/`)return e;let n=t.replace(/^\//,``).split(`/`).map(e=>e.replace(/~1/g,`/`).replace(/~0/g,`~`)),r=e;for(let e of n){if(typeof r!=`object`||!r)return;r=r[e]}return r}function X(e,t){if(e==null)return!1;if(typeof e==`boolean`)return e;if(typeof e==`object`&&`path`in e)return!!Y(t,e.path);if(typeof e==`object`&&`$dataModel`in e)return!!Y(t,e.$dataModel);if(typeof e==`object`&&`call`in e){let n=e;try{return!!J.execute(n.call,n.args??{},{dataModel:t})}catch(e){return console.warn(`[resolveDynamicBoolean] Function evaluation failed:`,e),!1}}return!1}function Z(e,t){return e==null?0:typeof e==`number`?e:typeof e==`object`&&`path`in e?Number(Y(t,e.path)??0):typeof e==`object`&&`$dataModel`in e?Number(Y(t,e.$dataModel)??0):0}function Q(e,t){if(e==null)return``;if(typeof e==`string`)return e;if(typeof e==`object`&&`path`in e)return String(Y(t,e.path)??``);if(typeof e==`object`&&`$dataModel`in e)return String(Y(t,e.$dataModel)??``);if(typeof e!=`object`||!(`call`in e))return``;let n=e;try{return String(J.execute(n.call,n.args??{},{dataModel:t})??``)}catch(e){return console.warn(`[resolveDynamicString] Function evaluation failed:`,e),``}}function re(){J.register({name:`capitalize`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>{let n=Q(e.value,t.dataModel);return n.charAt(0).toUpperCase()+n.slice(1)}}),J.register({name:`formatString`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>Q(e.value,t.dataModel).replace(/\$\{([^}]+)\}/g,(e,n)=>String(Y(t.dataModel,n)??``))}),J.register({name:`formatNumber`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>{let n=Z(e.value,t.dataModel),r=e.decimals===void 0?void 0:Number(Z(e.decimals,t.dataModel)),i=e.grouping===void 0||X(e.grouping,t.dataModel);return n.toLocaleString(void 0,{minimumFractionDigits:r,maximumFractionDigits:r,useGrouping:i})}}),J.register({name:`formatCurrency`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>{let n=Z(e.value,t.dataModel),r=Q(e.currency,t.dataModel),i=e.decimals===void 0?2:Number(Z(e.decimals,t.dataModel));return n.toLocaleString(void 0,{style:`currency`,currency:r||`USD`,minimumFractionDigits:i,maximumFractionDigits:i})}}),J.register({name:`formatDate`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>{let n=Q(e.value,t.dataModel);try{let e=new Date(n);return isNaN(e.getTime())?n:e.toLocaleDateString()}catch{return n}}}),J.register({name:`pluralize`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>{let n=Z(e.value,t.dataModel),r=Q(e.one,t.dataModel),i=Q(e.other,t.dataModel);return n===1?r:i}}),J.register({name:`openUrl`,callableFrom:`rendererOrAgent`,evaluate:()=>``}),J.register({name:`and`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>e.values.every(e=>X(e,t.dataModel))}),J.register({name:`or`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>e.values.some(e=>X(e,t.dataModel))}),J.register({name:`not`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>!X(e.value,t.dataModel)}),J.register({name:`required`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>Q(e.value,t.dataModel).trim().length>0}),J.register({name:`email`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>{let n=Q(e.value,t.dataModel);return/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(n)}}),J.register({name:`regex`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>{let n=Q(e.value,t.dataModel),r=Q(e.pattern,t.dataModel);return new RegExp(r).test(n)}}),J.register({name:`length`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>{let n=Q(e.value,t.dataModel),r=e.min===void 0?0:Z(e.min,t.dataModel),i=e.max===void 0?1/0:Z(e.max,t.dataModel);return n.length>=r&&n.length<=i}}),J.register({name:`numeric`,callableFrom:`rendererOrAgent`,evaluate:(e,t)=>{let n=Z(e.value,t.dataModel),r=e.min===void 0?-1/0:Z(e.min,t.dataModel),i=e.max===void 0?1/0:Z(e.max,t.dataModel);return n>=r&&n<=i}})}function ie(e,t,n,r){let i=t.replace(/^\//,``).split(`/`).map(e=>e.replace(/~1/g,`/`).replace(/~0/g,`~`)).filter(e=>e!==``);if(i.length===0)return typeof n==`object`&&n?{...n}:{};if(i.length===1){let t={...e};return r?delete t[i[0]]:t[i[0]]=n,t}let[a,...o]=i,s=e[a]!=null&&typeof e[a]==`object`?{...e[a]}:{};return{...e,[a]:ie(s,`/`+o.join(`/`),n,r)}}function ae(e,t,n,r=!0){let i=t??`/`;return i===`/`||i===``?r&&typeof n==`object`&&n?{...n}:{}:ie(e,i,n,!r||n===void 0)}function oe(e,t,n){return{...e,...typeof t==`object`&&t?t:{},"@index":n,"@item":t}}function se(e){let t={};function n(e){for(let r of e)if(!(!r||typeof r!=`object`)&&(r.id?t[r.id]=r:r.component&&console.warn(`[a2ui] Component missing required 'id' field; skipped.`,r),Array.isArray(r.children)&&r.children.length>0&&typeof r.children[0]==`object`&&(`path`in r.children[0]&&`componentId`in r.children[0]||n(r.children)),r.child&&typeof r.child==`object`&&n([r.child]),Array.isArray(r.tabs)))for(let e of r.tabs)e&&typeof e.child==`object`&&n([e.child])}return n(e),t}function ce(e,t,n,r){let i;if(Array.isArray(e))if(e.length>0&&typeof e[0]==`object`&&e[0]!==null){let t=e[0];if(`path`in t&&`componentId`in t)i=t;else if(`id`in t){for(let t of e){let e=n.renderComponent(String(t.id));e&&r(e)}return}else return}else{for(let t of e){let e=n.renderComponent(String(t));e&&r(e)}return}else i=e;let a=Y(t.dataModel,i.path);if(Array.isArray(a))for(let e=0;e<a.length;e++){let t=n.renderComponent(i.componentId,{arrayPath:i.path,index:e,itemValue:a[e]});t&&r(t)}}function le(e){switch(e){case`h1`:case`h2`:case`h3`:case`h4`:case`h5`:return e;default:return`span`}}function $(e,t){t!==void 0&&(e.style.flexGrow=String(t))}function ue(e,t,n){let r=document.createElement(`div`);r.className=`a2ui__audio`;let i=document.createElement(`audio`);i.controls=!0;let a=e.url??e.src??e.source??e.audioUrl??``;a=Q(a,t.dataModel);let o=n.resolveMediaUrl(a);if(o.startsWith(`/files/`)?i.setAttribute(`data-a2ui-workspace-src`,o):o&&(i.src=o),$(r,e.weight),r.appendChild(i),e.description){let n=document.createElement(`div`);n.className=`a2ui__audio-description`,n.textContent=Q(e.description,t.dataModel),r.appendChild(n)}return r}function de(e,t,n){let r=document.createElement(`button`);if(r.type=`button`,r.className=`a2ui__button a2ui__button--${e.variant??`primary`}`,e.checked&&r.classList.add(`a2ui__button--checked`),$(r,e.weight),e.child&&t.components[e.child]){let t=n.renderComponent(e.child);t&&(t.style.color=`inherit`,r.appendChild(t))}else{let t=e.text;typeof t==`string`&&t&&(r.textContent=t)}return r.addEventListener(`click`,()=>{if(!e.action)return;let t=e.action.event?.name??e.action.id??e.action.name;t&&n.dispatchAction(t)}),r}function fe(e,t,n){let r=document.createElement(`div`);r.className=`a2ui__card`,$(r,e.weight);let i=n.renderComponent(e.child);return i&&r.appendChild(i),r}function pe(e,t,n){let r=document.createElement(`label`);r.className=`a2ui__checkbox`;let i=document.createElement(`input`);if(i.type=`checkbox`,typeof e.value==`object`&&`path`in e.value){let n=e.value.path.replace(/^\//,``);i.checked=!!t.dataModel[n]}else if(typeof e.value==`object`&&`$dataModel`in e.value){let n=e.value.$dataModel.replace(/^\//,``);i.checked=!!t.dataModel[n]}else typeof e.value==`boolean`&&(i.checked=e.value);i.addEventListener(`change`,()=>{typeof e.value==`object`&&`path`in e.value?n.updateDataModelPointer(e.value.path,i.checked):typeof e.value==`object`&&`$dataModel`in e.value&&n.updateDataModelPointer(e.value.$dataModel,i.checked);let t=e.action?.event?.name??e.action?.id;t&&n.dispatchAction(t)});let a=document.createElement(`span`);return a.className=`a2ui__checkbox-label`,a.textContent=Q(e.label,t.dataModel),r.append(i,a),r}function me(e,t,n){let r=document.createElement(`div`);r.className=`a2ui__choicepicker`,$(r,e.weight);let i=e.variant===`multipleSelection`,a=null,o=[];if(typeof e.value==`object`&&`path`in e.value){a=e.value.path.replace(/^\//,``);let n=t.dataModel[a];Array.isArray(n)?o=n.map(String):typeof n==`string`&&(o=[n])}else if(typeof e.value==`object`&&`$dataModel`in e.value){a=e.value.$dataModel.replace(/^\//,``);let n=t.dataModel[a];Array.isArray(n)?o=n.map(String):typeof n==`string`&&(o=[n])}return(e.options||[]).forEach(s=>{let c=typeof s==`string`||typeof s==`number`?{label:String(s),value:String(s)}:s,l=`a2ui-choice-${t.surfaceId}-${e.id}-${c.value}`,u=document.createElement(`label`);u.className=`a2ui__choice-item`;let d=document.createElement(`input`);d.type=i?`checkbox`:`radio`,d.name=`a2ui-choice-${t.surfaceId}-${e.id}`,d.id=l,d.value=c.value,d.checked=o.includes(c.value),d.addEventListener(`change`,()=>{if(a)if(i){let e=Array.from(r.querySelectorAll(`input:checked`)).map(e=>e.value);n.updateDataModelPointer(`/${a}`,e)}else{let e=r.querySelector(`input:checked`);n.updateDataModelPointer(`/${a}`,e?e.value:``)}});let f=document.createElement(`span`);f.textContent=Q(c.label,t.dataModel),u.append(d,f),r.appendChild(u)}),r}function he(e,t,n){let r=document.createElement(`div`);return r.className=`a2ui__column`,e.justify&&r.classList.add(`a2ui__justify--${e.justify}`),e.align&&r.classList.add(`a2ui__align--${e.align}`),$(r,e.weight),ce(e.children,t,n,e=>{r.appendChild(e)}),r}function ge(e,t,n){let r=document.createElement(`div`);r.className=`a2ui__datetime`,$(r,e.weight);let i=`a2ui-datetime-${t.surfaceId}-${e.id}`;if(e.label){let n=document.createElement(`label`);n.className=`a2ui__datetime-label`,n.htmlFor=i,n.textContent=Q(e.label,t.dataModel),r.appendChild(n)}let a=document.createElement(`input`);a.id=i,e.enableDate&&e.enableTime?a.type=`datetime-local`:e.enableDate?a.type=`date`:e.enableTime?a.type=`time`:a.type=`text`;let o=e.value;if(o&&typeof o==`object`){let e=null;if(`path`in o?e=o.path.replace(/^\//,``):`$dataModel`in o&&(e=o.$dataModel.replace(/^\//,``)),e!==null){let n=t.dataModel[e];typeof n==`string`&&(a.value=n)}}else typeof o==`string`&&o&&(a.value=o);return e.min&&(a.min=Q(e.min,t.dataModel)),e.max&&(a.max=Q(e.max,t.dataModel)),a.addEventListener(`input`,()=>{o&&typeof o==`object`&&(`path`in o?n.updateDataModelPointer(o.path,a.value):`$dataModel`in o&&n.updateDataModelPointer(o.$dataModel,a.value))}),r.appendChild(a),r}function _e(e,t){let n=document.createElement(`hr`);return n.className=`a2ui__divider a2ui__divider--${e.axis??`horizontal`}`,$(n,e.weight),n}function ve(e,t){let n=document.createElement(`span`);if(n.className=`a2ui__icon material-symbols-outlined`,typeof e.name==`string`)n.dataset.iconName=e.name,n.textContent=e.name;else if(e.name&&typeof e.name==`object`&&`path`in e.name){let t=document.createElement(`img`);t.src=e.name.path,t.alt=``,n.appendChild(t)}return $(n,e.weight),n}function ye(e,t,n){let r=document.createElement(`img`);r.className=`a2ui__image a2ui__image--${e.variant??`mediumFeature`}`;let i=e.url??e.src??e.source??e.imageUrl??``;i=Q(i,t.dataModel);let a=n.resolveMediaUrl(i);return a.startsWith(`/files/`)?r.setAttribute(`data-a2ui-workspace-src`,a):a&&(r.src=a),r.alt=e.description?Q(e.description,t.dataModel):``,r.style.objectFit=e.fit??`fill`,$(r,e.weight),r}function be(e,t,n){let r=document.createElement(`div`);return r.className=`a2ui__list a2ui__list--${e.direction??`vertical`}`,$(r,e.weight),ce(e.children,t,n,e=>{let t=document.createElement(`div`);t.className=`a2ui__list-item`,t.appendChild(e),r.appendChild(t)}),r}function xe(e,t,n){let r=document.createElement(`div`);r.className=`a2ui__modal`,$(r,e.weight);let i=n.renderComponent(e.trigger)??(()=>{let e=document.createElement(`button`);return e.type=`button`,e.textContent=`Open`,e})(),a=document.createElement(`div`);a.className=`a2ui__modal-overlay`,a.style.display=`none`,a.setAttribute(`role`,`dialog`);let o=document.createElement(`div`);o.className=`a2ui__modal-content`;let s=()=>{a.style.display=`none`,o.replaceChildren()};return a.addEventListener(`click`,e=>{e.target===a&&s()}),a.addEventListener(`keydown`,e=>{e.key===`Escape`&&s()}),a.append(o),i.addEventListener(`click`,t=>{t.preventDefault(),t.stopPropagation(),o.replaceChildren();let r=n.renderComponent(e.content);r&&o.appendChild(r),a.style.display=`block`,a.tabIndex=-1,a.focus()},{capture:!0}),n.attachModalOverlay&&n.attachModalOverlay(a),r.appendChild(i),r}function Se(e,t,n){let r=document.createElement(`div`);return r.className=`a2ui__row`,e.justify&&r.classList.add(`a2ui__justify--${e.justify}`),e.align&&r.classList.add(`a2ui__align--${e.align}`),$(r,e.weight),ce(e.children,t,n,e=>{r.appendChild(e)}),r}function Ce(e,t,n){let r=document.createElement(`div`);r.className=`a2ui__slider`,$(r,e.weight);let i=`a2ui-slider-${t.surfaceId}-${e.id}`;if(e.label){let n=document.createElement(`label`);n.className=`a2ui__slider-label`,n.htmlFor=i,n.textContent=Q(e.label,t.dataModel),r.appendChild(n)}let a=document.createElement(`input`);return a.type=`range`,a.id=i,a.min=String(e.min??0),a.max=String(e.max??100),e.steps!==void 0&&(a.step=String(e.steps)),typeof e.value==`number`?a.value=String(e.value):e.value!==void 0&&(a.value=Q(e.value,t.dataModel)),a.addEventListener(`input`,()=>{typeof e.value==`object`&&`path`in e.value?n.updateDataModelPointer(e.value.path,Number(a.value)):typeof e.value==`object`&&`$dataModel`in e.value&&n.updateDataModelPointer(e.value.$dataModel,Number(a.value))}),r.appendChild(a),r}function we(e,t,n){let r=document.createElement(`div`);r.className=`a2ui__tabs`,$(r,e.weight);let i=document.createElement(`div`);i.className=`a2ui__tabs-headers`;let a=document.createElement(`div`);a.className=`a2ui__tabs-content`;let o=Array.isArray(e.tabs)?e.tabs:[];Array.isArray(e.tabs)||console.warn(`[shadow-claw-a2ui] Tab spec is missing or invalid for component id: "${e.id}"`);let s=e=>{i.querySelectorAll(`button`).forEach((t,n)=>{t.classList.toggle(`active`,n===e)}),a.replaceChildren();let t=o[e]?.child;if(t){let e=n.renderComponent(t);e&&a.appendChild(e)}};return o.forEach((e,n)=>{let r=document.createElement(`button`);r.type=`button`,r.className=`a2ui__tab-header`,r.textContent=Q(e.title,t.dataModel),r.addEventListener(`click`,()=>s(n)),i.appendChild(r)}),r.append(i,a),o.length>0&&s(0),r}function Te(e,t,n){let r=document.createElement(`div`);r.className=`a2ui__field`,$(r,e.weight);let i=document.createElement(`label`);i.className=`a2ui__field-label`,i.textContent=Q(e.label,t.dataModel);let a=e.variant===`longText`,o;if(a){let r=document.createElement(`textarea`);r.className=`a2ui__field-textarea`,r.rows=3,e.value!==void 0&&(r.value=Q(e.value,t.dataModel)),r.addEventListener(`input`,()=>{n.updateDataModelKey(e,r.value)}),o=r}else{let r=document.createElement(`input`);r.className=`a2ui__field-input`,r.type=e.variant===`number`?`number`:e.variant===`obscured`?`password`:`text`,e.value!==void 0&&(r.value=Q(e.value,t.dataModel)),e.validationRegexp&&(r.pattern=e.validationRegexp),r.addEventListener(`input`,()=>{n.updateDataModelKey(e,r.value)}),o=r}let s=`a2ui-field-${t.surfaceId}-${e.id}`;return o.id=s,i.htmlFor=s,r.append(i,o),r}function Ee(e,t){let n=e.variant??`body`,r=le(n),i=document.createElement(r);return i.className=`a2ui__text a2ui__text--${n}`,$(i,e.weight),i.textContent=Q(e.text,t.dataModel),i}function De(e,t,n){let r=document.createElement(`video`);r.controls=!0,r.className=`a2ui__video`;let i=e.url??e.src??e.source??e.videoUrl??``;i=Q(i,t.dataModel);let a=n.resolveMediaUrl(i);if(a.startsWith(`/files/`)?r.setAttribute(`data-a2ui-workspace-src`,a):a&&(r.src=a),e.posterUrl){let i=n.resolveMediaUrl(Q(e.posterUrl,t.dataModel));i.startsWith(`/files/`)?r.setAttribute(`data-a2ui-workspace-poster`,i):i&&(r.poster=i)}return $(r,e.weight),r}const Oe=new CSSStyleSheet;Oe.replaceSync(`:host {
  color: var(--shadow-claw-text-primary);
  container-type: inline-size;
  display: block;
  font-family: var(--shadow-claw-font-sans);
}

.material-symbols-outlined {
  -webkit-font-feature-settings: "liga";
  -webkit-font-smoothing: antialiased;
  direction: ltr;
  display: inline-block;
  font-family: "Material Symbols Outlined";
  font-size: 24px;
  font-style: normal;
  font-weight: normal;
  letter-spacing: normal;
  line-height: 1;
  text-transform: none;
  white-space: nowrap;
  word-wrap: normal;
}

/* ── Surface wrapper ────────────────────────────────────────────────────── */
.a2ui__surface {
  background: var(--shadow-claw-bg-secondary);
  border: 1px solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  box-shadow: var(--shadow-claw-shadow-sm);
  box-sizing: border-box;
  color: inherit;
  font-family: inherit;
  font-size: 0.9rem;
  margin: var(--shadow-claw-a2ui-surface-margin, 0.25rem 0);
  overflow: var(--shadow-claw-a2ui-surface-overflow, hidden);
  padding: var(--shadow-claw-a2ui-surface-padding, 0.75rem);
  width: var(--shadow-claw-a2ui-surface-width, 100%);
}

/* ── Layout primitives ─────────────────────────────────────────────────── */
.a2ui__row {
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--shadow-claw-a2ui-layout-gap, 0.5rem);
  width: 100%;
}

.a2ui__column {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--shadow-claw-a2ui-layout-gap, 0.5rem);
  width: 100%;
}

/* justify-content mappings */
.a2ui__justify--center {
  justify-content: center;
}

.a2ui__justify--end {
  justify-content: flex-end;
}

.a2ui__justify--start {
  justify-content: flex-start;
}

.a2ui__justify--spaceBetween {
  justify-content: space-between;
}

.a2ui__justify--spaceAround {
  justify-content: space-around;
}

.a2ui__justify--spaceEvenly {
  justify-content: space-evenly;
}

.a2ui__justify--stretch {
  justify-content: stretch;
}

/* align-items mappings */
.a2ui__align--center {
  align-items: center;
}

.a2ui__align--end {
  align-items: flex-end;
}

.a2ui__align--start {
  align-items: flex-start;
}

.a2ui__align--stretch {
  align-items: stretch;
}

/* ── Text ──────────────────────────────────────────────────────────────── */
.a2ui__text {
  display: block;
  font-family: monospace;
  margin: 0;
  overflow: auto;
  padding: 0;
  white-space: pre;
}

.a2ui__text--h1 {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.a2ui__text--h2 {
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.25;
}

.a2ui__text--h3 {
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.3;
}

.a2ui__text--h4 {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.35;
}

.a2ui__text--h5 {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
}

.a2ui__text--caption {
  font-size: 0.75rem;
  opacity: 0.65;
}

.a2ui__text--body {
  font-size: 0.9rem;
  line-height: 1.5;
}

/* ── Button ────────────────────────────────────────────────────────────── */
.a2ui__button,
button {
  align-items: center;
  border: none;
  border-radius: var(--shadow-claw-radius-s);
  cursor: pointer;
  display: inline-flex;
  font-size: 0.875rem;
  font-weight: 500;
  gap: 0.35rem;
  justify-content: center;
  outline: none;
  padding: 0.45rem 1rem;
  transition:
    opacity 0.15s ease,
    background 0.15s ease,
    transform 0.1s ease;
  user-select: none;
  white-space: nowrap;
}

.a2ui__button:focus-visible,
button:focus-visible {
  outline: 2px solid var(--shadow-claw-accent-primary);
  outline-offset: 2px;
}

.a2ui__button:active,
button:active {
  transform: scale(0.97);
}

.a2ui__button--primary,
button {
  background: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.a2ui__button--primary:hover,
button:hover {
  opacity: 0.88;
}

.a2ui__button--borderless {
  background: transparent;
  border: 1px solid var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-accent-primary);
}

.a2ui__button--borderless:hover {
  background: var(--shadow-claw-bg-tertiary);
}

/* checked state (toggle button) */
.a2ui__button--checked {
  background: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */
.a2ui__tabs {
  background: var(--shadow-claw-bg-secondary);
  border: 1px solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  box-shadow: var(--shadow-claw-shadow-sm);
  padding: 0.75rem;
}

.a2ui__tabs-headers {
  align-items: flex-start;
  border-bottom: 1px solid var(--shadow-claw-border-color);
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.25rem;
}

.a2ui__tab-header {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-weight: 600;
  padding: 0.5rem 0.75rem;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;
}

.a2ui__tab-header:first-of-type {
  border-top-left-radius: var(--shadow-claw-radius-s);
}

.a2ui__tab-header:last-of-type {
  border-top-right-radius: var(--shadow-claw-radius-s);
}

.a2ui__tab-header:hover {
  color: var(--shadow-claw-text-primary);
}

.a2ui__tab-header.active {
  background: var(--shadow-claw-bg-tertiary);
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-text-primary);
}

.a2ui__tabs-content {
  padding-top: 0.5rem;
}

/* ── TextField ─────────────────────────────────────────────────────────── */
.a2ui__field {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
}

.a2ui__field-label {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  opacity: 0.85;
}

.a2ui__field-input,
.a2ui__field-textarea {
  background: var(--shadow-claw-bg-primary);
  border: 1px solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  box-sizing: border-box;
  color: var(--shadow-claw-text-primary);
  font: inherit;
  font-size: 0.875rem;
  outline: none;
  padding: 0.45rem 0.65rem;
  resize: vertical;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  width: 100%;
}

.a2ui__field-input:focus,
.a2ui__field-textarea:focus {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 2px
    color-mix(in srgb, var(--shadow-claw-accent-primary) 15%, transparent);
}

.a2ui__field-input:invalid,
.a2ui__field-textarea:invalid {
  border-color: var(--shadow-claw-error-color);
}

/* ── Card ────────────────────────────────────────────────────────────────── */
.a2ui__card {
  background: var(--shadow-claw-bg-primary);
  border: 1px solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  box-shadow: var(--shadow-claw-shadow-sm);
  padding: 1rem;
}

/* ── Checkbox ────────────────────────────────────────────────────────────── */
.a2ui__checkbox {
  align-items: center;
  color: var(--shadow-claw-text-primary);
  cursor: pointer;
  display: inline-flex;
  gap: 0.5rem;
}

.a2ui__checkbox input {
  accent-color: var(--shadow-claw-accent-primary);
  height: 1rem;
  width: 1rem;
}

.a2ui__checkbox-label {
  color: var(--shadow-claw-text-primary);
  font-size: 0.9rem;
}

/* ── Choice picker ───────────────────────────────────────────────────────── */
.a2ui__choicepicker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;
}

.a2ui__choice-item {
  align-items: center;
  background: var(--shadow-claw-bg-primary);
  border: 1px solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  color: var(--shadow-claw-text-primary);
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
}

.a2ui__choice-item input {
  accent-color: var(--shadow-claw-accent-primary);
}

/* ── Audio player ───────────────────────────────────────────────────────── */
.a2ui__audio {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.a2ui__audio audio {
  width: 100%;
}

.a2ui__audio-description {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.9rem;
}

/* ── Image ───────────────────────────────────────────────────────────────── */
.a2ui__image {
  border-radius: var(--shadow-claw-radius-m);
  display: block;
  margin: auto;
  max-width: 100%;
  object-fit: cover;
  width: 100%;
}

.a2ui__image--smallFeature {
  max-height: 10rem;
}

.a2ui__image--mediumFeature {
  max-height: 18rem;
}

.a2ui__image--largeFeature {
  max-height: 24rem;
}

/* ── Divider ─────────────────────────────────────────────────────────────── */
.a2ui__divider {
  background: var(--shadow-claw-border-color);
  flex-shrink: 0;
}

.a2ui__divider--horizontal {
  height: 1px;
  margin: 0.75rem 0;
  width: 100%;
}

.a2ui__divider--vertical {
  height: 100%;
  margin: 0 0.75rem;
  width: 1px;
}

/* ── Date / time input ────────────────────────────────────────────────────── */
.a2ui__datetime {
  width: 100%;
}

.a2ui__datetime input {
  background: var(--shadow-claw-bg-primary);
  border: 1px solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  color: var(--shadow-claw-text-primary);
  font: inherit;
  padding: 0.5rem 0.75rem;
  width: calc(100% - 1.5rem);
}

/* ── List ─────────────────────────────────────────────────────────────────- */
.a2ui__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  width: 100%;
}

.a2ui__list--vertical {
  flex-direction: column;
}

.a2ui__list--horizontal {
  flex-direction: row;
}

.a2ui__list-item {
  width: 100%;
}

.a2ui__list--horizontal .a2ui__list-item {
  flex: 1 1 auto;
  min-width: 10rem;
}

/* ── Modal ───────────────────────────────────────────────────────────────── */
.a2ui__modal {
  display: inline-flex;
  width: 100%;
}

.a2ui__modal-overlay {
  align-items: center;
  background: rgba(15, 23, 42, 0.99);
  bottom: 0;
  display: none;
  inset: 0;
  justify-content: center;
  left: 0;
  padding: 1.5rem;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 1000;
}

.a2ui__modal-content {
  background: var(--shadow-claw-bg-primary);
  border: 1px solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  box-shadow: var(--shadow-claw-shadow-lg);
  max-height: min(90vh, 40rem);
  max-width: min(100%, 50rem);
  overflow: auto;
  padding: 1rem;
  width: calc(100% - 2rem);
}

.a2ui__modal-close {
  background: transparent;
  border: 1px solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
}

.a2ui__modal-close:hover {
  background: var(--shadow-claw-bg-secondary);
  color: var(--shadow-claw-text-primary);
}

/* ── Slider ────────────────────────────────────────────────────────────── */
.a2ui__slider {
  width: 100%;
}

.a2ui__slider input[type="range"] {
  accent-color: var(--shadow-claw-accent-primary);
  width: 100%;
}

/* ── Video ───────────────────────────────────────────────────────────────── */
.a2ui__video {
  border-radius: var(--shadow-claw-radius-m);
  display: block;
  max-width: 100%;
  width: 100%;
}

.a2ui__video video {
  border-radius: inherit;
  display: block;
  width: 100%;
}

/* ── Icon ─────────────────────────────────────────────────────────────────- */
.a2ui__icon {
  align-items: center;
  color: var(--shadow-claw-text-secondary);
  display: inline-flex;
  font-size: 0.95rem;
  gap: 0.35rem;
  height: 1.25rem;
  justify-content: center;
}

.a2ui__icon img {
  display: block;
  height: 1rem;
  width: auto;
}
`);const ke=new DOMParser().parseFromString(`<template>
  <div class="a2ui__surface" role="region" aria-label="Interactive UI Surface">
    <div class="a2ui__root"></div>
  </div>
</template>
`,`text/html`),Ae=ke.querySelector(`template`);let je=[];je=Ae?Array.from(Ae.content.children):Array.from(ke.head.children).concat(Array.from(ke.body.children));var Me=je;const Ne=`shadow-claw-a2ui`;var Pe=class extends O{static styles=Oe;static template=Me;groupId=``;#e=!1;#t=null;applyEnvelope(e){switch(e.type){case`createSurface`:this.#t={surfaceId:e.surfaceId,components:se(e.components),dataModel:{...e.dataModel??{}},rootComponentId:`root`},this.#e=e.sendDataModel??!1,this.#c();break;case`updateComponents`:if(!this.#t||this.#t.surfaceId!==e.surfaceId)return;this.#t={...this.#t,components:{...this.#t.components,...se(e.components)}},this.#c();break;case`updateDataModel`:if(!this.#t||this.#t.surfaceId!==e.surfaceId)return;this.#t={...this.#t,dataModel:ae(this.#t.dataModel,e.path,e.value,`value`in e)},this.#c();break;case`deleteSurface`:this.#t?.surfaceId===e.surfaceId&&(this.#t=null,this.#e=!1,this.#r());break;case`actionResponse`:if(!this.#t||this.#t.surfaceId!==e.surfaceId)return;e.responsePath&&(this.#t={...this.#t,dataModel:ae(this.#t.dataModel,e.responsePath,e.value)},this.#c());break;case`callFunction`:{if(!this.#t||this.#t.surfaceId!==e.surfaceId)return;let t=null,n;try{t=J.execute(e.call.call,e.call.args??{},{dataModel:this.#t.dataModel})}catch(e){n=e.message&&e.message.includes(`INVALID_FUNCTION_CALL`)?e.message:`INVALID_FUNCTION_CALL: ${e.message}`}let r={version:`v1.0`,type:`functionResponse`,surfaceId:e.surfaceId,callId:e.callId,value:t,...n?{error:n}:{}};this.dispatchEvent(new CustomEvent(`shadow-claw-a2ui-function-response`,{bubbles:!0,composed:!0,detail:{groupId:this.groupId,response:r}}));break}}}getSurfaceId(){return this.#t?.surfaceId??null}async render(){this.#t&&this.#c()}#n(e){let t=this.shadowRoot?.querySelector(`.a2ui__surface`);t&&t.appendChild(e)}#r(){let e=this.shadowRoot?.querySelector(`.a2ui__root`);e&&e.replaceChildren()}#i(e,t){if(e===`playTrack`||e===`play`){(this.shadowRoot?.querySelectorAll(`audio, video`))?.forEach(e=>e.play().catch(console.error));return}if(e===`pauseTrack`||e===`pause`){(this.shadowRoot?.querySelectorAll(`audio, video`))?.forEach(e=>e.pause());return}if(e===`closeModal`||e===`close`){let e=this.shadowRoot?.querySelectorAll(`.a2ui__modal-overlay`),t=!1;if(e?.forEach(e=>{if(e.style.display!==`none`){e.style.display=`none`;let n=e.querySelector(`.a2ui__modal-content`);n&&n.replaceChildren(),t=!0}}),t)return}let n=this.#t??t,r={type:`a2ui-action`,surfaceId:n.surfaceId,actionId:e,dataModel:(this.#e,{...n.dataModel})};this.dispatchEvent(new CustomEvent(`shadow-claw-a2ui-action`,{bubbles:!0,composed:!0,detail:{groupId:this.groupId,action:r}}))}#a(e,t,n){let r=t.components[e];if(!r)return console.warn(`[shadow-claw-a2ui] Unknown component id: "${e}"`),null;let i=r.id?r:{...r,id:e},a=t;n&&(a={...t,dataModel:oe(t.dataModel,n.itemValue,n.index)});let o=q.get(i.component);return o?o(i,a,{renderComponent:(e,r)=>this.#a(e,t,r??n),dispatchAction:e=>this.#i(e,a),updateDataModelKey:(e,t)=>{let r=``;typeof e.value==`object`&&`path`in e.value?r=e.value.path:typeof e.value==`object`&&`$dataModel`in e.value&&(r=e.value.$dataModel),r&&(n&&r.startsWith(`/@item`)&&(r=`${n.arrayPath}/${n.index}${r.slice(6)}`),this.#s(r,t))},resolveMediaUrl:e=>this.#o(e),attachModalOverlay:e=>this.#n(e),updateDataModelPointer:(e,t)=>{if(n&&e.startsWith(`/@item`)){let r=`${n.arrayPath}/${n.index}${e.slice(6)}`;this.#s(r,t)}else this.#s(e,t)}}):(console.warn(`[shadow-claw-a2ui] Unknown component type: "${i.component}"`),null)}#o(e){return e?/^https?:\/\//.test(e)||/^(file|data):/.test(e)||/^\/files\/[a-zA-Z0-9_-]+\/.*$/.test(e)?e:this.groupId?`/files/${this.groupId.replace(/:/g,`-`)}/${e.replace(/^\.\/?/,``).split(`/`).map(e=>encodeURIComponent(e)).join(`/`)}`:(console.warn(`[shadow-claw-a2ui] groupId not set, cannot resolve workspace files`),``):``}#s(e,t){this.#t&&={...this.#t,dataModel:ae(this.#t.dataModel,e,t)}}async#c(){let e=this.#t;if(!e)return;let t=this.shadowRoot?.querySelector(`.a2ui__root`);if(!(t instanceof HTMLElement))return;t.replaceChildren();let n=this.#a(e.rootComponentId,e);n&&t.appendChild(n),await this.#d()}async#l(e,t){if(!(e instanceof HTMLImageElement)&&!(e instanceof HTMLVideoElement)&&!(e instanceof HTMLAudioElement))return;let n=e.getAttribute(`data-a2ui-workspace-src`);if(!n)return;let r=e instanceof HTMLImageElement?`image`:e instanceof HTMLVideoElement?`video`:`audio`;try{let r=n.match(/^\/files\/([a-zA-Z0-9_-]+)\/(.+)$/);if(!r){console.warn(`[shadow-claw-a2ui] Invalid workspace path: ${n}`);return}let[,i,a]=r,o=decodeURIComponent(a),s=await g(t,i.replace(/-/g,`:`),o),c=new Uint8Array(s.byteLength);c.set(s);let l=o.toLowerCase(),u=`application/octet-stream`;l.endsWith(`.jpg`)||l.endsWith(`.jpeg`)?u=`image/jpeg`:l.endsWith(`.png`)?u=`image/png`:l.endsWith(`.gif`)?u=`image/gif`:l.endsWith(`.webp`)?u=`image/webp`:l.endsWith(`.svg`)?u=`image/svg+xml`:l.endsWith(`.mp4`)||l.endsWith(`.m4v`)?u=`video/mp4`:l.endsWith(`.webm`)?u=`video/webm`:l.endsWith(`.mkv`)?u=`video/x-matroska`:l.endsWith(`.mov`)?u=`video/mp4`:l.endsWith(`.mp3`)?u=`audio/mpeg`:l.endsWith(`.wav`)?u=`audio/wav`:l.endsWith(`.flac`)?u=`audio/flac`:l.endsWith(`.aac`)?u=`audio/aac`:l.endsWith(`.m4a`)&&(u=`audio/mp4`);let d=new Blob([c],{type:u}),f=URL.createObjectURL(d);W.registerAttachmentObjectUrl(f),e.removeAttribute(`data-a2ui-workspace-src`),(e instanceof HTMLImageElement||e instanceof HTMLVideoElement||e instanceof HTMLAudioElement)&&(e.src=f)}catch(e){console.error(`[shadow-claw-a2ui] Failed to load workspace ${r}: ${n}`,e)}}async#u(e,t){let n=e.getAttribute(`data-a2ui-workspace-poster`);if(n)try{let r=n.match(/^\/files\/([a-zA-Z0-9_-]+)\/(.+)$/);if(!r)return;let[,i,a]=r,o=await g(t,i.replace(/-/g,`:`),a),s=new Uint8Array(o.byteLength);s.set(o);let c=a.toLowerCase(),l=`image/jpeg`;c.endsWith(`.png`)?l=`image/png`:c.endsWith(`.gif`)?l=`image/gif`:c.endsWith(`.webp`)&&(l=`image/webp`);let u=new Blob([s],{type:l}),d=URL.createObjectURL(u);W.registerAttachmentObjectUrl(d),e.removeAttribute(`data-a2ui-workspace-poster`),e.poster=d}catch(e){console.warn(`[shadow-claw-a2ui] Failed to load workspace poster: ${n}`,e)}}async#d(){let e=this.shadowRoot?.querySelector(`.a2ui__root`);if(!(e instanceof HTMLElement))return;let t=await a(),n=[...Array.from(e.querySelectorAll(`img[data-a2ui-workspace-src]`)),...Array.from(e.querySelectorAll(`video[data-a2ui-workspace-src]`)),...Array.from(e.querySelectorAll(`audio[data-a2ui-workspace-src]`))];await Promise.all(n.map(e=>this.#l(e,t)));let r=Array.from(e.querySelectorAll(`video[data-a2ui-workspace-poster]`));await Promise.all(r.map(e=>this.#u(e,t)))}};customElements.get(Ne)||customElements.define(Ne,Pe),q.register(`Text`,(e,t)=>Ee(e,t)),q.register(`Row`,(e,t,n)=>Se(e,t,{renderComponent:n.renderComponent})),q.register(`Column`,(e,t,n)=>he(e,t,{renderComponent:n.renderComponent})),q.register(`Button`,(e,t,n)=>de(e,t,{renderComponent:n.renderComponent,dispatchAction:n.dispatchAction})),q.register(`TextField`,(e,t,n)=>Te(e,t,{updateDataModelKey:n.updateDataModelKey})),q.register(`Image`,(e,t,n)=>ye(e,t,{resolveMediaUrl:n.resolveMediaUrl})),q.register(`Icon`,(e,t)=>ve(e,t)),q.register(`Video`,(e,t,n)=>De(e,t,{resolveMediaUrl:n.resolveMediaUrl})),q.register(`AudioPlayer`,(e,t,n)=>ue(e,t,{resolveMediaUrl:n.resolveMediaUrl})),q.register(`List`,(e,t,n)=>be(e,t,{renderComponent:n.renderComponent})),q.register(`Card`,(e,t,n)=>fe(e,t,{renderComponent:n.renderComponent})),q.register(`Tabs`,(e,t,n)=>we(e,t,{renderComponent:n.renderComponent})),q.register(`Modal`,(e,t,n)=>xe(e,t,{renderComponent:n.renderComponent,attachModalOverlay:n.attachModalOverlay})),q.register(`Divider`,(e,t)=>_e(e,t)),q.register(`CheckBox`,(e,t,n)=>pe(e,t,{dispatchAction:n.dispatchAction,updateDataModelPointer:n.updateDataModelPointer})),q.register(`ChoicePicker`,(e,t,n)=>me(e,t,{updateDataModelPointer:n.updateDataModelPointer})),q.register(`Slider`,(e,t,n)=>Ce(e,t,{updateDataModelPointer:n.updateDataModelPointer})),q.register(`DateTimeInput`,(e,t,n)=>ge(e,t,{updateDataModelPointer:n.updateDataModelPointer})),re();const Fe=new CSSStyleSheet;Fe.replaceSync(`*,
*::before,
*::after {
  box-sizing: border-box;
  font-family: var(--shadow-claw-font-sans);
  scrollbar-color: var(--shadow-claw-border-color) transparent;
  scrollbar-width: thin;
}

::-webkit-scrollbar {
  height: 0.5rem;
  width: 0.5rem;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--shadow-claw-border-color);
  border-radius: 0.25rem;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--shadow-claw-text-tertiary);
}

.hidden,
[hidden] {
  display: none !important;
}

:host {
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.chat {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  width: 100%;
}

.chat__status {
  align-items: center;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  min-height: 1.5rem;
}

.chat__status-indicator {
  color: var(--shadow-claw-success-color);
  font-size: var(--shadow-claw-font-size-sm);
  line-height: 1;
}

.chat__status-indicator--thinking,
.chat__status-indicator--responding {
  color: var(--shadow-claw-warning-color);
}

.chat__status-indicator--error {
  color: var(--shadow-claw-error-color);
}

.chat__typing-indicator {
  align-items: center;
  display: inline-flex;
  font-size: 1.25rem;
  gap: 0.25rem;
  line-height: 1;
}

.chat__typing-dot {
  animation: chat__typing-bounce 1.4s infinite;
  background-color: var(--shadow-claw-warning-color);
  border-radius: 50%;
  display: inline-block;
  height: 0.375rem;
  width: 0.375rem;
}

.chat__typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.chat__typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes chat__typing-bounce {
  0%,
  60%,
  100% {
    opacity: 1;
    transform: translateY(0);
  }

  30% {
    opacity: 0.7;
    transform: translateY(-0.5rem);
  }
}

.chat__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  overflow: hidden;
  padding: 0.75rem;
  position: relative;
}

.chat__drop-overlay {
  align-items: center;
  backdrop-filter: blur(0.125rem);
  background: color-mix(
    in srgb,
    var(--shadow-claw-bg-primary) 80%,
    transparent
  );
  border: 0.125rem dashed var(--shadow-claw-accent-primary);
  border-radius: var(--shadow-claw-radius-l);
  bottom: 0.75rem;
  display: flex;
  justify-content: center;
  left: 0.75rem;
  pointer-events: none;
  position: absolute;
  right: 0.75rem;
  top: 0.75rem;
  z-index: 20;
}

.chat__drop-overlay-card {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-l);
  box-shadow: var(--shadow-claw-shadow-md);
  max-width: min(28rem, 90%);
  padding: 1rem 1.25rem;
  text-align: center;
}

.chat__drop-overlay-title {
  color: var(--shadow-claw-text-primary);
  font-size: 1rem;
  font-weight: 700;
}

.chat__drop-overlay-subtitle {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.8125rem;
  margin-top: 0.375rem;
}

.chat__terminal-slot:empty {
  display: none;
}

.chat__tool-activity {
  align-items: center;
  color: var(--shadow-claw-accent-primary);
  display: none;
  font-size: 0.75rem;
  font-style: italic;
  gap: 0.375rem;
  min-height: 1.25rem;
  padding: 0.25rem 0.25rem 0;
}

.chat__tool-activity--active {
  display: flex;
}

.chat__activity-log {
  background-color: var(--shadow-claw-bg-tertiary);
  border-radius: 0.375rem;
  color: var(--shadow-claw-text-tertiary);
  display: none;
  flex-direction: column;
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.6875rem;
  max-height: 6.25rem;
  overflow-y: hidden;
  padding: 0;
}

.chat__activity-log__header {
  align-items: center;
  background-color: var(--shadow-claw-bg-secondary);
  border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  position: sticky;
  top: 0;
  z-index: 1;
}

.chat__activity-log__label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.chat__activity-log__entries {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
}

.chat__activity-log--active {
  display: flex;
}

.chat__activity-log--collapsed,
.chat__activity-log--collapsed.chat__activity-log--active {
  display: none !important;
}

.chat__model-progress {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  display: none;
  margin-top: 0.25rem;
  padding: 0.625rem;
}

.chat__model-progress--active {
  display: block;
}

.chat__model-progress-label {
  color: var(--shadow-claw-text-secondary);
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.375rem;
}

.chat__model-progress-track {
  background-color: var(--shadow-claw-bg-tertiary);
  border-radius: 62.5rem;
  height: 0.5rem;
  overflow: hidden;
  width: 100%;
}

.chat__model-progress-bar {
  background-color: var(--shadow-claw-accent-primary);
  height: 100%;
  transition: width 0.2s ease;
  width: 0%;
}

.chat__transfer-progress {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  display: none;
  margin-top: 0.25rem;
  padding: 0.625rem;
}

.chat__transfer-progress--active {
  display: block;
}

.chat__transfer-progress-label {
  color: var(--shadow-claw-text-secondary);
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.375rem;
}

.chat__transfer-progress-track {
  background-color: var(--shadow-claw-bg-tertiary);
  border-radius: 62.5rem;
  height: 0.5rem;
  overflow: hidden;
  width: 100%;
}

.chat__transfer-progress-bar {
  background-color: var(--shadow-claw-accent-primary);
  height: 100%;
  transition: width 0.2s ease;
  width: 0%;
}

.chat__messages {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-bg-tertiary);
  border-radius: var(--shadow-claw-radius-l);
  box-shadow: inset var(--shadow-claw-shadow-sm);
  flex: 1;
  min-height: 0;
  overflow-anchor: none;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.75rem;
}

.chat__message {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.chat__message-header {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
  justify-content: space-between;
  margin-bottom: 0.125rem;
}

.chat__message-sender {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03125rem;
  text-transform: uppercase;
}

.chat__message-timestamp {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.625rem;
}

.chat__message-content {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid transparent;
  border-left: 0.25rem solid var(--shadow-claw-accent-primary);
  border-radius: var(--shadow-claw-radius-m);
  display: flow-root;
  font-size: var(--shadow-claw-font-size-sm);
  line-height: 1.5;
  max-width: 100%;
  overflow-wrap: anywhere;
  padding: 0.75rem 1rem;
  word-break: break-word;
}

.chat__message--user .chat__message-content {
  background-color: var(--shadow-claw-accent-primary);
  border-left-color: var(--shadow-claw-accent-hover);
  color: var(--shadow-claw-on-primary);
}

.chat__message--streaming .chat__message-content {
  border-left-color: var(--shadow-claw-warning-color);
}

.chat__streaming-cursor {
  animation: blink 1s step-end infinite;
  background-color: var(--shadow-claw-accent-primary);
  border-radius: 0.0625rem;
  display: inline-block;
  height: 1em;
  margin-left: 0.125rem;
  vertical-align: text-bottom;
  width: 0.125rem;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}

.chat__message-content p {
  margin: 0 0 0.5rem;
}

.chat__message-content p:last-child {
  margin-bottom: 0;
}

.chat__message-content > :first-child {
  margin-top: 0;
}

.chat__message-content > :last-child {
  margin-bottom: 0;
}

.chat__message-content pre {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  margin: 0.75rem 0;
  overflow-x: auto;
  padding: 0;
  position: relative;
}

.chat__message-content pre code.hljs {
  background-color: transparent;
  border-radius: 0.375rem;
  color: var(--shadow-claw-text-primary);
  display: block;
  font-size: 0.8125rem;
  line-height: 1.6;
  margin: 0;
  padding: 0.75rem;
}

.chat__message-content code {
  background-color: var(--shadow-claw-bg-tertiary);
  border-radius: 0.1875rem;
  color: var(--shadow-claw-text-primary);
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.8125rem;
  overflow-wrap: anywhere;
  padding: 0.125rem 0.375rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.chat__message-content code.hljs {
  background: transparent;
  color: var(--shadow-claw-text-primary);
  padding: 0;
}

.chat__code-copy-btn {
  align-items: center;
  background-color: var(--shadow-claw-bg-tertiary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m, 0.375rem);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: inline-flex;
  font-family: var(--shadow-claw-font-sans);
  font-size: 0.6875rem;
  gap: 0.25rem;
  line-height: 1;
  opacity: 0;
  padding: 0.25rem 0.5rem;
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  transition:
    opacity 0.15s,
    background-color 0.15s;
  z-index: 1;
}

.chat__message-content pre:hover .chat__code-copy-btn,
.chat__code-copy-btn:focus-visible {
  opacity: 1;
}

.chat__code-copy-btn:hover {
  background-color: var(--shadow-claw-bg-primary);
  color: var(--shadow-claw-text-primary);
}

.chat__code-copy-btn--copied {
  color: var(--shadow-claw-success-color);
}

.chat__message-content {
  position: relative;
}

.chat__msg-copy-btn {
  align-items: center;
  background-color: var(--shadow-claw-bg-tertiary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m, 0.375rem);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: inline-flex;
  font-size: 0;
  justify-content: center;
  line-height: 1;
  opacity: 0;
  padding: 0.25rem;
  position: absolute;
  right: 0.375rem;
  top: 0.375rem;
  transition:
    opacity 0.15s,
    background-color 0.15s;
  z-index: 2;
}

.chat__msg-copy-btn svg {
  height: 0.875rem;
  width: 0.875rem;
}

.chat__message-content:hover .chat__msg-copy-btn,
.chat__msg-copy-btn:focus-visible {
  opacity: 1;
}

.chat__msg-copy-btn:hover {
  background-color: var(--shadow-claw-bg-primary);
  color: var(--shadow-claw-text-primary);
}

.chat__msg-copy-btn--copied {
  color: var(--shadow-claw-success-color);
  opacity: 1;
}

.chat__msg-delete-btn {
  align-items: center;
  background-color: var(--shadow-claw-bg-tertiary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m, 0.375rem);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: inline-flex;
  font-size: 0;
  justify-content: center;
  line-height: 1;
  margin-right: 0.5rem;
  opacity: 0;
  padding: 0.25rem;
  position: absolute;
  right: 1.875rem;
  top: 0.375rem;
  transition:
    opacity 0.15s,
    background-color 0.15s;
  z-index: 2;
}

.chat__msg-delete-btn svg {
  height: 0.875rem;
  width: 0.875rem;
}

.chat__message-content:hover .chat__msg-delete-btn,
.chat__msg-delete-btn:focus-visible {
  opacity: 1;
}

.chat__msg-delete-btn:hover {
  background-color: var(--shadow-claw-error-color);
  border-color: var(--shadow-claw-error-color);
  color: var(--shadow-claw-on-primary);
}

.chat__activity-log__copy-btn {
  align-items: center;
  background-color: transparent;
  border: none;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: inline-flex;
  font-size: 0;
  justify-content: center;
  line-height: 1;
  opacity: 0.6;
  padding: 0.25rem;
  transition:
    opacity 0.15s,
    color 0.15s;
}

.chat__activity-log__copy-btn svg {
  height: 0.875rem;
  width: 0.875rem;
}

.chat__activity-log__copy-btn:hover,
.chat__activity-log__copy-btn:focus-visible {
  color: var(--shadow-claw-text-primary);
  opacity: 1;
}

.chat__activity-log__copy-btn--copied {
  color: var(--shadow-claw-success-color);
  opacity: 1;
}

.chat__attachments {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.chat__attachment {
  background: color-mix(
    in srgb,
    var(--shadow-claw-bg-secondary) 86%,
    transparent
  );
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  overflow: hidden;
}

.chat__attachment-preview-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  display: block;
  padding: 0;
  width: 100%;
}

.chat__attachment-preview-btn:focus-visible {
  outline: 0.125rem solid var(--shadow-claw-accent-primary);
  outline-offset: -0.125rem;
}

.chat__attachment-preview {
  display: block;
  height: auto;
  max-height: 22rem;
  object-fit: contain;
  width: 100%;
}

.chat__attachment-preview-error {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.75rem;
  padding: 0.75rem 0.875rem 0;
}

.chat__attachment-meta {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.75rem 0.875rem 0.875rem;
}

.chat__attachment-identity {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  min-width: 0;
}

.chat__attachment-icon {
  align-items: center;
  background: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 18%,
    var(--shadow-claw-bg-tertiary)
  );
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.375rem;
  color: var(--shadow-claw-text-secondary);
  display: inline-flex;
  flex: 0 0 auto;
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.625rem;
  font-weight: 700;
  height: 1.5rem;
  justify-content: center;
  letter-spacing: 0.015625rem;
  min-width: 2.125rem;
  padding: 0 0.375rem;
}

.chat__attachment-title {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: var(--shadow-claw-text-primary);
  cursor: pointer;
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  padding: 0;
  text-align: left;
}

.chat__attachment-title:hover,
.chat__attachment-title:focus-visible {
  color: var(--shadow-claw-link);
  outline: none;
  text-decoration: underline;
}

.chat__attachment-title:disabled {
  color: var(--shadow-claw-text-secondary);
  cursor: default;
  text-decoration: none;
}

.chat__attachment-subtitle {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.75rem;
}

.chat__attachment-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chat__attachment-action {
  background: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
}

.chat__attachment-action:hover,
.chat__attachment-action:focus-visible {
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-text-primary);
  outline: none;
}

.chat__usage-metrics {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.chat__token-usage {
  align-items: center;
  color: var(--shadow-claw-text-tertiary);
  display: none;
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.625rem;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 0.125rem 0.25rem 0;
  white-space: nowrap;
}

.chat__token-usage--visible {
  display: inline-flex;
}

.chat__token-usage span {
  white-space: nowrap;
}

.chat__context-usage {
  align-items: center;
  color: var(--shadow-claw-text-tertiary);
  display: none;
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.625rem;
  gap: 0.5rem;
  padding: 0.125rem 0.25rem 0;
  white-space: nowrap;
}

.chat__context-usage--visible {
  display: inline-flex;
}

.chat__context-bar {
  background: var(--shadow-claw-bg-tertiary);
  border-radius: 0.125rem;
  height: 0.25rem;
  overflow: hidden;
  width: 5rem;
}

.chat__context-bar-fill {
  border-radius: 0.125rem;
  height: 100%;
  transition:
    width 0.3s ease,
    background-color 0.3s ease;
}

.chat__context-bar-fill--low {
  background-color: var(--shadow-claw-success-color);
}

.chat__context-bar-fill--medium {
  background-color: var(--shadow-claw-warning-color);
}

.chat__context-bar-fill--high {
  background-color: var(--shadow-claw-error-color);
}

.chat__attachment-capabilities {
  color: var(--shadow-claw-text-tertiary);
  display: none;
  font-size: 0.6875rem;
  min-height: 1rem;
  padding: 0 0.25rem;
}

.chat__message-content ul,
.chat__message-content ol {
  margin: 0 0 0.5rem;
  padding-left: 1.5rem;
}

.chat__message-content li {
  margin-bottom: 0.25rem;
}

.chat__message-content li:last-child,
.chat__message-content ul:last-child,
.chat__message-content ol:last-child {
  margin-bottom: 0;
}

.chat__message-content li input[type="checkbox"] {
  accent-color: var(--shadow-claw-accent-primary);
  cursor: pointer;
  margin-right: 0.5rem;
  vertical-align: middle;
}

.chat__message-content blockquote {
  border-left: 0.25rem solid var(--shadow-claw-border-color);
  color: var(--shadow-claw-text-secondary);
  font-style: italic;
  margin: 0 0 0.5rem;
  padding-left: 0.75rem;
}

.chat__message-content hr {
  border: 0;
  border-top: 0.0625rem solid var(--shadow-claw-border-color);
  margin: 0.75rem 0;
}

.chat__message-content a,
.chat__message-content a:visited {
  color: var(--shadow-claw-link) !important;
  text-decoration: underline;
  text-underline-offset: 0.125rem;
}

.chat__message-content a:hover {
  color: var(--shadow-claw-link-hover) !important;
}

.chat__message--user .chat__message-content a,
.chat__message--user .chat__message-content a:visited {
  color: var(--shadow-claw-on-primary) !important;
  opacity: 0.9;
  text-decoration: underline;
  text-underline-offset: 0.125rem;
}

.chat__message--user .chat__message-content a:hover {
  color: var(--shadow-claw-on-primary) !important;
  opacity: 1;
}

.chat__message-content img,
.chat__message-content video {
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  box-shadow: var(--shadow-claw-shadow-sm);
  display: block;
  height: auto;
  margin: 0.75rem 0;
  max-width: 100%;
  transition: transform 0.2s var(--shadow-claw-ease-out);
}

.chat__message-content img:hover,
.chat__message-content video:hover {
  cursor: zoom-in;
  transform: scale(1.01);
}

.chat__input-area {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 0;
}

.chat__input-resize-handle {
  background: transparent;
  cursor: row-resize;
  flex: none;
  height: 0.75rem;
  outline: none;
  position: relative;
  touch-action: none;
  user-select: none;
}

.chat__input-resize-handle::before {
  background: color-mix(
    in srgb,
    var(--shadow-claw-bg-secondary) 72%,
    var(--shadow-claw-border-color)
  );
  border: 0.0625rem solid
    color-mix(in srgb, var(--shadow-claw-border-color) 80%, transparent);
  border-radius: var(--shadow-claw-radius-pill);
  content: "";
  height: 0.5625rem;
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  transition:
    background-color 0.15s,
    border-color 0.15s,
    box-shadow 0.15s;
  width: min(11rem, 76%);
}

.chat__input-resize-handle::after {
  background: var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-pill);
  content: "";
  height: 0.125rem;
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  transition: background-color 0.15s;
  width: min(7.5rem, 56%);
}

.chat__input-resize-handle:hover::before,
.chat__input-resize-handle.active::before {
  background: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 16%,
    var(--shadow-claw-bg-secondary)
  );
  border-color: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 40%,
    transparent
  );
  box-shadow: 0 0 0.5rem
    color-mix(in srgb, var(--shadow-claw-accent-primary) 16%, transparent);
}

.chat__input-resize-handle:hover::after,
.chat__input-resize-handle.active::after {
  background: var(--shadow-claw-accent-primary);
}

.chat__input-resize-handle:focus-visible::before {
  background: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 16%,
    var(--shadow-claw-bg-secondary)
  );
  border-color: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 40%,
    transparent
  );
  box-shadow: 0 0 0.5rem
    color-mix(in srgb, var(--shadow-claw-accent-primary) 16%, transparent);
}

.chat__input-resize-handle:focus-visible::after {
  background: var(--shadow-claw-accent-primary);
}

.chat__input-resize-handle:focus-visible {
  outline: 0.125rem solid
    color-mix(in srgb, var(--shadow-claw-accent-primary) 60%, transparent);
  outline-offset: 0.0625rem;
}

.chat__input-area--resized .chat__input-wrapper {
  min-height: var(--chat-input-area-height, 2.5rem);
  min-width: 0;
}

.chat__input-resize-handle.active ~ .chat__input-wrapper,
.chat__input-resize-handle.active ~ .chat__input-controls {
  transition: none !important;
}

.chat__input-controls {
  display: none;
}

.chat__pending-attachments {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.chat__pending-attachment {
  align-items: center;
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  display: flex;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.5rem 0.625rem;
}

.chat__pending-attachment-meta {
  flex: 1;
  min-width: 0;
}

.chat__pending-attachment-name {
  color: var(--shadow-claw-text-primary);
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat__pending-attachment-detail {
  color: var(--shadow-claw-text-tertiary);
  display: block;
  font-size: 0.6875rem;
}

.chat__pending-attachment-remove {
  background: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  flex: 0 0 auto;
  font-size: 0.6875rem;
  line-height: 1;
  min-height: 1.5rem;
  min-width: 1.5rem;
  padding: 0.25rem;
}

.chat__pending-attachment-remove:hover,
.chat__pending-attachment-remove:focus-visible {
  border-color: var(--shadow-claw-error-color);
  color: var(--shadow-claw-error-color);
  outline: none;
}

.chat__transport-badge {
  border-radius: var(--shadow-claw-radius-pill);
  flex: 0 0 auto;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.45rem;
  text-transform: uppercase;
}

.chat__transport-badge--native {
  background: color-mix(
    in srgb,
    var(--shadow-claw-success-color) 15%,
    transparent
  );
  color: var(--shadow-claw-success-color);
}

.chat__transport-badge--text {
  background: color-mix(
    in srgb,
    var(--shadow-claw-info-color, #38bdf8) 15%,
    transparent
  );
  color: var(--shadow-claw-info-color, #38bdf8);
}

.chat__transport-badge--fallback {
  background: color-mix(
    in srgb,
    var(--shadow-claw-warning-color) 15%,
    transparent
  );
  color: var(--shadow-claw-warning-color);
}

.chat__input-wrapper {
  align-items: flex-end;
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-l);
  box-shadow: var(--shadow-claw-shadow-sm);
  display: flex;
  gap: 0.25rem;
  min-height: 2.75rem;
  padding: 0.25rem;
  transition: all 0.15s;
}

.chat__input-wrapper:focus-within {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 0.125rem var(--shadow-claw-bg-tertiary);
}

.chat__input {
  background: transparent;
  border: none;
  box-sizing: border-box;
  color: var(--shadow-claw-text-primary);
  flex: 1;
  font-family: var(--shadow-claw-font-sans);
  font-size: var(--shadow-claw-font-size-sm);
  height: 100%;
  line-height: 1.5;
  max-height: none;
  min-height: 1.5rem;
  overflow-y: auto;
  padding: 0.5rem 0.25rem;
  resize: none;
}

.chat__input::placeholder {
  color: var(--shadow-claw-text-tertiary);
}

.chat__input:focus {
  outline: none;
}

.chat__send-btn {
  align-items: center;
  background-color: var(--shadow-claw-text-primary);
  border: none;
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-bg-primary);
  cursor: pointer;
  display: flex;
  height: 2.25rem;
  justify-content: center;
  transition: background-color 0.15s;
  width: 2.25rem;
}

.chat__send-btn svg {
  height: 1.125rem;
  margin-left: 0.125rem;
  width: 1.125rem;
}

.chat__attach-btn {
  align-items: center;
  background-color: transparent;
  border: none;
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: flex;
  height: 2.25rem;
  justify-content: center;
  transition:
    color 0.15s,
    background-color 0.15s;
  width: 2.25rem;
}

.chat__attach-btn svg {
  height: 1.125rem;
  width: 1.125rem;
}

.chat__attach-btn:hover,
.chat__attach-btn:focus-visible {
  background-color: var(--shadow-claw-bg-tertiary);
  color: var(--shadow-claw-text-primary);
  outline: none;
}

.chat__attach-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.chat__send-btn:hover,
.chat__send-btn:focus-visible {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
  outline: none;
}

.chat__send-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.chat__restore-input {
  display: none;
}

.chat__attachment-input {
  display: none;
}

.chat__file-content {
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.8125rem;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

@media (min-width: 48rem) {
  .chat__body {
    padding: 1rem;
  }

  .chat__messages {
    padding: 1rem;
  }
}

/* Prompt API Onboarding Dialog */
dialog.chat__prompt-api-dialog {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-l, 1rem);
  box-shadow: var(--shadow-claw-shadow-lg, 0 1.25rem 2.5rem rgba(0, 0, 0, 0.4));
  color: var(--shadow-claw-text-primary);
  max-height: calc(100vh - 2rem);
  max-width: min(36rem, calc(100vw - 2rem));
  overflow-y: auto;
  padding: 0;
  width: 100%;
}

dialog.chat__prompt-api-dialog::backdrop {
  backdrop-filter: blur(0.25rem);
  background-color: rgba(0, 0, 0, 0.65);
}

.chat__prompt-api-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem;
}

@media (min-width: 40rem) {
  .chat__prompt-api-form {
    padding: 1.5rem;
  }
}

.chat__prompt-api-header {
  align-items: flex-start;
  border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
  display: flex;
  gap: 0.875rem;
  padding-bottom: 1rem;
}

.chat__prompt-api-icon {
  align-items: center;
  background: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 15%,
    transparent
  );
  border-radius: var(--shadow-claw-radius-m, 0.5rem);
  display: flex;
  flex-shrink: 0;
  font-size: 1.5rem;
  height: 2.75rem;
  justify-content: center;
  width: 2.75rem;
}

.chat__prompt-api-title {
  color: var(--shadow-claw-text-primary);
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.3;
  margin: 0;
}

.chat__prompt-api-subtitle {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.4;
  margin: 0.25rem 0 0;
}

.chat__prompt-api-body {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.chat__prompt-api-card {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m, 0.5rem);
  padding: 0.875rem 1rem;
}

.chat__prompt-api-card h4 {
  color: var(--shadow-claw-text-primary);
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 0.375rem;
}

.chat__prompt-api-card p {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.45;
  margin: 0;
}

.chat__prompt-api-badge {
  align-items: center;
  border-radius: var(--shadow-claw-radius-pill, 62.5rem);
  display: inline-flex;
  font-size: 0.75rem;
  font-weight: 600;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
  padding: 0.25rem 0.625rem;
}

.chat__prompt-api-badge--success {
  background: color-mix(
    in srgb,
    var(--shadow-claw-success-color, #0a9142) 15%,
    transparent
  );
  color: var(--shadow-claw-success-color, #0a9142);
}

.chat__prompt-api-badge--warning {
  background: color-mix(
    in srgb,
    var(--shadow-claw-warning-color, #f59e0b) 15%,
    transparent
  );
  color: var(--shadow-claw-warning-color, #f59e0b);
}

.chat__prompt-api-status-note {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.4;
  margin: 0;
}

.chat__prompt-api-instructions-title {
  color: var(--shadow-claw-text-primary) !important;
  font-size: 0.8125rem;
  font-weight: 600;
  margin: 0 0 0.375rem !important;
}

.chat__prompt-api-steps {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.45;
  margin: 0;
  padding-left: 1.25rem;
}

.chat__prompt-api-steps li {
  margin-bottom: 0.25rem;
}

.chat__prompt-api-steps li:last-child {
  margin-bottom: 0;
}

.chat__prompt-api-steps code {
  background-color: var(--shadow-claw-bg-tertiary);
  border-radius: 0.25rem;
  color: var(--shadow-claw-text-primary);
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.75rem;
  padding: 0.125rem 0.375rem;
}

.chat__prompt-api-model-desc {
  margin-bottom: 0.625rem !important;
}

.chat__prompt-api-select-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.chat__prompt-api-select-group .form-label {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.chat__prompt-api-select {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.375rem);
  color: var(--shadow-claw-text-primary);
  font-family: inherit;
  font-size: 0.8125rem;
  padding: 0.5rem 0.625rem;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  width: 100%;
}

.chat__prompt-api-select:focus {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 0.125rem var(--shadow-claw-bg-tertiary);
  outline: none;
}

.chat__prompt-api-actions {
  align-items: center;
  border-top: 0.0625rem solid var(--shadow-claw-border-color);
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
  padding-top: 1rem;
}

.chat__prompt-api-secondary-btn {
  background-color: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-pill, 62.5rem);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.5rem 1rem;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.chat__prompt-api-secondary-btn:hover,
.chat__prompt-api-secondary-btn:focus-visible {
  background-color: var(--shadow-claw-bg-secondary);
  border-color: var(--shadow-claw-border-hover);
  color: var(--shadow-claw-text-primary);
  outline: none;
}

.chat__prompt-api-confirm-btn {
  background-color: var(--shadow-claw-accent-primary);
  border: none;
  border-radius: var(--shadow-claw-radius-pill, 62.5rem);
  color: var(--shadow-claw-on-primary, #ffffff);
  cursor: pointer;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  margin-left: auto;
  padding: 0.625rem 1.25rem;
  transition:
    background-color 0.15s,
    transform 0.15s,
    box-shadow 0.15s;
}

.chat__prompt-api-confirm-btn:hover,
.chat__prompt-api-confirm-btn:focus-visible {
  background-color: var(
    --shadow-claw-accent-hover,
    var(--shadow-claw-accent-primary)
  );
  box-shadow: var(--shadow-claw-shadow-md);
  outline: none;
  transform: translateY(-0.0625rem);
}
`);const Ie=new DOMParser().parseFromString(`<template>
  <section class="chat" aria-label="Chat">
    <shadow-claw-page-header icon="&#128172;" title="Chat">
      <div slot="status" class="chat__status" aria-live="polite">
        <span class="chat__status-indicator" aria-hidden="true">&#9679;</span>
        <span class="chat__status-text">Ready</span>
        <span
          class="chat__typing-indicator"
          aria-label="Remote agent typing"
          hidden
        >
          <span class="chat__typing-dot"></span
          ><span class="chat__typing-dot"></span
          ><span class="chat__typing-dot"></span>
        </span>
      </div>
      <shadow-claw-page-header-action-button
        slot="actions"
        data-action="download-chat"
        title="Backup chat history"
      >
        &#128190; Backup
      </shadow-claw-page-header-action-button>
      <shadow-claw-page-header-action-button
        slot="actions"
        data-action="restore-chat"
        title="Restore chat from backup"
      >
        &#9851;&#65039; Restore
      </shadow-claw-page-header-action-button>
      <shadow-claw-page-header-action-button
        slot="actions"
        data-action="compact-chat"
        title="Compact conversation history to save context"
      >
        &#128230; Compact
      </shadow-claw-page-header-action-button>
      <shadow-claw-page-header-action-button
        slot="actions"
        data-action="stop-chat"
        title="Stop the current response"
        variant="danger"
        disabled
      >
        &#9209;&#65039; Stop Chat
      </shadow-claw-page-header-action-button>
      <shadow-claw-page-header-action-button
        slot="actions"
        data-action="clear-chat"
        title="Clear all chat messages"
        variant="danger"
      >
        &#128465;&#65039; Clear Chat
      </shadow-claw-page-header-action-button>
    </shadow-claw-page-header>

    <div class="chat__body">
      <div class="chat__terminal-slot" data-terminal-slot hidden></div>
      <div class="chat__tool-activity" aria-live="polite">
        &#9881;&#65039; Working...
      </div>
      <div
        class="chat__model-progress"
        aria-live="polite"
        aria-label="Model download progress"
      >
        <span class="chat__model-progress-label">
          Preparing Prompt API model...
        </span>
        <div class="chat__model-progress-track">
          <div class="chat__model-progress-bar"></div>
        </div>
      </div>
      <div
        class="chat__transfer-progress"
        aria-live="polite"
        aria-label="File transfer progress"
      >
        <span class="chat__transfer-progress-label"> Receiving file... </span>
        <div class="chat__transfer-progress-track">
          <div class="chat__transfer-progress-bar"></div>
        </div>
      </div>
      <div class="chat__activity-log" aria-live="polite"></div>
      <details class="chat__shared-state" hidden>
        <summary>Shared State</summary>
        <pre><code class="chat__shared-state-code"></code></pre>
      </details>
      <div
        class="chat__messages"
        role="log"
        aria-live="polite"
        aria-label="Conversation messages"
      ></div>
      <div class="chat__usage-metrics">
        <div class="chat__token-usage" aria-live="polite"></div>
        <div class="chat__context-usage" aria-live="polite"></div>
      </div>
      <div class="chat__attachment-capabilities" aria-live="polite"></div>
      <div class="chat__input-area">
        <div
          class="chat__input-resize-handle"
          title="Drag to resize input area"
        ></div>
        <div class="chat__pending-attachments" aria-live="polite" hidden></div>
        <div class="chat__input-wrapper">
          <button
            class="chat__attach-btn"
            data-action="attach-files"
            type="button"
            aria-label="Attach files"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <textarea
            class="chat__input"
            placeholder="Type a message... (Shift+Enter for newline)"
            rows="1"
            aria-label="Message input"
          ></textarea>
          <button
            class="chat__send-btn"
            data-action="send-message"
            type="button"
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="chat__drop-overlay" data-drop-overlay hidden>
        <div class="chat__drop-overlay-card">
          <div class="chat__drop-overlay-title">Drop to attach</div>
          <div class="chat__drop-overlay-subtitle">
            Files and plain text will be added to this message.
          </div>
        </div>
      </div>
    </div>

    <shadow-claw-dialog
      dialog-class="chat__prompt-api-dialog"
      dialog-aria-label="Prompt API Onboarding"
    >
      <form class="chat__prompt-api-form" method="dialog">
        <div class="chat__prompt-api-header">
          <div class="chat__prompt-api-icon" aria-hidden="true">&#10024;</div>
          <div>
            <h3 class="chat__prompt-api-title">
              Welcome to Local AI (Prompt API)
            </h3>
            <p class="chat__prompt-api-subtitle">
              On-device intelligence built directly into your browser.
            </p>
          </div>
        </div>

        <div class="chat__prompt-api-body">
          <section class="chat__prompt-api-card">
            <h4>&#128274; 100% On-Device</h4>
            <p>
              ShadowClaw defaults to the browser-native
              <strong>Prompt API</strong>. Models execute directly on your
              hardware with no API keys and no subscription costs.
            </p>
          </section>

          <section class="chat__prompt-api-card chat__prompt-api-status-card">
            <h4>&#127760; Browser Capabilities</h4>
            <div
              class="chat__prompt-api-status-content"
              data-info="prompt-api-status"
            >
              <!-- Populated dynamically based on native Prompt API support -->
            </div>
          </section>

          <section class="chat__prompt-api-card">
            <h4>&#128229; Local Model Download</h4>
            <p>
              Running AI locally requires downloading the model weights into
              your browser's local cache on first use. A progress bar will show
              download status in the chat. Once loaded, the model runs
              completely offline.
            </p>
          </section>

          <section class="chat__prompt-api-card chat__prompt-api-fallback-card">
            <h4>&#9881;&#65039; Default Prompt API Model</h4>
            <p class="chat__prompt-api-model-desc">
              Choose your default Prompt API fallback model. If native browser
              Prompt API is not enabled, ShadowClaw will run this local model
              directly in the browser:
            </p>
            <div class="chat__prompt-api-select-group">
              <label class="form-label" for="prompt-api-fallback-model-select"
                >Model Choice</label
              >
              <select
                id="prompt-api-fallback-model-select"
                class="form-select chat__prompt-api-select"
                data-setting="prompt-api-onboarding-fallback-model"
              >
                <option value="onnx-community/Qwen3-0.6B-ONNX" selected>
                  onnx-community/Qwen3-0.6B-ONNX &mdash; Recommended (Fast,
                  Compact &amp; Tool Calling)
                </option>
                <option value="onnx-community/gemma-3-1b-it-ONNX-GQA">
                  onnx-community/gemma-3-1b-it-ONNX-GQA &mdash; Alternative (1B
                  Parameters, Larger Download)
                </option>
              </select>
            </div>
          </section>

          <section class="chat__prompt-api-card">
            <h4>&#127760; Prefer Cloud AI or Another Provider?</h4>
            <p>
              Local AI with Prompt API is free and private, but not your only
              option. ShadowClaw also supports OpenRouter, Anthropic, OpenAI,
              Google Gemini, and AWS Bedrock. You can configure any provider at
              any time in Settings.
            </p>
          </section>
        </div>

        <div class="chat__prompt-api-actions">
          <button
            type="button"
            class="chat__prompt-api-secondary-btn"
            data-action="configure-other-provider"
          >
            &#9881;&#65039; Configure Other Provider in Settings
          </button>
          <button
            type="submit"
            class="chat__prompt-api-confirm-btn"
            data-action="confirm-prompt-api-onboarding"
          >
            Continue with Prompt API
          </button>
        </div>
      </form>
    </shadow-claw-dialog>

    <input
      class="chat__restore-input"
      type="file"
      accept=".zip,application/zip"
    />
    <input class="chat__attachment-input" type="file" multiple />
  </section>
</template>
`,`text/html`),Le=Ie.querySelector(`template`);let Re=[];Re=Le?Array.from(Le.content.children):Array.from(Ie.head.children).concat(Array.from(Ie.body.children));var ze=Re;const Be=128*1024,Ve=8e4;async function He(e,t){if(!e||typeof e.transaction!=`function`)return!0;try{return z(await s(e,t),!0)}catch{return!0}}const Ue=`shadow-claw-chat`;var We=class extends O{static styles=Fe;static template=ze;activityLogCollapsedOverride=null;activityLogVisibilityMediaQuery=null;db=null;#e;#t;#n;#r;#i;#a;#o;constructor(){super(),W.reset(),this.db=null,this.#n=0,this.#i=0,this.#a=!1,this.#o=0,this.#r=!0,this.#e=0,this.#t=[]}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.db=await a(),await this.restoreInputAreaHeight(),this.dispatchTerminalSlotReady(),this.setupEffects(),this.setupActivityLogVisibility(),this.bindEventListeners(),await this.checkPromptApiOnboarding()}disconnectedCallback(){this.activityLogVisibilityCleanup(),W.revokeAttachmentObjectUrls(),W.resetNearBottom(),super.disconnectedCallback()}activityLogVisibilityCleanup=()=>{};applyActivityLogVisibility(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.chat__activity-log`);if(!(t instanceof HTMLElement))return;let n=this.activityLogVisibilityMediaQuery?!this.activityLogVisibilityMediaQuery.matches:!1;(typeof this.activityLogCollapsedOverride==`boolean`?this.activityLogCollapsedOverride:n)?t.classList.add(`chat__activity-log--collapsed`):t.classList.remove(`chat__activity-log--collapsed`)}bindEventListeners(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.chat__messages`);if(t instanceof HTMLElement){t.addEventListener(`scroll`,()=>{this.#a||(this.#o+=1,this.isContainerNearBottom(t)||(this.#r=!1)),W.setNearBottom(this.isContainerNearBottom(t)),this.persistGroupScrollState(t)}),t.addEventListener(`click`,e=>{this.handleMessageLinkClick(e)}),t.addEventListener(`shadow-claw-a2ui-action`,async e=>{let{groupId:t,action:n}=e.detail;if(t.startsWith(`room:`)){await _.orchestrator?.routeRoomA2UIAction(t,n);return}if(t.startsWith(`peer:`)){let e=(_.orchestrator?.router)?.findChannel(t);e&&`sendA2UIAction`in e&&await e.sendA2UIAction(t,n)}let r=JSON.stringify(n.dataModel,null,2),i=`[A2UI ACTION]\nsurfaceId: "${n.surfaceId}"\nactionId: "${n.actionId}"\ndataModel:\n${r}\n\nInstructions: The user triggered the "${n.actionId}" action on surface "${n.surfaceId}". The dataModel above contains the current form values. Use the appropriate tool(s) to fulfill the action based on the actionId and dataModel values. After you have a result, call render_component with action "updateDataModel" on surfaceId "${n.surfaceId}" to update the surface (e.g. patch the output field with the result). Do NOT respond with plain text only — always update the surface via render_component.`;_.sendMessage(i,[],n)}),t.addEventListener(`shadow-claw-a2ui-function-response`,async e=>{let{groupId:t,response:n}=e.detail;if(!t.startsWith(`room:`)&&t.startsWith(`peer:`)){let e=(_.orchestrator?.router)?.findChannel(t);e&&`sendA2UIAction`in e&&await e.sendA2UIAction(t,n)}});let e=new ResizeObserver(()=>{this.shouldAutoFollow(t)&&(this.setMessagesScrollTop(t,t.scrollHeight),this.persistGroupScrollState(t))});e.observe(t),this.addCleanup(()=>e.disconnect())}let n=e.querySelector(`.chat__input`);n instanceof HTMLTextAreaElement&&n.addEventListener(`keydown`,e=>{e.key===`Enter`&&!e.shiftKey&&(e.preventDefault(),this.sendMessage()),e.key===`Enter`&&(e.ctrlKey||e.metaKey)&&(e.preventDefault(),this.sendMessage())});let r=e.querySelector(`.chat__input-area`),i=e.querySelector(`.chat__input-resize-handle`);r instanceof HTMLElement&&i instanceof HTMLElement&&this.bindInputResizeEvents(r,i),e.querySelector(`[data-action="send-message"]`)?.addEventListener(`click`,()=>this.sendMessage()),e.querySelector(`[data-action="attach-files"]`)?.addEventListener(`click`,()=>{let t=e.querySelector(`.chat__attachment-input`);t instanceof HTMLInputElement&&(t.value=``,t.click())}),e.querySelector(`.chat__attachment-input`)?.addEventListener(`change`,e=>{e.target instanceof HTMLInputElement&&this.queueSelectedFiles(e.target)}),e.querySelector(`[data-action="compact-chat"]`)?.addEventListener(`click`,()=>this.handleCompactChat()),e.querySelector(`[data-action="clear-chat"]`)?.addEventListener(`click`,()=>this.handleClearChat()),e.querySelector(`[data-action="stop-chat"]`)?.addEventListener(`click`,()=>this.handleStopChat()),e.querySelector(`[data-action="download-chat"]`)?.addEventListener(`click`,()=>this.downloadChat()),e.querySelector(`[data-action="restore-chat"]`)?.addEventListener(`click`,()=>{let t=e.querySelector(`.chat__restore-input`);t instanceof HTMLInputElement&&t.click()}),e.querySelector(`.chat__restore-input`)?.addEventListener(`change`,e=>{e.target instanceof HTMLInputElement&&this.restoreChat(e.target)});let a=e.querySelector(`.chat__body`);a instanceof HTMLElement&&(a.addEventListener(`dragenter`,e=>{this.hasDroppableData(e.dataTransfer)&&(e.preventDefault(),this.#e+=1,this.setDropOverlayVisible(!0))}),a.addEventListener(`dragover`,e=>{this.hasDroppableData(e.dataTransfer)&&e.preventDefault()}),a.addEventListener(`dragleave`,e=>{this.hasDroppableData(e.dataTransfer)&&(e.preventDefault(),this.#e=Math.max(0,this.#e-1),this.#e===0&&this.setDropOverlayVisible(!1))}),a.addEventListener(`drop`,e=>{this.hasDroppableData(e.dataTransfer)&&(e.preventDefault(),this.#e=0,this.setDropOverlayVisible(!1),this.queueDroppedData(e.dataTransfer))}));let o=e.querySelector(`.chat__prompt-api-form`);o instanceof HTMLFormElement&&o.addEventListener(`submit`,e=>{e.preventDefault(),this.confirmPromptApiOnboarding()});let s=e.querySelector(`[data-action="confirm-prompt-api-onboarding"]`);s instanceof HTMLElement&&s.addEventListener(`click`,e=>{e.preventDefault(),this.confirmPromptApiOnboarding()});let c=e.querySelector(`[data-action="configure-other-provider"]`);c instanceof HTMLElement&&c.addEventListener(`click`,e=>{e.preventDefault(),this.bypassPromptApiOnboardingToSettings()})}async checkPromptApiOnboarding(){if(!(D()&&!globalThis.__SHADOWCLAW_E2E_TEST_ONBOARDING__)&&(this.db||=await a(),this.db))try{let e=await s(this.db,i.PROVIDER);if((typeof e==`string`&&e.trim()?e.trim():`prompt_api`)!==`prompt_api`||z(await s(this.db,i.PROMPT_API_ONBOARDING_SEEN),!1))return;let t=this.shadowRoot;if(!t)return;this.ensureShadowDialogs();let n=j(),a=M(),o=n||a,c=t.querySelector(`.chat__prompt-api-status-card`);c instanceof HTMLElement&&(c.hidden=!o);let u=t.querySelector(`[data-info="prompt-api-status"]`);u instanceof HTMLElement&&l(u,A(n));let d=t.querySelector(`.chat__prompt-api-fallback-card`);d instanceof HTMLElement&&(d.hidden=o);let f=t.querySelector(`[data-setting="prompt-api-onboarding-fallback-model"]`);if(f){let e=await s(this.db,i.PROMPT_API_FALLBACK_MODEL);f.value=typeof e==`string`&&e.trim()?e.trim():r}let p=t.querySelector(`shadow-claw-dialog[dialog-class="chat__prompt-api-dialog"]`);if(p&&typeof p.showModal==`function`)p.showModal();else{let e=t.querySelector(`dialog.chat__prompt-api-dialog`);e instanceof HTMLDialogElement&&(typeof e.showModal==`function`?e.showModal():e.setAttribute(`open`,``))}}catch(e){console.warn(`Failed to check Prompt API onboarding:`,e)}}async bypassPromptApiOnboardingToSettings(){let e=this.shadowRoot;if(!e)return;if(this.db||=await a(),this.db)try{await b(this.db,i.PROMPT_API_ONBOARDING_SEEN,`true`)}catch(e){console.warn(`Failed to persist Prompt API onboarding status:`,e)}let t=e.querySelector(`shadow-claw-dialog[dialog-class="chat__prompt-api-dialog"]`);if(t&&typeof t.close==`function`)t.close();else{let t=e.querySelector(`dialog.chat__prompt-api-dialog`);t instanceof HTMLDialogElement&&t.close()}document.dispatchEvent(new CustomEvent(`shadow-claw-navigate`,{detail:{page:`settings`},bubbles:!0,composed:!0}))}async confirmPromptApiOnboarding(){let e=this.shadowRoot;if(!e)return;this.db||=await a();let t=e.querySelector(`[data-setting="prompt-api-onboarding-fallback-model"]`)?.value?.trim()||`onnx-community/Qwen3-0.6B-ONNX`;if(this.db)try{await b(this.db,i.PROMPT_API_FALLBACK_MODEL,t),await b(this.db,i.PROMPT_API_ONBOARDING_SEEN,`true`)}catch(e){console.warn(`Failed to persist Prompt API onboarding settings:`,e)}let n=e.querySelector(`shadow-claw-dialog[dialog-class="chat__prompt-api-dialog"]`);if(n&&typeof n.close==`function`)n.close();else{let t=e.querySelector(`dialog.chat__prompt-api-dialog`);t instanceof HTMLDialogElement&&t.close()}T(`Prompt API configured`,2500)}bindInputResizeEvents(e,t){t.setAttribute(`tabindex`,`0`),t.setAttribute(`role`,`separator`),t.setAttribute(`aria-orientation`,`horizontal`),t.setAttribute(`aria-label`,`Resize chat input area`);let n=()=>{let t=parseFloat(e.style.getPropertyValue(`--chat-input-area-height`));return Number.isFinite(t)&&t>0?t:40},r=()=>{let e=this.clampInputAreaHeight(2**53-1),r=Math.round(this.clampInputAreaHeight(n()));t.setAttribute(`aria-valuemin`,`40`),t.setAttribute(`aria-valuemax`,String(Math.round(e))),t.setAttribute(`aria-valuenow`,String(r))},i=null,a=0,o=0,s=t=>{if(t.pointerId!==i)return;let n=a-t.clientY,s=o+n;this.setInputAreaHeight(e,s),r()},c=()=>{if(i===null)return;i=null,t.classList.remove(`active`),document.removeEventListener(`pointermove`,s);let n=parseFloat(e.style.getPropertyValue(`--chat-input-area-height`));Number.isFinite(n)&&n>0?this.persistInputAreaHeight(n):this.persistInputAreaHeight(0)},l=e=>{e.pointerId===i&&c()};t.addEventListener(`pointerdown`,n=>{if(n.pointerType===`mouse`&&n.button!==0&&n.button!==-1)return;let r=e.querySelector(`.chat__input-wrapper`);if(!(r instanceof HTMLElement))return;n.preventDefault(),i=n.pointerId,a=n.clientY,e.classList.add(`chat__input-area--resized`);let c=parseFloat(e.style.getPropertyValue(`--chat-input-area-height`));o=Number.isFinite(c)&&c>0?c:r.getBoundingClientRect().height||40,t.classList.add(`active`),t.setPointerCapture(n.pointerId),document.addEventListener(`pointermove`,s)}),t.addEventListener(`pointerup`,l),t.addEventListener(`pointercancel`,c),t.addEventListener(`dblclick`,()=>{this.resetInputAreaHeight(e),this.persistInputAreaHeight(0),r(),this.scrollMessagesToBottomIfNeeded()}),t.addEventListener(`keydown`,t=>{let i=t.shiftKey?32:12,a=n(),o=null;if(t.key===`ArrowUp`?o=a+i:t.key===`ArrowDown`?o=a-i:t.key===`Home`?o=40:t.key===`End`&&(o=this.clampInputAreaHeight(2**53-1)),o===null)return;t.preventDefault(),this.setInputAreaHeight(e,o),r();let s=parseFloat(e.style.getPropertyValue(`--chat-input-area-height`));this.persistInputAreaHeight(Number.isFinite(s)&&s>0?this.clampInputAreaHeight(s):0),this.scrollMessagesToBottomIfNeeded()}),r(),this.addCleanup(()=>{c(),t.removeEventListener(`pointerup`,l),t.removeEventListener(`pointercancel`,c)})}buildQueuedAttachmentsFromFiles(e){return e.map(e=>{let t=e.name||`attachment.bin`;return{id:`${Date.now()}-${Math.random().toString(36).slice(2,10)}`,fileName:t,mimeType:P(t,e.type||``),size:e.size,source:{kind:`local-file`,file:e}}})}clampInputAreaHeight(e){let t=Math.floor(window.innerHeight*.45);return Math.max(40,Math.min(Math.max(40,t),e))}deferWorkspaceImageLoads(e){let t=document.createElement(`div`);t.innerHTML=e;let n=Array.from(t.querySelectorAll(`img[src]`));for(let e of n){let t=e.getAttribute(`src`);if(!t)continue;let n=this.resolveWorkspaceLinkPath(t);n&&(e.setAttribute(`data-inline-workspace-src`,n),e.removeAttribute(`src`))}return t.innerHTML}dispatchTerminalSlotReady(){this.dispatchEvent(new CustomEvent(`shadow-claw-terminal-slot-ready`,{bubbles:!0,composed:!0}))}formatAttachmentSize(e){return e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/(1024*1024)).toFixed(1)} MB`}formatAttachmentSubtitle(e){let t=[];return e.mimeType&&t.push(e.mimeType),typeof e.size==`number`&&t.push(this.formatAttachmentSize(e.size)),t.join(` · `)||`Attachment`}formatTokenCount(e){return typeof e==`number`?e.toLocaleString(`en-US`):`–`}getAttachmentIcon(e=``){let t=e.toLowerCase();return t.startsWith(`image/`)?`IMG`:t.startsWith(`video/`)?`VID`:t.startsWith(`audio/`)?`AUD`:t.includes(`pdf`)?`PDF`:t.startsWith(`text/`)||t.includes(`json`)?`TXT`:t.includes(`zip`)||t.includes(`tar`)?`ZIP`:`BIN`}getAttachmentTransportLabel(e,t,n){let r=m(e,t);return r===`text`?`text`:r===`image`&&(n.images||n.routerByFeatures)||r===`audio`&&(n.audio||n.routerByFeatures)||r===`document`&&(n.documents||n.routerByFeatures)?`native`:`fallback`}getContainerDistanceFromBottom(e){return Math.max(0,e.scrollHeight-e.scrollTop-e.clientHeight)}getMessagesContainer(){let e=this.shadowRoot?.querySelector(`.chat__messages`);return e instanceof HTMLElement?e:null}hasDroppableData(e){if(!e)return!1;if(e.files.length>0)return!0;let t=Array.from(e.types||[]);return t.includes(`Files`)||t.includes(`application/x-moz-file`)||t.includes(`text/plain`)}inferAttachmentModelSupport(e=[]){let t=p(_.orchestrator?.model?.toLowerCase()||``);return e.every(e=>{let n=(e.mimeType||``).toLowerCase();return this.isInlineTextMimeType(n)?!0:n.startsWith(`image/`)?t.images||t.routerByFeatures:n.startsWith(`audio/`)?t.audio||t.routerByFeatures:n.startsWith(`video/`)?t.video||t.routerByFeatures:!1})}injectCopyButtons(e){e.querySelectorAll(`pre`).forEach(e=>{if(e.querySelector(`.chat__code-copy-btn`))return;let t=document.createElement(`button`);t.className=`chat__code-copy-btn`,t.type=`button`,t.setAttribute(`aria-label`,`Copy code to clipboard`),t.textContent=`📋 Copy`,t.addEventListener(`click`,async()=>{let n=e.querySelector(`code`),r=n?n.textContent||``:e.textContent||``;try{await navigator.clipboard.writeText(r),t.textContent=`✅ Copied`,t.classList.add(`chat__code-copy-btn--copied`),setTimeout(()=>{t.textContent=`📋 Copy`,t.classList.remove(`chat__code-copy-btn--copied`)},1500)}catch{t.textContent=`⚠️ Failed`,setTimeout(()=>{t.textContent=`📋 Copy`},1500)}}),e.appendChild(t)})}injectMessageCopyButton(e,t){if(e.querySelector(`.chat__msg-copy-btn`))return;let n=e.querySelector(`.chat__message-content`);if(!n)return;let r=document.createElement(`button`);r.className=`chat__msg-copy-btn`,r.type=`button`,r.setAttribute(`aria-label`,`Copy message to clipboard`);let i=`http://www.w3.org/2000/svg`,a=document.createElementNS(i,`svg`);a.setAttribute(`fill`,`none`),a.setAttribute(`stroke-width`,`1.5`),a.setAttribute(`stroke`,`currentColor`),a.setAttribute(`viewBox`,`0 0 24 24`);let o=document.createElementNS(i,`path`);o.setAttribute(`d`,`M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75`),o.setAttribute(`stroke-linecap`,`round`),o.setAttribute(`stroke-linejoin`,`round`),a.append(o),r.append(a),r.addEventListener(`click`,async()=>{try{await navigator.clipboard.writeText(t),r.classList.add(`chat__msg-copy-btn--copied`),r.setAttribute(`aria-label`,`Copied!`),setTimeout(()=>{r.classList.remove(`chat__msg-copy-btn--copied`),r.setAttribute(`aria-label`,`Copy message to clipboard`)},1500)}catch{r.setAttribute(`aria-label`,`Copy failed`),setTimeout(()=>{r.setAttribute(`aria-label`,`Copy message to clipboard`)},1500)}}),n.appendChild(r)}injectMessageDeleteButton(e,t){if(e.querySelector(`.chat__msg-delete-btn`))return;let n=e.querySelector(`.chat__message-content`);if(!n)return;let r=document.createElement(`button`);r.className=`chat__msg-delete-btn`,r.type=`button`,r.setAttribute(`aria-label`,`Delete message`);let i=`http://www.w3.org/2000/svg`,a=document.createElementNS(i,`svg`);a.setAttribute(`fill`,`none`),a.setAttribute(`stroke-width`,`1.5`),a.setAttribute(`stroke`,`currentColor`),a.setAttribute(`viewBox`,`0 0 24 24`);let o=document.createElementNS(i,`path`);o.setAttribute(`d`,`M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0`),o.setAttribute(`stroke-linecap`,`round`),o.setAttribute(`stroke-linejoin`,`round`),a.append(o),r.append(a),r.addEventListener(`click`,async()=>{await this.showAttachmentDialog({mode:`confirm`,title:`Delete Message`,message:`Delete this message? This action cannot be undone.`,confirmLabel:`Delete`,cancelLabel:`Cancel`})&&this.db&&await _.deleteMessage(this.db,t)}),n.appendChild(r)}isCollapsedInputAreaHeight(e){return e<=41}isContainerNearBottom(e){let{scrollTop:t,scrollHeight:n,clientHeight:r}=e;return n-t-r<80}isInlineTextMimeType(e){let t=e.toLowerCase();return t.startsWith(`text/`)?!0:t===`application/json`||t===`application/xml`||t===`application/javascript`}isLatestRender(e){return e===this.#n}persistGroupScrollState(e){let t=_.activeGroupId,n=this.isContainerNearBottom(e),r=n?0:this.getContainerDistanceFromBottom(e);W.setGroupScrollState(t,r,n)}removeStreamingBubble(e){e.querySelector(`.chat__message--streaming`)?.remove()}renderAttachmentCapabilitySummary(){let e=this.shadowRoot?.querySelector(`.chat__attachment-capabilities`);if(!(e instanceof HTMLElement))return;let t=_.orchestrator?.model||``;if(!t){e.textContent=``;return}e.textContent=`Model attachment support: ${v(t)}`}renderQueuedAttachments(){let e=this.shadowRoot?.querySelector(`.chat__pending-attachments`);if(!(e instanceof HTMLElement))return;if(this.#t.length===0){e.hidden=!0,e.replaceChildren();return}let t=p((_.orchestrator?.model||``).toLowerCase());e.hidden=!1;let n=document.createDocumentFragment();for(let e of this.#t){let r=document.createElement(`div`);r.className=`chat__pending-attachment`;let i=document.createElement(`span`);i.className=`chat__attachment-icon`,i.setAttribute(`aria-hidden`,`true`),i.textContent=this.getAttachmentIcon(e.mimeType);let a=document.createElement(`div`);a.className=`chat__pending-attachment-meta`;let o=document.createElement(`span`);o.className=`chat__pending-attachment-name`,o.textContent=e.fileName;let s=document.createElement(`span`);s.className=`chat__pending-attachment-detail`,s.textContent=`${e.mimeType} · ${this.formatAttachmentSize(e.size)}`,a.append(o,s);let c=this.getAttachmentTransportLabel(e.mimeType,e.fileName,t),l=document.createElement(`span`);l.className=`chat__transport-badge chat__transport-badge--${c}`,l.setAttribute(`aria-label`,`Transport: ${c}`),l.textContent=c;let u=document.createElement(`button`);u.type=`button`,u.className=`chat__pending-attachment-remove`,u.setAttribute(`aria-label`,`Remove ${e.fileName}`),u.textContent=`x`,u.addEventListener(`click`,()=>{this.#t=this.#t.filter(t=>t.id!==e.id),this.renderQueuedAttachments()}),r.append(i,a,l,u),n.appendChild(r)}e.replaceChildren(n)}resetInputAreaHeight(e){e.classList.remove(`chat__input-area--resized`),e.style.removeProperty(`--chat-input-area-height`)}resolveWorkspaceLinkPath(e){let t=e.trim();if(!t||t.startsWith(`#`)||/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(t)||t.startsWith(`//`))return null;let n=t.split(/[?#]/,1)[0].replace(/\\/g,`/`);if(n=n.replace(/^\/+/,``),n=n.replace(/^\.\//,``),!n)return null;let r=n.split(`/`).filter(Boolean);return r.some(e=>e===`..`)?null:r.join(`/`)}revokeAttachmentObjectUrls(){W.revokeAttachmentObjectUrls()}scheduleBottomSnap(e){let t=()=>{this.isLatestRender(e)&&this.scrollMessagesToBottomIfNeeded()};requestAnimationFrame(()=>{t(),requestAnimationFrame(t)}),setTimeout(t,120)}scrollMessagesToBottomIfNeeded(){let e=this.shadowRoot?.querySelector(`.chat__messages`);e instanceof HTMLElement&&W.isNearBottom&&(this.setMessagesScrollTop(e,e.scrollHeight),W.setNearBottom(this.isContainerNearBottom(e)),this.persistGroupScrollState(e))}setActivityLogCollapsedOverride(e){this.activityLogCollapsedOverride=e,this.applyActivityLogVisibility()}setDropOverlayVisible(e){let t=this.shadowRoot?.querySelector(`[data-drop-overlay]`);t instanceof HTMLElement&&(t.hidden=!e)}setInputAreaHeight(e,t){let n=this.clampInputAreaHeight(t);if(this.isCollapsedInputAreaHeight(n)){this.resetInputAreaHeight(e);return}e.classList.add(`chat__input-area--resized`),e.style.setProperty(`--chat-input-area-height`,`${n}px`)}setMessagesScrollTop(e,t){this.#a=!0,e.scrollTop=t,requestAnimationFrame(()=>{this.#a=!1})}setupActivityLogVisibility(){if(this.shadowRoot){if(typeof globalThis.matchMedia==`function`){this.activityLogVisibilityMediaQuery=globalThis.matchMedia(`(min-width: 56rem) and (min-height: 401px)`);let e=()=>this.applyActivityLogVisibility();this.activityLogVisibilityMediaQuery.addEventListener(`change`,e),this.activityLogVisibilityCleanup=()=>{this.activityLogVisibilityMediaQuery?.removeEventListener(`change`,e)}}this.applyActivityLogVisibility()}}setupEffects(){let e=this.shadowRoot;e&&(this.addCleanup(k(()=>{let t=++this.#n,n=_.activeGroupId,r=_.messages,a=e.querySelector(`.chat__messages`);if(!(a instanceof HTMLElement))return;let o=W.getGroupScrollState(n);o?W.setNearBottom(o.nearBottom):W.setNearBottom(!0);let s=this.shouldAutoFollow(a),u=this.#o,d=s?0:o?.distanceFromBottom??this.getContainerDistanceFromBottom(a);this.revokeAttachmentObjectUrls(),a.replaceChildren(),(async()=>{let e=await He(this.db,i.MARKDOWN_FRONTMATTER_CHAT);for(let n of r){if(!this.isLatestRender(t))return!1;if(n.a2uiAction||n.content&&n.content.startsWith(`[A2UI ACTION]`))continue;let r=n.isFromMe?`assistant`:`user`,i=localStorage.getItem(`assistantName`)||`example`,o=n.isFromMe?i:n.sender||`You`,u=document.createElement(`article`);u.className=`chat__message chat__message--${r}`;let d=n.timestamp?c(n.timestamp):``,f=await N(n.content,{breaks:!0,renderFrontmatter:e}),p=document.createElement(`div`);p.className=`chat__message-header`;let m=document.createElement(`div`);m.className=`chat__message-sender`,m.textContent=o;let h=document.createElement(`div`);h.className=`chat__message-timestamp`,h.textContent=d,p.append(m,h),u.append(p);let g=document.createElement(`div`);if(g.className=`chat__message-content`,n.content&&(l(g,this.deferWorkspaceImageLoads(f)),await this.resolveImagePaths(n.groupId,g),!this.isLatestRender(t)))return!1;let _=await this.renderMessageAttachments(n);if(_&&g.appendChild(_),n.a2uiEnvelopes&&n.a2uiEnvelopes.length>0){let e=document.createElement(`shadow-claw-a2ui-interceptor`),t=document.createElement(`shadow-claw-a2ui`);t.groupId=n.groupId;for(let e of n.a2uiEnvelopes)t.applyEnvelope(e);e.appendChild(t),g.appendChild(e)}u.appendChild(g),a.appendChild(u),s&&(this.setMessagesScrollTop(a,a.scrollHeight),this.persistGroupScrollState(a)),n.content&&n.id&&(this.injectMessageCopyButton(u,n.content),this.injectMessageDeleteButton(u,n.id)),g instanceof HTMLElement&&n.content&&this.injectCopyButtons(g)}return!0})().then(async e=>{if(!e||!this.isLatestRender(t))return;let n=this.#o!==u;this.shouldAutoFollow(a)?(this.setMessagesScrollTop(a,a.scrollHeight),W.setNearBottom(this.isContainerNearBottom(a)),this.persistGroupScrollState(a),this.scheduleBottomSnap(t)):n?(W.setNearBottom(this.isContainerNearBottom(a)),this.persistGroupScrollState(a)):(this.setMessagesScrollTop(a,a.scrollHeight-a.clientHeight-d),W.setNearBottom(this.isContainerNearBottom(a)),this.persistGroupScrollState(a))})})),this.addCleanup(k(()=>{let e=_.streamingText;this.renderStreamingBubble(e)})),this.addCleanup(k(()=>{_.ready,_.state,this.renderAttachmentCapabilitySummary()})),this.addCleanup(k(()=>{let t=_.tokenUsageAccumulator,n=e.querySelector(`.chat__token-usage`);if(n instanceof HTMLElement)if(t&&(t.inputTokens||t.outputTokens)){n.classList.add(`chat__token-usage--visible`);let{cacheTokens:e,promptTokens:r,outputTokens:i,totalTokens:a}=G(t),o=document.createElement(`span`);o.textContent=`⬆ ${this.formatTokenCount(r)} in`;let s=document.createElement(`span`);s.textContent=`⬇ ${this.formatTokenCount(i)} out`;let c=document.createElement(`span`);c.textContent=`Σ ${this.formatTokenCount(a)}`;let l=[o,s,c];if(e>0){let t=document.createElement(`span`);t.textContent=`⛁ ${this.formatTokenCount(e)} cached`,l.push(t)}n.replaceChildren(...l)}else n.classList.remove(`chat__token-usage--visible`),n.replaceChildren()})),this.addCleanup(k(()=>{let t=_.contextUsage,n=e.querySelector(`.chat__context-usage`);if(n instanceof HTMLElement)if(t&&t.contextLimit>0){let e=Math.min(t.usagePercent,100),r=e>80?`high`:e>50?`medium`:`low`;n.classList.add(`chat__context-usage--visible`);let i=document.createElement(`span`);i.textContent=`${this.formatTokenCount(t.estimatedTokens)} / ${this.formatTokenCount(t.contextLimit)}`;let a=document.createElement(`div`);a.className=`chat__context-bar`;let o=document.createElement(`div`);o.className=`chat__context-bar-fill chat__context-bar-fill--${r}`,o.style.width=`${e}%`,a.append(o);let s=document.createElement(`span`);s.textContent=`${e.toFixed(0)}%`;let c=[i,a,s];if(t.truncatedCount>0){let e=document.createElement(`span`);e.textContent=`(${t.truncatedCount} msgs trimmed)`,c.push(e)}n.replaceChildren(...c)}else n.classList.remove(`chat__context-usage--visible`),n.replaceChildren()})),this.addCleanup(k(()=>{let t=_.toolActivity,n=_.aguiEvent,r=e.querySelector(`.chat__tool-activity`);r instanceof HTMLElement&&(n?.event?.type===`TOOL_CALL_START`&&n.event.toolCallName?(r.classList.add(`chat__tool-activity--active`),r.textContent=`⚙️ Using ${n.event.toolCallName}...`):t?(r.classList.add(`chat__tool-activity--active`),r.textContent=`⚙️ Using ${t.tool}...`):(r.classList.remove(`chat__tool-activity--active`),r.textContent=`⚙️ Working...`))})),this.addCleanup(k(()=>{let t=_.modelDownloadProgress,n=e.querySelector(`.chat__model-progress`),r=e.querySelector(`.chat__model-progress-label`),i=e.querySelector(`.chat__model-progress-bar`);if(!(n instanceof HTMLElement)||!(r instanceof HTMLElement)||!(i instanceof HTMLElement))return;if(!t){n.classList.remove(`chat__model-progress--active`),r.textContent=`Initializing local model...`,i.style.width=`0%`;return}let a=typeof t.progress==`number`?Math.max(0,Math.min(1,t.progress)):0,o=Math.round(a*100);n.classList.add(`chat__model-progress--active`),r.textContent=t.message||(t.status===`done`?`Model ready.`:`Downloading local model... ${o}%`),i.style.width=`${o}%`})),this.addCleanup(k(()=>{let t=F.get(),n=e.querySelector(`.chat__transfer-progress`),r=e.querySelector(`.chat__transfer-progress-label`),i=e.querySelector(`.chat__transfer-progress-bar`);if(!(n instanceof HTMLElement)||!(r instanceof HTMLElement)||!(i instanceof HTMLElement))return;if(!t||t.total===0){n.classList.remove(`chat__transfer-progress--active`),r.textContent=``,i.style.width=`0%`;return}let a=Math.max(0,Math.min(1,t.count/t.total)),o=Math.round(a*100),s=t.direction===`send`?`Sending`:`Receiving`;n.classList.add(`chat__transfer-progress--active`),r.textContent=`${s} file… ${o}%`,i.style.width=`${o}%`})),this.addCleanup(k(()=>{let t=_.activityLog,n=e.querySelector(`.chat__activity-log`);if(n instanceof HTMLElement)if(t.length>0){n.classList.add(`chat__activity-log--active`);let e=t.map(e=>`[${e.level}] ${e.label||``}: ${e.message}`).join(`
`),r=document.createElement(`div`);r.className=`chat__activity-log__header`;let i=document.createElement(`span`);i.className=`chat__activity-log__label`,i.textContent=`Activity Log`;let a=document.createElement(`button`);a.className=`chat__activity-log__copy-btn`,a.type=`button`,a.setAttribute(`aria-label`,`Copy activity log to clipboard`);let o=`http://www.w3.org/2000/svg`,s=document.createElementNS(o,`svg`);s.setAttribute(`fill`,`none`),s.setAttribute(`stroke-width`,`1.5`),s.setAttribute(`stroke`,`currentColor`),s.setAttribute(`viewBox`,`0 0 24 24`);let c=document.createElementNS(o,`path`);c.setAttribute(`d`,`M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75`),c.setAttribute(`stroke-linecap`,`round`),c.setAttribute(`stroke-linejoin`,`round`),s.append(c),a.append(s),a.addEventListener(`click`,async()=>{try{await navigator.clipboard.writeText(e),a.classList.add(`chat__activity-log__copy-btn--copied`),a.setAttribute(`aria-label`,`Copied!`),setTimeout(()=>{a.classList.remove(`chat__activity-log__copy-btn--copied`),a.setAttribute(`aria-label`,`Copy activity log to clipboard`)},1500)}catch{a.setAttribute(`aria-label`,`Copy failed`),setTimeout(()=>{a.setAttribute(`aria-label`,`Copy activity log to clipboard`)},1500)}}),r.append(i,a);let l=document.createElement(`div`);l.className=`chat__activity-log__entries`,t.forEach(e=>{let t=document.createElement(`div`);t.textContent=`[${e.level}] ${e.label||``}: ${e.message}`,l.append(t)}),n.replaceChildren(r,l),l.scrollTop=l.scrollHeight}else n.classList.remove(`chat__activity-log--active`),n.replaceChildren()})),this.addCleanup(k(()=>{let t=_.activeGroupId,n=e.querySelector(`.chat__shared-state`),r=e.querySelector(`.chat__shared-state-code`);if(!(n instanceof HTMLElement)||!(r instanceof HTMLElement))return;let i=_.getPeerState(t);i&&Object.keys(i).length>0?(n.hidden=!1,r.textContent=JSON.stringify(i,null,2)):(n.hidden=!0,r.textContent=``)})),this.addCleanup(k(()=>{let t=_.state,n=_.activeGroupId,r=e.querySelector(`.chat__status-text`),i=e.querySelector(`.chat__status-indicator`),a=e.querySelector(`.chat__typing-indicator`);if(!(r instanceof HTMLElement)||!(i instanceof HTMLElement)||!(a instanceof HTMLElement))return;let o=n.startsWith(`peer:`),s=o&&_.isRemoteAgentTyping(n),c=o?te(_.getRemoteAgentStatus(n),s):t;i.classList.remove(`chat__status-indicator--thinking`,`chat__status-indicator--responding`,`chat__status-indicator--error`),(c===`thinking`||c===`responding`)&&i.classList.add(`chat__status-indicator--${c}`),c===`error`&&i.classList.add(`chat__status-indicator--error`),r.textContent=c.charAt(0).toUpperCase()+c.slice(1),a.toggleAttribute(`hidden`,!s)})),this.addCleanup(k(()=>{let t=_.state,n=e.querySelector(`[data-action="send-message"]`),r=e.querySelector(`[data-action="stop-chat"]`),i=t===`thinking`||t===`responding`;n instanceof HTMLButtonElement&&(n.disabled=i),r instanceof HTMLButtonElement?r.disabled=!i:r?.toggleAttribute(`disabled`,!i)})),this.addCleanup(k(()=>{let e=_.error;e&&(E(e,6e3),_.clearError())})))}shouldAutoFollow(e){let t=_.state,n=t===`thinking`||t===`responding`,r=this.isContainerNearBottom(e);return n?(r&&(this.#r=!0),this.#r):(this.#r=!0,W.nearBottomSnapshot||r)}async buildMessageDraftPayload(e){let t=e.trim(),n=this.#t.map(e=>{let t=e.mimeType===`image/png`?`inline`:`file`;return{id:e.id,fileName:e.fileName,mimeType:e.mimeType,size:e.size,source:e.source,previewDisposition:t}});if(n.length===0)return{text:t,attachments:n};if(n.filter(e=>!this.isInlineTextMimeType(e.mimeType||``)).length>0&&!this.inferAttachmentModelSupport(n)&&!await this.showAttachmentDialog({mode:`confirm`,title:`Limited Attachment Support`,message:`The selected model may not natively read binary attachments (images/audio/video/docs). Files will still be attached to chat history, but responses might be limited.`,confirmLabel:`Send Anyway`,cancelLabel:`Cancel`,details:[`Try a multimodal model for best binary-file results.`,`Text files are inlined automatically when they are reasonably small.`]}))return null;let r=n.map(e=>`- ${e.fileName} (${e.mimeType||`application/octet-stream`}, ${this.formatAttachmentSize(e.size||0)})`),i=[],a=0;for(let e of this.#t){if(!this.isInlineTextMimeType(e.mimeType))continue;if(e.size>Be){i.push(`File: ${e.fileName}\nSkipped inline content because the file is larger than ${this.formatAttachmentSize(Be)}.`);continue}if(e.source.kind!==`local-file`)continue;let t=await e.source.file.text();if(a+=t.length,a>Ve)return await this.showAttachmentDialog({mode:`info`,title:`Attachment Context Too Large`,message:`The dropped text content exceeds the safe prompt budget. Remove some files or send them in smaller batches.`,details:[`Current inline text budget: ${Ve.toLocaleString()} characters`,`Large text blobs can degrade response quality and exhaust context.`],confirmLabel:`OK`}),null;i.push(`File: ${e.fileName}\n${t}`)}return{text:`${t?`${t}\n\n`:``}${`Attached files:\n${r.join(`
`)}`}${i.length>0?`\n\nAttached text excerpts:\n\n${i.join(`

---

`)}`:``}`,attachments:n}}async downloadAttachment(e,t){if(!(!this.db||!t.path))try{await L(this.db,e,t.path)}catch(e){E(`Failed to download attachment: ${e instanceof Error?e.message:String(e)}`,5e3)}}async downloadChat(){if(this.db)try{let e=_.activeGroupId,t=await H(this.db,e);if(!t){E(`Failed to export chat data`,6e3);return}let n=new B.default;n.file(`chat-data.json`,JSON.stringify(t,null,2));let r=await n.generateAsync({type:`blob`}),i=URL.createObjectURL(r),a=document.createElement(`a`);a.href=i,a.download=`chat-${u()}.zip`,document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(i),T(`Chat backup downloaded`,3e3)}catch(e){E(`Failed to download chat: ${e instanceof Error?e.message:String(e)}`,6e3)}}async handleClearChat(){let e=this.shadowRoot;if(!e||!this.db)return;let t=e.querySelector(`.chat__messages`);t instanceof HTMLElement&&t.replaceChildren();try{await _.newSession(this.db)}catch(e){let t=e instanceof Error?e.message:String(e);console.warn(`Failed to clear session:`,t)}}async handleCompactChat(){if(this.db&&await this.showAttachmentDialog({mode:`confirm`,title:`Compact Conversation`,message:`This will summarize the conversation to reduce token usage. The summary replaces the current history. Continue?`,confirmLabel:`Compact`,cancelLabel:`Cancel`}))try{await _.compactContext(this.db),w(`Compacting context...`,2500)}catch(e){E(`Failed to compact chat: ${e instanceof Error?e.message:String(e)}`,6e3)}}async handleMessageLinkClick(e){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;let t=e.target;if(!(t instanceof Element))return;let n=t.closest(`a`);if(!(n instanceof HTMLAnchorElement))return;let r=n.getAttribute(`href`)||``,i=_.activeGroupId;d(r,``,i)&&e.preventDefault()}async handleStopChat(){try{_.stopCurrentRequest(),w(`Stopped current request`,2200)}catch(e){E(`Failed to stop request: ${e instanceof Error?e.message:String(e)}`,6e3)}}async openAttachment(e,t){if(!(!this.db||!t.path))try{await R.openFile(this.db,t.path,e)}catch(e){E(`Failed to open attachment: ${e instanceof Error?e.message:String(e)}`,5e3)}}async persistInputAreaHeight(e){if(this.db)try{await b(this.db,i.CHAT_INPUT_AREA_HEIGHT,e)}catch{}}async queueDroppedData(e){if(!e)return;let t=this.buildQueuedAttachmentsFromFiles(Array.from(e.files||[])),n=await this.readDroppedPlainText(e);if(n){let e=n.trim();if(e){let n=new Blob([e],{type:`text/plain`});t.push({id:`${Date.now()}-${Math.random().toString(36).slice(2,10)}`,fileName:`dropped-text-${new Date().toISOString().slice(0,19).replace(/[:T]/g,`-`)}.txt`,mimeType:`text/plain`,size:n.size,source:{kind:`local-file`,file:n}})}}t.length!==0&&(this.#t=[...this.#t,...t],this.renderQueuedAttachments(),w(`Queued ${t.length} attachment${t.length===1?``:`s`}.`,2200))}async queueSelectedFiles(e){let t=Array.from(e.files||[]);if(t.length===0){e.value=``;return}let n=this.buildQueuedAttachmentsFromFiles(t);this.#t=[...this.#t,...n],this.renderQueuedAttachments(),w(`Queued ${n.length} attachment${n.length===1?``:`s`}.`,2200),e.value=``}async readDroppedPlainText(e){let t=Array.from(e.items||[]).find(e=>e.kind===`string`&&e.type===`text/plain`);return t?await new Promise(e=>{t.getAsString(t=>{e(t||``)})}):``}async renderInlineAttachmentPreview(e,t){if(!this.db||!t.path)return null;try{let n=await g(this.db,e.groupId,t.path),r=new Uint8Array(n.byteLength);r.set(n);let i=new Blob([r],{type:t.mimeType||`image/png`}),a=URL.createObjectURL(i);W.registerAttachmentObjectUrl(a);let o=document.createElement(`button`);o.className=`chat__attachment-preview-btn`,o.type=`button`,o.setAttribute(`aria-label`,`Open ${t.fileName}`),o.addEventListener(`click`,()=>{this.openAttachment(e.groupId,t)});let s=document.createElement(`img`);return s.className=`chat__attachment-preview`,s.alt=t.fileName,s.src=a,o.appendChild(s),o}catch(e){let t=document.createElement(`div`);return t.className=`chat__attachment-preview-error`,t.textContent=e instanceof Error?e.message:`Attachment preview unavailable.`,t}}async renderMessageAttachments(e){if(!Array.isArray(e.attachments)||e.attachments.length===0)return null;let t=document.createElement(`div`);t.className=`chat__attachments`;for(let n of e.attachments){let r=document.createElement(`section`);if(r.className=`chat__attachment`,I(n)&&n.path){let t=await this.renderInlineAttachmentPreview(e,n);t&&r.appendChild(t)}let i=document.createElement(`div`);i.className=`chat__attachment-meta`;let a=document.createElement(`div`);a.className=`chat__attachment-identity`;let o=document.createElement(`span`);o.className=`chat__attachment-icon`,o.setAttribute(`aria-hidden`,`true`),o.textContent=this.getAttachmentIcon(n.mimeType||``);let s=document.createElement(`button`);s.className=`chat__attachment-title`,s.type=`button`,s.textContent=n.fileName,s.disabled=!n.path||!this.db,s.addEventListener(`click`,()=>{this.openAttachment(e.groupId,n)}),a.append(o,s),i.appendChild(a);let c=document.createElement(`div`);c.className=`chat__attachment-subtitle`,c.textContent=this.formatAttachmentSubtitle(n),i.appendChild(c);let l=document.createElement(`div`);if(l.className=`chat__attachment-actions`,n.path&&this.db){let t=document.createElement(`button`);t.className=`chat__attachment-action`,t.type=`button`,t.textContent=`Open`,t.addEventListener(`click`,()=>{this.openAttachment(e.groupId,n)}),l.appendChild(t);let r=document.createElement(`button`);r.className=`chat__attachment-action`,r.type=`button`,r.textContent=`Download`,r.addEventListener(`click`,()=>{this.downloadAttachment(e.groupId,n)}),l.appendChild(r)}i.appendChild(l),r.appendChild(i),t.appendChild(r)}return t}async renderStreamingBubble(e){let t=++this.#i,n=this.getMessagesContainer();if(!n)return;let r=this.shouldAutoFollow(n);if(!(typeof e==`string`&&e.length>0)){this.removeStreamingBubble(n);return}let i=n.querySelector(`.chat__message--streaming`),a=null;if(!i){let e=localStorage.getItem(`assistantName`)||`example`;i=document.createElement(`article`),i.className=`chat__message chat__message--assistant chat__message--streaming`;let t=document.createElement(`div`);t.className=`chat__message-header`;let r=document.createElement(`div`);r.className=`chat__message-sender`,r.textContent=e;let o=document.createElement(`div`);o.className=`chat__message-timestamp`,o.textContent=`streaming…`,t.append(r,o),a=document.createElement(`div`),a.className=`chat__message-content`,i.append(t,a),n.appendChild(i)}else if(a=i.querySelector(`.chat__message-content`),!(a instanceof HTMLElement))return;let o=K(e).replace(/\n/g,`<br>`).replace(/`([^`]+?)`/g,`<code>$1</code>`).replace(/\*\*([^*]+?)\*\*/g,`<b>$1</b>`);if(t!==this.#i)return;l(a,o);let s=document.createElement(`span`);s.setAttribute(`aria-hidden`,`true`),s.className=`chat__streaming-cursor`,a.append(s),i.querySelector(`.chat__msg-copy-btn`)?.remove(),this.injectMessageCopyButton(i,e),this.injectCopyButtons(a),r&&(this.setMessagesScrollTop(n,n.scrollHeight),W.setNearBottom(this.isContainerNearBottom(n)),this.persistGroupScrollState(n))}async resolveImagePaths(e,t){if(!this.db)return;let n=Array.from(t.querySelectorAll(`img`));for(let t of n){let n=t.getAttribute(`data-inline-workspace-src`)||t.getAttribute(`src`)||``,r=this.resolveWorkspaceLinkPath(n);if(r)try{let n=await g(this.db,e,r),i=new Uint8Array(n.byteLength);i.set(n);let a=r.toLowerCase();if(a.endsWith(`.pdf`)){let e=document.createElement(`shadow-claw-pdf-viewer`);e.file={name:r.split(`/`).pop()||`document.pdf`,binaryContent:i},t.replaceWith(e)}else{let e=`image/png`;a.endsWith(`.jpg`)||a.endsWith(`.jpeg`)?e=`image/jpeg`:a.endsWith(`.gif`)?e=`image/gif`:a.endsWith(`.webp`)?e=`image/webp`:a.endsWith(`.svg`)&&(e=`image/svg+xml`);let n=new Blob([i],{type:e}),r=URL.createObjectURL(n);W.registerAttachmentObjectUrl(r),t.addEventListener(`load`,()=>this.scrollMessagesToBottomIfNeeded(),{once:!0}),t.removeAttribute(`data-inline-workspace-src`),t.src=r}}catch(e){console.warn(`Failed to load inline image: ${r}`,e)}}let r=Array.from(t.querySelectorAll(`a[href]`));for(let t of r){let n=t.getAttribute(`href`)||``,r=this.resolveWorkspaceLinkPath(n);if(!(!r||!r.toLowerCase().endsWith(`.pdf`)))try{let n=await g(this.db,e,r),i=new Uint8Array(n.byteLength);i.set(n);let a=document.createElement(`shadow-claw-pdf-viewer`);a.file={name:r.split(`/`).pop()||`document.pdf`,binaryContent:i},t.insertAdjacentElement(`afterend`,a),requestAnimationFrame(()=>this.scrollMessagesToBottomIfNeeded()),setTimeout(()=>this.scrollMessagesToBottomIfNeeded(),120)}catch(e){console.warn(`Failed to load inline PDF: ${r}`,e)}}}async restoreChat(e){if(!this.db)return;let t=e.files?.[0];if(t){if(!t.name.endsWith(`.zip`)){C(`Please select a .zip file`,3500),e.value=``;return}try{let n=(await B.default.loadAsync(t)).file(`chat-data.json`);if(!n){E(`Invalid chat file: missing chat-data.json`,6e3),e.value=``;return}let r=await n.async(`string`),i=JSON.parse(r);if(!i.messages||!Array.isArray(i.messages)){E(`Invalid chat file: missing messages array`,6e3),e.value=``;return}let a=_.activeGroupId;await ee(this.db,a,i),await _.loadHistory(),T(`Chat restored successfully`,3500)}catch(e){E(`Failed to restore chat: ${e instanceof Error?e.message:String(e)}`,6e3)}finally{e.value=``}}}async restoreInputAreaHeight(){let e=this.shadowRoot?.querySelector(`.chat__input-area`);if(e instanceof HTMLElement)try{let t=this.db?await s(this.db,i.CHAT_INPUT_AREA_HEIGHT):void 0;typeof t==`number`&&Number.isFinite(t)&&t>0&&(this.isCollapsedInputAreaHeight(t)?this.resetInputAreaHeight(e):this.setInputAreaHeight(e,t))}catch{}}async sendMessage(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.chat__input`);if(!(t instanceof HTMLTextAreaElement))return;let n=t.value.trim();if(!(!n&&this.#t.length===0)){if(!_.ready){C(`ShadowClaw is still initializing. Please try again.`,3500);return}try{let e=await this.buildMessageDraftPayload(n);if(!e)return;t.value=``,this.#r=!0,W.setNearBottom(!0),_.sendMessage(e.text,e.attachments),this.#t=[],this.renderQueuedAttachments()}catch(e){E(`Error sending message: ${e instanceof Error?e.message:String(e)}`,6e3)}}}async showAttachmentDialog(e){let t=document.querySelector(`shadow-claw`);return t&&typeof t.requestDialog==`function`?await t.requestDialog(e):(e.mode||`confirm`)===`info`?(C(e.message,4500),!0):(C(`${e.title}: ${e.message}`,5e3),!1)}};customElements.get(Ue)||customElements.define(Ue,We);export{We as ShadowClawChat};