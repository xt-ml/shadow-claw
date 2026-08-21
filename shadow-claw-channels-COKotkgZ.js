import{i as e,t}from"./rolldown-runtime-aKtaBQYM.js";import{n}from"./txPromise-EBECky1b.js";import{$ as r,F as i,Ht as a,I as o,N as s,Q as c,_t as l,ht as u,j as d,lt as f,mt as p,pt as m,t as h,ut as g}from"./orchestrator-DrMg2dnI.js";import{t as _}from"./ulid-BY7rQVLN.js";import{a as v,r as y,t as b}from"./toast-D3gxhZpN.js";import{t as x}from"./shadow-claw-element-na_3JW5e.js";import{t as S}from"./effect-BEsuusE8.js";import"./shadow-claw-page-header-action-button-Cn1xDjfA.js";import{t as C}from"./configurePeerJs-BxhLXOtN.js";import"./shadow-claw-page-header-DyG_qg9T.js";var w=t(((e,t)=>{t.exports=function(){return typeof Promise==`function`&&Promise.prototype&&Promise.prototype.then}})),T=t((e=>{let t,n=[0,26,44,70,100,134,172,196,242,292,346,404,466,532,581,655,733,815,901,991,1085,1156,1258,1364,1474,1588,1706,1828,1921,2051,2185,2323,2465,2611,2761,2876,3034,3196,3362,3532,3706];e.getSymbolSize=function(e){if(!e)throw Error(`"version" cannot be null or undefined`);if(e<1||e>40)throw Error(`"version" should be in range from 1 to 40`);return e*4+17},e.getSymbolTotalCodewords=function(e){return n[e]},e.getBCHDigit=function(e){let t=0;for(;e!==0;)t++,e>>>=1;return t},e.setToSJISFunction=function(e){if(typeof e!=`function`)throw Error(`"toSJISFunc" is not a valid function.`);t=e},e.isKanjiModeEnabled=function(){return t!==void 0},e.toSJIS=function(e){return t(e)}})),E=t((e=>{e.L={bit:1},e.M={bit:0},e.Q={bit:3},e.H={bit:2};function t(t){if(typeof t!=`string`)throw Error(`Param is not a string`);switch(t.toLowerCase()){case`l`:case`low`:return e.L;case`m`:case`medium`:return e.M;case`q`:case`quartile`:return e.Q;case`h`:case`high`:return e.H;default:throw Error(`Unknown EC Level: `+t)}}e.isValid=function(e){return e&&e.bit!==void 0&&e.bit>=0&&e.bit<4},e.from=function(n,r){if(e.isValid(n))return n;try{return t(n)}catch{return r}}})),D=t(((e,t)=>{function n(){this.buffer=[],this.length=0}n.prototype={get:function(e){let t=Math.floor(e/8);return(this.buffer[t]>>>7-e%8&1)==1},put:function(e,t){for(let n=0;n<t;n++)this.putBit((e>>>t-n-1&1)==1)},getLengthInBits:function(){return this.length},putBit:function(e){let t=Math.floor(this.length/8);this.buffer.length<=t&&this.buffer.push(0),e&&(this.buffer[t]|=128>>>this.length%8),this.length++}},t.exports=n})),ee=t(((e,t)=>{function n(e){if(!e||e<1)throw Error(`BitMatrix size must be defined and greater than 0`);this.size=e,this.data=new Uint8Array(e*e),this.reservedBit=new Uint8Array(e*e)}n.prototype.set=function(e,t,n,r){let i=e*this.size+t;this.data[i]=n,r&&(this.reservedBit[i]=!0)},n.prototype.get=function(e,t){return this.data[e*this.size+t]},n.prototype.xor=function(e,t,n){this.data[e*this.size+t]^=n},n.prototype.isReserved=function(e,t){return this.reservedBit[e*this.size+t]},t.exports=n})),te=t((e=>{let t=T().getSymbolSize;e.getRowColCoords=function(e){if(e===1)return[];let n=Math.floor(e/7)+2,r=t(e),i=r===145?26:Math.ceil((r-13)/(2*n-2))*2,a=[r-7];for(let e=1;e<n-1;e++)a[e]=a[e-1]-i;return a.push(6),a.reverse()},e.getPositions=function(t){let n=[],r=e.getRowColCoords(t),i=r.length;for(let e=0;e<i;e++)for(let t=0;t<i;t++)e===0&&t===0||e===0&&t===i-1||e===i-1&&t===0||n.push([r[e],r[t]]);return n}})),ne=t((e=>{let t=T().getSymbolSize;e.getPositions=function(e){let n=t(e);return[[0,0],[n-7,0],[0,n-7]]}})),O=t((e=>{e.Patterns={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7};let t={N1:3,N2:3,N3:40,N4:10};e.isValid=function(e){return e!=null&&e!==``&&!isNaN(e)&&e>=0&&e<=7},e.from=function(t){return e.isValid(t)?parseInt(t,10):void 0},e.getPenaltyN1=function(e){let n=e.size,r=0,i=0,a=0,o=null,s=null;for(let c=0;c<n;c++){i=a=0,o=s=null;for(let l=0;l<n;l++){let n=e.get(c,l);n===o?i++:(i>=5&&(r+=t.N1+(i-5)),o=n,i=1),n=e.get(l,c),n===s?a++:(a>=5&&(r+=t.N1+(a-5)),s=n,a=1)}i>=5&&(r+=t.N1+(i-5)),a>=5&&(r+=t.N1+(a-5))}return r},e.getPenaltyN2=function(e){let n=e.size,r=0;for(let t=0;t<n-1;t++)for(let i=0;i<n-1;i++){let n=e.get(t,i)+e.get(t,i+1)+e.get(t+1,i)+e.get(t+1,i+1);(n===4||n===0)&&r++}return r*t.N2},e.getPenaltyN3=function(e){let n=e.size,r=0,i=0,a=0;for(let t=0;t<n;t++){i=a=0;for(let o=0;o<n;o++)i=i<<1&2047|e.get(t,o),o>=10&&(i===1488||i===93)&&r++,a=a<<1&2047|e.get(o,t),o>=10&&(a===1488||a===93)&&r++}return r*t.N3},e.getPenaltyN4=function(e){let n=0,r=e.data.length;for(let t=0;t<r;t++)n+=e.data[t];return Math.abs(Math.ceil(n*100/r/5)-10)*t.N4};function n(t,n,r){switch(t){case e.Patterns.PATTERN000:return(n+r)%2==0;case e.Patterns.PATTERN001:return n%2==0;case e.Patterns.PATTERN010:return r%3==0;case e.Patterns.PATTERN011:return(n+r)%3==0;case e.Patterns.PATTERN100:return(Math.floor(n/2)+Math.floor(r/3))%2==0;case e.Patterns.PATTERN101:return n*r%2+n*r%3==0;case e.Patterns.PATTERN110:return(n*r%2+n*r%3)%2==0;case e.Patterns.PATTERN111:return(n*r%3+(n+r)%2)%2==0;default:throw Error(`bad maskPattern:`+t)}}e.applyMask=function(e,t){let r=t.size;for(let i=0;i<r;i++)for(let a=0;a<r;a++)t.isReserved(a,i)||t.xor(a,i,n(e,a,i))},e.getBestMask=function(t,n){let r=Object.keys(e.Patterns).length,i=0,a=1/0;for(let o=0;o<r;o++){n(o),e.applyMask(o,t);let r=e.getPenaltyN1(t)+e.getPenaltyN2(t)+e.getPenaltyN3(t)+e.getPenaltyN4(t);e.applyMask(o,t),r<a&&(a=r,i=o)}return i}})),k=t((e=>{let t=E(),n=[1,1,1,1,1,1,1,1,1,1,2,2,1,2,2,4,1,2,4,4,2,4,4,4,2,4,6,5,2,4,6,6,2,5,8,8,4,5,8,8,4,5,8,11,4,8,10,11,4,9,12,16,4,9,16,16,6,10,12,18,6,10,17,16,6,11,16,19,6,13,18,21,7,14,21,25,8,16,20,25,8,17,23,25,9,17,23,34,9,18,25,30,10,20,27,32,12,21,29,35,12,23,34,37,12,25,34,40,13,26,35,42,14,28,38,45,15,29,40,48,16,31,43,51,17,33,45,54,18,35,48,57,19,37,51,60,19,38,53,63,20,40,56,66,21,43,59,70,22,45,62,74,24,47,65,77,25,49,68,81],r=[7,10,13,17,10,16,22,28,15,26,36,44,20,36,52,64,26,48,72,88,36,64,96,112,40,72,108,130,48,88,132,156,60,110,160,192,72,130,192,224,80,150,224,264,96,176,260,308,104,198,288,352,120,216,320,384,132,240,360,432,144,280,408,480,168,308,448,532,180,338,504,588,196,364,546,650,224,416,600,700,224,442,644,750,252,476,690,816,270,504,750,900,300,560,810,960,312,588,870,1050,336,644,952,1110,360,700,1020,1200,390,728,1050,1260,420,784,1140,1350,450,812,1200,1440,480,868,1290,1530,510,924,1350,1620,540,980,1440,1710,570,1036,1530,1800,570,1064,1590,1890,600,1120,1680,1980,630,1204,1770,2100,660,1260,1860,2220,720,1316,1950,2310,750,1372,2040,2430];e.getBlocksCount=function(e,r){switch(r){case t.L:return n[(e-1)*4+0];case t.M:return n[(e-1)*4+1];case t.Q:return n[(e-1)*4+2];case t.H:return n[(e-1)*4+3];default:return}},e.getTotalCodewordsCount=function(e,n){switch(n){case t.L:return r[(e-1)*4+0];case t.M:return r[(e-1)*4+1];case t.Q:return r[(e-1)*4+2];case t.H:return r[(e-1)*4+3];default:return}}})),re=t((e=>{let t=new Uint8Array(512),n=new Uint8Array(256);(function(){let e=1;for(let r=0;r<255;r++)t[r]=e,n[e]=r,e<<=1,e&256&&(e^=285);for(let e=255;e<512;e++)t[e]=t[e-255]})(),e.log=function(e){if(e<1)throw Error(`log(`+e+`)`);return n[e]},e.exp=function(e){return t[e]},e.mul=function(e,r){return e===0||r===0?0:t[n[e]+n[r]]}})),A=t((e=>{let t=re();e.mul=function(e,n){let r=new Uint8Array(e.length+n.length-1);for(let i=0;i<e.length;i++)for(let a=0;a<n.length;a++)r[i+a]^=t.mul(e[i],n[a]);return r},e.mod=function(e,n){let r=new Uint8Array(e);for(;r.length-n.length>=0;){let e=r[0];for(let i=0;i<n.length;i++)r[i]^=t.mul(n[i],e);let i=0;for(;i<r.length&&r[i]===0;)i++;r=r.slice(i)}return r},e.generateECPolynomial=function(n){let r=new Uint8Array([1]);for(let i=0;i<n;i++)r=e.mul(r,new Uint8Array([1,t.exp(i)]));return r}})),ie=t(((e,t)=>{let n=A();function r(e){this.genPoly=void 0,this.degree=e,this.degree&&this.initialize(this.degree)}r.prototype.initialize=function(e){this.degree=e,this.genPoly=n.generateECPolynomial(this.degree)},r.prototype.encode=function(e){if(!this.genPoly)throw Error(`Encoder not initialized`);let t=new Uint8Array(e.length+this.degree);t.set(e);let r=n.mod(t,this.genPoly),i=this.degree-r.length;if(i>0){let e=new Uint8Array(this.degree);return e.set(r,i),e}return r},t.exports=r})),j=t((e=>{e.isValid=function(e){return!isNaN(e)&&e>=1&&e<=40}})),M=t((e=>{let t=`(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+`;t=t.replace(/u/g,`\\u`);let n=`(?:(?![A-Z0-9 $%*+\\-./:]|`+t+`)(?:.|[\r
]))+`;e.KANJI=new RegExp(t,`g`),e.BYTE_KANJI=RegExp(`[^A-Z0-9 $%*+\\-./:]+`,`g`),e.BYTE=new RegExp(n,`g`),e.NUMERIC=RegExp(`[0-9]+`,`g`),e.ALPHANUMERIC=RegExp(`[A-Z $%*+\\-./:]+`,`g`);let r=RegExp(`^`+t+`$`),i=RegExp(`^[0-9]+$`),a=RegExp(`^[A-Z0-9 $%*+\\-./:]+$`);e.testKanji=function(e){return r.test(e)},e.testNumeric=function(e){return i.test(e)},e.testAlphanumeric=function(e){return a.test(e)}})),N=t((e=>{let t=j(),n=M();e.NUMERIC={id:`Numeric`,bit:1,ccBits:[10,12,14]},e.ALPHANUMERIC={id:`Alphanumeric`,bit:2,ccBits:[9,11,13]},e.BYTE={id:`Byte`,bit:4,ccBits:[8,16,16]},e.KANJI={id:`Kanji`,bit:8,ccBits:[8,10,12]},e.MIXED={bit:-1},e.getCharCountIndicator=function(e,n){if(!e.ccBits)throw Error(`Invalid mode: `+e);if(!t.isValid(n))throw Error(`Invalid version: `+n);return n>=1&&n<10?e.ccBits[0]:n<27?e.ccBits[1]:e.ccBits[2]},e.getBestModeForData=function(t){return n.testNumeric(t)?e.NUMERIC:n.testAlphanumeric(t)?e.ALPHANUMERIC:n.testKanji(t)?e.KANJI:e.BYTE},e.toString=function(e){if(e&&e.id)return e.id;throw Error(`Invalid mode`)},e.isValid=function(e){return e&&e.bit&&e.ccBits};function r(t){if(typeof t!=`string`)throw Error(`Param is not a string`);switch(t.toLowerCase()){case`numeric`:return e.NUMERIC;case`alphanumeric`:return e.ALPHANUMERIC;case`kanji`:return e.KANJI;case`byte`:return e.BYTE;default:throw Error(`Unknown mode: `+t)}}e.from=function(t,n){if(e.isValid(t))return t;try{return r(t)}catch{return n}}})),ae=t((e=>{let t=T(),n=k(),r=E(),i=N(),a=j(),o=7973,s=t.getBCHDigit(o);function c(t,n,r){for(let i=1;i<=40;i++)if(n<=e.getCapacity(i,r,t))return i}function l(e,t){return i.getCharCountIndicator(e,t)+4}function u(e,t){let n=0;return e.forEach(function(e){let r=l(e.mode,t);n+=r+e.getBitsLength()}),n}function d(t,n){for(let r=1;r<=40;r++)if(u(t,r)<=e.getCapacity(r,n,i.MIXED))return r}e.from=function(e,t){return a.isValid(e)?parseInt(e,10):t},e.getCapacity=function(e,r,o){if(!a.isValid(e))throw Error(`Invalid QR Code version`);o===void 0&&(o=i.BYTE);let s=(t.getSymbolTotalCodewords(e)-n.getTotalCodewordsCount(e,r))*8;if(o===i.MIXED)return s;let c=s-l(o,e);switch(o){case i.NUMERIC:return Math.floor(c/10*3);case i.ALPHANUMERIC:return Math.floor(c/11*2);case i.KANJI:return Math.floor(c/13);case i.BYTE:default:return Math.floor(c/8)}},e.getBestVersionForData=function(e,t){let n,i=r.from(t,r.M);if(Array.isArray(e)){if(e.length>1)return d(e,i);if(e.length===0)return 1;n=e[0]}else n=e;return c(n.mode,n.getLength(),i)},e.getEncodedBits=function(e){if(!a.isValid(e)||e<7)throw Error(`Invalid QR Code version`);let n=e<<12;for(;t.getBCHDigit(n)-s>=0;)n^=o<<t.getBCHDigit(n)-s;return e<<12|n}})),oe=t((e=>{let t=T(),n=1335,r=t.getBCHDigit(n);e.getEncodedBits=function(e,i){let a=e.bit<<3|i,o=a<<10;for(;t.getBCHDigit(o)-r>=0;)o^=n<<t.getBCHDigit(o)-r;return(a<<10|o)^21522}})),se=t(((e,t)=>{let n=N();function r(e){this.mode=n.NUMERIC,this.data=e.toString()}r.getBitsLength=function(e){return 10*Math.floor(e/3)+(e%3?e%3*3+1:0)},r.prototype.getLength=function(){return this.data.length},r.prototype.getBitsLength=function(){return r.getBitsLength(this.data.length)},r.prototype.write=function(e){let t,n,r;for(t=0;t+3<=this.data.length;t+=3)n=this.data.substr(t,3),r=parseInt(n,10),e.put(r,10);let i=this.data.length-t;i>0&&(n=this.data.substr(t),r=parseInt(n,10),e.put(r,i*3+1))},t.exports=r})),ce=t(((e,t)=>{let n=N(),r=`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:`.split(``);function i(e){this.mode=n.ALPHANUMERIC,this.data=e}i.getBitsLength=function(e){return 11*Math.floor(e/2)+e%2*6},i.prototype.getLength=function(){return this.data.length},i.prototype.getBitsLength=function(){return i.getBitsLength(this.data.length)},i.prototype.write=function(e){let t;for(t=0;t+2<=this.data.length;t+=2){let n=r.indexOf(this.data[t])*45;n+=r.indexOf(this.data[t+1]),e.put(n,11)}this.data.length%2&&e.put(r.indexOf(this.data[t]),6)},t.exports=i})),le=t(((e,t)=>{let n=N();function r(e){this.mode=n.BYTE,typeof e==`string`?this.data=new TextEncoder().encode(e):this.data=new Uint8Array(e)}r.getBitsLength=function(e){return e*8},r.prototype.getLength=function(){return this.data.length},r.prototype.getBitsLength=function(){return r.getBitsLength(this.data.length)},r.prototype.write=function(e){for(let t=0,n=this.data.length;t<n;t++)e.put(this.data[t],8)},t.exports=r})),ue=t(((e,t)=>{let n=N(),r=T();function i(e){this.mode=n.KANJI,this.data=e}i.getBitsLength=function(e){return e*13},i.prototype.getLength=function(){return this.data.length},i.prototype.getBitsLength=function(){return i.getBitsLength(this.data.length)},i.prototype.write=function(e){let t;for(t=0;t<this.data.length;t++){let n=r.toSJIS(this.data[t]);if(n>=33088&&n<=40956)n-=33088;else if(n>=57408&&n<=60351)n-=49472;else throw Error(`Invalid SJIS character: `+this.data[t]+`
Make sure your charset is UTF-8`);n=(n>>>8&255)*192+(n&255),e.put(n,13)}},t.exports=i})),de=t(((e,t)=>{var n={single_source_shortest_paths:function(e,t,r){var i={},a={};a[t]=0;var o=n.PriorityQueue.make();o.push(t,0);for(var s,c,l,u,d,f,p,m,h;!o.empty();)for(l in s=o.pop(),c=s.value,u=s.cost,d=e[c]||{},d)d.hasOwnProperty(l)&&(f=d[l],p=u+f,m=a[l],h=a[l]===void 0,(h||m>p)&&(a[l]=p,o.push(l,p),i[l]=c));if(r!==void 0&&a[r]===void 0){var g=[`Could not find a path from `,t,` to `,r,`.`].join(``);throw Error(g)}return i},extract_shortest_path_from_predecessor_list:function(e,t){for(var n=[],r=t;r;)n.push(r),e[r],r=e[r];return n.reverse(),n},find_path:function(e,t,r){var i=n.single_source_shortest_paths(e,t,r);return n.extract_shortest_path_from_predecessor_list(i,r)},PriorityQueue:{make:function(e){var t=n.PriorityQueue,r={},i;for(i in e||={},t)t.hasOwnProperty(i)&&(r[i]=t[i]);return r.queue=[],r.sorter=e.sorter||t.default_sorter,r},default_sorter:function(e,t){return e.cost-t.cost},push:function(e,t){var n={value:e,cost:t};this.queue.push(n),this.queue.sort(this.sorter)},pop:function(){return this.queue.shift()},empty:function(){return this.queue.length===0}}};t!==void 0&&(t.exports=n)})),fe=t((e=>{let t=N(),n=se(),r=ce(),i=le(),a=ue(),o=M(),s=T(),c=de();function l(e){return unescape(encodeURIComponent(e)).length}function u(e,t,n){let r=[],i;for(;(i=e.exec(n))!==null;)r.push({data:i[0],index:i.index,mode:t,length:i[0].length});return r}function d(e){let n=u(o.NUMERIC,t.NUMERIC,e),r=u(o.ALPHANUMERIC,t.ALPHANUMERIC,e),i,a;return s.isKanjiModeEnabled()?(i=u(o.BYTE,t.BYTE,e),a=u(o.KANJI,t.KANJI,e)):(i=u(o.BYTE_KANJI,t.BYTE,e),a=[]),n.concat(r,i,a).sort(function(e,t){return e.index-t.index}).map(function(e){return{data:e.data,mode:e.mode,length:e.length}})}function f(e,o){switch(o){case t.NUMERIC:return n.getBitsLength(e);case t.ALPHANUMERIC:return r.getBitsLength(e);case t.KANJI:return a.getBitsLength(e);case t.BYTE:return i.getBitsLength(e)}}function p(e){return e.reduce(function(e,t){let n=e.length-1>=0?e[e.length-1]:null;return n&&n.mode===t.mode?(e[e.length-1].data+=t.data,e):(e.push(t),e)},[])}function m(e){let n=[];for(let r=0;r<e.length;r++){let i=e[r];switch(i.mode){case t.NUMERIC:n.push([i,{data:i.data,mode:t.ALPHANUMERIC,length:i.length},{data:i.data,mode:t.BYTE,length:i.length}]);break;case t.ALPHANUMERIC:n.push([i,{data:i.data,mode:t.BYTE,length:i.length}]);break;case t.KANJI:n.push([i,{data:i.data,mode:t.BYTE,length:l(i.data)}]);break;case t.BYTE:n.push([{data:i.data,mode:t.BYTE,length:l(i.data)}])}}return n}function h(e,n){let r={},i={start:{}},a=[`start`];for(let o=0;o<e.length;o++){let s=e[o],c=[];for(let e=0;e<s.length;e++){let l=s[e],u=``+o+e;c.push(u),r[u]={node:l,lastCount:0},i[u]={};for(let e=0;e<a.length;e++){let o=a[e];r[o]&&r[o].node.mode===l.mode?(i[o][u]=f(r[o].lastCount+l.length,l.mode)-f(r[o].lastCount,l.mode),r[o].lastCount+=l.length):(r[o]&&(r[o].lastCount=l.length),i[o][u]=f(l.length,l.mode)+4+t.getCharCountIndicator(l.mode,n))}}a=c}for(let e=0;e<a.length;e++)i[a[e]].end=0;return{map:i,table:r}}function g(e,o){let c,l=t.getBestModeForData(e);if(c=t.from(o,l),c!==t.BYTE&&c.bit<l.bit)throw Error(`"`+e+`" cannot be encoded with mode `+t.toString(c)+`.
 Suggested mode is: `+t.toString(l));switch(c===t.KANJI&&!s.isKanjiModeEnabled()&&(c=t.BYTE),c){case t.NUMERIC:return new n(e);case t.ALPHANUMERIC:return new r(e);case t.KANJI:return new a(e);case t.BYTE:return new i(e)}}e.fromArray=function(e){return e.reduce(function(e,t){return typeof t==`string`?e.push(g(t,null)):t.data&&e.push(g(t.data,t.mode)),e},[])},e.fromString=function(t,n){let r=h(m(d(t,s.isKanjiModeEnabled())),n),i=c.find_path(r.map,`start`,`end`),a=[];for(let e=1;e<i.length-1;e++)a.push(r.table[i[e]].node);return e.fromArray(p(a))},e.rawSplit=function(t){return e.fromArray(d(t,s.isKanjiModeEnabled()))}})),pe=t((e=>{let t=T(),n=E(),r=D(),i=ee(),a=te(),o=ne(),s=O(),c=k(),l=ie(),u=ae(),d=oe(),f=N(),p=fe();function m(e,t){let n=e.size,r=o.getPositions(t);for(let t=0;t<r.length;t++){let i=r[t][0],a=r[t][1];for(let t=-1;t<=7;t++)if(!(i+t<=-1||n<=i+t))for(let r=-1;r<=7;r++)a+r<=-1||n<=a+r||(t>=0&&t<=6&&(r===0||r===6)||r>=0&&r<=6&&(t===0||t===6)||t>=2&&t<=4&&r>=2&&r<=4?e.set(i+t,a+r,!0,!0):e.set(i+t,a+r,!1,!0))}}function h(e){let t=e.size;for(let n=8;n<t-8;n++){let t=n%2==0;e.set(n,6,t,!0),e.set(6,n,t,!0)}}function g(e,t){let n=a.getPositions(t);for(let t=0;t<n.length;t++){let r=n[t][0],i=n[t][1];for(let t=-2;t<=2;t++)for(let n=-2;n<=2;n++)t===-2||t===2||n===-2||n===2||t===0&&n===0?e.set(r+t,i+n,!0,!0):e.set(r+t,i+n,!1,!0)}}function _(e,t){let n=e.size,r=u.getEncodedBits(t),i,a,o;for(let t=0;t<18;t++)i=Math.floor(t/3),a=t%3+n-8-3,o=(r>>t&1)==1,e.set(i,a,o,!0),e.set(a,i,o,!0)}function v(e,t,n){let r=e.size,i=d.getEncodedBits(t,n),a,o;for(a=0;a<15;a++)o=(i>>a&1)==1,a<6?e.set(a,8,o,!0):a<8?e.set(a+1,8,o,!0):e.set(r-15+a,8,o,!0),a<8?e.set(8,r-a-1,o,!0):a<9?e.set(8,15-a-1+1,o,!0):e.set(8,15-a-1,o,!0);e.set(r-8,8,1,!0)}function y(e,t){let n=e.size,r=-1,i=n-1,a=7,o=0;for(let s=n-1;s>0;s-=2)for(s===6&&s--;;){for(let n=0;n<2;n++)if(!e.isReserved(i,s-n)){let r=!1;o<t.length&&(r=(t[o]>>>a&1)==1),e.set(i,s-n,r),a--,a===-1&&(o++,a=7)}if(i+=r,i<0||n<=i){i-=r,r=-r;break}}}function b(e,n,i){let a=new r;i.forEach(function(t){a.put(t.mode.bit,4),a.put(t.getLength(),f.getCharCountIndicator(t.mode,e)),t.write(a)});let o=(t.getSymbolTotalCodewords(e)-c.getTotalCodewordsCount(e,n))*8;for(a.getLengthInBits()+4<=o&&a.put(0,4);a.getLengthInBits()%8!=0;)a.putBit(0);let s=(o-a.getLengthInBits())/8;for(let e=0;e<s;e++)a.put(e%2?17:236,8);return x(a,e,n)}function x(e,n,r){let i=t.getSymbolTotalCodewords(n),a=i-c.getTotalCodewordsCount(n,r),o=c.getBlocksCount(n,r),s=o-i%o,u=Math.floor(i/o),d=Math.floor(a/o),f=d+1,p=u-d,m=new l(p),h=0,g=Array(o),_=Array(o),v=0,y=new Uint8Array(e.buffer);for(let e=0;e<o;e++){let t=e<s?d:f;g[e]=y.slice(h,h+t),_[e]=m.encode(g[e]),h+=t,v=Math.max(v,t)}let b=new Uint8Array(i),x=0,S,C;for(S=0;S<v;S++)for(C=0;C<o;C++)S<g[C].length&&(b[x++]=g[C][S]);for(S=0;S<p;S++)for(C=0;C<o;C++)b[x++]=_[C][S];return b}function S(e,n,r,a){let o;if(Array.isArray(e))o=p.fromArray(e);else if(typeof e==`string`){let t=n;if(!t){let n=p.rawSplit(e);t=u.getBestVersionForData(n,r)}o=p.fromString(e,t||40)}else throw Error(`Invalid data`);let c=u.getBestVersionForData(o,r);if(!c)throw Error(`The amount of data is too big to be stored in a QR Code`);if(!n)n=c;else if(n<c)throw Error(`
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: `+c+`.
`);let l=b(n,r,o),d=t.getSymbolSize(n),f=new i(d);return m(f,n),h(f),g(f,n),v(f,r,0),n>=7&&_(f,n),y(f,l),isNaN(a)&&(a=s.getBestMask(f,v.bind(null,f,r))),s.applyMask(a,f),v(f,r,a),{modules:f,version:n,errorCorrectionLevel:r,maskPattern:a,segments:o}}e.create=function(e,r){if(e===void 0||e===``)throw Error(`No input text`);let i=n.M,a,o;return r!==void 0&&(i=n.from(r.errorCorrectionLevel,n.M),a=u.from(r.version),o=s.from(r.maskPattern),r.toSJISFunc&&t.setToSJISFunction(r.toSJISFunc)),S(e,a,i,o)}})),P=t((e=>{function t(e){if(typeof e==`number`&&(e=e.toString()),typeof e!=`string`)throw Error(`Color should be defined as hex string`);let t=e.slice().replace(`#`,``).split(``);if(t.length<3||t.length===5||t.length>8)throw Error(`Invalid hex color: `+e);(t.length===3||t.length===4)&&(t=Array.prototype.concat.apply([],t.map(function(e){return[e,e]}))),t.length===6&&t.push(`F`,`F`);let n=parseInt(t.join(``),16);return{r:n>>24&255,g:n>>16&255,b:n>>8&255,a:n&255,hex:`#`+t.slice(0,6).join(``)}}e.getOptions=function(e){e||={},e.color||={};let n=e.margin===void 0||e.margin===null||e.margin<0?4:e.margin,r=e.width&&e.width>=21?e.width:void 0,i=e.scale||4;return{width:r,scale:r?4:i,margin:n,color:{dark:t(e.color.dark||`#000000ff`),light:t(e.color.light||`#ffffffff`)},type:e.type,rendererOpts:e.rendererOpts||{}}},e.getScale=function(e,t){return t.width&&t.width>=e+t.margin*2?t.width/(e+t.margin*2):t.scale},e.getImageWidth=function(t,n){let r=e.getScale(t,n);return Math.floor((t+n.margin*2)*r)},e.qrToImageData=function(t,n,r){let i=n.modules.size,a=n.modules.data,o=e.getScale(i,r),s=Math.floor((i+r.margin*2)*o),c=r.margin*o,l=[r.color.light,r.color.dark];for(let e=0;e<s;e++)for(let n=0;n<s;n++){let u=(e*s+n)*4,d=r.color.light;if(e>=c&&n>=c&&e<s-c&&n<s-c){let t=Math.floor((e-c)/o),r=Math.floor((n-c)/o);d=l[+!!a[t*i+r]]}t[u++]=d.r,t[u++]=d.g,t[u++]=d.b,t[u]=d.a}}})),me=t((e=>{let t=P();function n(e,t,n){e.clearRect(0,0,t.width,t.height),t.style||={},t.height=n,t.width=n,t.style.height=n+`px`,t.style.width=n+`px`}function r(){try{return document.createElement(`canvas`)}catch{throw Error(`You need to specify a canvas element`)}}e.render=function(e,i,a){let o=a,s=i;o===void 0&&(!i||!i.getContext)&&(o=i,i=void 0),i||(s=r()),o=t.getOptions(o);let c=t.getImageWidth(e.modules.size,o),l=s.getContext(`2d`),u=l.createImageData(c,c);return t.qrToImageData(u.data,e,o),n(l,s,c),l.putImageData(u,0,0),s},e.renderToDataURL=function(t,n,r){let i=r;i===void 0&&(!n||!n.getContext)&&(i=n,n=void 0),i||={};let a=e.render(t,n,i),o=i.type||`image/png`,s=i.rendererOpts||{};return a.toDataURL(o,s.quality)}})),F=t((e=>{let t=P();function n(e,t){let n=e.a/255,r=t+`="`+e.hex+`"`;return n<1?r+` `+t+`-opacity="`+n.toFixed(2).slice(1)+`"`:r}function r(e,t,n){let r=e+t;return n!==void 0&&(r+=` `+n),r}function i(e,t,n){let i=``,a=0,o=!1,s=0;for(let c=0;c<e.length;c++){let l=Math.floor(c%t),u=Math.floor(c/t);!l&&!o&&(o=!0),e[c]?(s++,c>0&&l>0&&e[c-1]||(i+=o?r(`M`,l+n,.5+u+n):r(`m`,a,0),a=0,o=!1),l+1<t&&e[c+1]||(i+=r(`h`,s),s=0)):a++}return i}e.render=function(e,r,a){let o=t.getOptions(r),s=e.modules.size,c=e.modules.data,l=s+o.margin*2,u=o.color.light.a?`<path `+n(o.color.light,`fill`)+` d="M0 0h`+l+`v`+l+`H0z"/>`:``,d=`<path `+n(o.color.dark,`stroke`)+` d="`+i(c,s,o.margin)+`"/>`,f=`viewBox="0 0 `+l+` `+l+`"`,p=`<svg xmlns="http://www.w3.org/2000/svg" `+(o.width?`width="`+o.width+`" height="`+o.width+`" `:``)+f+` shape-rendering="crispEdges">`+u+d+`</svg>
`;return typeof a==`function`&&a(null,p),p}})),I=e(t((e=>{let t=w(),n=pe(),r=me(),i=F();function a(e,r,i,a,o){let s=[].slice.call(arguments,1),c=s.length,l=typeof s[c-1]==`function`;if(!l&&!t())throw Error(`Callback required as last argument`);if(l){if(c<2)throw Error(`Too few arguments provided`);c===2?(o=i,i=r,r=a=void 0):c===3&&(r.getContext&&o===void 0?(o=a,a=void 0):(o=a,a=i,i=r,r=void 0))}else{if(c<1)throw Error(`Too few arguments provided`);return c===1?(i=r,r=a=void 0):c===2&&!r.getContext&&(a=i,i=r,r=void 0),new Promise(function(t,o){try{t(e(n.create(i,a),r,a))}catch(e){o(e)}})}try{let t=n.create(i,a);o(null,e(t,r,a))}catch(e){o(e)}}e.create=n.create,e.toCanvas=a.bind(null,r.render),e.toDataURL=a.bind(null,r.renderToDataURL),e.toString=a.bind(null,function(e,t,n){return i.render(e,n)})}))(),1);const L=new CSSStyleSheet;L.replaceSync(`.peerjs-id-row {
  align-items: center;
  display: flex;
  gap: 0.375rem;
}

.peerjs-id-row .form-input {
  flex: 1;
  font-family: var(--font-mono, monospace);
  font-size: 0.8rem;
  min-width: 0;
}

.peerjs-icon-btn {
  background: var(--surface-2, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  color: var(--text-primary, #e0e0e0);
  cursor: pointer;
  flex-shrink: 0;
  font-size: 1rem;
  line-height: 1;
  padding: 0.4rem 0.5rem;
  transition:
    background 0.15s ease,
    transform 0.1s ease;
}

.peerjs-icon-btn:hover {
  background: var(--surface-3, #333);
  transform: scale(1.05);
}

.peerjs-icon-btn:active {
  transform: scale(0.95);
}

.peerjs-qr-group {
  align-items: flex-start;
}

.peerjs-qr-wrapper {
  background: #fff;
  border-radius: 8px;
  display: inline-block;
  margin: 0.5rem 0;
  padding: 0.5rem;
}

.peerjs-qr-canvas {
  display: block;
  height: 180px !important;
  width: 180px !important;
}

.peerjs-advanced {
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  margin-bottom: 1rem;
  overflow: hidden;
}

.peerjs-advanced > summary {
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  list-style: none;
  padding: 0.6rem 0.875rem;
  user-select: none;
}

.peerjs-advanced > summary::-webkit-details-marker {
  display: none;
}

.peerjs-advanced > summary::before {
  content: "▶ ";
  font-size: 0.6rem;
  vertical-align: middle;
}

.peerjs-advanced[open] > summary::before {
  content: "▼ ";
}

.peerjs-advanced-content {
  border-top: 1px solid var(--border-color, #444);
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.75rem 0.875rem;
}

.peerjs-row {
  display: flex;
  gap: 1rem;
}

.peerjs-row .form-group {
  flex: 1;
  min-width: 0;
}

.peerjs-connection-status {
  margin-top: 0.25rem;
}

.peerjs-trusted-peers-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  color: var(--shadow-claw-text-primary);
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
}

.form-input,
.form-select {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.625rem);
  box-sizing: border-box;
  color: var(--shadow-claw-text-primary);
  font-family: var(--shadow-claw-font-sans);
  font-size: var(--shadow-claw-font-size-sm);
  padding: 0.625rem 0.75rem;
  transition: border-color 0.15s;
  width: 100%;
}

.form-input:focus,
.form-select:focus {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 0.125rem rgba(0, 0, 0, 0.06);
  outline: none;
}

.form-toggle {
  align-items: center;
  display: flex;
  gap: 0.75rem;
}

.form-toggle input[type="checkbox"] {
  accent-color: var(--shadow-claw-accent-primary);
  cursor: pointer;
  height: 1.125rem;
  width: 1.125rem;
}

.form-toggle .form-label {
  cursor: pointer;
  display: inline;
  margin-bottom: 0;
}

.form-helper {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.form-status {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
  margin-top: 0.4rem;
}

.save-btn {
  background-color: var(--shadow-claw-text-primary);
  border: none;
  border-radius: 62.5rem;
  color: var(--shadow-claw-bg-primary);
  cursor: pointer;
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  padding: 0.625rem 1.5rem;
  transition: background-color 150ms cubic-bezier(0.33, 1, 0.68, 1);
}

.save-btn:hover {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.save-btn--inline {
  margin-top: 0.625rem;
}

.save-btn--secondary {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  color: var(--shadow-claw-text-secondary);
  margin-left: 0.5rem;
}

.save-btn--secondary:hover {
  background-color: var(--shadow-claw-bg-tertiary);
  border-color: var(--shadow-claw-text-primary);
  color: var(--shadow-claw-text-primary);
}

.save-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.peerjs-rooms-section {
  margin-top: 1.5rem;
}

.peerjs-rooms-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.peerjs-room-card {
  background: var(--surface-2, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  padding: 0.75rem;
}

.peerjs-room-header {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.peerjs-room-badge {
  background: var(--accent, #3b82f6);
  border-radius: 4px;
  color: #fff;
  font-size: 0.65rem;
  padding: 0.1rem 0.35rem;
  text-transform: uppercase;
}

.peerjs-room-roster {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}

.peerjs-room-member {
  background: var(--surface-3, #333);
  border-radius: 12px;
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  white-space: nowrap;
}

.peerjs-room-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.peerjs-room-invite-select {
  flex: 1;
  font-size: 0.75rem;
  margin-bottom: 0;
  min-width: 120px;
  padding: 0.3rem 0.4rem;
}
`);const R=new DOMParser().parseFromString(`<template>
  <div class="peerjs-section">
    <h3>📡 PeerJS Channel</h3>

    <div class="form-group">
      <label class="checkbox-row">
        <input data-setting="peerjs-enabled-toggle" type="checkbox" />
        Enable PeerJS channel
      </label>
      <div class="form-status" data-info="peerjs-channel-status">
        PeerJS channel is enabled.
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">My Peer ID</label>
      <div class="peerjs-id-row">
        <input
          class="form-input"
          data-setting="peerjs-my-peer-id-input"
          placeholder="Auto-generated on first save"
          type="text"
          autocomplete="off"
          spellcheck="false"
        />
        <button
          class="peerjs-icon-btn"
          data-action="generate-peer-id"
          title="Generate a new random Peer ID"
          aria-label="Generate random Peer ID"
        >
          🎲
        </button>
        <button
          class="peerjs-icon-btn"
          data-action="copy-peer-id"
          title="Copy Peer ID to clipboard"
          aria-label="Copy Peer ID"
        >
          📋
        </button>
      </div>
      <div class="form-helper">
        This is your local Peer ID. Share it with another ShadowClaw instance to
        connect. Leave blank to auto-generate one when you save.
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">My Alias</label>
      <input
        class="form-input"
        data-setting="peerjs-my-alias-input"
        placeholder="e.g. alias"
        type="text"
        autocomplete="off"
        spellcheck="false"
      />
      <div class="form-helper">
        Optional. A friendly name peers can use to @-mention you (e.g.
        <code>@alias</code>). Your agent will respond to both this alias and
        your raw Peer ID.
      </div>
    </div>

    <div class="form-group peerjs-qr-group" data-info="peerjs-qr-group" hidden>
      <label class="form-label">QR Code — Share to Connect</label>
      <div class="peerjs-qr-wrapper">
        <canvas data-info="peerjs-qr-canvas" class="peerjs-qr-canvas"></canvas>
      </div>
      <div class="form-helper" data-info="peerjs-qr-url"></div>
      <button
        class="save-btn save-btn--inline save-btn--secondary"
        data-action="copy-peer-url"
      >
        🔗 Copy Connection URL
      </button>
    </div>

    <div class="form-group">
      <label class="form-label">Trusted Peer IDs & Aliases</label>
      <div class="form-helper">
        Optional. Peer IDs allowed to send you messages. Leave blank to accept
        connections from any peer. You can also assign friendly aliases (like
        "alice") to Peer IDs.
      </div>

      <div
        class="peerjs-trusted-peers-list"
        data-info="peerjs-trusted-peers-list"
      ></div>

      <div class="peerjs-row" style="align-items: flex-start">
        <div class="form-group" style="margin-bottom: 0">
          <input
            class="form-input"
            data-setting="peerjs-new-trusted-id-input"
            placeholder="Peer ID (e.g. 01j...)"
            type="text"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <div class="form-group" style="margin-bottom: 0">
          <input
            class="form-input"
            data-setting="peerjs-new-trusted-alias-input"
            placeholder="Alias (e.g. alice)"
            type="text"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <button
          type="button"
          class="save-btn save-btn--secondary"
          data-action="add-trusted-peer"
          style="white-space: nowrap; height: 38px"
        >
          Add
        </button>
      </div>

      <div class="form-status" data-info="peerjs-trusted-ids-status">
        Accepting connections from any peer.
      </div>
    </div>

    <details class="peerjs-advanced">
      <summary>⚙️ Custom Signaling Server (optional)</summary>
      <div class="peerjs-advanced-content">
        <div class="form-helper">
          By default ShadowClaw uses the public PeerJS cloud server
          (<code>0.peerjs.com</code>). You can point it at your own
          <code>peerjs-server</code> instance below.
        </div>
        <div class="form-group">
          <label class="form-label">Server Host</label>
          <input
            class="form-input"
            data-setting="peerjs-server-host-input"
            placeholder="0.peerjs.com"
            type="text"
          />
        </div>
        <div class="peerjs-row">
          <div class="form-group">
            <label class="form-label">Port</label>
            <input
              class="form-input"
              data-setting="peerjs-server-port-input"
              placeholder="443"
              type="number"
              min="1"
              max="65535"
            />
          </div>
          <div class="form-group">
            <label class="form-label">Path</label>
            <input
              class="form-input"
              data-setting="peerjs-server-path-input"
              placeholder="/"
              type="text"
            />
          </div>
        </div>
        <div class="form-group">
          <label class="checkbox-row">
            <input
              data-setting="peerjs-server-secure-toggle"
              type="checkbox"
              checked
            />
            Use TLS (secure WebSocket)
          </label>
        </div>
      </div>
    </details>

    <div class="form-group peerjs-connection-status">
      <label class="form-label">Connection Status</label>
      <div class="form-status" data-info="peerjs-connection-status">
        Not connected.
      </div>
    </div>

    <button class="save-btn save-btn--inline" data-action="save-peerjs-config">
      💾 Save PeerJS Settings
    </button>
  </div>

  <div class="peerjs-section peerjs-rooms-section">
    <h3>👥 Rooms (multi-party)</h3>
    <div class="form-helper">
      Rooms let multiple agents and humans share one conversation. The room you
      create is hosted by this device; invite trusted peers or share the room
      link below.
    </div>

    <div class="form-group">
      <label class="form-label">Create a Room</label>
      <div class="peerjs-row" style="align-items: flex-start">
        <div class="form-group" style="margin-bottom: 0; flex: 1">
          <input
            class="form-input"
            data-setting="room-new-name-input"
            placeholder="Room name (e.g. Design Review)"
            type="text"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <button
          type="button"
          class="save-btn save-btn--secondary"
          data-action="create-room"
          style="white-space: nowrap; height: 38px"
        >
          Create
        </button>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Your Rooms</label>
      <div class="peerjs-rooms-list" data-info="rooms-list">
        <div class="form-status">No rooms yet.</div>
      </div>
    </div>

    <div class="form-group peerjs-qr-group" data-info="room-qr-group" hidden>
      <label class="form-label" data-info="room-qr-label">
        QR Code — Share to Join
      </label>
      <div class="peerjs-qr-wrapper">
        <canvas data-info="room-qr-canvas" class="peerjs-qr-canvas"></canvas>
      </div>
      <div class="form-helper" data-info="room-qr-url"></div>
      <button
        class="save-btn save-btn--inline save-btn--secondary"
        data-action="copy-room-url"
      >
        🔗 Copy Room Link
      </button>
    </div>
  </div>
</template>
`,`text/html`),z=R.querySelector(`template`);let B=[];B=z?Array.from(z.content.children):Array.from(R.head.children).concat(Array.from(R.body.children));var he=B;const V=`shadow-claw-peerjs`;var ge=class extends x{static styles=L;static template=he;db=null;orchestrator=null;_currentPeerUrl=``;_currentRoomUrl=``;constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.db=await n(),this.orchestrator=h.orchestrator,this.bindEventListeners(),this.setupEffects(),await this.render()}disconnectedCallback(){super.disconnectedCallback()}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-action="save-peerjs-config"]`)?.addEventListener(`click`,()=>this.savePeerJsConfig()),e.querySelector(`[data-action="generate-peer-id"]`)?.addEventListener(`click`,()=>this.generatePeerId()),e.querySelector(`[data-action="copy-peer-id"]`)?.addEventListener(`click`,()=>this.copyPeerId()),e.querySelector(`[data-action="copy-peer-url"]`)?.addEventListener(`click`,()=>this.copyPeerUrl()),e.querySelector(`[data-action="add-trusted-peer"]`)?.addEventListener(`click`,()=>{let t=e.querySelector(`[data-setting="peerjs-new-trusted-id-input"]`),n=e.querySelector(`[data-setting="peerjs-new-trusted-alias-input"]`),r=t?.value?.trim(),i=n?.value?.trim();r&&(this._appendTrustedPeerRow(r,i||``),t&&(t.value=``),n&&(n.value=``))}),e.querySelector(`[data-setting="peerjs-my-peer-id-input"]`)?.addEventListener(`input`,()=>this.updateQrCode()),e.querySelector(`[data-action="create-room"]`)?.addEventListener(`click`,()=>this.createRoom()),e.querySelector(`[data-action="copy-room-url"]`)?.addEventListener(`click`,()=>this.copyRoomUrl()))}createRoom(){let e=this.shadowRoot,t=this.getOrchestrator();if(!e||!t)return;let n=e.querySelector(`[data-setting="room-new-name-input"]`),r=(n?.value||``).trim();if(!r){b(`Enter a room name.`,3e3);return}try{let e=d(t,r);n&&(n.value=``),y(`Room "${e.name}" created.`,2500),this.showRoomQr(e)}catch(e){b(`Failed to create room: ${e instanceof Error?e.message:String(e)}`,5e3)}}generatePeerId(){let e=this.shadowRoot;if(!e)return;let t=_().toLowerCase(),n=e.querySelector(`[data-setting="peerjs-my-peer-id-input"]`);n&&(n.value=t),this.updateQrCode()}getOrchestrator(){let e=h.orchestrator;return e&&(this.orchestrator=e),this.orchestrator}invitePeerToRoom(e,t){let n=this.getOrchestrator();n&&(s(n,e.roomId,t)?y(`Invited ${t.substring(0,8)} to "${e.name}".`,2500):b(`Failed to invite peer (are you the host?).`,4e3))}renderRooms(){let e=this.shadowRoot;if(!e)return;let t=this.getOrchestrator(),n=e.querySelector(`[data-info="rooms-list"]`);if(!n)return;let r=o(t)??[],s=new Set(t?.peerjs?.connectedPeersSignal?.get()??[]),c=t?p(t).myPeerId:``;if(n.textContent=``,!r.length){let e=document.createElement(`div`);e.className=`form-status`,e.textContent=`No rooms yet.`,n.appendChild(e);return}let l=this._trustedPeerOptions();r.forEach(e=>{let r=e.hostPeerId===c,o=document.createElement(`div`);o.className=`peerjs-room-card`;let u=document.createElement(`div`);u.className=`peerjs-room-header`;let d=document.createElement(`strong`);if(d.textContent=e.name,u.appendChild(d),r){let e=document.createElement(`span`);e.className=`peerjs-room-badge`,e.textContent=`Host`,u.appendChild(e)}o.appendChild(u);let f=document.createElement(`div`);f.className=`peerjs-room-roster`,e.members.forEach(e=>{let t=document.createElement(`span`);t.className=`peerjs-room-member`;let n=e.peerId===c||s.has(e.peerId),r=e.kind===`agent`?`🤖`:`🧑`;t.textContent=`${n?`🟢`:`⚪️`} ${r} ${e.alias||e.peerId}`,t.title=e.peerId,f.appendChild(t)}),o.appendChild(f);let p=document.createElement(`div`);p.className=`peerjs-room-actions`;let m=document.createElement(`button`);if(m.type=`button`,m.className=`save-btn save-btn--secondary`,m.textContent=`Open`,m.addEventListener(`click`,()=>{document.dispatchEvent(new CustomEvent(`shadow-claw-navigate`,{detail:{page:`chat`,groupId:a(e.roomId)},bubbles:!0,composed:!0}))}),p.appendChild(m),r){let t=document.createElement(`select`);t.className=`form-input peerjs-room-invite-select`;let n=document.createElement(`option`);n.value=``,n.textContent=l.length?`Invite trusted peer…`:`No trusted peers`,t.appendChild(n),l.filter(t=>!e.members.some(e=>e.peerId===t.id)).forEach(e=>{let n=document.createElement(`option`);n.value=e.id,n.textContent=e.label,t.appendChild(n)}),p.appendChild(t);let r=document.createElement(`button`);r.type=`button`,r.className=`save-btn save-btn--secondary`,r.textContent=`Invite`,r.addEventListener(`click`,()=>{let n=t.value.trim();if(!n){b(`Select a trusted peer to invite.`,3e3);return}this.invitePeerToRoom(e,n),t.value=``}),p.appendChild(r);let i=document.createElement(`button`);i.type=`button`,i.className=`save-btn save-btn--secondary`,i.textContent=`🔗 Link / QR`,i.addEventListener(`click`,()=>{this.showRoomQr(e)}),p.appendChild(i)}let h=document.createElement(`button`);h.type=`button`,h.className=`save-btn save-btn--danger`,h.textContent=r?`Disband`:`Leave`,h.addEventListener(`click`,()=>{i(t,e.roomId),y(r?`Room disbanded.`:`Left room.`,2500)}),p.appendChild(h),o.appendChild(p),n.appendChild(o)})}setupEffects(){this.addCleanup(S(()=>{if(!h.ready)return;let e=this.getOrchestrator();e&&(e.peerjs?.connectedPeersSignal?.get(),e.roomManager?.roomsSignal?.get()),this.render()}))}async copyPeerId(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="peerjs-my-peer-id-input"]`)?.value?.trim()||``;if(!t){b(`No Peer ID to copy.`,3e3);return}try{await navigator.clipboard.writeText(t),y(`Peer ID copied to clipboard`,2500)}catch{b(`Failed to copy Peer ID.`,3e3)}}async copyPeerUrl(){if(!this._currentPeerUrl){b(`No connection URL available. Enter a Peer ID first.`,3e3);return}try{await navigator.clipboard.writeText(this._currentPeerUrl),y(`Connection URL copied to clipboard`,2500)}catch{b(`Failed to copy connection URL.`,3e3)}}async copyRoomUrl(){if(!this._currentRoomUrl){b(`Create or select a room first.`,3e3);return}try{await navigator.clipboard.writeText(this._currentRoomUrl),y(`Room link copied to clipboard`,2500)}catch{b(`Failed to copy room link.`,3e3)}}async render(){let e=this.getOrchestrator(),t=this.shadowRoot;if(!t||!e)return;let n=p(e),r=t.querySelector(`[data-setting="peerjs-enabled-toggle"]`);r&&(r.checked=n.enabled);let i=t.querySelector(`[data-info="peerjs-channel-status"]`);i&&(i.textContent=n.enabled?`PeerJS channel is enabled.`:`PeerJS channel is disabled. Saved settings are retained.`);let a=t.querySelector(`[data-setting="peerjs-my-peer-id-input"]`);a&&(a.value=n.myPeerId);let o=t.querySelector(`[data-setting="peerjs-my-alias-input"]`);o&&(o.value=n.myAlias);let s=t.querySelector(`[data-info="peerjs-trusted-peers-list"]`);s&&s.children.length===0&&n.trustedPeerIds.length>0&&n.trustedPeerIds.forEach(e=>{let t=``;if(n.peerAliases){for(let[r,i]of Object.entries(n.peerAliases))if(i===e){t=r;break}}this._appendTrustedPeerRow(e,t)});let c=t.querySelector(`[data-info="peerjs-trusted-ids-status"]`);c&&(c.innerHTML=``,n.trustedPeerIds.length?(c.appendChild(document.createTextNode(`Connect to Trusted Peers: `)),n.trustedPeerIds.forEach(e=>{let t=e;if(n.peerAliases){for(let[r,i]of Object.entries(n.peerAliases))if(i===e){t=r;break}}let r=document.createElement(`button`);r.className=`save-btn save-btn--secondary`,r.style.padding=`0.25rem 0.5rem`,r.style.fontSize=`0.75rem`,r.style.margin=`0.25rem 0.25rem 0.25rem 0`,r.textContent=t,r.addEventListener(`click`,()=>{document.dispatchEvent(new CustomEvent(`shadow-claw-navigate`,{detail:{page:`chat`,groupId:`peer:${e}`},bubbles:!0,composed:!0}))}),c.appendChild(r)})):c.textContent=`Accepting connections from any peer.`);let l=t.querySelector(`[data-setting="peerjs-server-host-input"]`);l&&(l.value=n.serverHost);let u=t.querySelector(`[data-setting="peerjs-server-port-input"]`);u&&(u.value=n.serverPort?String(n.serverPort):``);let d=t.querySelector(`[data-setting="peerjs-server-path-input"]`);d&&(d.value=n.serverPath);let f=t.querySelector(`[data-setting="peerjs-server-secure-toggle"]`);f&&(f.checked=n.serverSecure),await this.updateConnectionStatus(),await this.updateQrCode(),this.renderRooms()}async savePeerJsConfig(){let e=this.getOrchestrator();if(!e||!this.db)return;let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-setting="peerjs-my-peer-id-input"]`),i=t.querySelector(`[data-setting="peerjs-my-alias-input"]`),a=t.querySelector(`[data-setting="peerjs-server-host-input"]`),o=t.querySelector(`[data-setting="peerjs-server-port-input"]`),s=t.querySelector(`[data-setting="peerjs-server-path-input"]`),u=t.querySelector(`[data-setting="peerjs-server-secure-toggle"]`),d=t.querySelector(`[data-setting="peerjs-enabled-toggle"]`),f=(n?.value||``).trim();f||(f=_().toLowerCase(),n&&(n.value=f));let p=(i?.value||``).trim(),m=[],h={};t.querySelectorAll(`.peerjs-trusted-peer-row`).forEach(e=>{let t=e.querySelector(`input[data-id]`),n=e.querySelector(`.alias-input`);if(t&&t.value){let e=t.value.trim();m.push(e),n&&n.value.trim()&&(h[n.value.trim()]=e)}});let g=(a?.value||``).trim(),v=parseInt(o?.value||`0`,10)||0,x=(s?.value||``).trim(),S=!!u?.checked,w=!!d?.checked;try{await C(e,this.db,f,m,g,v,x,S),await c(e,this.db,p),await r(e,this.db,h),await l(e,this.db,`peerjs`,w),await this.render(),y(`PeerJS settings saved`,3e3)}catch(e){b(`Error saving PeerJS settings: ${e instanceof Error?e.message:String(e)}`,6e3)}}async showRoomQr(e){let t=this.shadowRoot;if(!t)return;let n=this._buildRoomUrl(e);this._currentRoomUrl=n;let r=t.querySelector(`[data-info="room-qr-group"]`),i=t.querySelector(`[data-info="room-qr-label"]`),a=t.querySelector(`[data-info="room-qr-url"]`),o=t.querySelector(`[data-info="room-qr-canvas"]`);if(r&&(r.hidden=!1),i&&(i.textContent=`QR Code — Share to Join "${e.name}"`),a&&(a.textContent=n),o)try{await I.toCanvas(o,n,{width:180,margin:1,color:{dark:`#000000`,light:`#ffffff`}})}catch(e){console.error(`Room QR code render error:`,e)}}async updateConnectionStatus(){let e=this.shadowRoot;if(!e)return;let t=this.getOrchestrator(),n=e.querySelector(`[data-info="peerjs-connection-status"]`);if(!n)return;if(!t){n.textContent=`Not connected.`;return}let r=t.peerjs?.connectedPeersSignal?.get()||[];r.length===0?n.textContent=`Not connected.`:n.textContent=`Connected to: ${r.join(`, `)}`}async updateQrCode(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="peerjs-my-peer-id-input"]`)?.value?.trim()||``,n=e.querySelector(`[data-info="peerjs-qr-group"]`),r=e.querySelector(`[data-info="peerjs-qr-canvas"]`),i=e.querySelector(`[data-info="peerjs-qr-url"]`);if(!t){n&&(n.hidden=!0),this._currentPeerUrl=``;return}let a=`${window.location.origin}${window.location.pathname}?peer=${encodeURIComponent(t)}`;if(this._currentPeerUrl=a,n&&(n.hidden=!1),i&&(i.textContent=a),r)try{await I.toCanvas(r,a,{width:180,margin:1,color:{dark:`#000000`,light:`#ffffff`}})}catch(e){console.error(`PeerJS QR code render error:`,e)}}_appendTrustedPeerRow(e,t){let n=this.shadowRoot;if(!n)return;let r=n.querySelector(`[data-info="peerjs-trusted-peers-list"]`);if(!r||r.querySelector(`input[data-id="${e}"]`))return;let i=document.createElement(`div`);i.style.display=`flex`,i.style.gap=`0.5rem`,i.style.alignItems=`center`,i.className=`peerjs-trusted-peer-row`,i.innerHTML=`
      <input type="text" class="form-input" style="margin-bottom: 0" value="${e}" data-id="${e}" disabled />
      <input type="text" class="form-input alias-input" style="margin-bottom: 0" value="${t}" placeholder="Alias (optional)" />
      <button type="button" class="save-btn save-btn--danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; white-space: nowrap; height: 38px;">Remove</button>
    `,i.querySelector(`button`)?.addEventListener(`click`,()=>{i.remove()}),r.appendChild(i)}_buildRoomUrl(e){let t=new URLSearchParams({room:e.roomId,host:e.hostPeerId,name:e.name});return`${window.location.origin}${window.location.pathname}?${t.toString()}`}_trustedPeerOptions(){let e=this.getOrchestrator(),t=e?p(e):null;return t?t.trustedPeerIds.map(e=>{let n=e;if(t.peerAliases){for(let[r,i]of Object.entries(t.peerAliases))if(i===e){n=`${r} (${e.substring(0,8)})`;break}}return{id:e,label:n}}):[]}};customElements.get(V)||customElements.define(V,ge);const H=new CSSStyleSheet;H.replaceSync(`*,
