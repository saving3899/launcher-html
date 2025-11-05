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
 * 
 * ⚠️ 중요: 이 함수는 chatManager.js의 다음 기능들과 강하게 연동되어 있습니다.
 * 
 * [연동 기능]
 * 1. loadOrCreateChat: 불러온 채팅이 가장 최근 채팅이 되도록 imported_date를 lastMessageDate로 설정
 * 2. loadChat: 불러온 채팅 로드 후 character.chat 업데이트 필수 (홈화면 나갔다가 다시 들어올 때 자동 로드)
 * 3. saveChat: 불러온 채팅은 DOM 메시지와 저장소 메시지 병합 시 모든 메시지 보존
 * 
 * [수정 시 주의사항]
 * - imported_date 설정 변경 시 → loadOrCreateChat의 정렬 로직 확인
 *   * 불러온 채팅: lastMessageDate = imported_date (Date.now()로 설정)
 * - chatId 생성 로직 변경 시 → loadOrCreateChat에서 채팅 찾기 로직 확인
 * - character.chat 업데이트: fileManager.js에서 loadChat 호출 후 자동으로 업데이트됨
 *   * loadChat에서 character.chat = this.currentChatName 업데이트 확인
 * 
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
        
        // 현재 페르소나 정보 가져오기 (유저 메시지 아바타 매칭용)
        let currentPersona = null;
        try {
            // SettingsStorage, UserPersonaStorage - 전역 스코프에서 사용
            const settings = await SettingsStorage.load();
            const currentPersonaId = settings.currentPersonaId;
            if (currentPersonaId) {
                currentPersona = await UserPersonaStorage.load(currentPersonaId);
            }
        } catch (error) {
            // 페르소나 로드 실패는 무시 (기존 동작 유지)
            console.debug('[importChat] 페르소나 로드 실패 (무시):', error);
        }
        
        // 메시지 변환: send_date 파싱 및 형식 변환
        const convertedMessages = messages.map(msg => {
            try {
                const converted = {
                    ...msg,
                    send_date: parseSillyTavernSendDate(msg.send_date),
                    uuid: msg.uuid || null, // UUID가 없으면 null
                };
                
                // 실리태번 형식: name, is_user 필드가 있음
                // 우리 형식과 호환되도록 유지 (loadChat에서 처리)
                
                // 유저 메시지이고 현재 페르소나 이름과 일치하면 아바타 이미지 업데이트
                if (converted.is_user && currentPersona) {
                    const userName = converted.name || '';
                    const personaName = currentPersona.name || '';
                    
                    // 이름이 일치하고 페르소나에 아바타가 있으면 force_avatar 업데이트
                    // 중요: 페르소나 아바타는 반드시 실제 이미지 URL (data:, http://, https://)로 저장
                    if (userName === personaName && currentPersona.avatar) {
                        // 페르소나 아바타가 실제 URL 형식인지 확인
                        if (currentPersona.avatar.startsWith('data:') || 
                            currentPersona.avatar.startsWith('http://') || 
                            currentPersona.avatar.startsWith('https://')) {
                            converted.force_avatar = currentPersona.avatar;
                            console.debug('[importChat] 페르소나 아바타 업데이트:', {
                                userName,
                                personaName,
                                avatarUrl: currentPersona.avatar.substring(0, 50)
                            });
                        } else {
                            // 아바타가 URL 형식이 아니면 저장하지 않음 (loadChat에서 처리)
                            console.debug('[importChat] 페르소나 아바타가 URL 형식이 아님, loadChat에서 처리:', currentPersona.avatar.substring(0, 50));
                        }
                    }
                }
                
                return converted;
            } catch (error) {
                // 메시지 변환 실패 시 경고 로그 출력 후 원본 메시지 반환
                console.warn('[importChat] 메시지 변환 실패, 원본 메시지 사용:', error, msg);
                if (typeof showErrorCodeToast === 'function') {
                    showErrorCodeToast('WARN_FILE_20008', `메시지 변환 실패: ${error.message}`);
                }
                return {
                    ...msg,
                    send_date: msg.send_date ? parseSillyTavernSendDate(msg.send_date) : Date.now(),
                    uuid: msg.uuid || null,
                };
            }
        }).filter(msg => msg !== null && msg !== undefined); // null/undefined 메시지 제거
        
        console.log('[importChat] 메시지 변환 완료:', {
            originalMessageCount: messages.length,
            convertedMessageCount: convertedMessages.length,
            characterName: characterName
        });
        
        // 실리태번 JSONL 파일은 메시지가 이미 시간 순서로 저장되어 있음
        // 따라서 파일 순서를 유지하는 것이 정확함
        // send_date 기준으로 정렬하지 않고 파일 순서 그대로 사용
        // (정렬하면 메시지 순서가 꼬일 수 있음)
        
        // 불러오기한 채팅의 고유 ID 생성: 원본 채팅의 create_date와 character_name 사용
        // 같은 파일을 다시 불러와도 같은 chatId를 생성하여 중복 방지
        const originalCreateDate = createDate;
        // create_date가 문자열인지 확인하고, 아닐 경우 문자열로 변환
        let originalCreateDateStr = '';
        if (metadata.create_date) {
            if (typeof metadata.create_date === 'string') {
                originalCreateDateStr = metadata.create_date;
            } else if (typeof metadata.create_date === 'number') {
                originalCreateDateStr = new Date(metadata.create_date).toISOString();
            } else {
                originalCreateDateStr = String(metadata.create_date);
            }
        } else if (originalCreateDate) {
            originalCreateDateStr = new Date(originalCreateDate).toISOString();
        }
        
        // 채팅 이름 생성: 원본 채팅 이름이 있으면 사용, 없으면 생성 날짜 기반
        let chatName = '';
        if (metadata.chat_metadata?.title) {
            chatName = metadata.chat_metadata.title;
        } else if (originalCreateDateStr) {
            // create_date를 읽기 가능한 형식으로 변환
            try {
                const date = new Date(originalCreateDate);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hour = String(date.getHours()).padStart(2, '0');
                const minute = String(date.getMinutes()).padStart(2, '0');
                const second = String(date.getSeconds()).padStart(2, '0');
                chatName = characterName 
                    ? `${characterName} - ${year}-${month}-${day}@${hour}h${minute}m${second}s`
                    : `Imported Chat - ${year}-${month}-${day}@${hour}h${minute}m${second}s`;
            } catch (e) {
                // 날짜 파싱 실패 시 현재 시간 사용
                chatName = characterName 
                    ? `${characterName} - ${humanizedDateTime()}`
                    : `Imported Chat - ${humanizedDateTime()}`;
            }
        } else {
            chatName = characterName 
            ? `${characterName} - ${humanizedDateTime()}`
            : `Imported Chat - ${humanizedDateTime()}`;
        }
        
        // ⚠️ 중요: 같은 제목(chatName)인 채팅이 있는지 확인하여 중복 방지
        // 같은 characterId이고 같은 chatName인 채팅이 있으면 제목에 숫자 추가
        // ChatStorage - 전역 스코프에서 사용
        const allChats = await ChatStorage.loadAll();
        
        // 같은 제목인 채팅 찾기 (같은 캐릭터의 채팅만 확인)
        const duplicateNameChats = Object.values(allChats)
            .filter(chat => {
                if (!chat || chat === null) return false;
                // 같은 캐릭터의 채팅만 확인
                const chatCharId = chat.characterId || chat.metadata?.characterId;
                if (chatCharId !== characterId) return false;
                // 같은 제목인지 확인
                return chat.chatName === chatName;
            });
        
        // 같은 제목인 채팅이 있으면 제목에 숫자 추가
        let finalChatName = chatName;
        if (duplicateNameChats.length > 0) {
            const originalChatName = chatName; // 원본 제목 저장
            let counter = 2;
            let candidateName = `${originalChatName} (${counter})`;
            // allChats에서 직접 확인하여 더 안전하게 처리
            while (Object.values(allChats).some(chat => {
                if (!chat || chat === null) return false;
                const chatCharId = chat.characterId || chat.metadata?.characterId;
                return chatCharId === characterId && chat.chatName === candidateName;
            })) {
                counter++;
                candidateName = `${originalChatName} (${counter})`;
            }
            finalChatName = candidateName;
            console.log('[importChat] 같은 제목의 채팅 발견, 제목 수정:', {
                originalChatName: originalChatName,
                newChatName: finalChatName,
                duplicateCount: duplicateNameChats.length
            });
        }
        
        // chatId 생성: 중복 방지된 제목 사용
        let chatId = '';
        if (characterId) {
            // 원본 create_date를 ID에 포함하여 중복 방지
            // 날짜를 숫자 문자열로 변환 (예: 2025-11-02@03h53m18s -> 20251102035318)
            let dateSuffix = '';
            if (originalCreateDateStr && typeof originalCreateDateStr === 'string') {
                // ISO 형식이나 실리태번 형식에서 숫자만 추출
                dateSuffix = originalCreateDateStr.replace(/[^0-9]/g, '').substring(0, 14);
            }
            if (!dateSuffix && originalCreateDate) {
                // Date 객체에서 직접 추출
                const date = new Date(originalCreateDate);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hour = String(date.getHours()).padStart(2, '0');
                const minute = String(date.getMinutes()).padStart(2, '0');
                const second = String(date.getSeconds()).padStart(2, '0');
                dateSuffix = `${year}${month}${day}${hour}${minute}${second}`;
            }
            if (!dateSuffix) {
                // fallback: 메시지 해시 사용
                const messageHash = convertedMessages.length > 0 
                    ? convertedMessages.map(m => m.send_date || m.mes || '').join('|').substring(0, 20)
                    : Date.now().toString().substring(0, 14);
                dateSuffix = messageHash.replace(/[^0-9]/g, '').substring(0, 14) || Date.now().toString().substring(0, 14);
            }
            
            // 중복 방지된 제목 사용
            const baseName = finalChatName.replace(/[^a-zA-Z0-9가-힣]/g, '_');
            chatId = `${characterId}_${baseName}_${dateSuffix}`;
        } else {
            chatId = generateChatId(metadata, file.name);
        }
        
        // 중복 채팅 확인: 같은 chatId 또는 비슷한 채팅 찾기
        
        // 1. 같은 chatId가 있는지 확인 (삭제된 채팅 제외)
        const existingChatById = allChats[chatId];
        if (existingChatById && existingChatById !== null && existingChatById.metadata?.isImported) {
            // 기존 채팅의 imported_date와 lastMessageDate를 업데이트 (최근 불러온 채팅으로 표시)
            const importedDate = Date.now(); // 현재 시간
            existingChatById.metadata.imported_date = importedDate;
            existingChatById.lastMessageDate = importedDate;
            
            // 업데이트된 채팅 저장
            await ChatStorage.save(chatId, existingChatById);
            
            console.log('[importChat] 같은 chatId의 불러오기 채팅 발견, 기존 채팅 사용 및 업데이트:', chatId);
            return {
                success: true,
                chatId: chatId,
                characterId: characterId,
                characterName: characterName,
                metadata: existingChatById.metadata,
                messageCount: existingChatById.messages?.length || 0,
                isExisting: true
            };
        }
        
        // 2. 같은 characterId이고 같은 메시지 개수와 원본 create_date를 가진 채팅 찾기
        const similarChats = Object.entries(allChats)
            .filter(([id, chat]) => {
                // 삭제된 채팅 제외
                if (!chat || chat === null) return false;
                
                // 같은 캐릭터의 불러오기한 채팅만 확인
                if (!chat.metadata?.isImported) return false;
                if (chat.characterId !== characterId && chat.metadata?.characterId !== characterId) return false;
                
                // 원본 create_date가 같은지 확인
                const chatCreateDate = chat.metadata?.create_date || 0;
                const thisCreateDate = createDate || 0;
                
                // 날짜가 1초 이내 차이면 같은 채팅으로 간주 (타임존 차이 고려)
                const dateDiff = Math.abs(chatCreateDate - thisCreateDate);
                if (dateDiff > 1000) return false; // 1초 이상 차이면 다른 채팅
                
                // 메시지 개수가 같은지 확인
                const chatMessageCount = chat.messages?.length || 0;
                const thisMessageCount = convertedMessages.length;
                if (Math.abs(chatMessageCount - thisMessageCount) > 0) return false;
                
                return true;
            });
        
        if (similarChats.length > 0) {
            // 가장 최근에 불러온 채팅 사용 (imported_date 기준)
            const mostRecent = similarChats
                .map(([id, chat]) => ({
                    id,
                    chat,
                    importedDate: chat.metadata?.imported_date || 0
                }))
                .sort((a, b) => b.importedDate - a.importedDate)[0];
            
            // 기존 채팅의 imported_date와 lastMessageDate를 업데이트 (최근 불러온 채팅으로 표시)
            const importedDate = Date.now(); // 현재 시간
            mostRecent.chat.metadata.imported_date = importedDate;
            mostRecent.chat.lastMessageDate = importedDate;
            
            // 업데이트된 채팅 저장
            await ChatStorage.save(mostRecent.id, mostRecent.chat);
            
            console.log('[importChat] 비슷한 불러오기 채팅 발견, 기존 채팅 사용 및 업데이트:', mostRecent.id);
            return {
                success: true,
                chatId: mostRecent.id,
                characterId: characterId,
                characterName: characterName,
                metadata: mostRecent.chat.metadata,
                messageCount: mostRecent.chat.messages?.length || 0,
                isExisting: true
            };
        }
        
        // 채팅 데이터 구성 (우리 형식)
        // 불러오기한 채팅의 lastMessageDate는 불러온 시간으로 설정 (채팅 목록에서 최신순 정렬 반영)
        const importedDate = Date.now(); // 불러온 시간
        // ⚠️ 중요: 불러온 채팅도 일반 채팅처럼 저장 (isImported 플래그 제거)
        // 불러온 채팅을 저장할 때부터 일반 채팅처럼 취급하여 그리팅 추가 문제 방지
        const chatData = {
            characterId: characterId, // 없으면 null
            chatName: finalChatName, // 중복 방지된 제목 사용
            metadata: {
                user_name: metadata.user_name || 'User',
                character_name: characterName,
                create_date: createDate, // 원본 채팅의 생성 날짜 (실리태번 호환)
                chat_metadata: metadata.chat_metadata || {},
                // isImported와 imported_date 제거: 일반 채팅처럼 취급
            },
            messages: convertedMessages,
            // 마지막 메시지의 send_date를 lastMessageDate로 사용 (일반 채팅과 동일)
            lastMessageDate: convertedMessages.length > 0 && convertedMessages[convertedMessages.length - 1]?.send_date
                ? convertedMessages[convertedMessages.length - 1].send_date
                : importedDate, // 메시지가 없으면 불러온 시간 사용
        };
        
        // 채팅 저장
        await ChatStorage.save(chatId, chatData);
        
        // 저장 후 검증: 저장된 메시지 수 확인
        const savedChatData = await ChatStorage.load(chatId);
        const savedMessageCount = savedChatData?.messages?.length || 0;
        
        if (savedMessageCount !== convertedMessages.length) {
            console.error('[importChat] ⚠️ 메시지 수 불일치:', {
                expectedCount: convertedMessages.length,
                savedCount: savedMessageCount,
                chatId: chatId.substring(0, 50)
            });
            if (typeof showErrorCodeToast === 'function') {
                showErrorCodeToast('WARN_FILE_20009', `메시지 저장 불일치: 예상 ${convertedMessages.length}개, 저장 ${savedMessageCount}개`);
            }
        } else {
            console.log('[importChat] ✅ 채팅 저장 완료:', {
                chatId: chatId.substring(0, 50),
                messageCount: savedMessageCount,
                characterName: characterName
            });
        }
        
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

