//! # QemuWeb Sidecar
//!
//! Native sidecar for BrowserQEMU providing:
//! - WebGPU-accelerated frame rendering
//! - Host network bridging
//! - File system access
//! - Native device integration
//!
//! Can be compiled for:
//! - Native (macOS/Linux/Windows) with WebSocket server
//! - WASM with WebGPU for browser-side acceleration

pub mod protocol;
pub mod transport;
pub mod frame;

#[cfg(feature = "native")]
pub mod server;

#[cfg(feature = "wasm")]
pub mod wasm;

// Re-exports
pub use protocol::*;
pub use transport::Transport;
pub use frame::{Frame, FrameBuffer};

/// Sidecar version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Default WebSocket port for native sidecar
pub const DEFAULT_PORT: u16 = 9876;
