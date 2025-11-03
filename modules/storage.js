/**
 * IndexedDB 기반 저장소 시스템
 * 모든 데이터는 IndexedDB에 저장됩니다.
 */

// IndexedDB 헬퍼 함수들
async function saveToIndexedDB(storeName, key, value) {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value, key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

async function loadFromIndexedDB(storeName, key, defaultValue = null) {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => {
            const result = request.result;
            resolve(result !== undefined ? result : defaultValue);
        };
        request.onerror = () => reject(request.error);
    });
}

async function saveAllToIndexedDB(storeName, data) {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const promises = Object.entries(data).map(([id, value]) => {
            return new Promise((res, rej) => {
                const req = store.put(value, id);
                req.onsuccess = () => res();
                req.onerror = () => rej(req.error);
            });
        });
        
        Promise.all(promises).then(() => {
            // 실리태번과 동일: 메타데이터 저장 (순서 보존)
            const orderedKeys = Object.keys(data);
            const metaReq = store.put(orderedKeys, '_meta');
            metaReq.onsuccess = () => {
                resolve(true);
            };
            metaReq.onerror = () => {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_STORAGE_2001', `메타데이터 저장 실패: ${storeName}`, metaReq.error);
                }
                reject(metaReq.error);
            };
        }).catch(reject);
    });
}

async function loadAllFromIndexedDB(storeName) {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        // 먼저 메타데이터(순서) 로드
        const metaRequest = store.get('_meta');
        
        metaRequest.onsuccess = async () => {
            const orderedKeys = metaRequest.result || [];
            
            // 순서가 저장되어 있으면 그 순서대로 로드
            if (orderedKeys && orderedKeys.length > 0) {
                const promises = orderedKeys.map(key => loadFromIndexedDB(storeName, key, null));
                const values = await Promise.all(promises);
                
                const result = {};
                orderedKeys.forEach((key, index) => {
                    // 삭제된 항목(undefined)은 제외
                    if (values[index] !== undefined && values[index] !== null) {
                        result[key] = values[index];
                    }
                });
                
                // 삭제된 키가 메타데이터에 남아있으면 정리
                const existingKeys = Object.keys(result);
                if (existingKeys.length !== orderedKeys.length) {
                    // 메타데이터에서 삭제된 키 제거
                    const updatedKeys = orderedKeys.filter(key => existingKeys.includes(key));
                    if (updatedKeys.length !== orderedKeys.length) {
                        // 메타데이터 업데이트 (비동기로 처리하여 성능 영향 최소화)
                        requestAnimationFrame(async () => {
                            try {
                                const updateDb = await openIndexedDB();
                                const updateTransaction = updateDb.transaction([storeName], 'readwrite');
                                const updateStore = updateTransaction.objectStore(storeName);
                                await updateStore.put(updatedKeys, '_meta');
                            } catch (error) {
                                console.debug('[loadAllFromIndexedDB] 메타데이터 정리 실패 (무시):', error);
                            }
                        });
                    }
                }
                
                resolve(result);
            } else {
                // 순서가 없으면 기존 방식 사용 (하위 호환성)
                const request = store.getAllKeys();
                request.onsuccess = async () => {
                    const keys = request.result.filter(k => k !== '_meta');
                    const promises = keys.map(key => loadFromIndexedDB(storeName, key, null));
                    const values = await Promise.all(promises);
                    
                    const result = {};
                    keys.forEach((key, index) => {
                        if (values[index]) {
                            result[key] = values[index];
                        }
                    });
                    
                    resolve(result);
                };
                request.onerror = () => reject(request.error);
            }
        };
        metaRequest.onerror = () => {
            // 메타데이터가 없으면 기존 방식 사용
            const request = store.getAllKeys();
            request.onsuccess = async () => {
                const keys = request.result.filter(k => k !== '_meta');
                const promises = keys.map(key => loadFromIndexedDB(storeName, key, null));
                const values = await Promise.all(promises);
                
                const result = {};
                keys.forEach((key, index) => {
                    // 삭제된 항목(undefined, null)은 제외
                    if (values[index] !== undefined && values[index] !== null) {
                        result[key] = values[index];
                    }
                });
                
                resolve(result);
            };
            request.onerror = () => reject(request.error);
        };
    });
}

