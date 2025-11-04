/**
 * MessageCollection 클래스
 * 실리태번의 openai.js MessageCollection 클래스와 동일한 구조
 */

class MessageCollection {
    collection = [];
    identifier;

    /**
     * @constructor
     * @param {string} identifier - A unique identifier for the MessageCollection.
     * @param {...Object} items - An array of Message or MessageCollection instances to be added to the collection.
     */
    constructor(identifier, ...items) {
        for (let item of items) {
            if (!(item instanceof Message || item instanceof MessageCollection)) {
                throw new Error('Only Message and MessageCollection instances can be added to MessageCollection');
            }
        }

        this.collection.push(...items);
        this.identifier = identifier;
    }

    /**
     * Get chat in the format of {role, name, content, tool_calls}.
     * @returns {Array} Array of objects with role, name, and content properties.
     */
    getChat() {
        return this.collection.reduce((acc, item) => {
            // MessageCollection인 경우 재귀적으로 getChat() 호출
            if (item instanceof MessageCollection) {
                const collectionChat = item.getChat();
                acc.push(...collectionChat);
            } else if (item instanceof Message && (item.content || item.tool_calls)) {
                // Message인 경우 직접 추가
                acc.push({
                    role: item.role,
                    content: item.content,
                    ...(item.name && { name: item.name }),
                    ...(item.tool_calls && { tool_calls: item.tool_calls }),
                    ...(item.role === 'tool' && { tool_call_id: item.identifier }),
                });
            }
            return acc;
        }, []);
    }

    /**
     * Method to get the collection of messages.
     * @returns {Array} The collection of Message instances.
     */
    getCollection() {
        return this.collection;
    }

    /**
     * Add a new item to the collection.
     * @param {Object} item - The Message or MessageCollection instance to be added.
     */
    add(item) {
        this.collection.push(item);
    }

    /**
     * Get an item from the collection by its identifier.
     * @param {string} identifier - The identifier of the item to be found.
     * @returns {Object} The found item, or undefined if no item was found.
     */
    getItemByIdentifier(identifier) {
        return this.collection.find(item => item?.identifier === identifier);
    }

    /**
     * Check if an item with the given identifier exists in the collection.
     * @param {string} identifier - The identifier to check.
     * @returns {boolean} True if an item with the given identifier exists, false otherwise.
     */
    hasItemWithIdentifier(identifier) {
        return this.collection.some(message => message.identifier === identifier);
    }

    /**
     * Get the total number of tokens in the collection.
     * @returns {number} The total number of tokens.
     */
    getTokens() {
        return this.collection.reduce((tokens, message) => tokens + message.getTokens(), 0);
    }

    /**
     * Combines message collections into a single collection.
     * @returns {Message[]} The collection of messages flattened into a single array.
     */
    flatten() {
        return this.collection.reduce((acc, message) => {
            if (message instanceof MessageCollection) {
                acc.push(...message.flatten());
            } else {
                acc.push(message);
            }
            return acc;
        }, []);
    }
}

