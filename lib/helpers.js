'use babel';

import fs from 'fs';
import Path from 'path';
import { $ } from 'atom-space-pen-views';

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

export const simpleSortDepth = (a, b) => {
  if (a.depth === b.depth) { return 0; }

  return a.depth > b.depth ? -1 : 1;
};

export const sortDepth = (a, b) => {
  if (a.depth === b.depth) { return 0; }

  return a.depth > b.depth ? 1 : -1;
};

export const countDepth = (file) => {
  file.depth = file.name.split('/').length;
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

export const logger = (text) => {
  console.log(text);
};

export const localFilePrepare = (fileName, currentPath) => {
  let file;
  let queue;

  if (fileName !== '.' && fileName !== '..') {
    const fullName = Path.join(currentPath, fileName);

    const stats = fs.statSync(fullName);
    file = {
      name: fullName,
      size: stats.size,
      date: stats.mtime,
      type: stats.isFile() ? 'f' : 'd',
    };

    if (!stats.isFile()) {
      queue = fullName;
    }
  }

  return { file, queue };
};

export const traverseTree = (localPath, callback) => {
  const list = [];
  const queue = [localPath];

  // search all files in localPath recursively
  while (queue.length > 0) {
    const currentPath = Path.normalize(queue.pop());

    if (!fs.existsSync(currentPath)) {
      fs.closeSync(fs.openSync(currentPath, 'w'));
    }

    const filesFound = fs.readdirSync(currentPath);

    let localFile;
    for (let i = 0; i < filesFound.length; i++) {
      localFile = localFilePrepare(filesFound[i], currentPath);
      list.push(localFile.file);

      if (localFile.queue) {
        queue.push(localFile.queue);
      }
    }
  }

  // depth counting & sorting
  list.forEach(countDepth);
  list.sort(sortDepth);

  // callback
  if (typeof callback === 'function') callback.apply(null, [list]);
};

export const validateConfig = (data) => {
  try {
    // try to parse the json
    JSON.parse(data);
    return true;
  } catch (error) {
    // try to extract bad syntax location from error message
    let lineNumber = -1;
    let index;
    const regex = /at position ([0-9]+)$/;
    const result = error.message.match(regex);
    if (result && result.length > 0) {
      const cursorPos = parseInt(result[1], 10);
      // count lines until syntax error position
      const tmp = data.substr(0, cursorPos);
      for (lineNumber = -1, index = 0; index !== -1; lineNumber++, index = tmp.indexOf('\n', index + 1));
    }

    // show notification
    atom.notifications.addError('Could not parse `.ftpconfig`', {
      detail: `${error.message}`,
      dismissable: false,
    });

    // open .ftpconfig file and mark the faulty line
    atom.workspace.open('.ftpconfig').then((editor) => {
      if (lineNumber === -1) return; // no line number to mark

      const decorationConfig = {
        class: 'ftpconfig_line_error',
      };

      editor.getDecorations(decorationConfig).forEach((decoration) => {
        decoration.destroy();
      });

      const range = editor.getBuffer().clipRange([
        [lineNumber, 0],
        [lineNumber, Infinity],
      ]);

      const marker = editor.markBufferRange(range, {
        invalidate: 'inside',
      });

      decorationConfig.type = 'line';
      editor.decorateMarker(marker, decorationConfig);
    });
  }

  // return false, as the json is not valid
  return false;
};

export const resolveTree = (path) => {
  const views = $(`.remote-ftp-view [data-path="${path}"]`);

  return views.map((err, item) => $(item).view() || null).get(0);
};

export const getSelectedTree = () => {
  const views = $('.remote-ftp-view .selected');

  return views.map((err, item) => $(item).view() || null).get();
};
