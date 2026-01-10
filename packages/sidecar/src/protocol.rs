//! Sidecar Protocol Types
//!
//! Matches the TypeScript definitions in @qemuweb/sidecar-proto

use serde::{Deserialize, Serialize};

/// Sidecar operating mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SidecarMode {
    Local,
    Remote,
    Disabled,
}

impl Default for SidecarMode {
    fn default() -> Self {
        Self::Local
    }
}

/// Frame format for transmission
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FrameFormat {
    Rgba,
    Rgb565,
    Yuv420,
    Compressed,
}

impl Default for FrameFormat {
    fn default() -> Self {
        Self::Rgba
    }
}

impl FrameFormat {
    /// Bytes per pixel (for uncompressed formats)
    pub fn bytes_per_pixel(&self) -> Option<usize> {
        match self {
            FrameFormat::Rgba => Some(4),
            FrameFormat::Rgb565 => Some(2),
            FrameFormat::Yuv420 => None, // Variable
            FrameFormat::Compressed => None,
        }
    }
}

/// Sidecar connection state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

impl Default for ConnectionState {
    fn default() -> Self {
        Self::Disconnected
    }
}

/// Frame metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameMetadata {
    /// Frame sequence number
    pub sequence: u64,

    /// Timestamp in milliseconds
    pub timestamp: f64,

    /// Frame width in pixels
    pub width: u32,

    /// Frame height in pixels
    pub height: u32,

    /// Pixel format
    pub format: FrameFormat,

    /// Whether this is a keyframe (full frame vs delta)
    pub keyframe: bool,
}

/// Sidecar configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarConfig {
    /// Operating mode
    pub mode: SidecarMode,

    /// Target frame rate (frames per second)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_fps: Option<u32>,

    /// Preferred frame format
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preferred_format: Option<FrameFormat>,

    /// WebSocket URL for remote mode
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_url: Option<String>,

    /// Enable frame compression for remote mode
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enable_compression: Option<bool>,

    /// Ring buffer size in frames (for local mode)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ring_buffer_size: Option<usize>,
}

impl Default for SidecarConfig {
    fn default() -> Self {
        Self {
            mode: SidecarMode::Local,
            target_fps: Some(60),
            preferred_format: Some(FrameFormat::Rgba),
            remote_url: None,
            enable_compression: Some(false),
            ring_buffer_size: Some(4),
        }
    }
}

/// Sidecar statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarStats {
    /// Frames received
    pub frames_received: u64,

    /// Frames dropped
    pub frames_dropped: u64,

    /// Average frame latency in ms
    pub avg_latency: f64,

    /// Current FPS
    pub current_fps: f64,

    /// Total bytes transferred
    pub bytes_transferred: u64,
}

// ============ Protocol Messages ============

/// Messages from Emulator to Sidecar
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EmulatorToSidecarMessage {
    #[serde(rename = "setMode")]
    SetMode {
        mode: SidecarMode,
        #[serde(skip_serializing_if = "Option::is_none")]
        config: Option<SidecarConfig>,
    },

    #[serde(rename = "setFormat")]
    SetFormat {
        format: FrameFormat,
        width: u32,
        height: u32,
    },

    #[serde(rename = "frame")]
    Frame { metadata: FrameMetadata },

    #[serde(rename = "ping")]
    Ping { timestamp: f64 },
}

/// Messages from Sidecar to Emulator
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SidecarToEmulatorMessage {
    #[serde(rename = "modeAck")]
    ModeAck {
        mode: SidecarMode,
        success: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },

    #[serde(rename = "formatAck")]
    FormatAck { format: FrameFormat, success: bool },

    #[serde(rename = "frameAck")]
    FrameAck { sequence: u64, latency: f64 },

    #[serde(rename = "pong")]
    Pong { timestamp: f64, server_time: f64 },

    #[serde(rename = "error")]
    Error { code: String, message: String },
}

/// Combined message type for WebSocket handling
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Message {
    FromEmulator(EmulatorToSidecarMessage),
    FromSidecar(SidecarToEmulatorMessage),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_serialize_ping() {
        let msg = EmulatorToSidecarMessage::Ping { timestamp: 1234.5 };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"type\":\"ping\""));
        assert!(json.contains("\"timestamp\":1234.5"));
    }

    #[test]
    fn test_deserialize_set_mode() {
        let json = r#"{"type":"setMode","mode":"local"}"#;
        let msg: EmulatorToSidecarMessage = serde_json::from_str(json).unwrap();
        match msg {
            EmulatorToSidecarMessage::SetMode { mode, .. } => {
                assert_eq!(mode, SidecarMode::Local);
            }
            _ => panic!("Wrong message type"),
        }
    }

    #[test]
    fn test_frame_format_bytes() {
        assert_eq!(FrameFormat::Rgba.bytes_per_pixel(), Some(4));
        assert_eq!(FrameFormat::Rgb565.bytes_per_pixel(), Some(2));
        assert_eq!(FrameFormat::Compressed.bytes_per_pixel(), None);
    }
}
