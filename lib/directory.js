'use babel';

let __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) { for (const key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  path = require('path'),
  File = require('./file'),
  Model = require('theorist').Model,
  multipleHostsEnabled = require('./helpers').multipleHostsEnabled;


module.exports = Directory = (function (parent) {
  __extends(Directory, parent);

  Directory.properties({
    parent: null,
    name: '',
    path: '',
    client: null,
    isExpanded: false,
    status: 0,
    folders: [],
    files: [],
  });

  Directory.prototype.accessor('isRoot', function () {
    return this.parent === null;
  });

  Directory.prototype.accessor('local', function () {
    if (this.parent) return path.normalize(path.join(this.parent.local, this.name)).replace(/\\/g, '/');

    return multipleHostsEnabled() === true ? this.client.projectPath : atom.project.getPaths()[0];
  });

  Directory.prototype.accessor('remote', function () {
    if (this.parent)			{ return path.normalize(path.join(this.parent.remote, this.name)).replace(/\\/g, '/'); }
    return this.path;
  });

  Directory.prototype.accessor('root', function () {
    if (this.parent)			{ return this.parent.root; }
    return this;
  });

  function Directory() {
    Directory.__super__.constructor.apply(this, arguments);
  }

  Directory.prototype.destroy = function () {
    this.folders.forEach((folder) => {
      folder.destroy();
    });
    this.folders = [];

    this.files.forEach((file) => {
      file.destroy();
    });
    this.files = [];

    if (!this.isRoot)			{ Directory.__super__.destroy.apply(this, arguments); }
  };

  Directory.prototype.sort = function () {
    this.folders.sort((a, b) => {
      if (a.name == b.name)				{ return 0; }
      return a.name > b.name ? 1 : -1;
    });

    this.files.sort((a, b) => {
      if (a.name == b.name)				{ return 0; }
      return a.name > b.name ? 1 : -1;
    });
  };

  Directory.prototype.exists = function (name, isdir) {
    if (isdir) {
      for (a = 0, b = this.folders.length; a < b; ++a) { if (this.folders[a].name == name)					{ return a; } }
    } else {
      for (a = 0, b = this.files.length; a < b; ++a) {
        if (this.files[a].name == name)					{ return a; }
      }
    }
    return null;
  };

  Directory.prototype.open = function (recursive, complete) {
    let self = this,
      client = self.root.client;

    client.list(self.remote, false, (err, list) => {
      if (err) {
        atom.notifications.addError(`Remote FTP: ${err}`, {
          dismissable: false,
        });
        return;
      }


      self.status = 1;

      let folders = [],
        files = [];

      list.forEach((item) => {
        let index,
          name = path.basename(item.name),
          entry;
        if (item.type == 'd' || item.type == 'l') {
          if (name == '.' || name == '..')						{ return; }
          if ((index = self.exists(name, true)) === null) {
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
          if ((index = self.exists(name, false)) === null) {
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
          if (folder.status === 0)						{ return; }

          folder.open(true);
        });
      }

      if (typeof (complete) === 'function')			{
        complete.call(null);
      }
    });
  };

  Directory.prototype.openPath = function (path) {
    let self = this,
      client = self.root.client;

    let remainingPath = path.replace(self.remote, '');
    if (remainingPath.startsWith('/'))			{ remainingPath = remainingPath.substr(1); }

    if (remainingPath.length > 0)		{
      const remainingPathSplit = remainingPath.split('/');

      if (remainingPathSplit.length > 0 && self.folders.length > 0)			{
        let nextPath = self.remote;

        if (!nextPath.endsWith('/'))					{ nextPath += '/'; }

        nextPath += remainingPathSplit[0];

        self.folders.forEach((folder) => {
          if (folder.remote === nextPath)					{
            folder.isExpanded = true;

            if (folder.folders.length > 0)						{
              folder.openPath(path);
            } else						{
              folder.open(false, () => {
                folder.openPath(path);
              });
            }

            return false;
          }
        });
      }
    }
  };

  return Directory;
}(Model));
