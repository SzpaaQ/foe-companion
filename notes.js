(function(root){
 const KEY='foe-companion.notes';
 function createStore(storage){
  function read(){try{const value=JSON.parse(storage.getItem(KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
  function get(section,pearl){const notes=read(),value=section==='pearl'?notes.pearl?.[pearl]:notes[section];return typeof value==='string'?value:'';}
  function set(section,pearl,value){
   if(!['pearl','najazdy','gbg','city','settings'].includes(section))throw Error('Nieznana zakładka');
   if(section==='pearl'&&(!pearl||!/^\w+$/.test(pearl)||['__proto__','constructor','prototype'].includes(pearl)))throw Error('Brak identyfikatora perły');
   const notes=read();if(section==='pearl'){if(!notes.pearl||typeof notes.pearl!=='object'||Array.isArray(notes.pearl))notes.pearl={};notes.pearl[pearl]=String(value);}else notes[section]=String(value);
   storage.setItem(KEY,JSON.stringify(notes));
  }
  return {get,set};
 }
 root.FoeNotes={createStore,KEY};if(typeof module!=='undefined')module.exports=root.FoeNotes;
})(globalThis);
