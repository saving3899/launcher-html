/**
 * 실리태번 파일 불러오기 유틸리티
 * 모든 데이터 타입을 실리태번과 동일한 형식으로 불러오기
 */


/**
 * 캐릭터 카드 불러오기
 * PNG 또는 JSON 파일 지원
 * @param {File} file - 캐릭터 카드 파일
 * @returns {Promise<object>} 불러온 캐릭터 데이터
 */
async function importCharacter(file) {
    try {
        const extension = getFileExtension(file.name);
        let characterData = null;

        if (extension === 'png') {
            // PNG 파일에서 이미지 추출 (Data URL로 변환, 원본 그대로)
            const imageDataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            // PNG 임베드 JSON 추출
            const buffer = await getFileBuffer(file);
            const uint8Array = new Uint8Array(buffer);
            characterData = extractDataFromPng(uint8Array, 'chara');
            
            if (!characterData) {
                throw new Error('PNG 파일에서 캐릭터 데이터를 찾을 수 없습니다');
            }
            
            // 이미지 데이터를 캐릭터 데이터에 추가 (원본 그대로)
            characterData.avatar_image = imageDataUrl;
            characterData.avatarImage = imageDataUrl;
            if (characterData.data) {
                characterData.data.avatar_image = imageDataUrl;
            }
        } else if (extension === 'json') {
            // JSON 파일 파싱
            characterData = await parseJsonFile(file);
            
            // JSON 파일에서 아바타 이미지 추출 및 정규화
            // 여러 위치에서 아바타 확인 (실리태번과 다른 형식 호환)
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
        } else {
            throw new Error('지원하지 않는 파일 형식입니다. PNG 또는 JSON 파일을 사용하세요.');
        }

        // Chara Card V2 형식 검증
        if (characterData.spec !== 'chara_card_v2' && !characterData.data) {
            // v1 형식일 수도 있음, 그대로 사용
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_FILE_20001', 'Chara Card V2 형식이 아님, v1으로 처리');
            }
        }

        // 캐릭터 ID 생성 (파일명 기반 또는 UUID)
        const characterId = generateCharacterId(file.name, characterData);
        
        // 캐릭터 저장
        await CharacterStorage.save(characterId, characterData);
        
        // 캐릭터 한정 정규식 스크립트 저장 (data.extensions.regex_scripts에서 추출)
        // 실리태번 형식: data.extensions.regex_scripts (배열 또는 객체)
        const regexScriptsFromData = characterData?.data?.extensions?.regex_scripts;
        
        // extensions.regex_scripts도 확인 (기존 형식 호환)
        const regexScriptsFromExtensions = characterData?.extensions?.regex_scripts;
        
        // data.extensions.regex_scripts를 우선, 없으면 extensions.regex_scripts 사용
        const regexScripts = regexScriptsFromData || regexScriptsFromExtensions;
        
        if (regexScripts && typeof regexScripts === 'object') {
            try {
                // 배열 형식이면 객체로 변환, 객체 형식이면 그대로 사용
                let scriptsObject = {};
                if (Array.isArray(regexScripts)) {
                    regexScripts.forEach((script) => {
                        if (script && script.id) {
                            scriptsObject[script.id] = script;
                        }
                    });
                } else {
                    scriptsObject = regexScripts;
                }
                
                // 캐릭터 한정 정규식 저장 (extensions.regex_scripts로 저장)
                if (Object.keys(scriptsObject).length > 0) {
                    await RegexScriptStorage.saveCharacterRegex(characterId, scriptsObject);
                }
            } catch (error) {
                // 오류 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('ERR_FILE_6005', '캐릭터 한정 정규식 불러오기 오류', error);
                }
                // 정규식 불러오기 실패해도 캐릭터 불러오기는 계속 진행
            }
        }
        return {
            success: true,
            characterId: characterId,
            characterData: characterData,
        };
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_FILE_6006', '캐릭터 불러오기 오류', error);
        }
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * 실리태번 send_date 형식을 타임스탬프로 변환
 * @param {string|number} sendDate - send_date 값 (October 27, 2025 8:04pm 또는 타임스탬프)
 * @returns {number} 타임스탬프 (밀리초)
 */
