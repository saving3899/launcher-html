/**
 * AI 메시지 전송 모듈
 * 
 * ⚠️⚠️⚠️ 중요 경고 ⚠️⚠️⚠️
 * 이 파일은 코드 구조 개선을 위해 chatManager.js에서 분리되었습니다.
 * 
 * 관련 요청사항이 있기 전까지 절대 이 파일의 로직을 수정하지 마세요!
 * 
 * ===========================================
 * 문제 발생 및 해결 기록
 * ===========================================
 * 
 * [문제]
 * - 유저 메시지와 채팅 히스토리가 AI 프롬프트에 전달되지 않음
 * - AI 응답이 유저 메시지와 전혀 관련 없음
 * 
 * [원인]
 * 1. populateChatHistory에서 promptManager.preparePrompt()가 Prompt 객체를 반환하는데,
 *    getRegexedString()에 Prompt 객체 전체를 전달하여 "rawString is not a string" 오류 발생
 * 2. newChatMessage가 빈 문자열일 때 null 체크 누락으로 인한 오류
 * 
 * [해결]
 * 1. promptManager.preparePrompt()의 반환값에서 .content를 추출하여 getRegexedString()에 전달
 * 2. newChatMessage null 체크 추가
 * 3. DOM 업데이트 완료 대기 로직 추가 (requestAnimationFrame)
 * 4. chatHistory 프롬프트 마커가 없어도 메시지 추가되도록 수정
 * 
 * ===========================================
 * 재발 방지 주의사항
 * ===========================================
 * 
 * 1. promptManager.preparePrompt()는 Prompt 객체를 반환하므로,
 *    getRegexedString()에 전달하기 전에 반드시 .content를 추출해야 함
 * 
 * 2. 채팅 히스토리는 DOM에서 읽어오므로, addMessage 직후에는
 *    requestAnimationFrame으로 DOM 업데이트 완료를 대기해야 함
 * 
 * 3. chatHistory 프롬프트 마커가 없어도 채팅 메시지는 반드시 추가되어야 함
 *    (마커는 위치 지정용일 뿐)
 * 
 * 4. newChatMessage는 new_chat_prompt가 비어있을 수 있으므로
 *    null 체크 후에만 freeBudget과 insertAtStart를 호출해야 함
 * 
 * 5. populateChatCompletion.js의 populateChatHistory 함수에서:
 *    - preparePrompt의 반환값에서 .content 추출 필수
 *    - newChatMessage null 체크 필수
 * 
 * 6. 이 함수는 chatManager 인스턴스의 메서드를 호출하므로 (addMessage, getChatHistory 등),
 *    ChatManager 인스턴스를 매개변수로 받아야 함
 * 
 * ===========================================
 */

/**
 * AI 응답 생성 (일반 메시지 전송)
 * @param {string} userMessage - 사용자 메시지 (정규식 적용 전 원본)
 * @param {Object} chatManager - ChatManager 인스턴스
 * @param {string} generateType - 생성 타입 ('normal' 또는 'continue')
 * @param {Function} tokenCountFn - 토큰 카운팅 함수 (선택사항)
 * @param {boolean} skipGreetingCheck - 그리팅 체크 스킵 여부 (재생성 시 사용)
 * @returns {Promise<void>}
 */
