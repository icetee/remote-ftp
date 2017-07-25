'use babel';

import path from 'path';
import { Model } from 'theorist';
import { multipleHostsEnabled, simpleSort } from './helpers';
import File from './file';

class Directory extends Model {
  constructor(params) {
    super(params);

    this.parent = null;
    this.name = '';
    this.path = '';
    this.client = null;
    this.isExpanded = false;
    this.status = 0;
    this.folders = [];
    this.files = [];

    Object.keys(params).forEach((n) => {
      if (Object.prototype.hasOwnProperty.call(this, n)) {
        this[n] = params[n];
      }
    });
  }

  destroy(...args) {
    this.folders.forEach((folder) => {
      folder.destroy();
    });
    this.folders = [];

    this.files.forEach((file) => {
      file.destroy();
    });
    this.files = [];

    if (!this.isRoot) {
      super.detach(...args);
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
    const self = this;
    const client = self.root.client;

    client.list(self.remote, false, (err, list) => {
      if (err) {
        atom.notifications.addError(`Remote FTP: ${err}`, {
          dismissable: false,
        });
        return;
      }

      self.status = 1;

      const folders = [];
      const files = [];

      list.forEach((item) => {
        const name = path.basename(item.name);
        let index;
        let entry;

        if (item.type === 'd' || item.type === 'l') {
          if (name === '.' || name === '..') { return; }

          index = self.exists(name, true);

          if (index === null) {
            entry = new Directory({
              parent: self,
              name,
            });
          } else {
            entry = self.folders[index];
            self.folders.splice(index, 1);
          }

          folders.push(entry);
        } else {
          if (index === null) {
            entry = new File({
              parent: self,
              name,
            });
          } else {
            entry = self.files[index];
            self.files.splice(index, 1);
          }

          entry.size = item.size;
          entry.date = item.date;

          files.push(entry);
        }
      });

      self.folders.forEach((folder) => { folder.destroy(); });
      self.folders = folders;

      self.files.forEach((file) => { file.destroy(); });
      self.files = files;

      if (recursive) {
        self.folders.forEach((folder) => {
          if (folder.status === 0) { return; }

          folder.open(true);
        });
      }

      if (typeof (complete) === 'function') {
        complete.call(null);
      }
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
      return path.normalize(path.join(this.parent.local, this.name)).replace(/\\/g, '/');
    }

    return multipleHostsEnabled() === true ? this.client.projectPath : atom.project.getPaths()[0];
  }

  get remote() {
    if (this.parent) {
      return path.normalize(path.join(this.parent.remote, this.name)).replace(/\\/g, '/');
    }

    return this.path;
  }
}

export default Directory;
