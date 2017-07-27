'use babel';

let addIconToElement;

export const hasProject = () => atom.project && atom.project.getPaths().length;
export const multipleHostsEnabled = () => atom.config.get('Remote-FTP.beta.multipleHosts');
export const hasOwnProperty = ({ obj, prop }) => Object.prototype.hasOwnProperty.call(obj, prop);
export const resizeCursor = process.platform === 'win32' ? 'ew-resize' : 'col-resize';
export const splitPaths = path => path.replace(/^\/+/, '').replace(/\/+$/, '').split('/');

export const simpleSort = (a, b) => {
  if (a.name === b.name) { return 0; }

  return a.name > b.name ? 1 : -1;
};

export const getObject = ({ keys, obj }) => {
  if (!(keys instanceof Array)) throw new Error('keys is not an array');
  if (typeof obj !== 'object') throw new Error('obj is not an object');

  return keys.reduce((ret, key) => {
    if (ret && hasOwnProperty({ obj: ret, prop: key })) return ret[key];
    return false;
  }, obj);
};

export const setIconHandler = (fn) => {
  addIconToElement = fn;
};

export const getIconHandler = () => addIconToElement;

export const elapsedTime = (milliseconds) => {
  let ms = milliseconds;

  const days = Math.floor(ms / 86400000);
  ms %= 86400000;
  const hours = Math.floor(ms / 3600000);
  ms %= 3600000;
  const mins = Math.floor(ms / 60000);
  ms %= 60000;
  const secs = Math.floor(ms / 1000);
  ms %= 1000;

  return ((days ? `${days}d ` : '') +
      (hours ? `${((days) && hours < 10 ? '0' : '') + hours}h ` : '') +
      (mins ? `${((days || hours) && mins < 10 ? '0' : '') + mins}m ` : '') +
      (secs ? `${((days || hours || mins) && secs < 10 ? '0' : '') + secs}s ` : ''))
      .replace(/^[dhms]\s+/, '')
      .replace(/[dhms]\s+[dhms]/g, '')
      .replace(/^\s+/, '')
      .replace(/\s+$/, '') || '0s';
};

export const separateRemoteItems = (folder) => {
  if (!folder) return false;

  const list = [];
  const filter = (item) => {
    if (item.name === '.' || item.name === '..') return;

    if (item.type !== 'd' && item.type !== 'l') {
      item.type = 'f';
    }

    list.push(item);
  };

  folder.forEach(filter);

  return list;
};
