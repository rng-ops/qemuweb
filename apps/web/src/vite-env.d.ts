/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_QEMU_WASM_URL?: string;
  readonly VITE_QEMU_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
