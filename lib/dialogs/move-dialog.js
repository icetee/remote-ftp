'use babel';

import Dialog from './dialog';

export default class MoveDialog extends Dialog {

  constructor(initialPath, isFile) {
    super({
      prompt: isFile ? 'Enter the new path for the file.' : 'Enter the new path for the folder.',
      initialPath,
      select: true,
      iconClass: isFile ? 'icon-file-add' : 'icon-file-directory-create',
    });

    this.isCreatingFile = isFile;
  }

  onConfirm(absolutePath) {
    this.trigger('path-changed', [absolutePath]);
  }

}
