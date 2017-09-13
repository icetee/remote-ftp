'use babel';

import RemoteFTP from '../lib/remote-ftp';

// Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.

describe('RemoteFTP', () => {
  let workspaceElement;
  let activationPromise;

  beforeEach(() => {
    workspaceElement = atom.views.getView(atom.workspace);
    activationPromise = atom.packages.activatePackage('remote-ftp');
  });

  describe('when the remote-ftp:toggle event is triggered', () => {
    it('hides and shows the modal panel', () => {
      // Before the activation event the view is not on the DOM, and no panel
      // has been created
      expect(workspaceElement.querySelector('.remote-ftp-view')).not.toExist();

      // This is an activation event, triggering it will cause the package to be
      // activated.
      atom.commands.dispatch(workspaceElement, 'remote-ftp:toggle');

      waitsForPromise(() => {
        return activationPromise;
      });

      runs(() => {
        expect(workspaceElement.querySelector('.remote-ftp-view')).toExist();

        let treeView = workspaceElement.querySelector('.remote-ftp-view');
        expect(treeView).toExist();

        let rfView = atom.workspace.panelForItem(treeView);
        expect(rfView.isVisible()).toBe(true);
        atom.commands.dispatch(workspaceElement, 'remote-ftp:toggle');
        expect(rfView.isVisible()).toBe(false);
      });
    });
  });

});