async function deleteFromIndexedDB(storeName, key) {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        // 먼저 데이터 삭제
        const deleteRequest = store.delete(key);
        deleteRequest.onsuccess = () => {
            // 메타데이터 업데이트 (삭제된 키를 메타데이터에서도 제거)
            const metaRequest = store.get('_meta');
            metaRequest.onsuccess = () => {
                const orderedKeys = metaRequest.result || [];
                const updatedKeys = orderedKeys.filter(k => k !== key);
                
                // 메타데이터가 있었고 변경이 있었으면 업데이트
                if (orderedKeys.length > 0 && updatedKeys.length !== orderedKeys.length) {
                    const updateMetaRequest = store.put(updatedKeys, '_meta');
                    updateMetaRequest.onsuccess = () => {
                        resolve(true);
                    };
                    updateMetaRequest.onerror = () => {
                        // 경고 코드 토스트 알림 표시
                        if (typeof showErrorCodeToast === 'function') {
                            showErrorCodeToast('WARN_STORAGE_20001', `메타데이터 업데이트 실패: ${storeName}`, updateMetaRequest.error);
                        }
                        // 메타데이터 업데이트 실패해도 삭제는 성공했으므로 resolve
                        resolve(true);
                    };
                } else {
                    // 메타데이터가 없었거나 변경이 없으면 그냥 성공
                    resolve(true);
                }
            };
            metaRequest.onerror = () => {
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_STORAGE_20002', `메타데이터 로드 실패: ${storeName}`, metaRequest.error);
                }
                // 메타데이터 로드 실패해도 삭제는 성공했으므로 resolve
                resolve(true);
            };
        };
        deleteRequest.onerror = () => reject(deleteRequest.error);
    });
}

async function clearIndexedDB(storeName) {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        // 버전을 3으로 올림 (ai_loading_presets object store 추가)
        const request = indexedDB.open('mobile_chat_app_db', 3);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const stores = ['settings', 'characters', 'chats', 'world_info', 'quick_reply', 'user_personas', 'regex_scripts', 'presets', 'ai_loading_presets'];
            stores.forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName);
                }
            });
        };
    });
}

/**
 * 앱 초기화 시 데이터 저장소 설정
 */
async function initializeDataFolder() {
    return null;
}

/**
 * 설정 데이터 관리
 */
class SettingsStorage {
    static async save(settings) {
        return await saveToIndexedDB('settings', 'settings', settings);
    }

    static async load() {
        const defaultSettings = {
            // API 설정 (각 제공업체별 키 저장)
            apiProvider: 'openai',
            apiKeys: {
                openai: '',
                claude: '',
                openrouter: '',
                ai21: '',
                makersuite: '',
                vertexai: '',
                mistralai: '',
                custom: '',
                cohere: '',
                perplexity: '',
                groq: '',
                electronhub: '',
                nanogpt: '',
                deepseek: '',
                aimlapi: '',
                xai: '',
                pollinations: '',
                moonshot: '',
                fireworks: '',
                cometapi: '',
                azure_openai: '',
                zai: '',
            },
            apiModels: {
                openai: 'gpt-4o',
                claude: 'claude-3-5-sonnet-20241022',
                makersuite: 'gemini-2.5-flash',
                vertexai: 'gemini-2.5-flash',
                mistralai: 'mistral-large-2411',
                cohere: 'command-r-plus-08-2024',
                perplexity: 'sonar-pro',
                groq: 'llama-3.3-70b-versatile',
                deepseek: 'deepseek-chat',
                xai: 'grok-2-1212',
                moonshot: 'moonshot-v1-8k',
                fireworks: 'accounts/fireworks/models/kimi-k2-instruct',
                ai21: 'jamba-1.5-large',
            },
                currentCharacterId: null, // 기본값을 null로 명시
                currentChatId: null,
                // Azure OpenAI 설정
                azure_base_url: '',
                azure_deployment_name: '',
                azure_api_version: '2025-04-01-preview',
                // Custom API 설정
                custom_url: '',
                custom_model_id: '',
            };
            return await loadFromIndexedDB('settings', 'settings', defaultSettings);
        }

    static async clearAll() {
        return await clearIndexedDB('settings');
    }
}

/**
 * AI 로딩 설정 관리
 */
