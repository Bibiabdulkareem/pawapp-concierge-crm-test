/* Safe formatter compatibility for the monthly accountant report. */
(function(){
  'use strict';
  var F=window.PawFinanceCore;
  if(!F||F.__accountantFormatV1)return;
  var original=F.format;
  F.format=function(value){
    if(value!==null&&value!==undefined&&typeof value!=='bigint')return original(F.minor(value));
    return original(value);
  };
  F.__accountantFormatV1=true;
})();
