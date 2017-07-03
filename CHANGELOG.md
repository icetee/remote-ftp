# Change Log

## [Unreleased]

## Changed

+ Little ES6 styles
+ Renew config types
+ Simplify config query in attach method
+ Dock option change name
+ Modernize debugger
+ Hide resize-handle in Dock mode
+ Code beautification
+ Skip create folder structure in case permission denied
+ Add notification permission denied
+ Remove duplicate notification
+ Add global OS lib in client.js
+ Remove unnecessary debug lines
+ Clarifying variables
+ Check exists if create folder or file in remote
+ Rewrite .ftpignore

## Fixed

+ Bad version number in new Dock notification
+ Fix [#820](https://github.com/mgrenier/remote-ftp/issues/820) issue, thanks [@robhuska](https://github.com/robhuska)
+ Fix bad watch paths [#724](https://github.com/mgrenier/remote-ftp/issues/724)
+ 421 Timeout issue [#591](https://github.com/mgrenier/remote-ftp/issues/591)
+ Fix invalid getFileName [#840](https://github.com/mgrenier/remote-ftp/issues/840)
+ Fix editor.getPath is not a function [#810](https://github.com/mgrenier/remote-ftp/issues/810)
+ Auto hide in Info notifications [#767](https://github.com/mgrenier/remote-ftp/issues/767)
+ Fix ENOTDIR issue [#112](https://github.com/mgrenier/remote-ftp/issues/112)
+ Fix checkIgnore parameter

## [1.0.0] - 2017-06-17

## Add

- Supported new [Atom dock](http://blog.atom.io/2017/04/12/atom-1-16.html)
- New setting option (useNewDockIntegration)
- CHANGELOG.md

## Fixed

- Class constructor Connector [(#729)](https://github.com/mgrenier/remote-ftp/pull/731)
- Fix JSON config file not reporting errors [(#738)](https://github.com/mgrenier/remote-ftp/pull/738)
- Fix upload issue Atom 1.7 [(#772)](https://github.com/mgrenier/remote-ftp/pull/772)
- Upload notifications [(#764)](https://github.com/mgrenier/remote-ftp/pull/764)

## Changed

- README
