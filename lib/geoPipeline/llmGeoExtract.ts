import { GEO_EXTRACT_SYSTEM_PROMPT } from './constants.js';
import { parseGeoExtractPayload } from './parseGeoExtract.js';
import type { GeoExtractResult } from './types.js';

function stripJsonFromText(rawText: string): unknown {
  const text = (rawText || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function dashScopeGenerate(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const baseBody = {
    model,
    parameters: {
      temperature: 0.2,
      max_tokens: 512,
      response_format: { type: 'json_object' as const },
    },
  };

  const tryMessages = async () => {
    const response = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...baseBody,
          input: {
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          },
        }),
      },
    );
    return response;
  };

  const tryPromptOnly = async () => {
    const combined = `${system}\n\n【用户输入】\n${user}`;
    const response = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...baseBody,
          input: { prompt: combined },
        }),
      },
    );
    return response;
  };

  let response = await tryMessages();
  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 400 && /message|messages|input/i.test(errText)) {
      response = await tryPromptOnly();
    } else {
      throw new Error(`DashScope ${response.status}: ${errText.slice(0, 240)}`);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DashScope ${response.status}: ${errorText.slice(0, 240)}`);
  }

  const data: { output?: { text?: string } } = await response.json();
  return data?.output?.text || '';
}

/**
 * 模块 A：调用 LLM，将自然语言转为结构化英文城市/国家 JSON。
 */
export async function extractGeoFromNaturalLanguage(userText: string): Promise<GeoExtractResult> {
  const apiKey = process.env.TONGYI_API_KEY || process.env.DASHSCOPE_API_KEY || '';
  if (!apiKey) throw new Error('Missing TONGYI_API_KEY/DASHSCOPE_API_KEY');

  const model = process.env.TONGYI_MODEL || 'qwen-turbo';
  const user = `请根据以下非结构化文本提取地理信息，只输出 JSON：\n\n${userText.trim()}`;

  const rawText = await dashScopeGenerate(apiKey, model, GEO_EXTRACT_SYSTEM_PROMPT, user);
  const parsed = stripJsonFromText(rawText);
  const validated = parseGeoExtractPayload(parsed);
  if (!validated) {
    throw new Error('LLM 输出无法解析为合法地理 JSON');
  }
  return validated;
}
