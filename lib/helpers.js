'use babel';

const atom = global.atom;

export const hasOwnProperty = function HASOWNPROPERTY({ obj, prop }) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
};

export const multipleHostsEnabled = function MULTIPLEHOSTSENABLED() {
  return atom.config.get('Remote-FTP.multipleHosts ( Beta )');
};

export const getObject = function GETOBJECT({ keys, obj }) {
  return keys.reduce((ret, key) => {
    if (ret && hasOwnProperty({ obj: ret, prop: key })) return ret[key];
    return false;
  }, obj);
};

export const hasProject = function HASPROJECT() {
  return atom.project && atom.project.getPaths().length;
};
