// Arabic Normalizer in TypeScript
export class ArabicNormalizerTS {
  static removeTashkeel(text: string): string {
    return text.replace(/[\u0617-\u061A\u064B-\u0652\u0670\u06D6-\u06ED]/g, "");
  }

  static removeTatweel(text: string): string {
    return text.replace(/\u0640/g, "");
  }

  static normalizeCharacters(text: string): string {
    let t = text;
    t = t.replace(/[أإآٱ]/g, "ا");
    t = t.replace(/ى/g, "ي");
    t = t.replace(/ة/g, "ه");
    t = t.replace(/ئ/g, "ي");
    t = t.replace(/ؤ/g, "و");
    return t;
  }

  static cleanPunctuation(text: string): string {
    return text.replace(/[!"#$%&'()*+,-./:;<=>?@[\]\\^_`{|}~،؛؟«»—–\n\r\t]/g, " ");
  }

  static normalize(text: string): string {
    if (!text) return "";
    let t = this.removeTashkeel(text);
    t = this.removeTatweel(t);
    t = this.cleanPunctuation(t);
    t = this.normalizeCharacters(t);
    t = t.toLowerCase();
    t = t.replace(/\s+/g, " ").trim();
    return t;
  }

  static tokenize(text: string): string[] {
    const norm = this.normalize(text);
    if (!norm) return [];
    return norm.split(" ").filter(Boolean);
  }
}

// Keyword Matcher in TypeScript
export class KeywordMatcherTS {
  static prefixes = ["ال", "و", "ف", "ب", "ل", "ك", "وال", "فال", "بال", "لل"];

  static matchesToken(token: string, normKw: string): boolean {
    if (token === normKw) return true;
    if (normKw.length >= 3) {
      for (const p of this.prefixes) {
        if (token === p + normKw) return true;
      }
      if (token === normKw + "ي" || token === normKw + "نا" || token === normKw + "ه") {
        return true;
      }
    }
    return false;
  }

  static matchMessage(text: string, activeKeywords: string[]): { isMatch: boolean; matched: string[]; normalized: string; tokens: string[] } {
    if (!text || !activeKeywords.length) {
      return { isMatch: false, matched: [], normalized: "", tokens: [] };
    }

    const normalized = ArabicNormalizerTS.normalize(text);
    const tokens = ArabicNormalizerTS.tokenize(normalized);
    const tokenSet = new Set(tokens);
    const matched: string[] = [];

    for (const kw of activeKeywords) {
      const cleanKw = ArabicNormalizerTS.normalize(kw);
      if (!cleanKw) continue;

      if (cleanKw.includes(" ")) {
        const regex = new RegExp(`(^|\\s)${cleanKw}(\\s|$)`, "i");
        if (regex.test(normalized)) {
          matched.push(kw);
        }
      } else {
        for (const token of tokenSet) {
          if (this.matchesToken(token, cleanKw)) {
            matched.push(kw);
            break;
          }
        }
      }
    }

    return {
      isMatch: matched.length >= 1, // Rule: At least 1 keyword
      matched,
      normalized,
      tokens
    };
  }
}
