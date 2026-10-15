const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('corta', {
  texts: () => ipcRenderer.invoke('texts:get'),
  setLanguage: language => ipcRenderer.invoke('texts:set-language', language),
  open: () => ipcRenderer.invoke('audio:open'),
  initial: () => ipcRenderer.invoke('audio:initial'),
  loadPath: file => ipcRenderer.invoke('audio:drop', file),
  droppedFile: file => ipcRenderer.invoke('audio:drop', webUtils.getPathForFile(file)),
  save: (id, start, end) => ipcRenderer.invoke('audio:save', id, start, end),
  onExternal: callback => {
    const listener = (_event, file) => callback(file);
    ipcRenderer.on('audio:external', listener);
    return () => ipcRenderer.removeListener('audio:external', listener);
  }
});
