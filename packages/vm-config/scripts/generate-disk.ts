#!/usr/bin/env npx ts-node --esm
/**
 * Disk Image Generator Script
 *
 * Creates default disk images with configurable options.
 * Can generate bootable disk images with cloud-init support.
 */
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  DEFAULT_DISK_CONFIGS,
  createDiskConfig,
  generateCloudInitUserData,
  generateCloudInitMetaData,
  generateCloudInitNetworkConfig,
  type DiskImageConfig,
  type CloudInitConfig,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============ CLI Argument Parsing ============

interface GeneratorOptions {
  template: string;
  name?: string;
  size?: number; // GB
  format?: 'qcow2' | 'raw';
  bootable?: boolean;
  output?: string;
  hostname?: string;
  users?: string[];
  packages?: string[];
  cloudInit?: boolean;
  networkCidr?: string;
  gateway?: string;
  dns?: string[];
  sshKeys?: string[];
  runCmd?: string[];
  help?: boolean;
  list?: boolean;
  json?: boolean;
}

function parseArgs(args: string[]): GeneratorOptions {
  const options: GeneratorOptions = {
    template: 'minimal-linux',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '-t':
      case '--template':
        options.template = next;
        i++;
        break;
      case '-n':
      case '--name':
        options.name = next;
        i++;
        break;
      case '-s':
      case '--size':
        options.size = parseInt(next, 10);
        i++;
        break;
      case '-f':
      case '--format':
        options.format = next as 'qcow2' | 'raw';
        i++;
        break;
      case '-b':
      case '--bootable':
        options.bootable = true;
        break;
      case '-o':
      case '--output':
        options.output = next;
        i++;
        break;
      case '--hostname':
        options.hostname = next;
        i++;
        break;
      case '-u':
      case '--user':
        options.users = options.users ?? [];
        options.users.push(next);
        i++;
        break;
      case '-p':
      case '--package':
        options.packages = options.packages ?? [];
        options.packages.push(next);
        i++;
        break;
      case '--cloud-init':
        options.cloudInit = true;
        break;
      case '--network':
        options.networkCidr = next;
        i++;
        break;
      case '--gateway':
        options.gateway = next;
        i++;
        break;
      case '--dns':
        options.dns = options.dns ?? [];
        options.dns.push(next);
        i++;
        break;
      case '--ssh-key':
        options.sshKeys = options.sshKeys ?? [];
        options.sshKeys.push(next);
        i++;
        break;
      case '--run':
        options.runCmd = options.runCmd ?? [];
        options.runCmd.push(next);
        i++;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-l':
      case '--list':
        options.list = true;
        break;
      case '--json':
        options.json = true;
        break;
    }
  }

  return options;
}

// ============ Help Text ============

function printHelp(): void {
  console.log(`
Disk Image Generator for QemuWeb

USAGE:
  npx generate-disk [OPTIONS]

OPTIONS:
  -t, --template <name>    Template to use (default: minimal-linux)
  -n, --name <name>        Disk name
  -s, --size <gb>          Disk size in GB (default: from template)
  -f, --format <fmt>       Format: qcow2, raw (default: qcow2)
  -b, --bootable           Mark disk as bootable
  -o, --output <path>      Output directory (default: ./disk-images)

  CLOUD-INIT OPTIONS:
  --cloud-init             Generate cloud-init configuration
  --hostname <name>        VM hostname
  -u, --user <name>        Add user (can be repeated)
  -p, --package <pkg>      Package to install (can be repeated)
  --network <cidr>         Network CIDR (e.g., 10.0.0.0/24)
  --gateway <ip>           Gateway IP
  --dns <ip>               DNS server (can be repeated)
  --ssh-key <key>          SSH public key (can be repeated)
  --run <cmd>              Command to run on boot (can be repeated)

  OTHER:
  -l, --list               List available templates
  --json                   Output as JSON
  -h, --help               Show this help

TEMPLATES:
  minimal-linux    Minimal Linux system (2GB)
  alpine-base      Alpine Linux base (512MB)
  ubuntu-server    Ubuntu Server LTS (10GB)
  data-disk        Additional data storage (20GB)
  scratch          Temporary scratch disk (1GB)

EXAMPLES:
  # Create a minimal Linux disk
  npx generate-disk -t minimal-linux -n my-vm

  # Create with cloud-init
  npx generate-disk -t alpine-base --cloud-init --hostname myhost -u admin

  # Create data disk
  npx generate-disk -t data-disk -s 50 -n storage

  # Full example with networking
  npx generate-disk -t ubuntu-server \\
    --cloud-init \\
    --hostname webserver \\
    --user admin \\
    --ssh-key "ssh-ed25519 AAAA..." \\
    --package nginx \\
    --package curl \\
    --network 10.0.0.0/24 \\
    --gateway 10.0.0.1 \\
    --dns 8.8.8.8 \\
    --run "systemctl enable nginx"
`);
}

