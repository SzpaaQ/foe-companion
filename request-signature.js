(function(root){
 const salt='VwWMiunfT0YrPqh1d/cillpV1ux5fcA9SLBNqwHcrri8LklXy9Fe/iJoWJalRwVbfesiZPRwYbBQqKF2eQo08w==';
 function md5(text){
  const input=new TextEncoder().encode(text),length=Math.ceil((input.length+9)/64)*64,bytes=new Uint8Array(length);bytes.set(input);bytes[input.length]=128;
  const view=new DataView(bytes.buffer);view.setUint32(length-8,input.length*8,true);view.setUint32(length-4,Math.floor(input.length/536870912),true);
  const state=[0x67452301,0xefcdab89,0x98badcfe,0x10325476],shifts=[[7,12,17,22],[5,9,14,20],[4,11,16,23],[6,10,15,21]];
  for(let off=0;off<length;off+=64){let [a,b,c,d]=state;for(let i=0;i<64;i++){const round=i>>4;let f,g;if(round===0){f=(b&c)|(~b&d);g=i;}else if(round===1){f=(d&b)|(~d&c);g=(5*i+1)%16;}else if(round===2){f=b^c^d;g=(3*i+5)%16;}else{f=c^(b|~d);g=(7*i)%16;}const n=(a+f+Math.floor(Math.abs(Math.sin(i+1))*4294967296)+view.getUint32(off+g*4,true))|0,s=shifts[round][i%4];[a,b,c,d]=[d,(b+((n<<s)|(n>>>(32-s))))|0,b,c];}for(const [i,n] of [a,b,c,d].entries())state[i]=(state[i]+n)|0;}
  return state.map(n=>[0,8,16,24].map(s=>((n>>>s)&255).toString(16).padStart(2,'0')).join('')).join('');
 }
 const api={sign:(h,body)=>md5(h+salt+body).slice(1,11)};root.FoeRequestSignature=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
