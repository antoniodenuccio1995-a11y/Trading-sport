// Run the original parser assertions unchanged against the new module.
const Module=require('node:module');
const original=Module._load;
Module._load=function(request,parent,isMain){
 if(request==='../ta-csv-import'&&parent?.filename.endsWith('/tests/csv-import.test.cjs'))return original.call(this,require('node:path').resolve(__dirname,'../../ta-csv-import-v02U-rc5.js'),parent,isMain);
 return original.call(this,request,parent,isMain);
};
