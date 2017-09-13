'use babel';

import { $, View, TextEditorView } from 'atom-space-pen-views';
import { CompositeDisposable } from 'atom';

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
          this.b('Group: ');
          this.label('', {
            outlet: 'chownGroup',
          });

          this.b('Owner: ');
          this.label('', {
            outlet: 'chownOwner',
          });
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
    this.ftp = atom.project['remoteftp-main'];
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

    this.chownGroup.html(params.group);
    this.chownOwner.html(params.owner);

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

  confirm() {
    this.hide();

    const command = `CHMOD ${this.chmodInput.getText()} ${this.item.remote}`;

    this.ftp.client.site(command);
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
