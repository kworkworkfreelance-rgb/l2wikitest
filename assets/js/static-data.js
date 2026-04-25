/* Generated loader — loads 12 static-data chunks synchronously */
(function(){
  'use strict';
  if (window.L2WIKI_SEED_DATA) return;
  window.__L2WIKI_CHUNKS = window.__L2WIKI_CHUNKS || [];
  document.write('<script src="/assets/js/static-data-chunk-1.js"></' + 'script>');
  document.write('<script src="/assets/js/static-data-chunk-2.js"></' + 'script>');
  document.write('<script src="/assets/js/static-data-chunk-3.js"></' + 'script>');
  document.write('<script src="/assets/js/static-data-chunk-4.js"></' + 'script>');
  document.write('<script src="/assets/js/static-data-chunk-5.js"></' + 'script>');
  document.write('<script src="/assets/js/static-data-chunk-6.js"></' + 'script>');
  document.write('<script src="/assets/js/static-data-chunk-7.js"></' + 'script>');
  document.write('<script src="/assets/js/static-data-chunk-8.js"></' + 'script>');
  document.write('<script src="/assets/js/static-data-chunk-9.js"></' + 'script>');
  document.write('<script src="/assets/js/static-data-chunk-10.js"></' + 'script>');
  document.write('<script src="/assets/js/static-data-chunk-11.js"></' + 'script>');
  document.write('<script src="/assets/js/static-data-chunk-12.js"></' + 'script>');

  function decodeB64ToUtf8(b64){
    try{
      var bin = atob(b64);
      if (typeof TextDecoder !== 'undefined'){
        var arr = new Uint8Array(bin.length);
        for (var i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
        return new TextDecoder('utf-8').decode(arr);
      }
      // fallback for older browsers
      return decodeURIComponent(Array.prototype.map.call(bin, function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
    }catch(e){ return null; }
  }

  var b64 = (window.__L2WIKI_CHUNKS || []).join('');
  var jsonStr = decodeB64ToUtf8(b64);
  if (jsonStr){
    try{ window.L2WIKI_SEED_DATA = JSON.parse(jsonStr); } catch(e){ console.error('[static-data loader] JSON parse error', e); }
  } else {
    var s = document.createElement('script'); s.src = '/assets/js/data-loader.js'; document.head.appendChild(s);
  }
  if (window.L2WIKI_SEED_DATA) window.dispatchEvent(new CustomEvent('l2wiki:data-loaded',{detail: window.L2WIKI_SEED_DATA}));
  try { delete window.__L2WIKI_CHUNKS; } catch(_) {}
})();