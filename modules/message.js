/**
 * Message 클래스
 * 실리태번의 openai.js Message 클래스와 동일한 구조
 */

class Message {
    static tokensPerImage = 85;

    /** @type {number} */
    tokens;
    /** @type {string} */
    identifier;
    /** @type {string} */
    role;
    /** @type {string|any[]} */
    content;
    /** @type {string} */
    name;
    /** @type {object} */
    tool_call = null;

    /**
     * @constructor
     * @param {string} role - The role of the entity creating the message.
     * @param {string} content - The actual content of the message.
     * @param {string} identifier - A unique identifier for the message.
     * @private Don't use this constructor directly. Use createAsync instead.
     */
    constructor(role, content, identifier) {
        this.identifier = identifier;
        this.role = role;
        this.content = content;

        if (!this.role) {
            this.role = 'system';
        }

        this.tokens = 0;
    }

    /**
     * Create a new Message instance.
     * @param {string} role
     * @param {string} content
     * @param {string} identifier
     * @param {Function} [tokenCountFn] - Optional token counting function
     * @returns {Promise<Message>} Message instance
     */
    static async createAsync(role, content, identifier, tokenCountFn = null) {
        const message = new Message(role, content, identifier);

        if (typeof message.content === 'string' && message.content.length > 0 && tokenCountFn) {
            try {
                message.tokens = await tokenCountFn({ role: message.role, content: message.content });
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_TOKEN_15009', '메시지 토큰 카운팅 실패 (0 사용)', error);
                }
                message.tokens = 0;
            }
        }

        return message;
    }

    /**
     * Reconstruct the message from a tool invocation.
     * @param {any[]} invocations - The tool invocations to reconstruct the message from.
     * @param {Function} [tokenCountFn] - Optional token counting function
     * @returns {Promise<void>}
     */
    async setToolCalls(invocations, tokenCountFn = null) {
        this.tool_calls = invocations.map(i => ({
            id: i.id,
            type: 'function',
            function: {
                arguments: i.parameters,
                name: i.name,
            },
        }));
        
        if (tokenCountFn) {
            try {
                this.tokens = await tokenCountFn({ role: this.role, tool_calls: JSON.stringify(this.tool_calls) });
            } catch (error) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_TOKEN_20005', 'tool calls 토큰 카운팅 실패', error);
                }
            }
        }
    }

    /**
     * Add a name to the message.
     * @param {string} name Name to set for the message.
     * @param {Function} [tokenCountFn] - Optional token counting function
     * @returns {Promise<void>}
     */
    async setName(name, tokenCountFn = null) {
        this.name = name;
        
        if (tokenCountFn) {
            try {
                this.tokens = await tokenCountFn({ role: this.role, content: this.content, name: this.name });
            } catch (error) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_TOKEN_20006', '메시지 name 토큰 카운팅 실패', error);
                }
            }
        }
    }

    /**
     * Adds an image to the message.
     * @param {string} image Image URL or Data URL.
     * @param {Function} [getImageTokenCostFn] - Optional function to get image token cost
     * @returns {Promise<void>}
     */
    async addImage(image, getImageTokenCostFn = null) {
        // TODO: 이미지 처리 로직 (실리태번과 동일하게)
        // 현재는 기본 토큰 수만 추가
        if (getImageTokenCostFn) {
            try {
                const tokens = await getImageTokenCostFn(image);
                this.tokens += tokens;
            } catch (error) {
                this.tokens += Message.tokensPerImage;
            }
        } else {
            this.tokens += Message.tokensPerImage;
        }
    }

    /**
     * Adds a video to the message.
     * @param {string} video Video URL or Data URL.
     * @returns {Promise<void>}
     */
    async addVideo(video) {
        // TODO: 비디오 처리 로직 (실리태번과 동일하게)
        // 기본 토큰 수 추가 (보수적 추정)
        this.tokens += 10000; // ~40초 비디오 추정
    }

    /**
     * Create a new Message instance from a prompt asynchronously.
     * @static
     * @param {Object} prompt - The prompt object.
     * @param {Function} [tokenCountFn] - Optional token counting function
     * @returns {Promise<Message>} A new instance of Message.
     */
    static fromPromptAsync(prompt, tokenCountFn = null) {
        return Message.createAsync(prompt.role, prompt.content, prompt.identifier, tokenCountFn);
    }

    /**
     * Returns the number of tokens in the message.
     * @returns {number} Number of tokens in the message.
     */
    getTokens() { 
        return this.tokens; 
    }
}

