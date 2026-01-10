// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
	site: 'https://rng-ops.github.io',
	base: '/qemuweb/docs',
	integrations: [
		starlight({
			title: 'QemuWeb',
			description: 'Run virtual machines entirely in your browser using WebAssembly',
			logo: {
				src: './src/assets/logo-dark.svg',
				replacesTitle: false,
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/rng-ops/qemuweb' },
			],
			customCss: [
				'./src/styles/custom.css',
			],
			// Force dark mode only
			components: {
				ThemeSelect: './src/components/ThemeSelect.astro',
			},
			head: [
				{
					tag: 'meta',
					attrs: {
						property: 'og:image',
						content: 'https://rng-ops.github.io/qemuweb/og-image.png',
					},
				},
				{
					tag: 'meta',
					attrs: {
						property: 'og:title',
						content: 'QemuWeb - Virtual Machines in Your Browser',
					},
				},
				{
					tag: 'script',
					content: `
						// Force dark mode
						document.documentElement.dataset.theme = 'dark';
						localStorage.setItem('starlight-theme', 'dark');
					`,
				},
			],
			editLink: {
				baseUrl: 'https://github.com/rng-ops/qemuweb/edit/main/docs-site/',
			},
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Quick Start', slug: 'getting-started/quick-start' },
						{ label: 'Browser Requirements', slug: 'getting-started/requirements' },
					],
				},
				{
					label: 'Architecture',
					items: [
						{ label: 'Overview', slug: 'architecture/overview' },
						{ label: 'Worker Protocol', slug: 'architecture/worker-protocol' },
						{ label: 'Storage System', slug: 'architecture/storage' },
						{ label: 'Virtual Networking', slug: 'architecture/networking' },
					],
				},
				{
					label: 'Packages',
					items: [
						{ label: '@qemuweb/runtime', slug: 'packages/runtime' },
						{ label: '@qemuweb/storage', slug: 'packages/storage' },
						{ label: '@qemuweb/vm-config', slug: 'packages/vm-config' },
						{ label: '@qemuweb/qemu-wasm', slug: 'packages/qemu-wasm' },
						{ label: '@qemuweb/sidecar-proto', slug: 'packages/sidecar-proto' },
					],
				},
				{
					label: 'AI Integration',
					items: [
						{ label: 'LangGraph Agent', slug: 'ai/langgraph-agent' },
						{ label: 'MCP Servers', slug: 'ai/mcp-servers' },
					],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'QemuClient', slug: 'api/qemu-client' },
						{ label: 'Block Devices', slug: 'api/block-devices' },
						{ label: 'VM Configuration', slug: 'api/vm-config' },
					],
				},
				{
					label: 'Contributing',
					items: [
						{ label: 'Development Setup', slug: 'contributing/setup' },
						{ label: 'Build System', slug: 'contributing/build-system' },
					],
				},
			],
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
			lastUpdated: true,
		}),
		tailwind({ applyBaseStyles: false }),
	],
});
