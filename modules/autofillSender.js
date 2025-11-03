/**
 * 대필 메시지 전송 모듈
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
 * - 대필 기능도 동일한 문제 발생
 * 
 * [원인]
 * 1. populateChatHistory에서 promptManager.preparePrompt()가 Prompt 객체를 반환하는데,
 *    getRegexedString()에 Prompt 객체 전체를 전달하여 "rawString is not a string" 오류 발생
 * 2. newChatMessage가 빈 문자열일 때 null 체크 누락으로 인한 오류
 * 3. DOM 업데이트 완료 전에 getChatHistory() 호출로 인한 메시지 누락
 * 
 * [해결]
 * 1. promptManager.preparePrompt()의 반환값에서 .content를 추출하여 getRegexedString()에 전달
 * 2. newChatMessage null 체크 추가
 * 3. DOM 업데이트 완료 대기 로직 추가 (requestAnimationFrame)
 * 4. chatHistory 프롬프트 마커가 없어도 메시지 추가되도록 수정
 * 5. sendMessage에서 원본 텍스트를 addMessage에 전달하도록 수정
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
 * 6. 대필 지시문은 chatHistory 배열에 role: 'user'로 추가되어야 함
 *    (실리태번의 impersonate와 동일한 방식)
 * 
 * 7. 이 함수는 chatManager 인스턴스의 메서드를 호출하므로 (getChatHistory 등),
 *    ChatManager 인스턴스를 매개변수로 받아야 함
 * 
 * ===========================================
 */

/**
 * 대필용 AI 응답 생성
 * @param {string} userMessage - 대필 지시문이 포함된 사용자 메시지
 * @param {Object} chatManager - ChatManager 인스턴스
 * @returns {Promise<string>} AI 응답 텍스트
 */
