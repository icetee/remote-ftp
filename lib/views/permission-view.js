'use babel';

import { $, View, TextEditorView } from 'atom-space-pen-views';
import { CompositeDisposable } from 'atom';
import { isNoChangeGroup, isNoChangeOwner, isNoChangeOwnerAndGroup, isPermissionDenied } from '../notifications';

class PermissionView extends View {
  static content() {
    return this.div({
      class: 'permission-view remote-ftp',
    }, () => {
      this.div({
        class: 'permissions-wrapper',
      }, () => {
        // Owner
        this.div({
          class: 'permission-user block',
          outlet: 'permissionUser',
        }, () => {
          this.h5('Owner Permissions');

          // Read
          this.label('Read', {
            class: 'input-label inline-block',
          }, () => {
            this.input({
              class: 'input-checkbox',
              type: 'checkbox',
              id: 'permission-user-read',
              'data-perm': 'r',
            });
          });

          // Write
          this.label('Write', {
            class: 'input-label inline-block',
          }, () => {
            this.input({
              class: 'input-checkbox',
              type: 'checkbox',
              id: 'permission-user-write',
              'data-perm': 'w',
            });
          });

          // Execute
          this.label('Execute', {
            class: 'input-label inline-block',
          }, () => {
            this.input({
              class: 'input-checkbox',
              type: 'checkbox',
              id: 'permission-user-execute',
              'data-perm': 'x',
            });
          });
        });

        // Group
        this.div({
          class: 'permission-group block',
          outlet: 'permissionGroup',
        }, () => {
          this.h5('Group Permissions');

          // Read
          this.label('Read', {
            class: 'input-label inline-block',
          }, () => {
            this.input({
              class: 'input-checkbox',
              type: 'checkbox',
              id: 'permission-group-read',
              'data-perm': 'r',
            });
          });

          // Write
          this.label('Write', {
            class: 'input-label inline-block',
          }, () => {
            this.input({
              class: 'input-checkbox',
              type: 'checkbox',
              id: 'permission-group-write',
              'data-perm': 'w',
            });
          });

          // Execute
          this.label('Execute', {
            class: 'input-label inline-block',
          }, () => {
            this.input({
              class: 'input-checkbox',
              type: 'checkbox',
              id: 'permission-group-execute',
              'data-perm': 'x',
            });
          });
        });

        // Public
        this.div({
          class: 'permission-other block',
          outlet: 'permissionOther',
        }, () => {
          this.h5('Public (other) Permissions');

          // Read
          this.label('Read', {
            class: 'input-label inline-block',
          }, () => {
            this.input({
              class: 'input-checkbox',
              type: 'checkbox',
              id: 'permission-other-read',
              'data-perm': 'r',
            });
          });

          // Write
          this.label('Write', {
            class: 'input-label inline-block',
          }, () => {
            this.input({
              class: 'input-checkbox',
              type: 'checkbox',
              id: 'permission-other-write',
              'data-perm': 'w',
            });
          });

          // Execute
          this.label('Execute', {
            class: 'input-label inline-block',
          }, () => {
            this.input({
              class: 'input-checkbox',
              type: 'checkbox',
              id: 'permission-other-execute',
              'data-perm': 'x',
            });
          });
        });

        this.div({
          class: 'permission-chown block',
        }, () => {
          this.label('Group: ', {
            class: 'input-label inline-block',
          });

          this.subview('chownGroup', new TextEditorView({
            mini: true,
            placeholderText: null,
          }));

          this.label('Owner: ', {
            class: 'input-label inline-block',
          });

          this.subview('chownOwner', new TextEditorView({
            mini: true,
            placeholderText: null,
          }));
        });
      });

      this.div({
        class: 'permissions-wrapper-block',
      }, () => {
        this.div({
          class: 'permissions-chmod block',
        }, () => {
          this.label('Chmod');
          this.subview('chmodInput', new TextEditorView({
            mini: true,
            placeholderText: 600,
          }));
        });
      });

      this.div({
        class: 'block clearfix',
        outlet: 'buttonBlock',
      }, () => {
        this.button({
          class: 'inline-block btn pull-right icon icon-x inline-block-tight',
          outlet: 'cancelButton',
          click: 'cancel',
        }, 'Cancel');
        this.button({
          class: 'inline-block btn btn-primary pull-right icon icon-sync inline-block-tight',
          outlet: 'saveButton',
          click: 'confirm',
        }, 'Save');
      });
    });
  }

