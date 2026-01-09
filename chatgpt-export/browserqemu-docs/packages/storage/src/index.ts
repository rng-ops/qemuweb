/**
 * @qemuweb/storage
 *
 * Block device abstraction and IndexedDB overlay storage
 */

// Types
export type {
  BlockDevice,
  BlockRange,
  BlockDeviceStats,
  BlockDeviceOptions,
  HttpBlockDeviceOptions,
  FileBlockDeviceOptions,
  OverlayBlockDeviceOptions,
  OverlaySnapshot,
  OverlayExport,
} from './types.js';

export { DEFAULT_BLOCK_SIZE } from './types.js';

// Block devices
export { FileBlockDevice } from './fileBlockDevice.js';
export { HttpBlockDevice } from './httpBlockDevice.js';
export { CowBlockDevice } from './cowBlockDevice.js';

// IndexedDB overlay
export {
  IndexedDBOverlay,
  deleteVmOverlays,
  listVmsWithOverlays,
} from './indexeddbOverlay.js';

// Atlas Store (Content-Addressed Storage)
export * from './atlasStore/index.js';
