import { File } from 'expo-file-system';
import { NitroModules } from 'react-native-nitro-modules';

type TokenizerConfig = {
  model: {
    type: 'BPE';
    vocab: Record<string, number>;
    merges: string[];
    byte_fallback?: boolean;
    unk_token?: string;
  };
  padding?: {
    strategy?: {
      Fixed?: number;
    };
    pad_id?: number;
  };
};

const DEFAULT_MAX_LEN = 64;
const DEFAULT_PAD_ID = 0;
const DEFAULT_EOS_ID = 1;
const DEFAULT_UNK_ID = 3;

function splitMergedWithPrevious(text: string) {
  const matches = text.match(/[^ ]+ ?/g);
  if (matches) {
    return matches;
  }
  return text.length > 0 ? [text] : [];
}

function getUtf8Bytes(value: string) {
  if (typeof TextEncoder !== 'undefined') {
    return Array.from(new TextEncoder().encode(value));
  }
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 1) {
    const char = encoded[i];
    if (char === '%') {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(char.charCodeAt(0));
    }
  }
  return bytes;
}

export class SiglipTokenizer {
  private vocab: Map<string, number>;
  private merges: Map<string, number>;
  private byteFallback: boolean;
  private unkId: number;
  private padId: number;
  private maxLen: number;

  private constructor(config: TokenizerConfig) {
    this.vocab = new Map(Object.entries(config.model.vocab));
    this.byteFallback = config.model.byte_fallback ?? true;
    this.unkId = this.vocab.get(config.model.unk_token ?? '<unk>') ?? DEFAULT_UNK_ID;
    this.padId = config.padding?.pad_id ?? DEFAULT_PAD_ID;
    this.maxLen = config.padding?.strategy?.Fixed ?? DEFAULT_MAX_LEN;
    this.merges = new Map((config.model.merges ?? []).map((merge, index) => [merge, index]));
  }

  static async load(path: string) {
    const contents = await new File(path).text();
    const config = JSON.parse(contents) as TokenizerConfig;
    return new SiglipTokenizer(config);
  }

  encode(text: string) {
    const segments = splitMergedWithPrevious(text);
    const tokens: number[] = [];

    for (const segment of segments) {
      const bpeTokens = this.applyBpe(segment);
      for (const token of bpeTokens) {
        const id = this.vocab.get(token);
        if (id != null) {
          tokens.push(id);
          continue;
        }

        if (!this.byteFallback) {
          tokens.push(this.unkId);
          continue;
        }

        for (const byte of getUtf8Bytes(token)) {
          const byteToken = `<0x${byte.toString(16).padStart(2, '0').toUpperCase()}>`;
          tokens.push(this.vocab.get(byteToken) ?? this.unkId);
        }
      }
    }

    if (tokens.length >= this.maxLen) {
      const trimmed = tokens.slice(0, this.maxLen - 1);
      trimmed.push(DEFAULT_EOS_ID);
      return trimmed;
    }

    tokens.push(DEFAULT_EOS_ID);
    while (tokens.length < this.maxLen) {
      tokens.push(this.padId);
    }
    return tokens;
  }

  toNativeBuffer(tokens: number[]) {
    const buffer = NitroModules.createNativeArrayBuffer(tokens.length * 8);
    const view = new BigInt64Array(buffer);
    tokens.forEach((token, index) => {
      view[index] = BigInt(token);
    });
    return buffer;
  }

  private applyBpe(segment: string) {
    if (segment.length <= 1) {
      return [segment];
    }

    let tokens = Array.from(segment);
    while (tokens.length > 1) {
      let bestRank = Number.POSITIVE_INFINITY;
      let bestIndex = -1;

      for (let i = 0; i < tokens.length - 1; i += 1) {
        const pairKey = `${tokens[i]} ${tokens[i + 1]}`;
        const rank = this.merges.get(pairKey);
        if (rank != null && rank < bestRank) {
          bestRank = rank;
          bestIndex = i;
        }
      }

      if (bestIndex === -1) {
        break;
      }

      const merged = tokens[bestIndex] + tokens[bestIndex + 1];
      tokens = [...tokens.slice(0, bestIndex), merged, ...tokens.slice(bestIndex + 2)];
    }

    return tokens;
  }
}
