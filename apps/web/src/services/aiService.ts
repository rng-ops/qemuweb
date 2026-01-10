/**
 * AI Service - Ollama + LangChain Integration
 *
 * Provides local AI capabilities for:
 * - Terraform plan generation
 * - Configuration analysis
 * - Diagram generation
 * - Infrastructure recommendations
 */

import { FileMetadata } from '@qemuweb/storage';

// ============ Types ============

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  context?: AIContext;
}

export interface AIContext {
  files?: FileMetadata[];
  activeFile?: FileMetadata;
  fileContents?: Record<string, string>;
  infrastructure?: InfrastructureContext;
}

export interface InfrastructureContext {
  vms?: Array<{ name: string; memory: number; vcpus: number }>;
  networks?: Array<{ name: string; cidr: string }>;
  disks?: Array<{ name: string; size: number }>;
}

export interface AIStreamCallback {
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export interface AIService {
  isAvailable(): Promise<boolean>;
  generate(prompt: string, options?: AIGenerateOptions): Promise<string>;
  generateStream(prompt: string, options?: AIGenerateOptions, callbacks?: AIStreamCallback): Promise<void>;
  chat(messages: AIMessage[], options?: AIGenerateOptions): Promise<string>;
  generateTerraform(description: string, context?: AIContext): Promise<string>;
  generateDiagram(description: string, context?: AIContext): Promise<string>;
  analyzeFile(file: FileMetadata, content: string): Promise<string>;
  suggestFixes(error: string, context?: AIContext): Promise<string>;
}

// ============ Ollama Service ============

const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_TEMPERATURE = 0.7;
const OLLAMA_BASE_URL = 'http://localhost:11434';

export class OllamaService implements AIService {
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl: string = OLLAMA_BASE_URL, defaultModel: string = DEFAULT_MODEL) {
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) throw new Error('Failed to list models');
      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }

  async generate(prompt: string, options?: AIGenerateOptions): Promise<string> {
    const systemPrompt = options?.systemPrompt || this.buildSystemPrompt(options?.context);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        prompt,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
          num_predict: options?.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  async generateStream(
    prompt: string,
    options?: AIGenerateOptions,
    callbacks?: AIStreamCallback
  ): Promise<void> {
    const systemPrompt = options?.systemPrompt || this.buildSystemPrompt(options?.context);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        prompt,
        system: systemPrompt,
        stream: true,
        options: {
          temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
          num_predict: options?.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullResponse = '';

    try {
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        const value = result.value;
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              fullResponse += data.response;
              callbacks?.onToken?.(data.response);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      callbacks?.onComplete?.(fullResponse);
    } catch (error) {
      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async chat(messages: AIMessage[], options?: AIGenerateOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options?.model || this.defaultModel,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        options: {
          temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
          num_predict: options?.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  }

  async generateTerraform(description: string, context?: AIContext): Promise<string> {
    const prompt = `Generate a Terraform-style configuration for QemuWeb based on this description:

${description}

${context?.infrastructure ? this.formatInfrastructureContext(context.infrastructure) : ''}

Requirements:
- Use HCL/Terraform syntax
- Include VM, network, and disk resources as needed
- Add appropriate comments
- Use sensible defaults
- Include variable definitions

Output only the Terraform code, no explanations.`;

    return this.generate(prompt, {
      context,
      temperature: 0.3,
      systemPrompt: TERRAFORM_SYSTEM_PROMPT,
    });
  }

  async generateDiagram(description: string, context?: AIContext): Promise<string> {
    const prompt = `Generate a Mermaid diagram based on this description:

${description}

${context?.infrastructure ? this.formatInfrastructureContext(context.infrastructure) : ''}

Output only the Mermaid code, no explanations. Use appropriate diagram type (flowchart, graph, etc.).`;

    return this.generate(prompt, {
      context,
      temperature: 0.3,
      systemPrompt: DIAGRAM_SYSTEM_PROMPT,
    });
  }

  async analyzeFile(file: FileMetadata, content: string): Promise<string> {
    const prompt = `Analyze this ${file.type} file named "${file.name}":

\`\`\`
${content.slice(0, 4000)}
\`\`\`

Provide:
1. Brief summary of what this file does
2. Key components or sections
3. Any potential issues or improvements
4. Relevant metadata observations`;

    return this.generate(prompt, {
      temperature: 0.5,
    });
  }

  async suggestFixes(error: string, context?: AIContext): Promise<string> {
    const prompt = `Given this error:

${error}

${context?.activeFile ? `File: ${context.activeFile.name} (${context.activeFile.type})` : ''}

Suggest:
1. What caused this error
2. How to fix it
3. Any related issues to check`;

    return this.generate(prompt, {
      context,
      temperature: 0.3,
    });
  }

  private buildSystemPrompt(context?: AIContext): string {
    let prompt = `You are an AI assistant for QemuWeb, a browser-based virtualization platform. You help users with:
- Creating and managing virtual machine configurations
- Writing Terraform-like infrastructure plans
- Analyzing disk images and system files
- Generating network topologies and diagrams
- Debugging VM issues

Be concise, accurate, and helpful.`;

    if (context?.activeFile) {
      prompt += `\n\nCurrent file: ${context.activeFile.name} (${context.activeFile.type})`;
    }

    if (context?.files && context.files.length > 0) {
      prompt += `\n\nAvailable files: ${context.files.map((f) => f.name).join(', ')}`;
    }

    return prompt;
  }

  private formatInfrastructureContext(infra: InfrastructureContext): string {
    const parts: string[] = [];

    if (infra.vms && infra.vms.length > 0) {
      parts.push(`Existing VMs: ${infra.vms.map((v) => `${v.name} (${v.memory}MB, ${v.vcpus} vCPUs)`).join(', ')}`);
    }

    if (infra.networks && infra.networks.length > 0) {
      parts.push(`Networks: ${infra.networks.map((n) => `${n.name} (${n.cidr})`).join(', ')}`);
    }

    if (infra.disks && infra.disks.length > 0) {
      parts.push(`Disks: ${infra.disks.map((d) => `${d.name} (${d.size}GB)`).join(', ')}`);
    }

    return parts.length > 0 ? `Current infrastructure:\n${parts.join('\n')}` : '';
  }
}

// ============ Specialized Prompts ============

const TERRAFORM_SYSTEM_PROMPT = `You are an expert infrastructure engineer specializing in Terraform and virtualization. Generate clean, well-structured HCL code following best practices. Use appropriate resource types for VMs, networks, storage, and other infrastructure components.`;

const DIAGRAM_SYSTEM_PROMPT = `You are an expert at creating technical diagrams using Mermaid syntax. Create clear, well-organized diagrams that effectively communicate system architecture and relationships. Use appropriate diagram types (flowchart, sequence, class, etc.) based on the content.`;

// ============ LangChain Integration ============

/**
 * LangChain-style chain for generating infrastructure
 */
export class InfrastructureChain {
  private ai: AIService;

  constructor(ai: AIService) {
    this.ai = ai;
  }

  /**
   * Generate a complete infrastructure plan from a description
   */
  async generatePlan(description: string): Promise<{
    terraform: string;
    diagram: string;
    summary: string;
  }> {
    // Step 1: Analyze the request
    const analysis = await this.ai.generate(
      `Analyze this infrastructure request and identify the key components needed:
      
${description}

List:
1. Required VMs (with suggested specs)
2. Required networks
3. Required storage
4. Dependencies between components`,
      { temperature: 0.3 }
    );

    // Step 2: Generate Terraform
    const terraform = await this.ai.generateTerraform(
      `${description}\n\nAnalysis:\n${analysis}`
    );

    // Step 3: Generate diagram
    const diagram = await this.ai.generateDiagram(
      `${description}\n\nAnalysis:\n${analysis}`
    );

    // Step 4: Generate summary
    const summary = await this.ai.generate(
      `Summarize this infrastructure plan in 2-3 sentences:

Description: ${description}
Analysis: ${analysis}`,
      { temperature: 0.5 }
    );

    return { terraform, diagram, summary };
  }

  /**
   * Validate and improve existing Terraform
   */
  async validateAndImprove(terraform: string): Promise<{
    isValid: boolean;
    issues: string[];
    improved: string;
  }> {
    const validation = await this.ai.generate(
      `Validate this Terraform configuration and list any issues:

\`\`\`hcl
${terraform}
\`\`\`

Format your response as:
VALID: true/false
ISSUES:
- issue 1
- issue 2
...`,
      { temperature: 0.2 }
    );

    const isValid = validation.toLowerCase().includes('valid: true');
    const issueMatch = validation.match(/ISSUES:\n([\s\S]*)/i);
    const issues = issueMatch
      ? issueMatch[1]
          .split('\n')
          .map((l) => l.replace(/^-\s*/, '').trim())
          .filter(Boolean)
      : [];

    let improved = terraform;
    if (!isValid || issues.length > 0) {
      improved = await this.ai.generate(
        `Improve this Terraform configuration, fixing these issues: ${issues.join(', ')}

\`\`\`hcl
${terraform}
\`\`\`

Output only the improved HCL code.`,
        { temperature: 0.2 }
      );
    }

    return { isValid, issues, improved };
  }
}

// ============ Factory ============

let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new OllamaService();
  }
  return aiServiceInstance;
}

export function createInfrastructureChain(): InfrastructureChain {
  return new InfrastructureChain(getAIService());
}
