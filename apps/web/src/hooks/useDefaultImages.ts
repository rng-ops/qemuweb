/**
 * useDefaultImages Hook
 *
 * Initializes default container images in the Atlas Store on first load.
 * Creates the base container and hypervisor images with proper metadata.
 * Generates unique passwords and stores them in the credential manager.
 */

import { useState, useEffect, useCallback } from 'react';
import { createBrowserAtlasStore } from '@qemuweb/storage';
import type { FileMetadata, ManifestType } from '@qemuweb/storage';
import { defaultContainerImages, type ContainerImage } from '@qemuweb/vm-config';
import { getCredentialService, generateSecurePassword } from '../services/credentialService';

interface UseDefaultImagesReturn {
  /** Whether default images are initialized */
  isInitialized: boolean;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Container image metadata files */
  containerFiles: FileMetadata[];
  /** Force re-initialization */
  reinitialize: () => Promise<void>;
}

const INITIALIZED_KEY = 'qemuweb:default-images-initialized';
const INITIALIZED_VERSION = '2.0.0'; // Bumped to force credential creation

export function useDefaultImages(): UseDefaultImagesReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerFiles, setContainerFiles] = useState<FileMetadata[]>([]);

  const initializeImages = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    try {
      // Check if already initialized
      const initVersion = localStorage.getItem(INITIALIZED_KEY);
      if (!force && initVersion === INITIALIZED_VERSION) {
        // Already initialized, just load the files
        const store = await createBrowserAtlasStore();
        const files = await store.listFiles({ type: 'config' });
        const containerConfigs = files.filter((f) => 
          f.name.startsWith('container-') && f.name.endsWith('.json')
        );
        setContainerFiles(containerConfigs);
        setIsInitialized(true);
        setLoading(false);
        return;
      }

      const store = await createBrowserAtlasStore();
      const createdFiles: FileMetadata[] = [];
      const credentialService = getCredentialService();
      await credentialService.init();

      // Generate unique passwords for each container and store credentials
      const containerPasswords: Map<string, string> = new Map();
      
      for (const image of defaultContainerImages) {
        // Generate a unique password for this container
        const password = generateSecurePassword(20);
        containerPasswords.set(image.id, password);
        
        // Store credential in the credential manager
        await credentialService.create({
          name: `${image.name} SSH`,
          type: 'ssh',
          targetId: image.id,
          host: '10.0.0.10', // Default container IP
          port: image.ssh.port,
          username: image.ssh.username,
          password,
          tags: ['container', 'ssh', 'generated', image.type],
          isGenerated: true,
        });
      }

      // Create container image configuration files
      for (const image of defaultContainerImages) {
        const fileName = `container-${image.id}.json`;
        
        // Check if file already exists
        const existing = await store.getFile(fileName);
        if (existing && !force) {
          createdFiles.push(existing);
          continue;
        }

        // Get the generated password for this container
        const password = containerPasswords.get(image.id) || image.ssh.defaultPassword || 'qemuweb';

        // Create container config JSON with the generated password
        const configJson = JSON.stringify(createContainerConfigManifest(image, password), null, 2);
        const configBuffer = new TextEncoder().encode(configJson).buffer;

        // Store as blob and create manifest
        const blobHash = await store.putBlob(configBuffer);
        const manifestHash = await store.putManifest({
          version: 1,
          type: 'config' as ManifestType,
          totalSize: configBuffer.byteLength,
          chunks: [{ hash: blobHash, offset: 0, size: configBuffer.byteLength }],
          mimeType: 'application/json',
          metadata: {
            containerImage: image.id,
            containerType: image.type,
            version: image.version,
          },
        });

        // Register file
        const fileMetadata = await store.registerFile(fileName, manifestHash, {
          type: 'config',
          mimeType: 'application/json',
          origin: 'built',
          originDetails: 'QemuWeb default container images',
          tags: ['container', image.type, image.arch],
        });

        createdFiles.push(fileMetadata);
      }

      // Create Terraform templates for each container type
      for (const image of defaultContainerImages) {
        if (!image.terraform) continue;

        const tfFileName = `terraform-${image.id}.tf.json`;
        const existing = await store.getFile(tfFileName);
        if (existing && !force) {
          createdFiles.push(existing);
          continue;
        }

        const tfConfig = generateTerraformConfig(image);
        const tfBuffer = new TextEncoder().encode(tfConfig).buffer;

        const blobHash = await store.putBlob(tfBuffer);
        const manifestHash = await store.putManifest({
          version: 1,
          type: 'plan' as ManifestType,
          totalSize: tfBuffer.byteLength,
          chunks: [{ hash: blobHash, offset: 0, size: tfBuffer.byteLength }],
          mimeType: 'application/json',
          metadata: {
            terraform: true,
            containerImage: image.id,
          },
        });

        const fileMetadata = await store.registerFile(tfFileName, manifestHash, {
          type: 'plan',
          mimeType: 'application/json',
          origin: 'generated',
          originDetails: 'Generated from container image',
          tags: ['terraform', 'infrastructure', image.type],
        });

        createdFiles.push(fileMetadata);
      }

      // Mark as initialized
      localStorage.setItem(INITIALIZED_KEY, INITIALIZED_VERSION);
      
      setContainerFiles(createdFiles);
      setIsInitialized(true);
      console.log('[useDefaultImages] Initialized', createdFiles.length, 'default image files');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize default images';
      setError(message);
      console.error('[useDefaultImages] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeImages();
  }, [initializeImages]);

  return {
    isInitialized,
    loading,
    error,
    containerFiles,
    reinitialize: () => initializeImages(true),
  };
}

