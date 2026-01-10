import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../../components/ui';
import { Button, Badge, Tabs } from '../../components/ui';

interface SidecarRelease {
  platform: string;
  arch: string;
  filename: string;
  downloadUrl: string;
  size: string;
  sha256?: string;
}

interface SidecarVersion {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
  releases: SidecarRelease[];
}

interface SidecarsManifest {
  latestVersion: string;
  versions: SidecarVersion[];
}

// Mock data - in production this would come from /sidecars.json
const mockManifest: SidecarsManifest = {
  latestVersion: '0.1.0',
  versions: [
    {
      version: '0.1.0',
      releaseDate: '2024-01-15',
      releaseNotes: 'Initial release with WebSocket server and WebGPU rendering support.',
      releases: [
        {
          platform: 'macOS',
          arch: 'aarch64',
          filename: 'qemuweb-sidecar-0.1.0-macos-aarch64',
          downloadUrl: '/downloads/qemuweb-sidecar-0.1.0-macos-aarch64',
          size: '2.4 MB',
          sha256: 'abc123...',
        },
        {
          platform: 'macOS',
          arch: 'x86_64',
          filename: 'qemuweb-sidecar-0.1.0-macos-x86_64',
          downloadUrl: '/downloads/qemuweb-sidecar-0.1.0-macos-x86_64',
          size: '2.6 MB',
          sha256: 'def456...',
        },
        {
          platform: 'Linux',
          arch: 'x86_64',
          filename: 'qemuweb-sidecar-0.1.0-linux-x86_64',
          downloadUrl: '/downloads/qemuweb-sidecar-0.1.0-linux-x86_64',
          size: '3.1 MB',
          sha256: 'ghi789...',
        },
        {
          platform: 'Windows',
          arch: 'x86_64',
          filename: 'qemuweb-sidecar-0.1.0-windows-x86_64.exe',
          downloadUrl: '/downloads/qemuweb-sidecar-0.1.0-windows-x86_64.exe',
          size: '3.4 MB',
          sha256: 'jkl012...',
        },
      ],
    },
  ],
};