async function sendAIMessageForAutofill(userMessage, chatManager) {
    // 설정 로드
    // SettingsStorage, CharacterStorage - 전역 스코프에서 사용
    const settings = await SettingsStorage.load();

    // 현재 캐릭터 확인
    const currentCharId = await CharacterStorage.loadCurrent();
    if (!currentCharId) {
        throw new Error('캐릭터를 선택해주세요.');
    }

    const character = await CharacterStorage.load(currentCharId);
    if (!character) {
        throw new Error('캐릭터를 불러올 수 없습니다.');
    }

    const characterName = character?.data?.name || character?.name || 'Character';
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
            const serviceAccountJson = settings.vertexai_service_account_json || '';
            if (!serviceAccountJson) {
                throw new Error('Vertex AI Full 모드에는 Service Account JSON이 필요합니다.');
            }
            apiKey = null;
        } else {
            if (!apiKey) {
                throw new Error(`${apiProvider} API 키가 설정되지 않았습니다.`);
            }
        }
    } else {
        if (!apiKey) {
            throw new Error(`${apiProvider} API 키가 설정되지 않았습니다.`);
        }
    }

    // prepareOpenAIMessages 호출 (일반 메시지 전송과 동일)
    // prepareOpenAIMessagesFromCharacter - 전역 스코프에서 사용
    
    // 현재 페르소나 아바타 가져오기
    let userAvatar = null;
    // UserPersonaStorage - 전역 스코프에서 사용
    const currentPersonaId = settings.currentPersonaId;
    if (currentPersonaId) {
        const persona = await UserPersonaStorage.load(currentPersonaId);
        if (persona && persona.avatar) {
            userAvatar = persona.avatar;
        }
    }

    // DOM 업데이트 완료 대기 (일반 메시지 전송과 동일하게 3번의 requestAnimationFrame)
    // 중요: DOM이 완전히 업데이트되어야 getChatHistory()가 정확한 메시지를 읽을 수 있음
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    // DOM에서 메시지 래퍼 확인 (디버깅)
    // (로그 제거됨)

    // 채팅 히스토리 가져오기
    // 중요: getChatHistory()는 DOM에서만 읽으므로, 대필 지시문이나 대필 결과는 포함되지 않음
    // (대필 지시문은 DOM에 추가되지 않으며, 대필 결과는 messageInput에만 입력됨)
    // 또한 삭제/수정된 메시지는 DOM에서 제거/업데이트되므로 자동으로 제외됨
    const existingChatHistory = chatManager.getChatHistory();
    let chatHistory = [...existingChatHistory];
    

    // 그리팅(첫 메시지)이 DOM에 없으면 추가
    const hasGreeting = chatHistory.some(m => m.role === 'assistant' && m.content && m.content.trim());
    if (!hasGreeting) {
        const firstMessage = character?.data?.first_mes || character?.first_mes || '';
        if (firstMessage && firstMessage.trim()) {
            // substituteParams - 전역 스코프에서 사용
            const processedGreeting = substituteParams(firstMessage.trim(), 'User', characterName);
            chatHistory.unshift({ role: 'assistant', content: processedGreeting });
        }
    }

    // 대필 지시문을 유저 메시지로 추가 (프롬프트에 전달하기 위해 임시 배열에만 추가)
    // 중요: 이 메시지는 DOM에 추가되지 않으며, 채팅 히스토리에 포함되지 않음
    // (getChatHistory()는 DOM만 읽으므로 대필 지시문은 읽지 않음)
    chatHistory.push({ role: 'user', content: userMessage });

    // 프롬프트 준비
    let messages = null;
    try {
        // PromptManager - 전역 스코프에서 사용
        const promptManager = new PromptManager();
        
        // 페르소나 이름 가져오기 ({{user}} 치환용)
        let userName = 'User';
        // UserPersonaStorage - 전역 스코프에서 사용
        const currentPersonaId = settings.currentPersonaId;
        if (currentPersonaId) {
            const persona = await UserPersonaStorage.load(currentPersonaId);
            if (persona && persona.name) {
                userName = persona.name;
            }
        }

        // PromptManager 초기화 (일반 메시지 전송과 동일한 방식)
        // 실리태번과 동일: moduleConfiguration에 containerIdentifier, prefix, version, promptOrder 명시
        const moduleConfiguration = {
            containerIdentifier: 'completion_prompt_manager',
            prefix: 'completion_',
            version: 1,
            promptOrder: {
                strategy: 'global',
                dummyId: 100001,
            },
            name1: userName,
            name2: characterName,
        };
        
        // 서비스 설정 준비 (일반 메시지 전송과 동일하게 prompts와 prompt_order만 추출)
        // 중요: 전체 settings 객체를 전달하지 않고 필요한 부분만 추출하여 프롬프트 관리가 올바르게 작동하도록 함
        const serviceSettings = {
            prompts: settings.prompts ?? [],
            prompt_order: settings.prompt_order ?? [],
        };
        
        
        // PromptManager 초기화 (sanitizeServiceSettings가 기본 프롬프트 추가)
        await promptManager.init(moduleConfiguration, serviceSettings);
        
        // 프롬프트는 global이므로 activeCharacter를 dummyCharacter로 설정
        // 실제 캐릭터 데이터는 prepareOpenAIMessagesFromCharacter에서 사용됨
        promptManager.activeCharacter = { id: promptManager.configuration.promptOrder.dummyId };

        // 토큰 카운팅 함수 생성 (실리태번과 동일)
        const tokenCountFn = async (message) => {
            try {
                // promptManager.countTokensAsync 사용 (실제 토큰 계산)
                const result = await promptManager.countTokensAsync(message, true);
                return result;
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_TOKEN_15010', '대필 tokenCountFn 오류', error);
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
        };

        const [preparedMessages, success] = await prepareOpenAIMessagesFromCharacter(
            {
                character,
                chatMetadata: {},
                name1: userName, // 페르소나 이름 사용
                name2: characterName,
                additionalOptions: {
                    messages: chatHistory,
                    type: 'normal', // 대필은 항상 normal 타입
                    excludeStatusBarChoice: true, // 대필 요청 시 상태창/선택지 지시문 제외
                },
            },
            false, // dryRun = false
            promptManager,
            {
                openai_max_context: settings.openai_max_context || 4095,
                openai_max_tokens: settings.openai_max_tokens || 300,
                temp_openai: settings.temp_openai || 1.0,
                freq_pen_openai: settings.freq_pen_openai || 0.0,
                pres_pen_openai: settings.pres_pen_openai || 0.0,
                top_p_openai: settings.top_p_openai || 1.0,
                persona_description: settings.persona_description || '',
                persona_description_position: settings.persona_description_position ?? 0,
                squash_system_messages: settings.squash_system_messages !== false,
            },
            tokenCountFn, // 실제 토큰 계산 함수 전달
            'normal' // generateType
        );

        messages = preparedMessages;
        
        // 성공 여부 확인
        if (!success || !messages || messages.length === 0) {
            // 오류 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('ERR_AI_5007', '대필 메시지 준비 실패');
            }
            throw new Error('메시지 준비에 실패했습니다.');
        }
        
        // 디버깅: 대필 지시문 포함 여부 확인 및 채팅 히스토리 포함 여부 확인
        const autofillMessageInMessages = messages?.find(m => m.role === 'user' && m.content && m.content.includes(userMessage));
        const allUserMessages = messages?.filter(m => m.role === 'user') || [];
        const allAssistantMessages = messages?.filter(m => m.role === 'assistant') || [];
        
        // 채팅 히스토리 메시지 개수 확인 (그리팅 + 실제 채팅 메시지)
        const expectedChatHistoryCount = chatHistory.filter(m => m.role === 'user' || m.role === 'assistant').length;
        const actualChatHistoryCount = allUserMessages.length + allAssistantMessages.length;
        
        // 모든 메시지 배열 상세 확인
        const allMessagesDetailed = messages?.map((m, idx) => ({
            index: idx,
            role: m?.role,
            content: m?.content?.substring(0, 120) + '...',
            name: m?.name,
            fullContentLength: m?.content?.length || 0
        })) || [];
        
        // 디버깅: Prepared messages 상세 확인
        // (로그 제거됨)
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_AI_5008', '대필 메시지 준비 오류', error);
        }
        throw error;
    }

    if (!messages || messages.length === 0) {
        throw new Error('메시지 준비에 실패했습니다.');
    }

    // API 호출 옵션
    // 대필은 긴 응답이 필요하므로 최소값 1024로 설정 (설정값이 더 크면 그것 사용)
    const defaultMaxTokens = settings.openai_max_tokens || 300;
    const autofillMaxTokens = Math.max(defaultMaxTokens, 1024);
    
    if (defaultMaxTokens < 1024) {
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_AI_20006', `대필 max_tokens가 너무 낮음 (${defaultMaxTokens}), 최소 1024 권장`);
        }
    }
    
    const apiOptions = {
        messages: messages,
        model: model,
        temperature: settings.temp_openai || 1.0,
        maxTokens: autofillMaxTokens, // Vertex AI는 maxTokens 사용
        apiKey: apiKey,
        stop: [],
        signal: chatManager.abortController?.signal,
    };

    // Vertex AI 특수 옵션
    if (apiProvider === 'vertexai') {
        apiOptions.authMode = settings.vertexai_auth_mode || 'express';
        apiOptions.region = settings.vertexai_region || 'us-central1';
        apiOptions.projectId = settings.vertexai_express_project_id || null;
        if (apiOptions.authMode === 'full') {
            apiOptions.serviceAccountJson = settings.vertexai_service_account_json || null;
        }
    }

    // 디버깅: 전송할 메시지 배열 상세 확인
    // (로그 제거됨)

    // 비스트리밍 응답 처리 (대필은 즉시 결과가 필요)
    let responseText = null;
    try {
        responseText = await chatManager.callAIWithoutStreaming(apiProvider, apiOptions);
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_AI_5009', '대필 API 호출 오류', error);
        }
        throw error;
    }

    if (!responseText || !responseText.trim()) {
        // 경고 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('WARN_AI_20007', '대필 API 빈 응답');
        }
        throw new Error('AI 응답이 비어있습니다.');
    }

    return responseText;
}

