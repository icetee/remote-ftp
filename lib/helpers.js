"use babel";

export function multipleHostsEnabled() {
  return atom.config.get("Remote-FTP.multipleHosts ( Beta )");
}
