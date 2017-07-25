'use babel';

import fs from 'fs-plus';
import path from 'path';
import { Model } from 'theorist';

class File extends Model {
  constructor(params) {
    super(params);

    this.parent = null;
    this.name = '';
    this.client = null;
    this.status = 0;
    this.size = 0;
    this.date = null;
    this.type = null;

    Object.keys(params).forEach((n) => {
      if (Object.prototype.hasOwnProperty.call(this, n)) {
        this[n] = params[n];
      }
    });

    const ext = path.extname(this.name);

    if (fs.isReadmePath(this.name)) {
      this.type = 'readme';
    } else if (fs.isCompressedExtension(ext)) {
      this.type = 'compressed';
    } else if (fs.isImageExtension(ext)) {
      this.type = 'image';
    } else if (fs.isPdfExtension(ext)) {
      this.type = 'pdf';
    } else if (fs.isBinaryExtension(ext)) {
      this.type = 'binary';
    } else {
      this.type = 'text';
    }
  }

  get local() {
    if (this.parent) {
      return path.normalize(path.join(this.parent.local, this.name)).replace(/\\/g, '/');
    }

    throw new Error('File needs to be in a Directory');
  }

  get remote() {
    if (this.parent) {
      return path.normalize(path.join(this.parent.remote, this.name)).replace(/\\/g, '/');
    }

    throw new Error('File needs to be in a Directory');
  }

  get root() {
    if (this.parent) {
      return this.parent.root;
    }

    return this;
  }

  open() {
    const self = this;
    const client = self.root.client;

    client.download(self.remote, false, (err) => {
      if (err) {
        atom.notifications.addError(`Remote FTP: ${err}`, {
          dismissable: false,
        });
        return;
      }
      atom.workspace.open(self.local);
    });
  }
}

export default File;
