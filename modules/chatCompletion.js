/**
 * ChatCompletion 클래스
 * 실리태번의 openai.js ChatCompletion 클래스와 동일한 구조
 */

// 에러 클래스
class TokenBudgetExceededError extends Error {
    constructor(identifier) {
        super(`Token budget exceeded for: ${identifier}`);
        this.identifier = identifier;
        this.name = 'TokenBudgetExceededError';
    }
}

class IdentifierNotFoundError extends Error {
    constructor(identifier) {
        super(`Identifier not found: ${identifier}`);
        this.identifier = identifier;
        this.name = 'IdentifierNotFoundError';
    }
}

class ChatCompletion {
    /**
     * Combines consecutive system messages into one if they have no name attached.
     * @param {Function} [tokenCountFn] - Optional token counting function
     * @returns {Promise<void>}
     */
    async squashSystemMessages(tokenCountFn = null) {
        const excludeList = ['newMainChat', 'newChat', 'groupNudge'];
        
        this.messages.collection = this.messages.flatten();

        let lastMessage = null;
        let squashedMessages = [];
        let skippedCount = 0;
        let chatHistoryMessagesCount = 0;
        let userAssistantMessagesCount = 0;

        for (let message of this.messages.collection) {
            // Force exclude empty messages
            if (message.role === 'system' && !message.content) {
                skippedCount++;
                continue;
            }

            const shouldSquash = (message) => {
                return !excludeList.includes(message.identifier) && message.role === 'system' && !message.name;
            };

            // chatHistory 메시지 추적
            if (message.identifier && message.identifier.startsWith('chatHistory')) {
                chatHistoryMessagesCount++;
            }

            // user/assistant 메시지 추적
            if (message.role === 'user' || message.role === 'assistant') {
                userAssistantMessagesCount++;
            }

            if (shouldSquash(message)) {
                if (lastMessage && shouldSquash(lastMessage)) {
                    lastMessage.content += '\n' + message.content;
                    if (tokenCountFn) {
                        try {
                            lastMessage.tokens = await tokenCountFn({ role: lastMessage.role, content: lastMessage.content });
                        } catch (error) {
                            // 경고 코드 토스트 알림 표시
                            if (typeof showErrorCodeToast === 'function') {
                                showErrorCodeToast('WARN_AI_20006', '토큰 계산 실패 (squash 중)', error);
                            }
                        }
                    }
                }
                else {
                    squashedMessages.push(message);
                    lastMessage = message;
                }
            }
            else {
                squashedMessages.push(message);
                lastMessage = message;
            }
        }
        
        this.messages.collection = squashedMessages;
    }

    /**
     * Initializes a new instance of ChatCompletion.
     * Sets up the initial token budget and a new message collection.
     */
    constructor() {
        this.tokenBudget = 0;
        this.messages = new MessageCollection('root');
        this.loggingEnabled = false;
        this.overriddenPrompts = [];
    }

    /**
     * Retrieves all messages.
     *
     * @returns {MessageCollection} The MessageCollection instance holding all messages.
     */
    getMessages() {
        return this.messages;
    }

    /**
     * Calculates and sets the token budget based on context and response.
     *
     * @param {number} context - Number of tokens in the context.
     * @param {number} response - Number of tokens in the response.
     */
    setTokenBudget(context, response) {
        this.log(`Prompt tokens: ${context}`);
        this.log(`Completion tokens: ${response}`);

        this.tokenBudget = context - response;

        this.log(`Token budget: ${this.tokenBudget}`);
    }

    /**
     * Adds a message or message collection to the collection.
     *
     * @param {Message|MessageCollection} collection - The message or message collection to add.
     * @param {number|null} position - The position at which to add the collection.
     * @returns {ChatCompletion} The current instance for chaining.
     */
    add(collection, position = null) {
        if (!collection) {
            throw new Error('Cannot add undefined collection');
        }
        
        this.validateMessageCollection(collection);
        this.checkTokenBudget(collection, collection.identifier);

        if (null !== position && -1 !== position) {
            // position이 유효한지 확인
            if (position < 0) {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_AI_20007', `잘못된 position 값: ${position}`);
                }
                this.messages.collection.push(collection);
            } else if (position >= this.messages.collection.length) {
                // position이 배열 길이보다 크거나 같으면, 배열 끝에 추가
                // 디버깅: position이 배열 길이보다 큼
                console.debug('[ChatCompletion] position이 배열 길이보다 큼:', position, '>=', this.messages.collection.length);
                this.messages.collection.push(collection);
            } else {
                // 중요: position에 이미 다른 컬렉션이 있으면 경고하고 처리
                const existing = this.messages.collection[position];
                if (existing) {
                    if (existing.identifier === collection.identifier) {
                        // 같은 identifier면 덮어쓰기 (업데이트)
                        this.messages.collection[position] = collection;
                    } else {
                        // 다른 identifier면 삽입 (기존 항목은 그대로 유지하고 뒤로 밀기)
                        // 디버깅: position이 이미 사용 중
                        console.debug('[ChatCompletion] position', position, '이 이미', existing.identifier, '로 사용 중,', collection.identifier, '삽입');
                        this.messages.collection.splice(position, 0, collection);
                    }
                } else {
                    // position이 비어있으면 정확한 위치에 설정
                    this.messages.collection[position] = collection;
                }
            }
        } else {
            // position이 지정되지 않았으면 배열 끝에 추가
            this.messages.collection.push(collection);
        }

