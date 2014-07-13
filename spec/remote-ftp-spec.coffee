{WorkspaceView} = require 'atom'
RemoteFtp = require '../lib/remote-ftp'

# Use the command `window:run-package-specs` (cmd-alt-ctrl-p) to run specs.
#
# To run a specific `it` or `describe` block add an `f` to the front (e.g. `fit`
# or `fdescribe`). Remove the `f` to unfocus the block.

describe "RemoteFtp", ->
  activationPromise = null

  beforeEach ->
    atom.workspaceView = new WorkspaceView
    activationPromise = atom.packages.activatePackage('remote-ftp')

  describe "when the remote-ftp:toggle event is triggered", ->
    it "attaches and then detaches the view", ->
      expect(atom.workspaceView.find('.remote-ftp')).not.toExist()

      # This is an activation event, triggering it will cause the package to be
      # activated.
      atom.workspaceView.trigger 'remote-ftp:toggle'

      waitsForPromise ->
        activationPromise

      runs ->
        expect(atom.workspaceView.find('.remote-ftp')).toExist()
        atom.workspaceView.trigger 'remote-ftp:toggle'
        expect(atom.workspaceView.find('.remote-ftp')).not.toExist()
