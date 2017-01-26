let __hasProp = {}.hasOwnProperty,
  __extends = function (child, parent) { for (const key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  $ = require('atom-space-pen-views').$,
  Dialog = require('./dialog');

module.exports = AddDialog = (function (parent) {
  __extends(AddDialog, parent);

  function AddDialog(initialPath, isFile) {
    this.isCreatingFile = isFile;

    AddDialog.__super__.constructor.call(this, {
      prompt: isFile ? 'Enter the path for the new file.' : 'Enter the path for the new folder.',
      initialPath,
      select: false,
      iconClass: isFile ? 'icon-file-add' : 'icon-file-directory-create',
    });
  }

  AddDialog.prototype.onConfirm = function (relativePath) {
    this.trigger('new-path', [relativePath]);
  };

  return AddDialog;
}(Dialog));
