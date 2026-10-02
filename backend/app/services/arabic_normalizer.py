import re
import unicodedata
from typing import List, Set


class ArabicNormalizer:
    # Arabic Tashkeel / Harakat regex pattern
    TASHKEEL_PATTERN = re.compile(r"[\u0617-\u061A\u064B-\u0652\u0670\u06D6-\u06ED]")
    # Tatweel (Kashida)
    TATWEEL_PATTERN = re.compile(r"\u0640")
    # Punctuation & symbols (Arabic and Latin)
    PUNCTUATION_PATTERN = re.compile(r"[!\"#$%&'()*+,-./:;<=>?@\[\]\\^_`{|}~،؛؟«»—–\n\r\t]")
    # Multi-spaces
    WHITESPACE_PATTERN = re.compile(r"\s+")

    @classmethod
    def remove_tashkeel(cls, text: str) -> str:
        """Removes all Arabic diacritical marks (harakat/tashkeel)."""
        if not text:
            return ""
        return cls.TASHKEEL_PATTERN.sub("", text)

    @classmethod
    def remove_tatweel(cls, text: str) -> str:
        """Removes Arabic kashida/tatweel."""
        if not text:
            return ""
        return cls.TATWEEL_PATTERN.sub("", text)

    @classmethod
    def normalize_characters(cls, text: str) -> str:
        """
        Normalizes common variations of Arabic characters:
        - [أإآٱ] -> ا
        - ى -> ي
        - ة -> ه
        - ئ -> ي
        - ؤ -> و
        """
        if not text:
            return ""
        
        # Normalize Unicode representations
        text = unicodedata.normalize("NFKD", text)

        # Hamzas on Alif
        text = re.sub(r"[أإآٱ]", "ا", text)
        # Alef maksura to Yaa
        text = re.sub(r"ى", "ي", text)
        # Taa Marbuta to Haa
        text = re.sub(r"ة", "ه", text)
        # Hamza on Yaa to Yaa
        text = re.sub(r"ئ", "ي", text)
        # Hamza on Waw to Waw
        text = re.sub(r"ؤ", "و", text)
        # Persian/Urdu variants if any
        text = re.sub(r"ك", "ك", text)  # normalize kaf
        text = re.sub(r"ي", "ي", text)

        return text

    @classmethod
    def clean_punctuation(cls, text: str) -> str:
        """Replaces punctuation with space to prevent glued words."""
        if not text:
            return ""
        return cls.PUNCTUATION_PATTERN.sub(" ", text)

    @classmethod
    def normalize(cls, text: str) -> str:
        """
        Comprehensive normalization pipeline for Arabic text:
        1. Remove Tashkeel (harakat)
        2. Remove Tatweel (kashida)
        3. Clean punctuation and replace with spaces
        4. Normalize character shapes (Alif, Yaa, Taa Marbuta, etc.)
        5. Lowercase (for Latin tokens if present)
        6. Collapse multiple whitespaces
        """
        if not text:
            return ""
        
        text = cls.remove_tashkeel(text)
        text = cls.remove_tatweel(text)
        text = cls.clean_punctuation(text)
        text = cls.normalize_characters(text)
        text = text.lower()
        text = cls.WHITESPACE_PATTERN.sub(" ", text).strip()
        return text

    @classmethod
    def tokenize(cls, text: str) -> List[str]:
        """Tokenizes normalized text into distinct words."""
        normalized = cls.normalize(text)
        if not normalized:
            return []
        return [w for w in normalized.split(" ") if w]

    @classmethod
    def get_token_set(cls, text: str) -> Set[str]:
        """Returns a set of unique normalized tokens."""
        return set(cls.tokenize(text))


# Singleton instance
arabic_normalizer = ArabicNormalizer()
