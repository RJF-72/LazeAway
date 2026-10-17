// Preload script: exposes a safe, typed API to the renderer via contextBridge.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  LaserApi,
  SerialLogEntry,
  GrblStatus,
  ConnectionState,
  StreamProgress,
} from '../shared/types'
import { CONNECT_BAUD } from '../shared/connectSequence'

function subscribe<T>(channel: string) {
  return (cb: (payload: T) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, payload: T) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

const api: LaserApi = {
  listPorts: () => ipcRenderer.invoke('ports:list'),
  connect: (path, baudRate = CONNECT_BAUD) =>
    ipcRenderer.invoke('serial:connect', path, baudRate),
  disconnect: () => ipcRenderer.invoke('serial:disconnect'),
  isConnected: () => ipcRenderer.invoke('serial:isConnected'),

  send: (line) => ipcRenderer.invoke('serial:send', line),
  sendLines: (lines, gapMs = 30) => ipcRenderer.invoke('serial:sendLines', lines, gapMs),
  sendRealtime: (char) => ipcRenderer.invoke('serial:sendRealtime', char),

  streamStart: (lines) => ipcRenderer.invoke('stream:start', lines),
  streamPause: () => ipcRenderer.invoke('stream:pause'),
  streamResume: () => ipcRenderer.invoke('stream:resume'),
  streamStop: () => ipcRenderer.invoke('stream:stop'),

  onLine: subscribe<SerialLogEntry>('evt:line'),
  onStatus: subscribe<GrblStatus | null>('evt:status'),
  onState: subscribe<ConnectionState>('evt:state'),
  onProgress: subscribe<StreamProgress>('evt:progress'),

  platform: process.platform,
}

contextBridge.exposeInMainWorld('laser', api)