        this.decreaseTokenBudgetBy(collection.getTokens());

        this.log(`Added ${collection.identifier}. Remaining tokens: ${this.tokenBudget}`);

        return this;
    }

    /**
     * Inserts a message at the start of the specified collection.
     *
     * @param {Message} message - The message to insert.
     * @param {string} identifier - The identifier of the collection where to insert the message.
     */
    insertAtStart(message, identifier) {
        this.insert(message, identifier, 'start');
    }

    /**
     * Inserts a message at the end of the specified collection.
     *
     * @param {Message} message - The message to insert.
     * @param {string} identifier - The identifier of the collection where to insert the message.
     */
    insertAtEnd(message, identifier) {
        this.insert(message, identifier, 'end');
    }

    /**
     * Inserts a message at the specified position in the specified collection.
     *
     * @param {Message} message - The message to insert.
     * @param {string} identifier - The identifier of the collection where to insert the message.
     * @param {string|number} position - The position at which to insert the message ('start' or 'end').
     */
    insert(message, identifier, position = 'end') {
        if (!message) {
            throw new Error('Cannot insert undefined message');
        }
        if (!message.identifier) {
            throw new Error('Message must have an identifier');
        }
        
        this.validateMessage(message);
        this.checkTokenBudget(message, message.identifier);

        const index = this.findMessageIndex(identifier);
        
        if (index < 0 || !this.messages.collection[index]) {
            throw new IdentifierNotFoundError(identifier);
        }
        
        if (message.content || message.tool_calls) {
            if ('start' === position) this.messages.collection[index].collection.unshift(message);
            else if ('end' === position) this.messages.collection[index].collection.push(message);
            else if (typeof position === 'number') this.messages.collection[index].collection.splice(position, 0, message);

            this.decreaseTokenBudgetBy(message.getTokens());

            this.log(`Inserted ${message.identifier} into ${identifier}. Remaining tokens: ${this.tokenBudget}`);
        } else {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_AI_20010', `메시지 스킵: ${message.identifier} (content나 tool_calls 없음)`);
            }
        }
    }

    /**
     * Remove the last item of the collection
     *
     * @param {string} identifier - The identifier of the collection
     */
    removeLastFrom(identifier) {
        const index = this.findMessageIndex(identifier);
        const message = this.messages.collection[index].collection.pop();

        if (!message) {
            this.log(`No message to remove from ${identifier}`);
            return;
        }

        this.increaseTokenBudgetBy(message.getTokens());

        this.log(`Removed ${message.identifier} from ${identifier}. Remaining tokens: ${this.tokenBudget}`);
    }

    /**
     * Checks if the token budget can afford the tokens of the specified message.
     *
     * @param {Message|MessageCollection} message - The message to check for affordability.
     * @returns {boolean} True if the budget can afford the message, false otherwise.
     */
    canAfford(message) {
        return 0 <= this.tokenBudget - message.getTokens();
    }

    /**
     * Checks if the token budget can afford the tokens of all the specified messages.
     * @param {Message[]} messages - The messages to check for affordability.
     * @returns {boolean} True if the budget can afford all the messages, false otherwise.
     */
    canAffordAll(messages) {
        return 0 <= this.tokenBudget - messages.reduce((total, message) => total + message.getTokens(), 0);
    }

    /**
     * Checks if a message with the specified identifier exists in the collection.
     *
     * @param {string} identifier - The identifier to check for existence.
     * @returns {boolean} True if a message with the specified identifier exists, false otherwise.
     */
    has(identifier) {
        return this.messages.hasItemWithIdentifier(identifier);
    }

    /**
     * Retrieves the total number of tokens in the collection.
     *
     * @returns {number} The total number of tokens.
     */
    getTotalTokenCount() {
        return this.messages.getTokens();
    }

    /**
     * Retrieves the chat as a flattened array of messages.
     *
     * @returns {Array} The chat messages.
     */
    getChat() {
        const chat = [];
        
        for (let item of this.messages.collection) {
            if (!item) {
                continue;
            }
            
            if (item instanceof MessageCollection) {
                const collectionChat = item.getChat();
                chat.push(...collectionChat);
            } else if (item instanceof Message && (item.content || item.tool_calls)) {
                const message = {
                    role: item.role,
                    content: item.content,
                    ...(item.name ? { name: item.name } : {}),
                    ...(item.tool_calls ? { tool_calls: item.tool_calls } : {}),
                    ...(item.role === 'tool' ? { tool_call_id: item.identifier } : {}),
                };
                chat.push(message);
            }
        }
        
        return chat;
    }

    /**
     * Logs an output message to the console if logging is enabled.
     *
     * @param {string} output - The output message to log.
     */
    log(output) {
        if (this.loggingEnabled) console.log('[ChatCompletion] ' + output);
    }

    /**
     * Enables logging of output messages to the console.
     */
    enableLogging() {
        this.loggingEnabled = true;
    }

    /**
     * Disables logging of output messages to the console.
     */
    disableLogging() {
        this.loggingEnabled = false;
    }

    /**
     * Validates if the given argument is an instance of MessageCollection.
     * Throws an error if the validation fails.
     *
     * @param {MessageCollection|Message} collection - The collection to validate.
     */
    validateMessageCollection(collection) {
        if (!(collection instanceof MessageCollection)) {
            throw new Error('Argument must be an instance of MessageCollection');
        }
    }

    /**
     * Validates if the given argument is an instance of Message.
     * Throws an error if the validation fails.
     *
     * @param {Message} message - The message to validate.
     */
    validateMessage(message) {
        if (!(message instanceof Message)) {
            throw new Error('Argument must be an instance of Message');
        }
    }

    /**
     * Checks if the token budget can afford the tokens of the given message.
     * Throws an error if the budget can't afford the message.
     *
     * @param {Message|MessageCollection} message - The message to check.
     * @param {string} identifier - The identifier of the message.
     */
    checkTokenBudget(message, identifier) {
        if (!this.canAfford(message)) {
            throw new TokenBudgetExceededError(identifier);
        }
    }

    /**
     * Reserves the tokens required by the given message from the token budget.
     *
     * @param {Message|MessageCollection|number} message - The message whose tokens to reserve.
     */
    reserveBudget(message) {
        const tokens = typeof message === 'number' ? message : message.getTokens();
        this.decreaseTokenBudgetBy(tokens);
    }

    /**
     * Frees up the tokens used by the given message from the token budget.
     *
     * @param {Message|MessageCollection} message - The message whose tokens to free.
     */
    freeBudget(message) { 
        this.increaseTokenBudgetBy(message.getTokens()); 
    }

    /**
     * Increases the token budget by the given number of tokens.
     * This function should be used sparingly, per design the completion should be able to work with its initial budget.
     *
     * @param {number} tokens - The number of tokens to increase the budget by.
     */
    increaseTokenBudgetBy(tokens) {
        this.tokenBudget += tokens;
    }

    /**
     * Decreases the token budget by the given number of tokens.
     * This function should be used sparingly, per design the completion should be able to work with its initial budget.
     *
     * @param {number} tokens - The number of tokens to decrease the budget by.
     */
    decreaseTokenBudgetBy(tokens) {
        this.tokenBudget -= tokens;
    }

    /**
     * Finds the index of a message in the collection by its identifier.
     * Throws an error if a message with the given identifier is not found.
     *
     * @param {string} identifier - The identifier of the message to find.
     * @returns {number} The index of the message in the collection.
     */
    findMessageIndex(identifier) {
        const index = this.messages.collection.findIndex(item => item?.identifier === identifier);
        if (index < 0) {
            throw new IdentifierNotFoundError(identifier);
        }
        return index;
    }

    /**
     * Sets the list of overridden prompts.
     * @param {string[]} list A list of prompts that were overridden.
     */
    setOverriddenPrompts(list) {
        this.overriddenPrompts = list;
    }

    /**
     * Gets the list of overridden prompts.
     * @returns {string[]} A list of prompts that were overridden.
     */
    getOverriddenPrompts() {
        return this.overriddenPrompts ?? [];
    }
}

