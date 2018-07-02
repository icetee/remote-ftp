'use babel';

import path from 'path';
import { Emitter } from 'event-kit';
import { multipleProjects, simpleSort } from './helpers';
import File from './file';

class Directory {
  constructor(params) {
    this.emitter = new Emitter();

    this.parent = null;
    this.name = '';
    this.path = '';
    this.client = null;
    this.isExpanded = false;
    this.isSelected = false;
    this.status = 0;
    this.folders = [];
    this.files = [];
    this.original = null;

    Object.keys(params).forEach((n) => {
      if (Object.prototype.hasOwnProperty.call(this, n)) {
        this[n] = params[n];
      }
    });
  }

  destroy() {
    this.folders.forEach((folder) => {
      folder.destroy();
    });
    this.folders = [];

    this.files.forEach((file) => {
      file.destroy();
    });
    this.files = [];

    if (!this.isRoot) {
      this.emitter.emit('destroyed');
      this.emitter.dispose();
    }
  }

  sort() {
    this.folders.sort(simpleSort);
    this.files.sort(simpleSort);
  }

  exists(name, isdir) {
    if (isdir) {
      for (let a = 0, b = this.folders.length; a < b; ++a) {
        if (this.folders[a].name === name) { return a; }
      }
    } else {
      for (let a = 0, b = this.files.length; a < b; ++a) {
        if (this.files[a].name === name) { return a; }
      }
    }

    return null;
  }

  open(recursive, complete) {
    const client = this.root.client;

    client.list(this.remote, false, (err, list) => {
      if (err) {
        atom.notifications.addError(`Remote FTP: ${err}`, {
          dismissable: false,
        });
        return;
      }

      this.status = 1;

      const folders = [];
      const files = [];

      list.forEach((item) => {
        const name = path.basename(item.name);
        let index;
        let entry;

        if (item.type === 'd' || item.type === 'l') {
          if (name === '.' || name === '..') { return; }

          index = this.exists(name, true);

          if (index === null) {
            entry = new Directory({
              parent: this,
              original: item,
              name,
            });
          } else {
            entry = this.folders[index];
            this.folders.splice(index, 1);
          }

          folders.push(entry);

          this.emitter.emit('did-change-folder', folders);
        } else {
          index = this.exists(name, true);

          if (index === null) {
            entry = new File({
              parent: this,
              original: item,
              name,
            });
          } else {
            entry = this.files[index];
            this.files.splice(index, 1);
          }

          entry.size = item.size;
          entry.date = item.date;

          files.push(entry);

          this.emitter.emit('did-change-file', files);
        }
      });

      this.folders.forEach((folder) => { folder.destroy(); });
      this.folders = folders;

      this.files.forEach((file) => { file.destroy(); });
      this.files = files;

      if (recursive) {
        this.folders.forEach((folder) => {
          if (folder.status === 0) { return; }

          folder.open(true);
        });
      }

      if (typeof (complete) === 'function') {
        complete.call(null);
      }

      this.emitter.emit('did-change-items', this);
    });
  }

  openPath(opath) {
    let remainingPath = opath.replace(this.remote, '');

    if (remainingPath.startsWith('/')) {
      remainingPath = remainingPath.substr(1);
    }

    if (remainingPath.length > 0) {
      const remainingPathSplit = remainingPath.split('/');

      if (remainingPathSplit.length > 0 && this.folders.length > 0) {
        let nextPath = this.remote;

        if (!nextPath.endsWith('/')) { nextPath += '/'; }

        nextPath += remainingPathSplit[0];

        this.folders.forEach((folder) => {
          if (folder.remote === nextPath) {
            folder.isExpanded = true;

            if (folder.folders.length > 0) {
              folder.openPath(opath);
            } else {
              folder.open(false, () => {
                folder.openPath(opath);
              });
            }
          }
        });
      }
    }
  }

  onChangeFolder(callback) {
    return this.emitter.on('did-change-folder', callback);
  }

  onChangeFile(callback) {
    return this.emitter.on('did-change-file', callback);
  }

  onChangeItems(callback) {
    return this.emitter.on('did-change-items', callback);
  }

  onChangeExpanded(callback) {
    return this.emitter.on('did-change-expanded', callback);
  }

  onChangeSelect(callback) {
    return this.emitter.on('did-change-select', callback);
  }

  onDestroyed(callback) {
    return this.emitter.on('destroyed', callback);
  }

  get isRoot() {
    return this.parent === null;
  }

  get root() {
    if (this.parent) {
      return this.parent.root;
    }

    return this;
  }

  get local() {
    if (this.parent) {
      let p = path.normalize(path.join(this.parent.local, this.name));

      if (path.sep !== '/') p = p.replace(/\\/g, '/');

      return p;
    }

    return multipleProjects() === true ? this.client.projectPath : atom.project.getPaths()[0];
  }

  get remote() {
    if (this.parent) {
      let p = path.normalize(path.join(this.parent.remote, this.name));

      if (path.sep !== '/') p = p.replace(/\\/g, '/');

      return p;
    }

    return this.path;
  }

  set setIsExpanded(value) {
    this.emitter.emit('did-change-expanded', value);
    this.isExpanded = value;
  }

  set setIsSelected(value) {
    this.isSelected = value;
    this.emitter.emit('did-change-select', value);
  }
}

export default Directory;