class AILoadingStorage {
    static async saveEnabled(enabled) {
        const settings = await SettingsStorage.load();
        settings.aiLoadingEnabled = enabled;
        return await SettingsStorage.save(settings);
    }

    static async loadEnabled() {
        const settings = await SettingsStorage.load();
        return settings.aiLoadingEnabled ?? false;
    }

    /**
     * 프리셋 저장
     * @param {string} presetId - 프리셋 ID (UUID)
     * @param {Object} presetData - 프리셋 데이터 { name, html, css }
     */
    static async savePreset(presetId, presetData) {
        const presets = await this.loadAllPresets();
        presets[presetId] = {
            ...presetData,
            id: presetId,
            created_at: presets[presetId]?.created_at || Date.now(),
            updated_at: Date.now()
        };
        return await saveAllToIndexedDB('ai_loading_presets', presets);
    }

    /**
     * 모든 프리셋 로드
     * @returns {Promise<Object>} { presetId: presetData }
     */
    static async loadAllPresets() {
        return await loadAllFromIndexedDB('ai_loading_presets') || {};
    }

    /**
     * 특정 프리셋 로드
     * @param {string} presetId - 프리셋 ID
     */
    static async loadPreset(presetId) {
        const presets = await this.loadAllPresets();
        return presets[presetId] || null;
    }

    /**
     * 프리셋 삭제
     * @param {string} presetId - 프리셋 ID
     */
    static async deletePreset(presetId) {
        return await deleteFromIndexedDB('ai_loading_presets', presetId);
    }

    /**
     * 현재 선택된 프리셋 ID 저장
     * @param {string} presetId - 프리셋 ID
     */
    static async saveCurrentPresetId(presetId) {
        const settings = await SettingsStorage.load();
        settings.aiLoadingCurrentPresetId = presetId;
        return await SettingsStorage.save(settings);
    }

    /**
     * 현재 선택된 프리셋 ID 로드
     */
    static async loadCurrentPresetId() {
        const settings = await SettingsStorage.load();
        return settings.aiLoadingCurrentPresetId || null;
    }

    static async clearAll() {
        return await clearIndexedDB('settings');
    }
}

/**
 * 캐릭터 데이터 관리
 */
class CharacterStorage {
    static async saveAll(characters) {
        return await saveAllToIndexedDB('characters', characters);
    }

    static async loadAll() {
        const characters = await loadAllFromIndexedDB('characters');
        return characters;
    }

    static async save(characterId, characterData) {
        // 아바타 이미지 정규화 (일관성 확보)
        // 여러 위치에서 아바타 확인하고 모든 위치에 저장
        let avatarImage = characterData?.avatar_image || 
                        characterData?.avatarImage || 
                        characterData?.data?.avatar_image ||
                        characterData?.data?.avatarImage ||
                        (characterData?.avatar && characterData.avatar !== 'none' ? characterData.avatar : null) ||
                        null;
        
        // 아바타가 있으면 모든 위치에 저장 (일관성 확보)
        if (avatarImage) {
            characterData.avatar_image = avatarImage;
            characterData.avatarImage = avatarImage;
            if (characterData.data) {
                characterData.data.avatar_image = avatarImage;
            }
        }
        
        // 현재 모든 캐릭터 불러오기
        const characters = await this.loadAll();
        
        // 새 캐릭터 추가 또는 기존 캐릭터 업데이트
        characters[characterId] = characterData;
        
        const result = await this.saveAll(characters);
        return result;
    }

    static async load(characterId) {
        const characters = await this.loadAll();
        const character = characters[characterId] || null;
        return character;
    }

    static async delete(characterId) {
        return await deleteFromIndexedDB('characters', characterId);
    }

    static async saveCurrent(characterId) {
        const settings = await SettingsStorage.load();
        settings.currentCharacterId = characterId;
        return await SettingsStorage.save(settings);
    }

    static async loadCurrent() {
        const settings = await SettingsStorage.load();
        // 명시적으로 null, undefined, 빈 문자열 체크
        const characterId = settings.currentCharacterId;
        
        if (characterId === null || characterId === undefined || characterId === '') {
            return null;
        }
        if (typeof characterId === 'string' && characterId.trim() === '') {
            return null;
        }
        
        // 캐릭터가 실제로 존재하는지 확인
        if (characterId) {
            const character = await this.load(characterId);
            if (!character) {
                // 캐릭터가 존재하지 않으면 null 반환하고 설정도 초기화
                await this.clearCurrent();
                return null;
            }
        }
        
        return characterId;
    }
    