function parseSillyTavernSendDate(sendDate) {
    if (!sendDate) return Date.now();
    
    // 숫자면 그대로 반환
    if (typeof sendDate === 'number') {
        return sendDate;
    }
    
    // 문자열이 아니면 현재 시간 반환
    if (typeof sendDate !== 'string') {
        return Date.now();
    }
    
    // 이미 타임스탬프 문자열인 경우
    if (/^\d+$/.test(sendDate.trim())) {
        return parseInt(sendDate, 10);
    }
    
    // 실리태번 humanized 형식: 2024-7-12@01h31m37s 또는 2025-10-27@20h04m52s
    const humanizedPattern = /(\d{4})-(\d{1,2})-(\d{1,2})@(\d{1,2})h(\d{1,2})m(\d{1,2})s/;
    const humanizedMatch = sendDate.match(humanizedPattern);
    if (humanizedMatch) {
        const [, year, month, day, hour, minute, second] = humanizedMatch;
        const date = new Date(
            parseInt(year, 10),
            parseInt(month, 10) - 1,
            parseInt(day, 10),
            parseInt(hour, 10),
            parseInt(minute, 10),
            parseInt(second, 10)
        );
        return date.getTime();
    }
    
    // 실리태번 표시 형식: October 27, 2025 8:04pm
    const meridiemPattern = /(\w+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{1,2})(am|pm)/i;
    const meridiemMatch = sendDate.match(meridiemPattern);
    if (meridiemMatch) {
        const [, monthName, day, year, hour, minute, meridiem] = meridiemMatch;
        const monthNames = [
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'
        ];
        const monthIndex = monthNames.indexOf(monthName.toLowerCase());
        if (monthIndex !== -1) {
            let hour24 = parseInt(hour, 10);
            if (meridiem.toLowerCase() === 'pm' && hour24 !== 12) {
                hour24 += 12;
            } else if (meridiem.toLowerCase() === 'am' && hour24 === 12) {
                hour24 = 0;
            }
            const date = new Date(
                parseInt(year, 10),
                monthIndex,
                parseInt(day, 10),
                hour24,
                parseInt(minute, 10)
            );
            return date.getTime();
        }
    }
    
    // ISO 8601 형식 시도
    const isoDate = new Date(sendDate);
    if (!isNaN(isoDate.getTime())) {
        return isoDate.getTime();
    }
    
    // 파싱 실패 시 현재 시간 반환
    // 경고 코드 토스트 알림 표시
    if (typeof showErrorCodeToast === 'function') {
        showErrorCodeToast('WARN_FILE_20002', 'send_date 파싱 실패, 현재 시간 사용');
    }
    return Date.now();
}

/**
 * 캐릭터 이름으로 캐릭터 찾기
 * @param {string} characterName - 캐릭터 이름
 * @returns {Promise<string|null>} 캐릭터 ID 또는 null
 */
async function findCharacterByName(characterName) {
    if (!characterName) return null;
    
    const allCharacters = await CharacterStorage.loadAll();
    
    // 정확한 이름 매칭 시도
    for (const [id, char] of Object.entries(allCharacters)) {
        const charName = char?.data?.name || char?.name || '';
        if (charName === characterName) {
            return id;
        }
    }
    
    // 부분 매칭 시도 (대소문자 무시)
    const lowerName = characterName.toLowerCase();
    for (const [id, char] of Object.entries(allCharacters)) {
        const charName = (char?.data?.name || char?.name || '').toLowerCase();
        if (charName === lowerName) {
            return id;
        }
    }
    
    return null;
}

/**
 * 채팅 데이터 불러오기
 * JSONL 형식 지원 (실리태번 호환)
 * @param {File} file - JSONL 채팅 파일
 * @returns {Promise<object>} 불러온 채팅 데이터
 */
