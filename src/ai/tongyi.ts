interface TongyiOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

class TongyiAI {
  private apiKey: string;
  private model: string;

  constructor(options: TongyiOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'qwen-turbo';
  }

  async generateContent(prompt: string, options?: {
    temperature?: number;
    maxTokens?: number;
    format?: 'text' | 'json';
  }) {
    try {
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          input: {
            prompt: prompt
          },
          parameters: {
            temperature: options?.temperature || 0.7,
            max_tokens: options?.maxTokens || 1000,
            response_format: options?.format === 'json' ? { type: 'json_object' } : { type: 'text' }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        text: data.output?.text || '',
        finishReason: data.output?.finish_reason
      };
    } catch (error) {
      console.error('Tongyi AI generation failed:', error);
      throw error;
    }
  }

  // 生成HS编码
  async generateHSCode(productName: string, imageBase64?: string) {
    let prompt = `Suggest a 10-digit HS Code (Harmonized System Code) for the following construction material: "${productName}". 
The material is used for store construction and decoration.
Return ONLY the 10-digit code as a plain string without any text, punctuation, or formatting. 
If you are unsure, provide the most likely code for construction materials.`;

    if (imageBase64) {
      prompt += `\n\nImage data: ${imageBase64}`;
    }

    const response = await this.generateContent(prompt, {
      temperature: 0.3,
      maxTokens: 50
    });

    return response.text;
  }

  /**
   * 项目地理信息：走服务端全链路（LLM 英文地名抽取 + Nominatim），与 /api/ai/generate-project 一致。
   */
  async generateProjectInfo(description: string) {
    const response = await fetch('/api/ai/generate-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ prompt: description }),
    });
    const json = (await response.json()) as {
      success?: boolean;
      data?: Record<string, unknown>;
      msg?: string;
    };
    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.msg || `generate-project HTTP ${response.status}`);
    }
    return JSON.stringify(json.data);
  }
}

export default TongyiAI;