function listTemplates(): void {
  console.log('\nAvailable Disk Templates:\n');

  for (const [id, config] of Object.entries(DEFAULT_DISK_CONFIGS)) {
    const sizeGB = config.sizeBytes
      ? (config.sizeBytes / (1024 * 1024 * 1024)).toFixed(1)
      : 'N/A';
    console.log(`  ${id}`);
    console.log(`    Name: ${config.name}`);
    console.log(`    Size: ${sizeGB} GB`);
    console.log(`    Format: ${config.format ?? 'qcow2'}`);
    console.log(`    Bootable: ${config.bootable ?? false}`);
    if (config.metadata?.description) {
      console.log(`    Description: ${config.metadata.description}`);
    }
    console.log('');
  }
}

// ============ Disk Image Generation ============

async function generateDiskImage(options: GeneratorOptions): Promise<void> {
  // Validate template
  if (!DEFAULT_DISK_CONFIGS[options.template as keyof typeof DEFAULT_DISK_CONFIGS] && options.template !== 'custom') {
    console.error(`Error: Unknown template '${options.template}'`);
    console.error(`Use --list to see available templates`);
    process.exit(1);
  }

  // Create disk configuration
  const diskConfig = createDiskConfig(
    options.template as keyof typeof DEFAULT_DISK_CONFIGS,
    {
      name: options.name,
      format: options.format,
      sizeBytes: options.size ? options.size * 1024 * 1024 * 1024 : undefined,
      bootable: options.bootable,
    }
  );

  // Generate cloud-init if requested
  let cloudInit: CloudInitConfig | undefined;

  if (options.cloudInit) {
    cloudInit = {
      hostname: options.hostname ?? diskConfig.name?.toLowerCase().replace(/\s+/g, '-') ?? 'vm',
      users: (options.users ?? ['admin']).map((name) => ({
        name,
        groups: ['sudo', 'wheel'],
        sudo: 'ALL=(ALL) NOPASSWD:ALL',
        shell: '/bin/sh',
        sshAuthorizedKeys: options.sshKeys ?? [],
        lockPasswd: true,
      })),
      sshAuthorizedKeys: options.sshKeys ?? [],
      packages: options.packages ?? [],
      runcmd: options.runCmd ?? [],
      writeFiles: [],
      network: options.networkCidr
        ? {
            version: 2,
            ethernets: {
              eth0: {
                dhcp4: !options.networkCidr,
                addresses: options.networkCidr ? [`${options.gateway?.replace(/\d+$/, '10') ?? '10.0.0.10'}/24`] : undefined,
                gateway4: options.gateway,
                nameservers: options.dns
                  ? { addresses: options.dns }
                  : { addresses: ['8.8.8.8', '8.8.4.4'] },
              },
            },
          }
        : undefined,
    };

    diskConfig.cloudInit = cloudInit;
  }

  // Create output directory
  const outputDir = options.output ?? join(process.cwd(), 'disk-images');

  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Output files
  const diskId = diskConfig.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const configPath = join(outputDir, `${diskId}.config.json`);

  // Write disk configuration
  await writeFile(configPath, JSON.stringify(diskConfig, null, 2));

  if (options.json) {
    console.log(JSON.stringify(diskConfig, null, 2));
  } else {
    console.log(`\n✅ Disk image configuration generated!\n`);
    console.log(`  ID: ${diskConfig.id}`);
    console.log(`  Name: ${diskConfig.name}`);
    console.log(`  Format: ${diskConfig.format}`);
    console.log(`  Size: ${(diskConfig.sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`);
    console.log(`  Bootable: ${diskConfig.bootable}`);
    console.log(`  Config: ${configPath}`);

    if (cloudInit) {
      // Write cloud-init files
      const userDataPath = join(outputDir, `${diskId}.user-data`);
      const metaDataPath = join(outputDir, `${diskId}.meta-data`);

      await writeFile(userDataPath, generateCloudInitUserData(cloudInit));
      await writeFile(metaDataPath, generateCloudInitMetaData(diskConfig.id, cloudInit.hostname));

      if (cloudInit.network) {
        const networkConfigPath = join(outputDir, `${diskId}.network-config`);
        await writeFile(networkConfigPath, generateCloudInitNetworkConfig(cloudInit.network));
        console.log(`  Network Config: ${networkConfigPath}`);
      }

      console.log(`  User Data: ${userDataPath}`);
      console.log(`  Meta Data: ${metaDataPath}`);
    }

    console.log(`\nTo use this disk, reference it in your infrastructure config:`);
    console.log(`  qemuweb_disk.${diskConfig.name?.toLowerCase().replace(/\s+/g, '_') ?? 'disk'}`);
  }
}

// ============ Main ============

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    return;
  }

  if (options.list) {
    listTemplates();
    return;
  }

  await generateDiskImage(options);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