  initialize(params, remotes) {
    this.ftp = atom.project.remoteftpMain;
    this.item = remotes.item;
    this.right = { r: 4, w: 2, x: 1 };

    this.disposables = new CompositeDisposable();
    this.disposables.add(atom.commands.add('atom-workspace', {
      'core:confirm': () => {
        this.confirm();
      },
      'core:cancel': (event) => {
        this.cancel();
        event.stopPropagation();
      },
    }));

    Object.keys(params.rights).forEach((right) => {
      const perms = params.rights[right].split('');
      const $perm = $(this).find(`.permission-${right}`);

      for (let i = 0; i < perms.length; i++) {
        $perm.find(`input[data-perm="${perms[i]}"]`).attr('checked', true);
      }
    });

    this.chownGroup.getModel().setPlaceholderText(params.group);
    this.chownOwner.getModel().setPlaceholderText(params.owner);

    this.disposables.add(
      atom.tooltips.add(this.chownGroup, {
        title: 'Only number can be entered. (Valid GID)',
        placement: 'bottom',
      }),

      atom.tooltips.add(this.chownOwner, {
        title: 'Only number can be entered. (Valid UID)',
        placement: 'bottom',
      }),
    );

    this.checkPermissions();
    this.show();

    $(this).find('.permissions-wrapper input').on('change', () => {
      this.checkPermissions();
    });
  }

  checkPermissions() {
    this.chmod = {
      user: 0,
      group: 0,
      other: 0,
      get toString() {
        return `${this.user}${this.group}${this.other}`;
      },
    };

    const chmods = {
      user: this.permissionUser,
      group: this.permissionGroup,
      other: this.permissionOther,
    };

    Object.keys(chmods).forEach((cKey) => {
      const cItem = chmods[cKey];
      const $inputs = $(cItem).find('input');
      const list = {};

      for (let x = 0; x < $inputs.length; x++) {
        const $this = $($inputs[x]);

        list[$this.attr('data-perm')] = $this.prop('checked');
      }

      Object.keys(list).filter(key => list[key]).forEach((key) => {
        this.chmod[cKey] += this.right[key];
      });
    });

    this.chmodInput.setText(this.chmod.toString);
  }

  checkOwners() {
    const groupText = this.chownGroup.getText();
    const ownerText = this.chownOwner.getText();

    if (groupText === '' && ownerText === '') return;

    const group = groupText || this.chownGroup.getModel().getPlaceholderText();
    const owner = ownerText || this.chownOwner.getModel().getPlaceholderText();

    if (atom.project.remoteftp.info.protocol === 'sftp') {
      if (groupText !== '' || ownerText !== '') {
        this.ftp.client.chown(this.item.remote, owner - 0, group - 0, (response) => {
          if (response && /Permission denied/g) {
            isPermissionDenied(this.item.remote);
          } else if (response) {
            isNoChangeOwnerAndGroup(response);
          }
        });
      }
    } else {
      if (groupText !== '') {
        this.ftp.client.chgrp(this.item.remote, group, (response) => {
          if (response) {
            isNoChangeGroup(response);
          }
        });
      }

      if (ownerText !== '') {
        this.ftp.client.chown(this.item.remote, owner, (response) => {
          if (response) {
            isNoChangeOwner(response);
          }
        });
      }
    }
  }

  confirm() {
    this.hide();

    this.checkOwners();

    this.ftp.client.chmod(this.item.remote, this.chmodInput.getText(), (response) => {
      if (response && /Permission denied/g) {
        isPermissionDenied(this.item.remote);
      } else if (response) {
        console.error(response);
      }
    });
    this.item.parent.open(); // Refresh

    this.checkPermissions();
    this.destroy();
  }

  cancel() {
    this.hide();
    this.destroy();
  }

  show() {
    this.panel = atom.workspace.addModalPanel({ item: this });
    this.panel.show();
  }

  hide() {
    if (this.panel) {
      this.panel.hide();
    }
  }

  destroy() {
    this.disposables.dispose();
    this.remove();
  }
}

export default PermissionView;
