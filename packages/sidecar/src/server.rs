//! Native WebSocket Server
//!
//! Provides a WebSocket server for browser clients to connect to.

use crate::frame::Frame;
use crate::protocol::{
    EmulatorToSidecarMessage, FrameFormat,
    SidecarConfig, SidecarStats, SidecarToEmulatorMessage,
};
use crate::transport::{FpsTracker, TransportError};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, mpsc, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tracing::{debug, error, info, warn};

/// Client connection handle
#[derive(Debug, Clone)]
pub struct ClientId(pub u64);

/// Server configuration
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// Address to bind to
    pub bind_addr: SocketAddr,

    /// Maximum number of clients
    pub max_clients: usize,

    /// Frame buffer size per client
    pub frame_buffer_size: usize,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            bind_addr: "127.0.0.1:9876".parse().unwrap(),
            max_clients: 10,
            frame_buffer_size: 4,
        }
    }
}

/// Represents a connected client
struct Client {
    id: ClientId,
    tx: mpsc::UnboundedSender<Message>,
    config: SidecarConfig,
    stats: SidecarStats,
    fps_tracker: FpsTracker,
    frame_format: FrameFormat,
    frame_width: u32,
    frame_height: u32,
}

/// Shared server state
struct ServerState {
    clients: HashMap<u64, Client>,
    next_client_id: u64,
    config: ServerConfig,
}

impl ServerState {
    fn new(config: ServerConfig) -> Self {
        Self {
            clients: HashMap::new(),
            next_client_id: 1,
            config,
        }
    }

    fn add_client(&mut self, tx: mpsc::UnboundedSender<Message>) -> ClientId {
        let id = ClientId(self.next_client_id);
        self.next_client_id += 1;

        let client = Client {
            id: id.clone(),
            tx,
            config: SidecarConfig::default(),
            stats: SidecarStats::default(),
            fps_tracker: FpsTracker::new(60),
            frame_format: FrameFormat::Rgba,
            frame_width: 640,
            frame_height: 480,
        };

        self.clients.insert(id.0, client);
        id
    }

    fn remove_client(&mut self, id: &ClientId) {
        self.clients.remove(&id.0);
    }
}

/// WebSocket sidecar server
pub struct SidecarServer {
    state: Arc<RwLock<ServerState>>,
    shutdown_tx: Option<broadcast::Sender<()>>,
}

impl SidecarServer {
    /// Create a new server with the given configuration
    pub fn new(config: ServerConfig) -> Self {
        Self {
            state: Arc::new(RwLock::new(ServerState::new(config))),
            shutdown_tx: None,
        }
    }

