import pytest
from backend.app.services.arabic_normalizer import arabic_normalizer
from backend.app.services.keyword_matcher import keyword_matcher

DEFAULT_KEYWORDS = [
    "يحل",
    "يسوي",
    "فاهم",
    "يشرح",
    "يعرف",
    "مختص",
    "واجب",
    "تكليف",
    "مشروع"
]


class TestArabicNormalizer:
    def test_tashkeel_removal(self):
        text = "هَلْ يُوجَدُ شَخْصٌ يَشْرَحُ لِي هَذَا؟"
        cleaned = arabic_normalizer.remove_tashkeel(text)
        assert "يَ" not in cleaned
        assert cleaned == "هل يوجد شخص يشرح لي هذا؟"

    def test_tatweel_removal(self):
        text = "مشـــــروع واجـــــب"
        cleaned = arabic_normalizer.remove_tatweel(text)
        assert cleaned == "مشروع واجب"

    def test_hamza_normalization(self):
        text = "إختبار أستاذ آفاق ىة"
        normalized = arabic_normalizer.normalize(text)
        assert "اختبار استاذ افاق يه" == normalized

    def test_punctuation_cleaning(self):
        text = "عندي واجب!؟... ومحتاج مساعدة: (ضروري)"
        normalized = arabic_normalizer.normalize(text)
        assert "!" not in normalized
        assert "?" not in normalized
        assert "(" not in normalized
        assert "عندي واجب ومحتاج مساعده ضروري" == normalized


class TestKeywordMatcher:
    # Test 1 from Prompt
    def test_single_keyword_match_true(self):
        """Test 1: 'عندي واجب' -> MATCH = TRUE (keyword: واجب)"""
        msg = "عندي واجب وما فهمت المطلوب."
        is_match, matched, _ = keyword_matcher.match_message(msg, DEFAULT_KEYWORDS)
        assert is_match is True
        assert "واجب" in matched

    # Test 2 from Prompt
    def test_no_keyword_match_false(self):
        """Test 2: 'السلام عليكم جميعًا' -> MATCH = FALSE"""
        msg = "السلام عليكم جميعًا كيف حالكم؟"
        is_match, matched, _ = keyword_matcher.match_message(msg, DEFAULT_KEYWORDS)
        assert is_match is False
        assert len(matched) == 0

    # Test 3 from Prompt
    def test_multiple_keywords_match_true(self):
        """Test 3: 'من يعرف كيف يسوي المشروع؟' -> MATCH = TRUE"""
        msg = "من يعرف كيف يسوي المشروع؟"
        is_match, matched, _ = keyword_matcher.match_message(msg, DEFAULT_KEYWORDS)
        assert is_match is True
        # Should match multiple words
        assert "يعرف" in matched
        assert "يسوي" in matched
        assert "مشروع" in matched

    def test_single_keyword_sufficient_rule(self):
        """Verifies ANY single keyword is enough to forward (OR logic)."""
        msg1 = "هل يوجد شخص يشرح لي هذا؟"
        is_match1, matched1, _ = keyword_matcher.match_message(msg1, DEFAULT_KEYWORDS)
        assert is_match1 is True
        assert matched1 == ["يشرح"]

        msg2 = "محتاج شخص فاهم في المحاسبة"
        is_match2, matched2, _ = keyword_matcher.match_message(msg2, DEFAULT_KEYWORDS)
        assert is_match2 is True
        assert "فاهم" in matched2

    def test_arabic_prefixes(self):
        """Verifies prefixes like 'المشروع' or 'وبالمشروع' match keyword 'مشروع'."""
        msg = "بالنسبة للمشروع المطلوب غداً"
        is_match, matched, _ = keyword_matcher.match_message(msg, DEFAULT_KEYWORDS)
        assert is_match is True
        assert "مشروع" in matched

    def test_disabled_keywords_filter(self):
        """If a keyword is disabled, it shouldn't trigger matching."""
        active_list = ["واجب", "مشروع"]  # 'يسوي' is disabled
        msg = "مين يسوي لي التصميم؟"
        is_match, matched, _ = keyword_matcher.match_message(msg, active_list)
        assert is_match is False
        assert len(matched) == 0