async function importChat(file) {
    try {
        const extension = getFileExtension(file.name);
        
        if (extension !== 'jsonl') {
            throw new Error('채팅 데이터는 JSONL 형식이어야 합니다.');
        }

        // JSONL 파싱
        const { metadata, messages } = await parseJsonlFile(file);
        
        // 캐릭터 찾기 또는 알림
        const characterName = metadata.character_name || '';
        let characterId = null;
        
        if (characterName) {
            characterId = await findCharacterByName(characterName);
            if (!characterId) {
                // 캐릭터가 없으면 알림 (하지만 채팅은 저장함)
                const message = `캐릭터 "${characterName}"을(를) 찾을 수 없습니다.\n` +
                              `채팅은 불러오지만, 해당 캐릭터를 먼저 추가해야 정상적으로 사용할 수 있습니다.`;
                showToast(message, 'warning');
                // 경고 코드 토스트 알림 표시
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_FILE_20003', `캐릭터를 찾을 수 없음: ${characterName}`);
                }
            }
        }
        
        // create_date 파싱 (실리태번 형식: 2025-10-27@20h04m52s)
        let createDate = Date.now();
        if (metadata.create_date) {
            createDate = parseSillyTavernSendDate(metadata.create_date);
        }
        
        // 메시지 변환: send_date 파싱 및 형식 변환
        const convertedMessages = messages.map(msg => {
            const converted = {
                ...msg,
                send_date: parseSillyTavernSendDate(msg.send_date),
                uuid: msg.uuid || null, // UUID가 없으면 null
            };
            
            // 실리태번 형식: name, is_user 필드가 있음
            // 우리 형식과 호환되도록 유지 (loadChat에서 처리)
            
            return converted;
        });
        
        // send_date 기준으로 정렬 (실리태번과 동일)
        convertedMessages.sort((a, b) => (a.send_date || 0) - (b.send_date || 0));
        
        // 채팅 이름 생성
        const chatName = characterName 
            ? `${characterName} - ${humanizedDateTime()}`
            : `Imported Chat - ${humanizedDateTime()}`;
        
        // 채팅 ID 생성
        const chatId = characterId 
            ? `${characterId}_${chatName.replace(/[^a-zA-Z0-9가-힣]/g, '_')}`
            : generateChatId(metadata, file.name);
        
        // 채팅 데이터 구성 (우리 형식)
        const chatData = {
            characterId: characterId, // 없으면 null
            chatName: chatName,
            metadata: {
                user_name: metadata.user_name || 'User',
                character_name: characterName,
                create_date: createDate,
                chat_metadata: metadata.chat_metadata || {},
            },
            messages: convertedMessages,
            lastMessageDate: convertedMessages.length > 0 
                ? convertedMessages[convertedMessages.length - 1].send_date 
                : createDate,
        };
        
        // 채팅 저장
        await ChatStorage.save(chatId, chatData);
        
        return {
            success: true,
            chatId: chatId,
            characterId: characterId,
            characterName: characterName,
            metadata: chatData.metadata,
            messageCount: convertedMessages.length,
            hasCharacter: !!characterId,
        };
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_FILE_6007', '채팅 불러오기 오류', error);
        }
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * 월드인포 불러오기
 * JSON 형식 지원
 * @param {File} file - 월드인포 JSON 파일
 * @returns {Promise<object>} 불러온 월드인포 데이터
 */
