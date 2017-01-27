'use babel';

const atom = global.atom;

export const hasOwnProperty = function HASOWNPROPERTY({ obj, prop }) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
};

export const multipleHostsEnabled = function MULTIPLEHOSTSENABLED() {
  return atom.config.get('Remote-FTP.multipleHosts ( Beta )');
};

export const getObject = function GETOBJECT({ keys, obj }) {
  if (!(keys instanceof Array)) throw new Error('keys is not an array');
  if (typeof obj !== 'object') throw new Error('obj is not an object');

  return keys.reduce((ret, key) => {
    if (ret && hasOwnProperty({ obj: ret, prop: key })) return ret[key];
    return false;
  }, obj);
};

export const hasProject = function HASPROJECT() {
  return atom.project && atom.project.getPaths().length;
};

let addIconToElement;
export const setIconHandler = function SETICONHANDLER(fn) {
  addIconToElement = fn;
};

export const getIconHandler = function GETICONHANDLER() {
  return addIconToElement;
};
