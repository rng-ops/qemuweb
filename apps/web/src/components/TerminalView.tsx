import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

interface TerminalViewProps {
  output: string[];
  onInput: (data: string) => void;
  isRunning: boolean;
}

export function TerminalView({ output, onInput, isRunning }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastOutputLengthRef = useRef(0);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      theme: {
        background: '#1a1a2e',
        foreground: '#eaeaea',
        cursor: '#22d3ee',
        cursorAccent: '#1a1a2e',
        selectionBackground: '#4f46e5',
        black: '#1a1a2e',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#22d3ee',
        white: '#eaeaea',
        brightBlack: '#4b5563',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      convertEol: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(containerRef.current);

    // Welcome message
    terminal.writeln('\x1b[1;36m╔════════════════════════════════════╗\x1b[0m');
    terminal.writeln('\x1b[1;36m║     \x1b[1;37mQemuWeb Terminal\x1b[1;36m          ║\x1b[0m');
    terminal.writeln('\x1b[1;36m╚════════════════════════════════════╝\x1b[0m');
    terminal.writeln('');
    terminal.writeln('\x1b[90mSelect a VM profile and disk image to begin.\x1b[0m');
    terminal.writeln('');

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, []);

  // Handle terminal input
  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = terminalRef.current;

    const disposable = terminal.onData((data) => {
      if (isRunning) {
        onInput(data);
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [isRunning, onInput]);

  // Write output to terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = terminalRef.current;

    // Only write new output
    const newOutput = output.slice(lastOutputLengthRef.current);
    lastOutputLengthRef.current = output.length;

    for (const line of newOutput) {
      terminal.write(line);
    }
  }, [output]);

  // Clear terminal on new VM start
  useEffect(() => {
    if (isRunning && lastOutputLengthRef.current === 0 && terminalRef.current) {
      terminalRef.current.clear();
      terminalRef.current.writeln('\x1b[1;32m● VM Starting...\x1b[0m');
      terminalRef.current.writeln('');
    }
  }, [isRunning]);

  const handleClear = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.clear();
    }
  }, []);

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Serial Console
          {isRunning && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-900 text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Connected
            </span>
          )}
        </h2>
        <button
          onClick={handleClear}
          className="text-gray-400 hover:text-white text-sm"
        >
          Clear
        </button>
      </div>
      <div
        ref={containerRef}
        className="terminal-container flex-1 min-h-[400px]"
      />
    </div>
  );
}
