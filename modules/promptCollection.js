/**
 * PromptCollection 클래스
 * 프롬프트 컬렉션을 관리하는 클래스
 * 순서를 유지하며 프롬프트를 추가/삭제/수정할 수 있음
 */


class PromptCollection {
    constructor() {
        /** @type {Prompt[]} */
        this.items = [];
        
        /** @type {string[]} */
        this.overriddenPrompts = [];
    }

    /**
     * 프롬프트 추가
     * @param {Prompt} prompt - 추가할 프롬프트
     */
    add(prompt) {
        if (!(prompt instanceof Prompt)) {
            throw new Error('Only Prompt instances can be added to PromptCollection');
        }
        this.items.push(prompt);
    }

    /**
     * 특정 위치에 프롬프트 삽입
     * @param {number} index - 삽입할 위치
     * @param {Prompt} prompt - 삽입할 프롬프트
     */
    insertAt(index, prompt) {
        if (!(prompt instanceof Prompt)) {
            throw new Error('Only Prompt instances can be added to PromptCollection');
        }
        this.items.splice(index, 0, prompt);
    }

    /**
     * 식별자로 프롬프트 찾기
     * @param {string} identifier - 프롬프트 식별자
     * @returns {Prompt|undefined}
     */
    getByIdentifier(identifier) {
        return this.items.find(p => p.identifier === identifier);
    }

    /**
     * 식별자로 프롬프트 인덱스 찾기
     * @param {string} identifier - 프롬프트 식별자
     * @returns {number} -1 if not found
     */
    getIndexByIdentifier(identifier) {
        return this.items.findIndex(p => p.identifier === identifier);
    }

    /**
     * 식별자로 프롬프트 제거
     * @param {string} identifier - 프롬프트 식별자
     * @returns {boolean} 성공 여부
     */
    removeByIdentifier(identifier) {
        const index = this.getIndexByIdentifier(identifier);
        if (index >= 0) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 특정 위치에 프롬프트 설정
     * 실리태번의 set 메서드와 동일
     * @param {Prompt} prompt - 프롬프트
     * @param {number} position - 위치
     */
    set(prompt, position) {
        if (!(prompt instanceof Prompt)) {
            throw new Error('Only Prompt instances can be added to PromptCollection');
        }
        this.items[position] = prompt;
    }

    /**
     * 프롬프트 업데이트
     * @param {string} identifier - 프롬프트 식별자
     * @param {Prompt|Object} promptOrData - 새로운 프롬프트 객체 또는 데이터
     * @returns {boolean} 성공 여부
     */
    updateByIdentifier(identifier, promptOrData) {
        const index = this.getIndexByIdentifier(identifier);
        if (index >= 0) {
            if (promptOrData instanceof Prompt) {
                this.items[index] = promptOrData;
            } else {
                const existing = this.items[index];
                Object.assign(existing, promptOrData);
            }
            return true;
        }
        return false;
    }

    /**
     * 모든 프롬프트 가져오기
     * @returns {Prompt[]}
     */
    getAll() {
        return [...this.items]; // 복사본 반환
    }

    /**
     * 컬렉션 크기
     * @returns {number}
     */
    size() {
        return this.items.length;
    }

    /**
     * 컬렉션 비우기
     */
    clear() {
        this.items = [];
    }

    /**
     * JSON으로 직렬화
     * @returns {Object[]}
     */
    toJSON() {
        return this.items.map(p => p.toJSON());
    }

    /**
     * JSON에서 복원
     * @param {Object[]} jsonArray - JSON 배열
     */
    fromJSON(jsonArray) {
        this.items = jsonArray.map(json => Prompt.fromJSON(json));
    }

    /**
     * 컬렉션 복사본 생성
     * @returns {PromptCollection}
     */
    clone() {
        const collection = new PromptCollection();
        collection.items = this.items.map(p => p.clone());
        return collection;
    }

    /**
     * 특정 위치의 프롬프트 오버라이드
     * 실리태번의 override 메서드와 동일
     * @param {Prompt} prompt - 오버라이드할 프롬프트
     * @param {number} position - 위치
     */
    override(prompt, position) {
        if (!(prompt instanceof Prompt)) {
            throw new Error('Only Prompt instances can be added to PromptCollection');
        }
        this.set(prompt, position);
        if (!this.overriddenPrompts.includes(prompt.identifier)) {
            this.overriddenPrompts.push(prompt.identifier);
        }
    }

    /**
     * get 메서드 (별칭) - 실리태번 호환성
     * @param {string} identifier - 프롬프트 식별자
     * @returns {Prompt|undefined}
     */
    get(identifier) {
        return this.getByIdentifier(identifier);
    }

    /**
     * index 메서드 (별칭) - 실리태번 호환성
     * @param {string} identifier - 프롬프트 식별자
     * @returns {number} -1 if not found
     */
    index(identifier) {
        return this.getIndexByIdentifier(identifier);
    }

    /**
     * has 메서드 - 실리태번 호환성
     * @param {string} identifier - 프롬프트 식별자
     * @returns {boolean}
     */
    has(identifier) {
        return this.getIndexByIdentifier(identifier) >= 0;
    }

    /**
     * collection 속성 (실리태번 호환성)
     * @returns {Prompt[]}
     */
    get collection() {
        return this.items;
    }

    /**
     * 이터레이터 (for...of 지원)
     * @returns {Iterator<Prompt>}
     */
    [Symbol.iterator]() {
        return this.items[Symbol.iterator]();
    }
}