const platformIcons: Record<string, React.ReactNode> = {
  macOS: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5c4.687 0 8.5 3.813 8.5 8.5s-3.813 8.5-8.5 8.5S3.5 16.687 3.5 12 7.313 3.5 12 3.5zm-.75 3.5a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V7.75a.75.75 0 0 0-.75-.75z"/>
    </svg>
  ),
  Linux: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 0 0-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 0 0-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 0 1-.004-.021l-.004-.024a1.807 1.807 0 0 1-.15.706.953.953 0 0 1-.213.335.71.71 0 0 0-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 0 1-.22-.253 1.34 1.34 0 0 1-.106-.199c-.057-.149-.024-.32.02-.534.03-.15.09-.297.127-.465.038-.17.063-.353.063-.525v-.02l-.005-.073a.515.515 0 0 0-.063-.27.398.398 0 0 0-.213-.209.49.49 0 0 0-.32-.053.466.466 0 0 0-.3.217c-.074.135-.106.288-.106.468-.001.199.04.378.105.57.063.188.155.365.254.545.098.176.207.342.3.515.093.17.165.355.165.566-.002.199-.062.4-.152.609-.09.199-.197.4-.3.6-.302.535-.61 1.025-.606 1.693.004.134.017.262.037.388-.14.07-.275.13-.407.177-.07.03-.138.048-.204.054-.066.004-.128-.008-.188-.035a.408.408 0 0 1-.151-.114.61.61 0 0 1-.1-.178l-.003-.007c.011-.085.018-.173.018-.263v-.047c0-.131-.011-.262-.023-.386a2.575 2.575 0 0 0-.072-.344c-.063-.199-.152-.395-.273-.599a2.072 2.072 0 0 0-.436-.512c-.078-.066-.165-.124-.263-.166a.704.704 0 0 0-.318-.058c-.072.003-.14.018-.208.05l-.001.002a.463.463 0 0 0-.167.103c-.132.132-.223.326-.214.535.008.199.087.386.197.543.217.311.506.571.754.873.248.3.48.646.6 1.082.063.224.09.46.087.699a2.668 2.668 0 0 1-.082.679 2.66 2.66 0 0 1-.201.526 2.66 2.66 0 0 1-.293.435l.001.002c-.088.133-.166.215-.236.267-.072.053-.129.066-.166.066a.152.152 0 0 1-.09-.028c-.02-.015-.053-.05-.09-.113-.074-.132-.122-.32-.138-.537a2.97 2.97 0 0 1 .001-.463c.013-.166.03-.333.054-.494.047-.333.087-.665.091-1.004 0-.072-.007-.145-.019-.218a.977.977 0 0 0-.091-.275 1.128 1.128 0 0 0-.139-.213 1.072 1.072 0 0 0-.173-.166l-.002-.002c-.062-.044-.128-.081-.195-.106a.576.576 0 0 0-.202-.04.502.502 0 0 0-.206.042c-.062.025-.12.064-.172.115a.659.659 0 0 0-.125.173c-.02.053-.04.11-.054.17a.897.897 0 0 0-.025.214v.007c0 .078.003.155.01.23.015.166.042.32.078.458.035.137.075.259.115.356.04.097.08.168.105.201.026.034.04.047.04.047l-.001.002c-.024.03-.047.058-.069.086-.09.114-.176.251-.238.413a1.17 1.17 0 0 0-.084.444v.03c0 .199.032.396.085.573.053.175.127.328.213.455.086.127.184.226.283.293a.545.545 0 0 0 .294.1c.05 0 .097-.007.14-.019a.4.4 0 0 0 .11-.045l.002-.001c.038-.023.07-.055.097-.093.026-.038.047-.084.06-.137.013-.053.02-.114.02-.18v-.152a.976.976 0 0 0-.02-.178c-.026-.129-.07-.258-.12-.386a2.544 2.544 0 0 0-.159-.337c-.06-.114-.116-.22-.161-.321-.045-.1-.082-.198-.104-.297a.888.888 0 0 1-.024-.292c.007-.084.037-.166.086-.242a.56.56 0 0 1 .17-.171c.07-.046.15-.075.235-.087a.626.626 0 0 1 .251.012c.048.012.091.03.129.052.038.023.07.051.098.084.028.033.05.071.067.114.017.043.03.09.037.14a.702.702 0 0 1 .005.163c-.005.114-.024.226-.055.334a1.92 1.92 0 0 1-.111.302 3.37 3.37 0 0 0-.137.366c-.04.127-.065.261-.065.405 0 .199.047.366.14.505.092.14.22.249.374.331.155.082.334.139.525.175.191.036.392.054.592.054.176 0 .345-.013.499-.036a2.58 2.58 0 0 0 .427-.106c.064-.022.123-.048.179-.077l.002-.002c.021-.012.042-.024.062-.037.124-.08.226-.176.303-.285a.911.911 0 0 0 .14-.31c.024-.106.036-.216.036-.328a1.54 1.54 0 0 0-.042-.361 1.877 1.877 0 0 0-.132-.38 2.8 2.8 0 0 0-.22-.399 4.04 4.04 0 0 0-.293-.399 7.93 7.93 0 0 1-.33-.408c-.106-.14-.2-.283-.28-.43-.162-.296-.264-.608-.264-.947 0-.132.014-.262.042-.39.028-.127.07-.25.126-.366.111-.233.276-.435.477-.6.2-.165.436-.288.692-.369a2.66 2.66 0 0 1 .834-.121c.199 0 .394.023.578.068.184.044.356.11.51.196.308.172.548.415.702.699.155.283.236.6.236.93a1.74 1.74 0 0 1-.046.399c-.03.132-.074.261-.13.386-.112.25-.27.48-.463.69a4.95 4.95 0 0 1-.647.576c-.24.181-.495.345-.75.495z"/>
    </svg>
  ),
  Windows: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
    </svg>
  ),
};

function detectPlatform(): { platform: string; arch: string } {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  
  let os = 'Linux';
  if (userAgent.includes('mac') || platform.includes('mac')) {
    os = 'macOS';
  } else if (userAgent.includes('win') || platform.includes('win')) {
    os = 'Windows';
  }

  // For arch detection, we can use some heuristics
  // ARM Macs report as 'MacIntel' due to Rosetta, so we check for M1/M2 patterns
  let arch = 'x86_64';
  if (os === 'macOS') {
    // Modern approach - check for ARM
    const isARM = navigator.userAgent.includes('ARM') || 
                  (navigator as unknown as { userAgentData?: { platform?: string; architecture?: string } }).userAgentData?.architecture === 'arm';
    if (isARM) {
      arch = 'aarch64';
    }
  }

  return { platform: os, arch };
}

