import { Card, CardContent } from '../../components/ui';
import { Badge } from '../../components/ui';

export default function AboutPage() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-6">
          <span className="text-white font-bold text-3xl">Q</span>
        </div>
        <h1 className="text-4xl font-bold text-zinc-100 mb-3">QemuWeb</h1>
        <p className="text-xl text-zinc-400 mb-4">
          Run virtual machines in your browser
        </p>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="primary">v0.1.0</Badge>
          <Badge variant="default">Open Source</Badge>
          <Badge variant="success">MIT License</Badge>
        </div>
      </div>

      {/* Description */}
      <Card>
        <CardContent className="prose prose-invert max-w-none">
          <p className="text-zinc-300 text-lg leading-relaxed">
            QemuWeb brings the power of QEMU virtualization to your web browser. 
            Using WebAssembly and modern web technologies, you can run full virtual 
            machines without installing any software.
          </p>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="text-center py-6">
            <div className="text-blue-400 mb-4 flex justify-center">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
              </svg>
            </div>
            <h3 className="font-semibold text-zinc-100 mb-2">Browser-Based VMs</h3>
            <p className="text-sm text-zinc-400">
              Run QEMU virtual machines entirely in your browser using WebAssembly.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="text-center py-6">
            <div className="text-green-400 mb-4 flex justify-center">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
              </svg>
            </div>
            <h3 className="font-semibold text-zinc-100 mb-2">WebGPU Rendering</h3>
            <p className="text-sm text-zinc-400">
              Hardware-accelerated graphics with WebGPU for smooth VM display.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="text-center py-6">
            <div className="text-purple-400 mb-4 flex justify-center">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <h3 className="font-semibold text-zinc-100 mb-2">Native Sidecar</h3>
            <p className="text-sm text-zinc-400">
              Optional native sidecar for enhanced performance and host integration.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="text-center py-6">
            <div className="text-orange-400 mb-4 flex justify-center">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
            <h3 className="font-semibold text-zinc-100 mb-2">Persistent Storage</h3>
            <p className="text-sm text-zinc-400">
              IndexedDB-backed storage for persistent virtual disk images.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="text-center py-6">
            <div className="text-cyan-400 mb-4 flex justify-center">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <h3 className="font-semibold text-zinc-100 mb-2">Virtual Networking</h3>
            <p className="text-sm text-zinc-400">
              Full networking support with SLIRP for guest internet access.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="text-center py-6">
            <div className="text-pink-400 mb-4 flex justify-center">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <h3 className="font-semibold text-zinc-100 mb-2">Ollama Integration</h3>
            <p className="text-sm text-zinc-400">
              Run local LLMs alongside your VMs with Ollama support.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tech stack */}
      <Card>
        <CardContent className="py-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Built With</h2>
          <div className="flex flex-wrap gap-2">
            {[
              'QEMU',
              'Emscripten',
              'WebAssembly',
              'WebGPU',
              'React',
              'TypeScript',
              'Vite',
              'Tailwind CSS',
              'Rust',
              'Tokio',
              'IndexedDB',
            ].map(tech => (
              <Badge key={tech} variant="default" size="lg">{tech}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Links */}
      <Card>
        <CardContent className="py-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a 
              href="https://github.com/user/browserqemu" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium text-zinc-200">GitHub</p>
                <p className="text-xs text-zinc-500">View source code</p>
              </div>
            </a>
            
            <a 
              href="/qemuweb/docs" 
              className="flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <div>
                <p className="font-medium text-zinc-200">Documentation</p>
                <p className="text-xs text-zinc-500">Read the docs</p>
              </div>
            </a>
            
            <a 
              href="https://discord.gg/qemuweb" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <div>
                <p className="font-medium text-zinc-200">Discord</p>
                <p className="text-xs text-zinc-500">Join the community</p>
              </div>
            </a>
            
            <a 
              href="https://twitter.com/qemuweb" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <div>
                <p className="font-medium text-zinc-200">Twitter / X</p>
                <p className="text-xs text-zinc-500">Follow for updates</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center py-8 text-sm text-zinc-500">
        <p>Made with ❤️ by the QemuWeb team</p>
        <p className="mt-1">© 2024 QemuWeb. MIT License.</p>
      </div>
    </div>
  );
}