    /// Start the server
    pub async fn start(&mut self) -> Result<(), TransportError> {
        let state = self.state.read().await;
        let addr = state.config.bind_addr;
        drop(state);

        let listener = TcpListener::bind(addr)
            .await
            .map_err(|e| TransportError::ConnectionFailed(e.to_string()))?;

        info!("Sidecar server listening on {}", addr);

        let (shutdown_tx, _) = broadcast::channel::<()>(1);
        self.shutdown_tx = Some(shutdown_tx.clone());

        let state = self.state.clone();

        tokio::spawn(async move {
            let mut shutdown_rx = shutdown_tx.subscribe();

            loop {
                tokio::select! {
                    result = listener.accept() => {
                        match result {
                            Ok((stream, peer_addr)) => {
                                info!("New connection from {}", peer_addr);
                                let state = state.clone();
                                let shutdown_rx = shutdown_tx.subscribe();
                                tokio::spawn(handle_connection(stream, peer_addr, state, shutdown_rx));
                            }
                            Err(e) => {
                                error!("Accept error: {}", e);
                            }
                        }
                    }
                    _ = shutdown_rx.recv() => {
                        info!("Server shutting down");
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    /// Stop the server
    pub async fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }

    /// Get current client count
    pub async fn client_count(&self) -> usize {
        self.state.read().await.clients.len()
    }

    /// Broadcast a frame to all clients
    pub async fn broadcast_frame(&self, frame: Frame) -> Result<(), TransportError> {
        let state = self.state.read().await;

        let frame_msg = SidecarToEmulatorMessage::FrameAck {
            sequence: frame.metadata.sequence,
            latency: 0.0,
        };

        let json = serde_json::to_string(&frame_msg)
            .map_err(|e| TransportError::SendFailed(e.to_string()))?;

        for client in state.clients.values() {
            // Send metadata as JSON
            if let Err(e) = client.tx.send(Message::Text(json.clone())) {
                warn!("Failed to send to client {}: {}", client.id.0, e);
            }
            // Send frame data as binary
            if let Err(e) = client.tx.send(Message::Binary(frame.data.clone().into())) {
                warn!("Failed to send frame data to client {}: {}", client.id.0, e);
            }
        }

        Ok(())
    }
}

/// Handle a single client connection
async fn handle_connection(
    stream: TcpStream,
    peer_addr: SocketAddr,
    state: Arc<RwLock<ServerState>>,
    mut shutdown_rx: broadcast::Receiver<()>,
) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            error!("WebSocket handshake failed for {}: {}", peer_addr, e);
            return;
        }
    };

    let (ws_tx, mut ws_rx) = ws_stream.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    // Register client
    let client_id = {
        let mut state = state.write().await;
        if state.clients.len() >= state.config.max_clients {
            warn!("Max clients reached, rejecting {}", peer_addr);
            return;
        }
        state.add_client(tx)
    };

    info!("Client {} connected from {}", client_id.0, peer_addr);

    use futures_util::{SinkExt, StreamExt};

    // Spawn task to forward messages to WebSocket
    let mut ws_tx = ws_tx;
    let forward_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_tx.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Process incoming messages
    loop {
        tokio::select! {
            msg = ws_rx.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Err(e) = process_message(&state, &client_id, &text).await {
                            error!("Error processing message from client {}: {}", client_id.0, e);
                        }
                    }
                    Some(Ok(Message::Binary(data))) => {
                        // Handle binary frame data
                        debug!("Received {} bytes of binary data from client {}", data.len(), client_id.0);
                    }
                    Some(Ok(Message::Close(_))) => {
                        info!("Client {} closed connection", client_id.0);
                        break;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        let state = state.read().await;
                        if let Some(client) = state.clients.get(&client_id.0) {
                            let _ = client.tx.send(Message::Pong(data));
                        }
                    }
                    Some(Err(e)) => {
                        error!("WebSocket error for client {}: {}", client_id.0, e);
                        break;
                    }
                    None => break,
                    _ => {}
                }
            }
            _ = shutdown_rx.recv() => {
                info!("Shutting down client {} connection", client_id.0);
                break;
            }
        }
    }

    // Cleanup
    forward_task.abort();
    state.write().await.remove_client(&client_id);
    info!("Client {} disconnected", client_id.0);
}

/// Process a message from a client
async fn process_message(
    state: &Arc<RwLock<ServerState>>,
    client_id: &ClientId,
    text: &str,
) -> Result<(), TransportError> {
    let msg: EmulatorToSidecarMessage = serde_json::from_str(text)
        .map_err(|e| TransportError::ProtocolError(e.to_string()))?;

    let response = match msg {
        EmulatorToSidecarMessage::Ping { timestamp } => {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs_f64()
                * 1000.0;

            Some(SidecarToEmulatorMessage::Pong {
                timestamp,
                server_time: now,
            })
        }

        EmulatorToSidecarMessage::SetMode { mode, config } => {
            let mut state = state.write().await;
            if let Some(client) = state.clients.get_mut(&client_id.0) {
                client.config.mode = mode;
                if let Some(cfg) = config {
                    if let Some(fps) = cfg.target_fps {
                        client.config.target_fps = Some(fps);
                    }
                    if let Some(fmt) = cfg.preferred_format {
                        client.config.preferred_format = Some(fmt);
                    }
                }
            }

            Some(SidecarToEmulatorMessage::ModeAck {
                mode,
                success: true,
                error: None,
            })
        }

        EmulatorToSidecarMessage::SetFormat { format, width, height } => {
            let mut state = state.write().await;
            if let Some(client) = state.clients.get_mut(&client_id.0) {
                client.frame_format = format;
                client.frame_width = width;
                client.frame_height = height;
            }

            Some(SidecarToEmulatorMessage::FormatAck {
                format,
                success: true,
            })
        }

        EmulatorToSidecarMessage::Frame { metadata: _ } => {
            let mut state = state.write().await;
            if let Some(client) = state.clients.get_mut(&client_id.0) {
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs_f64()
                    * 1000.0;

                client.fps_tracker.record(now);
                client.stats.frames_received += 1;
                client.stats.current_fps = client.fps_tracker.fps();
            }

            // Frame data will come as a separate binary message
            None
        }
    };

    if let Some(resp) = response {
        let json = serde_json::to_string(&resp)
            .map_err(|e| TransportError::SendFailed(e.to_string()))?;

        let state = state.read().await;
        if let Some(client) = state.clients.get(&client_id.0) {
            client
                .tx
                .send(Message::Text(json))
                .map_err(|e| TransportError::SendFailed(e.to_string()))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_server_creation() {
        let config = ServerConfig::default();
        let server = SidecarServer::new(config);
        assert_eq!(server.client_count().await, 0);
    }
}
