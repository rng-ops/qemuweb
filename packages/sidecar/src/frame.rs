//! Frame Buffer Management
//!
//! Handles frame data storage and format conversion.

use crate::protocol::{FrameFormat, FrameMetadata};
use thiserror::Error;

/// Frame-related errors
#[derive(Debug, Error)]
pub enum FrameError {
    #[error("Invalid frame dimensions: {width}x{height}")]
    InvalidDimensions { width: u32, height: u32 },

    #[error("Buffer size mismatch: expected {expected}, got {actual}")]
    SizeMismatch { expected: usize, actual: usize },

    #[error("Unsupported format conversion: {from:?} -> {to:?}")]
    UnsupportedConversion { from: FrameFormat, to: FrameFormat },

    #[error("Compression error: {0}")]
    CompressionError(String),
}

/// Frame data container
#[derive(Debug, Clone)]
pub struct Frame {
    pub metadata: FrameMetadata,
    pub data: Vec<u8>,
}

impl Frame {
    /// Create a new frame with the given metadata and data
    pub fn new(metadata: FrameMetadata, data: Vec<u8>) -> Result<Self, FrameError> {
        let expected_size = Self::expected_size(&metadata);
        if let Some(expected) = expected_size {
            if data.len() != expected {
                return Err(FrameError::SizeMismatch {
                    expected,
                    actual: data.len(),
                });
            }
        }
        Ok(Self { metadata, data })
    }

    /// Calculate expected buffer size for metadata
    fn expected_size(metadata: &FrameMetadata) -> Option<usize> {
        let pixels = metadata.width as usize * metadata.height as usize;
        metadata.format.bytes_per_pixel().map(|bpp| pixels * bpp)
    }

    /// Get the raw data as a slice
    pub fn as_bytes(&self) -> &[u8] {
        &self.data
    }

    /// Convert frame to a different format
    pub fn convert(&self, target_format: FrameFormat) -> Result<Frame, FrameError> {
        if self.metadata.format == target_format {
            return Ok(self.clone());
        }

        let new_data = match (self.metadata.format, target_format) {
            (FrameFormat::Rgba, FrameFormat::Rgb565) => {
                self.rgba_to_rgb565()
            }
            (FrameFormat::Rgb565, FrameFormat::Rgba) => {
                self.rgb565_to_rgba()
            }
            (from, to) => {
                return Err(FrameError::UnsupportedConversion { from, to });
            }
        };

        let mut new_metadata = self.metadata.clone();
        new_metadata.format = target_format;

        Frame::new(new_metadata, new_data)
    }

    /// Convert RGBA to RGB565
    fn rgba_to_rgb565(&self) -> Vec<u8> {
        let pixel_count = self.data.len() / 4;
        let mut output = Vec::with_capacity(pixel_count * 2);

        for chunk in self.data.chunks_exact(4) {
            let r = chunk[0] as u16;
            let g = chunk[1] as u16;
            let b = chunk[2] as u16;
            // RGB565: 5 bits R, 6 bits G, 5 bits B
            let rgb565: u16 = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
            output.extend_from_slice(&rgb565.to_le_bytes());
        }

        output
    }

    /// Convert RGB565 to RGBA
    fn rgb565_to_rgba(&self) -> Vec<u8> {
        let pixel_count = self.data.len() / 2;
        let mut output = Vec::with_capacity(pixel_count * 4);

        for chunk in self.data.chunks_exact(2) {
            let rgb565 = u16::from_le_bytes([chunk[0], chunk[1]]);
            let r = ((rgb565 >> 11) & 0x1F) as u8;
            let g = ((rgb565 >> 5) & 0x3F) as u8;
            let b = (rgb565 & 0x1F) as u8;
            // Expand to 8-bit
            output.push((r << 3) | (r >> 2));
            output.push((g << 2) | (g >> 4));
            output.push((b << 3) | (b >> 2));
            output.push(255); // Alpha
        }

        output
    }
}

/// Ring buffer for frame management
pub struct FrameBuffer {
    frames: Vec<Option<Frame>>,
    write_index: usize,
    read_index: usize,
    capacity: usize,
}

impl FrameBuffer {
    /// Create a new frame buffer with the given capacity
    pub fn new(capacity: usize) -> Self {
        let mut frames = Vec::with_capacity(capacity);
        frames.resize_with(capacity, || None);
        Self {
            frames,
            write_index: 0,
            read_index: 0,
            capacity,
        }
    }

    /// Push a frame into the buffer
    pub fn push(&mut self, frame: Frame) -> bool {
        self.frames[self.write_index] = Some(frame);
        let prev_write = self.write_index;
        self.write_index = (self.write_index + 1) % self.capacity;

        // Check if we're overwriting unread frames
        if self.write_index == self.read_index && self.frames[prev_write].is_some() {
            // Advance read index - dropping a frame
            self.read_index = (self.read_index + 1) % self.capacity;
            return false; // Indicates a frame was dropped
        }
        true
    }

    /// Pop the next frame from the buffer
    pub fn pop(&mut self) -> Option<Frame> {
        if self.read_index == self.write_index {
            return None;
        }
        let frame = self.frames[self.read_index].take();
        self.read_index = (self.read_index + 1) % self.capacity;
        frame
    }

    /// Check if the buffer is empty
    pub fn is_empty(&self) -> bool {
        self.read_index == self.write_index
    }

    /// Get the number of frames in the buffer
    pub fn len(&self) -> usize {
        if self.write_index >= self.read_index {
            self.write_index - self.read_index
        } else {
            self.capacity - self.read_index + self.write_index
        }
    }

    /// Clear all frames
    pub fn clear(&mut self) {
        for frame in &mut self.frames {
            *frame = None;
        }
        self.read_index = 0;
        self.write_index = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_metadata() -> FrameMetadata {
        FrameMetadata {
            sequence: 0,
            timestamp: 0.0,
            width: 2,
            height: 2,
            format: FrameFormat::Rgba,
            keyframe: true,
        }
    }

    #[test]
    fn test_frame_creation() {
        let metadata = test_metadata();
        let data = vec![0u8; 16]; // 2x2 RGBA = 16 bytes
        let frame = Frame::new(metadata, data).unwrap();
        assert_eq!(frame.as_bytes().len(), 16);
    }

    #[test]
    fn test_frame_size_mismatch() {
        let metadata = test_metadata();
        let data = vec![0u8; 8]; // Wrong size
        let result = Frame::new(metadata, data);
        assert!(matches!(result, Err(FrameError::SizeMismatch { .. })));
    }

    #[test]
    fn test_rgba_to_rgb565() {
        let metadata = test_metadata();
        // White pixel in RGBA: [255, 255, 255, 255]
        let data = vec![255u8; 16];
        let frame = Frame::new(metadata, data).unwrap();

        let converted = frame.convert(FrameFormat::Rgb565).unwrap();
        assert_eq!(converted.data.len(), 8); // 2x2 RGB565 = 8 bytes
    }

    #[test]
    fn test_frame_buffer() {
        let mut buffer = FrameBuffer::new(3);
        assert!(buffer.is_empty());

        let metadata = test_metadata();
        for i in 0..3 {
            let mut m = metadata.clone();
            m.sequence = i;
            let frame = Frame::new(m, vec![0u8; 16]).unwrap();
            buffer.push(frame);
        }

        assert_eq!(buffer.len(), 3);

        let frame = buffer.pop().unwrap();
        assert_eq!(frame.metadata.sequence, 0);
        assert_eq!(buffer.len(), 2);
    }
}