async function importWorldInfo(file) {
    try {
        const extension = getFileExtension(file.name);
        
        if (extension !== 'json') {
            throw new Error('월드인포는 JSON 형식이어야 합니다.');
        }

        const worldInfo = await parseJsonFile(file);
        
        // 월드인포 구조 검증
        if (!worldInfo.entries && typeof worldInfo.entries !== 'object') {
            throw new Error('월드인포 형식이 올바르지 않습니다.');
        }
        
        // 월드인포 저장
        await WorldInfoStorage.save(worldInfo);
        
        return {
            success: true,
            entryCount: Object.keys(worldInfo.entries || {}).length,
        };
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_FILE_6008', '월드인포 불러오기 오류', error);
        }
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Quick Reply 불러오기
 * JSON 형식 지원 (Quick Reply V2)
 * @param {File} file - Quick Reply JSON 파일
 * @returns {Promise<object>} 불러온 Quick Reply 데이터
 */
async function importQuickReply(file) {
    try {
        const extension = getFileExtension(file.name);
        
        if (extension !== 'json') {
            throw new Error('Quick Reply는 JSON 형식이어야 합니다.');
        }

        const quickReply = await parseJsonFile(file);
        
        // Quick Reply V2 형식 검증
        if (quickReply.version !== 2) {
            // 경고 코드 토스트 알림 표시
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_FILE_20004', `Quick Reply V2 형식이 아님 (버전: ${quickReply.version})`);
            }
        }
        
        // Quick Reply 저장
        await QuickReplyStorage.save(quickReply);
        
        return {
            success: true,
            version: quickReply.version || 1,
            setCount: (quickReply.setList || []).length,
        };
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_FILE_6009', 'Quick Reply 불러오기 오류', error);
        }
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * 유저 페르소나 불러오기
 * JSON 형식 지원
 * @param {File} file - 페르소나 JSON 파일
 * @returns {Promise<object>} 불러온 페르소나 데이터
 */
async function importPersona(file) {
    try {
        const extension = getFileExtension(file.name);
        
        if (extension !== 'json') {
            throw new Error('페르소나는 JSON 형식이어야 합니다.');
        }

        const personaData = await parseJsonFile(file);
        
        // 페르소나 ID 생성
        const personaId = generatePersonaId(file.name, personaData);
        
        // 페르소나 저장
        await UserPersonaStorage.save(personaId, personaData);
        
        return {
            success: true,
            personaId: personaId,
        };
    } catch (error) {
        // 오류 코드 토스트 알림 표시
        if (typeof showErrorCodeToast === 'function') {
            showErrorCodeToast('ERR_FILE_6010', '페르소나 불러오기 오류', error);
        }
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * 캐릭터 ID 생성
 * @param {string} fileName - 파일명
 * @param {object} characterData - 캐릭터 데이터
 * @returns {string} 캐릭터 ID
 */
function generateCharacterId(fileName, characterData) {
    // 캐릭터 이름 사용 (있는 경우)
    const name = characterData?.data?.name || characterData?.name || '';
    const sanitizedName = name.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    
    // 타임스탬프 추가
    const timestamp = Date.now();
    
    return sanitizedName ? `${sanitizedName}_${timestamp}` : `character_${timestamp}`;
}

/**
 * 채팅 ID 생성
 * @param {object} metadata - 채팅 메타데이터
 * @param {string} fileName - 파일명
 * @returns {string} 채팅 ID
 */
function generateChatId(metadata, fileName) {
    // 메타데이터에서 이름 사용
    const chatName = metadata.character_name || metadata.user_name || '';
    const sanitizedName = chatName.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    
    // 타임스탬프 추가
    const timestamp = metadata.create_date ? new Date(metadata.create_date).getTime() : Date.now();
    
    return sanitizedName ? `${sanitizedName}_${timestamp}` : `chat_${timestamp}`;
}

/**
 * 페르소나 ID 생성
 * @param {string} fileName - 파일명
 * @param {object} personaData - 페르소나 데이터
 * @returns {string} 페르소나 ID
 */
function generatePersonaId(fileName, personaData) {
    const name = personaData?.name || '';
    const sanitizedName = name.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const timestamp = Date.now();
    
    return sanitizedName ? `${sanitizedName}_${timestamp}` : `persona_${timestamp}`;
}

/**
 * 파일 타입 자동 감지 및 불러오기
 * @param {File} file - 불러올 파일
 * @returns {Promise<object>} 불러오기 결과
 */
async function autoImport(file) {
    const extension = getFileExtension(file.name);
    
    // 파일명으로 타입 추론
    const fileName = file.name.toLowerCase();
    
    if (fileName.includes('character') || fileName.includes('chara') || extension === 'png') {
        return await importCharacter(file);
    } else if (fileName.includes('chat') || fileName.includes('conversation') || extension === 'jsonl') {
        return await importChat(file);
    } else if (fileName.includes('world') || fileName.includes('lorebook') || fileName.includes('wi_')) {
        return await importWorldInfo(file);
    } else if (fileName.includes('quick') || fileName.includes('qr_')) {
        return await importQuickReply(file);
    } else if (fileName.includes('persona') || fileName.includes('user_')) {
        return await importPersona(file);
    } else if (extension === 'json') {
        // JSON 파일이면 내용을 보고 판단
        try {
            const data = await parseJsonFile(file);
            
            if (data.spec === 'chara_card_v2' || data.data) {
                // 캐릭터 카드로 처리
                return await importCharacter(file);
            } else if (data.version === 2 && data.setList) {
                // Quick Reply로 처리
                return await importQuickReply(file);
            } else if (data.entries) {
                // 월드인포로 처리
                return await importWorldInfo(file);
            } else {
                // 페르소나로 처리
                return await importPersona(file);
            }
        } catch (error) {
            return {
                success: false,
                error: `파일 타입을 자동 감지할 수 없습니다: ${error.message}`,
            };
        }
    }
    
    return {
        success: false,
        error: '지원하지 않는 파일 형식입니다.',
    };
}