export default function DownloadsPage() {
  const [manifest, setManifest] = useState<SidecarsManifest>(mockManifest);
  const [selectedVersion, setSelectedVersion] = useState(mockManifest.latestVersion);
  const [detectedPlatform, setDetectedPlatform] = useState<{ platform: string; arch: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDetectedPlatform(detectPlatform());
    
    // Fetch from /sidecars.json
    fetch('/qemuweb/sidecars.json')
      .then(r => r.json())
      .then((data: SidecarsManifest) => {
        setManifest(data);
        setSelectedVersion(data.latestVersion);
      })
      .catch(() => {
        // Use mock data as fallback
        console.warn('Failed to fetch sidecars.json, using mock data');
      })
      .finally(() => setLoading(false));
  }, []);

  const currentVersion = manifest.versions.find(v => v.version === selectedVersion);
  const recommendedRelease = currentVersion?.releases.find(
    r => r.platform === detectedPlatform?.platform && r.arch === detectedPlatform?.arch
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-zinc-600 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Downloads</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Download the QemuWeb sidecar for your platform
        </p>
      </div>

      {/* Recommended download */}
      {recommendedRelease && (
        <Card className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-500/30">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
                  {platformIcons[recommendedRelease.platform]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-zinc-100">
                      Recommended for your system
                    </h2>
                    <Badge variant="primary">v{selectedVersion}</Badge>
                  </div>
                  <p className="text-sm text-zinc-400 mt-1">
                    {recommendedRelease.platform} ({recommendedRelease.arch}) • {recommendedRelease.size}
                  </p>
                </div>
              </div>
              <Button 
                size="lg" 
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                }
              >
                Download for {recommendedRelease.platform}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version selector */}
      <Card>
        <CardHeader>All Downloads</CardHeader>
        <CardContent>
          <Tabs
            variant="pills"
            tabs={manifest.versions.map(v => ({
              id: v.version,
              label: (
                <span className="flex items-center gap-2">
                  v{v.version}
                  {v.version === manifest.latestVersion && (
                    <Badge variant="success" size="sm">Latest</Badge>
                  )}
                </span>
              ),
              content: (
                <div className="space-y-4 mt-4">
                  {v.releaseNotes && (
                    <div className="p-3 bg-zinc-800/50 rounded-lg">
                      <p className="text-sm text-zinc-300">{v.releaseNotes}</p>
                      <p className="text-xs text-zinc-500 mt-2">Released {v.releaseDate}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {v.releases.map(release => (
                      <div 
                        key={`${release.platform}-${release.arch}`}
                        className={`p-4 rounded-lg border transition-colors ${
                          release.platform === detectedPlatform?.platform && release.arch === detectedPlatform?.arch
                            ? 'bg-blue-600/10 border-blue-500/50'
                            : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="text-zinc-400">
                              {platformIcons[release.platform]}
                            </div>
                            <div>
                              <p className="font-medium text-zinc-200">{release.platform}</p>
                              <p className="text-xs text-zinc-500">{release.arch}</p>
                            </div>
                          </div>
                          <span className="text-sm text-zinc-400">{release.size}</span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <code className="text-xs text-zinc-500 truncate flex-1 mr-2">
                            {release.filename}
                          </code>
                          <Button size="sm" variant="secondary">
                            Download
                          </Button>
                        </div>
                        
                        {release.sha256 && (
                          <p className="text-xs text-zinc-600 mt-2 font-mono truncate">
                            SHA256: {release.sha256}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ),
            }))}
            defaultTab={selectedVersion}
            onChange={setSelectedVersion}
          />
        </CardContent>
      </Card>

      {/* Installation instructions */}
      <Card>
        <CardHeader>Installation</CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-200 mb-2">macOS / Linux</h3>
              <div className="bg-zinc-950 rounded-md p-3 font-mono text-sm text-zinc-300">
                <p className="text-zinc-500"># Make executable and run</p>
                <p>chmod +x qemuweb-sidecar-*</p>
                <p>./qemuweb-sidecar-*</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-zinc-200 mb-2">Windows</h3>
              <div className="bg-zinc-950 rounded-md p-3 font-mono text-sm text-zinc-300">
                <p className="text-zinc-500"># Run the executable</p>
                <p>.\qemuweb-sidecar-*.exe</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-zinc-200 mb-2">Build from source</h3>
              <div className="bg-zinc-950 rounded-md p-3 font-mono text-sm text-zinc-300">
                <p className="text-zinc-500"># Clone and build with Cargo</p>
                <p>git clone https://github.com/user/browserqemu.git</p>
                <p>cd browserqemu/packages/sidecar</p>
                <p>cargo build --release --features native</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
