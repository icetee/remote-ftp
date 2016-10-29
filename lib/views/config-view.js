/*
 * using jQuery's $ and atom's Range
 * and remote-ftp's Client
 */
var View = require('atom-space-pen-views');
var Atom = require('atom');
var Path = require('path');
var multipleHostsEnabled = require("../helpers").multipleHostsEnabled;

module.exports = ConfigView =(function() {
  /*
   * Nothing to do here
   */
  function ConfigView(){

  }

  /*
   * Turn on/off stuff
   */
  ConfigView.prototype.doFriendly = function(editor, stuff){
    stuff.forEach(function(thing){
      if(thing == "watch") doUserFriendlyWatch(editor);
      if(thing == "privatekey") doUserFriendlyPrivateKey(editor);
    });
  }

  /*
   * Finds a regex in an editor, marks it with a and decorartes it with
   * a style cssclass and a special cssclass used as identifier
   */
  function findAndMarkBuffer(editor, regexpk, cssclass){
    // find where the pattern is
    editor.scan(regexpk,  function(argsContainer)  {
      // we invalidate the marker any time anything happens to our match
      var markercandid = editor.markBufferRange(argsContainer.range, {invalidate: 'touch'});
      // new marker, decorate
        /* the ftpconfig-prompt class isn't used for anything else than
         * letting us know that the events are for our markers */
      editor.decorateMarker(markercandid, {type: 'line-number', class: 'ftp-gui-prompt ' + cssclass});
    });
  }

  /*
   * Function works like the function above but
   * it takes a string, finds where it occurs in the match
   * and marks that as a poistion to be used for insertion.
   *
   */
  function findAndMarkPoint(editor, regex, cssclass, str){
    // find where the pattern is
    editor.scan(regex,  function(argsContainer)  {
      // Move the start of the range to the index of str + 1
        /* Here we're going to insert text
         * at the point where str occurs,
         * insert belongs to editor.getBuffer() of type testBuffer()
         * so we must adhere to its api
         */
      textBuf = editor.getBuffer();
      var ind = textBuf.characterIndexForPosition(argsContainer.range.start);
      ind = ind + argsContainer.match[0].indexOf(str) + 1;
      // mark it using text editor's editor.getBuffer() buffer methods
      position = textBuf.positionForCharacterIndex(ind);
      var markercandid = textBuf.markPosition(position, {invalidate: 'touch'});
      editor.decorateMarker(markercandid, {type: 'line-number', class: 'ftp-gui-prompt ' + cssclass});
    });
  }

  /*
   * The function takes in an editor
   * Marks privatekey inputs, adds a file input to atom's body element anytime
   * The marked region is hovered and is responsible
   * for Injecting "privatekey" : "/path/to/key"
   * Note: Some  parts of this function can be modularized
   */
  doUserFriendlyPrivateKey = function(editor){
    gutters = editor.getGutters();
    for (var i = 0; i < gutters.length; i++){
      var gutter = gutters[i];
      if(gutter.name == "line-number"){
        // listen to mouseover on the main gutter
        View.$(atom.views.getView(gutter)).mouseover(function(event){
          /* the ftpconfig-prompt class isn't used for anything else than
           * letting us know that the events are for our markers */
          var target = View.$(event.toElement);
          // TODO: embed input in label
          if(target.hasClass('ftpconfig-pk-prompt')){
            /* the ftpconfig-input-label class is controlled by
             * styles/ftpconfig_prompt.atom-text-editor.less
             * the display:none property allows use to use label's
             * css to control the look of the input */
              // the display:none in the label is a failed
              // the race condition attempt at fixing
            var input = '<label class="ftpconfig-input-label a-top-level-element" style="top:' + (event.clientY-20) +'px;left:' + (event.clientX-25) +'px;">\
                            <input style="display:none" type="file"/>\
                             <span>Browse</span>\
                          </label>'
            var label = View.$(input).appendTo("body");
            inappended = label.find("input");
            // pop the element off the DOM when mousing out
              // TODO: there's currently a race condition where
              // mousing over the box too fast causes this callback not to run
              // maybe because we're appending to the dom before binding this callback? inverstigate (minor priority)
            label.mouseout(function(ev){
              if (isWithinBounds(label,ev)) return;
              this.remove();
            });
            inappended.change(function (){
              var pkMarkers = editor.findMarkers({
                              startBufferRow: target.attr('data-buffer-row'),
                              endBufferRow: target.attr('data-buffer-row')
              });
              // just do one of the privatekeys on this buffer line
              // the package doesn't support multiple pks
              // the loop below can be easily extended to support multipe pks per line
              var path = inappended[0].files[0].path; // just do the first file from the input
              // we don't use forEach here because we want to be able to return;
              for (var i = 0; i < pkMarkers.length; i++){
                var marker = pkMarkers[i];
                if (marker.isValid()){
                  // for The Windows
                  var escapedPath = path.replace(/\\/g, '\\\\');
                  // if it's undoable that might confuse the user
                  editor.setTextInBufferRange(marker.getBufferRange(), '"privatekey":"' + escapedPath + '"', {undo: 'skip'});
                  return; // no point in looking at other markers as mentioned above
                }
              }
              // if we reach this point of execution that means an error occured.
            });
              // failed attempt at fixing race condition
          }
        });
      }
    }
      // TODO: perhaps make the regex and the corresponding output
      // format configurable but maybe not, food for thought
    var regexpk = /\"privatekey\"\s*:\s*\".*\"/g;
    //mark the privatekey inputs, do it on every chance
      // we really only care about just pk input, but /g modifier marks
      // all of them even though package doesn't support multiple pks
    findAndMarkBuffer(editor, regexpk, 'ftpconfig-pk-prompt');
    editor.onDidStopChanging(function(){
      findAndMarkBuffer(editor, regexpk, 'ftpconfig-pk-prompt');
    });
  }
  /*
   * Same function as the above function but appends files instead
   * of changing them
   * This function is capable of adding paths to watch : []
   * but it doesn't check for syntax correctness of the original
   * watch : [] entry
   */
  doUserFriendlyWatch = function(editor){
    gutters = editor.getGutters();
    for (var i = 0; i < gutters.length; i++){
      var gutter = gutters[i];
      if(gutter.name == "line-number"){
        View.$(atom.views.getView(gutter)).mouseover(function(event){
          var target = View.$(event.toElement);
          if(target.hasClass('ftpconfig-watch-prompt')){
            var input = '<div  class="a-top-level-element" style="top:' + (event.clientY-40) +'px;left:' + (event.clientX-50) +'px;display:block;">\
                          <label class="ftpconfig-input-label dirlabel">\
                            <input class="diradder" style="display:none" type="file" webkitdirectory directory multiple>\
                             <span>Add a directory</span>\
                          </label>\
                          <label class="ftpconfig-input-label filelabel">\
                            <input class="fileadder" style="display:none" type="file" multiple>\
                             <span>Add Files</span>\
                          </label>\
                         </div>'
            var thediv = View.$(input).appendTo("body");
            var diradder = thediv.find("input.diradder");
            var fileadder = thediv.find("input.fileadder");
            thediv.mouseout(function(ev){
              if (isWithinBounds(thediv,ev)) return;
              this.remove();
            });
            fileadder.change(function (){
              doChange(editor, target, fileadder);
            });
            diradder.change(function (){
              doChange(editor, target, diradder);
            });
          }
        });
      }
    }
    var regexwatch = /\"watch\"\s*:\s*\[(.|[\r\n])*\]/g;
    findAndMarkPoint(editor, regexwatch, 'ftpconfig-watch-prompt', '[');
    editor.onDidStopChanging(function(){
      findAndMarkPoint(editor, regexwatch, 'ftpconfig-watch-prompt', '[');
    });
  }

  function doChange(editor, target, adder){
    // adhere to editor.getBuffer() textBuffer API
    // as mentioned in findAndMarkPoint
    textBuf = editor.getBuffer();
    var pkMarkers = textBuf.findMarkers({
                    startRow: target.attr('data-buffer-row'),
                    endRow: target.attr('data-buffer-row')
    });
    var projectPath;
    if(multipleHostsEnabled() === true){
      var $selectedDir = $('.tree-view .selected');
      var $currentProject = $selectedDir.hasClass('project-root') ? $selectedDir : $selectedDir.closest('.project-root');
      projectPath = $currentProject.find('.header span.name').data('path');
    }
    else{
      projectPath = atom.project.getDirectories()[0].path;
    }
    for (var i = 0; i < pkMarkers.length; i++){
      var marker = pkMarkers[i];
      if (marker.isValid()){
        var appendThis = "";
        for (var j=0; j < adder[0].files.length; j++){
          var absolutePath = adder[0].files[j].path;
          var RelativePath = "." + Path.sep + Path.relative(projectPath, absolutePath);
          var escapedPath = RelativePath.replace(/\\/g, '\\\\');
          appendThis = appendThis + ' "' +  escapedPath + '",\n\t';
        }
        var startPos = marker.getStartPosition();
        var theRange = new Atom.Range(startPos, textBuf.getEndPosition());
        textBuf.scanInRange(/(?:]|\")/, theRange, function(match){
          var matc = match.matchText;
          var j = 0;
          if (matc == ']'){ // then remove the last comma
            for (var i = 0; i < appendThis.length; i++){
              if (appendThis[i] == ','){
                j = i;
              }
            }
            if  (j!=0) appendThis = replaceCharAt(appendThis, j, "");
          }
          textBuf.insert(startPos, appendThis, {undo: 'skip'});
        });
        return;
      }
    }
  }

  function isWithinBounds(label, ev){
    var lPosition = label.position();
    var width = parseInt(label.css("width").match(/[0-9]*/)[0]);
    var height = parseInt(label.css("height").match(/[0-9]*/)[0]);
    if  ((ev.clientX > lPosition.left && ev.clientX < (lPosition.left + width))
      && (ev.clientY > lPosition.top  && ev.clientY < (lPosition.top  + height))) return true;
    else return false;
  }

  function replaceCharAt(str, index, character) {
    return str.substr(0, index) + character + str.substr(index + 1);
  }
  return ConfigView;
})();