async function sendAIMessage(userMessage, chatManager, generateType = 'normal', tokenCountFn = null, skipGreetingCheck = false) {
    // 정지 신호 확인 (함수 시작 부분에서 체크)
    if (chatManager.abortController?.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
    }
    
    // 설정 로드
    // SettingsStorage, CharacterStorage - 전역 스코프에서 사용
    const settings = await SettingsStorage.load();
    
    // 정지 신호 확인 (비동기 작업 후에도 체크)
    if (chatManager.abortController?.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
    }
    
    const currentCharId = await CharacterStorage.loadCurrent();
    
    // 정지 신호 확인 (CharacterStorage 로드 후에도 체크)
    if (chatManager.abortController?.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
    }

    // 캐릭터 선택 확인
    if (!currentCharId) {
        // 에러 메시지를 토스트 알림으로 표시
        if (typeof showToast === 'function') {
            showToast('캐릭터를 선택해주세요.', 'error');
        } else {
            alert('캐릭터를 선택해주세요.');
        }
        return;
    }

    // 캐릭터 정보 가져오기
    const character = await CharacterStorage.load(currentCharId);
    if (!character) {
        // 에러 메시지를 토스트 알림으로 표시
        if (typeof showToast === 'function') {
            showToast('캐릭터를 불러올 수 없습니다.', 'error');
        } else {
            alert('캐릭터를 불러올 수 없습니다.');
        }
        return;
    }

    const characterName = character?.data?.name || character?.name || 'Character';
    // 캐릭터 아바타 가져오기 (여러 위치 확인)
    const characterAvatar = character?.avatar_image || 
                           character?.avatarImage || 
                           character?.data?.avatar_image ||
                           (character?.avatar && character.avatar !== 'none' ? character.avatar : null) ||
                           null;
    

    // API Provider 및 설정 가져오기
    const apiProvider = settings.apiProvider || 'openai';
    let apiKey = settings.apiKeys?.[apiProvider] || '';
    const model = settings.apiModels?.[apiProvider] || 'gpt-4o';

    // Vertex AI 인증 모드 확인
    if (apiProvider === 'vertexai') {
        const authMode = settings.vertexai_auth_mode || 'express';
        if (authMode === 'full') {
            // Full 모드: Service Account JSON 확인
            const serviceAccountJson = settings.vertexai_service_account_json || '';
            if (!serviceAccountJson) {
                // 에러 메시지를 토스트 알림으로 표시
                if (typeof showToast === 'function') {
                    showToast('Vertex AI Full 모드에는 Service Account JSON이 필요합니다. 설정에서 Service Account JSON을 입력해주세요.', 'error');
                } else {
                    alert('Vertex AI Full 모드에는 Service Account JSON이 필요합니다. 설정에서 Service Account JSON을 입력해주세요.');
                }
                return;
            }
            // Full 모드에서는 apiKey를 null로 설정 (callVertexAI에서 Service Account로 인증)
            apiKey = null;
        } else {
            // Express 모드: API 키 확인
            if (!apiKey) {
                // 에러 메시지를 토스트 알림으로 표시
                if (typeof showToast === 'function') {
                    showToast('Vertex AI Express 모드에는 API 키가 필요합니다. 설정에서 API 키를 입력하거나 Full 모드로 전환해주세요.', 'error');
                } else {
                    alert('Vertex AI Express 모드에는 API 키가 필요합니다. 설정에서 API 키를 입력하거나 Full 모드로 전환해주세요.');
                }
                return;
            }
        }
    } else {
        // 다른 API들은 모두 API 키 필요
        if (!apiKey) {
            // 에러 메시지를 토스트 알림으로 표시
            if (typeof showToast === 'function') {
                showToast(`${apiProvider} API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.`, 'error');
            } else {
                alert(`${apiProvider} API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.`);
            }
            return;
        }
    }

    // PromptManager 인스턴스 생성/가져오기
    // PromptManager - 전역 스코프에서 사용
    const promptManager = new PromptManager();
    
    // PromptManager 초기화 (실리태번 방식)
    const moduleConfiguration = {
        containerIdentifier: 'completion_prompt_manager',
        prefix: 'completion_',
        version: 1,
        promptOrder: {
            strategy: 'global',
            dummyId: 100001,
        },
    };
    
    // 서비스 설정 준비 (실리태번과 동일하게 빈 배열로 초기화)
    const serviceSettings = {
        prompts: settings.prompts ?? [],
        prompt_order: settings.prompt_order ?? [],
    };
    
    
    // PromptManager 초기화 (sanitizeServiceSettings가 기본 프롬프트 추가)
    promptManager.init(moduleConfiguration, serviceSettings);
    
    // 프롬프트는 global이므로 activeCharacter를 dummyCharacter로 설정
    // 실제 캐릭터 데이터는 prepareOpenAIMessagesFromCharacter에서 사용됨
    promptManager.activeCharacter = { id: promptManager.configuration.promptOrder.dummyId };

    // 현재 캐릭터 ID 저장 (채팅 저장용)
    chatManager.currentCharacterId = currentCharId;

    // DOM 업데이트 완료 대기 (addMessage 후 DOM이 반영될 시간 확보)
    // 재생성 시에는 이미 DOM이 업데이트되었지만, 다시 한 번 확실하게 대기
    // 메시지 삭제 후 즉시 새 메시지를 보낼 때를 대비해 더 많은 대기 시간 추가
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));

    // 정지 신호 확인 (DOM 업데이트 대기 후에도 체크)
    if (chatManager.abortController?.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
    }

    // 현재 채팅 히스토리 가져오기 (DOM에서 읽기)
    // 중요: 재생성 시에는 이 시점에서 DOM이 완전히 업데이트되어야 삭제된 메시지가 제외됨
    // getChatHistory() 호출 전에 한 번 더 signal 체크 및 DOM 업데이트 확인
    if (chatManager.abortController?.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
    }
    
    // DOM 업데이트가 완전히 반영되었는지 확인하기 위해 한 번 더 대기
    // (메시지 삭제 후 즉시 새 메시지를 보낼 때를 대비)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    
    console.log('[AIMessageSender] getChatHistory() 호출 전:', {
        userMessage: userMessage?.substring(0, 50) || '(빈 메시지)',
        generateType,
        skipGreetingCheck
    });
    
    const existingChatHistory = chatManager.getChatHistory();
    let chatHistory = [...existingChatHistory];
    
    console.log('[AIMessageSender] getChatHistory() 호출 후:', {
        historyCount: chatHistory.length,
        historyPreview: chatHistory.map(msg => ({
            role: msg.role,
            contentPreview: msg.content?.substring(0, 50) || 'no-content'
        }))
    });
    
    // 그리팅(첫 메시지)이 DOM에 없으면 추가
    // 재생성 시에는 스킵 (삭제된 메시지에 그리팅이 포함되어 있을 수 있음)
    // 중요: 메시지를 삭제한 후 새 메시지를 생성할 때는 그리팅을 추가하지 않아야 함
    // (삭제된 메시지가 그리팅이었을 수 있으므로)
    if (!skipGreetingCheck) {
        // 메시지가 최근에 삭제되었는지 확인
        const messageDeletedRecently = chatManager._messageDeletedRecently || false;
        
        // IndexedDB에 저장된 메시지가 있는지 확인 (채팅이 이미 시작된 경우)
        // currentChatId가 있고 IndexedDB에 메시지가 저장되어 있으면 그리팅을 추가하지 않음
        // 중요: 메시지 삭제 후 saveChat이 메시지를 0개로 저장했으면,
        // IndexedDB에도 메시지가 0개로 저장되어 있어야 함
        // 하지만 saveChat 직후 IndexedDB 쓰기가 완전히 반영되지 않았을 수 있으므로,
        // messageDeletedRecently 플래그도 함께 확인
        let hasStoredMessages = false;
        if (chatManager.currentChatId && !messageDeletedRecently) {
            // 메시지가 최근에 삭제되지 않았을 때만 IndexedDB 확인
            // (삭제 후에는 IndexedDB 확인이 불필요함 - 플래그로 충분)
            try {
                // ChatStorage - 전역 스코프에서 사용
                const storedChatData = await ChatStorage.load(chatManager.currentChatId);
                if (storedChatData && storedChatData.messages && storedChatData.messages.length > 0) {
                    hasStoredMessages = true;
                }
            } catch (error) {
                // 오류가 발생해도 계속 진행
                console.debug('[AIMessageSender] 저장된 채팅 확인 중 오류 (무시):', error);
            }
        }
        
        // ⚠️ 중요: DOM에 그리팅이 있는지 확인 (더보기로 숨겨진 메시지는 확인하지 않음)
        const hasGreetingInDOM = chatHistory.some(m => m.role === 'assistant' && m.content && m.content.trim());
        
        // ⚠️ 중요: this.chat 배열에서 첫 번째 메시지가 assistant인지 확인 (더보기로 숨겨진 메시지도 확인)
        // 불러온 채팅의 경우 더보기로 숨겨진 그리팅이 있을 수 있으므로 this.chat 배열도 확인해야 함
        let hasGreetingInChat = false;
        if (chatManager.chat && chatManager.chat.length > 0) {
            // 첫 번째 메시지가 assistant 메시지인지 확인
            const firstMessage = chatManager.chat[0];
            if (firstMessage && !firstMessage.is_user && firstMessage.mes && firstMessage.mes.trim()) {
                hasGreetingInChat = true;
            }
        }
        
        // IndexedDB에서도 첫 번째 메시지 확인 (더보기로 숨겨진 메시지도 확인)
        let hasGreetingInStorage = false;
        if (chatManager.currentChatId && !messageDeletedRecently && hasStoredMessages) {
            try {
                // ChatStorage - 전역 스코프에서 사용
                const storedChatData = await ChatStorage.load(chatManager.currentChatId);
                if (storedChatData && storedChatData.messages && storedChatData.messages.length > 0) {
                    // 첫 번째 메시지가 assistant 메시지인지 확인
                    const firstStoredMessage = storedChatData.messages[0];
                    if (firstStoredMessage && !firstStoredMessage.is_user && firstStoredMessage.mes && firstStoredMessage.mes.trim()) {
                        hasGreetingInStorage = true;
                    }
                }
            } catch (error) {
                // 오류가 발생해도 계속 진행
                console.debug('[AIMessageSender] 저장된 채팅 확인 중 오류 (무시):', error);
            }
        }
        
        // 그리팅이 있는지 확인 (DOM, this.chat, IndexedDB 모두 확인)
        const hasGreeting = hasGreetingInDOM || hasGreetingInChat || hasGreetingInStorage;
        
        // 그리팅 추가 조건:
        // 1. DOM, this.chat, IndexedDB 모두에 그리팅이 없고
        // 2. 메시지가 최근에 삭제되지 않았고
        // 3. IndexedDB에 저장된 메시지가 없을 때 (완전히 새로운 채팅일 때만)
        // 4. 메시지가 0개일 때만 그리팅 추가 (메시지가 1개 이상이면 이미 채팅이 진행 중이므로 그리팅 추가 안 함)
        const shouldAddGreeting = !hasGreeting && !messageDeletedRecently && !hasStoredMessages && chatHistory.length === 0;
        
        console.log('[AIMessageSender] 그리팅 체크:', {
            hasGreetingInDOM,
            hasGreetingInChat,
            hasGreetingInStorage,
            hasGreeting,
            chatHistoryLength: chatHistory.length,
            chatArrayLength: chatManager.chat?.length || 0,
            messageDeletedRecently,
            hasStoredMessages,
            currentChatId: chatManager.currentChatId,
            willAddGreeting: shouldAddGreeting
        });
        
        if (shouldAddGreeting) {
            const firstMessage = character?.data?.first_mes || character?.first_mes || '';
            if (firstMessage && firstMessage.trim()) {
                // 실리태번과 동일: substituteParams로 매크로 치환 (6792번 라인)
                // substituteParams - 전역 스코프에서 사용
                const processedGreeting = substituteParams(firstMessage.trim(), 'User', characterName);
                chatHistory.unshift({ role: 'assistant', content: processedGreeting });
                
                console.log('[AIMessageSender] 그리팅 추가됨:', {
                    greetingPreview: processedGreeting.substring(0, 50)
                });
            }
        } else {
            if (messageDeletedRecently) {
                console.log('[AIMessageSender] 그리팅 추가 스킵: 메시지가 최근에 삭제됨');
            } else if (hasStoredMessages) {
                console.log('[AIMessageSender] 그리팅 추가 스킵: IndexedDB에 저장된 메시지가 있음 (채팅이 이미 시작됨)');
            }
        }
    }
    
    // 사용자 메시지 확인: getChatHistory()는 DOM에서 읽으므로, 방금 addMessage로 추가한 메시지가 포함되어 있어야 함
    // 하지만 혹시 빠졌을 경우를 대비해 확인하고 추가
    if (userMessage && userMessage.trim()) {
        // 입력창에 텍스트가 있을 때: 새 유저 메시지 추가
        const lastMessage = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
        const needsUserMessage = chatHistory.length === 0 || 
            !lastMessage ||
            lastMessage.role !== 'user' ||
            lastMessage.content !== userMessage;
        
        if (needsUserMessage) {
            // 디버깅: 사용자 메시지가 채팅 히스토리에 없음, 추가함
            console.debug('[AIMessageSender] 사용자 메시지가 채팅 히스토리에 없음, 추가함');
            chatHistory = [...chatHistory, { role: 'user', content: userMessage }];
        }
    }

    // 토큰 카운팅 함수 생성 (실리태번과 동일)
    // 파라미터로 받은 tokenCountFn이 없으면 내부에서 생성
    const finalTokenCountFn = tokenCountFn || (async (message) => {
        try {
            // promptManager.countTokensAsync 사용 (실제 토큰 계산)
            const result = await promptManager.countTokensAsync(message, true);
            return result;
        } catch (error) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_TOKEN_15011', 'AI 메시지 생성 tokenCountFn 오류', error);
            }
            // 폴백: 간단한 추정
            if (Array.isArray(message)) {
                return message.reduce((total, msg) => {
                    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || {});
                    return total + Math.ceil(content.length / 4);
                }, 0);
            }
            const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content || {});
            return Math.ceil(content.length / 4);
        }
    });

    // 상태창/선택지 활성화 여부 확인
    // isStatusBarChoiceEnabled - 전역 스코프에서 사용
    const statusBarChoiceEnabled = await isStatusBarChoiceEnabled();
    const excludeStatusBarChoice = !statusBarChoiceEnabled; // 비활성화되어 있으면 제외
    

    // API Provider와 모델에 맞는 최대 컨텍스트 크기 계산
    // getMaxContextForModel - 전역 스코프에서 사용
    const maxContextUnlocked = settings.max_context_unlocked || settings.oai_max_context_unlocked || false;
    const configuredMaxContext = settings.openai_max_context || 4095;
    const modelMaxContext = getMaxContextForModel(model, apiProvider, maxContextUnlocked);
    // 설정값과 모델 최대값 중 더 작은 값 사용 (모델 한계를 초과하지 않도록)
    const actualMaxContext = Math.min(configuredMaxContext, modelMaxContext);

    // prepareOpenAIMessages 호출
    let messages = null;
    try {
        // prepareOpenAIMessagesFromCharacter에 전달되는 chatHistory 확인
        console.log('[AIMessageSender] prepareOpenAIMessagesFromCharacter 호출 전:', {
            chatHistoryCount: chatHistory.length,
            chatHistoryPreview: chatHistory.map(msg => ({
                role: msg.role,
                contentPreview: msg.content?.substring(0, 50) || 'no-content'
            })),
            generateType: generateType === 'continue' ? 'continue' : 'normal'
        });
        
        // 캐릭터 정보 확인 및 검증
        const actualCharacterName = character?.data?.name || character?.name || 'Character';
        if (actualCharacterName !== characterName) {
            console.warn('[AIMessageSender] 캐릭터 이름 불일치:', {
                expected: characterName,
                actual: actualCharacterName,
                characterId: currentCharId
            });
            // 캐릭터 객체에서 가져온 이름 사용
            characterName = actualCharacterName;
        }
        
        // prepareOpenAIMessagesFromCharacter - 전역 스코프에서 사용
        const [messagesResult, success] = await prepareOpenAIMessagesFromCharacter(
            {
                character,
                chatMetadata: {},
                name1: 'User',
                name2: characterName, // 검증된 캐릭터 이름 사용
                additionalOptions: {
                    messages: chatHistory,
                    type: generateType === 'continue' ? 'continue' : 'normal',
                    excludeStatusBarChoice: excludeStatusBarChoice, // 활성화 여부에 따라 설정
                },
            },
            false, // dryRun = false
            promptManager,
            {
                openai_max_context: actualMaxContext,
                openai_max_tokens: settings.openai_max_tokens || 300,
                temp_openai: settings.temp_openai || 1.0,
                freq_pen_openai: settings.freq_pen_openai || 0.0,
                pres_pen_openai: settings.pres_pen_openai || 0.0,
                top_p_openai: settings.top_p_openai || 1.0,
                // Persona Description 설정 (실리태번과 동일)
                persona_description: settings.persona_description || '',
                persona_description_position: settings.persona_description_position ?? 0,
                // Squash System Messages 설정
                squash_system_messages: settings.squash_system_messages !== false, // 기본값 true
                // Wrap in Quotes 설정
                wrap_in_quotes: settings.wrap_in_quotes || false,
                // Continue Prefill 설정
                continue_prefill: settings.continue_prefill || false,
                // Utility Prompts
                new_chat_prompt: settings.new_chat_prompt || '',
                new_group_chat_prompt: settings.new_group_chat_prompt || '',
                new_example_chat_prompt: settings.new_example_chat_prompt || '[Example Chat]',
                continue_nudge_prompt: settings.continue_nudge_prompt || '',
                wi_format: settings.wi_format || '{0}',
                scenario_format: settings.scenario_format || '{{scenario}}',
                personality_format: settings.personality_format || '{{personality}}',
                group_nudge_prompt: settings.group_nudge_prompt || '',
                impersonation_prompt: settings.impersonation_prompt || '',
                // API Provider와 모델 정보 전달 (컨텍스트 크기 계산용)
                apiProvider: apiProvider,
                model: model,
                max_context_unlocked: settings.max_context_unlocked || settings.oai_max_context_unlocked || false,
            },
            finalTokenCountFn, // 실제 토큰 계산 함수 전달
            generateType // 생성 타입 전달
        );

        messages = messagesResult;
        
        // 디버깅: 최종 메시지 배열 확인 (chatHistory 포함 여부)

        if (!success || !messages || messages.length === 0) {
            // 에러 메시지를 토스트 알림으로 표시
            if (typeof showToast === 'function') {
                showToast('메시지 준비에 실패했습니다.', 'error');
            } else {
                alert('메시지 준비에 실패했습니다.');
            }
            return;
        }
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_AI_5011', 'AI 메시지 준비 오류', error);
        }
        // 에러 메시지를 토스트 알림으로 표시
        if (typeof showToast === 'function') {
            showToast(`메시지 준비 중 오류가 발생했습니다: ${error.message}`, 'error');
        } else {
            alert(`메시지 준비 중 오류가 발생했습니다: ${error.message}`);
        }
        return;
    }

    // messages가 없으면 종료
    if (!messages || messages.length === 0) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_AI_5012', 'AI 메시지가 비어있음');
        }
        // 에러 메시지를 토스트 알림으로 표시
        if (typeof showToast === 'function') {
            showToast('메시지 준비에 실패했습니다.', 'error');
        } else {
            alert('메시지 준비에 실패했습니다.');
        }
        return;
    }

    // API 호출: 스트리밍 설정 확인 (실리태번과 동일)
    // stream_openai 또는 stream_toggle 확인
    const streamEnabled = settings.stream_openai !== undefined 
        ? settings.stream_openai 
        : (settings.stream_toggle !== undefined ? settings.stream_toggle : true); // 기본값 true
    let responseText = '';


    // API 옵션 준비
    const apiOptions = {
        apiKey,
        model,
        messages,
        temperature: settings.temp_openai || 1.0,
        maxTokens: settings.openai_max_tokens || 300,
        stop: [],
        signal: chatManager.abortController?.signal, // AbortSignal 추가
    };
    
    // seed 파라미터 추가 (seed >= 0일 때만 전달, -1이면 무작위 시드이므로 전달하지 않음)
    if (settings.seed !== undefined && settings.seed >= 0) {
        apiOptions.seed = settings.seed;
    }
    
    // 토큰 최적화 옵션 추가 (설정에서 읽기)
    const tokenOptimizationSettings = settings.tokenOptimization || {};
    
    // reasoning_effort는 settings에서 직접 읽기 (프롬프트 패널에서 설정)
    const reasoningEffort = settings.reasoning_effort || settings.openai_reasoning_effort || tokenOptimizationSettings.reasoningEffort;
    
    // Claude/Anthropic 및 OpenRouter용 캐싱 옵션
    if (apiProvider === 'claude' || apiProvider === 'anthropic' || apiProvider === 'openrouter') {
        // 설정에서 읽거나 기본값 사용
        if (typeof tokenOptimizationSettings.cachingAtDepth === 'number') {
            apiOptions.cachingAtDepth = tokenOptimizationSettings.cachingAtDepth;
        }
        if (typeof tokenOptimizationSettings.enableSystemPromptCache === 'boolean') {
            apiOptions.enableSystemPromptCache = tokenOptimizationSettings.enableSystemPromptCache;
        }
        if (typeof tokenOptimizationSettings.extendedTTL === 'boolean') {
            apiOptions.extendedTTL = tokenOptimizationSettings.extendedTTL;
        }
        // Reasoning effort 설정
        if (reasoningEffort) {
            apiOptions.reasoningEffort = reasoningEffort;
        }
    }
    
    // Gemini/Vertex AI용 reasoning 옵션
    if (apiProvider === 'makersuite' || apiProvider === 'gemini' || apiProvider === 'vertexai') {
        if (reasoningEffort) {
            apiOptions.reasoningEffort = reasoningEffort;
        }
        // show_thoughts 체크박스가 체크되어 있으면 includeReasoning 활성화
        const showThoughts = settings.show_thoughts || settings.openai_show_thoughts || false;
        if (showThoughts) {
            apiOptions.includeReasoning = true;
        } else if (typeof tokenOptimizationSettings.includeReasoning === 'boolean') {
            apiOptions.includeReasoning = tokenOptimizationSettings.includeReasoning;
        }
    }

    // 웹 검색 활성화 (지원되는 API에만)
    const enableWebSearch = settings.enable_web_search || settings.openai_enable_web_search || false;
    if (enableWebSearch && ['makersuite', 'vertexai', 'aimlapi', 'openrouter', 'claude', 'xai', 'electronhub', 'nanogpt'].includes(apiProvider)) {
        apiOptions.enableWebSearch = true;
    }

    // 함수 호출 활성화 (지원되는 API에만)
    const functionCalling = settings.function_calling || settings.openai_function_calling || false;
    if (functionCalling && ['openai', 'cohere', 'mistralai', 'custom', 'claude', 'aimlapi', 'openrouter', 'groq', 'deepseek', 'makersuite', 'vertexai', 'ai21', 'xai', 'pollinations', 'moonshot', 'fireworks', 'cometapi', 'electronhub', 'azure_openai', 'zai'].includes(apiProvider)) {
        apiOptions.functionCalling = true;
    }

    // 이미지 인라이닝 활성화 (지원되는 API에만, 메시지 준비는 별도 처리 필요)
    const imageInlining = settings.image_inlining || settings.openai_image_inlining || false;
    if (imageInlining && ['openai', 'aimlapi', 'openrouter', 'mistralai', 'makersuite', 'vertexai', 'claude', 'custom', 'xai', 'pollinations', 'moonshot', 'cohere', 'cometapi', 'nanogpt', 'electronhub', 'azure_openai', 'zai'].includes(apiProvider)) {
        apiOptions.imageInlining = true;
    }

    // 비디오 인라이닝 활성화 (지원되는 API에만, 메시지 준비는 별도 처리 필요)
    const videoInlining = settings.video_inlining || settings.openai_video_inlining || false;
    if (videoInlining && ['makersuite', 'vertexai'].includes(apiProvider)) {
        apiOptions.videoInlining = true;
    }

    // 이미지 요청 활성화 (지원되는 API에만)
    const requestImages = settings.request_images || settings.openai_request_images || false;
    if (requestImages && ['makersuite', 'vertexai'].includes(apiProvider)) {
        apiOptions.requestImages = true;
    }

    // 시스템 프롬프트 사용 (Gemini/Vertex AI, Claude)
    const useSysprompt = settings.use_sysprompt || settings.use_makersuite_sysprompt || settings.claude_use_sysprompt || false;
    if (useSysprompt && ['makersuite', 'vertexai', 'claude', 'anthropic'].includes(apiProvider)) {
        apiOptions.useSysprompt = true;
    }

    // Vertex AI 특수 옵션
    if (apiProvider === 'vertexai') {
        apiOptions.authMode = settings.vertexai_auth_mode || 'express';
        apiOptions.region = settings.vertexai_region || 'us-central1';
        apiOptions.projectId = settings.vertexai_express_project_id || null;
        if (apiOptions.authMode === 'full') {
            apiOptions.serviceAccountJson = settings.vertexai_service_account_json || null;
        }
    }

    try {
        if (streamEnabled) {
            // 스트리밍 응답 처리
            // generateType 전달 (계속하기 기능에서 사용)
            responseText = await chatManager.callAIWithStreaming(
                apiProvider,
                apiOptions,
                characterName,
                characterAvatar,
                generateType // 계속하기 여부 전달
            );
        } else {
            // 비스트리밍 응답 처리
            console.log('[AIMessageSender] 비스트리밍 모드로 API 호출:', {
                apiProvider,
                generateType
            });
            
            const response = await chatManager.callAIWithoutStreaming(
                apiProvider,
                apiOptions
            );

            console.log('[AIMessageSender] 비스트리밍 응답 받음:', {
                responseType: typeof response,
                isObject: typeof response === 'object' && response !== null,
                hasText: typeof response === 'object' && response !== null ? !!response.text : false,
                hasReasoning: typeof response === 'object' && response !== null ? !!response.reasoning : false
            });
            
            // response가 객체인지 문자열인지 확인
            let reasoning = null;
            if (typeof response === 'object' && response !== null) {
                responseText = response.text || response.content || '';
                reasoning = response.reasoning || null;
                
                console.log('[AIMessageSender] 비스트리밍 응답에서 추론 확인:', {
                    responseTextLength: responseText.length,
                    responseTextPreview: responseText.substring(0, 200),
                    reasoningLength: reasoning ? reasoning.length : 0,
                    reasoningPreview: reasoning ? reasoning.substring(0, 200) : null,
                    textIncludesReasoning: reasoning && reasoning.trim() ? responseText.includes(reasoning.trim()) : false
                });
                
                // 추론 내용이 텍스트에 포함되어 있으면 제거
                if (reasoning && reasoning.trim()) {
                    const reasoningTrimmed = reasoning.trim();
                    if (responseText.includes(reasoningTrimmed)) {
                        console.log('[AIMessageSender] 비스트리밍: 추론 내용이 텍스트에 포함되어 있음, 제거 시작');
                        
                        // 모든 위치에서 추론 제거
                        let cleanedText = responseText;
                        
                        // 시작 부분에서 제거 (반복)
                        while (cleanedText.startsWith(reasoningTrimmed)) {
                            cleanedText = cleanedText.substring(reasoningTrimmed.length).trim();
                        }
                        
                        // 끝 부분에서 제거 (반복)
                        while (cleanedText.endsWith(reasoningTrimmed)) {
                            cleanedText = cleanedText.substring(0, cleanedText.length - reasoningTrimmed.length).trim();
                        }
                        
                        // 중간 부분에서 제거 (모든 발생)
                        cleanedText = cleanedText.split(reasoningTrimmed).join('').trim();
                        
                        responseText = cleanedText;
                        
                        console.log('[AIMessageSender] 비스트리밍: 추론 제거 후:', {
                            responseTextLength: responseText.length,
                            responseTextPreview: responseText.substring(0, 200)
                        });
                    } else {
                        console.log('[AIMessageSender] 비스트리밍: 추론 내용이 텍스트에 포함되어 있지 않음 (별도 필드로만 옴)');
                    }
                } else {
                    console.log('[AIMessageSender] 비스트리밍: 추론 내용 없음');
                }
            } else {
                responseText = response;
                console.log('[AIMessageSender] 비스트리밍: 문자열 응답 (추론 정보 없음)');
            }

            // 계속하기 모드 처리
            if (generateType === 'continue') {
                // 기존 메시지 찾기
                const chatMessages = chatManager.elements.chatMessages.querySelectorAll('.message-wrapper');
                let existingMessageWrapper = null;
                let existingMessageText = '';
                let continuePostfix = '';
                
                for (let i = chatMessages.length - 1; i >= 0; i--) {
                    const wrapper = chatMessages[i];
                    if (wrapper.dataset.role === 'assistant') {
                        existingMessageWrapper = wrapper;
                        const existingTextElement = wrapper.querySelector('.message-text');
                        if (existingTextElement) {
                            existingMessageText = wrapper.dataset.originalText || existingTextElement.textContent || '';
                        }
                        break;
                    }
                }
                
                // continue_postfix 설정 확인
                try {
                    const settings = await SettingsStorage.load();
                    const postfixValue = settings.continue_postfix || '';
                    continuePostfix = postfixValue;
                } catch (error) {
                    continuePostfix = '';
                }
                
                if (existingMessageWrapper) {
                    // 기존 메시지 업데이트
                    const finalText = existingMessageText + continuePostfix + responseText;
                    existingMessageWrapper.dataset.originalText = finalText;
                    
                    // 메시지 텍스트 업데이트 (정규식 및 포맷팅 적용)
                    const messageTextElement = existingMessageWrapper.querySelector('.message-text');
                    if (messageTextElement) {
                        // getRegexedString, REGEX_PLACEMENT - 전역 스코프에서 사용
                        const processed = await getRegexedString(finalText, REGEX_PLACEMENT.AI_OUTPUT, {
                            characterOverride: characterName || undefined,
                            isMarkdown: true,
                            isPrompt: false,
                            depth: 0
                        });
                        
                        // {{user}}, {{char}} 매크로 치환
                        let userName = '';
                        try {
                            const settings = await SettingsStorage.load();
                            const currentPersonaId = settings.currentPersonaId;
                            if (currentPersonaId) {
                                const persona = await UserPersonaStorage.load(currentPersonaId);
                                if (persona?.name) {
                                    userName = persona.name;
                                }
                            }
                        } catch (error) {
                            // 무시
                        }
                        const processedWithMacros = substituteParams(processed, userName, characterName || '');
                        messageTextElement.innerHTML = messageFormatting(processedWithMacros, userName, characterName || '');
                        chatManager.renderHtmlIframesInElement(messageTextElement);
                        chatManager.scrollToBottom();
                    }
                } else {
                    // 기존 메시지를 찾을 수 없으면 새 메시지 추가
                    await chatManager.addMessage(responseText, 'assistant', characterName, characterAvatar, [], 0, null, null, reasoning);
                }
            } else {
            // 정규식은 addMessage에서 적용되므로 원본 텍스트 전달
            await chatManager.addMessage(responseText, 'assistant', characterName, characterAvatar, [], 0, null, null, reasoning);
            }
        }
    } catch (error) {
        // AbortError는 상위로 전파
        if (error.name === 'AbortError') {
            throw error;
        }
        // 다른 에러는 처리
        throw error;
    }
}