*::before,
*::after {
  font-family: var(--shadow-claw-font-sans);
}

hr {
  margin: 2rem;
}

.hidden,
[hidden] {
  display: none !important;
}

:host {
  display: block;
}

.settings-section {
  margin-bottom: 1.75rem;
}

.settings-section h3 {
  align-items: center;
  display: flex;
  font-size: 1rem;
  font-weight: 600;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group--disabled {
  opacity: 0.72;
}

.form-group--disabled .form-input,
.form-group--disabled .checkbox-row input {
  pointer-events: none;
}

.form-label {
  color: var(--shadow-claw-text-primary);
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
}

.form-input {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.625rem);
  box-sizing: border-box;
  color: var(--shadow-claw-text-primary);
  font-family: var(--shadow-claw-font-sans);
  font-size: var(--shadow-claw-font-size-sm);
  padding: 0.625rem 0.75rem;
  transition: border-color 0.15s;
  width: 100%;
}

.form-input:focus {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 0.125rem rgba(0, 0, 0, 0.06);
  outline: none;
}

.form-helper {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.form-status {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
  margin-top: 0.4rem;
}

.checkbox-row {
  align-items: center;
  color: var(--shadow-claw-text-primary);
  display: inline-flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.checkbox-row input {
  margin: 0;
}

.save-btn {
  background-color: var(--shadow-claw-text-primary);
  border: none;
  border-radius: 62.5rem;
  color: var(--shadow-claw-bg-primary);
  cursor: pointer;
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  padding: 0.625rem 1.5rem;
  transition: background-color 150ms cubic-bezier(0.33, 1, 0.68, 1);
}

.save-btn:hover {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.save-btn--inline {
  margin-top: 0.625rem;
}

.save-btn--secondary {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  color: var(--shadow-claw-text-secondary);
  margin-left: 0.5rem;
}

.save-btn--secondary:hover {
  background-color: var(--shadow-claw-bg-tertiary);
  border-color: var(--shadow-claw-text-primary);
  color: var(--shadow-claw-text-primary);
}

.save-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
`);const U=new DOMParser().parseFromString(`<template>
  <div class="settings-section">
    <h3>💬 Messaging Channels</h3>

    <shadow-claw-peerjs></shadow-claw-peerjs>

    <hr />

    <div class="form-group">
      <label class="checkbox-row">
        <input data-setting="telegram-enabled-toggle" type="checkbox" />
        Enable Telegram channel
      </label>
      <div class="form-status" data-info="telegram-channel-status">
        Telegram channel is enabled.
      </div>
      <label class="form-label">Telegram Bot Token</label>
      <input
        class="form-input"
        data-setting="telegram-token-input"
        placeholder="123456:ABC-DEF..."
        type="password"
      />
      <div class="form-status" data-info="telegram-token-status">
        No Telegram token saved.
      </div>
      <div class="form-helper">
        Create a bot with @BotFather. Send /chatid to your bot, then add the
        returned chat IDs below so ShadowClaw will accept messages from them.
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Telegram Allowed Chat IDs</label>
      <input
        class="form-input"
        data-setting="telegram-chat-ids-input"
        placeholder="-1001234567890, 123456789"
        type="text"
      />
      <div class="form-helper">
        Comma-separated Telegram chat IDs. Messages from other chats are ignored
        except for /chatid and /ping helper commands.
      </div>
      <div class="form-status" data-info="telegram-chat-ids-status">
        No Telegram chat IDs saved.
      </div>
      <label class="checkbox-row">
        <input data-setting="telegram-use-proxy-toggle" type="checkbox" />
        Proxy Telegram API calls through this server (/telegram/**)
      </label>
      <div class="form-helper">
        Enable this when you want Telegram requests to stay same-origin and go
        through the local server route. Disable it to call the Telegram Bot API
        directly from the browser.
      </div>
      <div class="form-status" data-info="telegram-proxy-status">
        Telegram API calls go directly to Telegram.
      </div>
      <button
        class="save-btn save-btn--inline"
        data-action="save-telegram-config"
      >
        💾 Save Telegram Settings
      </button>
      <button
        class="save-btn save-btn--inline save-btn--secondary"
        data-action="verify-telegram-config"
      >
        🔎 Verify Telegram Setup
      </button>
    </div>

    <hr />

    <div class="form-group">
      <label class="checkbox-row">
        <input data-setting="imessage-enabled-toggle" type="checkbox" />
        Enable iMessage channel
      </label>
      <div class="form-status" data-info="imessage-channel-status">
        iMessage channel is enabled.
      </div>
      <label class="form-label">iMessage Bridge URL</label>
      <input
        class="form-input"
        data-setting="imessage-server-url-input"
        placeholder="https://your-bridge.example.com"
        type="url"
      />
      <div class="form-helper">
        Required. The bridge must allow browser CORS requests and expose GET
        /messages, POST /messages/send, and POST /messages/typing.
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">iMessage Bridge API Key</label>
      <input
        class="form-input"
        data-setting="imessage-api-key-input"
        placeholder="Bridge API key"
        type="password"
      />
      <div class="form-helper">
        Optional unless your bridge requires authentication. ShadowClaw sends
        both Authorization: Bearer and X-API-Key headers when this is set.
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">iMessage Allowed Chat IDs</label>
      <input
        class="form-input"
        data-setting="imessage-chat-ids-input"
        placeholder="chat-guid-1, +15551234567"
        type="text"
      />
      <div class="form-helper">
        Optional. Leave blank to accept all bridge conversations. iMessage chats
        auto-trigger the agent without requiring an @mention.
      </div>
      <button
        class="save-btn save-btn--inline"
        data-action="save-imessage-config"
      >
        💾 Save iMessage Settings
      </button>
      <div class="form-status" data-info="imessage-chat-ids-status">
        No iMessage chat IDs saved.
      </div>
    </div>
  </div>
</template>
`,`text/html`),W=U.querySelector(`template`);let G=[];G=W?Array.from(W.content.children):Array.from(U.head.children).concat(Array.from(U.body.children));var _e=G;const K=`shadow-claw-channel-config`;var ve=class extends x{static styles=H;static template=_e;db=null;orchestrator=null;constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.db=await n(),this.orchestrator=h.orchestrator,this.bindEventListeners(),this.setupEffects(),await this.render()}disconnectedCallback(){super.disconnectedCallback()}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-action="save-telegram-config"]`)?.addEventListener(`click`,()=>this.saveTelegramConfig()),e.querySelector(`[data-action="save-imessage-config"]`)?.addEventListener(`click`,()=>this.saveIMessageConfig()),e.querySelector(`[data-action="verify-telegram-config"]`)?.addEventListener(`click`,()=>this.verifyTelegramConfig()))}getOrchestrator(){let e=h.orchestrator;return e&&(this.orchestrator=e),this.orchestrator}setLoadingState(e){let t=e.querySelector(`[data-info="telegram-token-status"]`);t&&(t.textContent=`Loading Telegram settings...`);let n=e.querySelector(`[data-info="telegram-chat-ids-status"]`);n&&(n.textContent=`Loading Telegram settings...`);let r=e.querySelector(`[data-info="imessage-chat-ids-status"]`);r&&(r.textContent=`Loading iMessage settings...`)}setupEffects(){this.addCleanup(S(()=>{h.ready&&this.render()}))}updateChannelFieldAvailability(e,t,n){let r=e.querySelector(`[data-setting="telegram-token-input"]`),i=e.querySelector(`[data-setting="telegram-chat-ids-input"]`),a=e.querySelector(`[data-setting="telegram-use-proxy-toggle"]`),o=e.querySelector(`[data-action="verify-telegram-config"]`);r&&(r.disabled=!t),i&&(i.disabled=!t),a&&(a.disabled=!t),o&&(o.disabled=!t);let s=e.querySelector(`[data-setting="imessage-server-url-input"]`),c=e.querySelector(`[data-setting="imessage-api-key-input"]`),l=e.querySelector(`[data-setting="imessage-chat-ids-input"]`);s&&(s.disabled=!n),c&&(c.disabled=!n),l&&(l.disabled=!n),e.querySelectorAll(`.form-group`).forEach(e=>e.classList.remove(`form-group--disabled`)),t||e.querySelector(`[data-setting="telegram-token-input"]`)?.closest(`.form-group`)?.classList.add(`form-group--disabled`),n||e.querySelector(`[data-setting="imessage-server-url-input"]`)?.closest(`.form-group`)?.classList.add(`form-group--disabled`)}async render(){let e=this.getOrchestrator(),t=this.shadowRoot;if(!t)return;if(!e){this.setLoadingState(t);return}let n=u(e),r=m(e),i=t.querySelector(`[data-setting="telegram-token-input"]`),a=t.querySelector(`[data-setting="telegram-chat-ids-input"]`),o=t.querySelector(`[data-setting="telegram-use-proxy-toggle"]`),s=t.querySelector(`[data-setting="telegram-enabled-toggle"]`),c=t.querySelector(`[data-setting="imessage-server-url-input"]`),l=t.querySelector(`[data-setting="imessage-api-key-input"]`),d=t.querySelector(`[data-setting="imessage-chat-ids-input"]`),f=t.querySelector(`[data-setting="imessage-enabled-toggle"]`);s&&(s.checked=n.enabled);let p=t.querySelector(`[data-info="telegram-channel-status"]`);p&&(p.textContent=n.enabled?`Telegram channel is enabled.`:`Telegram channel is disabled. Saved settings are retained.`),i&&(i.value=n.botToken);let h=t.querySelector(`[data-info="telegram-token-status"]`);h&&(h.textContent=n.botToken?`Telegram token saved.`:`No Telegram token saved.`),a&&(a.value=n.chatIds.join(`, `));let g=t.querySelector(`[data-info="telegram-chat-ids-status"]`);g&&(g.textContent=n.chatIds.length?`Allowed Telegram chat IDs saved: ${n.chatIds.join(`, `)}`:`No Telegram chat IDs saved.`),o&&(o.checked=!!n.useProxy);let _=t.querySelector(`[data-info="telegram-proxy-status"]`);_&&(_.textContent=n.useProxy?`Telegram API calls are proxied through this server.`:`Telegram API calls go directly to Telegram.`),c&&(c.value=r.serverUrl),l&&(l.value=r.apiKey),d&&(d.value=r.chatIds.join(`, `)),f&&(f.checked=r.enabled);let v=t.querySelector(`[data-info="imessage-channel-status"]`);v&&(v.textContent=r.enabled?`iMessage channel is enabled.`:`iMessage channel is disabled. Saved settings are retained.`);let y=t.querySelector(`[data-info="imessage-chat-ids-status"]`);y&&(y.textContent=r.chatIds.length?`Allowed iMessage chat IDs saved: ${r.chatIds.join(`, `)}`:`No iMessage chat IDs saved.`),this.updateChannelFieldAvailability(t,n.enabled,r.enabled)}async saveIMessageConfig(){let e=this.getOrchestrator();if(!e||!this.db)return;let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-setting="imessage-server-url-input"]`),r=t.querySelector(`[data-setting="imessage-api-key-input"]`),i=t.querySelector(`[data-setting="imessage-chat-ids-input"]`),a=t.querySelector(`[data-setting="imessage-enabled-toggle"]`);try{await f(e,this.db,n?.value||``,r?.value||``,q(i?.value||``)),await l(e,this.db,`imessage`,!!a?.checked),await this.render(),y(`iMessage channel settings saved`,3e3)}catch(e){b(`Error saving iMessage settings: ${e instanceof Error?e.message:String(e)}`,6e3)}}async saveTelegramConfig(){let e=this.getOrchestrator();if(!e||!this.db)return;let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-setting="telegram-token-input"]`),r=t.querySelector(`[data-setting="telegram-chat-ids-input"]`),i=t.querySelector(`[data-setting="telegram-use-proxy-toggle"]`),a=t.querySelector(`[data-setting="telegram-enabled-toggle"]`);try{await g(e,this.db,n?.value||``,q(r?.value||``),!!i?.checked),await l(e,this.db,`telegram`,!!a?.checked),await this.render(),y(`Telegram channel settings saved`,3e3)}catch(e){b(`Error saving Telegram settings: ${e instanceof Error?e.message:String(e)}`,6e3)}}async verifyTelegramConfig(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="telegram-token-input"]`)?.value?.trim()||``,n=e.querySelector(`[data-setting="telegram-use-proxy-toggle"]`)?.checked?`/telegram/bot`:`https://api.telegram.org/bot`;if(!t){b(`Telegram bot token is empty. Save the token first.`,5e3);return}try{let e=await fetch(`${n}${t}/getMe`),r=await e.json();if(!e.ok||!r.ok)throw Error(r.description||`HTTP ${e.status}`);let i=await fetch(`${n}${t}/getWebhookInfo`),a=await i.json();if(!i.ok||!a.ok)throw Error(a.description||`HTTP ${i.status}`);if(a.result?.url?.trim()){v(`Telegram bot is valid (${r.result?.username||`unknown`}), but a webhook is enabled. Clear it with deleteWebhook before relying on getUpdates polling.`,7e3);return}y(`Telegram setup looks good for @${r.result?.username||`unknown`}. Token works and no webhook is active.`,5e3)}catch(e){b(`Telegram verification failed: ${e instanceof Error?e.message:String(e)}`,7e3)}}};function q(e){return Array.from(new Set(e.split(`,`).map(e=>e.trim()).filter(Boolean)))}customElements.get(K)||customElements.define(K,ve);const J=new CSSStyleSheet;J.replaceSync(`*,
*::before,
*::after {
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

:host {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.channels {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  width: 100%;
}

.channels__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem;
}
`);const Y=new DOMParser().parseFromString(`<template>
  <section aria-label="Messaging Channel Configuration" class="channels">
    <shadow-claw-page-header icon="💬" title="Messaging Channels">
      <shadow-claw-page-header-action-button
        class="channels__back-btn"
        data-action="back-to-settings"
        slot="actions"
      >
        ← Back to Settings
      </shadow-claw-page-header-action-button>
    </shadow-claw-page-header>

    <div class="channels__content">
      <shadow-claw-channel-config></shadow-claw-channel-config>
    </div>
  </section>
</template>
`,`text/html`),X=Y.querySelector(`template`);let Z=[];Z=X?Array.from(X.content.children):Array.from(Y.head.children).concat(Array.from(Y.body.children));var ye=Z;const Q=`shadow-claw-channels`;var $=class extends x{static styles=J;static template=ye;constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);await this.render()}async render(){let e=this.shadowRoot;e&&e.querySelector(`[data-action="back-to-settings"]`)?.addEventListener(`click`,()=>{this.dispatchEvent(new CustomEvent(`navigate-back`,{bubbles:!0,composed:!0}))})}};customElements.get(Q)||customElements.define(Q,$);export{$ as ShadowClawChannels};