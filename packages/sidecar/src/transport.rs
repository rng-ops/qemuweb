//! Transport Layer
//!
//! Abstract transport interface that works across native and WASM builds.

use crate::frame::Frame;
use crate::protocol::{
    ConnectionState, EmulatorToSidecarMessage, FrameFormat, SidecarConfig,
    SidecarStats, SidecarToEmulatorMessage,
};
use std::future::Future;
use std::pin::Pin;
use thiserror::Error;

/// Transport errors
#[derive(Debug, Error)]
pub enum TransportError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Not connected")]
    NotConnected,

    #[error("Send failed: {0}")]
    SendFailed(String),

    #[error("Receive failed: {0}")]
    ReceiveFailed(String),

    #[error("Protocol error: {0}")]
    ProtocolError(String),

    #[error("Timeout")]
    Timeout,
}

/// Callback type for frame events
pub type FrameCallback = Box<dyn Fn(Frame) + Send + Sync>;

/// Callback type for state change events
pub type StateCallback = Box<dyn Fn(ConnectionState) + Send + Sync>;

/// Callback type for error events
pub type ErrorCallback = Box<dyn Fn(TransportError) + Send + Sync>;

/// Transport trait for frame transmission
///
/// This trait is implemented by both native and WASM transports,
/// providing a unified interface for frame communication.
pub trait Transport: Send + Sync {
    /// Get current connection state
    fn state(&self) -> ConnectionState;

    /// Get transport configuration
    fn config(&self) -> &SidecarConfig;

    /// Connect to the transport
    fn connect(&mut self) -> Pin<Box<dyn Future<Output = Result<(), TransportError>> + Send + '_>>;

    /// Disconnect from the transport
    fn disconnect(&mut self) -> Pin<Box<dyn Future<Output = Result<(), TransportError>> + Send + '_>>;

    /// Send a frame
    fn send_frame(&mut self, frame: Frame) -> Pin<Box<dyn Future<Output = Result<(), TransportError>> + Send + '_>>;

    /// Send a message
    fn send_message(
        &mut self,
        msg: SidecarToEmulatorMessage,
    ) -> Pin<Box<dyn Future<Output = Result<(), TransportError>> + Send + '_>>;

    /// Set the frame format
    fn set_format(
        &mut self,
        format: FrameFormat,
        width: u32,
        height: u32,
    ) -> Pin<Box<dyn Future<Output = Result<(), TransportError>> + Send + '_>>;

    /// Get transport statistics
    fn stats(&self) -> SidecarStats;

    /// Process incoming messages (call periodically)
    fn poll(&mut self) -> Option<EmulatorToSidecarMessage>;
}

/// Calculate FPS from timestamps
pub fn calculate_fps(timestamps: &[f64]) -> f64 {
    if timestamps.len() < 2 {
        return 0.0;
    }

    let duration = timestamps[timestamps.len() - 1] - timestamps[0];
    if duration <= 0.0 {
        return 0.0;
    }

    ((timestamps.len() - 1) as f64 * 1000.0) / duration
}

/// FPS tracker
pub struct FpsTracker {
    timestamps: Vec<f64>,
    max_samples: usize,
}

impl FpsTracker {
    pub fn new(max_samples: usize) -> Self {
        Self {
            timestamps: Vec::with_capacity(max_samples),
            max_samples,
        }
    }

    pub fn record(&mut self, timestamp: f64) {
        if self.timestamps.len() >= self.max_samples {
            self.timestamps.remove(0);
        }
        self.timestamps.push(timestamp);
    }

    pub fn fps(&self) -> f64 {
        calculate_fps(&self.timestamps)
    }

    pub fn clear(&mut self) {
        self.timestamps.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_fps() {
        let timestamps: Vec<f64> = vec![0.0, 16.67, 33.33, 50.0];
        let fps = calculate_fps(&timestamps);
        // ~60 FPS
        assert!(fps > 55.0 && fps < 65.0);
    }

    #[test]
    fn test_fps_tracker() {
        let mut tracker = FpsTracker::new(10);
        for i in 0..5 {
            tracker.record(i as f64 * 16.67);
        }
        let fps = tracker.fps();
        assert!(fps > 55.0 && fps < 65.0);
    }
}
