"use babel";

export function multipleHostsEnabled() {
  return atom.config.get("Remote-FTP.multipleHosts ( Beta )");
}

export function getObject({keys, obj}){
  return keys.reduce(function(ret, key) {
    if( ret && ret.hasOwnProperty(key) ) return ret[key];
    return false;
  }, obj);
}
