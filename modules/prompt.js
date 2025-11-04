/**
 * Prompt 클래스
 * 개별 프롬프트를 나타내는 데이터 클래스
 * SillyTavern의 Prompt 클래스 구조를 따름
 */

class Prompt {
    /**
     * @param {Object} data - 프롬프트 데이터
     * @param {string} data.identifier - 프롬프트 고유 식별자 (UUID v4 또는 'main', 'nsfw' 등)
     * @param {string} data.name - 프롬프트 이름
     * @param {string} [data.role='system'] - 역할 ('system', 'user', 'assistant')
     * @param {string} [data.content=''] - 프롬프트 내용
     * @param {number} [data.injection_position=0] - 인젝션 위치 (0=Relative, 1=Absolute)
     * @param {number} [data.injection_depth=4] - 인젝션 깊이
     * @param {number} [data.injection_order=100] - 인젝션 순서
     * @param {string[]} [data.injection_trigger=[]] - 트리거 타입 배열
     * @param {boolean} [data.system_prompt=false] - 시스템 프롬프트 여부
     * @param {boolean} [data.marker=false] - 마커 프롬프트 여부 (자동 생성됨)
     * @param {boolean} [data.forbid_overrides=false] - 오버라이드 금지 여부
     */
    constructor(data = {}) {
        this.identifier = data.identifier || '';
        this.name = data.name || '';
        this.role = data.role || 'system';
        this.content = data.content || '';
        this.injection_position = data.injection_position ?? 0; // 0=Relative, 1=Absolute
        this.injection_depth = data.injection_depth ?? 4;
        this.injection_order = data.injection_order ?? 100;
        this.injection_trigger = Array.isArray(data.injection_trigger) ? data.injection_trigger : [];
        this.system_prompt = data.system_prompt ?? false;
        this.marker = data.marker ?? false;
        this.forbid_overrides = data.forbid_overrides ?? false;
    }

    /**
     * 프롬프트 객체를 JSON으로 직렬화
     * @returns {Object}
     */
    toJSON() {
        return {
            identifier: this.identifier,
            name: this.name,
            role: this.role,
            content: this.content,
            injection_position: this.injection_position,
            injection_depth: this.injection_depth,
            injection_order: this.injection_order,
            injection_trigger: this.injection_trigger,
            system_prompt: this.system_prompt,
            marker: this.marker,
            forbid_overrides: this.forbid_overrides,
        };
    }

    /**
     * JSON 데이터에서 프롬프트 객체 생성
     * @param {Object} json - JSON 데이터
     * @returns {Prompt}
     */
    static fromJSON(json) {
        return new Prompt(json);
    }

    /**
     * 프롬프트 복사본 생성
     * @returns {Prompt}
     */
    clone() {
        return new Prompt(this.toJSON());
    }
}

