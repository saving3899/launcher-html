/**
 * TokenHandler 클래스
 * 실리태번의 openai.js TokenHandler 클래스와 동일한 구조
 */

class TokenHandler {
    /**
     * @param {(messages: object[] | object, full?: boolean) => Promise<number>} countTokenAsyncFn Function to count tokens
     */
    constructor(countTokenAsyncFn) {
        this.countTokenAsyncFn = countTokenAsyncFn;
        this.counts = {
            'start_chat': 0,
            'prompt': 0,
            'bias': 0,
            'nudge': 0,
            'jailbreak': 0,
            'impersonate': 0,
            'examples': 0,
            'conversation': 0,
        };
    }

    /**
     * Count tokens asynchronously
     * @param {object|object[]} messages - Message or messages to count
     * @param {boolean} [full] - Full count flag
     * @returns {Promise<number>} Token count
     */
    async countAsync(messages, full = false) {
        if (this.countTokenAsyncFn) {
            return await this.countTokenAsyncFn(messages, full);
        }
        // 기본값: tokenCounter 모듈 사용 (한글/영어 정확히 지원)
        try {
            // countTokens, getCurrentModel - 전역 스코프에서 사용
            // promptManager가 없으면 기본 모델 사용
            const model = 'gpt-3.5-turbo'; // 기본값
            return await countTokens(messages, model, full);
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_TOKEN_15008', '토큰 카운팅 오류 (TokenHandler)', error);
            }
            // 폴백: 개선된 추정 방식
            if (Array.isArray(messages)) {
                return messages.reduce((total, msg) => {
                    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                    // 한글/영어 구분 추정
                    let koreanChars = 0;
                    let englishChars = 0;
                    for (let i = 0; i < content.length; i++) {
                        const code = content.charCodeAt(i);
                        if ((code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x3131 && code <= 0x318E)) {
                            koreanChars++;
                        } else {
                            englishChars++;
                        }
                    }
                    return total + Math.ceil(koreanChars * 2.5) + Math.ceil(englishChars / 4);
                }, 0);
            }
            const content = typeof messages.content === 'string' ? messages.content : JSON.stringify(messages.content);
            return Math.ceil(content.length / 4);
        }
    }

    getCounts() {
        return this.counts;
    }

    resetCounts() {
        Object.keys(this.counts).forEach((key) => this.counts[key] = 0);
    }

    setCounts(counts) {
        this.counts = counts;
    }

    uncount(value, type) {
        if (this.counts[type] !== undefined) {
            this.counts[type] = Math.max(0, this.counts[type] - value);
        }
    }

    count(value, type) {
        if (this.counts[type] !== undefined) {
            this.counts[type] += value;
        }
    }

    getTotal() {
        return Object.values(this.counts).reduce((sum, count) => sum + count, 0);
    }
}

