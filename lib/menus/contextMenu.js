'use babel';

const init = function INIT() {
  const atom = global.atom;
  const copyEnabled = () => atom.config.get('Remote-FTP.enableCopyFilename');
  const contextMenu = {
    '.remote-ftp-view .entries.list-tree:not(.multi-select) .directory .header': {
      enabled: copyEnabled(),
      command: [{
        label: 'Copy name',
        command: 'remote-ftp:copy-name',
      }, {
        type: 'separator',
      }],
    },
    '.remote-ftp-view .entries.list-tree:not(.multi-select) .file': {
      enabled: copyEnabled(),
      command: [{
        label: 'Copy filename',
        command: 'remote-ftp:copy-name',
      }, {
        type: 'separator',
      }],
    },
  };
  return contextMenu;
};


export default init;
