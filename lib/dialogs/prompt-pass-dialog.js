var __hasProp = {}.hasOwnProperty,
	__extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
	$ = require('atom-space-pen-views').$,
	Dialog = require('./dialog'),
	TextBuffer;

module.exports = PromptPassDialog = (function (parent) {

	__extends(PromptPassDialog, parent);

	function PromptPassDialog () {
		var self = this;
		
		PromptPassDialog.__super__.constructor.call(self, {
			'prompt': "Enter password only for this session:",
			'select': false
		});
		
		
		var passwordModel = self.miniEditor.getModel();
		
		// TODO: TextBuffer should be loaded in line 5 but I can't find proper require
		TextBuffer = passwordModel.buffer.constructor;
		
		passwordModel.clearTextPassword = new TextBuffer('');
		
		var changing = false;
		passwordModel.buffer.onDidChange( function( obj )
		{
			if( !changing )
			{
				changing = true;
				passwordModel.clearTextPassword.setTextInRange( obj.oldRange, obj.newText );
				passwordModel.buffer.setTextInRange( obj.newRange, '*'.repeat( obj.newText.length ) );
				changing = false;
			}
		});
		
		var coreConfirm_listeners = atom.commands.inlineListenersByCommandName[ 'core:confirm'].get( self.element );
		coreConfirm_listeners.splice( 0, coreConfirm_listeners.length );
		
		atom.commands.add(self.element, {
			'core:confirm': function () {
				self.onConfirm( passwordModel.clearTextPassword.getText() );
			}
		});
	}

	PromptPassDialog.prototype.onConfirm = function ( pass ) {
		this.trigger('dialog-done', [pass]);
	}

	return PromptPassDialog;

})(Dialog);