    /**
     * 현재 캐릭터 선택 해제
     */
    static async clearCurrent() {
        return await this.saveCurrent(null);
    }

    static async clearAll() {
        return await clearIndexedDB('characters');
    }
}

/**
 * 채팅 데이터 관리
 */
class ChatStorage {
    static async saveAll(chats) {
        return await saveAllToIndexedDB('chats', chats);
    }

    static async loadAll() {
        const allChats = await loadAllFromIndexedDB('chats');
        // 삭제된 채팅 필터링 (null이나 undefined인 경우 제외)
        const filteredChats = {};
        for (const [chatId, chatData] of Object.entries(allChats)) {
            if (chatData !== null && chatData !== undefined) {
                filteredChats[chatId] = chatData;
            }
        }
        return filteredChats;
    }

    static async save(chatId, chatData) {
        const chats = await this.loadAll();
        chats[chatId] = chatData;
        return await this.saveAll(chats);
    }

    static async load(chatId) {
        const chats = await this.loadAll();
        return chats[chatId] || null;
    }

    static async delete(chatId) {
        return await deleteFromIndexedDB('chats', chatId);
    }

    static async saveCurrent(chatId) {
        const settings = await SettingsStorage.load();
        settings.currentChatId = chatId;
        return await SettingsStorage.save(settings);
    }

    static async loadCurrent() {
        const settings = await SettingsStorage.load();
        return settings.currentChatId || null;
    }

    static async clearAll() {
        return await clearIndexedDB('chats');
    }
}

/**
 * 월드인포 데이터 관리
 */
class WorldInfoStorage {
    static async save(worldInfo) {
        return await saveToIndexedDB('world_info', 'world_info', worldInfo);
    }

    static async load() {
        return await loadFromIndexedDB('world_info', 'world_info', { entries: {} });
    }
}

/**
 * Quick Reply 데이터 관리
 */
class QuickReplyStorage {
    static async save(quickReply) {
        return await saveToIndexedDB('quick_reply', 'quick_reply', quickReply);
    }

    static async load() {
        return await loadFromIndexedDB('quick_reply', 'quick_reply', { version: 2, setList: [] });
    }
}

/**
 * 유저 페르소나 데이터 관리
 */
class UserPersonaStorage {
    static async saveAll(personas) {
        return await saveAllToIndexedDB('user_personas', personas);
    }

    static async loadAll() {
        return await loadAllFromIndexedDB('user_personas');
    }

    static async save(personaId, personaData) {
        const personas = await this.loadAll();
        personas[personaId] = personaData;
        return await this.saveAll(personas);
    }

    static async load(personaId) {
        const personas = await this.loadAll();
        return personas[personaId] || null;
    }

    static async delete(personaId) {
        return await deleteFromIndexedDB('user_personas', personaId);
    }

    static async clearAll() {
        return await clearIndexedDB('user_personas');
    }
}

/**
 * 정규식 스크립트 데이터 관리
 * 글로벌 정규식만 관리 (캐릭터 한정은 CharacterStorage에서 관리)
 */
class RegexScriptStorage {
    // 글로벌 정규식 관리
    static async saveAll(scripts) {
        return await saveAllToIndexedDB('regex_scripts', scripts);
    }

    static async loadAll() {
        return await loadAllFromIndexedDB('regex_scripts');
    }

    static async save(scriptId, scriptData) {
        const scripts = await this.loadAll();
        // created_at이 없으면 현재 시간 추가 (최근 정규식이 아래로 가도록)
        if (!scriptData.created_at && !scripts[scriptId]?.created_at) {
            scriptData.created_at = Date.now();
        }
        scripts[scriptId] = scriptData;
        return await this.saveAll(scripts);
    }

    static async load(scriptId) {
        const scripts = await this.loadAll();
        return scripts[scriptId] || null;
    }

    static async delete(scriptId) {
        return await deleteFromIndexedDB('regex_scripts', scriptId);
    }

