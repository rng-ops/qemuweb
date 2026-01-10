//! WASM Bindings
//!
//! WebAssembly bindings for running the sidecar in the browser with WebGPU.

use crate::frame::{Frame, FrameBuffer};
use crate::protocol::{
    ConnectionState, EmulatorToSidecarMessage, FrameFormat, FrameMetadata,
    SidecarConfig, SidecarStats, SidecarToEmulatorMessage,
};
use crate::transport::FpsTracker;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{console, MessageEvent, WebSocket};
use std::cell::RefCell;
use std::rc::Rc;

/// Initialize panic hook for better error messages
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
    console::log_1(&"QemuWeb Sidecar WASM initialized".into());
}

/// WASM Sidecar client
#[wasm_bindgen]
pub struct WasmSidecar {
    ws: Option<WebSocket>,
    config: SidecarConfig,
    state: ConnectionState,
    stats: SidecarStats,
    fps_tracker: FpsTracker,
    frame_buffer: FrameBuffer,
    frame_callback: Option<js_sys::Function>,
    state_callback: Option<js_sys::Function>,
    error_callback: Option<js_sys::Function>,
}

#[wasm_bindgen]
impl WasmSidecar {
    /// Create a new WASM sidecar
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            ws: None,
            config: SidecarConfig::default(),
            state: ConnectionState::Disconnected,
            stats: SidecarStats::default(),
            fps_tracker: FpsTracker::new(60),
            frame_buffer: FrameBuffer::new(4),
            frame_callback: None,
            state_callback: None,
            error_callback: None,
        }
    }

    /// Connect to a remote sidecar server
    #[wasm_bindgen]
    pub fn connect(&mut self, url: &str) -> Result<(), JsValue> {
        if self.ws.is_some() {
            return Err(JsValue::from_str("Already connected"));
        }

        self.set_state(ConnectionState::Connecting);

        let ws = WebSocket::new(url)?;
        ws.set_binary_type(web_sys::BinaryType::Arraybuffer);

        // Set up event handlers
        let state_clone = Rc::new(RefCell::new(ConnectionState::Connecting));
        let callback_clone = self.state_callback.clone();

        // onopen
        {
            let state = state_clone.clone();
            let callback = callback_clone.clone();
            let onopen = Closure::wrap(Box::new(move |_: JsValue| {
                *state.borrow_mut() = ConnectionState::Connected;
                if let Some(ref cb) = callback {
                    let _ = cb.call1(&JsValue::NULL, &JsValue::from_str("connected"));
                }
                console::log_1(&"WebSocket connected".into());
            }) as Box<dyn FnMut(JsValue)>);
            ws.set_onopen(Some(onopen.as_ref().unchecked_ref()));
            onopen.forget();
        }

        // onclose
        {
            let state = state_clone.clone();
            let callback = callback_clone.clone();
            let onclose = Closure::wrap(Box::new(move |_: JsValue| {
                *state.borrow_mut() = ConnectionState::Disconnected;
                if let Some(ref cb) = callback {
                    let _ = cb.call1(&JsValue::NULL, &JsValue::from_str("disconnected"));
                }
                console::log_1(&"WebSocket closed".into());
            }) as Box<dyn FnMut(JsValue)>);
            ws.set_onclose(Some(onclose.as_ref().unchecked_ref()));
            onclose.forget();
        }

        // onerror
        {
            let state = state_clone.clone();
            let error_callback = self.error_callback.clone();
            let onerror = Closure::wrap(Box::new(move |e: JsValue| {
                *state.borrow_mut() = ConnectionState::Error;
                if let Some(ref cb) = error_callback {
                    let _ = cb.call1(&JsValue::NULL, &e);
                }
                console::error_1(&"WebSocket error".into());
            }) as Box<dyn FnMut(JsValue)>);
            ws.set_onerror(Some(onerror.as_ref().unchecked_ref()));
            onerror.forget();
        }

        // onmessage
        {
            let frame_callback = self.frame_callback.clone();
            let onmessage = Closure::wrap(Box::new(move |e: MessageEvent| {
                if let Ok(text) = e.data().dyn_into::<js_sys::JsString>() {
                    // JSON message
                    let text: String = text.into();
                    console::log_1(&format!("Received: {}", text).into());
                } else if let Ok(buffer) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
                    // Binary frame data
                    let array = js_sys::Uint8Array::new(&buffer);
                    let len = array.length();
                    console::log_1(&format!("Received {} bytes of frame data", len).into());

                    if let Some(ref cb) = frame_callback {
                        let _ = cb.call1(&JsValue::NULL, &buffer);
                    }
                }
            }) as Box<dyn FnMut(MessageEvent)>);
            ws.set_onmessage(Some(onmessage.as_ref().unchecked_ref()));
            onmessage.forget();
        }

        self.ws = Some(ws);
        Ok(())
    }

    /// Disconnect from the server
    #[wasm_bindgen]
    pub fn disconnect(&mut self) -> Result<(), JsValue> {
        if let Some(ws) = self.ws.take() {
            ws.close()?;
        }
        self.set_state(ConnectionState::Disconnected);
        Ok(())
    }

    /// Send a ping message
    #[wasm_bindgen]
    pub fn ping(&self) -> Result<(), JsValue> {
        let ws = self.ws.as_ref().ok_or_else(|| JsValue::from_str("Not connected"))?;

        let now = js_sys::Date::now();
        let msg = EmulatorToSidecarMessage::Ping { timestamp: now };
        let json = serde_json::to_string(&msg)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        ws.send_with_str(&json)
    }

    /// Set the frame format
    #[wasm_bindgen]
    pub fn set_format(&self, format: &str, width: u32, height: u32) -> Result<(), JsValue> {
        let ws = self.ws.as_ref().ok_or_else(|| JsValue::from_str("Not connected"))?;

        let format = match format {
            "rgba" => FrameFormat::Rgba,
            "rgb565" => FrameFormat::Rgb565,
            "yuv420" => FrameFormat::Yuv420,
            "compressed" => FrameFormat::Compressed,
            _ => return Err(JsValue::from_str("Invalid format")),
        };

        let msg = EmulatorToSidecarMessage::SetFormat { format, width, height };
        let json = serde_json::to_string(&msg)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        ws.send_with_str(&json)
    }

    /// Send frame data
    #[wasm_bindgen]
    pub fn send_frame(&mut self, data: &[u8], width: u32, height: u32, keyframe: bool) -> Result<(), JsValue> {
        let ws = self.ws.as_ref().ok_or_else(|| JsValue::from_str("Not connected"))?;

        let now = js_sys::Date::now();
        self.fps_tracker.record(now);
        self.stats.frames_received += 1;
        self.stats.current_fps = self.fps_tracker.fps();
        self.stats.bytes_transferred += data.len() as u64;

        let metadata = FrameMetadata {
            sequence: self.stats.frames_received,
            timestamp: now,
            width,
            height,
            format: self.config.preferred_format.unwrap_or(FrameFormat::Rgba),
            keyframe,
        };

        // Send metadata
        let msg = EmulatorToSidecarMessage::Frame { metadata };
        let json = serde_json::to_string(&msg)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        ws.send_with_str(&json)?;

        // Send binary data
        ws.send_with_u8_array(data)
    }

    /// Get connection state
    #[wasm_bindgen]
    pub fn get_state(&self) -> String {
        match self.state {
            ConnectionState::Disconnected => "disconnected".to_string(),
            ConnectionState::Connecting => "connecting".to_string(),
            ConnectionState::Connected => "connected".to_string(),
            ConnectionState::Error => "error".to_string(),
        }
    }

    /// Get current FPS
    #[wasm_bindgen]
    pub fn get_fps(&self) -> f64 {
        self.stats.current_fps
    }

    /// Get frames received count
    #[wasm_bindgen]
    pub fn get_frames_received(&self) -> u64 {
        self.stats.frames_received
    }

    /// Get bytes transferred
    #[wasm_bindgen]
    pub fn get_bytes_transferred(&self) -> u64 {
        self.stats.bytes_transferred
    }

    /// Set callback for frame events
    #[wasm_bindgen]
    pub fn on_frame(&mut self, callback: js_sys::Function) {
        self.frame_callback = Some(callback);
    }

    /// Set callback for state changes
    #[wasm_bindgen]
    pub fn on_state_change(&mut self, callback: js_sys::Function) {
        self.state_callback = Some(callback);
    }

    /// Set callback for errors
    #[wasm_bindgen]
    pub fn on_error(&mut self, callback: js_sys::Function) {
        self.error_callback = Some(callback);
    }

    fn set_state(&mut self, state: ConnectionState) {
        self.state = state;
        if let Some(ref cb) = self.state_callback {
            let state_str = match state {
                ConnectionState::Disconnected => "disconnected",
                ConnectionState::Connecting => "connecting",
                ConnectionState::Connected => "connected",
                ConnectionState::Error => "error",
            };
            let _ = cb.call1(&JsValue::NULL, &JsValue::from_str(state_str));
        }
    }
}

impl Default for WasmSidecar {
    fn default() -> Self {
        Self::new()
    }
}

/// Get the sidecar version
#[wasm_bindgen]
pub fn version() -> String {
    crate::VERSION.to_string()
}

/// Check if WebGPU is available
#[wasm_bindgen]
pub async fn check_webgpu() -> bool {
    let window = match web_sys::window() {
        Some(w) => w,
        None => return false,
    };

    let navigator = window.navigator();

    // Check if GPU is available
    let gpu = js_sys::Reflect::get(&navigator, &JsValue::from_str("gpu"));
    match gpu {
        Ok(gpu) => !gpu.is_undefined() && !gpu.is_null(),
        Err(_) => false,
    }
}
