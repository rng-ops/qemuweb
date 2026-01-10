//! QemuWeb Sidecar - Native Binary
//!
//! WebSocket server that accepts connections from browser clients
//! for frame rendering and host integration.

use qemuweb_sidecar::server::{ServerConfig, SidecarServer};
use qemuweb_sidecar::DEFAULT_PORT;
use std::net::SocketAddr;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_target(false)
        .with_thread_ids(false)
        .with_file(false)
        .with_line_number(false)
        .compact()
        .init();

    // Parse command line arguments
    let args: Vec<String> = std::env::args().collect();
    
    let bind_addr: SocketAddr = if args.len() > 1 {
        args[1].parse().unwrap_or_else(|_| {
            eprintln!("Invalid address: {}, using default", args[1]);
            format!("127.0.0.1:{}", DEFAULT_PORT).parse().unwrap()
        })
    } else {
        format!("127.0.0.1:{}", DEFAULT_PORT).parse().unwrap()
    };

    let config = ServerConfig {
        bind_addr,
        max_clients: 10,
        frame_buffer_size: 4,
    };

    println!();
    println!("╔══════════════════════════════════════════════════════════╗");
    println!("║           QemuWeb Sidecar v{}                       ║", qemuweb_sidecar::VERSION);
    println!("╠══════════════════════════════════════════════════════════╣");
    println!("║  WebSocket server for BrowserQEMU                        ║");
    println!("║  Provides frame rendering and host integration           ║");
    println!("╚══════════════════════════════════════════════════════════╝");
    println!();

    let mut server = SidecarServer::new(config);
    server.start().await?;

    info!("Server started on ws://{}", bind_addr);
    info!("Press Ctrl+C to stop");

    // Wait for shutdown signal
    tokio::signal::ctrl_c().await?;

    info!("Shutting down...");
    server.stop().await;

    Ok(())
}