    // 캐릭터 한정 정규식 관리
    static async loadCharacterRegex(characterId) {
        const character = await CharacterStorage.load(characterId);
        if (!character) return {};
        
        const extensions = character.extensions || {};
        const regexScripts = extensions.regex_scripts || {};
        return regexScripts;
    }

    static async saveCharacterRegex(characterId, scripts) {
        const character = await CharacterStorage.load(characterId);
        if (!character) {
            throw new Error(`캐릭터를 찾을 수 없습니다: ${characterId}`);
        }
        
        if (!character.extensions) {
            character.extensions = {};
        }
        character.extensions.regex_scripts = scripts;
        
        await CharacterStorage.save(characterId, character);
    }

    static async saveCharacterRegexScript(characterId, scriptId, scriptData) {
        const scripts = await this.loadCharacterRegex(characterId);
        // created_at이 없으면 현재 시간 추가 (최근 정규식이 아래로 가도록)
        if (!scriptData.created_at && !scripts[scriptId]?.created_at) {
            scriptData.created_at = Date.now();
        }
        scripts[scriptId] = scriptData;
        return await this.saveCharacterRegex(characterId, scripts);
    }

    static async deleteCharacterRegexScript(characterId, scriptId) {
        const scripts = await this.loadCharacterRegex(characterId);
        delete scripts[scriptId];
        return await this.saveCharacterRegex(characterId, scripts);
    }
}

/**
 * Preset 데이터 관리
 * 실리태번 구조: openai_settings (배열), openai_setting_names (객체), oai_settings (현재 설정)
 */
class PresetStorage {
    /**
     * 특정 API의 모든 preset 저장
     * @param {string} apiId - API ID ('openai', 'novel', 등)
     * @param {Array} presets - Preset 배열
     * @param {Object} presetNames - Preset 이름 맵 { name: index }
     */
    static async saveAll(apiId, presets, presetNames) {
        const data = {
            presets: presets,
            preset_names: presetNames
        };
        return await saveToIndexedDB('presets', apiId, data);
    }

    /**
     * 특정 API의 모든 preset 불러오기
     * @param {string} apiId - API ID
     * @returns {Promise<{presets: Array, preset_names: Object}>}
     */
    static async loadAll(apiId) {
        const defaultData = {
            presets: [],
            preset_names: {}
        };
        return await loadFromIndexedDB('presets', apiId, defaultData);
    }

    /**
     * 특정 preset 저장 (단일 preset 추가/업데이트)
     * @param {string} apiId - API ID
     * @param {number} index - Preset 인덱스
     * @param {Object} preset - Preset 객체
     * @param {string} presetName - Preset 이름
     */
    static async savePreset(apiId, index, preset, presetName) {
        const allData = await this.loadAll(apiId);
        
        // Preset 배열 업데이트
        if (index >= 0 && index < allData.presets.length) {
            allData.presets[index] = preset;
        } else {
            // 새 preset 추가
            allData.presets.push(preset);
            allData.preset_names[presetName] = allData.presets.length - 1;
        }
        
        // 이름 맵 업데이트
        if (presetName) {
            allData.preset_names[presetName] = index >= 0 ? index : allData.presets.length - 1;
        }
        
        return await this.saveAll(apiId, allData.presets, allData.preset_names);
    }

    /**
     * 특정 preset 삭제
     * @param {string} apiId - API ID
     * @param {string} presetName - Preset 이름
     */
    static async deletePreset(apiId, presetName) {
        const allData = await this.loadAll(apiId);
        const index = allData.preset_names[presetName];
        
        if (index === undefined) {
            return false;
        }
        
        // 배열에서 제거
        allData.presets.splice(index, 1);
        
        // 이름 맵에서 제거 및 재인덱싱
        delete allData.preset_names[presetName];
        
        // 인덱스 재조정
        const newPresetNames = {};
        Object.keys(allData.preset_names).forEach(name => {
            const oldIndex = allData.preset_names[name];
            if (oldIndex > index) {
                newPresetNames[name] = oldIndex - 1;
            } else if (oldIndex < index) {
                newPresetNames[name] = oldIndex;
            }
        });
        allData.preset_names = newPresetNames;
        
        return await this.saveAll(apiId, allData.presets, allData.preset_names);
    }
}

// 모든 클래스와 함수는 전역 스코프에 있습니다

