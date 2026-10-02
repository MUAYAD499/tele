import re
from typing import List, Tuple, Set, Optional
from backend.app.services.arabic_normalizer import arabic_normalizer


class KeywordMatcher:
    # Common Arabic attachable prefixes (Al-, Wa-, Fa-, Bi-, Li-, Ka-)
    PREFIXES = ["ال", "و", "ف", "ب", "ل", "ك", "وال", "فال", "بال", "لل"]

    @classmethod
    def normalize_keyword(cls, keyword: str) -> str:
        """Normalizes a single keyword string."""
        return arabic_normalizer.normalize(keyword)

    @classmethod
    def matches_token(cls, token: str, normalized_kw: str) -> bool:
        """
        Checks if a normalized token strictly matches a normalized keyword,
        either exact match or with standard Arabic prefixes (e.g. المشروع -> مشروع).
        Avoids random substring matching.
        """
        if token == normalized_kw:
            return True

        # Check prefixed forms if the keyword is not too short (length >= 3)
        if len(normalized_kw) >= 3:
            for prefix in cls.PREFIXES:
                if token == prefix + normalized_kw:
                    return True
                # e.g., plural/suffix forms like مشروعي, واجبات
                if token == normalized_kw + "ي" or token == normalized_kw + "نا" or token == normalized_kw + "ه":
                    return True

        return False

    @classmethod
    def match_message(
        cls,
        text: Optional[str],
        active_keywords: List[str]
    ) -> Tuple[bool, List[str], str]:
        """
        Evaluates message text against the list of active keywords.
        Returns:
            - is_match: True if ANY keyword matches (threshold >= 1)
            - matched_keywords: List of raw/matched keywords found
            - normalized_text: The normalized version of the message
        """
        if not text or not active_keywords:
            return False, [], ""

        normalized_text = arabic_normalizer.normalize(text)
        tokens = set(arabic_normalizer.tokenize(normalized_text))

        if not tokens:
            return False, [], normalized_text

        matched: List[str] = []

        for kw in active_keywords:
            clean_kw = cls.normalize_keyword(kw)
            if not clean_kw:
                continue

            # Multi-word keyword check (e.g., "حل واجب")
            if " " in clean_kw:
                # Regex boundary match
                pattern = r"(?:^|\s)" + re.escape(clean_kw) + r"(?:$|\s)"
                if re.search(pattern, normalized_text):
                    matched.append(kw)
            else:
                # Single token match with word boundary / prefix handling
                for token in tokens:
                    if cls.matches_token(token, clean_kw):
                        matched.append(kw)
                        break

        is_match = len(matched) >= 1
        return is_match, matched, normalized_text


keyword_matcher = KeywordMatcher()