/**
 * Create a container config manifest from an image definition
 */
function createContainerConfigManifest(image: ContainerImage, password?: string): object {
  return {
    $schema: 'https://qemuweb.dev/schemas/container-config.json',
    version: '1.0',
    container: {
      id: image.id,
      name: image.name,
      version: image.version,
      description: image.description,
      type: image.type,
      arch: image.arch,
    },
    runtime: {
      profileId: image.profileId,
      memoryMiB: image.memoryMiB,
    },
    ssh: {
      ...image.ssh,
      // Use the generated password instead of the default
      defaultPassword: password || image.ssh.defaultPassword,
    },
    ports: image.ports,
    volumes: image.volumes || [],
    environment: image.environment || {},
    mcp: {
      servers: image.mcpServers.map((server) => ({
        name: server.name,
        version: server.version,
        transport: server.transport,
        endpoint: server.endpoint,
        command: server.command,
        enabled: server.enabled,
        autoStart: server.autoStart,
        capabilities: server.capabilities.map((cap) => ({
          id: cap.id,
          name: cap.name,
          category: cap.category,
        })),
      })),
    },
    terraform: image.terraform || null,
    metadata: {
      icon: image.icon,
      tags: image.tags,
      createdAt: image.createdAt.toISOString(),
    },
  };
}

/**
 * Generate Terraform configuration for a container image
 */
function generateTerraformConfig(image: ContainerImage): string {
  const config = {
    terraform: {
      required_providers: {
        local: {
          source: 'hashicorp/local',
          version: '~> 2.4',
        },
        null: {
          source: 'hashicorp/null',
          version: '~> 3.2',
        },
      },
    },
    variable: {
      container_name: {
        type: 'string',
        default: image.name,
        description: 'Container name',
      },
      memory_mb: {
        type: 'number',
        default: image.memoryMiB,
        description: 'Memory allocation in MB',
      },
      enable_ssh: {
        type: 'bool',
        default: true,
        description: 'Enable SSH access',
      },
      enable_mcp: {
        type: 'bool',
        default: true,
        description: 'Enable MCP servers',
      },
    },
    resource: {
      local_file: {
        container_config: {
          filename: '/opt/qemuweb/${var.container_name}/config.json',
          content: JSON.stringify({
            image: image.id,
            memory: '${var.memory_mb}',
            ssh: '${var.enable_ssh}',
            mcp: '${var.enable_mcp}',
          }),
        },
      },
      null_resource: {
        ...Object.fromEntries(
          image.mcpServers.map((server) => [
            `mcp_${server.name.replace(/-/g, '_')}`,
            {
              triggers: {
                server_name: server.name,
                transport: server.transport,
                enabled: '${var.enable_mcp}',
              },
            },
          ])
        ),
      },
    },
    output: {
      container_id: {
        value: image.id,
        description: 'Container image ID',
      },
      config_path: {
        value: '${local_file.container_config.filename}',
        description: 'Path to container configuration',
      },
      mcp_servers: {
        value: image.mcpServers.map((s) => s.name),
        description: 'Configured MCP servers',
      },
    },
  };

  return JSON.stringify(config, null, 2);
}

export default useDefaultImages;
