'use babel';

import Dialog from './dialog';

export default class NavigateTo extends Dialog {

  constructor() {
    super({
      prompt: 'Enter the path to navigate to.',
      initialPath: '/',
      select: false,
      iconClass: 'icon-file-directory',
    });
  }

  onConfirm(path) {
    this.trigger('navigate-to', path);
  }

}
