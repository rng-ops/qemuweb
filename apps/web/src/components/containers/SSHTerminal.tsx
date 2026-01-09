/**
 * SSH Terminal Component
 *
 * Terminal interface for connecting to container instances via SSH.
 * Uses xterm.js for terminal emulation with simulated SSH connection.
 * Integrates with credential manager for password auto-fill.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { SSHConfig } from '@qemuweb/vm-config';
import type { Credential, CredentialMatch } from '../../services/credentialService';
import { getCredentialService } from '../../services/credentialService';

interface SSHTerminalProps {
  instanceId: string;
  instanceName: string;
  ipAddress: string;
  sshConfig: SSHConfig;
  onClose: () => void;
  onDisconnect?: () => void;
}

export const SSHTerminal: React.FC<SSHTerminalProps> = ({
  instanceId,
  instanceName,
  ipAddress,
  sshConfig,
  onClose,
  onDisconnect,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [showCredentialPicker, setShowCredentialPicker] = useState(false);
  const [matchingCredentials, setMatchingCredentials] = useState<CredentialMatch[]>([]);
  const inputBuffer = useRef<string>('');
  const currentDir = useRef<string>('/root');
  const authenticated = useRef<boolean>(false);
  const passwordAttempt = useRef<string>('');
  const actualPassword = useRef<string>(sshConfig.defaultPassword || '');

  // Load matching credentials on mount
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const credService = getCredentialService();
        await credService.init();
        const matches = await credService.findMatches({
          targetId: instanceId,
          host: ipAddress,
          port: sshConfig.port,
          username: sshConfig.username,
          type: 'ssh',
        });
        setMatchingCredentials(matches);
        
        // If we have a high-confidence match, use its password
        if (matches.length > 0 && matches[0].score >= 50) {
          actualPassword.current = matches[0].credential.password;
        }
      } catch (err) {
        console.warn('Failed to load credentials:', err);
      }
    };
    loadCredentials();
  }, [instanceId, ipAddress, sshConfig.port, sshConfig.username]);

  const handleSelectCredential = useCallback((credential: Credential) => {
    passwordAttempt.current = credential.password;
    setShowCredentialPicker(false);
    
    // Record usage
    getCredentialService().recordUsage(credential.id).catch(console.warn);
    
    // Type the password into the terminal
    if (terminalInstance.current && !authenticated.current) {
      terminalInstance.current.write('\r\n');
      
      // Simulate successful authentication
      if (credential.password === actualPassword.current) {
        authenticated.current = true;
        setConnected(true);
        showWelcome(terminalInstance.current);
      } else {
        terminalInstance.current.writeln('\x1b[31mPermission denied, please try again.\x1b[0m');
        terminalInstance.current.write(`${sshConfig.username}@${ipAddress}'s password: `);
        passwordAttempt.current = '';
      }
    }
  }, [ipAddress, sshConfig.username]);

  // Simulated filesystem for demo
  const filesystem = useRef<Record<string, string[] | string>>({
    '/': ['bin', 'etc', 'home', 'root', 'tmp', 'usr', 'var', 'opt'],
    '/root': ['.bashrc', '.profile', '.ssh', 'scripts'],
    '/root/.ssh': ['authorized_keys', 'known_hosts'],
    '/root/scripts': ['startup.sh', 'health-check.sh', 'mcp-server.sh'],
    '/etc': ['passwd', 'hosts', 'resolv.conf', 'ssh'],
    '/opt': ['mcp', 'terraform'],
    '/opt/mcp': ['config.json', 'servers'],
    '/opt/terraform': ['main.tf', 'variables.tf', 'outputs.tf'],
  });

  // File contents for demo
  const fileContents = useRef<Record<string, string>>({
    '/root/.bashrc': `# ~/.bashrc
export PS1='\\u@${instanceName}:\\w\\$ '
export PATH=$PATH:/opt/mcp:/opt/terraform
alias ll='ls -la'
`,
    '/root/scripts/startup.sh': `#!/bin/bash
# Container startup script
echo "Starting QemuWeb container..."
/opt/mcp/mcp-server --port 8080 &
echo "MCP server started on port 8080"
`,
    '/root/scripts/health-check.sh': `#!/bin/bash
# Health check script
curl -s http://localhost:8080/health || exit 1
echo "Container is healthy"
`,
    '/opt/mcp/config.json': `{
  "server": {
    "name": "container-mcp",
    "version": "1.0.0",
    "transport": "http",
    "port": 8080
  },
  "capabilities": {
    "tools": true,
    "resources": true,
    "prompts": false
  }
}
`,
    '/opt/terraform/main.tf': `# Terraform configuration for QemuWeb
terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
  }
}

resource "local_file" "config" {
  filename = "/opt/config.json"
  content  = jsonencode({
    container = var.container_name
    memory    = var.memory_mb
  })
}
`,
    '/opt/terraform/variables.tf': `variable "container_name" {
  type        = string
  description = "Name of the container"
  default     = "${instanceName}"
}

variable "memory_mb" {
  type        = number
  description = "Memory allocation in MB"
  default     = 512
}
`,
  });

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#eaeaea',
        cursor: '#eaeaea',
        cursorAccent: '#1a1a2e',
        selectionBackground: '#4f46e5',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      scrollback: 1000,
    });

    fitAddon.current = new FitAddon();
    term.loadAddon(fitAddon.current);
    term.open(terminalRef.current);
    fitAddon.current.fit();

    terminalInstance.current = term;

    // Simulate SSH connection
    term.writeln(`\x1b[32mConnecting to ${sshConfig.username}@${ipAddress}:${sshConfig.port}...\x1b[0m`);
    
    setTimeout(() => {
      term.writeln(`\x1b[33mSSH-2.0-OpenSSH_9.0\x1b[0m`);
      term.writeln('');
      
      if (sshConfig.authMethod === 'password') {
        term.write(`${sshConfig.username}@${ipAddress}'s password: `);
        setConnecting(false);
      } else {
        // Key-based or no auth - connect immediately
        authenticated.current = true;
        setConnecting(false);
        setConnected(true);
        showWelcome(term);
      }
    }, 1000);

    // Handle resize
    const handleResize = () => {
      fitAddon.current?.fit();
    };
    window.addEventListener('resize', handleResize);

    // Handle input
    term.onData((data) => {
      if (!authenticated.current) {
        handlePasswordInput(term, data);
      } else {
        handleCommandInput(term, data);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [ipAddress, sshConfig, instanceName]);

  const handlePasswordInput = (term: Terminal, data: string) => {
    if (data === '\r') {
      // Enter pressed
      term.writeln('');
      
      if (passwordAttempt.current === actualPassword.current) {
        authenticated.current = true;
        setConnected(true);
        showWelcome(term);
      } else {
        term.writeln('\x1b[31mPermission denied, please try again.\x1b[0m');
        term.write(`${sshConfig.username}@${ipAddress}'s password: `);
        passwordAttempt.current = '';
      }
    } else if (data === '\x7f') {
      // Backspace
      if (passwordAttempt.current.length > 0) {
        passwordAttempt.current = passwordAttempt.current.slice(0, -1);
      }
    } else {
      passwordAttempt.current += data;
    }
  };

  const showWelcome = (term: Terminal) => {
    term.writeln('\x1b[32mAuthentication successful.\x1b[0m');
    term.writeln('');
    term.writeln(`Welcome to \x1b[36m${instanceName}\x1b[0m`);
    term.writeln('');
    term.writeln('\x1b[90m * MCP servers: 3 active\x1b[0m');
    term.writeln('\x1b[90m * Terraform: initialized\x1b[0m');
    term.writeln('\x1b[90m * Type "help" for available commands\x1b[0m');
    term.writeln('');
    writePrompt(term);
  };

  const writePrompt = (term: Terminal) => {
    const shortDir = currentDir.current === '/root' ? '~' : currentDir.current;
    term.write(`\x1b[32m${sshConfig.username}@${instanceName}\x1b[0m:\x1b[34m${shortDir}\x1b[0m$ `);
  };

  const handleCommandInput = (term: Terminal, data: string) => {
    if (data === '\r') {
      // Enter pressed
      term.writeln('');
      const command = inputBuffer.current.trim();
      inputBuffer.current = '';
      
      if (command) {
        executeCommand(term, command);
      } else {
        writePrompt(term);
      }
    } else if (data === '\x7f') {
      // Backspace
      if (inputBuffer.current.length > 0) {
        inputBuffer.current = inputBuffer.current.slice(0, -1);
        term.write('\b \b');
      }
    } else if (data === '\x03') {
      // Ctrl+C
      term.writeln('^C');
      inputBuffer.current = '';
      writePrompt(term);
    } else if (data === '\x04') {
      // Ctrl+D
      handleDisconnect();
    } else if (data.charCodeAt(0) >= 32) {
      // Printable characters
      inputBuffer.current += data;
      term.write(data);
    }
  };

  const executeCommand = (term: Terminal, command: string) => {
    const parts = command.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'ls':
        handleLs(term, args);
        break;
      case 'cd':
        handleCd(term, args);
        break;
      case 'cat':
        handleCat(term, args);
        break;
      case 'pwd':
        term.writeln(currentDir.current);
        writePrompt(term);
        break;
      case 'whoami':
        term.writeln(sshConfig.username);
        writePrompt(term);
        break;
      case 'hostname':
        term.writeln(instanceName);
        writePrompt(term);
        break;
      case 'uname':
        term.writeln('Linux qemuweb 5.15.0-wasm #1 SMP x86_64 GNU/Linux');
        writePrompt(term);
        break;
      case 'help':
        handleHelp(term);
        break;
      case 'mcp':
        handleMcp(term, args);
        break;
      case 'terraform':
        handleTerraform(term, args);
        break;
      case 'exit':
      case 'logout':
        handleDisconnect();
        break;
      case 'clear':
        term.clear();
        writePrompt(term);
        break;
      default:
        term.writeln(`\x1b[31m${cmd}: command not found\x1b[0m`);
        writePrompt(term);
    }
  };

  const handleLs = (term: Terminal, args: string[]) => {
    const path = args[0] ? resolvePath(args[0]) : currentDir.current;
    const contents = filesystem.current[path];
    
    if (!contents) {
      term.writeln(`\x1b[31mls: cannot access '${args[0]}': No such file or directory\x1b[0m`);
    } else if (Array.isArray(contents)) {
      const formatted = contents.map((item) => {
        const fullPath = `${path}/${item}`.replace('//', '/');
        const isDir = filesystem.current[fullPath] !== undefined;
        return isDir ? `\x1b[34m${item}/\x1b[0m` : item;
      });
      term.writeln(formatted.join('  '));
    } else {
      term.writeln(args[0] || path);
    }
    writePrompt(term);
  };

  const handleCd = (term: Terminal, args: string[]) => {
    if (!args[0] || args[0] === '~') {
      currentDir.current = '/root';
    } else {
      const newPath = resolvePath(args[0]);
      if (filesystem.current[newPath] && Array.isArray(filesystem.current[newPath])) {
        currentDir.current = newPath;
      } else {
        term.writeln(`\x1b[31mcd: ${args[0]}: No such file or directory\x1b[0m`);
      }
    }
    writePrompt(term);
  };

  const handleCat = (term: Terminal, args: string[]) => {
    if (!args[0]) {
      term.writeln('\x1b[31mcat: missing file operand\x1b[0m');
    } else {
      const path = resolvePath(args[0]);
      const content = fileContents.current[path];
      if (content) {
        term.writeln(content);
      } else {
        term.writeln(`\x1b[31mcat: ${args[0]}: No such file or directory\x1b[0m`);
      }
    }
    writePrompt(term);
  };

  const handleHelp = (term: Terminal) => {
    term.writeln('\x1b[36mAvailable commands:\x1b[0m');
    term.writeln('  ls [path]       - List directory contents');
    term.writeln('  cd [path]       - Change directory');
    term.writeln('  cat <file>      - Display file contents');
    term.writeln('  pwd             - Print working directory');
    term.writeln('  whoami          - Display current user');
    term.writeln('  hostname        - Display hostname');
    term.writeln('  clear           - Clear terminal');
    term.writeln('  mcp <command>   - MCP server management');
    term.writeln('  terraform <cmd> - Terraform operations');
    term.writeln('  exit            - Disconnect from container');
    term.writeln('');
    writePrompt(term);
  };

  const handleMcp = (term: Terminal, args: string[]) => {
    const subCmd = args[0];
    switch (subCmd) {
      case 'list':
      case 'ls':
        term.writeln('\x1b[36mActive MCP Servers:\x1b[0m');
        term.writeln('  \x1b[32m●\x1b[0m filesystem     (stdio)  - File operations');
        term.writeln('  \x1b[32m●\x1b[0m container-mgr  (http)   - Container management');
        term.writeln('  \x1b[32m●\x1b[0m terraform      (stdio)  - Terraform operations');
        break;
      case 'status':
        term.writeln('\x1b[36mMCP Server Status:\x1b[0m');
        term.writeln('  Total servers: 3');
        term.writeln('  Active: 3');
        term.writeln('  Capabilities: 12 tools, 4 resources');
        break;
      default:
        term.writeln('Usage: mcp <list|status|add|remove>');
    }
    writePrompt(term);
  };

  const handleTerraform = (term: Terminal, args: string[]) => {
    const subCmd = args[0];
    switch (subCmd) {
      case 'plan':
        term.writeln('\x1b[36mRunning terraform plan...\x1b[0m');
        term.writeln('');
        term.writeln('Terraform will perform the following actions:');
        term.writeln('');
        term.writeln('  \x1b[32m+\x1b[0m local_file.config');
        term.writeln('      filename = "/opt/config.json"');
        term.writeln('');
        term.writeln('\x1b[36mPlan:\x1b[0m 1 to add, 0 to change, 0 to destroy.');
        break;
      case 'apply':
        term.writeln('\x1b[36mApplying terraform configuration...\x1b[0m');
        term.writeln('');
        term.writeln('local_file.config: Creating...');
        term.writeln('local_file.config: Creation complete');
        term.writeln('');
        term.writeln('\x1b[32mApply complete! Resources: 1 added, 0 changed, 0 destroyed.\x1b[0m');
        break;
      case 'state':
        term.writeln('\x1b[36mTerraform State:\x1b[0m');
        term.writeln('  Resources: 1');
        term.writeln('  - local_file.config');
        break;
      default:
        term.writeln('Usage: terraform <plan|apply|state>');
    }
    writePrompt(term);
  };

  const resolvePath = (path: string): string => {
    if (path.startsWith('/')) {
      return path;
    }
    if (path === '..') {
      const parts = currentDir.current.split('/').filter(Boolean);
      parts.pop();
      return '/' + parts.join('/') || '/';
    }
    if (path === '.') {
      return currentDir.current;
    }
    if (path.startsWith('~')) {
      return '/root' + path.slice(1);
    }
    return `${currentDir.current}/${path}`.replace('//', '/');
  };

  const handleDisconnect = useCallback(() => {
    if (terminalInstance.current) {
      terminalInstance.current.writeln('');
      terminalInstance.current.writeln('\x1b[33mConnection closed.\x1b[0m');
    }
    setConnected(false);
    onDisconnect?.();
  }, [onDisconnect]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-white">
            {sshConfig.username}@{instanceName}
          </span>
          <span className="text-xs text-gray-400">
            ({ipAddress}:{sshConfig.port})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Credential picker button - only show when not authenticated */}
          {!authenticated.current && matchingCredentials.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowCredentialPicker(!showCredentialPicker)}
                className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center gap-1"
                title="Auto-fill password"
              >
                <KeyIcon className="w-3 h-3" />
                Use Saved ({matchingCredentials.length})
              </button>
              {showCredentialPicker && (
                <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[200px] z-50">
                  {matchingCredentials.map((match) => (
                    <button
                      key={match.credential.id}
                      onClick={() => handleSelectCredential(match.credential)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm text-white">{match.credential.name}</div>
                        <div className="text-xs text-gray-400">{match.credential.username}</div>
                      </div>
                      <span className="text-xs text-green-400">{match.score}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <span
            className={`px-2 py-0.5 text-xs rounded ${
              connected ? 'bg-green-600/20 text-green-400' : connecting ? 'bg-yellow-600/20 text-yellow-400' : 'bg-gray-600/20 text-gray-400'
            }`}
          >
            {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}
          </span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded"
            title="Close"
          >
            <CloseIcon className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div ref={terminalRef} className="flex-1 p-2" />
    </div>
  );
};

// Icons
const TerminalIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const KeyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

export default SSHTerminal;
